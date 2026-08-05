'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User.model');

/**
 * @module authMiddleware
 * @description JWT authentication middleware.
 * Validates Bearer token from Authorization header.
 * Attaches user object to req.user on success.
 */

const protect = asyncHandler(async (req, res, next) => {
  // 1. Get token from header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(
      'Authentication required. Please provide a valid token.',
      401,
      'NO_TOKEN'
    );
  }

  const token = authHeader.split(' ')[1];

  // 2. Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, config.JWT.ACCESS_SECRET);
  } catch (err) {
    throw err; // Let error middleware handle JWTError and TokenExpiredError
  }

  // 3. Check if user still exists
  const user = await User.findById(decoded.id).select('-password');

  if (!user) {
    throw new AppError(
      'The user belonging to this token no longer exists.',
      401,
      'USER_NOT_FOUND'
    );
  }

  // 4. Check if user account is active
  if (!user.isActive) {
    throw new AppError(
      'Your account has been deactivated. Please contact support.',
      401,
      'ACCOUNT_DEACTIVATED'
    );
  }

  // 5. Check if account is locked
  if (user.lockUntil && user.lockUntil > Date.now()) {
    const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
    throw new AppError(
      `Account temporarily locked. Try again in ${minutesLeft} minute(s).`,
      423,
      'ACCOUNT_LOCKED'
    );
  }

  // 6. Attach user to request
  req.user = user;
  next();
});

/**
 * @function optionalAuth
 * @description Optional authentication - does not throw if no token.
 * Used for public routes that show extra data for logged-in users.
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.JWT.ACCESS_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (user && user.isActive) {
      req.user = user;
    }
  } catch {
    // Silently fail for optional auth
  }

  next();
});

module.exports = { protect, optionalAuth };