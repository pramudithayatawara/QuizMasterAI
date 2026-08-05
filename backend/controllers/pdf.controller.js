'use strict';

const pdfService = require('../services/pdf/pdf.service');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @controller PDFController
 * @description Handles PDF upload and management HTTP requests.
 */

class PDFController {
  /**
   * @route   POST /api/v1/pdf/upload
   * @desc    Upload and process PDF
   * @access  Private
   */
  upload = asyncHandler(async (req, res) => {
    const result = await pdfService.uploadAndProcess(
      req.file,
      req.user._id
    );

    return ApiResponse.success(
      res,
      201,
      'PDF uploaded successfully! Processing has started in the background.',
      {
        pdf: {
          id: result._id,
          originalName: result.originalName,
          fileSize: result.fileSize,
          status: result.status,
          createdAt: result.createdAt,
        },
        message: 'You will be notified when the PDF is ready for quiz generation.',
      }
    );
  });

  /**
   * @route   GET /api/v1/pdf
   * @desc    Get all PDFs for current user
   * @access  Private
   */
  getAll = asyncHandler(async (req, res) => {
    const { pdfs, pagination } = await pdfService.getAll(
      req.user._id,
      req.query
    );

    return ApiResponse.paginated(
      res,
      200,
      'PDFs retrieved successfully.',
      pdfs,
      pagination
    );
  });

  /**
   * @route   GET /api/v1/pdf/:id
   * @desc    Get single PDF by ID
   * @access  Private
   */
  getById = asyncHandler(async (req, res) => {
    const pdf = await pdfService.getById(req.params.id, req.user._id);

    return ApiResponse.success(res, 200, 'PDF retrieved successfully.', {
      pdf,
    });
  });

  /**
   * @route   GET /api/v1/pdf/:id/status
   * @desc    Get PDF processing status
   * @access  Private
   */
  getStatus = asyncHandler(async (req, res) => {
    const status = await pdfService.getProcessingStatus(
      req.params.id,
      req.user._id
    );

    return ApiResponse.success(
      res,
      200,
      'PDF status retrieved successfully.',
      { status }
    );
  });

  /**
   * @route   POST /api/v1/pdf/:id/process
   * @desc    Retry processing for failed PDF
   * @access  Private
   */
  reprocess = asyncHandler(async (req, res) => {
    const result = await pdfService.processExisting(
      req.params.id,
      req.user._id
    );

    return ApiResponse.success(
      res,
      200,
      'PDF reprocessing started.',
      result
    );
  });

  /**
   * @route   DELETE /api/v1/pdf/:id
   * @desc    Delete PDF
   * @access  Private
   */
  deleteById = asyncHandler(async (req, res) => {
    const result = await pdfService.deleteById(
      req.params.id,
      req.user._id
    );

    return ApiResponse.success(res, 200, result.message);
  });
}

module.exports = new PDFController();