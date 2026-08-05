'use strict';

const battleService = require('../services/battle/battle.service');
const matchmakingService = require('../services/battle/matchmaking.service');
const logger = require('../utils/logger');

/**
 * @module BattleSocket
 * @description Complete Socket.io event handlers for battle mode.
 *
 * Events Handled:
 * - joinRoom          → Join matchmaking queue
 * - leaveRoom         → Leave matchmaking queue
 * - joinBattle        → Join specific battle room
 * - submitAnswerLive  → Submit answer during battle
 * - requestNextQ      → Request next question
 * - disconnect        → Handle disconnection
 */

const registerBattleSocket = (io, socket) => {
  // ─── Join Matchmaking Queue ──────────────────────────────────────────────
  socket.on('joinRoom', async (data) => {
    try {
      const { difficulty } = data || {};

      const result = await matchmakingService.addToQueue(
        socket.userId,
        socket.userName,
        difficulty,
        io
      );

      socket.emit('matchmakingStatus', {
        status: 'queued',
        message: `Searching for opponents... (Position: ${result.position})`,
        queuePosition: result.position,
        queueSize: result.queueSize,
        difficulty: result.difficulty,
        maxWaitTime: 60,
      });

      logger.info(
        `[Socket] ${socket.userName} joined matchmaking | ` +
        `Difficulty: ${difficulty}`
      );
    } catch (error) {
      socket.emit('battleError', {
        type: 'MATCHMAKING_ERROR',
        message: error.message,
      });
    }
  });

  // ─── Leave Matchmaking Queue ──────────────────────────────────────────────
  socket.on('leaveRoom', async () => {
    try {
      await matchmakingService.removeFromQueue(socket.userId);

      socket.emit('matchmakingStatus', {
        status: 'cancelled',
        message: 'Left matchmaking queue.',
      });

      logger.info(`[Socket] ${socket.userName} left matchmaking queue`);
    } catch (error) {
      socket.emit('battleError', {
        type: 'QUEUE_ERROR',
        message: error.message,
      });
    }
  });

  // ─── Join Specific Battle Room ────────────────────────────────────────────
  socket.on('joinBattle', async (data) => {
    try {
      const { battleId } = data;

      const battle = await battleService.joinBattleRoom(
        battleId,
        socket.userId,
        socket,
        io
      );

      // Notify others in room
      socket.to(`battle:${battle.roomId}`).emit('playerJoined', {
        userId: socket.userId,
        userName: socket.userName,
        message: `${socket.userName} has joined the battle!`,
      });

      socket.emit('joinedBattle', {
        success: true,
        battleId: battle._id,
        roomId: battle.roomId,
        players: battle.players,
        status: battle.status,
      });

      logger.info(
        `[Socket] ${socket.userName} joined battle: ${battle.roomId}`
      );
    } catch (error) {
      socket.emit('battleError', {
        type: 'JOIN_ERROR',
        message: error.message,
      });
    }
  });

  // ─── Submit Answer Live ───────────────────────────────────────────────────
  socket.on('submitAnswerLive', async (data) => {
    try {
      const { battleId, questionId, answer, timeRemaining } = data;

      if (!battleId || !questionId || answer === undefined) {
        socket.emit('battleError', {
          type: 'VALIDATION_ERROR',
          message: 'battleId, questionId and answer are required.',
        });
        return;
      }

      const result = await battleService.processAnswer(
        battleId,
        socket.userId,
        questionId,
        answer,
        timeRemaining || 0
      );

      // Emit answer feedback to the answering player
      socket.emit('answerResult', {
        isCorrect: result.isCorrect,
        points: result.points,
        correctAnswer: null, // Don't reveal until all answer
      });

      // Broadcast score update to ALL players in battle room
      const battle = await require('../models/Battle.model')
        .findById(battleId)
        .select('roomId');

      if (battle) {
        io.to(`battle:${battle.roomId}`).emit('scoreUpdate', {
          scores: result.scores,
          lastAnswer: {
            userId: socket.userId,
            userName: socket.userName,
            isCorrect: result.isCorrect,
            pointsEarned: result.points,
          },
        });

        // Battle finished
        if (result.battleFinished) {
          io.to(`battle:${battle.roomId}`).emit('battleFinished', {
            winner: result.winner,
            isDraw: !result.winner,
            finalScores: result.finalScores,
            battleId,
            message: result.winner
              ? `🏆 ${result.winner.userName} wins!`
              : "🤝 It's a draw!",
          });

          logger.info(
            `[Socket] Battle finished: ${battleId} | ` +
            `Winner: ${result.winner?.userName || 'Draw'}`
          );
        } else if (result.nextQuestion) {
          // Send next question after short delay
          setTimeout(() => {
            io.to(`battle:${battle.roomId}`).emit('nextQuestion', {
              question: result.nextQuestion,
              questionIndex: result.questionIndex + 1,
              totalQuestions: result.totalQuestions,
              timeLimit: 30,
            });
          }, 2000); // 2 second delay between questions
        }
      }
    } catch (error) {
      socket.emit('battleError', {
        type: 'ANSWER_ERROR',
        message: error.message,
      });
      logger.error(
        `[Socket] Answer submission error: ${error.message}`
      );
    }
  });

  // ─── Request Battle Status ────────────────────────────────────────────────
  socket.on('getBattleStatus', async (data) => {
    try {
      const { battleId } = data;

      const battle = await battleService.getBattleById(
        battleId,
        socket.userId
      );

      socket.emit('battleState', {
        battleId: battle._id,
        status: battle.status,
        players: battle.players,
        currentQuestionIndex: battle.currentQuestionIndex,
        difficulty: battle.difficulty,
      });
    } catch (error) {
      socket.emit('battleError', {
        type: 'STATUS_ERROR',
        message: error.message,
      });
    }
  });

  // ─── Timer Sync ───────────────────────────────────────────────────────────
  socket.on('syncTimer', (data) => {
    const { battleId, timeRemaining } = data;
    // Broadcast timer to all players in room for synchronization
    socket.to(`battle:${battleId}`).emit('timerSync', {
      timeRemaining,
      fromUserId: socket.userId,
    });
  });

  // ─── Chat During Battle ───────────────────────────────────────────────────
  socket.on('battleChat', (data) => {
    try {
      const { battleRoomId, message } = data;

      // Basic message validation
      if (!message || message.trim().length === 0) return;
      if (message.length > 100) return; // Limit message length

      io.to(`battle:${battleRoomId}`).emit('battleMessage', {
        userId: socket.userId,
        userName: socket.userName,
        message: message.trim().substring(0, 100),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`[Socket] Chat error: ${error.message}`);
    }
  });

  // ─── Disconnect Handler ───────────────────────────────────────────────────
  socket.on('disconnect', async (reason) => {
    try {
      // Remove from matchmaking queue
      await matchmakingService.removeFromQueue(socket.userId);

      // Handle battle disconnect
      await battleService.handlePlayerDisconnect(socket.userId, io);

      logger.info(
        `[Socket] ${socket.userName} disconnected | Reason: ${reason}`
      );
    } catch (error) {
      logger.error(
        `[Socket] Disconnect handler error: ${error.message}`
      );
    }
  });
};

module.exports = { registerBattleSocket };