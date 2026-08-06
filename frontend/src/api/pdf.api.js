import axiosInstance from './axios.instance.js';

/**
 * @api pdfAPI
 * @description PDF management API calls.
 */
export const pdfAPI = {
  upload: (formData, onProgress) =>
    axiosInstance.post('/api/v1/pdf/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        const percent = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress?.(percent);
      },
    }),

  getAll: (params) =>
    axiosInstance.get('/api/v1/pdf', { params }),

  getById: (id) =>
    axiosInstance.get(`/api/v1/pdf/${id}`),

  delete: (id) =>
    axiosInstance.delete(`/api/v1/pdf/${id}`),

  process: (id) =>
    axiosInstance.post(`/api/v1/pdf/${id}/process`),
};