import axiosInstance from './axios.instance.js';

/**
 * @api quizAPI
 * @description Quiz management API calls.
 */
export const quizAPI = {
  generate: (data) =>
    axiosInstance.post('/api/v1/quiz/generate', data),

  getAll: (params) =>
    axiosInstance.get('/api/v1/quiz', { params }),

  getHistory: (params) =>
    axiosInstance.get('/api/v1/quiz/history', { params }),

  getById: (id) =>
    axiosInstance.get(`/api/v1/quiz/${id}`),

  start: (id) =>
    axiosInstance.post(`/api/v1/quiz/${id}/start`),

  submit: (attemptId, data) =>
    axiosInstance.post(`/api/v1/quiz/attempt/${attemptId}/submit`, data),

  review: (attemptId) =>
    axiosInstance.get(`/api/v1/quiz/attempt/${attemptId}/review`),
};