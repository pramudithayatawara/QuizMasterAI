'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const ApiResponse = require('../utils/ApiResponse');
const {
  uploadPdf,
  getPdfs,
  getPdfById,
  deletePdf,
  getPdfChunks,
} = require('../controllers/pdf.controller');

/**
 * @router PdfRoutes
 * @baseURL /api/v1/pdfs
 */

// ─── Multer Configuration ───────────────────────────────────────────────────────
const storage = multer.memoryStorage(); // Store in memory for processing

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check MIME type
    if (file.mimetype !== 'application/pdf') {
      return cb(new AppError('Invalid file type. Only PDF files are allowed', 400), false);
    }
    cb(null, true);
  },
});

// Custom Multer error handler
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return ApiResponse.error(res, 400, 'File size exceeds the 10MB limit');
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return ApiResponse.error(res, 400, 'Unexpected field name. Expected "pdf"');
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return ApiResponse.error(res, 400, 'Too many files uploaded. Only one file allowed');
    }
    return ApiResponse.error(res, 400, 'File upload error: ' + err.message);
  }
  next(err);
};

// All routes require authentication
router.use(protect);

// ─── Upload PDF ───────────────────────────────────────────────────────────────
router.post(
  '/upload',
  (req, res, next) => {
    console.log('=== PDF Upload Request ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', Object.keys(req.headers));
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Content-Length:', req.headers['content-length']);
    console.log('Authorization:', req.headers['authorization'] ? 'Present' : 'Missing');
    console.log('User:', req.user);
    console.log('Body keys:', Object.keys(req.body));
    console.log('========================');
    next();
  },
  upload.single('pdf'),
  handleMulterError,
  asyncHandler(uploadPdf)
);

// ─── Get All PDFs ───────────────────────────────────────────────────────────────
router.get(
  '/',
  asyncHandler(getPdfs)
);

// ─── Get PDF by ID ─────────────────────────────────────────────────────────────
router.get(
  '/:id',
  asyncHandler(getPdfById)
);

// ─── Get PDF Chunks ─────────────────────────────────────────────────────────────
router.get(
  '/:id/chunks',
  asyncHandler(getPdfChunks)
);

// ─── Delete PDF ───────────────────────────────────────────────────────────────
router.delete(
  '/:id',
  asyncHandler(deletePdf)
);

module.exports = router;
