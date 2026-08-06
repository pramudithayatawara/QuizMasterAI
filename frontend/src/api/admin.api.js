import axiosInstance from './axios.instance.js';

/**
 * @api adminAPI
 * @description Admin panel API calls.
 */
export const adminAPI = {
  getDashboard: () =>
    axiosInstance.get('/api/v1/admin/dashboard'),

  // Users
  getUsers: (params) =>
    axiosInstance.get('/api/v1/admin/users', { params }),

  getUserById: (id) =>
    axiosInstance.get(`/api/v1/admin/users/${id}`),

  deleteUser: (id) =>
    axiosInstance.delete(`/api/v1/admin/users/${id}`),

  toggleUserStatus: (id) =>
    axiosInstance.patch(`/api/v1/admin/users/${id}/toggle-status`),

  // PDFs
  getPDFs: (params) =>
    axiosInstance.get('/api/v1/admin/pdfs', { params }),

  deletePDF: (id) =>
    axiosInstance.delete(`/api/v1/admin/pdfs/${id}`),

  // Quizzes
  getQuizzes: (params) =>
    axiosInstance.get('/api/v1/admin/quizzes', { params }),

  deleteQuiz: (id) =>
    axiosInstance.delete(`/api/v1/admin/quizzes/${id}`),

  // Battles
  getBattles: (params) =>
    axiosInstance.get('/api/v1/admin/battles', { params }),
};