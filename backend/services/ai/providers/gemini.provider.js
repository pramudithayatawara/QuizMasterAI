'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const BaseAIProvider = require('./base.provider');
const config = require('../../../config/env');
const logger = require('../../../utils/logger');
const AppError = require('../../../utils/AppError');

/**
 * @class GeminiProvider
 * @description Google Gemini implementation of BaseAIProvider.
 * Supports Gemini 1.5 Flash and Pro models.
 */

class GeminiProvider extends BaseAIProvider {
  constructor() {
    super(config.GEMINI);

    if (!config.GEMINI.API_KEY) {
      throw new AppError('Gemini API key is not configured.', 500);
    }

    this.genAI = new GoogleGenerativeAI(config.GEMINI.API_KEY);
    this.modelName = config.GEMINI.MODEL || 'gemini-1.5-flash-latest';

    this.generationConfig = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 4096,
    };
  }

  /**
   * @method generateText
   * @description Generate text using Gemini API.
   */
  async generateText(prompt, options = {}) {
    try {
      const model = this.genAI.getGenerativeModel({
        model: options.model || this.modelName,
        generationConfig: {
          ...this.generationConfig,
          temperature: options.temperature || this.generationConfig.temperature,
          maxOutputTokens: options.maxTokens || this.generationConfig.maxOutputTokens,
        },
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new AppError('Gemini returned empty response.', 500);
      }

      logger.info(`Gemini response generated successfully`);
      return text;
    } catch (error) {
      if (error.message?.includes('quota')) {
        throw new AppError(
          'AI service quota exceeded. Please try again later.',
          429,
          'QUOTA_EXCEEDED'
        );
      }
      if (error.message?.includes('API_KEY')) {
        throw new AppError('Invalid Gemini API key.', 500, 'INVALID_API_KEY');
      }
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Gemini API error: ${error.message}`,
        500,
        'AI_ERROR'
      );
    }
  }

  /**
   * @method generateJSON
   * @description Generate and parse JSON response from Gemini.
   */
  async generateJSON(prompt, options = {}) {
    const jsonPrompt = `${prompt}\n\nIMPORTANT: Return ONLY valid JSON. No markdown formatting, no code blocks, no extra text. Start directly with { and end with }.`;

    const text = await this.generateText(jsonPrompt, {
      ...options,
      temperature: 0.3, // Lower temperature for JSON
    });

    return this.parseJSONResponse(text);
  }
}

module.exports = GeminiProvider;