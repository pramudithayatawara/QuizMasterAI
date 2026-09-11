import axiosInstance from './axios.instance.js';

/**
 * @api quizAPI
 * @description Quiz management API calls.
 */
export const quizAPI = {
  // Generate quiz from PDF using RAG pipeline
  generateQuiz: (data) =>
    axiosInstance.post('/api/v1/quizzes/generate', data),

  // Get specific quiz with full details (questions and context references)
  getQuizById: (id) =>
    axiosInstance.get(`/api/v1/quizzes/${id}`),

  // Get all quizzes for a specific PDF
  getQuizzesByPdf: (pdfId, params = {}) =>
    axiosInstance.get(`/api/v1/quizzes/pdf/${pdfId}`, { params }),

  // Get all user quizzes
  getAll: (params) =>
    axiosInstance.get('/api/v1/quizzes', { params }),

  // Get quiz attempt history
  getHistory: (params) =>
    axiosInstance.get('/api/v1/quizzes/history', { params }),

  // Start quiz attempt (supports options like { isAdaptive: true })
  start: (id, options = {}) =>
    axiosInstance.post(`/api/v1/quizzes/${id}/start`, options),

  // Submit quiz answers (bulk submit)
  submit: (attemptId, data) =>
    axiosInstance.post(`/api/v1/quizzes/attempt/${attemptId}/submit`, data),

  // Submit single adaptive question step (Real-time CAT)
  submitAdaptiveStep: (attemptId, data) =>
    axiosInstance.post(`/api/v1/quizzes/attempt/${attemptId}/adaptive-step`, data),

  // Get quiz review with answers
  review: (attemptId) =>
    axiosInstance.get(`/api/v1/quizzes/attempt/${attemptId}/review`),

  // Module 05: Adaptive Quiz Engine endpoints
  getRecommendedDifficulty: () =>
    axiosInstance.get('/api/v1/quizzes/adaptive/recommended-difficulty'),

  getPerformanceStats: () =>
    axiosInstance.get('/api/v1/quizzes/adaptive/performance-stats'),

  // Legacy endpoints (for backward compatibility)
  generate: (data) =>
    axiosInstance.post('/api/v1/quiz/generate', data),

  getById: (id) =>
    axiosInstance.get(`/api/v1/quiz/${id}`),
};