# RAG Question Generation Pipeline - Module 03

## Overview
This module implements a complete Retrieval-Augmented Generation (RAG) pipeline for generating quiz questions from PDF documents using Google Gemini AI and local HuggingFace embeddings.

## Architecture

### Pipeline Components

1. **Retrieval Phase**
   - Vector similarity search on stored PDF chunks
   - Cosine similarity calculation for relevance scoring
   - Top-K chunk selection based on query embedding

2. **Prompt Engineering**
   - Structured JSON schema for Gemini AI
   - Context assembly from retrieved chunks
   - Difficulty-aware prompt construction

3. **Generation Phase**
   - Google Gemini AI API integration
   - Structured JSON output forcing
   - Question validation and deduplication

4. **Storage Phase**
   - MongoDB Quiz and Question document creation
   - Context reference tracking for traceability
   - Metadata preservation

## Implementation Details

### File: `services/quiz/quiz.service.js`

#### Main Method: `generateQuizFromPdf(pdfId, userId, options)`

**Parameters:**
- `pdfId`: MongoDB ObjectId of the source PDF document
- `userId`: MongoDB ObjectId of the requesting user
- `options`: Configuration object
  - `difficulty`: Quiz difficulty ('easy', 'medium', 'hard')
  - `questionCount`: Number of questions to generate (default: 10)

**Process Flow:**

1. **PDF Validation**
   - Verify PDF exists and belongs to user
   - Check PDF processing status (must be 'completed')
   - Validate chunk availability

2. **Vector Similarity Search**
   - Generate query embedding using local HuggingFace model
   - Calculate cosine similarity between query and all PDF chunks
   - Select top 10 most relevant chunks
   - Return chunks with relevance scores

3. **Context Assembly**
   - Sort retrieved chunks by index for coherence
   - Format chunks with `[Chunk N]: text` structure
   - Concatenate into single context string

4. **Prompt Construction**
   - Define question distribution (60% MCQ, 40% True/False)
   - Include difficulty level and question count
   - Add strict context-bound instructions
   - Specify JSON schema requirements

5. **Gemini AI Generation**
   - Initialize Google Generative AI client
   - Use `gemini-pro` model with optimal parameters
   - Generate content with structured JSON output
   - Parse and validate JSON response

6. **Question Processing**
   - Remove duplicate questions
   - Assign source chunk references
   - Infer Bloom's taxonomy levels
   - Set metadata (complexity, reasoning, etc.)

7. **Database Storage**
   - Create Quiz document with all metadata
   - Store context references for traceability
   - Track generation model and chunk usage

### Private Helper Methods

#### `_retrieveRelevantChunks(pdfId, userId)`
- Performs vector similarity search on PDF chunks
- Uses local HuggingFace embeddings for query vector
- Returns top 10 chunks with relevance scores

#### `_calculateCosineSimilarity(vecA, vecB)`
- Mathematical implementation of cosine similarity
- Used for ranking chunk relevance
- Returns score between 0 (no similarity) and 1 (identical)

#### `_assembleContextFromChunks(chunks)`
- Formats retrieved chunks into coherent context
- Maintains reading order by chunk index
- Returns formatted string for LLM consumption

#### `_constructQuizPrompt(context, difficulty, questionCount)`
- Builds structured prompt for Gemini AI
- Includes question type distribution
- Specifies strict context requirements
- Defines JSON output schema

#### `_getQuizJSONSchema()`
- Defines strict JSON schema for structured output
- Ensures consistent question structure
- Validates required fields and data types

#### `_generateQuizWithGemini(prompt, jsonSchema)`
- Calls Google Gemini AI API
- Handles JSON extraction from response
- Validates response structure
- Returns parsed quiz data

#### `_processGeneratedQuestions(questions, relevantChunks, difficulty)`
- Removes duplicate questions
- Assigns source chunk references
- Infers Bloom's taxonomy levels
- Sets question metadata

