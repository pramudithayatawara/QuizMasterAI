'use strict';

const aiService = require('./ai.service');
const { buildDifficultyClassificationPrompt } = require('../../prompts/difficultyClassification.prompt');
const { DIFFICULTY } = require('../../constants/difficulty');
const logger = require('../../utils/logger');

/**
 * @service DifficultyService
 * @description AI-powered question difficulty classification.
 * Uses Bloom's Taxonomy framework for classification.
 *
 * Classification considers:
 * - Concept complexity (0-10)
 * - Context length
 * - Required reasoning (0-10)
 * - Bloom's Taxonomy level
 */

class DifficultyService {
  constructor() {
    // Bloom's level to difficulty mapping
    this.bloomsMapping = {
      remember: DIFFICULTY.EASY,
      understand: DIFFICULTY.EASY,
      apply: DIFFICULTY.MEDIUM,
      analyze: DIFFICULTY.MEDIUM,
      evaluate: DIFFICULTY.HARD,
      create: DIFFICULTY.HARD,
    };

    // Fallback scoring rules (if AI fails)
    this.scoringRules = {
      easy: { maxComplexity: 3, maxReasoning: 3 },
      medium: { maxComplexity: 7, maxReasoning: 7 },
      hard: { minComplexity: 7, minReasoning: 6 },
    };
  }

  /**
   * @method classifyQuestion
   * @description Classify single question difficulty using AI.
   * @param {object} question - Question object
   * @returns {object} Classification result
   */
  async classifyQuestion(question) {
    try {
      const prompt = buildDifficultyClassificationPrompt(question);
      const result = await aiService.generateJSON(prompt, {
        temperature: 0.2, // Low temperature for consistent classification
        maxTokens: 256,
      });

      return this._validateClassification(result);
    } catch (error) {
      logger.warn(
        `AI difficulty classification failed, using fallback: ${error.message}`
      );
      // Use rule-based fallback
      return this._fallbackClassification(question);
    }
  }

  /**
   * @method classifyBatch
   * @description Classify multiple questions in batch.
   * @param {Array} questions - Array of question objects
   * @returns {Array} Questions with difficulty classifications
   */
  async classifyBatch(questions) {
    const classified = [];

    for (const question of questions) {
      const classification = await this.classifyQuestion(question);

      classified.push({
        ...question,
        difficulty: classification.difficulty,
        bloomsLevel: classification.bloomsLevel,
        conceptComplexity: classification.conceptComplexity,
        reasoningRequired: classification.reasoningRequired,
      });

      // Small delay to avoid rate limiting
      await this._sleep(100);
    }

    return classified;
  }

  /**
   * @method classifyBatchWithTarget
   * @description Classify and adjust to match target difficulty distribution.
   * @param {Array} questions - Questions to classify
   * @param {string} targetDifficulty - Target overall difficulty
   * @returns {Array} Classified questions
   */
  async classifyBatchWithTarget(questions, targetDifficulty) {
    const classified = await this.classifyBatch(questions);

    // Override AI classification with target difficulty
    // but preserve relative complexity ordering
    return classified.map((q) => ({
      ...q,
      difficulty: targetDifficulty,
    }));
  }

  /**
   * @private _validateClassification
   * @description Validate and normalize AI classification output.
   */
  _validateClassification(result) {
    const validDifficulties = Object.values(DIFFICULTY);
    const validBloomsLevels = [
      'remember', 'understand', 'apply',
      'analyze', 'evaluate', 'create',
    ];

    return {
      difficulty: validDifficulties.includes(result.difficulty)
        ? result.difficulty
        : DIFFICULTY.MEDIUM,

      bloomsLevel: validBloomsLevels.includes(result.bloomsLevel)
        ? result.bloomsLevel
        : 'understand',

      conceptComplexity: Math.min(
        10,
        Math.max(0, parseInt(result.conceptComplexity) || 5)
      ),

      reasoningRequired: Math.min(
        10,
        Math.max(0, parseInt(result.reasoningRequired) || 5)
      ),

      explanation: result.explanation || 'AI classified',
    };
  }

  /**
   * @private _fallbackClassification
   * @description Rule-based difficulty classification as fallback.
   */
  _fallbackClassification(question) {
    const text = question.questionText || '';
    const wordCount = text.split(' ').length;

    // Simple heuristics
    const hasComplexWords = /analyze|evaluate|compare|contrast|synthesize|assess|critique/i.test(text);
    const hasSimpleWords = /what|who|when|where|which|define|list|name/i.test(text);

    let difficulty;
    let bloomsLevel;

    if (hasSimpleWords && wordCount < 15) {
      difficulty = DIFFICULTY.EASY;
      bloomsLevel = 'remember';
    } else if (hasComplexWords || wordCount > 25) {
      difficulty = DIFFICULTY.HARD;
      bloomsLevel = 'analyze';
    } else {
      difficulty = DIFFICULTY.MEDIUM;
      bloomsLevel = 'apply';
    }

    return {
      difficulty,
      bloomsLevel,
      conceptComplexity: difficulty === 'easy' ? 2 : difficulty === 'medium' ? 5 : 8,
      reasoningRequired: difficulty === 'easy' ? 2 : difficulty === 'medium' ? 5 : 8,
      explanation: 'Rule-based classification (AI fallback)',
    };
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = new DifficultyService();