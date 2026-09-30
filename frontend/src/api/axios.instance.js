import axios from 'axios';
import toast from 'react-hot-toast';

/**
 * @instance axiosInstance
 * @description Configured Axios instance with interceptors.
 *
 * Features:
 * - Automatic JWT token injection (via Authorization header)
 * - Token refresh on 401 errors
 * - Global error handling
 * - Request/response logging (dev mode)
 * - CORS-friendly configuration (credentials disabled, using JWT tokens)
 */

// Use FastAPI backend URL directly
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';

// ─── Create Instance ──────────────────────────────────────────────────────────
const axiosInstance = axios.create({
  baseURL:         BASE_URL,
  timeout:         30000,
  withCredentials: false, // Disabled to avoid CORS issues - using JWT tokens instead
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request Interceptor ──────────────────────────────────────────────────────
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor ─────────────────────────────────────────────────────
let isRefreshing = false;
let refreshQueue = [];

const processRefreshQueue = (error, token = null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  refreshQueue = [];
};

axiosInstance.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // Handle 401 - Token expired
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/refresh-token') &&
      !originalRequest.url.includes('/auth/login') &&
      !originalRequest.url.includes('/auth/register')
    ) {
      if (isRefreshing) {
        // Queue this request while refresh is in progress
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt token refresh
        const response = await axiosInstance.post('/auth/refresh-token');
        const { accessToken } = response.data;

        localStorage.setItem('accessToken', accessToken);
        axiosInstance.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

        processRefreshQueue(null, accessToken);
        isRefreshing = false;

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axiosInstance(originalRequest);

      } catch (refreshError) {
        processRefreshQueue(refreshError, null);
        isRefreshing = false;

        // Clear auth state and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');

        // Dispatch custom event to trigger logout in store
        window.dispatchEvent(new CustomEvent('auth:logout'));

        return Promise.reject(refreshError);
      }
    }

    // Handle other errors
    if (error.response?.status === 403) {
      toast.error('You do not have permission to perform this action.');
    }

    if (error.response?.status === 429) {
      toast.error('Too many requests. Please wait a moment.');
    }

    if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.');
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;