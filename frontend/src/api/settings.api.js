import axiosInstance from './axios.instance.js';

/**
 * @api settingsAPI
 * @description User settings API calls.
 */
export const settingsAPI = {
  getSettings: () =>
    axiosInstance.get('/settings'),

  updateSettings: (data) =>
    axiosInstance.put('/settings', data),

  resetSettings: () =>
    axiosInstance.post('/settings/reset'),
};
