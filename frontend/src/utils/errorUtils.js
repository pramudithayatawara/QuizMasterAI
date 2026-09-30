/**
 * @file errorUtils.js
 * @description Utility functions for safely extracting error messages from API responses
 */

/**
 * Safely extracts error message from various error types
 * Handles FastAPI/Pydantic validation errors, network errors, and generic errors
 * 
 * @param {Error|Object} error - The error object or error response
 * @returns {string} A human-readable error message
 */
export const extractErrorMessage = (error) => {
  // If error is null or undefined
  if (!error) {
    return 'An unknown error occurred';
  }

  // If error is already a string
  if (typeof error === 'string') {
    return error;
  }

  // Handle Axios error responses
  if (error.response && error.response.data) {
    const data = error.response.data;
    
    // Handle FastAPI/Pydantic validation errors (array format)
    if (Array.isArray(data.detail)) {
      const messages = data.detail.map((err) => {
        if (typeof err === 'string') {
          return err;
        }
        if (err.msg) {
          // Include field location if available
          const location = err.loc && Array.isArray(err.loc) 
            ? err.loc.join('.') 
            : '';
          return location 
            ? `${location}: ${err.msg}` 
            : err.msg;
        }
        return 'Validation error';
      });
      return messages.join('; ');
    }
    
    // Handle FastAPI/Pydantic validation errors (string format)
    if (typeof data.detail === 'string') {
      return data.detail;
    }
    
    // Handle other error data structures
    if (data.message) {
      return data.message;
    }
    
    if (data.error) {
      return typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    }
    
    // Fallback to stringified data
    try {
      return JSON.stringify(data);
    } catch {
      return 'Server error occurred';
    }
  }

  // Handle error message
  if (error.message) {
    return error.message;
  }

  // Handle error toString
  if (typeof error.toString === 'function') {
    try {
      const str = error.toString();
      if (str !== '[object Object]') {
        return str;
      }
    } catch {
      // Ignore toString errors
    }
  }

  // Generic fallback
  return 'An error occurred. Please try again.';
};

/**
 * Safely logs error details for debugging
 * 
 * @param {Error|Object} error - The error object
 * @param {string} context - Context where the error occurred
 */
export const logErrorDetails = (error, context = 'Unknown') => {
  console.error(`❌ Error in ${context}:`, error);
  
  if (error.response) {
    console.error('Response data:', error.response.data);
    console.error('Response status:', error.response.status);
    console.error('Response headers:', error.response.headers);
  }
  
  if (error.request) {
    console.error('Request details:', error.request);
  }
  
  if (error.config) {
    console.error('Request config:', error.config);
  }
};

/**
 * Determines if an error is a network/timeout error
 * 
 * @param {Error|Object} error - The error object
 * @returns {boolean} True if network/timeout error
 */
export const isNetworkError = (error) => {
  return (
    error.code === 'ECONNABORTED' ||
    error.code === 'ETIMEDOUT' ||
    error.code === 'ENETDOWN' ||
    error.code === 'ECONNREFUSED' ||
    error.message?.includes('timeout') ||
    error.message?.includes('Network Error') ||
    !error.response && error.request
  );
};

/**
 * Determines if an error is a validation error (422)
 * 
 * @param {Error|Object} error - The error object
 * @returns {boolean} True if validation error
 */
export const isValidationError = (error) => {
  return error.response?.status === 422;
};

/**
 * Determines if an error is an authentication error (401/403)
 * 
 * @param {Error|Object} error - The error object
 * @returns {boolean} True if authentication error
 */
export const isAuthError = (error) => {
  return error.response?.status === 401 || error.response?.status === 403;
};

/**
 * Determines if an error is a not found error (404)
 * 
 * @param {Error|Object} error - The error object
 * @returns {boolean} True if not found error
 */
export const isNotFoundError = (error) => {
  return error.response?.status === 404;
};

/**
 * Gets a user-friendly error message based on error type
 * 
 * @param {Error|Object} error - The error object
 * @returns {string} User-friendly error message
 */
export const getUserFriendlyErrorMessage = (error) => {
  if (isNetworkError(error)) {
    return 'Network error. Please check your connection and try again.';
  }
  
  if (isAuthError(error)) {
    return 'Authentication error. Please log in again.';
  }
  
  if (isNotFoundError(error)) {
    return 'Resource not found. It may have been deleted or moved.';
  }
  
  if (isValidationError(error)) {
    return extractErrorMessage(error);
  }
  
  return extractErrorMessage(error);
};