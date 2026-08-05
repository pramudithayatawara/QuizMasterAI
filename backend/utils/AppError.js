'use strict';

/**
 * @class AppError
 * @description Custom operational error class for the application.
 * Extends native Error with statusCode, status, and isOperational flag.
 * Operational errors are expected errors (e.g. 404, 401)
 * Programming errors bubble up as 500.
 */
class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code
   * @param {string} [code] - Application-specific error code
   * @param {Array}  [errors] - Validation error details
   */
  constructor(message, statusCode, code = null, errors = []) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.code = code;
    this.errors = errors;
    this.timestamp = new Date().toISOString();

    // Capture stack trace (excludes constructor from trace)
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;