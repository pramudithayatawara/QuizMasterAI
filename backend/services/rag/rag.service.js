'use strict';

const embeddingService = require('./embedding.service');
const vectorStoreService = require('./vectorStore.service');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

/**
 * @service RAGService
 * @description Retrieval-Augmented Generation core service.
 * Handles similarity search and context assembly.
 *
 * RAG Pipeline:
 * Query → Embed → Search → Retrieve → Assemble Context
 */

class RAGService {
  constructor() {
    this.TOP_K = 5;                    // Top chunks to retrieve
    this.MAX_CONTEXT_LENGTH = 6000;    // Max context chars for LLM
    this.MIN_SIMILARITY_SCORE = 0.3;   // Minimum relevance threshold
  }

  /**
   * @method retrieveContext
   * @description Retrieve relevant context for quiz generation.
   * @param {string} pdfId - PDF document ID
   * @param {string} query - Query for similarity search
   * @param {number} topK - Number of chunks to retrieve
   * @returns {object} { context, chunks, chunkIndices }
   */
  async retrieveContext(pdfId, query, topK = this.TOP_K) {
    try {
      // Generate query embedding
      logger.info(`[RAG] Generating query embedding for PDF: ${pdfId}`);
      const queryEmbedding = await embeddingService.generateEmbedding(query);

      // Search vector store
      logger.info(`[RAG] Searching vector store...`);
      const results = await vectorStoreService.similaritySearch(
        pdfId,
        queryEmbedding,
        topK
      );

      // Filter by minimum similarity score
      const relevant = results.filter(
        (r) => r.score >= this.MIN_SIMILARITY_SCORE
      );

      if (relevant.length === 0) {
        logger.warn('[RAG] No relevant chunks found above threshold');
        // Return all results if none meet threshold
        return this._assembleContext(results);
      }

      logger.info(
        `[RAG] Retrieved ${relevant.length} relevant chunks`
      );

      return this._assembleContext(relevant);
    } catch (error) {
      logger.error(`[RAG] Context retrieval failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * @method retrieveContextForGeneration
   * @description Retrieve context optimized for quiz question generation.
   * Uses multiple queries for better coverage.
   * @param {object} pdf - PDF document with chunks
   * @param {string} difficulty - Target difficulty level
   * @returns {object} Assembled context
   */
  async retrieveContextForGeneration(pdf, difficulty) {
    // Build queries based on difficulty
    const queries = this._buildQueriesForDifficulty(difficulty);

    const allChunks = new Map(); // Use map to deduplicate by chunkIndex

    // Retrieve for each query
    for (const query of queries) {
      try {
        const result = await this.retrieveContext(
          pdf._id.toString(),
          query,
          3
        );

        // Add to map (deduplication)
        result.chunks.forEach((chunk) => {
          if (!allChunks.has(chunk.chunkIndex)) {
            allChunks.set(chunk.chunkIndex, chunk);
          }
        });
      } catch (error) {
        logger.warn(`[RAG] Query failed: ${query} | ${error.message}`);
      }
    }

    // If no chunks retrieved via similarity, use sequential chunks
    if (allChunks.size === 0 && pdf.chunks && pdf.chunks.length > 0) {
      logger.warn('[RAG] Falling back to sequential chunk selection');
      return this._selectSequentialChunks(pdf.chunks);
    }

    const chunksArray = Array.from(allChunks.values());
    return this._assembleContext(chunksArray);
  }

  /**
   * @method buildContextFromChunks
   * @description Build context string from chunk array directly.
   * Used when vector search is not available.
   */
  buildContextFromChunks(chunks, maxLength = this.MAX_CONTEXT_LENGTH) {
    let context = '';
    const usedChunks = [];

    for (const chunk of chunks) {
      const content = chunk.content || '';
      if (context.length + content.length <= maxLength) {
        context += `\n\n${content}`;
        usedChunks.push(chunk.chunkIndex);
      } else {
        break;
      }
    }

    return {
      context: context.trim(),
      chunkIndices: usedChunks,
      chunks,
    };
  }

  // ─── Private Methods ───────────────────────────────────────────────────────

  /**
   * @private _assembleContext
   * @description Combine retrieved chunks into context string.
   */
  _assembleContext(chunks) {
    // Sort by chunk index for coherent reading order
    const sorted = [...chunks].sort(
      (a, b) => a.chunkIndex - b.chunkIndex
    );

    let context = '';
    const chunkIndices = [];
    let totalLength = 0;

    for (const chunk of sorted) {
      const content = chunk.content || '';

      if (totalLength + content.length <= this.MAX_CONTEXT_LENGTH) {
        context += `\n\n${content}`;
        chunkIndices.push(chunk.chunkIndex);
        totalLength += content.length;
      } else {
        break;
      }
    }

    return {
      context: context.trim(),
      chunkIndices,
      chunks: sorted,
      totalChunks: sorted.length,
    };
  }

  /**
   * @private _buildQueriesForDifficulty
   * @description Build retrieval queries based on target difficulty.
   */
  _buildQueriesForDifficulty(difficulty) {
    const baseQueries = [
      'main concepts and key ideas',
      'definitions and terminology',
      'important facts and principles',
    ];

    const difficultyQueries = {
      easy: [
        'basic facts and simple definitions',
        'fundamental concepts introduction',
      ],
      medium: [
        'application of concepts and procedures',
        'relationships between concepts',
        'examples and case studies',
      ],
      hard: [
        'complex analysis and evaluation criteria',
        'synthesis of multiple concepts',
        'critical thinking and problem solving',
      ],
    };

    return [
      ...baseQueries,
      ...(difficultyQueries[difficulty] || difficultyQueries.medium),
    ];
  }

  /**
   * @private _selectSequentialChunks
   * @description Select chunks sequentially when similarity search fails.
   */
  _selectSequentialChunks(chunks, count = 5) {
    const selected = chunks.slice(0, count);
    return this._assembleContext(selected);
  }
}

module.exports = new RAGService();