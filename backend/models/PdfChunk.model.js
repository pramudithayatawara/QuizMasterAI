'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * @model PdfChunk
 * @description Mongoose schema for storing PDF text chunks with embeddings.
 */
const pdfChunkSchema = new Schema(
  {
    pdfId: {
      type: Schema.Types.ObjectId,
      ref: 'PdfDocument',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    embedding: {
      type: [Number],
      required: true,
    },
    // Vector search index will be created in MongoDB Atlas
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
pdfChunkSchema.index({ pdfId: 1, chunkIndex: 1 });
pdfChunkSchema.index({ userId: 1, pdfId: 1 });

// Create vector search index (for MongoDB Atlas Vector Search)
// This should be created manually in MongoDB Atlas or via a migration script
pdfChunkSchema.index(
  { embedding: 'vectorSearch' },
  {
    name: 'vector_index',
    type: 'vectorSearch',
    dimensions: 384, // Xenova/all-MiniLM-L6-v2 dimensions
  }
);

module.exports = mongoose.model('PdfChunk', pdfChunkSchema);
