'use strict';

const aiService = require('../ai/ai.service');
const difficultyService = require('../ai/difficulty.service');
const { buildQuestionGenerationPrompt } = require('../../prompts/questionGeneration.prompt');
const { QUIZ_CONSTANTS, QUESTION_TYPES } = require('../../constants/quiz');
const { DIFFICULTY } = require('../../constants/difficulty');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

/**
 * @service QuestionGeneratorService
 * @description Generates quiz questions from PDF context using AI.
 *
 * Generation Rules:
 * - Minimum 10 questions per quiz
 * - 60% MCQ (Multiple Choice)
 * - 40% True/False
 * - 4 options per MCQ
 * - 1 correct answer per question
 * - No duplicate questions
 * - Each question classified by difficulty
 */

class QuestionGeneratorService {
  constructor() {
    this.MIN_QUESTIONS = QUIZ_CONSTANTS.MIN_QUESTIONS;
    this.MAX_QUESTIONS = QUIZ_CONSTANTS.MAX_QUESTIONS;
    this.MCQ_RATIO = QUIZ_CONSTANTS.MCQ_RATIO;
    this.MAX_RETRY_ATTEMPTS = 3;
    this.SIMILARITY_THRESHOLD = QUIZ_CONSTANTS.MAX_SIMILARITY;
  }

  /**
   * @method generateQuestions
   * @description Main entry point for question generation.
   * @param {string} context - Retrieved PDF context
   * @param {string} difficulty - Target difficulty level
   * @param {number} count - Number of questions to generate
   * @param {Array} existingQuestions - Existing questions to avoid duplicates
   * @returns {Array} Generated and classified questions
   */
  async generateQuestions(
    context,
    difficulty = DIFFICULTY.MEDIUM,
    count = this.MIN_QUESTIONS,
    existingQuestions = []
  ) {
    // Validate inputs
    if (!context || context.trim().length < 100) {
      throw new AppError(
        'Insufficient context for question generation.',
        400,
        'INSUFFICIENT_CONTEXT'
      );
    }

    const totalCount = Math.max(count, this.MIN_QUESTIONS);
    const mcqCount = Math.ceil(totalCount * this.MCQ_RATIO);      // 60%
    const tfCount = totalCount - mcqCount;                         // 40%

    logger.info(
      `Generating ${totalCount} questions: ${mcqCount} MCQ, ${tfCount} T/F | Difficulty: ${difficulty}`
    );

    let questions = [];
    let attempts = 0;

    // Retry loop for generation
    while (questions.length < totalCount && attempts < this.MAX_RETRY_ATTEMPTS) {
      attempts++;

      try {
        const needed = totalCount - questions.length;
        const neededMCQ = Math.ceil(needed * this.MCQ_RATIO);
        const neededTF = needed - neededMCQ;

        logger.info(
          `[Attempt ${attempts}] Generating ${needed} more questions...`
        );

        const prompt = buildQuestionGenerationPrompt(
          context,
          neededMCQ,
          neededTF,
          difficulty
        );

        // Generate questions from AI
        const aiResponse = await aiService.generateJSON(prompt, {
          temperature: 0.7 + (attempts - 1) * 0.1, // Increase temp on retry
          maxTokens: 4096,
        });

        const rawQuestions = aiResponse.questions || [];

        if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
          logger.warn(`[Attempt ${attempts}] AI returned no questions`);
          continue;
        }

        // Process and validate each question
        const processed = await this._processQuestions(
          rawQuestions,
          difficulty,
          questions.concat(existingQuestions)
        );

        questions = questions.concat(processed);

        logger.info(
          `[Attempt ${attempts}] Total questions so far: ${questions.length}`
        );
      } catch (error) {
        logger.error(
          `[Attempt ${attempts}] Generation error: ${error.message}`
        );

        if (attempts === this.MAX_RETRY_ATTEMPTS) {
          if (questions.length >= this.MIN_QUESTIONS) {
            logger.warn('Max retries reached, using partial results');
            break;
          }
          throw new AppError(
            'Failed to generate sufficient questions. Please try again.',
            500,
            'GENERATION_FAILED'
          );
        }
      }
    }

    // Final validation
    if (questions.length < this.MIN_QUESTIONS) {
      throw new AppError(
        `Could not generate minimum ${this.MIN_QUESTIONS} questions. ` +
        `Generated: ${questions.length}. Please upload more content.`,
        400,
        'INSUFFICIENT_QUESTIONS'
      );
    }

