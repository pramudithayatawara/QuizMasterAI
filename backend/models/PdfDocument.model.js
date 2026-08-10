'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * @model PdfDocument
 * @description Mongoose schema for storing PDF document metadata.
 */
const pdfDocumentSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
      required: true,
    },
    chunkCount: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    uploadDate: {
      type: Date,
      default: Date.now,
    },
    processedDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
pdfDocumentSchema.index({ userId: 1, uploadDate: -1 });
pdfDocumentSchema.index({ status: 1 });

module.exports = mongoose.model('PdfDocument', pdfDocumentSchema);
