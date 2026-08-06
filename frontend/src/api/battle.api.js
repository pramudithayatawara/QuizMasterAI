import axiosInstance from './axios.instance.js';

/**
 * @api battleAPI
 * @description Battle mode API calls.
 */
export const battleAPI = {
  createQuiz: (data) =>
    axiosInstance.post('/api/v1/battle/create-quiz', data),

  getById: (id) =>
    axiosInstance.get(`/api/v1/battle/${id}`),

  getHistory: (params) =>
    axiosInstance.get('/api/v1/battle/history', { params }),

  getActive: () =>
    axiosInstance.get('/api/v1/battle/active'),
};