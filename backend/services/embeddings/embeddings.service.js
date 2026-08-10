'use strict';

const { pipeline, env } = require('@xenova/transformers');
const AppError = require('../../utils/AppError');

// Configure transformers to use local cache
env.allowLocalModels = true;
env.allowRemoteModels = true;

/**
 * @service EmbeddingsService
 * @description Handles vector embeddings generation for text chunks using local HuggingFace transformers.
 */
class EmbeddingsService {
  constructor() {
    this.embeddingModel = 'Xenova/all-MiniLM-L6-v2';
    this.embeddingDimensions = 384; // all-MiniLM-L6-v2 dimensions
    this.isConfigured = true;
    this.featureExtractor = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the embedding model (lazy loading)
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('Loading local embedding model:', this.embeddingModel);
      this.featureExtractor = await pipeline('feature-extraction', this.embeddingModel);
      this.isInitialized = true;
      console.log('Embedding model loaded successfully');
    } catch (error) {
      console.error('Failed to load embedding model:', error);
      throw new AppError(`Failed to load embedding model: ${error.message}`, 500);
    }
  }

  /**
   * Generate embeddings for a single text chunk using local HuggingFace transformers
   * @param {string} text - Text to embed
   * @returns {Promise<Array<number>>} Embedding vector
   */
  async generateEmbedding(text) {
    await this.initialize();

    try {
      const output = await this.featureExtractor(text, {
        pooling: 'mean',
        normalize: true,
      });

      // Convert tensor to array
      const embedding = Array.from(output.data);
      return embedding;
    } catch (error) {
      console.error('Local Embedding Error:', error.message);
      throw new AppError(`Failed to generate embeddings: ${error.message}`, 500);
    }
  }

  /**
   * Generate embeddings for multiple text chunks in batch
   * @param {Array<string>} texts - Array of texts to embed
   * @returns {Promise<Array<Array<number>>>} Array of embedding vectors
   */
  async generateBatchEmbeddings(texts) {
    await this.initialize();

    try {
      console.log(`Starting batch embedding generation for ${texts.length} texts`);
      const embeddings = [];

      // Process texts one by one (local processing doesn't have rate limits)
      for (let i = 0; i < texts.length; i++) {
        const embedding = await this.generateEmbedding(texts[i]);
        embeddings.push(embedding);

        // Log progress every 10 embeddings
        if ((i + 1) % 10 === 0) {
          console.log(`Progress: ${i + 1}/${texts.length} embeddings generated`);
        }
      }

      console.log(`Successfully generated ${embeddings.length} embeddings`);
      return embeddings;
    } catch (error) {
      console.error('Batch Embedding Error:', error.message);
      console.error('Error details:', error);
      throw new AppError(`Failed to generate batch embeddings: ${error.message}`, 500);
    }
  }

  /**
   * Generate embeddings for text chunks with progress tracking
   * @param {Array<string>} chunks - Array of text chunks
   * @param {Function} onProgress - Progress callback (current, total)
   * @returns {Promise<Array<Array<number>>>} Array of embedding vectors
   */
  async generateEmbeddingsWithProgress(chunks, onProgress) {
    await this.initialize();

    const embeddings = [];
    const total = chunks.length;

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await this.generateEmbedding(chunks[i]);
      embeddings.push(embedding);
      
      if (onProgress) {
        onProgress(i + 1, total);
      }
    }

    return embeddings;
  }
}

module.exports = new EmbeddingsService();
