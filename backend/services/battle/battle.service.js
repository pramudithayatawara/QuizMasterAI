'use strict';

const Battle = require('../../models/Battle.model');
const Quiz   = require('../../models/Quiz.model');
const gamificationService = require('../gamification/gamification.service');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const {
  getPaginationParams,
  buildPaginationMeta,
} = require('../../helpers/pagination.helper');

/**
 * @service BattleService
 * @description Handles live battle logic.
 *
 * Features:
 * - Answer processing with timing bonus
 * - Live score calculation
 * - Winner determination
 * - Battle history
 * - Disconnect handling
 */

class BattleService {
  constructor() {
    this.POINTS_PER_CORRECT = 100;
    this.MAX_BONUS_POINTS = 50;
    this.TIME_PER_QUESTION = 30; // seconds
    this.answeredPlayers = new Map(); // key: `${battleId}:${questionIndex}` -> Set(userIds)
    this.questionEndsAt = new Map(); // key: battleId -> timestamp (ms) when current question ends
    this.transitioningBattles = new Set(); // key: `${battleId}` - lock to prevent duplicate nextQuestion triggers
  }

  clearTransitioning(battleId) {
    if (battleId) {
      this.transitioningBattles.delete(battleId.toString());
    }
  }

  /**
   * @method joinBattleRoom
   * @description Join a battle room via socket.
   * @param {string} battleId - Battle ID
   * @param {string} userId - User ID
   * @param {object} socket - Socket instance
   * @param {object} io - Socket.io instance
   */
  async joinBattleRoom(battleId, userId, socket, io) {
    const battle = await Battle.findById(battleId);

    if (!battle) {
      throw new AppError('Battle not found.', 404, 'BATTLE_NOT_FOUND');
    }

    // Verify player is part of this battle
    const isPlayer = battle.players.some(
      (p) => p.userId.toString() === userId
    );

    if (!isPlayer) {
      throw new AppError(
        'You are not a participant in this battle.',
        403,
        'NOT_PARTICIPANT'
      );
    }

    // Join socket room
    socket.join(`battle:${battle.roomId}`);

    // Update player connection status
    await Battle.findOneAndUpdate(
      { _id: battleId, 'players.userId': userId },
      { $set: { 'players.$.isConnected': true } }
    );

    logger.info(
      `[Battle] Player ${userId} joined room: ${battle.roomId}`
    );

    // Emit current battle state to joining player
    socket.emit('battleState', {
      battleId: battle._id,
      roomId: battle.roomId,
      status: battle.status,
      players: battle.players,
      currentQuestionIndex: battle.currentQuestionIndex,
      difficulty: battle.difficulty,
    });

    return battle;
  }

  /**
   * @method sanitizeQuestion
   * @description Strip correctAnswer and explanation before sending to client.
   */
  sanitizeQuestion(question) {
    if (!question) return null;
    const raw = typeof question.toObject === 'function' ? question.toObject() : { ...question };
    delete raw.correctAnswer;
    delete raw.explanation;
    return raw;
  }

  /**
   * @private _isAnswerCorrect
   * @description Robust answer evaluation supporting letter (A/B/C/D), option text, and numeric index.
   */
  _isAnswerCorrect(question, answer) {
    if (answer === null || answer === undefined) return false;
    const sub = String(answer).trim().toUpperCase();
    const correct = String(question.correctAnswer || '').trim().toUpperCase();

    // 1. Direct string match
    if (sub === correct) return true;

    // 2. Map between option index / letter ('A', 'B', 'C', 'D') and option text
    if (Array.isArray(question.options)) {
      const letters = ['A', 'B', 'C', 'D'];

      // If correct is a letter ('A', 'B', 'C', 'D')
      const correctIdx = letters.indexOf(correct);
      if (correctIdx !== -1 && question.options[correctIdx] !== undefined) {
        const opt = question.options[correctIdx];
        const optText = String(typeof opt === 'object' ? (opt.text || opt.value) : opt).trim().toUpperCase();
        if (sub === optText) return true;
      }

      // If submitted answer is a letter ('A', 'B', 'C', 'D')
      const subIdx = letters.indexOf(sub);
      if (subIdx !== -1 && question.options[subIdx] !== undefined) {
        const opt = question.options[subIdx];
        const optText = String(typeof opt === 'object' ? (opt.text || opt.value) : opt).trim().toUpperCase();
        if (optText === correct) return true;
      }

      // If correct is option text, find its index and check if submitted answer was the corresponding letter
      const matchingIdx = question.options.findIndex((opt) => {
        const text = String(typeof opt === 'object' ? (opt.text || opt.value) : opt).trim().toUpperCase();
        return text === correct;
      });
      if (matchingIdx !== -1 && letters[matchingIdx] === sub) {
        return true;
      }
    }

    return false;
  }

