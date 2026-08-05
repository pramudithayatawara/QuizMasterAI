'use strict';

const QuizAttempt = require('../../models/QuizAttempt.model');
const User = require('../../models/User.model');
const {
  DIFFICULTY,
  DIFFICULTY_ORDER,
  SCORE_THRESHOLDS,
} = require('../../constants/difficulty');
const { ATTEMPT_STATUS } = require('../../constants/quiz');
const { getLevelFromXP } = require('../../constants/gamification');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

/**
 * @service AdaptiveService
 * @description Intelligent adaptive difficulty engine.
 *
 * Rules:
 * - Track last 10 quiz attempts
 * - 3 consecutive high scores (>=80%) → increase difficulty
 * - 3 consecutive low scores (<=50%)  → decrease difficulty
 * - Otherwise → maintain current difficulty
 *
 * Timer Rules:
 * - Easy   → 15 minutes
 * - Medium → 20 minutes
 * - Hard   → 25 minutes
 */

class AdaptiveService {
  constructor() {
    this.TRACK_LAST_N = 10;          // Track last 10 attempts
    this.CONSECUTIVE_THRESHOLD = 3;  // 3 consecutive for change
    this.HIGH_SCORE = SCORE_THRESHOLDS.HIGH; // >= 80%
    this.LOW_SCORE = SCORE_THRESHOLDS.LOW;   // <= 50%
  }

  /**
   * @method getRecommendedDifficulty
   * @description Get recommended difficulty for next quiz.
   * Analyzes last N attempts and applies adaptive rules.
   * @param {string} userId - User ID
   * @returns {string} Recommended difficulty level
   */
  async getRecommendedDifficulty(userId) {
    try {
      // Get user's current difficulty
      const user = await User.findById(userId).select('currentDifficulty');

      if (!user) {
        return DIFFICULTY.EASY;
      }

      const currentDifficulty = user.currentDifficulty || DIFFICULTY.EASY;

      // Get last N completed attempts
      const recentAttempts = await QuizAttempt.getLastNAttempts(
        userId,
        this.TRACK_LAST_N
      );

      // Not enough attempts to adapt - use current
      if (recentAttempts.length < this.CONSECUTIVE_THRESHOLD) {
        return currentDifficulty;
      }

      // Analyze consecutive performance
      const recommendation = this._analyzePerformance(
        recentAttempts,
        currentDifficulty
      );

      // Update user's difficulty if changed
      if (recommendation !== currentDifficulty) {
        await User.findByIdAndUpdate(userId, {
          currentDifficulty: recommendation,
        });

        logger.info(
          `Adaptive: User ${userId} difficulty changed: ` +
          `${currentDifficulty} → ${recommendation}`
        );
      }

      return recommendation;
    } catch (error) {
      logger.error(`Adaptive difficulty error: ${error.message}`);
      return DIFFICULTY.EASY;
    }
  }

  /**
   * @method updateAfterQuiz
   * @description Update adaptive profile after quiz completion.
   * Called immediately after quiz submission.
   * @param {string} userId - User ID
   * @param {number} scorePercentage - Score percentage (0-100)
   * @param {string} difficulty - Difficulty of completed quiz
   * @returns {object} Updated difficulty info
   */
  async updateAfterQuiz(userId, scorePercentage, difficulty) {
    try {
      const user = await User.findById(userId).select('currentDifficulty');
      if (!user) return null;

      const currentDifficulty = user.currentDifficulty || DIFFICULTY.EASY;

      // Get fresh attempts after this one was saved
      const recentAttempts = await QuizAttempt.getLastNAttempts(
        userId,
        this.TRACK_LAST_N
      );

      const newDifficulty = this._analyzePerformance(
        recentAttempts,
        currentDifficulty
      );

      const changed = newDifficulty !== currentDifficulty;

      if (changed) {
        await User.findByIdAndUpdate(userId, {
          currentDifficulty: newDifficulty,
        });
      }

      return {
        previousDifficulty: currentDifficulty,
        currentDifficulty: newDifficulty,
        changed,
        message: this._buildAdaptiveMessage(
          changed,
          currentDifficulty,
          newDifficulty,
          scorePercentage
        ),
      };
    } catch (error) {
      logger.error(`Update adaptive error: ${error.message}`);
      return null;
    }
  }

