import axiosInstance from './axios.instance.js';

/**
 * @api gamificationAPI
 * @description Gamification & leaderboard API calls.
 */
export const gamificationAPI = {
  getProfile: () =>
    axiosInstance.get('/api/v1/gamification/profile/me'),

  getBadges: () =>
    axiosInstance.get('/api/v1/gamification/badges/me'),

  getLeaderboard: (params) =>
    axiosInstance.get('/api/v1/gamification/leaderboard', { params }),

  getStats: () =>
    axiosInstance.get('/api/v1/results/analytics/me'),
};