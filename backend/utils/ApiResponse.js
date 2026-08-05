'use strict';

/**
 * @class ApiResponse
 * @description Standardized API response builder.
 * Ensures consistent response format across all endpoints.
 */
class ApiResponse {
  /**
   * Send a success response
   * @param {object} res - Express response object
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Success message
   * @param {*} data - Response payload
   * @param {object} meta - Pagination or extra metadata
   */
  static success(res, statusCode = 200, message = 'Success', data = null, meta = null) {
    const response = {
      success: true,
      status: 'success',
      message,
      timestamp: new Date().toISOString(),
    };

    if (data !== null) response.data = data;
    if (meta !== null) response.meta = meta;

    return res.status(statusCode).json(response);
  }

  /**
   * Send an error response
   * @param {object} res - Express response object
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error message
   * @param {Array}  errors - Validation errors array
   * @param {string} code - App error code
   */
  static error(res, statusCode = 500, message = 'Internal Server Error', errors = [], code = null) {
    const response = {
      success: false,
      status: `${statusCode}`.startsWith('4') ? 'fail' : 'error',
      message,
      timestamp: new Date().toISOString(),
    };

    if (errors.length > 0) response.errors = errors;
    if (code) response.code = code;

    return res.status(statusCode).json(response);
  }

  /**
   * Send paginated response
   */
  static paginated(res, statusCode = 200, message = 'Success', data = [], pagination = {}) {
    return res.status(statusCode).json({
      success: true,
      status: 'success',
      message,
      timestamp: new Date().toISOString(),
      data,
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total: pagination.total || 0,
        totalPages: pagination.totalPages || 0,
        hasNextPage: pagination.hasNextPage || false,
        hasPrevPage: pagination.hasPrevPage || false,
      },
    });
  }
}

module.exports = ApiResponse;