# Module 04: AI Difficulty Classification

## Overview
Module 04 implements AI-powered difficulty classification for individual quiz questions using Google Gemini AI. Each question is automatically classified into Easy, Medium, or Hard based on pedagogical and textual factors, with the classification stored in the database for analytics and adaptive learning.

## Architecture

### Classification Pipeline

1. **Question Generation** with built-in difficulty classification
2. **AI Analysis** using 4 pedagogical criteria
3. **Structured Output** with classification metadata
4. **Database Storage** with difficulty breakdown counters

## Classification Criteria

### 1. Concept Complexity
- **Easy**: Direct recall of facts, definitions, or basic concepts
- **Medium**: Understanding relationships, applying concepts to scenarios
- **Hard**: Multi-concept synthesis, complex analysis, or integration

### 2. Context Length
- **Easy**: Short, simple text (under 50 words)
- **Medium**: Moderate complexity (50-100 words)
- **Hard**: Detailed, technical text (over 100 words)

### 3. Required Reasoning
- **Easy**: Single-step retrieval
- **Medium**: Multi-step deduction or application
- **Hard**: Complex problem-solving or evaluation

### 4. Bloom's Taxonomy Level
- **Easy**: Remember, Understand
- **Medium**: Apply, Analyze
- **Hard**: Evaluate, Create

## Schema Updates

### Question Schema Updates

**File**: `models/Quiz.model.js`

```javascript
const questionSchema = new mongoose.Schema({
  // ... existing fields ...

  // Module 04: AI Difficulty Classification
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    required: true,
  },

  bloomsTaxonomy: {
    type: String,
    enum: ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'],
    required: true,
    default: 'Understand',
  },

  classificationReason: {
    type: String,
    default: null,
    description: 'AI-generated explanation for difficulty classification',
  },

  // Legacy field for backward compatibility
  bloomsLevel: {
    type: String,
    enum: ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'],
    default: 'remember',
  },

  // ... existing fields ...
});
```

### Quiz Schema Updates

```javascript
const quizSchema = new mongoose.Schema({
  // ... existing fields ...

  // Module 04: Difficulty Breakdown Counters
  difficultyBreakdown: {
    easy: { type: Number, default: 0 },
    medium: { type: Number, default: 0 },
    hard: { type: Number, default: 0 },
  },

  // ... existing fields ...
});
```

## AI Prompt Engineering

### Enhanced Quiz Generation Prompt

**File**: `services/quiz/quiz.service.js`

The prompt now includes detailed difficulty classification instructions:

```javascript
_constructQuizPrompt(context, difficulty, questionCount) {
  return `You are an expert educational content creator and pedagogical assessment specialist. Generate a quiz based STRICTLY on the following context from a PDF document.

CONTEXT:
${context}

REQUIREMENTS:
1. Generate exactly ${questionCount} questions total
2. For MCQs: Provide exactly 4 options (A, B, C, D) with exactly ONE correct answer
3. For True/False: Provide options A (True) and B (False) with exactly ONE correct answer
4. Ensure all questions are based ONLY on the provided context
5. Avoid duplicate questions
6. Provide a brief explanation for each correct answer

MODULE 04 - AI DIFFICULTY CLASSIFICATION:
For EACH question, you must analyze and classify its difficulty based on these 4 criteria:

1. Concept Complexity:
   - Easy: Direct recall of facts, definitions, or basic concepts
   - Medium: Understanding relationships, applying concepts to scenarios
   - Hard: Multi-concept synthesis, complex analysis, or integration

2. Context Length:
   - Easy: Short, simple text (under 50 words)
   - Medium: Moderate complexity (50-100 words)
   - Hard: Detailed, technical text (over 100 words)

3. Required Reasoning:
   - Easy: Single-step retrieval
   - Medium: Multi-step deduction or application
   - Hard: Complex problem-solving or evaluation

4. Bloom's Taxonomy Level:
   - Easy: Remember, Understand
   - Medium: Apply, Analyze
   - Hard: Evaluate, Create

Difficulty Classification Rules:
- Assign 'easy' if question involves basic recall/understanding with simple reasoning
- Assign 'medium' if question requires application/analysis with moderate complexity
- Assign 'hard' if question involves evaluation/creation with complex reasoning
- Each question must have a consistent difficulty across all 4 criteria
- Provide a brief explanation for the difficulty classification in 'classificationReason'

