import axiosInstance from './axios.instance.js';

/**
 * @api settingsAPI
 * @description User settings API calls.
 */
export const settingsAPI = {
  getSettings: () =>
    axiosInstance.get('/api/v1/settings'),

  updateSettings: (data) =>
    axiosInstance.put('/api/v1/settings', data),

  resetSettings: () =>
    axiosInstance.post('/api/v1/settings/reset'),
};
