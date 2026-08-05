'use strict';

const express = require('express');
const router = express.Router();

const pdfController = require('../controllers/pdf.controller');
const pdfValidator = require('../validators/pdf.validator');
const { validate } = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware');
const { uploadPDF } = require('../middleware/upload.middleware');
const { uploadRateLimit } = require('../middleware/rateLimiter.middleware');

/**
 * @router PDFRoutes
 * @baseURL /api/v1/pdf
 *
 * All routes require authentication.
 *
 * POST   /upload          - Upload new PDF
 * GET    /                - Get all user PDFs
 * GET    /:id             - Get single PDF
 * GET    /:id/status      - Get processing status
 * POST   /:id/process     - Retry processing
 * DELETE /:id             - Delete PDF
 */

// All routes require authentication
router.use(protect);

// Upload PDF
router.post(
  '/upload',
  uploadRateLimit,
  uploadPDF,
  pdfController.upload
);

// Get all PDFs
router.get(
  '/',
  pdfValidator.list,
  validate,
  pdfController.getAll
);

// Get PDF by ID
router.get(
  '/:id',
  pdfValidator.getById,
  validate,
  pdfController.getById
);

// Get processing status
router.get(
  '/:id/status',
  pdfValidator.getById,
  validate,
  pdfController.getStatus
);

// Retry processing
router.post(
  '/:id/process',
  pdfValidator.getById,
  validate,
  pdfController.reprocess
);

// Delete PDF
router.delete(
  '/:id',
  pdfValidator.deleteById,
  validate,
  pdfController.deleteById
);

module.exports = router;