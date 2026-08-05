'use strict';

const { OpenAI } = require('openai');
const BaseAIProvider = require('./base.provider');
const config = require('../../../config/env');
const logger = require('../../../utils/logger');
const AppError = require('../../../utils/AppError');

/**
 * @class OpenAIProvider
 * @description OpenAI GPT implementation of BaseAIProvider.
 * Supports GPT-4o-mini and GPT-4 models.
 */

class OpenAIProvider extends BaseAIProvider {
  constructor() {
    super(config.OPENAI);

    if (!config.OPENAI.API_KEY) {
      throw new AppError('OpenAI API key is not configured.', 500);
    }

    this.client = new OpenAI({
      apiKey: config.OPENAI.API_KEY,
    });

    this.modelName = config.OPENAI.MODEL || 'gpt-4o-mini';
    this.maxTokens = 4096;
    this.temperature = 0.7;
  }

  /**
   * @method generateText
   * @description Generate text using OpenAI Chat Completions API.
   */
  async generateText(prompt, options = {}) {
    try {
      const response = await this.client.chat.completions.create({
        model: options.model || this.modelName,
        messages: [
          {
            role: 'system',
            content: options.systemPrompt ||
              'You are an expert educational content generator. Always respond with accurate, educational content.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature || this.temperature,
        top_p: 0.9,
        frequency_penalty: 0.3,
        presence_penalty: 0.1,
      });

      const text = response.choices[0]?.message?.content;

      if (!text) {
        throw new AppError('OpenAI returned empty response.', 500);
      }

      logger.info(
        `OpenAI response: ${response.usage?.total_tokens} tokens used`
      );

      return text;
    } catch (error) {
      if (error.status === 429) {
        throw new AppError(
          'AI service rate limit exceeded. Please try again later.',
          429,
          'RATE_LIMIT'
        );
      }
      if (error.status === 401) {
        throw new AppError('Invalid OpenAI API key.', 500, 'INVALID_API_KEY');
      }
      if (error instanceof AppError) throw error;
      throw new AppError(
        `OpenAI API error: ${error.message}`,
        500,
        'AI_ERROR'
      );
    }
  }

  /**
   * @method generateJSON
   * @description Generate and parse JSON response from OpenAI.
   */
  async generateJSON(prompt, options = {}) {
    try {
      const response = await this.client.chat.completions.create({
        model: options.model || this.modelName,
        messages: [
          {
            role: 'system',
            content: 'You are an expert educational content generator. Always respond with valid JSON only. No markdown, no code blocks, no extra text.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature || 0.5,
        response_format: { type: 'json_object' }, // Force JSON mode
      });

      const text = response.choices[0]?.message?.content;
      return this.parseJSONResponse(text);
    } catch (error) {
      if (error instanceof AppError) throw error;
      // Fallback: try text generation and parse
      const text = await this.generateText(prompt, options);
      return this.parseJSONResponse(text);
    }
  }
}

module.exports = OpenAIProvider;