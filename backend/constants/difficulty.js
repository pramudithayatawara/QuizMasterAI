'use strict';

/**
 * @module difficulty
 * @description Quiz difficulty level constants.
 */

const DIFFICULTY = Object.freeze({
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
});

// Timer limits in minutes per difficulty
const DIFFICULTY_TIMERS = Object.freeze({
  easy: 15,
  medium: 20,
  hard: 25,
});

// Score thresholds for adaptive engine
const SCORE_THRESHOLDS = Object.freeze({
  HIGH: 80,  // >= 80% considered high score
  LOW: 50,   // <= 50% considered low score
});

// Difficulty progression
const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

module.exports = {
  DIFFICULTY,
  DIFFICULTY_TIMERS,
  SCORE_THRESHOLDS,
  DIFFICULTY_ORDER,
};