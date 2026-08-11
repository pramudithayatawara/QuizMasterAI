'use strict';

const express = require('express');
const router = express.Router();

const gamificationController = require('../controllers/gamification.controller');
const { protect, optionalAuth } = require('../middleware/auth.middleware');

// Leaderboard is public but shows user rank if logged in
router.get(
  '/leaderboard',
  optionalAuth,
  gamificationController.getLeaderboard
);

// Protected routes
router.use(protect);
router.get('/profile', gamificationController.getProfile);
router.get('/profile/me', gamificationController.getProfile); // Added for frontend compatibility
router.get('/badges', gamificationController.getBadges);
router.get('/my-rank', gamificationController.getMyRank);

module.exports = router;