#### `_findRelevantChunk(questionText, chunks)`
- Finds most relevant chunk for each question
- Uses keyword overlap matching
- Returns chunk with highest relevance

#### `_inferBloomsLevel(questionText, difficulty)`
- Analyzes question keywords for Bloom's level
- Maps to remember/understand/apply/analyze/evaluate/create
- Falls back to difficulty-based defaults

#### `_generateQuizTitle(pdfName, difficulty)`
- Creates descriptive quiz title
- Includes PDF name and difficulty level
- Returns formatted title string

## JSON Schema

### Quiz Response Structure
```json
{
  "questions": [
    {
      "questionText": "string",
      "type": "mcq|true_false",
      "options": {
        "A": "string",
        "B": "string", 
        "C": "string",
        "D": "string"
      },
      "correctAnswer": "A|B|C|D",
      "explanation": "string",
      "topic": "string"
    }
  ]
}
```

## Quiz Requirements Compliance

### ✅ Minimum 10 Questions
- Enforced by default (configurable via `questionCount` parameter)
- Validation in Quiz model schema

### ✅ 60% MCQ / 40% True/False Distribution
- Calculated dynamically based on `questionCount`
- `mcqCount = Math.ceil(questionCount * 0.6)`
- `tfCount = questionCount - mcqCount`

### ✅ MCQ Format (4 options, 1 correct)
- Enforced in JSON schema
- Gemini instructed to provide exactly 4 options
- Validation ensures single correct answer

### ✅ Duplicate Prevention
- HashSet-based duplicate detection
- Case-insensitive comparison
- Removes duplicates during processing

### ✅ Context References
- Each question tracks source chunk index
- Quiz stores `retrievedChunks` array
- Detailed `contextReferences` with text snippets

### ✅ Strict JSON Output
- JSON schema forcing via Gemini API
- Markdown parsing for JSON extraction
- Response validation before processing

## API Integration

### Controller: `controllers/quiz.controller.js`

#### Endpoint: `POST /api/v1/quiz/generate`
```json
{
  "pdfId": "string",
  "difficulty": "easy|medium|hard",
  "questionCount": 10
}
```

#### Response:
```json
{
  "success": true,
  "message": "Quiz generated successfully!",
  "data": {
    "quiz": {
      "id": "string",
      "title": "string",
      "difficulty": "string",
      "totalQuestions": 10,
      "mcqCount": 6,
      "trueFalseCount": 4,
      "timeLimit": 15,
      "status": "ready",
      "retrievedChunks": [0, 1, 2, 3, 4],
      "generationModel": "gemini-pro",
      "createdAt": "ISO date"
    }
  }
}
```

## Database Models

### Quiz Model Updates
- Added `contextReferences` field for detailed traceability
- Enhanced `retrievedChunks` with chunk indices
- `generationModel` tracking for AI model identification

### Question Model Features
- `sourceChunkIndex` for context traceability
- `bloomsLevel` for cognitive complexity
- `conceptComplexity` and `reasoningRequired` metrics

## Error Handling

### Common Errors:
- `PDF_NOT_FOUND`: PDF doesn't exist or doesn't belong to user
- `PDF_NOT_READY`: PDF not processed successfully
- `NO_CHUNKS_FOUND`: No chunks available for PDF
- `INSUFFICIENT_CONTEXT`: Not enough relevant content
- `GEMINI_ERROR`: AI generation failure
- `INVALID_JSON`: Malformed AI response

### Fallback Mechanisms:
- Sequential chunk selection if vector search fails
- JSON parsing with markdown extraction
- Duplicate removal during processing
- Difficulty-based defaults for metadata

## Performance Considerations

### Optimization Strategies:
1. **Vector Search**: Local embeddings (no API calls)
2. **Caching**: Reuse vector indices for multiple quiz generations
3. **Batch Processing**: Generate multiple questions in single API call
4. **Progressive Loading**: Stream chunks during context assembly

