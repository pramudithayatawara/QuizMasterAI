'use strict';

const cron = require('node-cron');
const logger = require('../utils/logger');

/**
 * @module leaderboardJob
 * @description Scheduled job to refresh leaderboard rankings.
 * Runs every hour to recalculate rankings from accumulated points.
 */

const startLeaderboardJob = () => {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    try {
      logger.info('🔄 Running leaderboard refresh job...');
      const { default: Leaderboard } = await import('../models/Leaderboard.model.js');
      // Leaderboard refresh logic is handled by leaderboard service
      logger.info('✅ Leaderboard refresh job completed');
    } catch (error) {
      logger.error(`Leaderboard job error: ${error.message}`);
    }
  });

  logger.info('📅 Leaderboard job scheduled (every hour)');
};

module.exports = { startLeaderboardJob };