'use strict';

const quizService = require('../services/quiz/quiz.service');
const resultService = require('../services/feedback/feedback.service');
const gamificationService = require('../services/gamification/gamification.service');
const adaptiveService = require('../services/adaptive/adaptive.service');
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
   * @desc    Generate quiz from PDF using RAG pipeline with Module 04 AI Difficulty Classification
   * @access  Private
   */
  generate = asyncHandler(async (req, res) => {
    const { pdfId, title, difficulty, questionCount, timeLimit, adaptiveMode } = req.body;

    if (!pdfId) {
      throw new AppError('PDF ID is required.', 400, 'PDF_ID_REQUIRED');
    }

    const quiz = await quizService.generateQuizFromPdf(
      pdfId,
      req.user._id,
      { 
        title, 
        difficulty: difficulty || 'medium', 
        questionCount: questionCount || 10,
        timeLimit: timeLimit,
        adaptiveMode: adaptiveMode || false
      }
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
          difficultyBreakdown: quiz.difficultyBreakdown,
          retrievedChunks: quiz.retrievedChunks,
          generationModel: quiz.generationModel,
          createdAt: quiz.createdAt,
        },
      }
    );
  });

  /**
   * @route   POST /api/v1/quizzes/:id/start
   * @desc    Start quiz attempt (supports standard and real-time adaptive)
   * @access  Private
   */
  start = asyncHandler(async (req, res) => {
    const result = await quizService.startQuiz(
      req.params.id,
      req.user._id,
      req.body || {}
    );

    return ApiResponse.success(
      res,
      200,
      'Quiz started! Good luck!',
      result
    );
  });

  /**
   * @route   POST /api/v1/quizzes/attempt/:attemptId/adaptive-step
   * @desc    Submit single question answer and calibrate next question in real time (CAT)
   * @access  Private
   */
  adaptiveStep = asyncHandler(async (req, res) => {
    const { questionId, answer, timeTaken } = req.body;
    const { attemptId } = req.params;

    if (!questionId) {
      throw new AppError('Question ID is required.', 400);
    }

    const stepResult = await quizService.processAdaptiveStep(
      attemptId,
      req.user._id,
      {
        questionId,
        answer,
        timeTaken: timeTaken || 0,
      }
    );

    return ApiResponse.success(
      res,
      200,
      stepResult.finished ? 'Adaptive quiz completed!' : 'Adaptive step evaluated.',
      stepResult
    );
  });

  /**
   * @route   POST /api/v1/quizzes/attempt/:attemptId/submit
   * @desc    Submit quiz answers with adaptive difficulty adjustment and AI feedback - Module 05 & 06
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

    // Module 05: Adaptive difficulty adjustment
    const adaptiveUpdate = await adaptiveService.updateDifficultyAfterSubmission(
      req.user._id,
      {
        scorePercentage: evaluation.percentage,
        difficulty: evaluation.difficulty
      }
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
      { 
        evaluation,
        adaptive: adaptiveUpdate,
        // Module 06: Include AI feedback and performance metrics
        aiFeedback: evaluation.aiFeedback,
        topicAccuracy: evaluation.topicAccuracy,
        performanceMetrics: evaluation.performanceMetrics,
      }
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
      { review, result: review }
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

  /**
   * @route   GET /api/v1/adaptive/recommended-difficulty
   * @desc    Get recommended difficulty based on recent performance - Module 05
   * @access  Private
   */
  getRecommendedDifficulty = asyncHandler(async (req, res) => {
    const recommendation = await adaptiveService.analyzePerformance(req.user._id);

    return ApiResponse.success(
      res,
      200,
      'Difficulty recommendation calculated.',
      recommendation
    );
  });

  /**
   * @route   GET /api/v1/adaptive/performance-stats
   * @desc    Get comprehensive user performance statistics - Module 05
   * @access  Private
   */
  getPerformanceStats = asyncHandler(async (req, res) => {
    const stats = await adaptiveService.getUserPerformanceStats(req.user._id);

    return ApiResponse.success(
      res,
      200,
      'Performance statistics retrieved.',
      stats
    );
  });
}

module.exports = new QuizController();