# Adaptive Quiz Generator Installation Guide

## Overview

This document provides installation and usage instructions for the Priority 22: Generate Adaptive Quiz service module for the QuizMaster AI backend.

## Features

- **AI-powered question generation** using fine-tuned transformers model
- **Difficulty adaptation** based on user performance history
- **Minimum 10 questions per quiz** enforcement
- **Content-aware generation** from retrieved RAG content
- **Performance history analysis** with skill level detection
- **Dynamic difficulty adjustment** during quiz attempts
- **Database integration** for quiz persistence

## Installation

### 1. Install Required Dependencies

```bash
# Activate your virtual environment
source venv/bin/activate

# Install transformers and torch
pip install transformers torch

# If you have GPU support, install CUDA-compatible torch
pip install transformers torch --index-url https://download.pytorch.org/whl/cu118
```

### 2. Verify Installation

```bash
python -c "import transformers; import torch; print('✅ All dependencies installed')"
```

## Configuration

### Model Configuration

The adaptive quiz generator uses your existing fine-tuned model:

```python
# Default model path
MODEL_PATH = "./fine_tuned_quiz_model"

# Custom model path
generator = AdaptiveQuizGenerator(
    model_path="./custom_model_path"
)
```

### Environment Variables (Optional)

```bash
# Set model path
export ADAPTIVE_MODEL_PATH="./fine_tuned_quiz_model"

# Set minimum questions (default: 10)
export MIN_QUIZ_QUESTIONS="10"

# Set default time limit (default: 20 minutes)
export DEFAULT_TIME_LIMIT="20"
```

## Usage

### Basic Usage

```python
from adaptive_quiz_generator import (
    get_adaptive_generator,
    AdaptiveQuizRequest,
    DifficultyLevel
)

# Get generator instance
generator = get_adaptive_generator()

# Analyze user performance
performance_history = {
    'total_quizzes_completed': 5,
    'scores': [75, 80, 85, 82, 88],
    'completion_times': [300, 280, 290, 270, 285],
    'difficulty_distribution': {'easy': 10, 'medium': 30, 'hard': 10},
    'topic_performance': {
        'python': 85,
        'machine learning': 78
    },
    'last_quiz_date': '2024-01-15T10:30:00'
}

user_performance = generator.analyze_user_performance(1, performance_history)

# Determine adaptive difficulty
adaptive_difficulty = generator.determine_adaptive_difficulty(user_performance)
print(f"Recommended difficulty: {adaptive_difficulty.value}")

# Generate adaptive quiz
request = AdaptiveQuizRequest(
    user_id=1,
    topic="python programming",
    retrieved_content=[
        "Python is a high-level programming language",
        "Lists and dictionaries are key data structures"
    ],
    num_questions=10
)

quiz = generator.generate_adaptive_quiz(request, user_performance)
print(f"Generated quiz: {quiz.title}")
print(f"Questions: {len(quiz.questions)}")
```

### Integration with RAG Service

```python
from adaptive_quiz_integration import get_adaptive_manager
from rag_integration import get_rag_manager

# Get managers
adaptive_manager = get_adaptive_manager()
rag_manager = get_rag_manager()

# Retrieve content for quiz generation
retrieved_content = rag_manager.retrieve_content_for_quiz(
    query="python programming basics",
    topic="python",
    difficulty="medium",
    num_questions=10
)

# Extract content text
content_texts = [item['content'] for item in retrieved_content]

# Generate adaptive quiz
quiz = adaptive_manager.generate_adaptive_quiz_for_user(
    user_id=1,
    topic="python programming",
    retrieved_content=content_texts,
    num_questions=10
)
```

### FastAPI Integration

```python
from adaptive_quiz_integration import create_adaptive_quiz_endpoint
from fastapi import FastAPI

app = FastAPI()

# Add adaptive quiz router
adaptive_router = create_adaptive_quiz_endpoint()
app.include_router(adaptive_router)

# The endpoint will be available at:
# POST /api/v1/quizzes/adaptive/generate
```

## Business Rules Implementation

### 1. Difficulty Adaptation to User Level

The system analyzes user performance and adjusts difficulty:

```python
# Performance analysis
user_performance = generator.analyze_user_performance(user_id, performance_data)

# Difficulty determination logic:
# - Average score >= 85% → Hard difficulty
# - Average score >= 70% → Medium difficulty  
# - Average score >= 50% → Medium difficulty
# - Average score < 50% → Easy difficulty
```

### 2. Minimum 10 Questions Per Quiz

Enforced automatically:

```python
# Even if user requests fewer, minimum is enforced
request = AdaptiveQuizRequest(
    user_id=1,
    topic="python",
    retrieved_content=content,
    num_questions=5  # Will be increased to 10
)

quiz = generator.generate_adaptive_quiz(request, user_performance)
# quiz.questions will have 10 questions minimum
```

### 3. Content-Aware Generation

Questions generated from retrieved RAG content:

```python
# Content from RAG service
retrieved_content = [
    "Machine learning algorithms learn from data",
    "Neural networks mimic brain structure"
]

# Questions generated specifically from this content
for question in quiz.questions:
    print(f"Context: {question.context}")
    print(f"Question: {question.question}")
```

## Performance History Analysis

### User Performance Metrics

The system tracks:

- **Total quizzes completed**
- **Average score across all attempts**
- **Average time per question**
- **Difficulty distribution** (easy/medium/hard counts)
- **Recent scores** (last 10 for trend analysis)
- **Strong topics** (topics with score >= 80%)
- **Weak topics** (topics with score < 60%)
- **Last quiz date** (for recency weighting)

