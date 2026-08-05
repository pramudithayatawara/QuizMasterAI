'use strict';

const Leaderboard = require('../../models/Leaderboard.model');
const GamificationProfile = require('../../models/GamificationProfile.model');
const User = require('../../models/User.model');
const logger = require('../../utils/logger');

/**
 * @service LeaderboardService
 * @description Manages global leaderboard rankings.
 * Updates rankings after each quiz/battle completion.
 */

class LeaderboardService {
  /**
   * @method updateUserScore
   * @description Update user's leaderboard entry with new points.
   * @param {string} userId - User ID
   * @param {number} points - Points to add
   * @param {object} stats - Additional stats
   */
  async updateUserScore(userId, points, stats = {}) {
    try {
      const user = await User.findById(userId)
        .select('firstName lastName avatar level');

      if (!user) return;

      const update = {
        $inc: {
          totalPoints: points,
          weeklyPoints: points,
          monthlyPoints: points,
        },
        $set: {
          userName: `${user.firstName} ${user.lastName}`,
          userAvatar: user.avatar,
          level: user.level,
          updatedAt: new Date(),
        },
      };

      if (stats.totalQuizzes !== undefined) {
        update.$inc.totalQuizzes = 1;
      }

      if (stats.isWin) {
        update.$inc.totalWins = 1;
      }

      if (stats.score !== undefined) {
        // Update average score
        const existing = await Leaderboard.findOne({ userId });
        if (existing) {
          const newAvg = existing.totalQuizzes > 0
            ? ((existing.averageScore * existing.totalQuizzes) + stats.score) /
              (existing.totalQuizzes + 1)
            : stats.score;
          update.$set.averageScore = parseFloat(newAvg.toFixed(2));
        }
      }

      await Leaderboard.findOneAndUpdate(
        { userId },
        update,
        { upsert: true, new: true }
      );

      logger.info(
        `Leaderboard updated: User ${userId} +${points} points`
      );
    } catch (error) {
      logger.error(`Leaderboard update error: ${error.message}`);
    }
  }

  /**
   * @method getGlobalLeaderboard
   * @description Get paginated global leaderboard.
   * @param {number} page
   * @param {number} limit
   * @returns {Array} Ranked users
   */
  async getGlobalLeaderboard(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const entries = await Leaderboard.find()
      .sort({ totalPoints: -1 })
      .skip(skip)
      .limit(Math.min(limit, 100))
      .populate('userId', 'firstName lastName avatar level currentDifficulty');

    // Add ranks
    return entries.map((entry, index) => ({
      rank: skip + index + 1,
      userId: entry.userId?._id,
      userName: entry.userName,
      avatar: entry.userAvatar,
      level: entry.level,
      totalPoints: entry.totalPoints,
      totalQuizzes: entry.totalQuizzes,
      totalWins: entry.totalWins,
      averageScore: entry.averageScore,
      badges: entry.badges,
    }));
  }

  /**
   * @method getWeeklyLeaderboard
   * @description Get weekly leaderboard.
   */
  async getWeeklyLeaderboard(limit = 50) {
    const entries = await Leaderboard.find()
      .sort({ weeklyPoints: -1 })
      .limit(Math.min(limit, 100))
      .populate('userId', 'firstName lastName avatar level');

    return entries.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId?._id,
      userName: entry.userName,
      weeklyPoints: entry.weeklyPoints,
      level: entry.level,
    }));
  }

  /**
   * @method getUserRank
   * @description Get specific user's rank and surrounding players.
   * @param {string} userId
   * @returns {object} User rank info
   */
  async getUserRank(userId) {
    const userEntry = await Leaderboard.findOne({ userId });

    if (!userEntry) {
      return {
        rank: null,
        totalPoints: 0,
        message: 'Complete a quiz to appear on the leaderboard!',
      };
    }

    // Count users with more points
    const rank = await Leaderboard.countDocuments({
      totalPoints: { $gt: userEntry.totalPoints },
    });

    const totalUsers = await Leaderboard.countDocuments();

    return {
      rank: rank + 1,
      totalPoints: userEntry.totalPoints,
      weeklyPoints: userEntry.weeklyPoints,
      totalUsers,
      percentile: parseFloat(
        (((totalUsers - rank) / totalUsers) * 100).toFixed(1)
      ),
    };
  }

  /**
   * @method resetWeeklyPoints
   * @description Reset weekly points (called by cron job).
   */
  async resetWeeklyPoints() {
    await Leaderboard.updateMany(
      {},
      { $set: { weeklyPoints: 0 } }
    );
    logger.info('Weekly leaderboard points reset');
  }

  /**
   * @method resetMonthlyPoints
   * @description Reset monthly points (called by cron job).
   */
  async resetMonthlyPoints() {
    await Leaderboard.updateMany(
      {},
      { $set: { monthlyPoints: 0 } }
    );
    logger.info('Monthly leaderboard points reset');
  }
}

module.exports = new LeaderboardService();