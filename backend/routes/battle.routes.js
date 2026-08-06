'use strict';

const express = require('express');
const router = express.Router();
const battleService = require('../services/battle/battle.service');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

/**
 * @router BattleRoutes
 * @baseURL /api/v1/battle
 */

// Create battle quiz
router.post('/create-quiz', asyncHandler(async (req, res) => {
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
}));

// Get battle by ID
router.get('/:id', asyncHandler(async (req, res) => {
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
}));

// Get battle history
router.get('/history', asyncHandler(async (req, res) => {
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
}));

// Get active battle
router.get('/active', asyncHandler(async (req, res) => {
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
}));

module.exports = router;