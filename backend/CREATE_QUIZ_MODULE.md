# Create Quiz Page Implementation - Module 04 AI Difficulty Classification

## Overview
Implemented a comprehensive "Create Quiz Page" feature with Module 04 AI Difficulty Classification, allowing users to generate AI-powered quizzes from uploaded PDFs with automatic difficulty classification for each question.

## Frontend Implementation

### 1. CreateQuizPage Component
**File**: `src/pages/quiz/CreateQuizPage.jsx`

**Key Features:**
- ✅ **PDF Selection** - Fetch and display user's uploaded PDFs with search functionality
- ✅ **Quiz Configuration** - Title, difficulty, question count, time limit, adaptive mode
- ✅ **Module 04 Info** - AI Difficulty Classification explanation
- ✅ **Adaptive Mode Toggle** - Enable/disable adaptive difficulty
- ✅ **Generation Progress** - Animated progress modal with step-by-step updates
- ✅ **Auto-navigation** - Redirect to quiz play page after generation
- ✅ **Error Handling** - Comprehensive error handling with toast notifications

**UI Components:**
```jsx
// PDF Selection with Search
<div className="space-y-3 max-h-96 overflow-y-auto">
  {filteredPdfs.map((pdf) => (
    <motion.div
      onClick={() => handlePdfSelect(pdf)}
      className={cn(
        'p-4 rounded-xl border cursor-pointer transition-all',
        selectedPdf?._id === pdf._id
          ? 'bg-primary-500/10 border-primary-500/50'
          : 'bg-dark-800/40 border-dark-700 hover:border-primary-500/30'
      )}
    >
      {/* PDF Card with selection state */}
    </motion.div>
  ))}
</div>

// Difficulty Selection
<div className="grid grid-cols-3 gap-2">
  {Object.entries(DIFFICULTY_CONFIG).map(([key, config]) => (
    <button
      onClick={() => handleConfigChange('difficulty', key)}
      className={cn(
        'p-3 rounded-xl border transition-all text-center',
        quizConfig.difficulty === key
          ? config.bgClass + ' ' + config.textClass + ' ' + config.borderClass
          : 'bg-dark-800/40 border-dark-700 text-dark-400'
      )}
    >
      <div className="text-2xl mb-1">{config.icon}</div>
      <div className="text-sm font-medium">{config.label}</div>
    </button>
  ))}
</div>

// Adaptive Mode Toggle
<div className="flex items-center justify-between p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
  <div className="flex items-center gap-3">
    <Sparkles size={18} className="text-purple-400" />
    <div>
      <h4 className="font-medium text-purple-400">Adaptive Mode</h4>
      <p className="text-xs text-dark-400">AI adjusts difficulty based on performance</p>
    </div>
  </div>
  <button
    onClick={() => handleConfigChange('adaptiveMode', !quizConfig.adaptiveMode)}
    className={cn(
      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
      quizConfig.adaptiveMode ? 'bg-purple-600' : 'bg-dark-700'
    )}
  >
    <span className={cn(
      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
      quizConfig.adaptiveMode ? 'translate-x-6' : 'translate-x-1'
    )} />
  </button>
</div>

// Module 04 AI Difficulty Classification Info
<div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
  <div className="flex items-start gap-3">
    <Brain size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
    <div>
      <h4 className="font-medium text-blue-400 mb-1">AI Difficulty Classification</h4>
      <p className="text-xs text-dark-400">
        Each question will be automatically classified as Easy, Medium, or Hard based on concept complexity, context length, reasoning required, and Bloom's taxonomy level.
      </p>
    </div>
  </div>
</div>

// Generation Progress Modal
{isGenerating && (
  <motion.div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
    <Card padding="lg" className="max-w-md w-full">
      <div className="text-center space-y-6">
        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary-500 to-accent-500 rounded-full">
          <Brain size={36} className="text-white animate-pulse" />
        </div>
        <h3 className="text-xl font-bold text-dark-50">Creating Your Quiz</h3>
        <p className="text-dark-400 text-sm">{generationStep}</p>
        <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
          <motion.div
            animate={{ width: `${generationProgress}%` }}
            className="h-full bg-gradient-to-r from-primary-500 to-accent-500"
          />
        </div>
        {/* Feature highlights */}
      </div>
    </Card>
  </motion.div>
)}
```

