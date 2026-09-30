import axios from 'axios';

/**
 * @api aiQuizAPI
 * @description Direct API calls to FastAI backend for AI quiz generation
 */
const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout for AI generation
});

export const aiQuizAPI = {
  /**
   * Generate quiz question from context
   * @param {Object} data - Request data
   * @param {string} data.context - Study material or context text
   * @returns {Promise<Object>} Generated quiz question
   */
  generateQuiz: async (data) => {
    try {
      const response = await apiClient.post('/api/generate-quiz', data);
      return response.data;
    } catch (error) {
      console.error('AI Quiz Generation Error:', error);
      throw error;
    }
  },

  /**
   * Health check for AI service
   * @returns {Promise<Object>} Service status
   */
  healthCheck: async () => {
    try {
      const response = await apiClient.get('/api/health');
      return response.data;
    } catch (error) {
      console.error('Health Check Error:', error);
      throw error;
    }
  },
};

export default aiQuizAPI;
