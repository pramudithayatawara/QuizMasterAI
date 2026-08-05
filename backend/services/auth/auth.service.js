'use strict';

const User = require('../../models/User.model');
const PasswordReset = require('../../models/PasswordReset.model');
const GamificationProfile = require('../../models/GamificationProfile.model');
const Leaderboard = require('../../models/Leaderboard.model');
const tokenService = require('./token.service');
const emailService = require('./email.service');
const { hashToken } = require('../../helpers/encryption.helper');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const config = require('../../config/env');

/**
 * @service AuthService
 * @description Core authentication business logic.
 * Handles registration, login, token management,
 * password reset, and account security.
 */

class AuthService {
  /**
   * @method register
   * @description Register new user account.
   * Creates user, gamification profile, leaderboard entry.
   * Sends welcome email.
   */
  async register(userData) {
    const { firstName, lastName, email, password } = userData;

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new AppError(
        'An account with this email already exists.',
        409,
        'EMAIL_EXISTS'
      );
    }

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      role: 'user',
    });

    // Create gamification profile
    await GamificationProfile.create({ userId: user._id });

    // Create leaderboard entry
    await Leaderboard.create({
      userId: user._id,
      userName: `${firstName} ${lastName}`,
      totalPoints: 0,
    });

    // Send welcome email (non-blocking)
    emailService.sendWelcomeEmail(user).catch((err) => {
      logger.warn(`Welcome email failed for ${email}: ${err.message}`);
    });

    logger.info(`New user registered: ${email}`);

    return user;
  }

  /**
   * @method login
   * @description Authenticate user with email and password.
   * Handles account lockout and attempt tracking.
   */
  async login(email, password, meta = {}) {
    // Get user with password field
    const user = await User.findByEmail(email);

    if (!user) {
      throw new AppError(
        'Invalid email or password.',
        401,
        'INVALID_CREDENTIALS'
      );
    }

    // Check if account is active
    if (!user.isActive) {
      throw new AppError(
        'Your account has been deactivated. Please contact support.',
        401,
        'ACCOUNT_DEACTIVATED'
      );
    }

    // Check if account is locked
    if (user.isLocked) {
      const minutesLeft = Math.ceil(
        (user.lockUntil - Date.now()) / 60000
      );
      throw new AppError(
        `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
        423,
        'ACCOUNT_LOCKED'
      );
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      // Increment failed attempts
      await user.incrementLoginAttempts();

      const attemptsLeft =
        config.SECURITY.MAX_LOGIN_ATTEMPTS - (user.loginAttempts + 1);

      if (attemptsLeft <= 0) {
        throw new AppError(
          'Too many failed attempts. Account locked for 15 minutes.',
          423,
          'ACCOUNT_LOCKED'
        );
      }

      throw new AppError(
        `Invalid email or password. ${attemptsLeft} attempt(s) remaining.`,
        401,
        'INVALID_CREDENTIALS'
      );
    }

    // Reset login attempts on success
    await user.resetLoginAttempts();

    // Generate token pair
    const tokens = await tokenService.generateTokenPair(user, meta);

    logger.info(`User logged in: ${email}`);

    return { user, tokens };
  }

  /**
   * @method refreshToken
   * @description Refresh access token using refresh token.
   * Implements token rotation for security.
   */
  async refreshToken(plainRefreshToken, meta = {}) {
    // Verify refresh token
    const tokenDoc = await tokenService.verifyRefreshToken(plainRefreshToken);

    const user = await User.findById(tokenDoc.userId);

    if (!user || !user.isActive) {
      throw new AppError(
        'User not found or account deactivated.',
        401,
        'USER_NOT_FOUND'
      );
    }

    // Rotate refresh token (revoke old, issue new)
    const newRefreshToken = await tokenService.rotateRefreshToken(
      plainRefreshToken,
      user._id,
      meta
    );

    // Generate new access token
    const accessToken = tokenService.generateAccessToken({
      id: user._id,
      role: user.role,
    });

    logger.info(`Token refreshed for user: ${user.email}`);

    return {
      user,
      tokens: { accessToken, refreshToken: newRefreshToken },
    };
  }

  /**
   * @method logout
   * @description Revoke refresh token and invalidate session.
   */
  async logout(plainRefreshToken, userId) {
    try {
      if (plainRefreshToken) {
        await tokenService.revokeRefreshToken(plainRefreshToken);
      }
      logger.info(`User logged out: ${userId}`);
    } catch (error) {
      // Logout should not fail even if token is invalid
      logger.warn(`Logout token revocation failed: ${error.message}`);
    }
  }

  /**
   * @method logoutAll
   * @description Revoke all refresh tokens (logout from all devices).
   */
  async logoutAll(userId) {
    await tokenService.revokeAllUserTokens(userId);
    logger.info(`All sessions revoked for user: ${userId}`);
  }

  /**
   * @method forgotPassword
   * @description Initiate password reset flow.
   * Generates reset token and sends email.
   */
  async forgotPassword(email) {
    const user = await User.findOne({ email: email.toLowerCase() });

    // Don't reveal if email exists or not (security)
    if (!user) {
      logger.warn(`Password reset requested for non-existent email: ${email}`);
      return; // Silent return
    }

    // Delete any existing reset tokens for this user
    await PasswordReset.deleteMany({ userId: user._id });

    // Generate reset token
    const { plainToken, tokenHash, expiresAt } =
      tokenService.generatePasswordResetToken();

    // Save hashed token
    await PasswordReset.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    // Send reset email
    await emailService.sendPasswordResetEmail(user, plainToken);

    logger.info(`Password reset email sent to: ${email}`);
  }

  /**
   * @method resetPassword
   * @description Reset password using valid reset token.
   */
  async resetPassword(plainToken, newPassword) {
    const tokenHash = hashToken(plainToken);

    // Find valid reset token
    const resetDoc = await PasswordReset.findOne({
      tokenHash,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!resetDoc) {
      throw new AppError(
        'Password reset token is invalid or has expired.',
        400,
        'INVALID_RESET_TOKEN'
      );
    }

    // Find user
    const user = await User.findById(resetDoc.userId);

    if (!user) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Mark token as used
    await resetDoc.markAsUsed();

    // Revoke all refresh tokens (security: force re-login)
    await tokenService.revokeAllUserTokens(user._id);

    // Send confirmation email
    emailService.sendPasswordChangedEmail(user).catch((err) => {
      logger.warn(`Password change email failed: ${err.message}`);
    });

    logger.info(`Password reset successful for: ${user.email}`);
  }

  /**
   * @method changePassword
   * @description Change password for authenticated user.
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');

    if (!user) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    // Verify current password
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      throw new AppError(
        'Current password is incorrect.',
        401,
        'INVALID_PASSWORD'
      );
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Revoke all other refresh tokens
    await tokenService.revokeAllUserTokens(userId);

    // Send notification
    emailService.sendPasswordChangedEmail(user).catch((err) => {
      logger.warn(`Password change email failed: ${err.message}`);
    });

    logger.info(`Password changed for user: ${user.email}`);
  }

  /**
   * @method getMe
   * @description Get current authenticated user profile.
   */
  async getMe(userId) {
    const user = await User.findById(userId)
      .select('-password -loginAttempts -lockUntil');

    if (!user) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    return user;
  }
}

module.exports = new AuthService();