### 2. Routes Configuration
**File**: `src/constants/routes.js`

**Added Route:**
```javascript
QUIZ_CREATE: '/quizzes/create',
```

**File**: `src/routes/index.jsx`

**Added Route:**
```javascript
const CreateQuizPage = lazy(() => import('../pages/quiz/CreateQuizPage.jsx'));

// In protected routes:
<Route path={ROUTES.QUIZ_CREATE} element={<CreateQuizPage />} />
```

**Route Order:** Placed before dynamic routes to prevent conflicts.

### 3. API Integration
**File**: `src/api/pdf.api.js`

**Added Method:**
```javascript
getAll: (params = {}) =>
  axiosInstance.get('/api/v1/pdfs', { params }),
```

**File**: `src/api/quiz.api.js`

**Existing Method:**
```javascript
generateQuiz: (data) =>
  axiosInstance.post('/api/v1/quizzes/generate', data),
```

### 4. Navigation Update
**File**: `src/pages/quiz/QuizListPage.jsx`

**Updated "Create Quiz" Button:**
```jsx
<Link to={ROUTES.QUIZ_CREATE}>
  <Button variant="primary" leftIcon={<Plus size={18} />}>
    Create Quiz
  </Button>
</Link>
```

## Backend Implementation

### 1. Quiz Model Schema (Already Complete)
**File**: `models/Quiz.model.js`

**Module 04 Fields Already Present:**
```javascript
// Question Schema
difficulty: {
  type: String,
  enum: Object.values(DIFFICULTY),
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

conceptComplexity: {
  type: Number,
  min: 0,
  max: 10,
  default: 5,
},

reasoningRequired: {
  type: Number,
  min: 0,
  max: 10,
  default: 5,
},

// Quiz Schema
difficultyBreakdown: {
  easy: { type: Number, default: 0 },
  medium: { type: Number, default: 0 },
  hard: { type: Number, default: 0 },
},
```

### 2. Quiz Service Module 04 Implementation
**File**: `services/quiz/quiz.service.js`

**Enhanced Prompt with Module 04 Classification:**
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
5. Provide a brief explanation for each correct answer

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

