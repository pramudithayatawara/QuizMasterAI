'use strict';

const matchmakingService = require('../services/battle/matchmaking.service');
const logger = require('../utils/logger');

/**
 * @module matchmakingSocket
 * @description Handles matchmaking Socket.io events.
 */

const registerMatchmakingSocket = (io, socket) => {
  /**
   * @event joinRoom
   * @description User requests to join matchmaking queue
   */
  socket.on('joinRoom', async (data) => {
    try {
      const { difficulty } = data;

      const result = await matchmakingService.addToQueue(
        socket.userId,
        socket.userName,
        difficulty,
        io
      );

      socket.emit('matchmakingStatus', {
        status: 'queued',
        message: 'Looking for opponents...',
        queuePosition: result.position,
      });

      logger.info(`User ${socket.userId} joined matchmaking queue`);
    } catch (error) {
      socket.emit('matchmakingError', { message: error.message });
    }
  });

  /**
   * @event leaveRoom
   * @description User cancels matchmaking
   */
  socket.on('leaveRoom', async () => {
    try {
      await matchmakingService.removeFromQueue(socket.userId);
      socket.emit('matchmakingStatus', { status: 'cancelled' });
    } catch (error) {
      socket.emit('matchmakingError', { message: error.message });
    }
  });
};

module.exports = { registerMatchmakingSocket };