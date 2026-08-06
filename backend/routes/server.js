'use strict';

const http = require('http');
const app = require('./app');
const connectDB = require('../config/db');
const config = require('../config/env');
const logger = require('../utils/logger');
const { initializeSocket } = require('../sockets/index');

// ─── Load cron jobs ──────────────────────────────────────────────────────────
const { startLeaderboardJob } = require('../jobs/leaderboard.job');
const { startCleanupTokensJob } = require('../jobs/cleanupTokens.job');

/**
 * @module server
 * @description Application entry point.
 * Creates HTTP server, initializes Socket.io, connects to DB,
 * starts scheduled jobs, and begins listening.
 *
 * Handles graceful shutdown on SIGINT and SIGTERM signals.
 */

// ─── Create HTTP server ──────────────────────────────────────────────────────
const server = http.createServer(app);

// ─── Initialize Socket.io ────────────────────────────────────────────────────
initializeSocket(server);

// ─── Unhandled rejection handler ────────────────────────────────────────────
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION:', err);
  logger.error('Shutting down gracefully...');
  server.close(() => {
    process.exit(1);
  });
});

// ─── Uncaught exception handler ─────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION:', err);
  logger.error('Shutting down immediately...');
  process.exit(1);
});

// ─── Application startup ─────────────────────────────────────────────────────
const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Start server
    server.listen(config.PORT, () => {
      logger.info('═══════════════════════════════════════════');
      logger.info('🚀 RAG Quiz Backend Server Started');
      logger.info(`📍 Port       : ${config.PORT}`);
      logger.info(`🌍 Environment: ${config.NODE_ENV}`);
      logger.info(`🔗 API URL    : http://localhost:${config.PORT}/api/${config.API_VERSION}`);
      logger.info(`❤️  Health     : http://localhost:${config.PORT}/api/${config.API_VERSION}/health`);
      logger.info('═══════════════════════════════════════════');
    });

    // 3. Start scheduled jobs
    startLeaderboardJob();
    startCleanupTokensJob();

    logger.info('✅ Scheduled jobs started');
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = server;