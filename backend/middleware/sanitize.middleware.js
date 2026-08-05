'use strict';

const xss = require('xss');

/**
 * @module sanitizeMiddleware
 * @description Input sanitization middleware.
 * Prevents XSS attacks by sanitizing request body, params, and query.
 */

/**
 * @function sanitizeObject
 * @description Recursively sanitizes object values.
 * @param {object} obj - Object to sanitize
 * @returns {object} Sanitized object
 */
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = Array.isArray(obj) ? [] : {};

  for (const key of Object.keys(obj)) {
    const value = obj[key];

    if (typeof value === 'string') {
      sanitized[key] = xss(value.trim());
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

/**
 * @function sanitizeInput
 * @description Express middleware that sanitizes req.body, req.params, req.query.
 */
const sanitizeInput = (req, res, next) => {
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.params) req.params = sanitizeObject(req.params);
  if (req.query) req.query = sanitizeObject(req.query);
  next();
};

module.exports = { sanitizeInput };