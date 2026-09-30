import axiosInstance from './axios.instance.js';

/**
 * @api battleAPI
 * @description Battle mode API calls.
 */
export const battleAPI = {
  createQuiz: (data) =>
    axiosInstance.post('/battle/create-quiz', data),

  getById: (id) =>
    axiosInstance.get(`/battle/${id}`),

  getHistory: (params) =>
    axiosInstance.get('/battle/history', { params }),

  getActive: () =>
    axiosInstance.get('/battle/active'),
};