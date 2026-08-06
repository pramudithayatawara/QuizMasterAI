'use strict';

const { body, param } = require('express-validator');

/**
 * @module authValidator
 * @description Input validation rules for all auth endpoints.
 */

const authValidator = {
  // ─── Register ──────────────────────────────────────────────────────────────
  register: [
    body('firstName')
      .trim()
      .notEmpty().withMessage('First name is required')
      .isLength({ min: 2, max: 50 }).withMessage('First name must be 2-50 characters')
      .matches(/^[a-zA-Z\s]+$/).withMessage('First name can only contain letters'),

    body('lastName')
      .trim()
      .notEmpty().withMessage('Last name is required')
      .isLength({ min: 2, max: 50 }).withMessage('Last name must be 2-50 characters')
      .matches(/^[a-zA-Z\s]+$/).withMessage('Last name can only contain letters'),

    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail()
      .isLength({ max: 100 }).withMessage('Email cannot exceed 100 characters'),

    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .isLength({ max: 128 }).withMessage('Password cannot exceed 128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and number'),

    body('confirmPassword')
      .optional()
      .custom((value, { req }) => {
        if (value && value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
  ],

  // ─── Login ─────────────────────────────────────────────────────────────────
  login: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail(),

    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 1 }).withMessage('Password cannot be empty'),
  ],

  // ─── Forgot Password ───────────────────────────────────────────────────────
  forgotPassword: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail(),
  ],

  // ─── Reset Password ────────────────────────────────────────────────────────
  resetPassword: [
    param('token')
      .notEmpty().withMessage('Reset token is required')
      .isLength({ min: 64, max: 64 }).withMessage('Invalid reset token'),

    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and number'),

    body('confirmPassword')
      .notEmpty().withMessage('Confirm password is required')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
  ],

  // ─── Change Password ───────────────────────────────────────────────────────
  changePassword: [
    body('currentPassword')
      .notEmpty().withMessage('Current password is required'),

    body('newPassword')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and number')
      .custom((value, { req }) => {
        if (value === req.body.currentPassword) {
          throw new Error('New password must be different from current password');
        }
        return true;
      }),

    body('confirmPassword')
      .notEmpty().withMessage('Confirm password is required')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
  ],

  // ─── Refresh Token ─────────────────────────────────────────────────────────
  refreshToken: [
    body('refreshToken')
      .optional()
      .isString().withMessage('Invalid refresh token format'),
  ],
};

module.exports = authValidator;