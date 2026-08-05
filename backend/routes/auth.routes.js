'use strict';

const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const authValidator = require('../validators/auth.validator');
const { validate } = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware');
const {
  authRateLimit,
  passwordResetRateLimit,
} = require('../middleware/rateLimiter.middleware');

/**
 * @router AuthRoutes
 * @baseURL /api/v1/auth
 *
 * Public Routes:
 * POST /register       - Create new account
 * POST /login          - Login with credentials
 * POST /refresh-token  - Refresh access token
 * POST /forgot-password - Request password reset
 * POST /reset-password/:token - Reset password
 *
 * Private Routes (JWT Required):
 * POST /logout         - Logout (revoke token)
 * POST /logout-all     - Logout all devices
 * POST /change-password - Change password
 * GET  /me             - Get current user
 */

// ─── Public Routes ────────────────────────────────────────────────────────────

// Register
router.post(
  '/register',
  authRateLimit,
  authValidator.register,
  validate,
  authController.register
);

// Login
router.post(
  '/login',
  authRateLimit,
  authValidator.login,
  validate,
  authController.login
);

// Refresh Token
router.post(
  '/refresh-token',
  authValidator.refreshToken,
  validate,
  authController.refreshToken
);

// Forgot Password
router.post(
  '/forgot-password',
  passwordResetRateLimit,
  authValidator.forgotPassword,
  validate,
  authController.forgotPassword
);

// Reset Password
router.post(
  '/reset-password/:token',
  passwordResetRateLimit,
  authValidator.resetPassword,
  validate,
  authController.resetPassword
);

// ─── Private Routes (Requires Authentication) ─────────────────────────────────

// Logout
router.post('/logout', protect, authController.logout);

// Logout All Devices
router.post('/logout-all', protect, authController.logoutAll);

// Change Password
router.post(
  '/change-password',
  protect,
  authValidator.changePassword,
  validate,
  authController.changePassword
);

// Get Current User
router.get('/me', protect, authController.getMe);

module.exports = router;