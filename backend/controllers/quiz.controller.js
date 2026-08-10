'use strict';

const quizService = require('../services/quiz/quiz.service');
const resultService = require('../services/feedback/feedback.service');
const gamificationService = require('../services/gamification/gamification.service');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

/**
 * @controller QuizController
 * @description Handles quiz HTTP requests.
 */

class QuizController {
  /**
   * @route   POST /api/v1/quizzes/generate
   * @desc    Generate quiz from PDF using RAG pipeline with Gemini
   * @access  Private
   */
  generate = asyncHandler(async (req, res) => {
    const { pdfId, difficulty, questionCount } = req.body;

    if (!pdfId) {
      throw new AppError('PDF ID is required.', 400, 'PDF_ID_REQUIRED');
    }

    const quiz = await quizService.generateQuizFromPdf(
      pdfId,
      req.user._id,
      { difficulty, questionCount }
    );

    return ApiResponse.success(
      res,
      201,
      'Quiz generated successfully!',
      {
        quiz: {
          id: quiz._id,
          title: quiz.title,
          difficulty: quiz.difficulty,
          totalQuestions: quiz.totalQuestions,
          mcqCount: quiz.mcqCount,
          trueFalseCount: quiz.trueFalseCount,
          timeLimit: quiz.timeLimit,
          status: quiz.status,
          retrievedChunks: quiz.retrievedChunks,
          generationModel: quiz.generationModel,
          createdAt: quiz.createdAt,
        },
      }
    );
  });

  /**
   * @route   POST /api/v1/quizzes/:id/start
   * @desc    Start quiz attempt
   * @access  Private
   */
  start = asyncHandler(async (req, res) => {
    const result = await quizService.startQuiz(
      req.params.id,
      req.user._id
    );

    return ApiResponse.success(
      res,
      200,
      'Quiz started! Good luck!',
      result
    );
  });

  /**
   * @route   POST /api/v1/quizzes/attempt/:attemptId/submit
   * @desc    Submit quiz answers
   * @access  Private
   */
  submit = asyncHandler(async (req, res) => {
    const { answers, timeTaken } = req.body;
    const { attemptId } = req.params;

    if (!answers || !Array.isArray(answers)) {
      throw new AppError('Answers array is required.', 400);
    }

    // Submit and evaluate
    const evaluation = await quizService.submitQuiz(
      attemptId,
      req.user._id,
      answers,
      timeTaken || 0
    );

    // Award gamification XP (async)
    gamificationService
      .processQuizCompletion(req.user._id, evaluation)
      .catch((err) => {
        console.error('Gamification error:', err.message);
      });

    return ApiResponse.success(
      res,
      200,
      'Quiz submitted successfully!',
      { evaluation }
    );
  });

  /**
   * @route   GET /api/v1/quizzes/attempt/:attemptId/review
   * @desc    Get quiz review with answers
   * @access  Private
   */
  review = asyncHandler(async (req, res) => {
    const review = await quizService.getQuizForReview(
      req.params.attemptId,
      req.user._id
    );

    return ApiResponse.success(
      res,
      200,
      'Quiz review retrieved.',
      { review }
    );
  });

  /**
   * @route   GET /api/v1/quizzes
   * @desc    Get all user quizzes
   * @access  Private
   */
  getAll = asyncHandler(async (req, res) => {
    const { quizzes, pagination } = await quizService.getUserQuizzes(
      req.user._id,
      req.query
    );

    return ApiResponse.paginated(
      res,
      200,
      'Quizzes retrieved successfully.',
      quizzes,
      pagination
    );
  });

  /**
   * @route   GET /api/v1/quizzes/pdf/:pdfId
   * @desc    Get all quizzes generated from a specific PDF
   * @access  Private
   */
  getQuizzesByPdf = asyncHandler(async (req, res) => {
    const { pdfId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const { quizzes, pagination } = await quizService.getQuizzesByPdf(
      pdfId,
      req.user._id,
      { page, limit }
    );

    return ApiResponse.paginated(
      res,
      200,
      'Quizzes retrieved successfully.',
      quizzes,
      pagination
    );
  });

  /**
   * @route   GET /api/v1/quizzes/:id
   * @desc    Get specific quiz with questions and context references
   * @access  Private
   */
  getQuizById = asyncHandler(async (req, res) => {
    const quiz = await quizService.getQuizById(
      req.params.id,
      req.user._id
    );

    return ApiResponse.success(
      res,
      200,
      'Quiz retrieved successfully.',
      { quiz }
    );
  });

  /**
   * @route   GET /api/v1/quizzes/history
   * @desc    Get quiz attempt history
   * @access  Private
   */
  getHistory = asyncHandler(async (req, res) => {
    const { attempts, pagination } = await quizService.getQuizHistory(
      req.user._id,
      req.query
    );

    return ApiResponse.paginated(
      res,
      200,
      'Quiz history retrieved.',
      attempts,
      pagination
    );
  });
}

module.exports = new QuizController();