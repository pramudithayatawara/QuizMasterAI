'use strict';

const AppError = require('../utils/AppError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const config = require('../config/env');

/**
 * @module errorMiddleware
 * @description Global error handling middleware.
 * Handles all error types and returns standardized responses.
 * In development: returns stack trace.
 * In production: sanitizes internal error details.
 */

// ─── Handle specific Mongoose errors ────────────────────────────────────────
const handleMongooseCastError = (err) =>
  new AppError(`Invalid ${err.path}: ${err.value}`, 400, 'INVALID_ID');

const handleMongooseDuplicateKey = (err) => {
  const field = Object.keys(err.keyValue)[0];
  return new AppError(
    `${field} already exists. Please use a different value.`,
    409,
    'DUPLICATE_FIELD'
  );
};

const handleMongooseValidationError = (err) => {
  const errors = Object.values(err.errors).map((e) => ({
    field: e.path,
    message: e.message,
  }));
  return new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors);
};

// ─── Handle JWT errors ───────────────────────────────────────────────────────
const handleJWTError = () =>
  new AppError('Invalid token. Please log in again.', 401, 'INVALID_TOKEN');

const handleJWTExpiredError = () =>
  new AppError('Your session has expired. Please log in again.', 401, 'TOKEN_EXPIRED');

// ─── Handle Multer errors ────────────────────────────────────────────────────
const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File too large. Maximum size is 10MB.', 400, 'FILE_TOO_LARGE');
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Unexpected file field.', 400, 'UNEXPECTED_FILE');
  }
  return new AppError(err.message, 400, 'UPLOAD_ERROR');
};

// ─── Send error response ─────────────────────────────────────────────────────
const sendErrorDev = (err, res) => {
  return res.status(err.statusCode).json({
    success: false,
    status: err.status,
    message: err.message,
    code: err.code,
    errors: err.errors,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });
};

const sendErrorProd = (err, res) => {
  // Operational errors: send to client
  if (err.isOperational) {
    return ApiResponse.error(res, err.statusCode, err.message, err.errors, err.code);
  }

  // Programming errors: log and send generic message
  logger.error('PROGRAMMING ERROR:', err);
  return ApiResponse.error(res, 500, 'Something went wrong. Please try again.');
};

// ─── Global error handler ────────────────────────────────────────────────────
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log all errors
  logger.error(`[${req.method}] ${req.path} - ${err.message}`, {
    statusCode: err.statusCode,
    stack: config.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Transform known error types
  let error = { ...err, message: err.message };

  if (err.name === 'CastError') error = handleMongooseCastError(err);
  if (err.code === 11000) error = handleMongooseDuplicateKey(err);
  if (err.name === 'ValidationError') error = handleMongooseValidationError(err);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
  if (err.name === 'MulterError') error = handleMulterError(err);

  if (config.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

/**
 * @function notFoundHandler
 * @description 404 handler for undefined routes.
 */
const notFoundHandler = (req, res, next) => {
  next(new AppError(`Cannot ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND'));
};

module.exports = { errorHandler, notFoundHandler };