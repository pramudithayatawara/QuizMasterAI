'use strict';

const config = require('../../config/env');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

/**
 * @service EmbeddingService
 * @description Generates vector embeddings for text chunks.
 * Supports OpenAI and Gemini embedding models.
 * Implements batching to handle rate limits.
 */

class EmbeddingService {
  constructor() {
    this.provider = config.AI_PROVIDER;
    this.batchSize = 10; // Process 10 chunks at a time
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * @method generateEmbedding
   * @description Generate embedding for single text.
   * @param {string} text - Input text
   * @returns {number[]} Embedding vector
   */
  async generateEmbedding(text) {
    if (!text || text.trim().length === 0) {
      throw new AppError('Text is required for embedding', 400);
    }

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        if (this.provider === 'openai') {
          return await this._generateOpenAIEmbedding(text);
        } else if (this.provider === 'gemini') {
          return await this._generateGeminiEmbedding(text);
        } else {
          throw new AppError(`Unsupported AI provider: ${this.provider}`, 500);
        }
      } catch (error) {
        if (attempt === this.retryAttempts) throw error;
        logger.warn(`Embedding attempt ${attempt} failed, retrying...`);
        await this._sleep(this.retryDelay * attempt);
      }
    }
  }

  /**
   * @method generateBatchEmbeddings
   * @description Generate embeddings for multiple texts in batches.
   * @param {string[]} texts - Array of text strings
   * @returns {number[][]} Array of embedding vectors
   */
  async generateBatchEmbeddings(texts) {
    const embeddings = [];

    // Process in batches
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      logger.info(
        `Generating embeddings: batch ${Math.floor(i / this.batchSize) + 1} ` +
        `of ${Math.ceil(texts.length / this.batchSize)}`
      );

      const batchEmbeddings = await Promise.all(
        batch.map((text) => this.generateEmbedding(text))
      );

      embeddings.push(...batchEmbeddings);

      // Rate limit delay between batches
      if (i + this.batchSize < texts.length) {
        await this._sleep(500);
      }
    }

    return embeddings;
  }

  /**
   * @method generateChunkEmbeddings
   * @description Generate embeddings for PDF chunks.
   * @param {Array} chunks - Array of chunk objects
   * @returns {Array} Chunks with embeddings attached
   */
  async generateChunkEmbeddings(chunks) {
    const texts = chunks.map((chunk) => chunk.content);
    const embeddings = await this.generateBatchEmbeddings(texts);

    return chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index],
    }));
  }

  // ─── Private: OpenAI Embedding ────────────────────────────────────────────

  async _generateOpenAIEmbedding(text) {
    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: config.OPENAI.API_KEY });

    const response = await openai.embeddings.create({
      model: config.OPENAI.EMBEDDING_MODEL,
      input: text.substring(0, 8191), // OpenAI token limit
      encoding_format: 'float',
    });

    return response.data[0].embedding;
  }

  // ─── Private: Gemini Embedding ────────────────────────────────────────────

  async _generateGeminiEmbedding(text) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(config.GEMINI.API_KEY);

    const model = genAI.getGenerativeModel({
      model: 'text-embedding-004',
    });

    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  // ─── Private: Sleep ───────────────────────────────────────────────────────

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = new EmbeddingService();