**Enhanced JSON Schema:**
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
            correctAnswer: { type: "string", enum: ["A", "B", "C", "D"] },
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
            explanation: { type: "string" },
            topic: { type: "string" }
          },
          required: ["questionText", "type", "options", "correctAnswer", "difficulty", "bloomsTaxonomy"]
        }
      }
    }
  };
}
```

**Enhanced Service Method:**
```javascript
async generateQuizFromPdf(pdfId, userId, options = {}) {
  // ... existing logic ...
  
  // Use custom title if provided
  const title = options.title || this._generateQuizTitle(pdf.originalName, difficulty);
  
  // Use custom time limit if provided
  const timeLimit = options.timeLimit || adaptiveService.getTimeLimit(difficulty);
  
  // Calculate difficulty breakdown - Module 04
  const difficultyBreakdown = this._calculateDifficultyBreakdown(processedQuestions);
  
  const quiz = await Quiz.create({
    userId,
    pdfId,
    title,
    questions: processedQuestions,
    totalQuestions: processedQuestions.length,
    mcqCount: processedQuestions.filter((q) => q.type === 'mcq').length,
    trueFalseCount: processedQuestions.filter((q) => q.type === 'true_false').length,
    difficulty,
    difficultyBreakdown,
    timeLimit,
    status: QUIZ_STATUS.READY,
    // ... other fields
  });
}
```

### 3. Controller Update
**File**: `controllers/quiz.controller.js`

**Enhanced Generate Method:**
```javascript
generate = asyncHandler(async (req, res) => {
  const { pdfId, title, difficulty, questionCount, timeLimit, adaptiveMode } = req.body;

  if (!pdfId) {
    throw new AppError('PDF ID is required.', 400, 'PDF_ID_REQUIRED');
  }

  const quiz = await quizService.generateQuizFromPdf(
    pdfId,
    req.user._id,
    { 
      title, 
      difficulty: difficulty || 'medium', 
      questionCount: questionCount || 10,
      timeLimit: timeLimit,
      adaptiveMode: adaptiveMode || false
    }
  );

  return ApiResponse.success(
    res,
    201,
    'Quiz generated successfully!',
    {
      quiz: {
        id: quiz._id,
        title: quiz.title,
        difficulty: quiz.difficulty,
        totalQuestions: quiz.totalQuestions,
        mcqCount: quiz.mcqCount,
        trueFalseCount: quiz.trueFalseCount,
        timeLimit: quiz.timeLimit,
        status: quiz.status,
        difficultyBreakdown: quiz.difficultyBreakdown,
        retrievedChunks: quiz.retrievedChunks,
        generationModel: quiz.generationModel,
        createdAt: quiz.createdAt,
      },
    }
  );
});
```

### 4. PDF API Integration
**File**: `controllers/pdf.controller.js`

**Existing Get All PDFs Method:**
```javascript
getAll = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const { status, page = 1, limit = 10 } = req.query;

  const filter = { userId };
  if (status) filter.status = status;

  const [pdfs, total] = await Promise.all([
    PdfDocument.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit)),
    PdfDocument.countDocuments(filter),
  ]);

  return ApiResponse.paginated(
    res,
    200,
    'PDFs retrieved successfully.',
    pdfs,
    {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    }
  );
});
```

**Route Configuration:**
```javascript
// routes/pdf.routes.js
router.get('/', protect, pdfController.getAll);
```

## Module 04 AI Difficulty Classification

### Classification Criteria

The AI classifies each question based on 4 criteria:

1. **Concept Complexity**
   - Easy: Direct recall of facts, definitions, or basic concepts
   - Medium: Understanding relationships, applying concepts to scenarios
   - Hard: Multi-concept synthesis, complex analysis, or integration

2. **Context Length**
   - Easy: Short, simple text (under 50 words)
   - Medium: Moderate complexity (50-100 words)
   - Hard: Detailed, technical text (over 100 words)

3. **Required Reasoning**
   - Easy: Single-step retrieval
   - Medium: Multi-step deduction or application
   - Hard: Complex problem-solving or evaluation

4. **Bloom's Taxonomy Level**
   - Easy: Remember, Understand
   - Medium: Apply, Analyze
   - Hard: Evaluate, Create

### Classification Rules

- Assign 'easy' if question involves basic recall/understanding with simple reasoning
- Assign 'medium' if question requires application/analysis with moderate complexity
- Assign 'hard' if question involves evaluation/creation with complex reasoning
- Each question must have a consistent difficulty across all 4 criteria
- Provide brief explanation for the difficulty classification

### Storage Format

Each question stores:
```json
{
  "questionText": "string",
  "type": "mcq | true_false",
  "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correctAnswer": "A",
  "explanation": "string",
  "difficulty": "easy | medium | hard",
  "bloomsTaxonomy": "Remember | Understand | Apply | Analyze | Evaluate | Create",
  "classificationReason": "string",
  "topic": "string",
  "conceptComplexity": 0-10,
  "reasoningRequired": 0-10
}
```

## User Flow

```
QuizListPage → Click "Create Quiz" → CreateQuizPage
     ↓                      ↓
    Browse Quizzes         Select PDF
                              ↓
                         Configure Quiz
                              ↓
                         Generate Quiz
                              ↓
                         Progress Modal
                              ↓
                    QuizPlayPage (new quiz)
