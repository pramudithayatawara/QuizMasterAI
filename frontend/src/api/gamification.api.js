import axiosInstance from './axios.instance.js';

/**
 * @api gamificationAPI
 * @description Gamification & leaderboard API calls.
 */
export const gamificationAPI = {
  getProfile: () =>
    axiosInstance.get('/gamification/profile/me'),

  getBadges: () =>
    axiosInstance.get('/gamification/badges/me'),

  getLeaderboard: (params) =>
    axiosInstance.get('/gamification/leaderboard', { params }),

  getStats: () =>
    axiosInstance.get('/results/analytics/me'),
};