import axiosInstance from './axios.instance.js';

export const notificationAPI = {
  getNotifications: () => axiosInstance.get('/notifications'),
  markAsRead: (id) => axiosInstance.post(`/notifications/${id}/read`),
  clearAll: () => axiosInstance.post('/notifications/clear'),
};
