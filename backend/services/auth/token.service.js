'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../../config/env');
const RefreshToken = require('../../models/RefreshToken.model');
const { hashToken } = require('../../helpers/encryption.helper');
const AppError = require('../../utils/AppError');

/**
 * @service TokenService
 * @description Manages JWT access tokens and refresh tokens.
 * Handles token generation, verification, rotation, and revocation.
 */

class TokenService {
  /**
   * @method generateAccessToken
   * @description Generate short-lived JWT access token.
   * @param {object} payload - { id, role }
   * @returns {string} JWT access token
   */
  generateAccessToken(payload) {
    return jwt.sign(
      {
        id: payload.id,
        role: payload.role,
        type: 'access',
      },
      config.JWT.ACCESS_SECRET,
      {
        expiresIn: config.JWT.ACCESS_EXPIRES,
        issuer: 'rag-quiz-system',
        audience: 'rag-quiz-client',
      }
    );
  }

  /**
   * @method generateRefreshToken
   * @description Generate long-lived refresh token and store hashed version.
   * @param {string} userId - User ID
   * @param {object} meta - { userAgent, ipAddress }
   * @returns {string} Plain refresh token (to send to client)
   */
  async generateRefreshToken(userId, meta = {}) {
    // Generate cryptographically secure random token
    const plainToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = hashToken(plainToken);

    // Calculate expiry
    const expiresAt = new Date(
      Date.now() + this._parseExpiry(config.JWT.REFRESH_EXPIRES)
    );

    // Remove old refresh tokens for this user (optional: keep for multi-device)
    // await RefreshToken.revokeAllForUser(userId);

    // Store hashed token
    await RefreshToken.create({
      userId,
      tokenHash,
      expiresAt,
      userAgent: meta.userAgent || null,
      ipAddress: meta.ipAddress || null,
    });

    return plainToken;
  }

  /**
   * @method verifyRefreshToken
   * @description Verify refresh token and return associated userId.
   * @param {string} plainToken - Plain refresh token from client
   * @returns {object} RefreshToken document
   */
  async verifyRefreshToken(plainToken) {
    if (!plainToken) {
      throw new AppError('Refresh token is required', 401, 'NO_REFRESH_TOKEN');
    }

    const tokenHash = hashToken(plainToken);

    const tokenDoc = await RefreshToken.findOne({
      tokenHash,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    }).populate('userId');

    if (!tokenDoc) {
      throw new AppError(
        'Invalid or expired refresh token. Please login again.',
        401,
        'INVALID_REFRESH_TOKEN'
      );
    }

    return tokenDoc;
  }

  /**
   * @method rotateRefreshToken
   * @description Rotate refresh token (revoke old, generate new).
   * Implements refresh token rotation for security.
   * @param {string} oldToken - Old plain refresh token
   * @param {string} userId - User ID
   * @param {object} meta - Request metadata
   * @returns {string} New plain refresh token
   */
  async rotateRefreshToken(oldToken, userId, meta = {}) {
    // Revoke old token
    const tokenHash = hashToken(oldToken);
    await RefreshToken.updateOne(
      { tokenHash },
      { $set: { isRevoked: true } }
    );

    // Generate new token
    return this.generateRefreshToken(userId, meta);
  }

  /**
   * @method revokeRefreshToken
   * @description Revoke a specific refresh token (logout).
   * @param {string} plainToken
   */
  async revokeRefreshToken(plainToken) {
    const tokenHash = hashToken(plainToken);
    await RefreshToken.updateOne(
      { tokenHash },
      { $set: { isRevoked: true } }
    );
  }

  /**
   * @method revokeAllUserTokens
   * @description Revoke all refresh tokens for a user (logout all devices).
   * @param {string} userId
   */
  async revokeAllUserTokens(userId) {
    await RefreshToken.revokeAllForUser(userId);
  }

  /**
   * @method generateTokenPair
   * @description Generate both access and refresh tokens.
   * @param {object} user - User document
   * @param {object} meta - Request metadata
   * @returns {object} { accessToken, refreshToken }
   */
  async generateTokenPair(user, meta = {}) {
    const accessToken = this.generateAccessToken({
      id: user._id,
      role: user.role,
    });

    const refreshToken = await this.generateRefreshToken(
      user._id,
      meta
    );

    return { accessToken, refreshToken };
  }

  /**
   * @method verifyAccessToken
   * @description Verify JWT access token.
   * @param {string} token
   * @returns {object} Decoded payload
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, config.JWT.ACCESS_SECRET, {
        issuer: 'rag-quiz-system',
        audience: 'rag-quiz-client',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * @method generatePasswordResetToken
   * @description Generate secure password reset token.
   * @returns {object} { plainToken, tokenHash, expiresAt }
   */
  generatePasswordResetToken() {
    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(plainToken);
    const expiresAt = new Date(Date.now() + config.PASSWORD_RESET_EXPIRES);

    return { plainToken, tokenHash, expiresAt };
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * @private _parseExpiry
   * @description Parse JWT expiry string to milliseconds.
   */
  _parseExpiry(expiry) {
    const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 3600000; // Default 7 days
    return parseInt(match[1]) * units[match[2]];
  }
}

module.exports = new TokenService();