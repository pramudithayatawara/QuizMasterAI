'use strict';

const { validationResult } = require('express-validator');
const ApiResponse = require('../utils/ApiResponse');

/**
 * @module validateMiddleware
 * @description Processes express-validator results.
 * Returns 422 with detailed error list if validation fails.
 */

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorList = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
      value: err.value,
    }));

    return ApiResponse.error(
      res,
      422,
      'Validation failed. Please check your input.',
      errorList,
      'VALIDATION_ERROR'
    );
  }

  next();
};

module.exports = { validate };