  /**
   * @method startQuestionTimer
   * @description Server-side round timer so games advance if players take too long.
   */
  startQuestionTimer(battleId, questionIndex, io) {
    this.clearQuestionTimer(battleId);
    if (!io) return;

    // Fetch battle to get roomId for emitting
    return Battle.findById(battleId).then(battle => {
      if (!battle) return;
      const endAt = Date.now() + (this.TIME_PER_QUESTION + 1) * 1000; // ms
      // Store end timestamp for potential sync use
      this.questionEndsAt.set(battleId.toString(), endAt);

      const timer = setTimeout(async () => {
        try {
          await this.advanceQuestion(battleId, io);
        } catch (err) {
          logger.error(`[Battle] Error in question round timer: ${err.message}`);
        }
      }, (this.TIME_PER_QUESTION + 1) * 1000);

      this.questionTimers.set(battleId.toString(), timer);

      // Emit timer synchronization to all participants
      io.to(`battle:${battle.roomId}`).emit('timerSync', {
        battleId: battleId,
        endAt,
      });
    });
  }

  /**
   * @method clearQuestionTimer
   */
  clearQuestionTimer(battleId) {
    // Clear any stored end timestamp when timer is cleared
    this.questionEndsAt.delete(battleId.toString());
    if (this.questionTimers.has(key)) {
      clearTimeout(this.questionTimers.get(key));
      this.questionTimers.delete(key);
    }
  }

  /**
   * @method advanceQuestion
   * @description Advance question automatically when timer expires or all players answered.
   */
  async advanceQuestion(battleId, io) {
    this.clearQuestionTimer(battleId);
    const battleIdStr = battleId.toString();
    if (this.transitioningBattles.has(battleIdStr)) return;
    this.transitioningBattles.add(battleIdStr);

    try {
      const battle = await Battle.findById(battleId);
      if (!battle || battle.status !== 'active') {
        this.clearTransitioning(battleIdStr);
        return;
      }

      const questionIndex = battle.currentQuestionIndex;
      const isLastQuestion = questionIndex >= battle.questions.length - 1;

      if (isLastQuestion) {
        const winner = battle.determineWinner();
        const finalScores = battle.players.map((p) => ({
          userId: p.userId,
          userName: p.userName,
          totalPoints: p.totalPoints,
          correctCount: p.correctCount,
          wrongCount: p.wrongCount,
          rank: p.rank,
        }));

        await Battle.findByIdAndUpdate(battleId, {
          status: 'finished',
          winnerId: winner?.userId,
          winnerName: winner?.userName,
          isDraw: battle.isDraw,
          finishedAt: new Date(),
          players: battle.players,
        });

        await this._processBattleGamification(battle, winner);

        this.clearTransitioning(battleIdStr);

        io.to(`battle:${battle.roomId}`).emit('battleFinished', {
          winner,
          isDraw: !winner,
          finalScores,
          battleId,
          message: winner ? `🏆 ${winner.userName} wins!` : "🤝 It's a draw!",
        });
        logger.info(`[Battle] Timer/Round finished battle: ${battleId}`);
      } else {
        const nextIndex = questionIndex + 1;
        await Battle.findByIdAndUpdate(battleId, {
          currentQuestionIndex: nextIndex,
        });

        const nextQuestion = this.sanitizeQuestion(battle.questions[nextIndex]);
        this.clearTransitioning(battleIdStr);

        io.to(`battle:${battle.roomId}`).emit('nextQuestion', {
          question: nextQuestion,
          questionIndex: nextIndex,
          totalQuestions: battle.questions.length,
          timeLimit: this.TIME_PER_QUESTION,
        });

        this.startQuestionTimer(battleId, nextIndex, io);
        logger.info(`[Battle] Advanced ${battleId} to question ${nextIndex}`);
      }
    } catch (err) {
      this.clearTransitioning(battleIdStr);
      throw err;
    }
  }

