'use strict';

const QuizAttempt = require('../../models/QuizAttempt.model');
const User = require('../../models/User.model');
const { DIFFICULTY } = require('../../constants/difficulty');
const { ATTEMPT_STATUS } = require('../../constants/quiz');
const logger = require('../../utils/logger');

/**
 * @service AdaptiveService
 * @description Module 05: Adaptive Quiz Engine
 * Tracks user performance, analyzes attempt history, and dynamically adjusts recommended difficulty.
 * Implements performance-based difficulty progression/regression rules.
 */
class AdaptiveService {
  /**
   * @constant DIFFICULTY_LEVELS
   * @description Ordered difficulty levels for progression
   */
  static DIFFICULTY_LEVELS = [DIFFICULTY.EASY, DIFFICULTY.MEDIUM, DIFFICULTY.HARD];

  /**
   * @constant TIME_LIMITS
   * @description Time limits in minutes per difficulty level
   */
  static TIME_LIMITS = {
    [DIFFICULTY.EASY]: 15,    // 15 minutes (900 seconds)
    [DIFFICULTY.MEDIUM]: 20,  // 20 minutes (1200 seconds)
    [DIFFICULTY.HARD]: 25     // 25 minutes (1500 seconds)
  };

  /**
   * @constant ADAPTIVE_RULES
   * @description Adaptive difficulty rules
   */
  static ADAPTIVE_RULES = {
    HIGH_SCORE_THRESHOLD: 80,    // >= 80% = high performance
    LOW_SCORE_THRESHOLD: 50,     // < 50% = low performance
    CONSECUTIVE_ATTEMPTS: 3,     // Number of consecutive attempts to trigger change
    HISTORY_SIZE: 10             // Number of recent attempts to analyze
  };

  /**
   * @method getTimeLimit
   * @description Get time limit in minutes based on difficulty
   * @param {string} difficulty - Difficulty level
   * @returns {number} Time limit in minutes
   */
  static getTimeLimit(difficulty) {
    return this.TIME_LIMITS[difficulty] || this.TIME_LIMITS[DIFFICULTY.MEDIUM];
  }

  /**
   * @method getTimeLimitSeconds
   * @description Get time limit in seconds based on difficulty
   * @param {string} difficulty - Difficulty level
   * @returns {number} Time limit in seconds
   */
  static getTimeLimitSeconds(difficulty) {
    return this.getTimeLimit(difficulty) * 60;
  }

  /**
   * @method analyzePerformance
   * @description Analyze user's recent quiz attempts and calculate performance metrics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Performance analysis with stats and recommendations
   */
  static async analyzePerformance(userId) {
    try {
      logger.info(`[Adaptive Engine] Analyzing performance for user: ${userId}`);

      // Get last N completed attempts
      const recentAttempts = await QuizAttempt.getLastNAttempts(
        userId,
        this.ADAPTIVE_RULES.HISTORY_SIZE
      );

      if (!recentAttempts || recentAttempts.length === 0) {
        logger.info(`[Adaptive Engine] No attempts found for user: ${userId}`);
        return this._getDefaultRecommendation(userId);
      }

      // Calculate performance metrics
      const metrics = this._calculateMetrics(recentAttempts);

      // Determine recommended difficulty
      const recommendation = this._calculateRecommendation(metrics, recentAttempts);

      logger.info(`[Adaptive Engine] Recommendation for user ${userId}: ${recommendation.difficulty}`);

      return {
        success: true,
        userId,
        currentDifficulty: metrics.currentDifficulty,
        recommendedDifficulty: recommendation.difficulty,
        shouldAdjust: recommendation.shouldAdjust,
        adjustmentReason: recommendation.reason,
        metrics: {
          totalAttempts: recentAttempts.length,
          averageScore: metrics.averageScore,
          highScoreCount: metrics.highScoreCount,
          lowScoreCount: metrics.lowScoreCount,
          consecutiveHighScores: metrics.consecutiveHighScores,
          consecutiveLowScores: metrics.consecutiveLowScores,
          recentPerformance: recentAttempts.map(attempt => ({
            score: attempt.percentage,
            difficulty: attempt.difficulty,
            completedAt: attempt.completedAt
          }))
        }
      };
    } catch (error) {
      logger.error(`[Adaptive Engine] Performance analysis error: ${error.message}`);
      throw error;
    }
  }

