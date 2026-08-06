'use strict';

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const multer = require('multer');

const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const User = require('../models/User.model');
const AppError = require('../utils/AppError');
const userController = require('../controllers/user.controller');

// ─── Multer Configuration for Profile Photo Upload ───────────────────────────────
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

/**
 * @router UserRoutes
 * @baseURL /api/v1/users
 */

// All routes require authentication
router.use(protect);

// ─── Get User Profile ───────────────────────────────────────────────────────────
router.get(
  '/profile',
  asyncHandler(userController.getProfile)
);

// ─── Update User Profile ───────────────────────────────────────────────────────────
router.put(
  '/profile',
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
  asyncHandler(userController.updateProfile)
);

// ─── Change Password ───────────────────────────────────────────────────────────
router.post(
  '/change-password',
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and number'),
  ],
  validate,
  asyncHandler(userController.changePassword)
);

// ─── Get Activity Log ───────────────────────────────────────────────────────────
router.get(
  '/activity',
  asyncHandler(userController.getActivityLog)
);

// ─── Upload Profile Photo ───────────────────────────────────────────────────────────
router.post(
  '/me/avatar',
  upload.single('avatar'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    // Convert image to base64 for storage
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { avatar: base64Image } },
      { new: true, runValidators: true }
    );

    return ApiResponse.success(res, 200, 'Profile photo updated successfully.', {
      user,
      avatar: user.avatar,
    });
  })
);

// ─── Remove Profile Photo ───────────────────────────────────────────────────────────
router.delete(
  '/me/avatar',
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { avatar: null } },
      { new: true, runValidators: true }
    );

    return ApiResponse.success(res, 200, 'Profile photo removed successfully.', {
      user,
    });
  })
);

// ─── Update Profile (Legacy - for backward compatibility) ───────────────────────────
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