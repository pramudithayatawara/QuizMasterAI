'use strict';

const feedbackService = require('../services/feedback/feedback.service');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @controller ResultController
 * @description Handles result and feedback HTTP requests.
 */

class ResultController {
  /**
   * @route   POST /api/v1/results/generate/:attemptId
   * @desc    Generate and save result with AI feedback
   * @access  Private
   */
  generate = asyncHandler(async (req, res) => {
    const { attemptId } = req.params;
    const evaluationData = req.body;

    const result = await feedbackService.generateAndSaveResult(
      attemptId,
      req.user._id,
      evaluationData
    );

    return ApiResponse.success(
      res,
      201,
      'Result generated with AI feedback!',
      { result }
    );
  });

  /**
   * @route   GET /api/v1/results/attempt/:attemptId
   * @desc    Get result for specific attempt
   * @access  Private
   */
  getByAttempt = asyncHandler(async (req, res) => {
    const result = await feedbackService.getResultByAttempt(
      req.params.attemptId,
      req.user._id
    );

    return ApiResponse.success(
      res,
      200,
      'Result retrieved successfully.',
      { result }
    );
  });

  /**
   * @route   GET /api/v1/results
   * @desc    Get all results for current user
   * @access  Private
   */
  getAll = asyncHandler(async (req, res) => {
    const { results, pagination } = await feedbackService.getUserResults(
      req.user._id,
      req.query
    );

    return ApiResponse.paginated(
      res,
      200,
      'Results retrieved successfully.',
      results,
      pagination
    );
  });

  /**
   * @route   GET /api/v1/results/analytics
   * @desc    Get performance analytics
   * @access  Private
   */
  getAnalytics = asyncHandler(async (req, res) => {
    const analytics = await feedbackService.getAnalytics(req.user._id);

    return ApiResponse.success(
      res,
      200,
      'Analytics retrieved successfully.',
      { analytics }
    );
  });
}

module.exports = new ResultController();