import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * @utils helpers
 * @description General utility helpers.
 */

/**
 * Merge Tailwind CSS classes intelligently.
 */
export const cn = (...inputs) => twMerge(clsx(inputs));

/**
 * Sleep/delay utility for async operations.
 */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Deep clone an object.
 */
export const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

/**
 * Generate random ID.
 */
export const generateId = () =>
  Math.random().toString(36).substring(2) + Date.now().toString(36);

/**
 * Check if value is empty (null, undefined, empty string/array/object).
 */
export const isEmpty = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string')  return value.trim().length === 0;
  if (Array.isArray(value))       return value.length === 0;
  if (typeof value === 'object')  return Object.keys(value).length === 0;
  return false;
};

/**
 * Debounce a function.
 */
export const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Get difficulty badge class.
 */
export const getDifficultyClass = (difficulty) => {
  const map = {
    easy:   'badge-easy',
    medium: 'badge-medium',
    hard:   'badge-hard',
  };
  return map[difficulty] || 'badge-medium';
};

/**
 * Get rank medal emoji.
 */
export const getRankMedal = (rank) => {
  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
  return medals[rank] || `#${rank}`;
};

const LEVEL_THRESHOLDS = [
  0, 500, 1200, 2200, 3500, 5200, 7200, 9600, 12500, 16000,
  20000, 25000, 31000, 38000, 46000, 55000, 65000, 76000, 88000, 101000
];

/**
 * Get detailed progressive level breakdown.
 */
export const getLevelDetails = (totalXP) => {
  const points = Math.max(0, Number(totalXP) || 0);
  let lvl = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (points >= LEVEL_THRESHOLDS[i]) {
      lvl = i + 1;
    } else {
      break;
    }
  }

  if (lvl >= LEVEL_THRESHOLDS.length) {
    const extra = points - LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
    lvl = Math.min(100, 20 + Math.floor(extra / 15000));
  }

  const currentFloor = lvl <= LEVEL_THRESHOLDS.length 
    ? LEVEL_THRESHOLDS[lvl - 1] 
    : LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (lvl - 20) * 15000;

  const nextCeiling = lvl < LEVEL_THRESHOLDS.length
    ? LEVEL_THRESHOLDS[lvl]
    : currentFloor + 15000;

  const xpNeeded = Math.max(0, nextCeiling - points);
  const xpInLevel = Math.max(0, points - currentFloor);
  const range = Math.max(1, nextCeiling - currentFloor);
  const progressPercent = Math.min(100, Math.max(0, Math.round((xpInLevel / range) * 100)));

  return {
    level: lvl,
    currentFloor,
    nextCeiling,
    xpNeeded,
    xpInLevel,
    progressPercent,
  };
};

/**
 * Calculate level progress percentage using progressive curve.
 */
export const getLevelProgress = (xp) => {
  return getLevelDetails(xp).progressPercent;
};

/**
 * Normalize path by removing double slashes and trailing slashes.
 */
export const normalizePath = (path) => {
  if (!path) return '/';
  // Remove double slashes
  const normalized = path.replace(/\/+/g, '/');
  // Remove trailing slash unless it's root
  return normalized === '/' ? '/' : normalized.replace(/\/$/, '');
};