'use strict';

const ApiResponse = require('../utils/ApiResponse');

/**
 * @module responseHelper
 * @description Common response shortcuts used in controllers.
 */

const responseHelper = {
  sendSuccess: (res, data, message = 'Success', statusCode = 200) =>
    ApiResponse.success(res, statusCode, message, data),

  sendCreated: (res, data, message = 'Created successfully') =>
    ApiResponse.success(res, 201, message, data),

  sendNoContent: (res) => res.status(204).send(),

  sendError: (res, message, statusCode = 500) =>
    ApiResponse.error(res, statusCode, message),

  sendNotFound: (res, resource = 'Resource') =>
    ApiResponse.error(res, 404, `${resource} not found`),

  sendUnauthorized: (res, message = 'Unauthorized access') =>
    ApiResponse.error(res, 401, message),

  sendForbidden: (res, message = 'Forbidden') =>
    ApiResponse.error(res, 403, message),

  sendBadRequest: (res, message = 'Bad request') =>
    ApiResponse.error(res, 400, message),
};

module.exports = responseHelper;