'use strict';

const matchmakingService = require('../services/battle/matchmaking.service');
const logger = require('../utils/logger');

/**
 * @module MatchmakingSocket
 * @description Socket.io handlers for matchmaking events.
 */

const registerMatchmakingSocket = (io, socket) => {
  // ─── Get Queue Status ─────────────────────────────────────────────────────
  socket.on('getQueueStatus', () => {
    try {
      const status = matchmakingService.getQueueStatus();
      socket.emit('queueStatus', status);
    } catch (error) {
      socket.emit('matchmakingError', { message: error.message });
    }
  });

  // ─── Check Matchmaking Status ─────────────────────────────────────────────
  socket.on('checkMatchmaking', () => {
    const inQueue = matchmakingService.isInQueue(socket.userId);
    socket.emit('matchmakingCheck', {
      inQueue,
      message: inQueue
        ? 'You are in the matchmaking queue.'
        : 'You are not in the queue.',
    });
  });
};

module.exports = { registerMatchmakingSocket };