import axiosInstance from './axios.instance.js';
import axios from 'axios';
import { extractErrorMessage, logErrorDetails } from '../utils/errorUtils.js';

/**
 * @api quizAPI
 * @description Quiz management API calls with corrected backend endpoints.
 */
export const quizAPI = {
  // ==================== CORRECTED BACKEND ENDPOINTS ====================

  // PDF Quiz Generation - Using RAG endpoint (Fallback for mixed generation)
  generateQuizFromPDF: (data) => {
    const token = localStorage.getItem('accessToken');
    
    console.log('📤 Using RAG endpoint for PDF generation:', {
      pdf_id: data.pdf_id,
      file_path: data.file_path
    });
    
    return axios.post('http://127.0.0.1:8000/api/generate-quiz-from-pdf', data, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minute timeout for PDF processing
    });
  },

  // Mixed Question Generation - Priority 25
  generateMixedQuestions: (data) => {
    const token = localStorage.getItem('accessToken');
    return axios.post('http://127.0.0.1:8000/api/v1/mixed/generate', data, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minute timeout for mixed generation
    });
  },

  // Mixed Question Generation from PDF - Priority 25 (JSON Body - Pydantic Model)
  generateMixedFromPDF: (pdfContent, config = {}) => {
    const token = localStorage.getItem('accessToken');
    
    // Extract configuration parameters
    const {
      totalQuestions = 10,
      mcqPercentage = 0.7,
      difficulty = 'medium',
      topic = null,
      enableContentVerification = true
    } = config;

    // Log the payload for debugging
    console.log('📤 Sending mixed PDF generation request (JSON):', {
      pdf_content_length: pdfContent?.length || 0,
      total_questions: totalQuestions,
      mcq_percentage: mcqPercentage,
      difficulty: difficulty,
      topic: topic,
      enable_content_verification: enableContentVerification
    });

    // Build JSON request body matching Pydantic model
    const jsonData = {
      pdf_content: pdfContent,
      total_questions: parseInt(totalQuestions),
      mcq_percentage: parseFloat(mcqPercentage),
      difficulty: difficulty,
      topic: topic,
      enable_content_verification: Boolean(enableContentVerification)
    };

    console.log('📤 Final JSON payload:', jsonData);

    return axios.post('http://127.0.0.1:8000/api/v1/mixed/generate-from-pdf', jsonData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minute timeout for PDF processing
    });
  },

  // Mixed Question Generation from PDF - Priority 25 (FormData - Fallback Method)
  generateMixedFromPDFFormData: (pdfContent, config = {}) => {
    const token = localStorage.getItem('accessToken');
    
    const {
      totalQuestions = 10,
      mcqPercentage = 0.7,
      difficulty = 'medium',
      topic = null,
      enableContentVerification = true
    } = config;

    console.log('📤 Sending mixed PDF generation request (FormData):', {
      pdf_content_length: pdfContent?.length || 0,
      total_questions: totalQuestions,
      mcq_percentage: mcqPercentage,
      difficulty: difficulty,
      topic: topic,
      enable_content_verification: enableContentVerification
    });

    // Send as form parameters
    const formData = new FormData();
    formData.append('pdf_content', pdfContent);
    formData.append('total_questions', totalQuestions.toString());
    formData.append('mcq_percentage', mcqPercentage.toString());
    formData.append('difficulty', difficulty);
    if (topic) {
      formData.append('topic', topic);
    }
    formData.append('enable_content_verification', enableContentVerification.toString());

    return axios.post('http://127.0.0.1:8000/api/v1/mixed/generate-from-pdf', formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      },
      timeout: 120000 // 2 minute timeout for PDF processing
    });
  },

  // Priority 30: Store generated quiz with PDF and user linking
  storeQuiz: (quizData) => {
    const token = localStorage.getItem('accessToken');
    
    console.log('💾 Storing quiz with data:', {
      user_id: quizData.user_id,
      quiz_title: quizData.quiz_title,
      questions_count: quizData.questions?.length,
      pdf_id: quizData.pdf_id,
      category: quizData.category
    });

    // Ensure proper field names based on backend model
    const payload = {
      user_id: parseInt(quizData.user_id),
      quiz_title: quizData.quiz_title,
      quiz_description: quizData.quiz_description,
      questions: quizData.questions.map(q => ({
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        correct_answer: q.correct_answer,
        difficulty: q.difficulty,
        source_chunk_index: q.source_chunk_index,
        confidence_score: q.confidence_score,
        question_metadata: q.question_metadata || q.metadata || {},
        tags: q.tags
      })),
      pdf_id: quizData.pdf_id ? parseInt(quizData.pdf_id) : null,
      category: quizData.category,
      quiz_metadata: quizData.quiz_metadata || quizData.metadata || {},
      tags: quizData.tags
    };

    console.log('📤 Sending storage payload:', payload);

    return axios.post('http://127.0.0.1:8000/api/v1/quizzes/store', payload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 1 minute timeout for quiz storage
    });
  },

  // Priority 31: Categorize quiz difficulty
  categorizeDifficulty: (quizId) => {
    const token = localStorage.getItem('accessToken');
    return axios.post(`http://127.0.0.1:8000/api/v1/quizzes/${quizId}/categorize-difficulty`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minute timeout for difficulty categorization
    });
  },

  // Start Quiz Attempt
  start: (quizId) =>
    axiosInstance.post(`/quizzes/${quizId}/start`),

  startQuiz: (quizId) =>
    axiosInstance.post(`/quizzes/${quizId}/start`),

  // Question Validation - Priority 28
  validateRelevance: (data) => {
    const token = localStorage.getItem('accessToken');
    return axios.post('http://127.0.0.1:8000/api/v1/validation/relevance', data, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 1 minute timeout for validation
    });
  },

  // Batch Question Validation - Priority 28
  validateBatchRelevance: (data) => {
    const token = localStorage.getItem('accessToken');
    return axios.post('http://127.0.0.1:8000/api/v1/validation/relevance-batch', data, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minute timeout for batch validation
    });
  },

  // Duplicate Detection - Priority 29
  checkDuplicates: (data) => {
    const token = localStorage.getItem('accessToken');
    return axios.post('http://127.0.0.1:8000/api/v1/validation/duplicates', data, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 1 minute timeout for duplicate checking
    });
  },

  // Combined Validation and Deduplication - Priority 28 & 29
  validateAndDeduplicate: (data) => {
    const token = localStorage.getItem('accessToken');
    return axios.post('http://127.0.0.1:8000/api/v1/validation/validate-and-deduplicate', data, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minute timeout for combined validation
    });
  },

  // ==================== EXISTING ENDPOINTS (kept for compatibility) ====================

  // Get specific quiz with full details (questions and context references)
  getQuizById: (id) =>
    axiosInstance.get(`/quizzes/${id}`),

  // Get all quizzes for a specific PDF
  getQuizzesByPdf: (pdfId, params = {}) =>
    axiosInstance.get(`/quizzes/pdf/${pdfId}`, { params }),

  // Get all user quizzes
  getAll: (params) =>
    axiosInstance.get('/quizzes', { params }),

  // Get quiz attempt history
  getHistory: (params) =>
    axiosInstance.get('/quizzes/history', { params }),

  // Submit quiz answers
  submit: (attemptId, data) =>
    axiosInstance.post(`/quizzes/attempt/${attemptId}/submit`, data),

  // Get quiz review with answers
  review: (attemptId) =>
    axiosInstance.get(`/quizzes/attempt/${attemptId}/review`),

  // Module 05: Adaptive Quiz Engine endpoints (using v1 API)
  getRecommendedDifficulty: () =>
    axiosInstance.get('/quizzes/adaptive/recommended-difficulty'),

  getPerformanceStats: () =>
    axiosInstance.get('/quizzes/adaptive/performance-stats'),

  // Legacy endpoints (for backward compatibility)
  generate: (data) =>
    axiosInstance.post('/quiz/generate', data),

  // Generate and store quiz directly (used by CreateQuizPage)
  generateQuiz: (config) =>
    axiosInstance.post('/quizzes/generate-quiz', config),

  getById: (id) =>
    axiosInstance.get(`/quiz/${id}`),

  // AI Quiz Generation from context (direct backend call)
  generateFromContext: (data) => {
    const token = localStorage.getItem('accessToken');
    return axios.post('http://127.0.0.1:8000/api/generate-quiz', data, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  },

  // Utility: Get quiz by ID from new storage endpoints
  getStoredQuiz: (quizId) => {
    const token = localStorage.getItem('accessToken');
    return axios.get(`http://127.0.0.1:8000/api/v1/quizzes/${quizId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  },

  // Utility: Store quiz and categorize difficulty in one operation
  storeAndCategorizeQuiz: async (quizData) => {
    try {
      // First store the quiz
      const storeResponse = await quizAPI.storeQuiz(quizData);
      
      if (storeResponse.data && storeResponse.data.quiz_id) {
        // Then categorize the difficulty
        const categorizeResponse = await quizAPI.categorizeDifficulty(storeResponse.data.quiz_id);
        
        return {
          success: true,
          quiz_id: storeResponse.data.quiz_id,
          store_result: storeResponse.data,
          categorize_result: categorizeResponse.data
        };
      }
      
      return {
        success: false,
        error: 'Quiz storage did not return a valid quiz_id'
      };
    } catch (error) {
      logErrorDetails(error, 'storeAndCategorizeQuiz');
      return {
        success: false,
        error: extractErrorMessage(error) || 'Failed to store and categorize quiz'
      };
    }
  },

  // Utility: Generate mixed quiz with validation and storage
  generateMixedQuizWithValidation: async (pdfData, config = {}) => {
    try {
      const {
        totalQuestions = 10,
        mcqPercentage = 0.7,
        difficulty = 'medium',
        topic = null,
        enableValidation = true,
        enableDeduplication = true
      } = config;

      console.log('🔄 Starting mixed quiz generation with validation:', {
        pdf_id: pdfData.pdf_id,
        totalQuestions,
        mcqPercentage,
        difficulty,
        topic,
        enableValidation,
        enableDeduplication
      });

      // Step 1: Generate mixed questions from PDF content using query parameters
      const generateResponse = await quizAPI.generateMixedFromPDF(pdfData.content, {
        totalQuestions: totalQuestions,
        mcqPercentage: mcqPercentage,
        difficulty: difficulty,
        topic: topic,
        enableContentVerification: true
      });

      console.log('📊 Generation response:', generateResponse);

      if (!generateResponse.data || !generateResponse.data.questions) {
        throw new Error('Failed to generate mixed questions');
      }

      let questions = generateResponse.data.questions;

      // Step 2: Validate relevance if enabled
      if (enableValidation) {
        console.log('🔍 Validating relevance for', questions.length, 'questions');
        const validationResponse = await quizAPI.validateBatchRelevance({
          questions: questions.map(q => ({
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.options,
            source_content: pdfData.content
          }))
        });

        console.log('✅ Validation response:', validationResponse);

        if (validationResponse.data && validationResponse.data.valid_questions) {
          questions = validationResponse.data.valid_questions;
          console.log('📉 Questions after validation:', questions.length);
        }
      }

      // Step 3: Remove duplicates if enabled
      if (enableDeduplication) {
        console.log('🔍 Checking for duplicates');
        const dedupResponse = await quizAPI.checkDuplicates({
          questions: questions.map(q => ({
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.options
          }))
        });

        console.log('✅ Deduplication response:', dedupResponse);

        if (dedupResponse.data && dedupResponse.data.unique_questions) {
          questions = dedupResponse.data.unique_questions;
          console.log('📉 Questions after deduplication:', questions.length);
        }
      }

      return {
        success: true,
        questions: questions,
        total_generated: questions.length,
        mcq_count: questions.filter(q => q.question_type === 'mcq').length,
        tf_count: questions.filter(q => q.question_type === 'true_false').length,
        validation_applied: enableValidation,
        deduplication_applied: enableDeduplication
      };
    } catch (error) {
      logErrorDetails(error, 'generateMixedQuizWithValidation');
      return {
        success: false,
        error: extractErrorMessage(error) || 'Failed to generate mixed quiz with validation'
      };
    }
  },
};