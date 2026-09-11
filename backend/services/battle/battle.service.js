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
   * @method processAnswer
   * @description Process player's answer submission during battle.
   * @param {string} battleId - Battle ID
   * @param {string} userId - User ID
   * @param {string} questionId - Question ID
   * @param {string} answer - Player's answer
   * @param {number} timeRemaining - Time remaining when answered (seconds)
   * @returns {object} Result with updated scores
   */
  async processAnswer(battleId, userId, questionId, answer, timeRemaining) {
    const battle = await Battle.findById(battleId);

    if (!battle) {
      throw new AppError('Battle not found.', 404);
    }

    if (battle.status !== 'active') {
      throw new AppError('Battle is not active.', 400);
    }

    // Find the question
    const questionIndex = battle.currentQuestionIndex;
    const question = battle.questions[questionIndex];

    if (!question) {
      throw new AppError('Question not found.', 404);
    }

    // Check answer correctness
    const isCorrect =
      String(answer).trim().toUpperCase() ===
      String(question.correctAnswer).trim().toUpperCase();

    // Calculate points with time bonus
    let points = 0;
    if (isCorrect) {
      points = this.POINTS_PER_CORRECT;

      // Time bonus: more points for faster answers
      const bonusPoints = Math.round(
        (timeRemaining / this.TIME_PER_QUESTION) * this.MAX_BONUS_POINTS
      );
      points += bonusPoints;
    }

    // Update player score
    battle.updatePlayerScore(userId, points, isCorrect);

    // Check if all players answered (move to next question)
    const allAnswered = this._checkAllAnswered(
      battle,
      questionIndex,
      userId
    );

    let battleFinished = false;
    let nextQuestion = null;
    let winner = null;
    let finalScores = null;

    if (allAnswered || this._isLastQuestion(battle, questionIndex)) {
      const isLastQuestion = questionIndex >= battle.questions.length - 1;

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

        // Process gamification for all players
        await this._processBattleGamification(battle, winner);

        logger.info(
          `[Battle] Finished: ${battleId} | ` +
          `Winner: ${winner?.userName || 'Draw'}`
        );
      } else {
        // Move to next question
        const nextIndex = questionIndex + 1;
        nextQuestion = battle.questions[nextIndex];

        await Battle.findByIdAndUpdate(battleId, {
          currentQuestionIndex: nextIndex,
          players: battle.players,
        });
      }
    } else {
      // Save updated scores
      await Battle.findByIdAndUpdate(battleId, {
        players: battle.players,
      });
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
      battleFinished,
      nextQuestion,
      questionIndex: battle.currentQuestionIndex,
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
   * @private _checkAllAnswered
   * @description Check if all players have answered current question.
   * In a 2-player battle, moves to next question as soon as the first
   * player answers (the server-side timer will handle the other player).
   * This is intentional for fast-paced battle gameplay.
   */
  _checkAllAnswered(battle, questionIndex, latestUserId) {
    // Move to next question immediately when any player answers.
    // This keeps the battle fast-paced - the 30s timer is the fallback.
    return true;
  }

  /**
   * @private _isLastQuestion
   */
  _isLastQuestion(battle, currentIndex) {
    return currentIndex >= battle.questions.length - 1;
  }

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