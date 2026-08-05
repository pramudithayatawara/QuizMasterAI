'use strict';

const config = require('../../config/env');
const logger = require('../../utils/logger');
const AppError = require('../../utils/AppError');

/**
 * @service AIService
 * @description AI provider factory and abstraction layer.
 * Implements Factory Pattern for provider selection.
 * Automatically selects provider based on config.
 *
 * Usage:
 * const aiService = require('./ai.service');
 * const result = await aiService.generateJSON(prompt);
 */

class AIService {
  constructor() {
    this._provider = null;
    this._initialized = false;
  }

  /**
   * @method getProvider
   * @description Get or initialize AI provider (lazy initialization).
   */
  getProvider() {
    if (!this._provider) {
      this._provider = this._createProvider();
      this._initialized = true;
      logger.info(`AI Provider initialized: ${config.AI_PROVIDER}`);
    }
    return this._provider;
  }

  /**
   * @private _createProvider
   * @description Create provider instance based on config.
   */
  _createProvider() {
    const providerName = config.AI_PROVIDER?.toLowerCase();

    switch (providerName) {
      case 'openai': {
        const OpenAIProvider = require('./providers/openai.provider');
        return new OpenAIProvider();
      }
      case 'gemini': {
        const GeminiProvider = require('./providers/gemini.provider');
        return new GeminiProvider();
      }
      default:
        throw new AppError(
          `Unsupported AI provider: ${providerName}. Use 'openai' or 'gemini'.`,
          500,
          'INVALID_PROVIDER'
        );
    }
  }

  /**
   * @method generateText
   * @description Generate text from prompt.
   */
  async generateText(prompt, options = {}) {
    return this.getProvider().generateText(prompt, options);
  }

  /**
   * @method generateJSON
   * @description Generate structured JSON from prompt.
   */
  async generateJSON(prompt, options = {}) {
    return this.getProvider().generateJSON(prompt, options);
  }

  /**
   * @method getModelName
   */
  getModelName() {
    return this.getProvider().getModelName();
  }

  /**
   * @method switchProvider
   * @description Switch AI provider at runtime.
   */
  switchProvider(providerName) {
    config.AI_PROVIDER = providerName;
    this._provider = null;
    logger.info(`AI Provider switched to: ${providerName}`);
  }
}

module.exports = new AIService();