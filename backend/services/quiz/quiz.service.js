'use strict';

const Quiz = require('../../models/Quiz.model');
const PDF = require('../../models/PDF.model');
const QuizAttempt = require('../../models/QuizAttempt.model');
const ragService = require('../rag/rag.service');
const questionGeneratorService = require('./questionGenerator.service');
const adaptiveService = require('../adaptive/adaptive.service');
const { DIFFICULTY_TIMERS } = require('../../constants/difficulty');
const { QUIZ_STATUS, ATTEMPT_STATUS } = require('../../constants/quiz');
const { evaluateAnswers } = require('../../helpers/score.helper');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const aiService = require('../ai/ai.service');
const {
  getPaginationParams,
  buildPaginationMeta,
} = require('../../helpers/pagination.helper');

/**
 * @service QuizService
 * @description Manages quiz generation, retrieval, and attempt handling.
 *
 * Complete quiz lifecycle:
 * Generate → Start → Answer → Submit → Evaluate → Save Result
 */

class QuizService {
  /**
   * @method generateQuiz
   * @description Generate adaptive quiz from PDF using RAG pipeline.
   * @param {string} pdfId - Source PDF ID
   * @param {string} userId - Requesting user ID
   * @param {object} options - Generation options
   * @returns {object} Generated quiz
   */
  async generateQuiz(pdfId, userId, options = {}) {
    // Step 1: Get PDF and validate
    const pdf = await PDF.findOne({ _id: pdfId, userId });

    if (!pdf) {
      throw new AppError('PDF not found.', 404, 'PDF_NOT_FOUND');
    }

    if (!pdf.isReady) {
      throw new AppError(
        `PDF is not ready for quiz generation. Current status: ${pdf.status}`,
        400,
        'PDF_NOT_READY'
      );
    }

    // Step 2: Get adaptive difficulty for user
    const difficulty = options.difficulty ||
      await adaptiveService.getRecommendedDifficulty(userId);

    logger.info(
      `[QuizGen] Starting for PDF: ${pdfId} | Difficulty: ${difficulty} | User: ${userId}`
    );

    // Step 3: Retrieve context via RAG
    logger.info('[QuizGen] Retrieving context via RAG...');
    const { context, chunkIndices } = await ragService.retrieveContextForGeneration(
      pdf,
      difficulty
    );

    if (!context || context.length < 200) {
      throw new AppError(
        'Could not retrieve sufficient context from PDF for question generation.',
        400,
        'INSUFFICIENT_CONTEXT'
      );
    }

    // Step 4: Generate questions
    const questionCount = options.questionCount || 10;
    logger.info(`[QuizGen] Generating ${questionCount} questions...`);

    const questions = await questionGeneratorService.generateQuestions(
      context,
      difficulty,
      questionCount
    );

    // Step 5: Calculate time limit
    const timeLimit = DIFFICULTY_TIMERS[difficulty];

    // Step 6: Generate quiz title
    const title = await this._generateQuizTitle(pdf.originalName, difficulty);

    // Step 7: Save quiz to database
    const quiz = await Quiz.create({
      userId,
      pdfId,
      title,
      questions,
      totalQuestions: questions.length,
      mcqCount: questions.filter((q) => q.type === 'mcq').length,
      trueFalseCount: questions.filter((q) => q.type === 'true_false').length,
      difficulty,
      timeLimit,
      status: QUIZ_STATUS.READY,
      retrievedChunks: chunkIndices,
      generationModel: aiService.getModelName(),
    });

    logger.info(
      `✅ Quiz generated: ${quiz._id} | ${questions.length} questions | ${difficulty}`
    );

    return quiz;
  }

  /**
   * @method startQuiz
   * @description Start a quiz attempt session.
   * @param {string} quizId - Quiz ID
   * @param {string} userId - User ID
   * @returns {object} Quiz attempt with questions (no correct answers)
   */
  async startQuiz(quizId, userId) {
    const quiz = await Quiz.findOne({ _id: quizId, userId });

    if (!quiz) {
      throw new AppError('Quiz not found.', 404, 'QUIZ_NOT_FOUND');
    }

    if (quiz.status !== QUIZ_STATUS.READY) {
      throw new AppError(
        'Quiz is not ready to be taken.',
        400,
        'QUIZ_NOT_READY'
      );
    }

    // Check for existing ongoing attempt
    const existingAttempt = await QuizAttempt.findOne({
      quizId,
      userId,
      status: ATTEMPT_STATUS.ONGOING,
    });

    if (existingAttempt) {
      // Return existing attempt
      return {
        attempt: existingAttempt,
        questions: quiz.getQuestionsForClient(),
        timeLimit: quiz.timeLimit,
        difficulty: quiz.difficulty,
        totalQuestions: quiz.totalQuestions,
      };
    }

    // Create new attempt
    const attempt = await QuizAttempt.create({
      userId,
      quizId,
      pdfId: quiz.pdfId,
      totalQuestions: quiz.totalQuestions,
      timeLimit: quiz.timeLimit * 60, // Convert to seconds
      difficulty: quiz.difficulty,
      status: ATTEMPT_STATUS.ONGOING,
      startedAt: new Date(),
    });

    return {
      attempt: {
        id: attempt._id,
        startedAt: attempt.startedAt,
        timeLimit: quiz.timeLimit,
      },
      questions: quiz.getQuestionsForClient(),
      difficulty: quiz.difficulty,
      totalQuestions: quiz.totalQuestions,
    };
  }

