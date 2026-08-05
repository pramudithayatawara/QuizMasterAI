'use strict';

const logger = require('../../utils/logger');

/**
 * @service ChunkerService
 * @description Splits extracted PDF text into overlapping chunks.
 * Uses token-based chunking for optimal RAG performance.
 *
 * Strategy:
 * - Chunk size: 512 tokens (~400 words)
 * - Overlap: 50 tokens (~40 words) for context continuity
 * - Sentence-aware: tries to split at sentence boundaries
 */

class ChunkerService {
  constructor() {
    this.CHUNK_SIZE = 512;      // Tokens per chunk
    this.CHUNK_OVERLAP = 50;    // Overlap tokens
    this.AVG_CHARS_PER_TOKEN = 4; // Approximate chars per token
  }

  /**
   * @method chunkText
   * @description Split text into overlapping chunks.
   * @param {string} text - Extracted PDF text
   * @param {object} options - Custom chunk size/overlap
   * @returns {Array} Array of chunk objects
   */
  chunkText(text, options = {}) {
    const chunkSize = options.chunkSize || this.CHUNK_SIZE;
    const overlap = options.overlap || this.CHUNK_OVERLAP;

    if (!text || text.trim().length === 0) {
      return [];
    }

    // Convert token counts to character counts
    const chunkSizeChars = chunkSize * this.AVG_CHARS_PER_TOKEN;
    const overlapChars = overlap * this.AVG_CHARS_PER_TOKEN;

    // Split into sentences first (sentence-aware chunking)
    const sentences = this._splitIntoSentences(text);

    const chunks = [];
    let currentChunk = '';
    let chunkIndex = 0;
    let charPosition = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];

      // If adding this sentence exceeds chunk size
      if (
        currentChunk.length + sentence.length > chunkSizeChars &&
        currentChunk.length > 0
      ) {
        // Save current chunk
        chunks.push(this._createChunk(
          currentChunk.trim(),
          chunkIndex,
          charPosition
        ));

        chunkIndex++;

        // Create overlap by keeping last N characters
        const overlapText = currentChunk.slice(-overlapChars);
        currentChunk = overlapText + ' ' + sentence;
        charPosition += currentChunk.length - overlapText.length;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    // Add final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(this._createChunk(
        currentChunk.trim(),
        chunkIndex,
        charPosition
      ));
    }

    logger.info(`Text chunked: ${chunks.length} chunks from ${text.length} chars`);

    return chunks;
  }

  /**
   * @method chunkByPages
   * @description Alternative: chunk by page boundaries.
   * Used when page structure is important.
   */
  chunkByPages(text, pageDelimiter = '\f') {
    const pages = text.split(pageDelimiter);
    const chunks = [];

    pages.forEach((pageContent, pageIndex) => {
      const cleaned = pageContent.trim();
      if (cleaned.length > 0) {
        // If page is too large, sub-chunk it
        if (cleaned.length > this.CHUNK_SIZE * this.AVG_CHARS_PER_TOKEN) {
          const subChunks = this.chunkText(cleaned);
          subChunks.forEach((chunk) => {
            chunks.push({
              ...chunk,
              pageNumber: pageIndex + 1,
              chunkIndex: chunks.length,
            });
          });
        } else {
          chunks.push(this._createChunk(
            cleaned,
            chunks.length,
            0,
            pageIndex + 1
          ));
        }
      }
    });

    return chunks;
  }

  /**
   * @method estimateTokenCount
   * @description Estimate token count for a text string.
   */
  estimateTokenCount(text) {
    return Math.ceil(text.length / this.AVG_CHARS_PER_TOKEN);
  }

  /**
   * @private _createChunk
   */
  _createChunk(content, chunkIndex, charPosition = 0, pageNumber = null) {
    return {
      chunkIndex,
      content,
      tokenCount: this.estimateTokenCount(content),
      charStart: charPosition,
      charEnd: charPosition + content.length,
      pageNumber,
      embedding: [], // Will be populated by embedding service
    };
  }

  /**
   * @private _splitIntoSentences
   * @description Split text into sentences using regex.
   */
  _splitIntoSentences(text) {
    // Split on sentence endings but preserve the delimiter
    const sentenceRegex = /(?<=[.!?])\s+(?=[A-Z])/g;
    const sentences = text
      .split(sentenceRegex)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // If no sentences found, split by newlines
    if (sentences.length <= 1) {
      return text
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    return sentences;
  }
}

module.exports = new ChunkerService();