  /**
   * @method updateDifficultyAfterSubmission
   * @description Update user's current difficulty based on quiz submission performance
   * @param {string} userId - User ID
   * @param {Object} quizData - Quiz submission data
   * @returns {Promise<Object>} Updated difficulty and adaptive status
   */
  static async updateDifficultyAfterSubmission(userId, quizData) {
    try {
      const { scorePercentage, difficulty } = quizData;

      logger.info(`[Adaptive Engine] Updating difficulty after submission for user: ${userId}`);

      // Get user's current difficulty
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const currentDifficulty = user.currentDifficulty || DIFFICULTY.EASY;

      // Get recent attempts including this one
      const recentAttempts = await QuizAttempt.getLastNAttempts(userId, this.ADAPTIVE_RULES.CONSECUTIVE_ATTEMPTS);

      // Calculate consecutive performance
      const consecutiveAnalysis = this._analyzeConsecutivePerformance(recentAttempts);

      let newDifficulty = currentDifficulty;
      let shouldAdjust = false;
      let adjustmentReason = null;

      // Check for difficulty progression (3 consecutive high scores)
      if (consecutiveAnalysis.consecutiveHighScores >= this.ADAPTIVE_RULES.CONSECUTIVE_ATTEMPTS) {
        newDifficulty = this._getNextDifficulty(currentDifficulty, 'increase');
        shouldAdjust = true;
        adjustmentReason = `Excellent performance! ${consecutiveAnalysis.consecutiveHighScores} consecutive high scores (${this.ADAPTIVE_RULES.HIGH_SCORE_THRESHOLD}%+). Increasing difficulty.`;
      }
      // Check for difficulty regression (3 consecutive low scores)
      else if (consecutiveAnalysis.consecutiveLowScores >= this.ADAPTIVE_RULES.CONSECUTIVE_ATTEMPTS) {
        newDifficulty = this._getNextDifficulty(currentDifficulty, 'decrease');
        shouldAdjust = true;
        adjustmentReason = `Struggling with current level. ${consecutiveAnalysis.consecutiveLowScores} consecutive low scores (<${this.ADAPTIVE_RULES.LOW_SCORE_THRESHOLD}%). Decreasing difficulty.`;
      }
      // Otherwise maintain current difficulty
      else {
        adjustmentReason = 'Performance is within acceptable range. Maintaining current difficulty.';
      }

      // Update user's difficulty if adjustment is needed
      if (shouldAdjust && newDifficulty !== currentDifficulty) {
        await User.findByIdAndUpdate(userId, {
          currentDifficulty: newDifficulty
        });
        logger.info(`[Adaptive Engine] Updated user ${userId} difficulty: ${currentDifficulty} -> ${newDifficulty}`);
      }

      // Update the most recent QuizAttempt with adaptive adjustment
      const recentAttempt = await QuizAttempt.findOne({
        userId,
        status: ATTEMPT_STATUS.COMPLETED
      }).sort({ completedAt: -1 });

      if (recentAttempt) {
        const adjustmentType = shouldAdjust && newDifficulty !== currentDifficulty 
          ? (this.DIFFICULTY_LEVELS.indexOf(newDifficulty) > this.DIFFICULTY_LEVELS.indexOf(currentDifficulty) ? 'increased' : 'decreased')
          : 'maintained';

        await QuizAttempt.findByIdAndUpdate(recentAttempt._id, {
          adaptiveAdjustment: adjustmentType,
          previousDifficulty: currentDifficulty
        });
      }

      return {
        success: true,
        userId,
        previousDifficulty: currentDifficulty,
        newDifficulty,
        shouldAdjust,
        adjustmentReason,
        scorePercentage,
        consecutiveAnalysis
      };
    } catch (error) {
      logger.error(`[Adaptive Engine] Difficulty update error: ${error.message}`);
      throw error;
    }
  }

  /**
   * @method _getDefaultRecommendation
   * @description Get default recommendation for users with no attempts
   * @param {string} userId - User ID
   * @returns {Object} Default recommendation
   */
  static async _getDefaultRecommendation(userId) {
    const user = await User.findById(userId);
    const currentDifficulty = user?.currentDifficulty || DIFFICULTY.EASY;

    return {
      success: true,
      userId,
      currentDifficulty,
      recommendedDifficulty: currentDifficulty,
      shouldAdjust: false,
      adjustmentReason: 'No previous attempts found. Starting at current difficulty level.',
      metrics: {
        totalAttempts: 0,
        averageScore: 0,
        highScoreCount: 0,
        lowScoreCount: 0,
        consecutiveHighScores: 0,
        consecutiveLowScores: 0,
        recentPerformance: []
      }
    };
  }

