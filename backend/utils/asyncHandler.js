'use strict';

/**
 * @function asyncHandler
 * @description Wraps async route handlers to eliminate try/catch boilerplate.
 * Automatically catches rejected promises and forwards to Express error handler.
 *
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware function
 *
 * @example
 * router.get('/route', asyncHandler(async (req, res) => {
 *   const data = await someAsyncOperation();
 *   res.json(data);
 * }));
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;