'use strict';

const battleService = require('../services/battle/battle.service');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

/**
 * @controller BattleController
 * @description HTTP endpoints for battle management.
 */

class BattleController {
  /**
   * @route   POST /api/v1/battle/create-quiz
   * @desc    Create a battle quiz from PDF
   * @access  Private
   */
  createBattleQuiz = asyncHandler(async (req, res) => {
    const { pdfId, difficulty } = req.body;

    if (!pdfId) {
      throw new AppError('PDF ID is required.', 400);
    }

    const quiz = await battleService.createBattleQuiz(
      pdfId,
      req.user._id,
      difficulty || 'medium'
    );

    return ApiResponse.success(
      res,
      201,
      'Battle quiz created successfully!',
      { quiz: { id: quiz._id, title: quiz.title, difficulty: quiz.difficulty } }
    );
  });

  /**
   * @route   GET /api/v1/battle/:id
   * @desc    Get battle by ID
   * @access  Private
   */
  getById = asyncHandler(async (req, res) => {
    const battle = await battleService.getBattleById(
      req.params.id,
      req.user._id
    );

    return ApiResponse.success(
      res,
      200,
      'Battle retrieved.',
      { battle }
    );
  });

  /**
   * @route   GET /api/v1/battle/history
   * @desc    Get battle history
   * @access  Private
   */
  getHistory = asyncHandler(async (req, res) => {
    const { battles, pagination } = await battleService.getBattleHistory(
      req.user._id,
      req.query
    );

    return ApiResponse.paginated(
      res,
      200,
      'Battle history retrieved.',
      battles,
      pagination
    );
  });

  /**
   * @route   GET /api/v1/battle/active
   * @desc    Check if user has active battle
   * @access  Private
   */
  getActive = asyncHandler(async (req, res) => {
    const battle = await require('../models/Battle.model').findOne({
      'players.userId': req.user._id,
      status: 'active',
    }).select('_id roomId status difficulty players');

    return ApiResponse.success(
      res,
      200,
      battle ? 'Active battle found.' : 'No active battle.',
      { battle }
    );
  });
}

module.exports = new BattleController();