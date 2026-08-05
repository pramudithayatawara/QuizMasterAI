'use strict';

const rateLimit = require('express-rate-limit');
const config = require('./env');

/**
 * @module rateLimiter
 * @description Rate limiting configurations for different route groups.
 * Prevents brute-force attacks and API abuse.
 */

// ─── Message formatter ───────────────────────────────────────────────────────
const createLimitMessage = (limit, windowMs) => ({
  success: false,
  status: 'fail',
  message: `Too many requests. Maximum ${limit} requests per ${windowMs / 60000} minutes allowed.`,
  code: 'RATE_LIMIT_EXCEEDED',
});

// ─── Global rate limiter ─────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: config.RATE_LIMIT.WINDOW,  // 15 minutes
  max: config.RATE_LIMIT.MAX,          // 100 requests
  standardHeaders: true,
  legacyHeaders: false,
  message: createLimitMessage(config.RATE_LIMIT.MAX, config.RATE_LIMIT.WINDOW),
  skipSuccessfulRequests: false,
});

// ─── Auth rate limiter (strict) ──────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.RATE_LIMIT.AUTH_MAX,  // 5 attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: createLimitMessage(config.RATE_LIMIT.AUTH_MAX, 15 * 60 * 1000),
  skipSuccessfulRequests: true, // Don't count successful logins
});

// ─── Upload rate limiter ─────────────────────────────────────────────────────
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,                   // 10 uploads per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: createLimitMessage(10, 60 * 60 * 1000),
});

// ─── Password reset limiter ──────────────────────────────────────────────────
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,                    // 3 reset attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: createLimitMessage(3, 60 * 60 * 1000),
});

module.exports = {
  globalLimiter,
  authLimiter,
  uploadLimiter,
  passwordResetLimiter,
};