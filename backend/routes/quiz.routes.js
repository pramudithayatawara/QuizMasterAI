'use strict';

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');

const quizController = require('../controllers/quiz.controller');
const { validate } = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware');

/**
 * @router QuizRoutes
 * @baseURL /api/v1/quizzes
 */

router.use(protect);

// Generate quiz from PDF
router.post(
  '/generate',
  [
    body('pdfId')
      .notEmpty().withMessage('PDF ID is required')
      .isMongoId().withMessage('Invalid PDF ID'),
    body('questionCount')
      .optional()
      .isInt({ min: 10, max: 20 })
      .withMessage('Question count must be between 10 and 20'),
    body('difficulty')
      .optional()
      .isIn(['easy', 'medium', 'hard'])
      .withMessage('Invalid difficulty level'),
  ],
  validate,
  quizController.generate
);

// Get all quizzes for a specific PDF
router.get(
  '/pdf/:pdfId',
  [
    param('pdfId')
      .isMongoId().withMessage('Invalid PDF ID'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
  ],
  validate,
  quizController.getQuizzesByPdf
);

// Get specific quiz with questions and context references
router.get(
  '/:id',
  [
    param('id')
      .isMongoId().withMessage('Invalid quiz ID'),
  ],
  validate,
  quizController.getQuizById
);

// Get all user quizzes (existing route)
router.get('/', quizController.getAll);

// Get quiz history (existing route)
router.get('/history', quizController.getHistory);

// Get all user quizzes
router.get('/', quizController.getAll);

// Get quiz history
router.get('/history', quizController.getHistory);

// Start quiz
router.post(
  '/:id/start',
  [param('id').isMongoId().withMessage('Invalid quiz ID')],
  validate,
  quizController.start
);

// Submit quiz
router.post(
  '/attempt/:attemptId/submit',
  [
    param('attemptId').isMongoId().withMessage('Invalid attempt ID'),
    body('answers').isArray().withMessage('Answers must be an array'),
    body('timeTaken').optional().isInt({ min: 0 }),
  ],
  validate,
  quizController.submit
);

// Review quiz
router.get(
  '/attempt/:attemptId/review',
  [param('attemptId').isMongoId().withMessage('Invalid attempt ID')],
  validate,
  quizController.review
);

module.exports = router;