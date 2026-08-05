'use strict';

/**
 * @module quiz
 * @description Quiz generation constants.
 */

const QUIZ_CONSTANTS = Object.freeze({
  MIN_QUESTIONS: 10,
  MAX_QUESTIONS: 20,
  MCQ_RATIO: 0.6,        // 60% MCQ
  TRUE_FALSE_RATIO: 0.4, // 40% True/False
  MCQ_OPTIONS: 4,
  CHUNK_SIZE: 512,
  CHUNK_OVERLAP: 50,
  TOP_K_RETRIEVAL: 5,
  MAX_SIMILARITY: 0.8,   // Duplicate detection threshold
});

const QUESTION_TYPES = Object.freeze({
  MCQ: 'mcq',
  TRUE_FALSE: 'true_false',
});

const QUIZ_STATUS = Object.freeze({
  DRAFT: 'draft',
  READY: 'ready',
  PROCESSING: 'processing',
  FAILED: 'failed',
});

const ATTEMPT_STATUS = Object.freeze({
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  TIMEOUT: 'timeout',
  ABANDONED: 'abandoned',
});

module.exports = {
  QUIZ_CONSTANTS,
  QUESTION_TYPES,
  QUIZ_STATUS,
  ATTEMPT_STATUS,
};