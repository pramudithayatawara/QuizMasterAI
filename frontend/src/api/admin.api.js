import axiosInstance from './axios.instance.js';

/**
 * @api adminAPI
 * @description Admin panel API calls.
 */
export const adminAPI = {
  getDashboard: () =>
    axiosInstance.get('/admin/dashboard'),

  // Users
  getUsers: (params) =>
    axiosInstance.get('/admin/users', { params }),

  getUserById: (id) =>
    axiosInstance.get(`/admin/users/${id}`),

  deleteUser: (id) =>
    axiosInstance.delete(`/admin/users/${id}`),

  toggleUserStatus: (id) =>
    axiosInstance.patch(`/admin/users/${id}/toggle-status`),

  updateUserRole: (id, role) =>
    axiosInstance.patch(`/admin/users/${id}/role`, { role }),

  // PDFs
  getPDFs: (params) =>
    axiosInstance.get('/admin/pdfs', { params }),

  deletePDF: (id) =>
    axiosInstance.delete(`/admin/pdfs/${id}`),

  // Quizzes
  getQuizzes: (params) =>
    axiosInstance.get('/admin/quizzes', { params }),

  deleteQuiz: (id) =>
    axiosInstance.delete(`/admin/quizzes/${id}`),

  // Battles
  getBattles: (params) =>
    axiosInstance.get('/admin/battles', { params }),

  deleteBattle: (id) =>
    axiosInstance.delete(`/admin/battles/${id}`),
};