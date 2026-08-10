import axios from 'axios';
import axiosInstance from './axios.instance.js';

/**
 * @api pdfAPI
 * @description PDF management API calls.
 */
export const pdfAPI = {
  // ✅ Function name එක 'upload' ලෙස වෙනස් කරන ලදී (PDFUploader එකට ගැලපෙන සේ)
  // ✅ file/formData දෙකම accept වන ලෙස හදා ඇත
  upload: (data, onUploadProgress) => {
    let formData;

    // ඉදිරියට එන්නේ කෙළින්ම File එකක්ද, නැත්නම් FormData එකක්දැයි check කිරීම
    if (data instanceof FormData) {
      formData = data;
    } else {
      formData = new FormData();
      formData.append('pdf', data);
    }
    
    const config = {};
    
    if (onUploadProgress) {
      config.onUploadProgress = (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onUploadProgress(percentCompleted);
        }
      };
    }
    
    // Auth Token එක ලබාගැනීම
    const token = localStorage.getItem('accessToken');

    // Create custom axios instance without explicit Content-Type header
    const uploadInstance = axios.create({
      baseURL: axiosInstance.defaults.baseURL,
      timeout: 60000, // Large PDF processing සඳහා timeout එක 60s දක්වා වැඩි කරන ලදී
      withCredentials: true,
    });
    
    if (token) {
      uploadInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    
    return uploadInstance.post('/api/v1/pdfs/upload', formData, config);
  },

  // Alias එකක් ලෙස uploadPdf ද තබා ඇත (පරණ තැනක Call වී ඇත්නම් error නොවීමට)
  uploadPdf: function (data, onUploadProgress) {
    return this.upload(data, onUploadProgress);
  },

  getPdfs: (params = {}) =>
    axiosInstance.get('/api/v1/pdfs', { params }),

  getPdfById: (id) =>
    axiosInstance.get(`/api/v1/pdfs/${id}`),

  getPdfChunks: (id, params = {}) =>
    axiosInstance.get(`/api/v1/pdfs/${id}/chunks`, { params }),

  deletePdf: (id) =>
    axiosInstance.delete(`/api/v1/pdfs/${id}`),
};