  /**
   * @method _calculateMetrics
   * @description Calculate performance metrics from attempts
   * @param {Array} attempts - Quiz attempts
   * @returns {Object} Performance metrics
   */
  static _calculateMetrics(attempts) {
    if (!attempts || attempts.length === 0) {
      return {
        averageScore: 0,
        highScoreCount: 0,
        lowScoreCount: 0,
        consecutiveHighScores: 0,
        consecutiveLowScores: 0,
        currentDifficulty: DIFFICULTY.EASY
      };
    }

    const scores = attempts.map(a => a.percentage);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const highScoreCount = scores.filter(s => s >= this.ADAPTIVE_RULES.HIGH_SCORE_THRESHOLD).length;
    const lowScoreCount = scores.filter(s => s < this.ADAPTIVE_RULES.LOW_SCORE_THRESHOLD).length;

    const consecutiveAnalysis = this._analyzeConsecutivePerformance(attempts);

    // Get current difficulty from most recent attempt
    const currentDifficulty = attempts[0]?.difficulty || DIFFICULTY.EASY;

    return {
      averageScore: Math.round(averageScore),
      highScoreCount,
      lowScoreCount,
      consecutiveHighScores: consecutiveAnalysis.consecutiveHighScores,
      consecutiveLowScores: consecutiveAnalysis.consecutiveLowScores,
      currentDifficulty
    };
  }

  /**
   * @method _analyzeConsecutivePerformance
   * @description Analyze consecutive high/low scores
   * @param {Array} attempts - Quiz attempts (ordered by date desc)
   * @returns {Object} Consecutive performance analysis
   */
  static _analyzeConsecutivePerformance(attempts) {
    if (!attempts || attempts.length === 0) {
      return { consecutiveHighScores: 0, consecutiveLowScores: 0 };
    }

    let consecutiveHighScores = 0;
    let consecutiveLowScores = 0;

    // Analyze from most recent to oldest
    for (const attempt of attempts) {
      if (attempt.percentage >= this.ADAPTIVE_RULES.HIGH_SCORE_THRESHOLD) {
        consecutiveHighScores++;
        consecutiveLowScores = 0; // Reset low score counter
      } else if (attempt.percentage < this.ADAPTIVE_RULES.LOW_SCORE_THRESHOLD) {
        consecutiveLowScores++;
        consecutiveHighScores = 0; // Reset high score counter
      } else {
        // Score in acceptable range - reset both counters
        consecutiveHighScores = 0;
        consecutiveLowScores = 0;
        break; // Stop counting if we hit acceptable range
      }
    }

    return { consecutiveHighScores, consecutiveLowScores };
  }

  /**
   * @method _calculateRecommendation
   * @description Calculate recommended difficulty based on metrics
   * @param {Object} metrics - Performance metrics
   * @param {Array} attempts - Recent attempts
   * @returns {Object} Difficulty recommendation
   */
  static _calculateRecommendation(metrics, attempts) {
    const { consecutiveHighScores, consecutiveLowScores, currentDifficulty } = metrics;

    let recommendedDifficulty = currentDifficulty;
    let shouldAdjust = false;
    let reason = null;

    // Check for difficulty progression
    if (consecutiveHighScores >= this.ADAPTIVE_RULES.CONSECUTIVE_ATTEMPTS) {
      recommendedDifficulty = this._getNextDifficulty(currentDifficulty, 'increase');
      shouldAdjust = true;
      reason = `Excellent performance! ${consecutiveHighScores} consecutive high scores (${this.ADAPTIVE_RULES.HIGH_SCORE_THRESHOLD}%+). Recommended to increase difficulty.`;
    }
    // Check for difficulty regression
    else if (consecutiveLowScores >= this.ADAPTIVE_RULES.CONSECUTIVE_ATTEMPTS) {
      recommendedDifficulty = this._getNextDifficulty(currentDifficulty, 'decrease');
      shouldAdjust = true;
      reason = `Struggling with current level. ${consecutiveLowScores} consecutive low scores (<${this.ADAPTIVE_RULES.LOW_SCORE_THRESHOLD}%). Recommended to decrease difficulty.`;
    }
    // Otherwise maintain current difficulty
    else {
      reason = 'Performance is within acceptable range. Maintaining current difficulty.';
    }

    return {
      difficulty: recommendedDifficulty,
      shouldAdjust,
      reason
    };
  }

