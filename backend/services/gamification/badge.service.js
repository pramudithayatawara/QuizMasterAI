'use strict';

const GamificationProfile = require('../../models/GamificationProfile.model');
const { BADGES } = require('../../constants/badges');
const logger = require('../../utils/logger');

/**
 * @service BadgeService
 * @description Manages badge evaluation and auto-unlocking.
 * Checks all badge criteria after each quiz/battle completion.
 */

class BadgeService {
  /**
   * @method checkAndAwardBadges
   * @description Check all badge criteria and award eligible badges.
   * @param {string} userId - User ID
   * @param {object} stats - Current user statistics
   * @returns {Array} Newly awarded badges
   */
  async checkAndAwardBadges(userId, stats) {
    try {
      const profile = await GamificationProfile.findOne({ userId });
      if (!profile) return [];

      const newBadges = [];

      for (const badge of BADGES) {
        // Skip if already earned
        if (profile.hasBadge(badge.id)) continue;

        // Check criteria
        const earned = this._checkCriteria(badge.criteria, stats, profile);

        if (earned) {
          // Award badge
          profile.awardBadge(badge);
          newBadges.push(badge);

          logger.info(
            `Badge awarded: ${badge.name} to user ${userId}`
          );
        }
      }

      if (newBadges.length > 0) {
        await profile.save();
      }

      return newBadges;
    } catch (error) {
      logger.error(`Badge check error: ${error.message}`);
      return [];
    }
  }

  /**
   * @method getUserBadges
   * @description Get all badges for a user (earned + locked).
   * @param {string} userId
   * @returns {object} { earned, locked, progress }
   */
  async getUserBadges(userId) {
    const profile = await GamificationProfile.findOne({ userId });

    if (!profile) {
      return {
        earned: [],
        locked: BADGES,
        progress: {},
      };
    }

    const earnedIds = new Set(profile.badges.map((b) => b.badgeId));

    const earned = profile.badges;
    const locked = BADGES.filter((b) => !earnedIds.has(b.id));

    // Build progress for locked badges
    const progress = {};
    locked.forEach((badge) => {
      progress[badge.id] = this._getProgress(badge, profile);
    });

    return { earned, locked, progress };
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  /**
   * @private _checkCriteria
   * @description Check if badge criteria is met.
   */
  _checkCriteria(criteria, stats, profile) {
    const { type, value } = criteria;

    switch (type) {
      case 'total_quizzes':
        return profile.totalQuizzes >= value;

      case 'perfect_score':
        return stats.percentage >= value;

      case 'win_streak':
        return profile.winStreak >= value;

      case 'difficulty_completed':
        return profile.difficultiesCompleted.includes(value);

      case 'total_uploads':
        return profile.totalUploads >= value;

      case 'quiz_streak':
        return profile.quizStreak >= value;

      case 'total_wins':
        return profile.totalWins >= value;

      default:
        return false;
    }
  }

  /**
   * @private _getProgress
   * @description Get progress towards a locked badge.
   */
  _getProgress(badge, profile) {
    const { type, value } = badge.criteria;

    let current = 0;

    switch (type) {
      case 'total_quizzes':
        current = profile.totalQuizzes;
        break;
      case 'win_streak':
        current = profile.winStreak;
        break;
      case 'total_uploads':
        current = profile.totalUploads;
        break;
      case 'quiz_streak':
        current = profile.quizStreak;
        break;
      case 'total_wins':
        current = profile.totalWins;
        break;
      default:
        current = 0;
    }

    return {
      current,
      required: value,
      percentage: Math.min(100, Math.round((current / value) * 100)),
    };
  }
}

module.exports = new BadgeService();