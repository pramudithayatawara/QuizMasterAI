# Quiz API Documentation

## Overview
Complete API documentation for the Quiz module with RAG Question Generation Pipeline.

## Base URL
```
http://localhost:5000/api/v1/quizzes
```

## Authentication
All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## Endpoints

### 1. Generate Quiz from PDF
**POST** `/api/v1/quizzes/generate`

Generate a quiz from a PDF document using the RAG pipeline with Google Gemini AI.

**Request Body:**
```json
{
  "pdfId": "string (required) - MongoDB ObjectId of the PDF",
  "questionCount": "number (optional) - Number of questions (default: 10, min: 10, max: 20)",
  "difficulty": "string (optional) - Quiz difficulty: 'easy', 'medium', 'hard' (default: 'medium')"
}
```

**Example Request:**
```bash
curl -X POST http://localhost:5000/api/v1/quizzes/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pdfId": "507f1f77bcf86cd799439011",
    "questionCount": 10,
    "difficulty": "medium"
  }'
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Quiz generated successfully!",
  "data": {
    "quiz": {
      "id": "507f1f77bcf86cd799439012",
      "title": "Document_Name - Medium Quiz",
      "difficulty": "medium",
      "totalQuestions": 10,
      "mcqCount": 6,
      "trueFalseCount": 4,
      "timeLimit": 20,
      "status": "ready",
      "retrievedChunks": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      "generationModel": "gemini-pro",
      "createdAt": "2026-08-10T23:33:01.000Z"
    }
  }
}
```

**Error Responses:**
- `400 PDF_ID_REQUIRED`: PDF ID is required
- `404 PDF_NOT_FOUND`: PDF not found or doesn't belong to user
- `400 PDF_NOT_READY`: PDF not processed successfully
- `400 NO_CHUNKS_FOUND`: No chunks available for PDF
- `500 GEMINI_ERROR`: AI generation failure

---

### 2. Get All Quizzes for a PDF
**GET** `/api/v1/quizzes/pdf/:pdfId`

Retrieve all quizzes generated from a specific PDF document.

**URL Parameters:**
- `pdfId` (required): MongoDB ObjectId of the PDF

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 50)

