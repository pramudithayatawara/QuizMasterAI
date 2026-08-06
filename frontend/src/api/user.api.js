import axiosInstance from './axios.instance.js';

/**
 * @api userAPI
 * @description User profile API calls.
 */
export const userAPI = {
  getProfile: () =>
    axiosInstance.get('/api/v1/users/profile'),

  updateProfile: (data) =>
    axiosInstance.put('/api/v1/users/profile', data),

  changePassword: (data) =>
    axiosInstance.post('/api/v1/users/change-password', data),

  getActivityLog: () =>
    axiosInstance.get('/api/v1/users/activity'),

  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return axiosInstance.post('/api/v1/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  removeAvatar: () =>
    axiosInstance.delete('/api/v1/users/me/avatar'),
};
