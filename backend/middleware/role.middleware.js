'use strict';

const AppError = require('../utils/AppError');

/**
 * @module roleMiddleware
 * @description Role-Based Access Control (RBAC) middleware.
 * Must be used AFTER protect middleware.
 *
 * @example
 * router.delete('/admin/users/:id', protect, authorize('admin'), deleteUser);
 */

/**
 * @function authorize
 * @param {...string} roles - Allowed roles
 * @returns {Function} Express middleware
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError('Authentication required.', 401, 'NOT_AUTHENTICATED')
      );
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied. Role '${req.user.role}' is not authorized for this action.`,
          403,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
};

/**
 * @function isOwner
 * @description Verifies request user owns the resource.
 * @param {Function} getResourceUserId - Function to extract owner userId from request
 */
const isOwner = (getResourceUserId) => {
  return (req, res, next) => {
    const resourceUserId = getResourceUserId(req);
    const requestUserId = req.user?._id?.toString();

    if (
      req.user?.role === 'admin' ||
      requestUserId === resourceUserId?.toString()
    ) {
      return next();
    }

    return next(
      new AppError(
        'You do not have permission to access this resource.',
        403,
        'FORBIDDEN'
      )
    );
  };
};

module.exports = { authorize, isOwner };