**Example Request:**
```bash
curl -X GET "http://localhost:5000/api/v1/quizzes/pdf/507f1f77bcf86cd799439011?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Quizzes retrieved successfully.",
  "data": [
    {
      "id": "507f1f77bcf86cd799439012",
      "title": "Document_Name - Medium Quiz",
      "difficulty": "medium",
      "totalQuestions": 10,
      "mcqCount": 6,
      "trueFalseCount": 4,
      "timeLimit": 20,
      "status": "ready",
      "createdAt": "2026-08-10T23:33:01.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalItems": 2,
    "itemsPerPage": 10,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

**Error Responses:**
- `400 Invalid PDF ID`: Invalid MongoDB ObjectId format
- `404 PDF_NOT_FOUND`: PDF not found

---

### 3. Get Specific Quiz with Details
**GET** `/api/v1/quizzes/:id`

Retrieve a specific quiz with all questions, context references, and metadata.

**URL Parameters:**
- `id` (required): MongoDB ObjectId of the quiz

**Example Request:**
```bash
curl -X GET http://localhost:5000/api/v1/quizzes/507f1f77bcf86cd799439012 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Quiz retrieved successfully.",
  "data": {
    "quiz": {
      "id": "507f1f77bcf86cd799439012",
      "title": "Document_Name - Medium Quiz",
      "description": null,
      "difficulty": "medium",
      "totalQuestions": 10,
      "mcqCount": 6,
      "trueFalseCount": 4,
      "timeLimit": 20,
      "status": "ready",
      "questions": [
        {
          "_id": "507f1f77bcf86cd799439013",
          "questionText": "What is the main concept described in the text?",
          "type": "mcq",
          "options": {
            "A": "The primary concept described in the text",
            "B": "An unrelated topic",
            "C": "A minor detail mentioned",
            "D": "None of the above"
          },
          "correctAnswer": "A",
          "explanation": "Based on the provided context.",
          "topic": "General",
          "difficulty": "medium",
          "bloomsLevel": "understand",
          "sourceChunkIndex": 0,
          "conceptComplexity": 5,
          "reasoningRequired": 5,
          "order": 1
        }
      ],
      "retrievedChunks": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      "contextReferences": [
        {
          "chunkIndex": 0,
          "text": "First 200 characters of chunk text...",
          "relevanceScore": 0.85
        }
      ],
      "generationModel": "gemini-pro",
      "createdAt": "2026-08-10T23:33:01.000Z",
      "updatedAt": "2026-08-10T23:33:01.000Z"
    }
  }
}
```

**Error Responses:**
- `400 Invalid quiz ID`: Invalid MongoDB ObjectId format
- `404 QUIZ_NOT_FOUND`: Quiz not found or doesn't belong to user

---

### 4. Get All User Quizzes
**GET** `/api/v1/quizzes`

Retrieve all quizzes for the authenticated user with pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `difficulty` (optional): Filter by difficulty
- `status` (optional): Filter by status
- `sortBy` (optional): Sort field (default: createdAt)
- `order` (optional): Sort order (default: desc)

**Example Request:**
```bash
curl -X GET "http://localhost:5000/api/v1/quizzes?page=1&limit=10&difficulty=medium" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Quizzes retrieved successfully.",
  "data": [
    {
      "id": "507f1f77bcf86cd799439012",
      "title": "Document_Name - Medium Quiz",
      "difficulty": "medium",
      "totalQuestions": 10,
      "mcqCount": 6,
      "trueFalseCount": 4,
      "timeLimit": 20,
      "status": "ready",
      "createdAt": "2026-08-10T23:33:01.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalItems": 5,
    "itemsPerPage": 10,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

### 5. Start Quiz Attempt
**POST** `/api/v1/quizzes/:id/start`

Start a quiz attempt session for the authenticated user.

**URL Parameters:**
- `id` (required): MongoDB ObjectId of the quiz

**Example Request:**
```bash
curl -X POST http://localhost:5000/api/v1/quizzes/507f1f77bcf86cd799439012/start \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Quiz started! Good luck!",
  "data": {
    "attempt": {
      "id": "507f1f77bcf86cd799439014",
      "startedAt": "2026-08-10T23:35:00.000Z",
      "timeLimit": 20
    },
    "questions": [
      {
        "_id": "507f1f77bcf86cd799439013",
        "questionText": "What is the main concept described in the text?",
        "type": "mcq",
        "options": {
          "A": "The primary concept described in the text",
          "B": "An unrelated topic",
          "C": "A minor detail mentioned",
          "D": "None of the above"
        },
        "topic": "General",
        "difficulty": "medium",
        "order": 1
      }
    ],
    "difficulty": "medium",
    "totalQuestions": 10
  }
}
```

**Error Responses:**
- `400 Invalid quiz ID`: Invalid MongoDB ObjectId format
- `404 QUIZ_NOT_FOUND`: Quiz not found
- `400 QUIZ_NOT_READY`: Quiz is not ready to be taken

---

### 6. Submit Quiz Answers
**POST** `/api/v1/quizzes/attempt/:attemptId/submit`

Submit quiz answers and receive evaluation results.

**URL Parameters:**
- `attemptId` (required): MongoDB ObjectId of the quiz attempt

**Request Body:**
```json
{
  "answers": [
    {
      "questionId": "string - Question ID",
      "answer": "string - Selected option (A, B, C, or D)"
    }
  ],
  "timeTaken": "number (optional) - Time taken in seconds"
}
```

**Example Request:**
```bash
curl -X POST http://localhost:5000/api/v1/quizzes/attempt/507f1f77bcf86cd799439014/submit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      {
        "questionId": "507f1f77bcf86cd799439013",
        "answer": "A"
      }
    ],
    "timeTaken": 600
  }'
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Quiz submitted successfully!",
  "data": {
    "evaluation": {
      "attemptId": "507f1f77bcf86cd799439014",
      "correct": 8,
      "wrong": 2,
      "skipped": 0,
      "total": 10,
      "percentage": 80,
      "timeTaken": 600,
      "isAutoSubmitted": false,
      "difficulty": "medium",
      "details": [
        {
          "questionId": "507f1f77bcf86cd799439013",
          "userAnswer": "A",
          "correctAnswer": "A",
          "isCorrect": true
        }
      ]
    }
  }
}
```

**Error Responses:**
- `400 Invalid attempt ID`: Invalid MongoDB ObjectId format
- `400 Answers must be an array`: Invalid answers format
- `404 ATTEMPT_NOT_FOUND`: Quiz attempt not found or already submitted

---

### 7. Get Quiz Review
**GET** `/api/v1/quizzes/attempt/:attemptId/review`

Get completed quiz with correct answers for review.

**URL Parameters:**
- `attemptId` (required): MongoDB ObjectId of the quiz attempt

**Example Request:**
```bash
curl -X GET http://localhost:5000/api/v1/quizzes/attempt/507f1f77bcf86cd799439014/review \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Quiz review retrieved.",
  "data": {
    "review": {
      "attemptId": "507f1f77bcf86cd799439014",
      "quizId": "507f1f77bcf86cd799439012",
      "userId": "507f1f77bcf86cd799439011",
      "score": 8,
      "percentage": 80,
      "timeTaken": 600,
      "completedAt": "2026-08-10T23:45:00.000Z",
      "questions": [
        {
          "questionId": "507f1f77bcf86cd799439013",
          "questionText": "What is the main concept described in the text?",
          "type": "mcq",
          "options": {
            "A": "The primary concept described in the text",
            "B": "An unrelated topic",
            "C": "A minor detail mentioned",
            "D": "None of the above"
          },
          "correctAnswer": "A",
          "explanation": "Based on the provided context.",
          "userAnswer": "A",
          "isCorrect": true
        }
      ]
    }
  }
}
```

**Error Responses:**
- `400 Invalid attempt ID`: Invalid MongoDB ObjectId format
- `404 ATTEMPT_NOT_FOUND`: Completed quiz attempt not found

---

### 8. Get Quiz History
**GET** `/api/v1/quizzes/history`

Get quiz attempt history for the authenticated user.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Example Request:**
```bash
curl -X GET "http://localhost:5000/api/v1/quizzes/history?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Quiz history retrieved.",
  "data": [
    {
      "attemptId": "507f1f77bcf86cd799439014",
      "quizId": "507f1f77bcf86cd799439012",
      "score": 8,
      "percentage": 80,
      "timeTaken": 600,
      "difficulty": "medium",
      "completedAt": "2026-08-10T23:45:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalItems": 5,
    "itemsPerPage": 10,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

## Data Models

### Quiz Object
```typescript
{
  id: string;                    // MongoDB ObjectId
  title: string;                 // Quiz title
  description?: string;          // Optional description
  difficulty: 'easy' | 'medium' | 'hard';
  totalQuestions: number;        // Total number of questions
  mcqCount: number;              // MCQ question count
  trueFalseCount: number;        // True/False question count
  timeLimit: number;             // Time limit in minutes
  status: 'draft' | 'ready' | 'processing' | 'failed';
  questions: Question[];         // Array of questions
  retrievedChunks: number[];     // Chunk indices used
  contextReferences: ContextReference[]; // Detailed context info
  generationModel: string;       // AI model used
  createdAt: Date;
  updatedAt: Date;
}
```

### Question Object
```typescript
{
  _id: string;
  questionText: string;
  type: 'mcq' | 'true_false';
  options: Map<string, string>;  // { A: '...', B: '...', C: '...', D: '...' }
  correctAnswer: string;         // 'A', 'B', 'C', or 'D'
  explanation?: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  bloomsLevel: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
  sourceChunkIndex: number;      // Reference to source chunk
  conceptComplexity: number;     // 0-10 scale
  reasoningRequired: number;    // 0-10 scale
  order: number;                 // Question order
}
```

### ContextReference Object
```typescript
{
  chunkIndex: number;
  text: string;                  // First 200 characters of chunk
  relevanceScore: number;       // Similarity score
}
```

---

## Error Handling

All error responses follow this format:
```json
{
  "success": false,
  "status": "error",
  "message": "Error description",
  "code": "ERROR_CODE",
  "errors": [],
  "timestamp": "2026-08-10T23:33:01.000Z"
}
```

### Common Error Codes:
- `PDF_ID_REQUIRED`: PDF ID is required
- `PDF_NOT_FOUND`: PDF not found
- `PDF_NOT_READY`: PDF not processed successfully
- `NO_CHUNKS_FOUND`: No chunks available for PDF
- `QUIZ_NOT_FOUND`: Quiz not found
- `QUIZ_NOT_READY`: Quiz is not ready to be taken
- `ATTEMPT_NOT_FOUND`: Quiz attempt not found
- `GEMINI_ERROR`: AI generation failure
- `INVALID_PDF_ID`: Invalid PDF ID format
- `INVALID_QUIZ_ID`: Invalid quiz ID format

---

## Rate Limiting

All endpoints are subject to rate limiting:
- Default: 100 requests per 15 minutes per user
- Authentication: Required for all endpoints

---

## Pagination

All list endpoints support pagination:
- `page`: Page number (starts at 1)
- `limit`: Items per page (default: 10, max: 50)
- `totalPages`: Total number of pages
- `totalItems`: Total number of items
- `hasNextPage`: Boolean indicating if next page exists
- `hasPreviousPage`: Boolean indicating if previous page exists

---

## Backward Compatibility

For backward compatibility, the old `/api/v1/quiz` route is still available:
- `/api/v1/quiz/generate` → Same as `/api/v1/quizzes/generate`
- `/api/v1/quiz/:id/start` → Same as `/api/v1/quizzes/:id/start`
- `/api/v1/quiz/attempt/:attemptId/submit` → Same as `/api/v1/quizzes/attempt/:attemptId/submit`
- `/api/v1/quiz/attempt/:attemptId/review` → Same as `/api/v1/quizzes/attempt/:attemptId/review`
- `/api/v1/quiz/history` → Same as `/api/v1/quizzes/history`

The new `/api/v1/quizzes` route is the preferred route for new implementations.

---

## Testing

### Using cURL:
```bash
# Generate quiz
curl -X POST http://localhost:5000/api/v1/quizzes/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pdfId": "PDF_ID", "questionCount": 10}'

# Get quizzes by PDF
curl -X GET http://localhost:5000/api/v1/quizzes/pdf/PDF_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get specific quiz
curl -X GET http://localhost:5000/api/v1/quizzes/QUIZ_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Using Postman:
1. Import the collection (if available)
2. Set base URL: `http://localhost:5000/api/v1`
3. Add JWT token to Authorization header
4. Test each endpoint with provided examples

---

## Changelog

### Version 2.0.0 (Current)
- Added `/api/v1/quizzes` route as preferred endpoint
- Added `GET /api/v1/quizzes/pdf/:pdfId` endpoint
- Added `GET /api/v1/quizzes/:id` endpoint with full details
- Enhanced quiz responses with context references
- Improved validation and error handling
- Added pagination support for all list endpoints

### Version 1.0.0
- Initial quiz generation with RAG pipeline
- Basic quiz CRUD operations
- Quiz attempt management

---

## Support

For issues or questions:
- Check server logs for detailed error messages
- Verify JWT token is valid and not expired
- Ensure PDF has been processed successfully
- Confirm Gemini API key is configured correctly