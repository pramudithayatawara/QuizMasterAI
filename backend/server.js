'use strict';

require('dotenv').config();
const http = require('http');
const app = require('./routes/app');
const connectDB = require('./config/db');
const config = require('./config/env');
const { initializeSocket } = require('./sockets/index');

// ─── Unhandled rejection handler ─────────────────────────────────────────────────
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
  console.error('Shutting down gracefully...');
  process.exit(1);
});

// ─── Uncaught exception handler ───────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  console.error('Shutting down immediately...');
  process.exit(1);
});

// ─── Create HTTP server ──────────────────────────────────────────────────────────
const server = http.createServer(app);

// ─── Initialize Socket.IO ────────────────────────────────────────────────────────
// Must be done BEFORE server.listen so that Socket.IO attaches to the HTTP server
initializeSocket(server);

// ─── Application startup ──────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Start server
    server.listen(config.PORT, () => {
      console.log('═══════════════════════════════════════════');
      console.log('🚀 RAG Quiz Backend Server Started');
      console.log(`📍 Port       : ${config.PORT}`);
      console.log(`🌍 Environment: ${config.NODE_ENV}`);
      console.log(`🔗 API URL    : http://localhost:${config.PORT}/api/${config.API_VERSION}`);
      console.log(`❤️  Health     : http://localhost:${config.PORT}/api/${config.API_VERSION}/health`);
      console.log(`⚡ Socket.IO  : ws://localhost:${config.PORT}`);
      console.log('═══════════════════════════════════════════');
    });

    console.log('✅ Server started successfully');
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = server;