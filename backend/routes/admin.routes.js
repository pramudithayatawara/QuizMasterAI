'use strict';

const express = require('express');
const router = express.Router();
const { param } = require('express-validator');

const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const AppError = require('../utils/AppError');
const User = require('../models/User.model');
const PDF = require('../models/PDF.model');
const Quiz = require('../models/Quiz.model');
const QuizAttempt = require('../models/QuizAttempt.model');
const Battle = require('../models/Battle.model');
const GamificationProfile = require('../models/GamificationProfile.model');

/**
 * @router AdminRoutes
 * @baseURL /api/v1/admin
 * @access Admin only
 */

// All admin routes require auth + admin role
router.use(protect, authorize('admin'));

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const [
      totalUsers,
      totalPDFs,
      totalQuizzes,
      totalAttempts,
      totalBattles,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments(),
      PDF.countDocuments(),
      Quiz.countDocuments(),
      QuizAttempt.countDocuments({ status: 'completed' }),
      Battle.countDocuments({ status: 'finished' }),
      User.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('firstName lastName email role createdAt'),
    ]);

    // Calculate today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayUsers, todayQuizzes] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: today } }),
      QuizAttempt.countDocuments({
        createdAt: { $gte: today },
        status: 'completed',
      }),
    ]);

    return ApiResponse.success(res, 200, 'Dashboard data retrieved.', {
      stats: {
        totalUsers,
        totalPDFs,
        totalQuizzes,
        totalAttempts,
        totalBattles,
        todayUsers,
        todayQuizzes,
      },
      recentUsers,
      timestamp: new Date().toISOString(),
    });
  })
);

// ─── User Management ──────────────────────────────────────────────────────────
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const filter = search
      ? {
          $or: [
            { firstName: { $regex: search, $options: 'i' } },
            { lastName: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -loginAttempts -lockUntil')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return ApiResponse.paginated(res, 200, 'Users retrieved.', users, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  })
);

// Get single user
router.get(
  '/users/:id',
  [param('id').isMongoId()],
  validate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)
      .select('-password -loginAttempts -lockUntil');

    if (!user) throw new AppError('User not found.', 404);

    const [profile, attemptCount] = await Promise.all([
      GamificationProfile.findOne({ userId: user._id }),
      QuizAttempt.countDocuments({
        userId: user._id,
        status: 'completed',
      }),
    ]);

    return ApiResponse.success(res, 200, 'User retrieved.', {
      user,
      profile,
      totalQuizzes: attemptCount,
    });
  })
);

// Delete user (soft delete)
router.delete(
  '/users/:id',
  [param('id').isMongoId()],
  validate,
  asyncHandler(async (req, res) => {
    // Prevent admin from deleting themselves
    if (req.params.id === req.user._id.toString()) {
      throw new AppError('You cannot delete your own account.', 400);
    }

    const user = await User.findById(req.params.id);
    if (!user) throw new AppError('User not found.', 404);

    await user.softDelete();

    return ApiResponse.success(res, 200, 'User deleted successfully.');
  })
);

// Toggle user active status
router.patch(
  '/users/:id/toggle-status',
  [param('id').isMongoId()],
  validate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError('User not found.', 404);

    user.isActive = !user.isActive;
    await user.save();

    return ApiResponse.success(
      res,
      200,
      `User ${user.isActive ? 'activated' : 'deactivated'} successfully.`,
      { isActive: user.isActive }
    );
  })
);

// ─── PDF Management ───────────────────────────────────────────────────────────
router.get(
  '/pdfs',
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [pdfs, total] = await Promise.all([
      PDF.find()
        .populate('userId', 'firstName lastName email')
        .select('-extractedText -chunks')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PDF.countDocuments(),
    ]);

    return ApiResponse.paginated(res, 200, 'PDFs retrieved.', pdfs, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  })
);

router.delete(
  '/pdfs/:id',
  [param('id').isMongoId()],
  validate,
  asyncHandler(async (req, res) => {
    const pdf = await PDF.findById(req.params.id);
    if (!pdf) throw new AppError('PDF not found.', 404);

    await pdf.softDelete();

    return ApiResponse.success(res, 200, 'PDF deleted successfully.');
  })
);

// ─── Quiz Management ──────────────────────────────────────────────────────────
router.get(
  '/quizzes',
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [quizzes, total] = await Promise.all([
      Quiz.find()
        .populate('userId', 'firstName lastName email')
        .populate('pdfId', 'originalName')
        .select('-questions')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Quiz.countDocuments(),
    ]);

    return ApiResponse.paginated(res, 200, 'Quizzes retrieved.', quizzes, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  })
);

router.delete(
  '/quizzes/:id',
  [param('id').isMongoId()],
  validate,
  asyncHandler(async (req, res) => {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) throw new AppError('Quiz not found.', 404);

    await quiz.softDelete();

    return ApiResponse.success(res, 200, 'Quiz deleted successfully.');
  })
);

// ─── Battle Management ────────────────────────────────────────────────────────
router.get(
  '/battles',
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [battles, total] = await Promise.all([
      Battle.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-questions'),
      Battle.countDocuments(),
    ]);

    return ApiResponse.paginated(res, 200, 'Battles retrieved.', battles, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  })
);

module.exports = router;