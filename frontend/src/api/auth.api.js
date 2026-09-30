import axiosInstance from './axios.instance.js';

/**
 * @api authAPI
 * @description Authentication API calls.
 */
export const authAPI = {
  async login(data) {
    const response = await axiosInstance.post('/auth/login', data);
    return response.data;
  },

  async register(data) {
    const response = await axiosInstance.post('/auth/register', data);
    return response.data;
  },

  async logout() {
    const response = await axiosInstance.post('/auth/logout');
    return response.data;
  },

  async getMe() {
    const response = await axiosInstance.get('/auth/me');
    return response.data;
  },

  async refreshToken() {
    const response = await axiosInstance.post('/auth/refresh-token');
    return response.data;
  },

  async forgotPassword(data) {
    const response = await axiosInstance.post('/auth/forgot-password', data);
    return response.data;
  },

  async resetPassword(token, data) {
    const response = await axiosInstance.post(`/auth/reset-password/${token}`, data);
    return response.data;
  },

  async changePassword(data) {
    const response = await axiosInstance.post('/auth/change-password', data);
    return response.data;
  },

  async updateProfile(data) {
    const response = await axiosInstance.put('/users/me', data);
    return response.data;
  },

  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await axiosInstance.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async removeAvatar() {
    const response = await axiosInstance.delete('/users/me/avatar');
    return response.data;
  },
};