'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');

class EmbeddingsService {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured in .env file.');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    // ✅ FIX: Gemini v1 API එකේ Standard Stable Embedding Model එක 'embedding-001' යි
    this.model = this.genAI.getGenerativeModel({ model: 'embedding-001' });
  }

  /**
   * Single text chunk එකකට embedding එකක් generate කිරීම
   */
  async generateEmbedding(text) {
    try {
      const result = await this.model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error('Error generating Gemini embedding:', error);
      throw new Error(`Gemini Embedding Error: ${error.message}`);
    }
  }

  /**
   * Chunks array එකකටම එකපාර batch embeddings generate කිරීම
   */
  async generateBatchEmbeddings(chunks) {
    try {
      console.log(`Generating embeddings for ${chunks.length} chunks using Gemini...`);
      const embeddings = [];

      for (const chunk of chunks) {
        const embedding = await this.generateEmbedding(chunk);
        embeddings.push(embedding);
      }

      return embeddings;
    } catch (error) {
      console.error('Error in generateBatchEmbeddings:', error);
      throw error;
    }
  }
}

module.exports = new EmbeddingsService();