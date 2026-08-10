'use strict';

const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const PdfDocument = require('../models/PdfDocument.model');
const PdfChunk = require('../models/PdfChunk.model');
const PdfProcessingService = require('../services/pdf/pdfProcessing.service');
const embeddingsService = require('../services/embeddings/embeddings.service');

/**
 * @controller PdfController
 * @description Handles PDF upload, processing, and management.
 */

/**
 * @function uploadPdf
 * @description Upload and process a PDF file
 */
const uploadPdf = asyncHandler(async (req, res) => {
  // Check if file exists
  if (!req.file) {
    console.error('Upload Error: No file uploaded or invalid field name');
    return ApiResponse.error(res, 400, 'No PDF file uploaded or invalid field name');
  }

  const userId = req.user._id; // Use _id instead of id for MongoDB
  
  // ✅ FIX: originalname එක 'originalName' ලෙස destructure කර ගන්නා ලදී
  const { buffer, originalname: originalName, size } = req.file;

  console.log('Upload Request:', {
    userId,
    originalName,
    size,
    mimetype: req.file.mimetype,
  });

  try {
    // Create PDF document record with 'processing' status
    const pdfDocument = await PdfDocument.create({
      userId,
      originalName,
      fileSize: size,
      status: 'processing',
      chunkCount: 0,
    });

    console.log('PDF Document created:', pdfDocument._id);

    try {
      // Process PDF (extract text and chunk)
      const { chunks, chunkCount } = await PdfProcessingService.processPdf(buffer);
      console.log('PDF processed successfully:', { chunkCount });

      // Generate embeddings for chunks
      const embeddings = await embeddingsService.generateBatchEmbeddings(chunks);
      console.log('Embeddings generated successfully:', embeddings.length);

      // Save chunks with embeddings to database
      const chunkDocuments = chunks.map((chunk, index) => ({
        pdfId: pdfDocument._id,
        userId,
        chunkIndex: index,
        text: chunk,
        embedding: embeddings[index],
      }));

      await PdfChunk.insertMany(chunkDocuments);
      console.log('Chunks saved to database:', chunkDocuments.length);

      // Update PDF document status to 'completed'
      pdfDocument.status = 'completed';
      pdfDocument.chunkCount = chunkCount;
      pdfDocument.processedDate = new Date();
      await pdfDocument.save();

      console.log('PDF upload completed successfully');

      return ApiResponse.success(res, 201, 'PDF uploaded and processed successfully', {
        pdfId: pdfDocument._id,
        originalName: pdfDocument.originalName,
        fileSize: pdfDocument.fileSize,
        chunkCount: pdfDocument.chunkCount,
        status: pdfDocument.status,
        uploadDate: pdfDocument.uploadDate,
      });
    } catch (error) {
      console.error('PDF Processing Error:', error);
      
      // Update PDF document status to 'failed' on error
      pdfDocument.status = 'failed';
      pdfDocument.errorMessage = error.message;
      await pdfDocument.save();

      // Clean up any chunks that might have been created
      await PdfChunk.deleteMany({ pdfId: pdfDocument._id });

      throw error;
    }
  } catch (error) {
    console.error('Upload Controller Error:', error);
    throw error;
  }
});

/**
 * @function getPdfs
 * @description Get list of uploaded PDFs for the logged-in user
 */
const getPdfs = asyncHandler(async (req, res) => {
  const userId = req.user._id; // Use _id instead of id for MongoDB
  const { status, page = 1, limit = 10 } = req.query;

  console.log('Get PDFs Request:', { userId, status, page, limit });

  const query = { userId };
  if (status) {
    query.status = status;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [pdfs, total] = await Promise.all([
    PdfDocument.find(query)
      .sort({ uploadDate: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    PdfDocument.countDocuments(query),
  ]);

  return ApiResponse.paginated(
    res,
    200,
    'PDFs retrieved successfully',
    pdfs,
    {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    }
  );
});

/**
 * @function getPdfById
 * @description Get a specific PDF by ID
 */
const getPdfById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id; // Use _id instead of id for MongoDB

  console.log('Get PDF by ID Request:', { id, userId });

  const pdf = await PdfDocument.findOne({ _id: id, userId });

  if (!pdf) {
    console.error('PDF not found:', { id, userId });
    return ApiResponse.error(res, 404, 'PDF not found');
  }

  // Get chunk count
  const chunkCount = await PdfChunk.countDocuments({ pdfId: pdf._id });

  return ApiResponse.success(res, 200, 'PDF retrieved successfully', {
    ...pdf.toObject(),
    chunkCount,
  });
});

/**
 * @function deletePdf
 * @description Delete a PDF and all associated chunks
 */
const deletePdf = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id; // Use _id instead of id for MongoDB

  console.log('Delete PDF Request:', { id, userId });

  const pdf = await PdfDocument.findOne({ _id: id, userId });

  if (!pdf) {
    console.error('PDF not found for deletion:', { id, userId });
    return ApiResponse.error(res, 404, 'PDF not found');
  }

  // Delete all associated chunks
  await PdfChunk.deleteMany({ pdfId: pdf._id });
  console.log('Deleted chunks for PDF:', id);

  // Delete the PDF document
  await PdfDocument.findByIdAndDelete(pdf._id);
  console.log('Deleted PDF document:', id);

  return ApiResponse.success(res, 200, 'PDF deleted successfully');
});

/**
 * @function getPdfChunks
 * @description Get chunks for a specific PDF
 */
const getPdfChunks = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id; // Use _id instead of id for MongoDB
  const { page = 1, limit = 20 } = req.query;

  console.log('Get PDF Chunks Request:', { id, userId, page, limit });

  // Verify PDF ownership
  const pdf = await PdfDocument.findOne({ _id: id, userId });
  if (!pdf) {
    console.error('PDF not found for chunks:', { id, userId });
    return ApiResponse.error(res, 404, 'PDF not found');
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [chunks, total] = await Promise.all([
    PdfChunk.find({ pdfId: id })
      .select('-embedding') // Don't return embeddings in list
      .sort({ chunkIndex: 1 })
      .skip(skip)
      .limit(parseInt(limit)),
    PdfChunk.countDocuments({ pdfId: id }),
  ]);

  return ApiResponse.paginated(
    res,
    200,
    'PDF chunks retrieved successfully',
    chunks,
    {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    }
  );
});

module.exports = {
  uploadPdf,
  getPdfs,
  getPdfById,
  deletePdf,
  getPdfChunks,
};