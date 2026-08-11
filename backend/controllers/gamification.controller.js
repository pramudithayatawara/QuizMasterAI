'use strict';

const gamificationService = require('../services/gamification/gamification.service');
const badgeService = require('../services/gamification/badge.service');
const leaderboardService = require('../services/gamification/leaderboard.service');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @controller GamificationController
 */

class GamificationController {
  /**
   * @route   GET /api/v1/gamification/profile
   * @route   GET /api/v1/gamification/profile/me
   * @desc    Get gamification profile
   * @access  Private
   */
  getProfile = asyncHandler(async (req, res) => {
    const { profile, rank } = await gamificationService.getProfile(
      req.user._id
    );

    return ApiResponse.success(
      res,
      200,
      'Profile retrieved.',
      { profile, rank }
    );
  });

  /**
   * @route   GET /api/v1/gamification/leaderboard
   * @desc    Get global leaderboard
   * @access  Public
   */
  getLeaderboard = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const type = req.query.type || 'global';

    let leaderboard;

    if (type === 'weekly') {
      leaderboard = await leaderboardService.getWeeklyLeaderboard(limit);
    } else {
      leaderboard = await leaderboardService.getGlobalLeaderboard(page, limit);
    }

    // Get user's rank if authenticated
    let userRank = null;
    if (req.user) {
      userRank = await leaderboardService.getUserRank(req.user._id);
    }

    return ApiResponse.success(
      res,
      200,
      'Leaderboard retrieved.',
      { leaderboard, userRank }
    );
  });

  /**
   * @route   GET /api/v1/gamification/badges
   * @desc    Get user badges
   * @access  Private
   */
  getBadges = asyncHandler(async (req, res) => {
    const badges = await badgeService.getUserBadges(req.user._id);

    return ApiResponse.success(
      res,
      200,
      'Badges retrieved.',
      { badges }
    );
  });

  /**
   * @route   GET /api/v1/gamification/my-rank
   * @desc    Get current user rank
   * @access  Private
   */
  getMyRank = asyncHandler(async (req, res) => {
    const rank = await leaderboardService.getUserRank(req.user._id);

    return ApiResponse.success(
      res,
      200,
      'Rank retrieved.',
      { rank }
    );
  });
}

module.exports = new GamificationController();