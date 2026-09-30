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

/**
 * Calculate level progress percentage.
 */
export const getLevelProgress = (xp, level) => {
  const xpForCurrentLevel = (level - 1) * 1000;
  const xpForNextLevel    = level * 1000;
  const progress = ((xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100;
  return Math.min(Math.max(progress, 0), 100);
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