'use strict';

/**
 * @class BaseAIProvider
 * @description Abstract base class for AI providers.
 * Implements Open/Closed Principle - extend without modifying.
 * All AI providers must implement these methods.
 */

class BaseAIProvider {
  constructor(config) {
    if (new.target === BaseAIProvider) {
      throw new Error('BaseAIProvider is abstract and cannot be instantiated directly.');
    }
    this.config = config;
    this.modelName = null;
  }

  /**
   * @abstract generateText
   * @description Generate text from prompt.
   * @param {string} prompt - Input prompt
   * @param {object} options - Generation options
   * @returns {Promise<string>} Generated text
   */
  async generateText(prompt, options = {}) {
    throw new Error('generateText() must be implemented by subclass');
  }

  /**
   * @abstract generateJSON
   * @description Generate structured JSON from prompt.
   * @param {string} prompt - Input prompt
   * @returns {Promise<object>} Parsed JSON object
   */
  async generateJSON(prompt) {
    throw new Error('generateJSON() must be implemented by subclass');
  }

  /**
   * @method parseJSONResponse
   * @description Safely parse JSON from AI response.
   * Handles markdown code blocks and extra text.
   */
  parseJSONResponse(rawText) {
    try {
      // Remove markdown code blocks if present
      let cleaned = rawText
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/gi, '')
        .trim();

      // Find JSON object boundaries
      const startIndex = cleaned.indexOf('{');
      const endIndex = cleaned.lastIndexOf('}');

      if (startIndex !== -1 && endIndex !== -1) {
        cleaned = cleaned.substring(startIndex, endIndex + 1);
      }

      return JSON.parse(cleaned);
    } catch (error) {
      throw new Error(`Failed to parse AI JSON response: ${error.message}`);
    }
  }

  /**
   * @method getModelName
   */
  getModelName() {
    return this.modelName;
  }
}

module.exports = BaseAIProvider;