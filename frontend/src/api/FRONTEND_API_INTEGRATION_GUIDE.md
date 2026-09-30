# Frontend API Integration for Priority 30 & 31

## Overview
This document describes the new API methods added to `quiz.api.js` for Priority 30 (Quiz Storage) and Priority 31 (Difficulty Categorization).

## New API Methods

### 1. storeQuiz(quizData)
**Purpose**: Store a generated quiz with PDF and user linking (Priority 30)

**Endpoint**: `POST http://127.0.0.1:8000/api/v1/quizzes/store`

**Parameters**:
```javascript
const quizData = {
  user_id: 1,                          // Required: User ID
  quiz_title: "Machine Learning Quiz", // Required: Quiz title
  quiz_description: "Test your ML knowledge", // Required: Quiz description
  questions: [                         // Required: Array of question objects
    {
      question_text: "What is machine learning?",
      question_type: "mcq",
      options: ["A subset of AI", "Hardware", "Language", "Database"],
      correct_answer: "A subset of AI",
      difficulty: "easy",
      source_chunk_index: 0,
      confidence_score: 0.9,
      metadata: { topic: "basics" },
      tags: ["AI", "basics"]
    }
  ],
  pdf_id: 1,                           // Optional: Source PDF ID
  category: "AI",                      // Optional: Quiz category
  metadata: {                          // Optional: Quiz metadata
    generation_config: { ... }
  },
  tags: ["AI", "machine learning"]     // Optional: Quiz tags
};
```

**Usage Example**:
```javascript
import { quizAPI } from './api/quiz.api.js';

try {
  const response = await quizAPI.storeQuiz(quizData);
  console.log('Quiz stored successfully:', response.data);
  // Returns: { status: "success", quiz_id: 2, questions_saved: 3, ... }
} catch (error) {
  console.error('Failed to store quiz:', error);
}
```

### 2. categorizeDifficulty(quizId)
**Purpose**: Categorize difficulty for all questions in a quiz (Priority 31)

**Endpoint**: `POST http://127.0.0.1:8000/api/v1/quizzes/{quiz_id}/categorize-difficulty`

**Parameters**:
- `quizId` (number): The ID of the quiz to categorize

**Usage Example**:
```javascript
import { quizAPI } from './api/quiz.api.js';

try {
  const response = await quizAPI.categorizeDifficulty(2);
  console.log('Difficulty categorized:', response.data);
  // Returns: { quiz_id: 2, total_questions: 3, easy_count: 1, medium_count: 2, ... }
} catch (error) {
  console.error('Failed to categorize difficulty:', error);
}
```

### 3. getStoredQuiz(quizId)
**Purpose**: Retrieve a stored quiz by ID with all related data

**Endpoint**: `GET http://127.0.0.1:8000/api/v1/quizzes/{quiz_id}`

**Parameters**:
- `quizId` (number): The ID of the quiz to retrieve

**Usage Example**:
```javascript
import { quizAPI } from './api/quiz.api.js';

try {
  const response = await quizAPI.getStoredQuiz(2);
  console.log('Quiz data:', response.data);
  // Returns: { id: 2, title: "...", questions: [...], ... }
} catch (error) {
  console.error('Failed to get quiz:', error);
}
```

### 4. storeAndCategorizeQuiz(quizData)
**Purpose**: Convenience method to store a quiz and categorize its difficulty in one operation

**Parameters**: Same as `storeQuiz(quizData)`

**Usage Example**:
```javascript
import { quizAPI } from './api/quiz.api.js';

try {
  const result = await quizAPI.storeAndCategorizeQuiz(quizData);
  if (result.success) {
    console.log('Quiz stored and categorized:', result.quiz_id);
    console.log('Storage result:', result.store_result);
    console.log('Categorization result:', result.categorize_result);
  } else {
    console.error('Operation failed:', result.error);
  }
} catch (error) {
  console.error('Error:', error);
}
```

## Error Handling

All methods include proper error handling:

```javascript
try {
  const response = await quizAPI.storeQuiz(quizData);
  // Handle success
} catch (error) {
  if (error.response) {
    // Server responded with error status
    console.error('Server error:', error.response.data);
  } else if (error.request) {
    // Request made but no response
    console.error('Network error:', error.message);
  } else {
    // Error in request setup
    console.error('Request error:', error.message);
  }
}
```

## Authentication

All methods automatically include authentication headers using the access token from localStorage:

```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

## Timeouts

- `storeQuiz`: 60 seconds (1 minute)
- `categorizeDifficulty`: 120 seconds (2 minutes)
- `getStoredQuiz`: Default axios timeout

## React Component Integration Example

```javascript
import React, { useState } from 'react';
import { quizAPI } from '../api/quiz.api.js';

const QuizStorageComponent = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [quizId, setQuizId] = useState(null);

  const handleStoreQuiz = async (generatedQuiz) => {
    setLoading(true);
    setError(null);
    
    try {
      const quizData = {
        user_id: getUserId(), // Get current user ID
        quiz_title: generatedQuiz.title,
        quiz_description: generatedQuiz.description,
        questions: generatedQuiz.questions,
        pdf_id: generatedQuiz.pdfId,
        category: generatedQuiz.category,
        metadata: generatedQuiz.metadata,
        tags: generatedQuiz.tags
      };

      const response = await quizAPI.storeQuiz(quizData);
      setQuizId(response.data.quiz_id);
      
      // Optionally categorize difficulty
      await quizAPI.categorizeDifficulty(response.data.quiz_id);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Your UI components */}
    </div>
  );
};
```

## Data Flow

1. **Quiz Generation**: Generate quiz questions using existing generation endpoints
2. **Quiz Storage**: Store the generated quiz using `storeQuiz()`
3. **Difficulty Categorization**: Categorize questions using `categorizeDifficulty()`
4. **Quiz Retrieval**: Retrieve stored quiz using `getStoredQuiz()`

## Integration with Existing Quiz Flow

The new methods integrate seamlessly with the existing quiz generation flow:

```javascript
// Example: Complete quiz generation and storage workflow
const generateAndStoreQuiz = async (pdfId, quizConfig) => {
  try {
    // 1. Generate quiz questions (existing endpoint)
    const generatedQuiz = await quizAPI.generateQuiz({
      pdf_id: pdfId,
      ...quizConfig
    });

    // 2. Store the quiz (new Priority 30 endpoint)
    const storeResponse = await quizAPI.storeQuiz({
      user_id: getCurrentUserId(),
      quiz_title: generatedQuiz.data.title,
      quiz_description: generatedQuiz.data.description,
      questions: generatedQuiz.data.questions,
      pdf_id: pdfId,
      category: generatedQuiz.data.category,
      metadata: generatedQuiz.data.metadata,
      tags: generatedQuiz.data.tags
    });

    // 3. Categorize difficulty (new Priority 31 endpoint)
    const categorizeResponse = await quizAPI.categorizeDifficulty(
      storeResponse.data.quiz_id
    );

    return {
      success: true,
      quiz_id: storeResponse.data.quiz_id,
      categorization: categorizeResponse.data
    };

  } catch (error) {
    console.error('Quiz generation and storage failed:', error);
    return { success: false, error: error.message };
  }
};
```

## Notes

- All methods use direct axios calls to the backend at `http://127.0.0.1:8000`
- Authentication tokens are automatically included from localStorage
- Methods include appropriate timeouts for their operations
- Error handling is consistent across all methods
- The `storeAndCategorizeQuiz` utility method combines both operations for convenience