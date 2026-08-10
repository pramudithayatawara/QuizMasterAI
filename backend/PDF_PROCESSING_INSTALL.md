# PDF Processing Module - Installation Instructions

## Required Packages

Install the following packages to enable PDF processing:

```bash
npm install pdf-parse langchain openai
```

## Package Descriptions

- **pdf-parse**: Library for extracting text from PDF files
- **langchain**: Framework for text chunking and document processing
- **openai**: OpenAI API client for generating embeddings

## Optional Packages

For alternative embedding providers:

```bash
# For HuggingFace embeddings
npm install @langchain/community @huggingface/inference

# For Pinecone vector database
npm install @pinecone-database/pinecone

# For MongoDB vector search (already installed)
npm install mongoose
```

## Environment Variables

Add the following to your `.env` file:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536

# PDF Processing Configuration
PDF_MAX_FILE_SIZE=10485760  # 10MB in bytes
PDF_CHUNK_SIZE=1000
PDF_CHUNK_OVERLAP=200
```

## MongoDB Vector Search Setup

For MongoDB Atlas Vector Search, you need to:

1. Enable vector search on your MongoDB Atlas cluster
2. Create a vector search index on the `pdfchunks` collection

Example index configuration:

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

## Usage Examples

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