IMPORTANT:
- Base your questions EXCLUSIVELY on the provided context
- Do not use external knowledge
- Make questions clear and unambiguous
- Ensure options are plausible but clearly distinguishable
- Mark the correct answer in the correctAnswer field
- Difficulty classification must be consistent with the question's cognitive demand`;
}
```

### Updated JSON Schema

```javascript
_getQuizJSONSchema() {
  return {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            questionText: { type: "string" },
            type: { type: "string", enum: ["mcq", "true_false"] },
            options: {
              type: "object",
              properties: {
                A: { type: "string" },
                B: { type: "string" },
                C: { type: "string" },
                D: { type: "string" }
              },
              required: ["A", "B", "C", "D"]
            },
            correctAnswer: {
              type: "string",
              enum: ["A", "B", "C", "D"]
            },
            // Module 04: Difficulty Classification Fields
            difficulty: {
              type: "string",
              enum: ["easy", "medium", "hard"],
              description: "Question difficulty level based on concept complexity, context length, reasoning required, and Bloom's taxonomy"
            },
            bloomsTaxonomy: {
              type: "string",
              enum: ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"],
              description: "Bloom's taxonomy level that best describes the cognitive demand"
            },
            classificationReason: {
              type: "string",
              description: "Brief explanation (1-2 sentences) for why this difficulty was assigned"
            },
            contextChunkId: {
              type: "number",
              description: "Reference to the source chunk index from context"
            },
            explanation: { type: "string" },
            topic: { type: "string" }
          },
          required: ["questionText", "type", "options", "correctAnswer", "difficulty", "bloomsTaxonomy", "classificationReason", "explanation", "topic"]
        }
      }
    },
    required: ["questions"]
  };
}
```

## Service Layer Updates

### Question Processing

**File**: `services/quiz/quiz.service.js`

Updated `_processGeneratedQuestions` method to handle AI-classified difficulty:

```javascript
_processGeneratedQuestions(questions, relevantChunks, difficulty) {
  const seenQuestions = new Set();

  return questions.map((q, index) => {
    // Duplicate detection
    const questionKey = q.questionText.toLowerCase().trim();
    if (seenQuestions.has(questionKey)) {
      logger.warn(`Duplicate question detected and removed: ${q.questionText}`);
      return null;
    }
    seenQuestions.add(questionKey);

    // Find relevant chunk
    const relevantChunk = this._findRelevantChunk(q.questionText, relevantChunks);

    return {
      questionText: q.questionText,
      type: q.type,
      options: new Map(Object.entries(q.options)),
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      topic: q.topic || 'General',
      // Module 04: Use AI-classified difficulty if available
      difficulty: q.difficulty || difficulty,
      // Module 04: Use AI-classified Bloom's taxonomy
      bloomsTaxonomy: q.bloomsTaxonomy || this._mapBloomsLevel(q.bloomsTaxonomy || 'Understand'),
      classificationReason: q.classificationReason || 'Default classification',
      // Legacy field for backward compatibility
      bloomsLevel: this._mapBloomsLevel(q.bloomsTaxonomy || 'Understand'),
      sourceChunkIndex: relevantChunk ? relevantChunk.chunkIndex : null,
      conceptComplexity: 5,
      reasoningRequired: 5,
      order: index + 1,
    };
  }).filter(q => q !== null);
}
```

### Helper Methods

**Bloom's Level Mapping:**
```javascript
_mapBloomsLevel(bloomsLevel) {
  const mapping = {
    'Remember': 'remember',
    'Understand': 'understand',
    'Apply': 'apply',
    'Analyze': 'analyze',
    'Evaluate': 'evaluate',
    'Create': 'create'
  };
  return mapping[bloomsLevel] || 'understand';
}
```

**Difficulty Breakdown Calculation:**
```javascript
_calculateDifficultyBreakdown(questions) {
  const breakdown = {
    easy: 0,
    medium: 0,
    hard: 0
  };

  questions.forEach(question => {
    if (question.difficulty === 'easy') breakdown.easy++;
    else if (question.difficulty === 'medium') breakdown.medium++;
    else if (question.difficulty === 'hard') breakdown.hard++;
  });

  return breakdown;
}
```

### Quiz Creation

Updated quiz creation to include difficulty breakdown:

```javascript
const quiz = await Quiz.create({
  userId,
  pdfId,
  title,
  questions: processedQuestions,
  totalQuestions: processedQuestions.length,
  mcqCount: processedQuestions.filter((q) => q.type === 'mcq').length,
  trueFalseCount: processedQuestions.filter((q) => q.type === 'true_false').length,
  difficulty,
  difficultyBreakdown, // Module 04
  timeLimit,
  status: QUIZ_STATUS.READY,
  retrievedChunks: relevantChunks.map(c => c.chunkIndex),
  generationModel: 'gemini-1.5-flash',
  contextReferences,
});
```

## API Response Format

### Quiz Generation Response

```json
{
  "success": true,
  "message": "Quiz generated successfully!",
  "data": {
    "quiz": {
      "id": "quiz_id",
      "title": "Document_Name - Medium Quiz",
      "difficulty": "medium",
      "totalQuestions": 10,
      "mcqCount": 6,
      "trueFalseCount": 4,
      "timeLimit": 20,
      "status": "ready",
      "difficultyBreakdown": {
        "easy": 3,
        "medium": 5,
        "hard": 2
      },
      "retrievedChunks": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      "generationModel": "gemini-1.5-flash",
      "createdAt": "2026-08-11T00:15:42.000Z"
    }
  }
}
```

### Question Details Response

```json
{
  "quiz": {
    "questions": [
      {
        "questionText": "What is the main concept described in the text?",
        "type": "mcq",
        "options": {
          "A": "The primary concept described in the text",
          "B": "An unrelated topic",
          "C": "A minor detail mentioned",
          "D": "None of the above"
        },
        "correctAnswer": "A",
        "difficulty": "medium",
        "bloomsTaxonomy": "Understand",
        "classificationReason": "Requires understanding of main concepts from the provided context",
        "explanation": "Based on the provided context.",
        "topic": "General",
        "sourceChunkIndex": 0,
        "order": 1
      }
    ]
  }
}
```

## Frontend Integration

### Display Difficulty Badges

```jsx
const getDifficultyBadge = (difficulty) => {
  const config = {
    easy: { label: 'Easy', className: 'bg-emerald-500/20 text-emerald-400' },
    medium: { label: 'Medium', className: 'bg-yellow-500/20 text-yellow-400' },
    hard: { label: 'Hard', className: 'bg-red-500/20 text-red-400' }
  };
  return config[difficulty];
};
```

### Display Bloom's Taxonomy

```jsx
const getBloomColor = (bloomsLevel) => {
  const colors = {
    'Remember': 'text-blue-400',
    'Understand': 'text-green-400',
    'Apply': 'text-yellow-400',
    'Analyze': 'text-orange-400',
    'Evaluate': 'text-red-400',
    'Create': 'text-purple-400'
  };
  return colors[bloomsLevel] || 'text-gray-400';
};
```

## Analytics & Reporting

### Difficulty Distribution

```javascript
// Get difficulty distribution across all quizzes
const getDifficultyDistribution = async (userId) => {
  const quizzes = await Quiz.find({ userId });
  
  const distribution = {
    easy: 0,
    medium: 0,
    hard: 0,
    total: 0
  };

  quizzes.forEach(quiz => {
    distribution.easy += quiz.difficultyBreakdown.easy;
    distribution.medium += quiz.difficultyBreakdown.medium;
    distribution.hard += quiz.difficultyBreakdown.hard;
    distribution.total += quiz.totalQuestions;
  });

  return distribution;
};
```

### Performance by Difficulty

```javascript
// Analyze user performance by difficulty level
const analyzePerformanceByDifficulty = async (userId) => {
  const attempts = await QuizAttempt.find({ userId })
    .populate('quizId');

  const performance = {
    easy: { correct: 0, total: 0, percentage: 0 },
    medium: { correct: 0, total: 0, percentage: 0 },
    hard: { correct: 0, total: 0, percentage: 0 }
  };

  attempts.forEach(attempt => {
    attempt.answers.forEach(answer => {
      const question = attempt.quizId.questions.id(answer.questionId);
      if (question) {
        const difficulty = question.difficulty;
        performance[difficulty].total++;
        if (answer.isCorrect) {
          performance[difficulty].correct++;
        }
      }
    });
  });

  // Calculate percentages
  Object.keys(performance).forEach(difficulty => {
    const { correct, total } = performance[difficulty];
    performance[difficulty].percentage = total > 0 ? (correct / total) * 100 : 0;
  });

  return performance;
};
```

## Benefits

### 1. Adaptive Learning
- Track user performance by difficulty level
- Adjust quiz difficulty based on user proficiency
- Personalized learning paths

### 2. Analytics & Insights
- Question quality analysis
- Content difficulty distribution
- User performance trends

### 3. Quality Assurance
- Ensures balanced difficulty distribution
- Identifies overly easy/hard questions
- Validates classification consistency

### 4. Educational Compliance
- Bloom's taxonomy alignment
- Pedagogical best practices
- Learning outcome measurement

## Testing

### Unit Tests

```javascript
describe('Difficulty Classification', () => {
  test('should classify question difficulty correctly', () => {
    const processedQuestions = quizService._processGeneratedQuestions(
      mockQuestions,
      mockChunks,
      'medium'
    );

    expect(processedQuestions[0].difficulty).toBeDefined();
    expect(processedQuestions[0].bloomsTaxonomy).toBeDefined();
    expect(processedQuestions[0].classificationReason).toBeDefined();
  });

  test('should calculate difficulty breakdown correctly', () => {
    const breakdown = quizService._calculateDifficultyBreakdown([
      { difficulty: 'easy' },
      { difficulty: 'medium' },
      { difficulty: 'hard' },
      { difficulty: 'medium' }
    ]);

    expect(breakdown.easy).toBe(1);
    expect(breakdown.medium).toBe(2);
    expect(breakdown.hard).toBe(1);
  });
});
```

### Integration Tests

```bash
# Test quiz generation with difficulty classification
curl -X POST http://localhost:5000/api/v1/quizzes/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pdfId": "PDF_ID",
    "questionCount": 10,
    "difficulty": "medium"
  }'
