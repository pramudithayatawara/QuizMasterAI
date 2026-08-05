'use strict';

const upload = require('../config/multer');
const AppError = require('../utils/AppError');
const fs = require('fs');
const path = require('path');

/**
 * @module uploadMiddleware
 * @description PDF upload middleware with magic byte validation.
 * Validates PDF file signature (magic bytes) in addition to MIME type.
 */

// PDF magic bytes: %PDF-
const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D]);

/**
 * @function validatePDFMagicBytes
 * @description Reads first 5 bytes of file to verify it's a real PDF.
 * Prevents malicious files with .pdf extension but different content.
 */
const validatePDFMagicBytes = async (filePath) => {
  const buffer = Buffer.alloc(5);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, 5, 0);
  fs.closeSync(fd);

  return buffer.equals(PDF_MAGIC_BYTES);
};

/**
 * @function uploadPDF
 * @description Complete PDF upload middleware chain.
 */
const uploadPDF = [
  // Step 1: Multer handles the upload
  (req, res, next) => {
    upload.single('pdf')(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  },

  // Step 2: Ensure file was uploaded
  (req, res, next) => {
    if (!req.file) {
      return next(new AppError('Please upload a PDF file.', 400, 'NO_FILE'));
    }
    next();
  },

  // Step 3: Validate magic bytes (async)
  async (req, res, next) => {
    try {
      const isValidPDF = await validatePDFMagicBytes(req.file.path);

      if (!isValidPDF) {
        // Remove invalid file
        fs.unlinkSync(req.file.path);
        return next(
          new AppError(
            'File is not a valid PDF. File content does not match PDF format.',
            400,
            'INVALID_PDF_CONTENT'
          )
        );
      }
      next();
    } catch (error) {
      // Clean up file if validation fails
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      next(new AppError('File validation failed.', 500));
    }
  },
];

module.exports = { uploadPDF };