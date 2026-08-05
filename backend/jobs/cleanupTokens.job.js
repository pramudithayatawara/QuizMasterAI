'use strict';

const cron = require('node-cron');
const RefreshToken = require('../models/RefreshToken.model');
const PasswordReset = require('../models/PasswordReset.model');
const logger = require('../utils/logger');

/**
 * @module cleanupTokensJob
 * @description Scheduled job to clean up expired tokens from database.
 * Prevents token table bloat.
 * Runs daily at midnight.
 */

const startCleanupTokensJob = () => {
  // Run daily at midnight
  cron.schedule('0 0 * * *', async () => {
    try {
      logger.info('🧹 Running token cleanup job...');

      const now = new Date();

      // Delete expired refresh tokens
      const deletedRefresh = await RefreshToken.deleteMany({
        $or: [{ expiresAt: { $lt: now } }, { isRevoked: true }],
      });

      // Delete expired/used password reset tokens
      const deletedReset = await PasswordReset.deleteMany({
        $or: [{ expiresAt: { $lt: now } }, { isUsed: true }],
      });

      logger.info(
        `✅ Token cleanup: ${deletedRefresh.deletedCount} refresh tokens, ` +
        `${deletedReset.deletedCount} reset tokens removed`
      );
    } catch (error) {
      logger.error(`Token cleanup job error: ${error.message}`);
    }
  });

  logger.info('📅 Token cleanup job scheduled (daily midnight)');
};

module.exports = { startCleanupTokensJob };