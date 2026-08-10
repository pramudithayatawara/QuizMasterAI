# PDF Processing Module - Complete Implementation

## Overview
This module implements a complete RAG-based PDF processing system for the QuizAI educational app. It handles PDF upload, validation, text extraction, chunking, embeddings generation, and vector storage.

## 📁 Files Created

### 1. Database Models

#### `models/PdfDocument.model.js`
- **Schema Fields:**
  - `userId` (ObjectId, ref User) - User who uploaded the PDF
  - `originalName` (String) - Original filename
  - `fileSize` (Number) - File size in bytes
  - `status` (String, enum: 'processing', 'completed', 'failed')
  - `chunkCount` (Number) - Number of chunks created
  - `errorMessage` (String) - Error message if processing failed
  - `uploadDate` (Date) - Upload timestamp
  - `processedDate` (Date) - Processing completion timestamp

- **Indexes:**
  - Compound index on `{ userId: 1, uploadDate: -1 }`
  - Index on `{ status: 1 }`

#### `models/PdfChunk.model.js`
- **Schema Fields:**
  - `pdfId` (ObjectId, ref PdfDocument) - Parent PDF document
  - `userId` (ObjectId, ref User) - User who owns the chunk
  - `chunkIndex` (Number) - Chunk sequence number
  - `text` (String) - Chunk text content
  - `embedding` (Array[Number]) - Vector embedding

- **Indexes:**
  - Compound index on `{ pdfId: 1, chunkIndex: 1 }`
  - Compound index on `{ userId: 1, pdfId: 1 }`
  - Vector search index on `embedding` field (for MongoDB Atlas)

### 2. Services

#### `services/pdf/pdfProcessing.service.js`
- **Methods:**
  - `extractText(pdfBuffer)` - Extracts text from PDF using pdf-parse
  - `chunkText(text, options)` - Splits text into chunks using LangChain's RecursiveCharacterTextSplitter
  - `processPdf(pdfBuffer, chunkingOptions)` - Complete PDF processing pipeline

- **Features:**
  - Corrupted PDF detection with clear error messages
  - Text cleaning and whitespace normalization
  - Configurable chunking parameters (default: chunkSize=1000, chunkOverlap=200)
  - Empty chunk filtering

#### `services/embeddings/embeddings.service.js`
- **Methods:**
  - `generateEmbedding(text)` - Generate single embedding using OpenAI
  - `generateBatchEmbeddings(texts)` - Generate embeddings in batches
  - `generateEmbeddingsWithProgress(chunks, onProgress)` - Generate with progress tracking

- **Features:**
  - OpenAI API integration (text-embedding-3-small)
  - Batch processing to optimize API calls
  - Configurable embedding dimensions (default: 1536)
  - Progress tracking for large files
  - Error handling and logging

### 3. Controller

#### `controllers/pdf.controller.js`
- **Methods:**
  - `uploadPdf` - Upload and process PDF with validation
  - `getPdfs` - Get paginated list of user's PDFs
  - `getPdfById` - Get specific PDF details
  - `deletePdf` - Delete PDF and all associated chunks
  - `getPdfChunks` - Get paginated chunks for a PDF

- **Features:**
  - Multer configuration with memory storage
  - File validation (PDF only, 10MB max)
  - Status tracking (processing → completed/failed)
  - Automatic cleanup on failure
  - User ownership verification
  - Pagination support

### 4. Routes

#### `routes/pdf.routes.js`
- **Endpoints:**
  - `POST /api/v1/pdfs/upload` - Upload PDF (protected)
  - `GET /api/v1/pdfs` - Get all PDFs (protected)
  - `GET /api/v1/pdfs/:id` - Get PDF by ID (protected)
  - `GET /api/v1/pdfs/:id/chunks` - Get PDF chunks (protected)
  - `DELETE /api/v1/pdfs/:id` - Delete PDF (protected)

- **Middleware:**
  - All routes protected with authentication middleware
  - Async error handling

### 5. Configuration

#### `.env.example`
Added environment variables for:
- OpenAI API configuration
- Embedding model settings
- PDF processing parameters
- MongoDB configuration

## 🔧 Installation

```bash
# Install required packages
npm install pdf-parse langchain openai
```

## 🚀 API Usage

### Upload PDF
```bash
curl -X POST http://localhost:5000/api/v1/pdfs/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "pdf=@/path/to/your/file.pdf"
```

