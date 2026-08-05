'use strict';

const fs = require('fs');
const path = require('path');
const PDF = require('../../models/PDF.model');
const pdfParserService = require('./pdfParser.service');
const chunkerService = require('./chunker.service');
const embeddingService = require('../../services/rag/embedding.service');
const vectorStoreService = require('../../services/rag/vectorStore.service');
const GamificationProfile = require('../../models/GamificationProfile.model');
const { XP_REWARDS } = require('../../constants/gamification');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const {
  getPaginationParams,
  buildPaginationMeta,
} = require('../../helpers/pagination.helper');

/**
 * @service PDFService
 * @description Core PDF management service.
 * Handles upload, processing pipeline, retrieval, and deletion.
 *
 * Processing Pipeline:
 * Upload → Validate → Extract Text → Chunk → Embed → Vectorize → Ready
 */

class PDFService {
  /**
   * @method uploadAndProcess
   * @description Handle PDF upload and trigger async processing.
   * @param {object} file - Multer file object
   * @param {string} userId - Owner user ID
   * @returns {object} Created PDF document
   */
  async uploadAndProcess(file, userId) {
    // Create PDF record in database
    const pdf = await PDF.create({
      userId,
      originalName: file.originalname,
      storedName: file.filename,
      filePath: file.path,
      fileSize: file.size,
      mimeType: file.mimetype,
      status: 'uploaded',
    });

    logger.info(
      `PDF uploaded: ${file.originalname} | ID: ${pdf._id} | User: ${userId}`
    );

    // Trigger async processing (don't await - return immediately)
    this._processInBackground(pdf._id, file.path).catch((err) => {
      logger.error(`Background PDF processing failed: ${err.message}`);
    });

    // Award XP for upload
    await GamificationProfile.findOneAndUpdate(
      { userId },
      {
        $inc: {
          totalXP: XP_REWARDS.PDF_UPLOAD,
          totalPoints: XP_REWARDS.PDF_UPLOAD,
          totalUploads: 1,
        },
      }
    );

    return pdf;
  }

  /**
   * @method processExisting
   * @description Manually trigger processing for an existing PDF.
   * Used for retry after failure.
   */
  async processExisting(pdfId, userId) {
    const pdf = await PDF.findOne({ _id: pdfId, userId });

    if (!pdf) {
      throw new AppError('PDF not found.', 404, 'PDF_NOT_FOUND');
    }

    if (pdf.status === 'processing') {
      throw new AppError(
        'PDF is already being processed.',
        409,
        'ALREADY_PROCESSING'
      );
    }

    if (pdf.status === 'ready') {
      throw new AppError(
        'PDF is already processed and ready.',
        409,
        'ALREADY_READY'
      );
    }

    // Reset status
    await pdf.markAsProcessing();

    // Trigger processing
    this._processInBackground(pdf._id, pdf.filePath).catch((err) => {
      logger.error(`Retry PDF processing failed: ${err.message}`);
    });

    return { message: 'PDF processing started.', pdfId };
  }