  /**
   * @method getPerformanceSummary
   * @description Get detailed performance analytics for a user.
   * @param {string} userId
   * @returns {object} Performance summary
   */
  async getPerformanceSummary(userId) {
    const attempts = await QuizAttempt.getLastNAttempts(
      userId,
      this.TRACK_LAST_N
    );

    if (attempts.length === 0) {
      return {
        totalAttempts: 0,
        averageScore: 0,
        trend: 'new',
        currentDifficulty: DIFFICULTY.EASY,
        consecutiveHighScores: 0,
        consecutiveLowScores: 0,
      };
    }

    const scores = attempts.map((a) => a.percentage);
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    const trend = this._calculateTrend(scores);
    const {
      consecutiveHighScores,
      consecutiveLowScores,
    } = this._countConsecutive(attempts);

    const user = await User.findById(userId).select('currentDifficulty');

    return {
      totalAttempts: attempts.length,
      averageScore: parseFloat(avgScore.toFixed(2)),
      trend,
      currentDifficulty: user?.currentDifficulty || DIFFICULTY.EASY,
      consecutiveHighScores,
      consecutiveLowScores,
      recentScores: scores.slice(0, 5),
    };
  }

  // ─── Private Methods ───────────────────────────────────────────────────────

  /**
   * @private _analyzePerformance
   * @description Core adaptive algorithm.
   */
  _analyzePerformance(attempts, currentDifficulty) {
    if (attempts.length < this.CONSECUTIVE_THRESHOLD) {
      return currentDifficulty;
    }

    const { consecutiveHighScores, consecutiveLowScores } =
      this._countConsecutive(attempts);

    const currentIndex = DIFFICULTY_ORDER.indexOf(currentDifficulty);

    // 3 consecutive high scores → increase difficulty
    if (consecutiveHighScores >= this.CONSECUTIVE_THRESHOLD) {
      const nextIndex = Math.min(
        currentIndex + 1,
        DIFFICULTY_ORDER.length - 1
      );
      return DIFFICULTY_ORDER[nextIndex];
    }

    // 3 consecutive low scores → decrease difficulty
    if (consecutiveLowScores >= this.CONSECUTIVE_THRESHOLD) {
      const prevIndex = Math.max(currentIndex - 1, 0);
      return DIFFICULTY_ORDER[prevIndex];
    }

    return currentDifficulty;
  }

  /**
   * @private _countConsecutive
   * @description Count consecutive high/low scores from recent attempts.
   */
  _countConsecutive(attempts) {
    let consecutiveHighScores = 0;
    let consecutiveLowScores = 0;

    // Check from most recent attempt
    for (const attempt of attempts) {
      const score = attempt.percentage;

      if (score >= this.HIGH_SCORE) {
        consecutiveHighScores++;
        consecutiveLowScores = 0;
      } else if (score <= this.LOW_SCORE) {
        consecutiveLowScores++;
        consecutiveHighScores = 0;
      } else {
        // Medium score breaks streak
        break;
      }
    }

    return { consecutiveHighScores, consecutiveLowScores };
  }

  /**
   * @private _calculateTrend
   * @description Calculate performance trend from score history.
   */
  _calculateTrend(scores) {
    if (scores.length < 2) return 'new';

    const recent = scores.slice(0, 3);
    const older = scores.slice(3, 6);

    if (older.length === 0) return 'new';

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const diff = recentAvg - olderAvg;

    if (diff > 5) return 'improving';
    if (diff < -5) return 'declining';
    return 'stable';
  }

  /**
   * @private _buildAdaptiveMessage
   * @description Build user-friendly adaptive feedback message.
   */
  _buildAdaptiveMessage(changed, from, to, score) {
    if (!changed) {
      if (score >= this.HIGH_SCORE) {
        return `Great score of ${score}%! Keep it up to advance to the next level.`;
      }
      if (score <= this.LOW_SCORE) {
        return `Score of ${score}%. Practice more to improve your performance.`;
      }
      return `Good effort! Score: ${score}%.`;
    }

    const isIncrease = DIFFICULTY_ORDER.indexOf(to) >
      DIFFICULTY_ORDER.indexOf(from);

    if (isIncrease) {
      return `🎉 Excellent! You've consistently scored high. Difficulty increased to ${to.toUpperCase()}!`;
    }

    return `📚 Difficulty adjusted to ${to.toUpperCase()} to help you build confidence.`;
  }
}

module.exports = new AdaptiveService();