  /**
   * @method _getNextDifficulty
   * @description Get next difficulty level based on direction
   * @param {string} currentDifficulty - Current difficulty
   * @param {string} direction - 'increase' or 'decrease'
   * @returns {string} Next difficulty level
   */
  static _getNextDifficulty(currentDifficulty, direction) {
    const currentIndex = this.DIFFICULTY_LEVELS.indexOf(currentDifficulty);
    
    if (currentIndex === -1) {
      return DIFFICULTY.MEDIUM; // Default if invalid
    }

    if (direction === 'increase') {
      const nextIndex = Math.min(currentIndex + 1, this.DIFFICULTY_LEVELS.length - 1);
      return this.DIFFICULTY_LEVELS[nextIndex];
    } else if (direction === 'decrease') {
      const prevIndex = Math.max(currentIndex - 1, 0);
      return this.DIFFICULTY_LEVELS[prevIndex];
    }

    return currentDifficulty;
  }

  /**
   * @method getUserPerformanceStats
   * @description Get comprehensive user performance statistics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User performance statistics
   */
  static async getUserPerformanceStats(userId) {
    try {
      const allAttempts = await QuizAttempt.find({
        userId,
        status: ATTEMPT_STATUS.COMPLETED
      }).sort({ completedAt: -1 });

      if (!allAttempts || allAttempts.length === 0) {
        return {
          totalAttempts: 0,
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
          difficultyDistribution: { easy: 0, medium: 0, hard: 0 },
          currentDifficulty: DIFFICULTY.EASY
        };
      }

      const scores = allAttempts.map(a => a.percentage);
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const highestScore = Math.max(...scores);
      const lowestScore = Math.min(...scores);

      // Calculate difficulty distribution
      const difficultyDistribution = {
        easy: allAttempts.filter(a => a.difficulty === DIFFICULTY.EASY).length,
        medium: allAttempts.filter(a => a.difficulty === DIFFICULTY.MEDIUM).length,
        hard: allAttempts.filter(a => a.difficulty === DIFFICULTY.HARD).length
      };

      // Get user's current difficulty
      const user = await User.findById(userId);
      const currentDifficulty = user?.currentDifficulty || DIFFICULTY.EASY;

      return {
        totalAttempts: allAttempts.length,
        averageScore: Math.round(averageScore),
        highestScore,
        lowestScore,
        difficultyDistribution,
        currentDifficulty,
        recentAttempts: allAttempts.slice(0, 10).map(attempt => ({
          quizId: attempt.quizId,
          score: attempt.percentage,
          difficulty: attempt.difficulty,
          completedAt: attempt.completedAt,
          timeTaken: attempt.timeTaken
        }))
      };
    } catch (error) {
      logger.error(`[Adaptive Engine] Performance stats error: ${error.message}`);
      throw error;
    }
  }

  /**
   * @method selectInitialAdaptiveQuestion
   * @description Select initial calibration question for an adaptive quiz (Medium tier).
   * @param {Array} availableQuestions - Questions in quiz
   * @returns {Object|null} Initial question
   */
  static selectInitialAdaptiveQuestion(availableQuestions = []) {
    if (!availableQuestions || availableQuestions.length === 0) return null;

    // Prefer Medium difficulty calibration question
    const mediumQuestion = availableQuestions.find(
      (q) => q.difficulty === DIFFICULTY.MEDIUM
    );
    if (mediumQuestion) return mediumQuestion;

    // Fallback to first question
    return availableQuestions[0];
  }