  /**
   * @method processAnswer
   * @description Process player's answer submission during battle.
   * @param {string} battleId - Battle ID
   * @param {string} userId - User ID
   * @param {string} questionId - Question ID
   * @param {string} answer - Player's answer
   * @param {number} timeRemaining - Time remaining when answered (seconds)
   * @param {number} [submittedQuestionIndex] - Optional client question index
   * @returns {object} Result with updated scores
   */
  async processAnswer(battleId, userId, questionId, answer, timeRemaining, submittedQuestionIndex) {
    const battle = await Battle.findById(battleId);

    if (!battle) {
      throw new AppError('Battle not found.', 404);
    }

    if (battle.status !== 'active') {
      throw new AppError('Battle is not active.', 400);
    }

    const questionIndex =
      typeof submittedQuestionIndex === 'number' && submittedQuestionIndex >= 0
        ? submittedQuestionIndex
        : battle.currentQuestionIndex;

    // Discard answer if client sent an expired question index
    if (questionIndex !== battle.currentQuestionIndex) {
      return {
        alreadyExpired: true,
        isCorrect: false,
        points: 0,
        scores: battle.players.map((p) => ({
          userId: p.userId,
          userName: p.userName,
          totalPoints: p.totalPoints,
          correctCount: p.correctCount,
        })),
        allAnswered: false,
        battleFinished: false,
        nextQuestion: null,
      };
    }

    const question = battle.questions[questionIndex];
    if (!question) {
      throw new AppError('Question not found.', 404);
    }

    // Check duplicate answer for this question
    const roundKey = `${battleId}:${questionIndex}`;
    if (!this.answeredPlayers.has(roundKey)) {
      this.answeredPlayers.set(roundKey, new Set());
    }
    const roundSet = this.answeredPlayers.get(roundKey);
    const userStr = userId.toString();

    if (roundSet.has(userStr)) {
      // User already submitted for this round
      return {
        alreadyAnswered: true,
        isCorrect: false,
        points: 0,
        scores: battle.players.map((p) => ({
          userId: p.userId,
          userName: p.userName,
          totalPoints: p.totalPoints,
          correctCount: p.correctCount,
        })),
        allAnswered: false,
        battleFinished: false,
        nextQuestion: null,
      };
    }

    roundSet.add(userStr);

    // Check answer correctness
    const isCorrect = this._isAnswerCorrect(question, answer);

    // Calculate points with time bonus
    let points = 0;
    if (isCorrect) {
      points = this.POINTS_PER_CORRECT;
      const validTime = Math.max(0, Math.min(Number(timeRemaining) || 0, this.TIME_PER_QUESTION));
      const bonusPoints = Math.round(
        (validTime / this.TIME_PER_QUESTION) * this.MAX_BONUS_POINTS
      );
      points += bonusPoints;
    }

    // Update player score in memory & DB
    battle.updatePlayerScore(userId, points, isCorrect);
    await Battle.findByIdAndUpdate(battleId, {
      players: battle.players,
    });

    // Check if ALL active/connected players have answered
    const activePlayers = battle.players.filter((p) => p.isConnected !== false);
    const allAnswered =
      activePlayers.length > 0 &&
      activePlayers.every((p) => roundSet.has(p.userId.toString()));

    const isLastQuestion = questionIndex >= battle.questions.length - 1;
    let battleFinished = false;
    let nextQuestion = null;
    let nextIndex = questionIndex;
    let winner = null;
    let finalScores = null;

    if (allAnswered) {
      this.clearQuestionTimer(battleId);
      const battleIdStr = battleId.toString();

      if (this.transitioningBattles.has(battleIdStr)) {
        return {
          isCorrect,
          points,
          scores: battle.players.map((p) => ({
            userId: p.userId,
            userName: p.userName,
            totalPoints: p.totalPoints,
            correctCount: p.correctCount,
          })),
          allAnswered: false,
          battleFinished: false,
          nextQuestion: null,
          questionIndex: battle.currentQuestionIndex,
          totalQuestions: battle.questions.length,
        };
      }
      this.transitioningBattles.add(battleIdStr);

      if (isLastQuestion) {
        // Battle finished
        battleFinished = true;
        winner = battle.determineWinner();
        finalScores = battle.players.map((p) => ({
          userId: p.userId,
          userName: p.userName,
          totalPoints: p.totalPoints,
          correctCount: p.correctCount,
          wrongCount: p.wrongCount,
          rank: p.rank,
        }));

        await Battle.findByIdAndUpdate(battleId, {
          status: 'finished',
          winnerId: winner?.userId,
          winnerName: winner?.userName,
          isDraw: battle.isDraw,
          finishedAt: new Date(),
          players: battle.players,
        });

        await this._processBattleGamification(battle, winner);
        this.clearTransitioning(battleIdStr);

        logger.info(
          `[Battle] Finished: ${battleId} | Winner: ${winner?.userName || 'Draw'}`
        );
      } else {
        // Prepare next question
        nextIndex = questionIndex + 1;
        nextQuestion = this.sanitizeQuestion(battle.questions[nextIndex]);

        await Battle.findByIdAndUpdate(battleId, {
          currentQuestionIndex: nextIndex,
        });
      }
    }

    return {
      isCorrect,
      points,
      scores: battle.players.map((p) => ({
        userId: p.userId,
        userName: p.userName,
        totalPoints: p.totalPoints,
        correctCount: p.correctCount,
      })),
      allAnswered,
      battleFinished,
      nextQuestion,
      questionIndex: nextIndex,
      totalQuestions: battle.questions.length,
      winner: winner
        ? {
            userId: winner.userId,
            userName: winner.userName,
          }
        : null,
      finalScores,
    };
  }

