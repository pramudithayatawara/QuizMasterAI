'use strict';

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const User = require('../models/User.model');
const AppError = require('../utils/AppError');

/**
 * @router UserRoutes
 * @baseURL /api/v1/users
 */

// All routes require authentication
router.use(protect);

// ─── Update Profile ───────────────────────────────────────────────────────────
router.put(
  '/me',
  [
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('First name must be 2-50 characters'),
    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Last name must be 2-50 characters'),
    body('bio')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Bio cannot exceed 200 characters'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const allowedFields = ['firstName', 'lastName', 'bio', 'avatar'];
    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    return ApiResponse.success(res, 200, 'Profile updated successfully.', {
      user,
    });
  })
);

// ─── Delete Account ───────────────────────────────────────────────────────────
router.delete(
  '/me',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    await user.softDelete();

    return ApiResponse.success(
      res,
      200,
      'Account deleted successfully.'
    );
  })
);

// ─── Admin: Get All Users ─────────────────────────────────────────────────────
router.get(
  '/',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find()
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(),
    ]);

    return ApiResponse.paginated(
      res,
      200,
      'Users retrieved successfully.',
      users,
      { page, limit, total, totalPages: Math.ceil(total / limit) }
    );
  })
);

module.exports = router;