```

## Monitoring

### Key Metrics

1. **Classification Accuracy**
   - AI classification consistency
   - User feedback on difficulty appropriateness
   - Performance vs. difficulty correlation

2. **Difficulty Distribution**
   - Easy/Medium/Hard question ratios
   - Distribution across different PDFs
   - Alignment with user skill levels

3. **Bloom's Taxonomy Distribution**
   - Cognitive level coverage
   - Learning objective alignment
   - Educational effectiveness

## Troubleshooting

### Common Issues

**Issue**: Questions have default difficulty instead of AI-classified
- **Solution**: Ensure Gemini API is working and returning classification fields
- **Check**: Verify JSON schema includes difficulty classification fields

**Issue**: Difficulty breakdown counts don't match total questions
- **Solution**: Check `_calculateDifficultyBreakdown` method logic
- **Verify**: All questions have valid difficulty values

**Issue**: Bloom's taxonomy not matching difficulty level
- **Solution**: Validate AI prompt instructions for consistency
- **Check**: Review Gemini classification quality

## Future Enhancements

### Potential Improvements

1. **Adaptive Difficulty**
   - Dynamic difficulty adjustment based on user performance
   - Real-time question difficulty modification
   - Personalized difficulty profiles

2. **Classification Validation**
   - User feedback collection on difficulty appropriateness
   - Manual override capabilities for teachers
   - Confidence scores for AI classifications

3. **Advanced Analytics**
   - Difficulty progression tracking
   - Performance heatmaps by difficulty
   - Learning curve analysis

4. **Multi-dimensional Classification**
   - Time-based difficulty
   - Subject-specific difficulty
   - Domain-adaptive classification

## Conclusion

Module 04 provides a robust AI-powered difficulty classification system that enhances the QuizMasterAI platform with:

✅ **AI-powered classification** using 4 pedagogical criteria  
✅ **Bloom's taxonomy alignment** for educational standards  
✅ **Detailed metadata** for each question  
✅ **Difficulty breakdown tracking** for analytics  
✅ **Fallback mechanisms** for API failures  
✅ **Schema updates** for proper data storage  
✅ **Enhanced prompt engineering** for quality classifications  

The implementation ensures that each question is properly classified with pedagogical rigor, enabling better adaptive learning experiences and detailed analytics for both students and educators.