  /**
   * @method handlePlayerDisconnect
   * @description Handle player disconnection during battle.
   */
  async handlePlayerDisconnect(userId, io) {
    try {
      // Find active battle for this user
      const battle = await Battle.findOne({
        'players.userId': userId,
        status: 'active',
      });

      if (!battle) return;

      // Mark player as disconnected
      await Battle.findOneAndUpdate(
        { _id: battle._id, 'players.userId': userId },
        { $set: { 'players.$.isConnected': false } }
      );

      // Notify other players
      io.to(`battle:${battle.roomId}`).emit('playerDisconnected', {
        userId,
        message: 'A player has disconnected.',
      });

      // Check if all players disconnected
      const updatedBattle = await Battle.findById(battle._id);
      const allDisconnected = updatedBattle.players.every(
        (p) => !p.isConnected
      );

      if (allDisconnected) {
        await Battle.findByIdAndUpdate(battle._id, {
          status: 'cancelled',
          finishedAt: new Date(),
        });

        logger.info(`[Battle] Cancelled (all disconnected): ${battle._id}`);
      }
    } catch (error) {
      logger.error(`[Battle] Disconnect handler error: ${error.message}`);
    }
  }

  /**
   * @method getBattleById
   * @description Get battle details by ID.
   */
  async getBattleById(battleId, userId) {
    const battle = await Battle.findOne({
      _id: battleId,
      'players.userId': userId,
    }).populate('quizId', 'title difficulty');

    if (!battle) {
      throw new AppError('Battle not found.', 404, 'BATTLE_NOT_FOUND');
    }

    return battle;
  }

  /**
   * @method getBattleHistory
   * @description Get battle history for a user.
   */
  async getBattleHistory(userId, query = {}) {
    const { page, limit, skip } = getPaginationParams(query);

    const [battles, total] = await Promise.all([
      Battle.find({
        'players.userId': userId,
        status: { $in: ['finished', 'cancelled'] },
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-questions'),
      Battle.countDocuments({
        'players.userId': userId,
        status: { $in: ['finished', 'cancelled'] },
      }),
    ]);

    // Format battles with user perspective
    const formatted = battles.map((battle) => {
      const myScore = battle.players.find(
        (p) => p.userId.toString() === userId.toString()
      );

      return {
        battleId: battle._id,
        roomId: battle.roomId,
        difficulty: battle.difficulty,
        status: battle.status,
        isWinner: battle.winnerId?.toString() === userId.toString(),
        isDraw: battle.isDraw,
        myScore: myScore?.totalPoints || 0,
        myCorrectCount: myScore?.correctCount || 0,
        players: battle.players.map((p) => ({
          userName: p.userName,
          totalPoints: p.totalPoints,
          rank: p.rank,
        })),
        startedAt: battle.startedAt,
        finishedAt: battle.finishedAt,
        duration: battle.duration,
      };
    });

    return {
      battles: formatted,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  /**
   * @method createBattleQuiz
   * @description Create a dedicated quiz for battle mode.
   */
  async createBattleQuiz(pdfId, userId, difficulty) {
    const quizService = require('../quiz/quiz.service');

    const quiz = await quizService.generateQuiz(pdfId, userId, {
      difficulty,
      questionCount: 10,
    });

    // Mark as battle quiz
    await Quiz.findByIdAndUpdate(quiz._id, { isBattleQuiz: true });

    return quiz;
  }

  // ─── Private Methods ───────────────────────────────────────────────────────



  /**
   * @private _processBattleGamification
   * @description Process XP and badges for all battle participants.
   */
  async _processBattleGamification(battle, winner) {
    try {
      for (const player of battle.players) {
        const isWinner = winner &&
          player.userId.toString() === winner.userId.toString();

        await gamificationService.processBattleCompletion(
          player.userId,
          isWinner,
          player.totalPoints
        );
      }
    } catch (error) {
      logger.error(
        `[Battle] Gamification processing error: ${error.message}`
      );
    }
  }
}

module.exports = new BattleService();