  /**
   * @method calibrateNextStep
   * @description Question-by-Question Real-Time Computerized Adaptive Testing (CAT).
   * Calibrates student ability theta after each question, updates streaks, determines
   * the newly calibrated target difficulty, and selects the next optimal question.
   *
   * @param {Object} attempt - Current QuizAttempt document
   * @param {Object} currentQuestion - Question that was just answered
   * @param {Boolean} isCorrect - Whether answer was correct
   * @param {Number} timeTaken - Seconds spent on this question
   * @param {Array} availableQuestions - All questions in the quiz
   * @returns {Object} Next question and calibration metadata
   */
  static calibrateNextStep(attempt, currentQuestion, isCorrect, timeTaken, availableQuestions = []) {
    const DIFFICULTY_B_PARAMS = {
      [DIFFICULTY.EASY]: -1.0,
      [DIFFICULTY.MEDIUM]: 0.0,
      [DIFFICULTY.HARD]: 1.0,
    };

    const currentTheta = attempt.currentAbilityTheta !== undefined ? attempt.currentAbilityTheta : 0.0;
    const questionDifficulty = currentQuestion.difficulty || DIFFICULTY.MEDIUM;
    const b = DIFFICULTY_B_PARAMS[questionDifficulty] !== undefined ? DIFFICULTY_B_PARAMS[questionDifficulty] : 0.0;

    // IRT Rasch Model: P(theta) = 1 / (1 + e^-(theta - b))
    const pSuccess = 1 / (1 + Math.exp(-(currentTheta - b)));
    const outcome = isCorrect ? 1.0 : 0.0;

    // Response time factor: average expected time is 30s
    let speedMultiplier = 1.0;
    if (isCorrect && timeTaken > 0 && timeTaken < 20) {
      speedMultiplier = 1.2; // fast and accurate
    } else if (!isCorrect && timeTaken > 60) {
      speedMultiplier = 1.1; // struggled and missed
    }

    // Ability update: delta = K * (outcome - P)
    const K = 0.5 * speedMultiplier;
    let newTheta = currentTheta + K * (outcome - pSuccess);
    newTheta = Math.max(-3.0, Math.min(3.0, Number(newTheta.toFixed(3))));

    // Update consecutive streaks
    const consecutiveCorrect = isCorrect ? (attempt.consecutiveCorrect || 0) + 1 : 0;
    const consecutiveIncorrect = !isCorrect ? (attempt.consecutiveIncorrect || 0) + 1 : 0;

    // Determine newly calibrated difficulty level
    const currentLevel = attempt.currentDifficultyLevel || DIFFICULTY.MEDIUM;
    let calibratedLevel = currentLevel;
    let adjustment = 'maintained';
    let calibrationReason = 'Performance within expected range. Maintained difficulty.';

    if (isCorrect) {
      if (consecutiveCorrect >= 2 || newTheta >= 0.75) {
        if (currentLevel === DIFFICULTY.EASY) {
          calibratedLevel = DIFFICULTY.MEDIUM;
          adjustment = 'increased';
          calibrationReason = 'Consistent correct answers! Difficulty upgraded to Medium.';
        } else if (currentLevel === DIFFICULTY.MEDIUM && (consecutiveCorrect >= 2 || newTheta >= 0.85)) {
          calibratedLevel = DIFFICULTY.HARD;
          adjustment = 'increased';
          calibrationReason = 'Excellent mastery demonstrated! Difficulty upgraded to Hard 🔥.';
        }
      }
    } else {
      if (consecutiveIncorrect >= 2 || newTheta <= -0.75) {
        if (currentLevel === DIFFICULTY.HARD) {
          calibratedLevel = DIFFICULTY.MEDIUM;
          adjustment = 'decreased';
          calibrationReason = 'Adjusting challenge to help reinforce concepts. Calibrated to Medium.';
        } else if (currentLevel === DIFFICULTY.MEDIUM && (consecutiveIncorrect >= 2 || newTheta <= -0.85)) {
          calibratedLevel = DIFFICULTY.EASY;
          adjustment = 'decreased';
          calibrationReason = 'Providing foundational questions to rebuild momentum. Calibrated to Easy.';
        }
      }
    }

    // Find next unserved question from the pool
    const servedSet = new Set((attempt.servedQuestionIds || []).map((id) => id.toString()));
    if (currentQuestion._id) {
      servedSet.add(currentQuestion._id.toString());
    }

    const unserved = availableQuestions.filter(
      (q) => !servedSet.has(q._id.toString())
    );

    let nextQuestion = null;
    if (unserved.length > 0) {
      // 1. Try exact difficulty match
      const exactMatches = unserved.filter((q) => q.difficulty === calibratedLevel);
      if (exactMatches.length > 0) {
        nextQuestion = exactMatches[0];
      } else {
        // 2. Fallback to closest available difficulty
        if (calibratedLevel === DIFFICULTY.HARD) {
          nextQuestion = unserved.find((q) => q.difficulty === DIFFICULTY.MEDIUM) || unserved[0];
        } else if (calibratedLevel === DIFFICULTY.EASY) {
          nextQuestion = unserved.find((q) => q.difficulty === DIFFICULTY.MEDIUM) || unserved[0];
        } else {
          nextQuestion = unserved[0];
        }
      }
    }

    return {
      newTheta,
      calibratedLevel,
      consecutiveCorrect,
      consecutiveIncorrect,
      adjustment,
      calibrationReason,
      nextQuestion,
      hasMoreQuestions: nextQuestion !== null,
    };
  }
}

module.exports = AdaptiveService;