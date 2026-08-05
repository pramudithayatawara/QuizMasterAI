'use strict';

const mongoose = require('mongoose');

/**
 * @model PDF
 * @description Represents uploaded PDF documents.
 * Stores file metadata, extracted text, chunks,
 * and vector index reference for RAG pipeline.
 */

const chunkSchema = new mongoose.Schema(
  {
    chunkIndex: { type: Number, required: true },
    content: { type: String, required: true },
    tokenCount: { type: Number, default: 0 },
    pageNumber: { type: Number, default: null },
    embedding: { type: [Number], default: [] }, // Vector embedding
  },
  { _id: false }
);

const pdfSchema = new mongoose.Schema(
  {
    // ─── Ownership ──────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ─── File Info ──────────────────────────────────────────────
    originalName: {
      type: String,
      required: true,
      trim: true,
    },

    storedName: {
      type: String,
      required: true,
      unique: true,
    },

    filePath: {
      type: String,
      required: true,
    },

    fileSize: {
      type: Number,
      required: true,
      max: [10485760, 'File size cannot exceed 10MB'],
    },

    mimeType: {
      type: String,
      default: 'application/pdf',
    },

    // ─── Content ────────────────────────────────────────────────
    extractedText: {
      type: String,
      default: null,
    },

    totalPages: {
      type: Number,
      default: 0,
    },

    totalWords: {
      type: Number,
      default: 0,
    },

    // ─── Chunking ───────────────────────────────────────────────
    chunks: {
      type: [chunkSchema],
      default: [],
    },

    totalChunks: {
      type: Number,
      default: 0,
    },

    // ─── Vector Store ───────────────────────────────────────────
    vectorIndexPath: {
      type: String,
      default: null,
    },

    isVectorized: {
      type: Boolean,
      default: false,
    },

    // ─── Processing Status ──────────────────────────────────────
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'ready', 'failed'],
      default: 'uploaded',
      index: true,
    },

    processingError: {
      type: String,
      default: null,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    // ─── Soft Delete ────────────────────────────────────────────
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        // Don't expose full extracted text in list views
        delete ret.extractedText;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
pdfSchema.index({ userId: 1, deletedAt: 1 });
pdfSchema.index({ userId: 1, status: 1 });
pdfSchema.index({ createdAt: -1 });

// ─── Query Filters ───────────────────────────────────────────────────────────
pdfSchema.pre(/^find/, function (next) {
  this.where({ deletedAt: null });
  next();
});

// ─── Virtuals ────────────────────────────────────────────────────────────────
pdfSchema.virtual('fileSizeMB').get(function () {
  return (this.fileSize / 1048576).toFixed(2);
});

pdfSchema.virtual('isReady').get(function () {
  return this.status === 'ready' && this.isVectorized;
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

pdfSchema.methods.softDelete = function () {
  return this.updateOne({ deletedAt: new Date() });
};

pdfSchema.methods.markAsProcessing = function () {
  return this.updateOne({ status: 'processing' });
};

pdfSchema.methods.markAsReady = function (vectorPath) {
  return this.updateOne({
    status: 'ready',
    isVectorized: true,
    vectorIndexPath: vectorPath,
    processedAt: new Date(),
  });
};

pdfSchema.methods.markAsFailed = function (error) {
  return this.updateOne({
    status: 'failed',
    processingError: error,
  });
};

const PDF = mongoose.model('PDF', pdfSchema);
module.exports = PDF;