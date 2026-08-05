'use strict';

const { body, param, query } = require('express-validator');

/**
 * @module pdfValidator
 * @description Input validation rules for PDF endpoints.
 */

const pdfValidator = {
  // ─── Get PDF by ID ─────────────────────────────────────────────────────────
  getById: [
    param('id')
      .notEmpty().withMessage('PDF ID is required')
      .isMongoId().withMessage('Invalid PDF ID format'),
  ],

  // ─── Delete PDF ────────────────────────────────────────────────────────────
  deleteById: [
    param('id')
      .notEmpty().withMessage('PDF ID is required')
      .isMongoId().withMessage('Invalid PDF ID format'),
  ],

  // ─── Generate Quiz from PDF ────────────────────────────────────────────────
  generateQuiz: [
    param('id')
      .notEmpty().withMessage('PDF ID is required')
      .isMongoId().withMessage('Invalid PDF ID format'),

    body('difficulty')
      .optional()
      .isIn(['easy', 'medium', 'hard'])
      .withMessage('Difficulty must be easy, medium, or hard'),

    body('questionCount')
      .optional()
      .isInt({ min: 10, max: 20 })
      .withMessage('Question count must be between 10 and 20'),
  ],

  // ─── List PDFs ─────────────────────────────────────────────────────────────
  list: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),

    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),

    query('status')
      .optional()
      .isIn(['uploaded', 'processing', 'ready', 'failed'])
      .withMessage('Invalid status filter'),
  ],
};

module.exports = pdfValidator;