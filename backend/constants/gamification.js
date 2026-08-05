'use strict';

/**
 * @module gamification
 * @description XP and level system constants.
 */

// XP rewards per action
const XP_REWARDS = Object.freeze({
  QUIZ_COMPLETE: 50,
  QUIZ_PERFECT: 100,
  BATTLE_WIN: 150,
  BATTLE_PARTICIPATE: 30,
  DAILY_LOGIN: 20,
  PDF_UPLOAD: 25,
  DIFFICULTY_BONUS: {
    easy: 0,
    medium: 25,
    hard: 50,
  },
});

// Level thresholds (XP required for each level)
const LEVEL_THRESHOLDS = [
  0,     // Level 1
  100,   // Level 2
  300,   // Level 3
  600,   // Level 4
  1000,  // Level 5
  1500,  // Level 6
  2100,  // Level 7
  2800,  // Level 8
  3600,  // Level 9
  4500,  // Level 10
  6000,  // Level 11
  8000,  // Level 12
  10500, // Level 13
  13500, // Level 14
  17000, // Level 15
];

const MAX_LEVEL = LEVEL_THRESHOLDS.length;

/**
 * Calculate level from total XP
 * @param {number} xp
 * @returns {number} level
 */
const getLevelFromXP = (xp) => {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return Math.min(level, MAX_LEVEL);
};

module.exports = { XP_REWARDS, LEVEL_THRESHOLDS, MAX_LEVEL, getLevelFromXP };