  /**
   * @method getAll
   * @description Get all PDFs for a user with pagination.
   */
  async getAll(userId, query = {}) {
    const { page, limit, skip } = getPaginationParams(query);
    const filter = { userId };

    if (query.status) {
      filter.status = query.status;
    }

    const [pdfs, total] = await Promise.all([
      PDF.find(filter)
        .select('-extractedText -chunks')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PDF.countDocuments(filter),
    ]);

    return {
      pdfs,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  /**
   * @method getById
   * @description Get a specific PDF by ID.
   */
  async getById(pdfId, userId) {
    const pdf = await PDF.findOne({ _id: pdfId, userId })
      .select('-extractedText -chunks');

    if (!pdf) {
      throw new AppError('PDF not found.', 404, 'PDF_NOT_FOUND');
    }

    return pdf;
  }

  /**
   * @method getWithChunks
   * @description Get PDF with chunks (for RAG pipeline).
   */
  async getWithChunks(pdfId, userId) {
    const pdf = await PDF.findOne({ _id: pdfId, userId });

    if (!pdf) {
      throw new AppError('PDF not found.', 404, 'PDF_NOT_FOUND');
    }

    if (!pdf.isReady) {
      throw new AppError(
        'PDF is not ready for quiz generation. Please wait for processing to complete.',
        400,
        'PDF_NOT_READY'
      );
    }

    return pdf;
  }

  /**
   * @method deleteById
   * @description Soft delete PDF and remove associated files.
   */
  async deleteById(pdfId, userId) {
    const pdf = await PDF.findOne({ _id: pdfId, userId });

    if (!pdf) {
      throw new AppError('PDF not found.', 404, 'PDF_NOT_FOUND');
    }

    // Soft delete from database
    await pdf.softDelete();

    // Delete physical file (async, non-blocking)
    this._deletePhysicalFile(pdf.filePath).catch((err) => {
      logger.warn(`File deletion failed: ${err.message}`);
    });

    // Delete vector index
    vectorStoreService.deleteIndex(pdfId.toString()).catch((err) => {
      logger.warn(`Vector index deletion failed: ${err.message}`);
    });

    logger.info(`PDF deleted: ${pdfId} by user: ${userId}`);

    return { message: 'PDF deleted successfully.' };
  }

  /**
   * @method getProcessingStatus
   * @description Get current processing status of a PDF.
   */
  async getProcessingStatus(pdfId, userId) {
    const pdf = await PDF.findOne({ _id: pdfId, userId })
      .select('status isVectorized totalPages totalChunks processingError processedAt');

    if (!pdf) {
      throw new AppError('PDF not found.', 404, 'PDF_NOT_FOUND');
    }

    return {
      status: pdf.status,
      isVectorized: pdf.isVectorized,
      totalPages: pdf.totalPages,
      totalChunks: pdf.totalChunks,
      error: pdf.processingError,
      processedAt: pdf.processedAt,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PRIVATE: Background Processing Pipeline
  // ═══════════════════════════════════════════════════════════════

  /**
   * @private _processInBackground
   * @description Full PDF processing pipeline.
   * Runs asynchronously after upload.
   *
   * Steps:
   * 1. Mark as processing
   * 2. Extract text
   * 3. Chunk text
   * 4. Generate embeddings
   * 5. Build vector index
   * 6. Save to database
   * 7. Mark as ready
   */
  async _processInBackground(pdfId, filePath) {
    logger.info(`Starting PDF processing pipeline: ${pdfId}`);

    try {
      // Step 1: Mark as processing
      const pdf = await PDF.findById(pdfId);
      if (!pdf) throw new Error('PDF record not found');

      await pdf.markAsProcessing();

      // Step 2: Extract text from PDF
      logger.info(`[${pdfId}] Extracting text...`);
      const extracted = await pdfParserService.extractText(filePath);

      // Step 3: Chunk the extracted text
      logger.info(`[${pdfId}] Chunking text...`);
      const chunks = chunkerService.chunkText(extracted.text);

      if (chunks.length === 0) {
        throw new Error('No chunks generated from PDF text');
      }

      // Step 4: Generate embeddings for each chunk
      logger.info(`[${pdfId}] Generating embeddings for ${chunks.length} chunks...`);
      const chunksWithEmbeddings = await embeddingService.generateChunkEmbeddings(chunks);

      // Step 5: Build and save vector index
      logger.info(`[${pdfId}] Building vector index...`);
      const indexPath = await vectorStoreService.buildIndex(
        pdfId.toString(),
        chunksWithEmbeddings
      );

      // Step 6: Update PDF record with all data
      logger.info(`[${pdfId}] Saving to database...`);

      // Store chunks without embeddings in MongoDB (embeddings in vector store)
      const chunksForDB = chunksWithEmbeddings.map((chunk) => ({
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        pageNumber: chunk.pageNumber,
        embedding: [], // Don't store embeddings in MongoDB (too large)
      }));

      await PDF.findByIdAndUpdate(pdfId, {
        extractedText: extracted.text,
        totalPages: extracted.totalPages,
        totalWords: extracted.totalWords,
        chunks: chunksForDB,
        totalChunks: chunks.length,
        status: 'ready',
        isVectorized: true,
        vectorIndexPath: indexPath,
        processedAt: new Date(),
        processingError: null,
      });

      logger.info(
        `✅ PDF processing complete: ${pdfId} | ` +
        `Pages: ${extracted.totalPages} | ` +
        `Words: ${extracted.totalWords} | ` +
        `Chunks: ${chunks.length}`
      );
    } catch (error) {
      logger.error(`❌ PDF processing failed [${pdfId}]: ${error.message}`);

      // Mark as failed with error message
      await PDF.findByIdAndUpdate(pdfId, {
        status: 'failed',
        processingError: error.message,
      }).catch((updateErr) => {
        logger.error(`Failed to update PDF status: ${updateErr.message}`);
      });
    }
  }

  /**
   * @private _deletePhysicalFile
   * @description Delete uploaded file from disk.
   */
  async _deletePhysicalFile(filePath) {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`Physical file deleted: ${filePath}`);
    }
  }
}

module.exports = new PDFService();