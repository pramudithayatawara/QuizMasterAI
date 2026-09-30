import axiosInstance from './axios.instance.js';

/**
 * @api userAPI
 * @description User profile API calls.
 */
export const userAPI = {
  getProfile: () =>
    axiosInstance.get('/users/profile'),

  updateProfile: (data) =>
    axiosInstance.put('/users/profile', data),

  changePassword: (data) =>
    axiosInstance.post('/users/change-password', data),

  getActivityLog: () =>
    axiosInstance.get('/users/activity'),

  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return axiosInstance.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  removeAvatar: () =>
    axiosInstance.delete('/users/me/avatar'),
};
