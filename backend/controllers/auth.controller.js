'use strict';

const authService = require('../services/auth/auth.service');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const config = require('../config/env');

/**
 * @controller AuthController
 * @description Handles all authentication HTTP requests.
 * Thin controller - delegates business logic to AuthService.
 */

// ─── Cookie Options ──────────────────────────────────────────────────────────
const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,    // Prevent XSS access
  secure: config.IS_PRODUCTION, // HTTPS only in production
  sameSite: 'strict', // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/v1/auth', // Restrict cookie path
};

// ─── Helper: Extract request meta ────────────────────────────────────────────
const getRequestMeta = (req) => ({
  userAgent: req.headers['user-agent'] || null,
  ipAddress: req.ip || req.connection.remoteAddress || null,
});

// ─── Helper: Set refresh token cookie ────────────────────────────────────────
const setRefreshTokenCookie = (res, token) => {
  res.cookie('refreshToken', token, REFRESH_TOKEN_COOKIE_OPTIONS);
};

// ─── Helper: Clear refresh token cookie ──────────────────────────────────────
const clearRefreshTokenCookie = (res) => {
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });
};

class AuthController {
  /**
   * @route   POST /api/v1/auth/register
   * @desc    Register new user
   * @access  Public
   */
  register = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    const user = await authService.register({
      firstName,
      lastName,
      email,
      password,
    });

    // Generate tokens for auto-login after registration
    const { tokens } = await authService.login(email, password, getRequestMeta(req));

    // Set refresh token in httpOnly cookie
    setRefreshTokenCookie(res, tokens.refreshToken);

    return ApiResponse.success(
      res,
      201,
      'Account created successfully! Welcome to RAG Quiz.',
      {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        },
        tokens: {
          accessToken: tokens.accessToken,
          tokenType: 'Bearer',
          expiresIn: config.JWT.ACCESS_EXPIRES,
        },
      }
    );
  });

  /**
   * @route   POST /api/v1/auth/login
   * @desc    Login user
   * @access  Public
   */
  login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const meta = getRequestMeta(req);

    const { user, tokens } = await authService.login(email, password, meta);

    // Set refresh token in httpOnly cookie
    setRefreshTokenCookie(res, tokens.refreshToken);

    return ApiResponse.success(res, 200, 'Login successful!', {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        currentDifficulty: user.currentDifficulty,
        level: user.level,
        totalXP: user.totalXP,
      },
      tokens: {
        accessToken: tokens.accessToken,
        tokenType: 'Bearer',
        expiresIn: config.JWT.ACCESS_EXPIRES,
      },
    });
  });

  /**
   * @route   POST /api/v1/auth/logout
   * @desc    Logout user (revoke refresh token)
   * @access  Private
   */
  logout = asyncHandler(async (req, res) => {
    // Get refresh token from cookie or body
    const refreshToken =
      req.cookies?.refreshToken || req.body?.refreshToken;

    await authService.logout(refreshToken, req.user._id);

    // Clear cookie
    clearRefreshTokenCookie(res);

    return ApiResponse.success(res, 200, 'Logged out successfully.');
  });

  /**
   * @route   POST /api/v1/auth/logout-all
   * @desc    Logout from all devices
   * @access  Private
   */
  logoutAll = asyncHandler(async (req, res) => {
    await authService.logoutAll(req.user._id);
    clearRefreshTokenCookie(res);

    return ApiResponse.success(
      res,
      200,
      'Logged out from all devices successfully.'
    );
  });

  /**
   * @route   POST /api/v1/auth/refresh-token
   * @desc    Get new access token using refresh token
   * @access  Public
   */
  refreshToken = asyncHandler(async (req, res) => {
    // Get refresh token from cookie (preferred) or body
    const refreshToken =
      req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      return ApiResponse.error(
        res,
        401,
        'Refresh token not provided.',
        [],
        'NO_REFRESH_TOKEN'
      );
    }

    const meta = getRequestMeta(req);
    const { user, tokens } = await authService.refreshToken(
      refreshToken,
      meta
    );

    // Set new refresh token cookie
    setRefreshTokenCookie(res, tokens.refreshToken);

    return ApiResponse.success(res, 200, 'Token refreshed successfully.', {
      tokens: {
        accessToken: tokens.accessToken,
        tokenType: 'Bearer',
        expiresIn: config.JWT.ACCESS_EXPIRES,
      },
    });
  });

  /**
   * @route   POST /api/v1/auth/forgot-password
   * @desc    Send password reset email
   * @access  Public
   */
  forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    await authService.forgotPassword(email);

    // Always return success (don't reveal if email exists)
    return ApiResponse.success(
      res,
      200,
      'If an account with that email exists, a password reset link has been sent.'
    );
  });

  /**
   * @route   POST /api/v1/auth/reset-password/:token
   * @desc    Reset password with token
   * @access  Public
   */
  resetPassword = asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    await authService.resetPassword(token, password);

    return ApiResponse.success(
      res,
      200,
      'Password reset successfully. Please login with your new password.'
    );
  });

  /**
   * @route   POST /api/v1/auth/change-password
   * @desc    Change password (authenticated)
   * @access  Private
   */
  changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    await authService.changePassword(
      req.user._id,
      currentPassword,
      newPassword
    );

    // Clear refresh token (force re-login)
    clearRefreshTokenCookie(res);

    return ApiResponse.success(
      res,
      200,
      'Password changed successfully. Please login again.'
    );
  });

  /**
   * @route   GET /api/v1/auth/me
   * @desc    Get current user profile
   * @access  Private
   */
  getMe = asyncHandler(async (req, res) => {
    const user = await authService.getMe(req.user._id);

    return ApiResponse.success(res, 200, 'Profile retrieved successfully.', {
      user,
    });
  });
}

module.exports = new AuthController();