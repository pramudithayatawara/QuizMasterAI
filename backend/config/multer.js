'use strict';

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const config = require('./env');
const AppError = require('../utils/AppError');

/**
 * @module multerConfig
 * @description Multer configuration for secure PDF file uploads.
 * Validates MIME type, file extension, and file size.
 * Generates unique filenames to prevent conflicts.
 */

// ─── Ensure upload directory exists ─────────────────────────────────────────
const ensureUploadDir = () => {
  if (!fs.existsSync(config.UPLOAD.PATH)) {
    fs.mkdirSync(config.UPLOAD.PATH, { recursive: true });
  }
};

ensureUploadDir();

// ─── Disk storage engine ─────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.UPLOAD.PATH);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp + random hex + original extension
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `pdf-${uniqueSuffix}${ext}`);
  },
});

// ─── File filter ──────────────────────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  // Check MIME type
  const allowedMimeTypes = ['application/pdf'];
  // Check file extension
  const allowedExtensions = ['.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (
    allowedMimeTypes.includes(file.mimetype) &&
    allowedExtensions.includes(ext)
  ) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Invalid file type. Only PDF files are allowed.',
        400,
        'INVALID_FILE_TYPE'
      ),
      false
    );
  }
};

// ─── Multer instance ─────────────────────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.UPLOAD.MAX_FILE_SIZE, // 10MB
    files: 1,                              // Single file per request
    fields: 10,                            // Max form fields
  },
});

module.exports = upload;