### Resource Usage:
- **Memory**: ~100MB for vector operations
- **Compute**: Minimal (local similarity calculations)
- **API**: 1 Gemini call per quiz generation
- **Storage**: ~1KB per question in MongoDB

## Configuration

### Environment Variables:
```env
GEMINI_API_KEY=your_gemini_api_key
# Vector dimensions must match embedding model
VECTOR_DIMENSIONS=384
# Max context length for LLM
MAX_CONTEXT_LENGTH=6000
```

### Default Settings:
- `TOP_K_CHUNKS`: 10
- `MIN_SIMILARITY_SCORE`: 0.3
- `DEFAULT_QUESTION_COUNT`: 10
- `DEFAULT_DIFFICULTY`: 'medium'

## Testing

### Unit Tests Needed:
1. Vector similarity calculation accuracy
2. JSON schema validation
3. Duplicate detection logic
4. Bloom's level inference
5. Context assembly coherence

### Integration Tests Needed:
1. End-to-end quiz generation pipeline
2. Gemini API error handling
3. MongoDB document creation
4. Chunk reference accuracy

### Manual Testing:
```bash
# Test quiz generation
curl -X POST http://localhost:5000/api/v1/quiz/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pdfId": "PDF_ID",
    "difficulty": "medium",
    "questionCount": 10
  }'
```

## Future Enhancements

### Potential Improvements:
1. **Adaptive Retrieval**: Dynamic chunk selection based on question type
2. **Multi-turn Generation**: Interactive question refinement
3. **Quality Scoring**: Automatic question quality assessment
4. **Topic Modeling**: Automatic topic extraction and categorization
5. **Difficulty Calibration**: Dynamic difficulty adjustment based on user performance

### Scalability Considerations:
1. **Vector Database**: Migration to specialized vector DB (Pinecone, Weaviate)
2. **Caching Layer**: Redis for quiz and chunk caching
3. **Parallel Processing**: Concurrent chunk retrieval and generation
4. **Queue System**: Background job processing for large PDFs

## Troubleshooting

### Common Issues:

**Issue**: "No chunks found for this PDF"
- **Solution**: Ensure PDF has been processed successfully
- **Check**: PDF status in PdfDocument collection

**Issue**: "Failed to extract JSON from Gemini response"
- **Solution**: Check Gemini API key and quota
- **Verify**: API response format hasn't changed

**Issue**: "Duplicate questions in generated quiz"
- **Solution**: Increase context diversity
- **Adjust**: Retrieve more chunks or reduce question count

**Issue**: "Questions not based on provided context"
- **Solution**: Strengthen prompt instructions
- **Verify**: JSON schema enforcement is working

## Dependencies

### Required Packages:
- `@google/generative-ai`: Gemini AI API client
- `@xenova/transformers`: Local HuggingFace embeddings
- `mongoose`: MongoDB ODM
- `express`: Web framework

### Optional Packages:
- `faiss-node`: Advanced vector search (fallback to cosine similarity)
- `redis`: Caching layer (future enhancement)

## Security Considerations

### API Key Management:
- Store Gemini API key in environment variables
- Never commit API keys to version control
- Implement key rotation strategy

### Data Privacy:
- User PDFs and questions are private
- Implement proper access control
- Encrypt sensitive data at rest

### Rate Limiting:
- Implement per-user rate limits
- Add API quota monitoring
- Circuit breaker for AI API failures

## Monitoring

### Key Metrics:
- Quiz generation success rate
- Average generation time
- AI API call count and cost
- Chunk retrieval accuracy
- Question quality scores

### Logging:
- Detailed pipeline step logging
- Error tracking with context
- Performance metrics
- User behavior analytics

## Conclusion

This RAG Question Generation Pipeline provides a robust, scalable solution for generating high-quality quiz questions from PDF documents. The combination of local embeddings for retrieval and Gemini AI for generation ensures both performance and quality while maintaining cost-effectiveness and privacy.

The modular design allows for easy enhancement and adaptation to different use cases, making it suitable for various educational applications beyond quiz generation.