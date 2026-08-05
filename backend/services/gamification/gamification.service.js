'use strict';

const GamificationProfile = require('../../models/GamificationProfile.model');
const User = require('../../models/User.model');
const badgeService = require('./badge.service');
const leaderboardService = require('./leaderboard.service');
const adaptiveService = require('../adaptive/adaptive.service');
const {
  XP_REWARDS,
  getLevelFromXP,
} = require('../../constants/gamification');
const logger = require('../../utils/logger');
const AppError = require('../../utils/AppError');

/**
 * @service GamificationService
 * @description Core gamification engine.
 * Manages XP, levels, streaks, badges, and leaderboard.
 *
 * Called after:
 * - Quiz completion
 * - Battle completion
 * - Daily login
 * - PDF upload
 */

class GamificationService {
  /**
   * @method processQuizCompletion
   * @description Process all gamification after quiz completion.
   * @param {string} userId - User ID
   * @param {object} quizData - Quiz result data
   * @returns {object} Gamification rewards
   */
  async processQuizCompletion(userId, quizData) {
    try {
      const {
        percentage,
        difficulty,
        correct,
        total,
      } = quizData;

      // Get or create profile
      let profile = await GamificationProfile.findOne({ userId });
      if (!profile) {
        profile = await GamificationProfile.create({ userId });
      }

      // Calculate XP
      let xpEarned = XP_REWARDS.QUIZ_COMPLETE;

      // Perfect score bonus
      if (percentage === 100) {
        xpEarned += XP_REWARDS.QUIZ_PERFECT;
        profile.perfectScores++;
      }

      // Difficulty bonus
      xpEarned += XP_REWARDS.DIFFICULTY_BONUS[difficulty] || 0;

      // Calculate points (similar to XP but for leaderboard)
      const pointsEarned = Math.round(
        (percentage / 100) * 100 + XP_REWARDS.DIFFICULTY_BONUS[difficulty]
      );

      // Update streak
      const streakUpdated = this._updateQuizStreak(profile);

      // Update stats
      profile.totalXP += xpEarned;
      profile.totalPoints += pointsEarned;
      profile.dailyPoints += pointsEarned;
      profile.weeklyPoints += pointsEarned;
      profile.monthlyPoints += pointsEarned;
      profile.totalQuizzes++;
      profile.level = getLevelFromXP(profile.totalXP);

      // Track difficulty completed
      if (!profile.difficultiesCompleted.includes(difficulty)) {
        profile.difficultiesCompleted.push(difficulty);
      }

      await profile.save();

      // Update user level
      await User.findByIdAndUpdate(userId, {
        totalXP: profile.totalXP,
        level: profile.level,
        quizStreak: profile.quizStreak,
        lastQuizDate: new Date(),
      });

      // Check and award badges
      const newBadges = await badgeService.checkAndAwardBadges(userId, {
        percentage,
        difficulty,
        correct,
        total,
      });

      // Update leaderboard
      await leaderboardService.updateUserScore(userId, pointsEarned, {
        totalQuizzes: true,
        score: percentage,
      });

      // Update adaptive difficulty
      const adaptiveUpdate = await adaptiveService.updateAfterQuiz(
        userId,
        percentage,
        difficulty
      );

      const rewards = {
        xpEarned,
        pointsEarned,
        newLevel: profile.level,
        newBadges,
        streakUpdated,
        quizStreak: profile.quizStreak,
        adaptiveUpdate,
      };

      logger.info(
        `Gamification processed: User ${userId} | ` +
        `XP: +${xpEarned} | Points: +${pointsEarned} | ` +
        `Badges: ${newBadges.length}`
      );

      return rewards;
    } catch (error) {
      logger.error(`Gamification error: ${error.message}`);
      return { xpEarned: 0, pointsEarned: 0, newBadges: [] };
    }
  }

  /**
   * @method processBattleCompletion
   * @description Process gamification after battle.
   * @param {string} userId - User ID
   * @param {boolean} isWinner - Whether user won
   * @param {number} score - Battle score
   */
  async processBattleCompletion(userId, isWinner, score) {
    try {
      let profile = await GamificationProfile.findOne({ userId });
      if (!profile) {
        profile = await GamificationProfile.create({ userId });
      }

      // XP for battle
      let xpEarned = XP_REWARDS.BATTLE_PARTICIPATE;
      let pointsEarned = 30;

      if (isWinner) {
        xpEarned += XP_REWARDS.BATTLE_WIN;
        pointsEarned += 150;
        profile.totalWins++;
        profile.winStreak++;
        profile.maxWinStreak = Math.max(
          profile.maxWinStreak,
          profile.winStreak
        );
      } else {
        profile.winStreak = 0; // Reset win streak on loss
      }

      profile.totalXP += xpEarned;
      profile.totalPoints += pointsEarned;
      profile.weeklyPoints += pointsEarned;
      profile.monthlyPoints += pointsEarned;
      profile.totalBattles++;
      profile.level = getLevelFromXP(profile.totalXP);

      await profile.save();

      // Update user
      await User.findByIdAndUpdate(userId, {
        totalXP: profile.totalXP,
        level: profile.level,
      });

      // Check badges
      const newBadges = await badgeService.checkAndAwardBadges(
        userId,
        { isWinner, score }
      );

      // Update leaderboard
      await leaderboardService.updateUserScore(userId, pointsEarned, {
        isWin: isWinner,
        score,
      });

      return { xpEarned, pointsEarned, newBadges, isWinner };
    } catch (error) {
      logger.error(`Battle gamification error: ${error.message}`);
      return { xpEarned: 0, pointsEarned: 0, newBadges: [] };
    }
  }

  /**
   * @method processDailyLogin
   * @description Award daily login bonus.
   * @param {string} userId
   */
  async processDailyLogin(userId) {
    try {
      const profile = await GamificationProfile.findOne({ userId });
      if (!profile) return;

      const today = new Date().toDateString();
      const lastLogin = profile.lastDailyReset?.toDateString();

      // Already claimed today
      if (today === lastLogin) return;

      profile.dailyPoints = 0; // Reset daily
      profile.totalXP += XP_REWARDS.DAILY_LOGIN;
      profile.totalPoints += XP_REWARDS.DAILY_LOGIN;
      profile.lastDailyReset = new Date();

      await profile.save();

      return { dailyXP: XP_REWARDS.DAILY_LOGIN };
    } catch (error) {
      logger.error(`Daily login error: ${error.message}`);
    }
  }

  /**
   * @method getProfile
   * @description Get complete gamification profile for user.
   */
  async getProfile(userId) {
    const [profile, rank] = await Promise.all([
      GamificationProfile.findOne({ userId }),
      leaderboardService.getUserRank(userId),
    ]);

    if (!profile) {
      throw new AppError('Profile not found.', 404);
    }

    return { profile, rank };
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  /**
   * @private _updateQuizStreak
   * @description Update quiz streak based on last quiz date.
   */
  _updateQuizStreak(profile) {
    const today = new Date();
    const lastQuiz = profile.lastQuizDate;

    if (!lastQuiz) {
      profile.quizStreak = 1;
      profile.lastQuizDate = today;
      return true;
    }

    const daysDiff = Math.floor(
      (today - lastQuiz) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 0) {
      // Same day - no change
      return false;
    } else if (daysDiff === 1) {
      // Consecutive day - increment streak
      profile.quizStreak++;
      profile.maxQuizStreak = Math.max(
        profile.maxQuizStreak,
        profile.quizStreak
      );
    } else {
      // Streak broken
      profile.quizStreak = 1;
    }

    profile.lastQuizDate = today;
    return true;
  }
}

module.exports = new GamificationService();