### Get All PDFs
```bash
curl -X GET http://localhost:5000/api/v1/pdfs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get PDF by ID
```bash
curl -X GET http://localhost:5000/api/v1/pdfs/:id \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get PDF Chunks
```bash
curl -X GET http://localhost:5000/api/v1/pdfs/:id/chunks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Delete PDF
```bash
curl -X DELETE http://localhost:5000/api/v1/pdfs/:id \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🎯 Key Features

### 1. File Validation
- **MIME Type Check:** Only `application/pdf` accepted
- **File Size Limit:** Strict 10MB maximum
- **Extension Check:** Only `.pdf` files allowed
- **Clear Error Messages:** User-friendly validation errors

### 2. Corruption Handling
- **Try-Catch Wrapper:** Catches corrupted/unreadable PDFs
- **Error Messages:** Returns HTTP 400 with "Corrupted or invalid PDF file"
- **Status Tracking:** Updates PDF status to 'failed' on errors
- **Automatic Cleanup:** Removes partial data on failure

### 3. Processing Pipeline
- **Text Extraction:** Uses pdf-parse for reliable text extraction
- **Text Cleaning:** Removes excessive whitespace
- **Chunking:** LangChain's RecursiveCharacterTextSplitter
- **Embeddings:** OpenAI text-embedding-3-small
- **Batch Processing:** Optimized API calls for efficiency

### 4. Database Operations
- **User Isolation:** Users can only access their own PDFs
- **Cascade Deletion:** Deleting PDF removes all chunks
- **Status Tracking:** Real-time processing status
- **Pagination:** Efficient data retrieval
- **Indexing:** Optimized query performance

### 5. Error Handling
- **Graceful Failure:** Processing errors don't crash the system
- **Error Logging:** Detailed error messages for debugging
- **User Feedback:** Clear error messages for API consumers
- **Rollback:** Automatic cleanup on processing failure

## 🔍 MongoDB Vector Search Setup

To enable vector search capabilities, create a vector search index in MongoDB Atlas:

```json
{
  "mappings": {
    "dynamic": true,
    "fields": {
      "embedding": {
        "type": "knnVector",
        "dimensions": 1536,
        "similarity": "cosine"
      }
    }
  }
}
```

## 📊 Response Formats

### Upload PDF Response
```json
{
  "success": true,
  "message": "PDF uploaded and processed successfully",
  "data": {
    "pdfId": "507f1f77bcf86cd799439011",
    "originalName": "document.pdf",
    "fileSize": 1048576,
    "chunkCount": 45,
    "status": "completed",
    "uploadDate": "2024-01-01T00:00:00.000Z"
  }
}
```

### Get PDFs Response
```json
{
  "success": true,
  "message": "PDFs retrieved successfully",
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

## 🔐 Security Features

- **Authentication:** All routes protected with JWT middleware
- **User Isolation:** Users can only access their own PDFs
- **File Validation:** Strict MIME type and size checks
- **Input Sanitization:** Text cleaning and validation
- **Error Sanitization:** Sensitive error details hidden from clients

## 🎛️ Configuration Options

### PDF Processing
- `PDF_MAX_FILE_SIZE`: Maximum file size (default: 10MB)
- `PDF_CHUNK_SIZE`: Text chunk size (default: 1000)
- `PDF_CHUNK_OVERLAP`: Chunk overlap (default: 200)

### Embeddings
- `OPENAI_API_KEY`: OpenAI API key
- `EMBEDDING_MODEL`: Embedding model (default: text-embedding-3-small)
- `EMBEDDING_DIMENSIONS`: Vector dimensions (default: 1536)

## 🚦 Status Flow

1. **Processing**: PDF uploaded, processing started
2. **Completed**: Successfully processed and indexed
3. **Failed**: Processing error occurred

## 📝 Next Steps

1. Install required packages: `npm install pdf-parse langchain openai`
2. Add environment variables to `.env`
3. Set up MongoDB Vector Search index
4. Test PDF upload functionality
5. Implement quiz generation from processed PDFs
6. Add file storage for large PDFs (optional)
7. Implement async processing queue for large files (optional)

## 🐛 Troubleshooting

### PDF Upload Fails
- Check file size (max 10MB)
- Verify file is valid PDF
- Check OpenAI API key is valid
- Review server logs for detailed errors

### Processing Takes Too Long
- PDF might be very large
- Check OpenAI API rate limits
- Consider implementing async processing
- Monitor embedding generation time

### Vector Search Not Working
- Verify MongoDB Atlas vector search index
- Check embedding dimensions match index configuration
- Ensure data was properly indexed
- Test vector search queries directly in MongoDB Atlas