### Example Performance Data

```python
performance_history = {
    'total_quizzes_completed': 15,
    'scores': [75, 80, 85, 82, 88, 90, 78, 85, 92, 87],
    'completion_times': [300, 280, 290, 270, 285, 295, 275, 280, 290, 285],
    'difficulty_distribution': {
        'easy': 20,
        'medium': 50,
        'hard': 30
    },
    'topic_performance': {
        'python': 85,
        'machine learning': 78,
        'data structures': 72,
        'algorithms': 80
    },
    'last_quiz_date': '2024-01-15T10:30:00'
}
```

## Dynamic Difficulty Adjustment

### During Quiz Attempts

The system can adjust difficulty in real-time:

```python
# Track recent answers
recent_answers = [True, True, True]  # 3 consecutive correct

# Adjust difficulty
new_difficulty = generator.adjust_difficulty_during_quiz(
    current_difficulty=DifficultyLevel.MEDIUM,
    recent_answers=recent_answers,
    adjustment_threshold=3
)

# Logic:
# - 3 consecutive correct → increase difficulty
# - 3 consecutive incorrect → decrease difficulty
# - Mixed performance → maintain current level
```

## Database Integration

### Saving Generated Quizzes

```python
from adaptive_quiz_integration import get_adaptive_manager
from database import get_db

manager = get_adaptive_manager()
db = next(get_db())

# Generate quiz
quiz = manager.generate_adaptive_quiz_for_user(
    user_id=1,
    topic="python",
    retrieved_content=content_texts,
    db=db
)

# Save to database
quiz_id = manager.save_adaptive_quiz_to_db(quiz, db)
print(f"Saved quiz with ID: {quiz_id}")
```

### Retrieving User Performance

```python
# Get performance from database
performance_data = manager.get_user_performance_from_db(user_id=1, db=db)

# Analyze performance
user_performance = generator.analyze_user_performance(user_id, performance_data)
```

## Question Types Supported

The generator supports multiple question types:

```python
from adaptive_quiz_generator import QuestionType

# Generate different question types
question_types = [
    QuestionType.MULTIPLE_CHOICE,
    QuestionType.TRUE_FALSE,
    QuestionType.SHORT_ANSWER,
    QuestionType.FILL_BLANK
]

request = AdaptiveQuizRequest(
    user_id=1,
    topic="python",
    retrieved_content=content,
    question_types=question_types,
    num_questions=12
)
```

## Testing

### Run Built-in Tests

```bash
# Test adaptive quiz generator
python adaptive_quiz_generator.py

# Test integration
python adaptive_quiz_integration.py
```

### Expected Output

```
🧪 Testing Adaptive Quiz Generator
🤖 Loading adaptive quiz model from ./fine_tuned_quiz_model...
✅ Adaptive quiz model loaded successfully
📊 User Performance Analysis:
   Average Score: 82.0
   Strong Topics: ['python']
   Weak Topics: ['data structures']
🎯 Adaptive Difficulty: medium

📝 Generated Quiz: Adaptive Quiz: artificial intelligence (Medium Level)
   Difficulty: medium
   Questions: 10
   Time Limit: 20 minutes

📋 Sample Questions:
1. What is the main concept?
   Difficulty: medium
   Type: multiple_choice
   Options: ['Option A', 'Option B', 'Option C', 'Option D']
   Correct: Option A
```

## Troubleshooting

### Model Not Loading

If the model fails to load:

```bash
# Check model path
ls -la ./fine_tuned_quiz_model/

# Re-download or re-train model if needed
```

### Transformers Not Available

```bash
pip install transformers torch
```

### Database Integration Issues

If database models are not available:

```python
# The system will use mock data for testing
performance_data = manager._get_mock_performance(user_id)
```

### Memory Issues

For large quiz generation:

```python
# Reduce question count temporarily
request = AdaptiveQuizRequest(
    user_id=1,
    topic="python",
    retrieved_content=content,
    num_questions=10  # Minimum allowed
)
```

## Architecture

```
User Request → Performance Analysis → Difficulty Determination
                                              ↓
Content Retrieval (RAG) → Question Generation → Quiz Assembly
                                              ↓
                                          Database Storage
```

## Dependencies

- `transformers`: AI model for question generation
- `torch`: PyTorch for model inference
- `numpy`: Numerical operations
- `sqlalchemy`: Database integration (already installed)
- `pydantic`: Data validation (already installed)

## Performance Optimization

### Model Loading

```python
# Use singleton pattern to avoid reloading
generator = get_adaptive_generator()  # Loads once
```

### Content Caching

```python
# Cache retrieved content for multiple quiz generations
content_cache = {}

if topic not in content_cache:
    content_cache[topic] = rag_manager.retrieve_content_for_quiz(...)
```

### Batch Generation

```python
# Generate multiple questions in parallel
# (Advanced - requires async implementation)
```

## Next Steps

1. Install dependencies
2. Test with sample performance data
3. Integrate with existing quiz endpoints
4. Connect to RAG service for content
5. Add to quiz generation pipeline
6. Monitor and optimize performance

## API Endpoints

### New Endpoints Added

- `POST /api/v1/quizzes/adaptive/generate` - Generate adaptive quiz
- `GET /api/v1/users/{user_id}/performance` - Get user performance
- `POST /api/v1/quizzes/{quiz_id}/adjust-difficulty` - Dynamic difficulty adjustment

### Integration with Existing Endpoints

The adaptive quiz generator can be integrated into:

- Existing quiz generation endpoint
- PDF upload workflow
- User dashboard analytics
- Quiz attempt tracking