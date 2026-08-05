'use strict';

const path = require('path');
const fs = require('fs');
const config = require('../../config/env');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

/**
 * @service VectorStoreService
 * @description Manages FAISS vector store for similarity search.
 * Stores chunk embeddings and performs similarity retrieval.
 * Each PDF gets its own vector index file.
 *
 * @note Falls back to in-memory cosine similarity if FAISS unavailable.
 */

class VectorStoreService {
  constructor() {
    this.storePath = config.VECTOR_STORE.PATH;
    this.dimension = config.VECTOR_STORE.DIMENSION;
    this._ensureStorePath();
  }

  /**
   * @method buildIndex
   * @description Build FAISS index from chunk embeddings and save to disk.
   * @param {string} pdfId - PDF document ID
   * @param {Array} chunks - Chunks with embeddings
   * @returns {string} Path to saved index
   */
  async buildIndex(pdfId, chunks) {
    const indexPath = this._getIndexPath(pdfId);

    // Filter chunks with valid embeddings
    const validChunks = chunks.filter(
      (c) => c.embedding && c.embedding.length > 0
    );

    if (validChunks.length === 0) {
      throw new AppError(
        'No valid embeddings found to build index.',
        500,
        'NO_EMBEDDINGS'
      );
    }

    try {
      // Try FAISS first
      const faissNode = require('faiss-node');
      const dimension = validChunks[0].embedding.length;

      const index = new faissNode.IndexFlatL2(dimension);

      // Add all embeddings to index
      const vectors = validChunks.flatMap((chunk) => chunk.embedding);
      index.add(vectors);

      // Save index to disk
      index.write(indexPath + '.faiss');

      // Save chunk metadata separately (FAISS only stores vectors)
      const metadata = validChunks.map((chunk) => ({
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        pageNumber: chunk.pageNumber,
      }));

      fs.writeFileSync(
        indexPath + '.meta.json',
        JSON.stringify(metadata, null, 2)
      );

      logger.info(
        `FAISS index built: ${validChunks.length} vectors, dim=${dimension}`
      );

      return indexPath;
    } catch (faissError) {
      logger.warn(`FAISS not available, using JSON fallback: ${faissError.message}`);

      // Fallback: Save embeddings as JSON for cosine similarity search
      const indexData = {
        dimension: validChunks[0]?.embedding?.length || 0,
        chunks: validChunks.map((chunk) => ({
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          pageNumber: chunk.pageNumber,
          embedding: chunk.embedding,
        })),
        createdAt: new Date().toISOString(),
      };

      fs.writeFileSync(
        indexPath + '.json',
        JSON.stringify(indexData)
      );

      logger.info(
        `JSON vector store saved: ${validChunks.length} chunks`
      );

      return indexPath;
    }
  }

  /**
   * @method similaritySearch
   * @description Find top-K most similar chunks for a query embedding.
   * @param {string} pdfId - PDF document ID
   * @param {number[]} queryEmbedding - Query vector
   * @param {number} topK - Number of results to return
   * @returns {Array} Top-K similar chunks with scores
   */
  async similaritySearch(pdfId, queryEmbedding, topK = 5) {
    const indexPath = this._getIndexPath(pdfId);

    // Try FAISS index first
    const faissPath = indexPath + '.faiss';
    const metaPath = indexPath + '.meta.json';
    const jsonPath = indexPath + '.json';

    if (fs.existsSync(faissPath) && fs.existsSync(metaPath)) {
      return this._searchFAISS(
        faissPath,
        metaPath,
        queryEmbedding,
        topK
      );
    }

    if (fs.existsSync(jsonPath)) {
      return this._searchJSON(jsonPath, queryEmbedding, topK);
    }

    throw new AppError(
      'Vector index not found for this PDF. Please reprocess the PDF.',
      404,
      'INDEX_NOT_FOUND'
    );
  }

  /**
   * @method deleteIndex
   * @description Delete vector index for a PDF.
   */
  async deleteIndex(pdfId) {
    const indexPath = this._getIndexPath(pdfId);
    const files = [
      indexPath + '.faiss',
      indexPath + '.meta.json',
      indexPath + '.json',
    ];

    files.forEach((file) => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        logger.info(`Deleted vector index: ${file}`);
      }
    });
  }

  /**
   * @method indexExists
   * @description Check if vector index exists for a PDF.
   */
  indexExists(pdfId) {
    const indexPath = this._getIndexPath(pdfId);
    return (
      fs.existsSync(indexPath + '.faiss') ||
      fs.existsSync(indexPath + '.json')
    );
  }

  // ─── Private: FAISS Search ────────────────────────────────────────────────

  async _searchFAISS(faissPath, metaPath, queryEmbedding, topK) {
    try {
      const faissNode = require('faiss-node');
      const index = faissNode.Index.read(faissPath);
      const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

      const results = index.search(queryEmbedding, Math.min(topK, metadata.length));

      return results.labels.map((label, i) => ({
        ...metadata[label],
        score: 1 - results.distances[i], // Convert L2 distance to similarity
        rank: i + 1,
      })).filter((r) => r.score > 0);
    } catch (error) {
      logger.error(`FAISS search error: ${error.message}`);
      throw new AppError('Vector search failed.', 500);
    }
  }

  // ─── Private: JSON Cosine Similarity Search ───────────────────────────────

  _searchJSON(jsonPath, queryEmbedding, topK) {
    const indexData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // Calculate cosine similarity for each chunk
    const results = indexData.chunks.map((chunk) => ({
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      pageNumber: chunk.pageNumber,
      score: this._cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    // Sort by similarity descending
    results.sort((a, b) => b.score - a.score);

    // Return top K
    return results.slice(0, topK).map((r, i) => ({
      ...r,
      rank: i + 1,
    }));
  }

  // ─── Private: Cosine Similarity ───────────────────────────────────────────

  _cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  _getIndexPath(pdfId) {
    return path.join(this.storePath, `pdf_${pdfId}`);
  }

  _ensureStorePath() {
    if (!fs.existsSync(this.storePath)) {
      fs.mkdirSync(this.storePath, { recursive: true });
    }
  }
}

module.exports = new VectorStoreService();