```

## API Endpoints

### Frontend → Backend

1. **GET /api/v1/pdfs** - Fetch user's PDFs
   - Query: `{ userId, status?, page?, limit? }`
   - Response: `{ success, data: { pdfs, pagination } }`

2. **POST /api/v1/quizzes/generate** - Generate quiz
   - Body: `{ pdfId, title, difficulty, questionCount, timeLimit, adaptiveMode }`
   - Response: `{ success, data: { quiz: { id, title, difficulty, ... } } }`

## Design Consistency

### Tailwind CSS Classes
- **Colors**: Primary, Accent, Dark theme consistency
- **Spacing**: Consistent padding and margins
- **Typography**: Unified font sizes and weights
- **Animations**: Framer Motion for smooth transitions

### Lucide Icons
- FileText, Brain, Clock, Settings, Search, CheckCircle, AlertCircle
- Sparkles, Zap, BookOpen, BarChart3, Play, ChevronRight, Loader2, ArrowLeft, Plus

### Component Reuse
- Card, Button, Input, Spinner, EmptyState
- Consistent with existing QuizMasterAI components

## Benefits

### For Users
- **Intuitive Interface** - Clean, modern UI for quiz creation
- **PDF Selection** - Easy PDF selection with search functionality
- **Custom Configuration** - Full control over quiz settings
- **Adaptive Mode** - Optional adaptive difficulty adjustment
- **Progress Feedback** - Real-time generation progress
- **AI Classification** - Automatic difficulty classification for each question

### For the Platform
- **Module 04 Integration** - Seamless AI difficulty classification
- **Consistent Data Model** - Questions include all Module 04 fields
- **Scalable Architecture** - Can handle large PDFs and question counts
- **Error Handling** - Comprehensive error handling and user feedback
- **Performance Tracking** - Generation progress and step-by-step updates

## Testing

### Manual Testing Steps

1. **PDF Selection**
   - Upload a PDF
   - Navigate to Create Quiz page
   - Verify PDF appears in list
   - Test search functionality

2. **Quiz Configuration**
   - Select a PDF
   - Configure quiz settings
   - Test adaptive mode toggle
   - Verify time limit adjustment

3. **Quiz Generation**
   - Click "Generate Quiz with AI"
   - Observe progress modal
   - Verify successful generation
   - Check navigation to quiz play page

4. **Module 04 Classification**
   - Generate a quiz
   - Check question difficulty breakdown
   - Verify bloomsTaxonomy field
   - Check classificationReason field

### API Testing

```bash
# Test PDF fetching
curl -X GET http://localhost:5000/api/v1/pdfs \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test quiz generation
curl -X POST http://localhost:5000/api/v1/quizzes/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pdfId": "PDF_ID",
    "title": "Custom Quiz Title",
    "difficulty": "medium",
    "questionCount": 10,
    "timeLimit": 20,
    "adaptiveMode": false
  }'
```

## Troubleshooting

### Common Issues

**Issue**: PDFs not loading
- **Solution**: Verify PDF status is 'completed', check userId filter

**Issue**: Quiz generation fails
- **Solution**: Check Gemini API key, verify PDF has processed chunks

**Issue**: Difficulty classification missing
- **Solution**: Verify JSON schema includes difficulty fields, check prompt template

**Issue**: Navigation fails after generation
- **Solution**: Verify quiz._id is returned correctly, check route configuration

## Future Enhancements

### Potential Improvements

1. **Advanced Configuration**
   - Question type selection (MCQ only, True/False only)
   - Topic-specific question generation
   - Custom time per question

2. **Preview Functionality**
   - Preview questions before finalizing
   - Edit questions before saving
   - Reorder questions

3. **Template Management**
   - Save quiz templates
   - Quick configuration presets
   - Shared templates

4. **Batch Generation**
   - Generate multiple quizzes at once
   - Bulk PDF processing
   - Scheduled quiz generation

## Conclusion

The Create Quiz Page implementation provides a comprehensive, user-friendly interface for generating AI-powered quizzes with Module 04 AI Difficulty Classification. The implementation ensures:

✅ **PDF Selection** - Easy PDF selection with search and filtering  
✅ **Quiz Configuration** - Full control over quiz settings and options  
✅ **Module 04 Integration** - Automatic AI difficulty classification for each question  
✅ **Adaptive Mode** - Optional adaptive difficulty adjustment  
✅ **Progress Feedback** - Real-time generation progress with step-by-step updates  
✅ **Error Handling** - Comprehensive error handling and user notifications  
✅ **Design Consistency** - Matches existing QuizMasterAI components and styling  
✅ **Seamless Navigation** - Smooth flow from creation to quiz play  

The feature integrates perfectly with existing Modules 01-05 and provides a robust foundation for AI-powered quiz generation with intelligent difficulty classification.