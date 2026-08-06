import { format, formatDistanceToNow, parseISO } from 'date-fns';

/**
 * @utils formatters
 * @description Data formatting utilities.
 */

/**
 * Format date to readable string.
 */
export const formatDate = (date, pattern = 'MMM d, yyyy') => {
  if (!date) return '—';
  try {
    return format(typeof date === 'string' ? parseISO(date) : date, pattern);
  } catch {
    return '—';
  }
};

/**
 * Format date to relative time (e.g. "2 hours ago").
 */
export const formatRelativeTime = (date) => {
  if (!date) return '—';
  try {
    return formatDistanceToNow(
      typeof date === 'string' ? parseISO(date) : date,
      { addSuffix: true }
    );
  } catch {
    return '—';
  }
};

/**
 * Format seconds to MM:SS string.
 */
export const formatTimer = (seconds) => {
  if (seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/**
 * Format score percentage with color class.
 */
export const formatScore = (percentage) => {
  const value = Math.round(percentage);
  let color = 'text-red-400';
  if (value >= 80) color = 'text-secondary-400';
  else if (value >= 60) color = 'text-accent-400';
  else if (value >= 40) color = 'text-yellow-400';
  return { value: `${value}%`, color };
};

/**
 * Format file size to human readable string.
 */
export const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Format number with K/M suffix.
 */
export const formatNumber = (num) => {
  if (!num && num !== 0) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)     return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
};

/**
 * Format duration in seconds to readable string.
 */
export const formatDuration = (seconds) => {
  if (!seconds) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
};

/**
 * Truncate text with ellipsis.
 */
export const truncate = (text, maxLength = 100) => {
  if (!text) return '';
  return text.length > maxLength
    ? `${text.substring(0, maxLength)}...`
    : text;
};

/**
 * Get ordinal suffix (1st, 2nd, 3rd, etc.)
 */
export const getOrdinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/**
 * Capitalize first letter.
 */
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};