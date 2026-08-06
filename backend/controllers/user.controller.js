'use strict';

const User = require('../models/User.model');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

/**
 * @controller UserController
 * @description Handles user profile operations and statistics.
 */

/**
 * @function getProfile
 * @description Get current user profile with statistics
 */
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Calculate user statistics
  const stats = {
    level: user.level || 1,
    totalXP: user.totalXP || 0,
    quizzesCompleted: user.quizzesCompleted || 0,
    battlesWon: user.battlesWon || 0,
    accuracy: user.accuracy || 0,
    streak: user.streak || 0,
  };

  return ApiResponse.success(res, 200, 'Profile retrieved successfully.', {
    user,
    stats,
  });
});

/**
 * @function updateProfile
 * @description Update user profile information
 */
const updateProfile = asyncHandler(async (req, res) => {
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
  ).select('-password');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return ApiResponse.success(res, 200, 'Profile updated successfully.', {
    user,
  });
});

/**
 * @function changePassword
 * @description Change user password
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Verify current password
  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw new AppError('Current password is incorrect', 401);
  }

  // Update password
  user.password = newPassword;
  user.passwordChangedAt = Date.now();
  await user.save();

  return ApiResponse.success(res, 200, 'Password changed successfully.');
});

/**
 * @function getActivityLog
 * @description Get user's recent activity
 */
const getActivityLog = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Return mock activity data (can be enhanced with actual activity tracking)
  const activities = [
    {
      id: 1,
      type: 'quiz',
      title: 'JavaScript Basics',
      score: 85,
      date: user.lastQuizDate || new Date(),
    },
    {
      id: 2,
      type: 'battle',
      title: 'vs Player123',
      score: 12,
      date: new Date(Date.now() - 86400000), // 1 day ago
    },
  ];

  return ApiResponse.success(res, 200, 'Activity log retrieved successfully.', {
    activities,
  });
});

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getActivityLog,
};
