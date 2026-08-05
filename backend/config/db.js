'use strict';

const mongoose = require('mongoose');
const config = require('./env');
const logger = require('../utils/logger');

/**
 * @module db
 * @description MongoDB connection manager.
 * Handles connection, reconnection, and graceful shutdown.
 * Implements connection event listeners for monitoring.
 */

// ─── Connection options ─────────────────────────────────────────────────────
const MONGOOSE_OPTIONS = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferCommands: false,
};

/**
 * @function connectDB
 * @description Establishes MongoDB connection with retry logic.
 * @returns {Promise<void>}
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.MONGODB_URI, MONGOOSE_OPTIONS);

    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
    logger.info(`📦 Database: ${conn.connection.name}`);
  } catch (error) {
    logger.error(`❌ MongoDB Connection Error: ${error.message}`);
    // Exit process on connection failure
    process.exit(1);
  }
};

// ─── Connection event listeners ─────────────────────────────────────────────
mongoose.connection.on('connected', () => {
  logger.info('🔌 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  logger.error(`❌ Mongoose connection error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️ Mongoose disconnected from MongoDB');
});

// ─── Graceful shutdown ───────────────────────────────────────────────────────
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Closing MongoDB connection...`);
  await mongoose.connection.close();
  logger.info('MongoDB connection closed. Exiting...');
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = connectDB;