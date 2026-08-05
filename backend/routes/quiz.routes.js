'use strict';

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

const quizController = require('../controllers/quiz.controller');
const { validate } = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware');

/**
 * @router QuizRoutes
 * @baseURL /api/v1/quiz
 */

router.use(protect);

// Generate quiz from PDF
router.post(
  '/generate',
  [
    body('pdfId')
      .notEmpty().withMessage('PDF ID is required')
      .isMongoId().withMessage('Invalid PDF ID'),
    body('difficulty')
      .optional()
      .isIn(['easy', 'medium', 'hard'])
      .withMessage('Invalid difficulty'),
    body('questionCount')
      .optional()
      .isInt({ min: 10, max: 20 })
      .withMessage('Question count must be 10-20'),
  ],
  validate,
  quizController.generate
);

// Get all quizzes
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