    // Limit to requested count
    const finalQuestions = questions.slice(0, totalCount);

    // Add order numbers
    return finalQuestions.map((q, index) => ({
      ...q,
      order: index + 1,
    }));
  }

  /**
   * @private _processQuestions
   * @description Validate, classify and deduplicate questions.
   */
  async _processQuestions(rawQuestions, difficulty, existingQuestions) {
    const processed = [];

    for (const raw of rawQuestions) {
      // Validate question structure
      if (!this._isValidQuestion(raw)) {
        logger.warn(`Invalid question structure skipped: ${JSON.stringify(raw).substring(0, 100)}`);
        continue;
      }

      // Check for duplicates
      if (this._isDuplicate(raw, [...existingQuestions, ...processed])) {
        logger.info(`Duplicate question skipped: ${raw.questionText?.substring(0, 50)}`);
        continue;
      }

      // Normalize question
      const normalized = this._normalizeQuestion(raw, difficulty);

      processed.push(normalized);
    }

    return processed;
  }

  /**
   * @private _isValidQuestion
   * @description Validate question has required fields.
   */
  _isValidQuestion(question) {
    if (!question) return false;
    if (!question.questionText || question.questionText.trim().length < 10) return false;
    if (!question.type) return false;
    if (!question.correctAnswer) return false;

    // Validate MCQ has options
    if (question.type === QUESTION_TYPES.MCQ) {
      const options = question.options;
      if (!options) return false;
      const optionKeys = typeof options === 'object'
        ? Object.keys(options)
        : [];
      if (optionKeys.length < 4) return false;
    }

    // Validate True/False
    if (question.type === QUESTION_TYPES.TRUE_FALSE) {
      const answer = String(question.correctAnswer).toUpperCase();
      if (!['A', 'B', 'TRUE', 'FALSE'].includes(answer)) return false;
    }

    return true;
  }

  /**
   * @private _isDuplicate
   * @description Check if question is too similar to existing questions.
   * Uses simple word overlap similarity.
   */
  _isDuplicate(newQuestion, existingQuestions) {
    if (existingQuestions.length === 0) return false;

    const newWords = this._getWords(newQuestion.questionText);

    for (const existing of existingQuestions) {
      const existingWords = this._getWords(existing.questionText);
      const similarity = this._jaccardSimilarity(newWords, existingWords);

      if (similarity >= this.SIMILARITY_THRESHOLD) {
        return true;
      }
    }

    return false;
  }

  /**
   * @private _normalizeQuestion
   * @description Normalize question structure for database storage.
   */
  _normalizeQuestion(raw, difficulty) {
    const type = raw.type === 'true_false'
      ? QUESTION_TYPES.TRUE_FALSE
      : QUESTION_TYPES.MCQ;

    // Normalize options to Map-compatible object
    let options = {};
    if (raw.options && typeof raw.options === 'object') {
      options = raw.options;
    } else if (type === QUESTION_TYPES.TRUE_FALSE) {
      options = { A: 'True', B: 'False' };
    }

    // Normalize correct answer
    let correctAnswer = String(raw.correctAnswer || 'A').toUpperCase();
    if (type === QUESTION_TYPES.TRUE_FALSE) {
      if (correctAnswer === 'TRUE') correctAnswer = 'A';
      if (correctAnswer === 'FALSE') correctAnswer = 'B';
    }

    return {
      questionText: raw.questionText.trim(),
      type,
      options,
      correctAnswer,
      explanation: raw.explanation || 'See the source material for explanation.',
      topic: raw.topic || 'General',
      difficulty: raw.difficulty || difficulty,
      bloomsLevel: raw.bloomsLevel || 'understand',
      conceptComplexity: parseInt(raw.conceptComplexity) || 5,
      reasoningRequired: parseInt(raw.reasoningRequired) || 5,
      sourceChunkIndex: raw.sourceChunkIndex || null,
    };
  }

  /**
   * @private _getWords
   * @description Get normalized word set from text.
   */
  _getWords(text) {
    if (!text) return new Set();
    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );
  }

  /**
   * @private _jaccardSimilarity
   * @description Calculate Jaccard similarity between two word sets.
   */
  _jaccardSimilarity(setA, setB) {
    if (setA.size === 0 || setB.size === 0) return 0;

    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
  }
}

module.exports = new QuestionGeneratorService();