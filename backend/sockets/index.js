'use strict';

const { Server } = require('socket.io');
const corsOptions = require('../config/cors');
const { socketAuthMiddleware } = require('./middleware');
const { registerBattleSocket } = require('./battle.socket');
const { registerMatchmakingSocket } = require('./matchmaking.socket');
const logger = require('../utils/logger');

/**
 * @module socketIndex
 * @description Socket.io server initialization and event registration.
 */

let io;

/**
 * @function initializeSocket
 * @param {http.Server} server - Node.js HTTP server
 */
const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: corsOptions.origin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ─── Authentication middleware ────────────────────────────────────────────
  io.use(socketAuthMiddleware);

  // ─── Connection handler ───────────────────────────────────────────────────
  io.on('connection', (socket) => {
    logger.info(`🔌 Socket connected: ${socket.id} | User: ${socket.userId}`);

    // Join user's personal room
    socket.join(`user:${socket.userId}`);

    // Register event handlers
    registerBattleSocket(io, socket);
    registerMatchmakingSocket(io, socket);

    // ─── Disconnect handler ────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      logger.info(`🔌 Socket disconnected: ${socket.id} | Reason: ${reason}`);
    });

    // ─── Error handler ─────────────────────────────────────────────────────
    socket.on('error', (error) => {
      logger.error(`Socket error: ${socket.id} | ${error.message}`);
    });
  });

  logger.info('✅ Socket.io initialized');
  return io;
};

/**
 * @function getIO
 * @description Get Socket.io instance (singleton).
 */
const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized. Call initializeSocket first.');
  return io;
};

module.exports = { initializeSocket, getIO };