  /**
   * @method submitQuiz
   * @description Submit quiz answers and evaluate.
   * @param {string} attemptId - Quiz attempt ID
   * @param {string} userId - User ID
   * @param {Array} answers - User's answers
   * @param {number} timeTaken - Time taken in seconds
   * @returns {object} Evaluation result
   */
  async submitQuiz(attemptId, userId, answers, timeTaken) {
    // Get attempt
    const attempt = await QuizAttempt.findOne({
      _id: attemptId,
      userId,
      status: ATTEMPT_STATUS.ONGOING,
    });

    if (!attempt) {
      throw new AppError(
        'Quiz attempt not found or already submitted.',
        404,
        'ATTEMPT_NOT_FOUND'
      );
    }

    // Get quiz with correct answers
    const quiz = await Quiz.findById(attempt.quizId);

    if (!quiz) {
      throw new AppError('Quiz not found.', 404, 'QUIZ_NOT_FOUND');
    }

    // Check time limit (auto-submit if exceeded)
    const maxTime = quiz.timeLimit * 60;
    const actualTime = Math.min(timeTaken || maxTime, maxTime);
    const isAutoSubmit = timeTaken > maxTime;

    // Evaluate answers
    const evaluation = evaluateAnswers(answers, quiz.questions);

    // Update attempt
    await QuizAttempt.findByIdAndUpdate(attemptId, {
      answers: evaluation.details.map((d) => ({
        questionId: d.questionId,
        answer: d.userAnswer,
        isCorrect: d.isCorrect,
        timeTaken: 0,
      })),
      score: evaluation.correct,
      percentage: evaluation.percentage,
      correctCount: evaluation.correct,
      wrongCount: evaluation.wrong,
      skippedCount: evaluation.skipped,
      timeTaken: actualTime,
      status: ATTEMPT_STATUS.COMPLETED,
      isAutoSubmitted: isAutoSubmit,
      completedAt: new Date(),
      weakTopics: evaluation.weakTopics,
    });

    logger.info(
      `Quiz submitted: ${attemptId} | Score: ${evaluation.percentage}% | ` +
      `Correct: ${evaluation.correct}/${evaluation.total}`
    );

    return {
      attemptId,
      ...evaluation,
      timeTaken: actualTime,
      isAutoSubmitted: isAutoSubmit,
      difficulty: quiz.difficulty,
    };
  }

  /**
   * @method getQuizForReview
   * @description Get completed quiz with answers for review.
   */
  async getQuizForReview(attemptId, userId) {
    const attempt = await QuizAttempt.findOne({
      _id: attemptId,
      userId,
      status: ATTEMPT_STATUS.COMPLETED,
    }).populate('quizId');

    if (!attempt) {
      throw new AppError(
        'Completed quiz attempt not found.',
        404,
        'ATTEMPT_NOT_FOUND'
      );
    }

    const quiz = attempt.quizId;

    // Build review with correct answers
    const review = quiz.questions.map((question) => {
      const userAnswer = attempt.answers.find(
        (a) => a.questionId.toString() === question._id.toString()
      );

      return {
        questionId: question._id,
        questionText: question.questionText,
        type: question.type,
        options: question.options,
        correctAnswer: question.correctAnswer,
        userAnswer: userAnswer?.answer || null,
        isCorrect: userAnswer?.isCorrect || false,
        explanation: question.explanation,
        topic: question.topic,
        difficulty: question.difficulty,
      };
    });

    return {
      attemptId,
      quizTitle: quiz.title,
      difficulty: quiz.difficulty,
      score: attempt.score,
      percentage: attempt.percentage,
      correctCount: attempt.correctCount,
      wrongCount: attempt.wrongCount,
      skippedCount: attempt.skippedCount,
      timeTaken: attempt.timeTaken,
      completedAt: attempt.completedAt,
      review,
    };
  }

  /**
   * @method getUserQuizzes
   * @description Get all quizzes for a user.
   */
  async getUserQuizzes(userId, query = {}) {
    const { page, limit, skip } = getPaginationParams(query);

    const filter = { userId };
    if (query.difficulty) filter.difficulty = query.difficulty;
    if (query.pdfId) filter.pdfId = query.pdfId;

    const [quizzes, total] = await Promise.all([
      Quiz.find(filter)
        .select('-questions')
        .populate('pdfId', 'originalName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Quiz.countDocuments(filter),
    ]);

    return {
      quizzes,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  /**
   * @method getQuizHistory
   * @description Get quiz attempt history for a user.
   */
  async getQuizHistory(userId, query = {}) {
    const { page, limit, skip } = getPaginationParams(query);

    const [attempts, total] = await Promise.all([
      QuizAttempt.find({
        userId,
        status: ATTEMPT_STATUS.COMPLETED,
      })
        .populate('quizId', 'title difficulty totalQuestions')
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-answers'),
      QuizAttempt.countDocuments({
        userId,
        status: ATTEMPT_STATUS.COMPLETED,
      }),
    ]);

    return {
      attempts,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  /**
   * @private _generateQuizTitle
   * @description Generate descriptive title for quiz.
   */
  async _generateQuizTitle(pdfName, difficulty) {
    // Remove extension and clean filename
    const baseName = pdfName
      .replace(/\.pdf$/i, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());

    const difficultyLabel = {
      easy: 'Foundation',
      medium: 'Intermediate',
      hard: 'Advanced',
    }[difficulty] || 'General';

    return `${baseName} - ${difficultyLabel} Quiz`;
  }
}

module.exports = new QuizService();