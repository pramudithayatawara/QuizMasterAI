'use strict';

const { authLimiter, uploadLimiter, passwordResetLimiter } = require('../config/rateLimiter');

/**
 * @module rateLimiterMiddleware
 * @description Re-exports rate limiter configurations as named middleware.
 */

module.exports = {
  authRateLimit: authLimiter,
  uploadRateLimit: uploadLimiter,
  passwordResetRateLimit: passwordResetLimiter,
};