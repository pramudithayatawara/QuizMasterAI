# Module 05: Adaptive Quiz Engine

## Overview
Module 05 implements an adaptive quiz engine that tracks user performance, analyzes attempt history, and dynamically adjusts recommended difficulty levels based on predefined rules. The system ensures appropriate challenge levels by progressing users who consistently perform well and regressing users who struggle.

## Architecture

### Adaptive Pipeline

1. **Quiz Attempt Tracking** - Store detailed attempt history
2. **Performance Analysis** - Analyze recent attempts for patterns
3. **Difficulty Calculation** - Apply adaptive rules for progression/regression
4. **Dynamic Timer Assignment** - Set time limits based on difficulty
5. **User Profile Updates** - Update user's current difficulty level

## Adaptive Rules

### Performance Thresholds

- **High Score**: ≥ 80% (excellent performance)
- **Low Score**: < 50% (struggling performance)
- **Acceptable Range**: 50% - 79% (maintain current level)

### Progression Rules

#### Difficulty Progression (Increase)
- **Trigger**: 3 consecutive high scores (≥ 80%)
- **Action**: Increase difficulty level
- **Example**: Easy → Medium → Hard

#### Difficulty Regression (Decrease)
- **Trigger**: 3 consecutive low scores (< 50%)
- **Action**: Decrease difficulty level
- **Example**: Hard → Medium → Easy

#### Maintain Current Level
- **Condition**: Mixed performance or acceptable range scores
- **Action**: No difficulty change

### Time Limit Rules

**Dynamic Timer Assignment based on difficulty:**
- **Easy**: 15 minutes (900 seconds)
- **Medium**: 20 minutes (1200 seconds)
- **Hard**: 25 minutes (1500 seconds)

## Schema Updates

### QuizAttempt Model Updates

**File**: `models/QuizAttempt.model.js`

```javascript
// Module 05: Adaptive Engine Fields
previousDifficulty: {
  type: String,
  enum: Object.values(DIFFICULTY),
  default: null,
},

adaptiveAdjustment: {
  type: String,
  enum: ['increased', 'decreased', 'maintained'],
  default: 'maintained',
},
```

**Enhanced Static Method:**
```javascript
quizAttemptSchema.statics.getLastNAttempts = function (userId, n = 10) {
  return this.find({
    userId,
    status: ATTEMPT_STATUS.COMPLETED,
  })
    .sort({ completedAt: -1 })
    .limit(n)
    .select('percentage difficulty completedAt score adaptiveAdjustment previousDifficulty');
};
```

### User Model Updates

**File**: `models/User.model.js`

The User model already includes the adaptive field:
```javascript
// ─── Adaptive Engine: Current Difficulty ────────────────────
currentDifficulty: {
  type: String,
  enum: Object.values(DIFFICULTY),
  default: DIFFICULTY.EASY,
},
```

## Service Implementation

### Adaptive Service

**File**: `services/adaptive/adaptive.service.js`

**Key Features:**

#### 1. Time Limit Calculation
```javascript
static getTimeLimit(difficulty) {
  return this.TIME_LIMITS[difficulty] || this.TIME_LIMITS[DIFFICULTY.MEDIUM];
}

static getTimeLimitSeconds(difficulty) {
  return this.getTimeLimit(difficulty) * 60;
}
```

#### 2. Performance Analysis
```javascript
static async analyzePerformance(userId) {
  // Get last N completed attempts
  const recentAttempts = await QuizAttempt.getLastNAttempts(userId, 10);

  // Calculate performance metrics
  const metrics = this._calculateMetrics(recentAttempts);

  // Determine recommended difficulty
  const recommendation = this._calculateRecommendation(metrics, recentAttempts);

  return {
    success: true,
    userId,
    currentDifficulty: metrics.currentDifficulty,
    recommendedDifficulty: recommendation.difficulty,
    shouldAdjust: recommendation.shouldAdjust,
    adjustmentReason: recommendation.reason,
    metrics: {
      totalAttempts: recentAttempts.length,
      averageScore: metrics.averageScore,
      highScoreCount: metrics.highScoreCount,
      lowScoreCount: metrics.lowScoreCount,
      consecutiveHighScores: metrics.consecutiveHighScores,
      consecutiveLowScores: metrics.consecutiveLowScores,
      recentPerformance: recentAttempts.map(attempt => ({
        score: attempt.percentage,
        difficulty: attempt.difficulty,
        completedAt: attempt.completedAt
      }))
    }
  };
}
```

#### 3. Difficulty Update After Submission
```javascript
static async updateDifficultyAfterSubmission(userId, quizData) {
  const { scorePercentage, difficulty } = quizData;

  // Get user's current difficulty
  const user = await User.findById(userId);
  const currentDifficulty = user.currentDifficulty || DIFFICULTY.EASY;

  // Get recent attempts including this one
  const recentAttempts = await QuizAttempt.getLastNAttempts(userId, 3);

  // Calculate consecutive performance
  const consecutiveAnalysis = this._analyzeConsecutivePerformance(recentAttempts);

  let newDifficulty = currentDifficulty;
  let shouldAdjust = false;
  let adjustmentReason = null;

  // Check for difficulty progression (3 consecutive high scores)
  if (consecutiveAnalysis.consecutiveHighScores >= 3) {
    newDifficulty = this._getNextDifficulty(currentDifficulty, 'increase');
    shouldAdjust = true;
    adjustmentReason = `Excellent performance! 3 consecutive high scores (80%+). Increasing difficulty.`;
  }
  // Check for difficulty regression (3 consecutive low scores)
  else if (consecutiveAnalysis.consecutiveLowScores >= 3) {
    newDifficulty = this._getNextDifficulty(currentDifficulty, 'decrease');
    shouldAdjust = true;
    adjustmentReason = `Struggling with current level. 3 consecutive low scores (<50%). Decreasing difficulty.`;
  }
  // Otherwise maintain current difficulty
  else {
    adjustmentReason = 'Performance is within acceptable range. Maintaining current difficulty.';
  }

  // Update user's difficulty if adjustment is needed
  if (shouldAdjust && newDifficulty !== currentDifficulty) {
    await User.findByIdAndUpdate(userId, {
      currentDifficulty: newDifficulty
    });
  }

  // Update the most recent QuizAttempt with adaptive adjustment
  const recentAttempt = await QuizAttempt.findOne({
    userId,
    status: ATTEMPT_STATUS.COMPLETED
  }).sort({ completedAt: -1 });

  if (recentAttempt) {
    const adjustmentType = shouldAdjust && newDifficulty !== currentDifficulty 
      ? (this.DIFFICULTY_LEVELS.indexOf(newDifficulty) > this.DIFFICULTY_LEVELS.indexOf(currentDifficulty) ? 'increased' : 'decreased')
      : 'maintained';

    await QuizAttempt.findByIdAndUpdate(recentAttempt._id, {
      adaptiveAdjustment: adjustmentType,
      previousDifficulty: currentDifficulty
    });
  }

  return {
    success: true,
    userId,
    previousDifficulty: currentDifficulty,
    newDifficulty,
    shouldAdjust,
    adjustmentReason,
    scorePercentage,
    consecutiveAnalysis
  };
}
```

#### 4. Performance Statistics
```javascript
static async getUserPerformanceStats(userId) {
  const allAttempts = await QuizAttempt.find({
    userId,
    status: ATTEMPT_STATUS.COMPLETED
  }).sort({ completedAt: -1 });

  const scores = allAttempts.map(a => a.percentage);
  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const highestScore = Math.max(...scores);
  const lowestScore = Math.min(...scores);

  // Calculate difficulty distribution
  const difficultyDistribution = {
    easy: allAttempts.filter(a => a.difficulty === DIFFICULTY.EASY).length,
    medium: allAttempts.filter(a => a.difficulty === DIFFICULTY.MEDIUM).length,
    hard: allAttempts.filter(a => a.difficulty === DIFFICULTY.HARD).length
  };

  return {
    totalAttempts: allAttempts.length,
    averageScore: Math.round(averageScore),
    highestScore,
    lowestScore,
    difficultyDistribution,
    currentDifficulty: user.currentDifficulty,
    recentAttempts: allAttempts.slice(0, 10).map(attempt => ({
      quizId: attempt.quizId,
      score: attempt.percentage,
      difficulty: attempt.difficulty,
      completedAt: attempt.completedAt,
      timeTaken: attempt.timeTaken
    }))
  };
}
```

## Controller Updates

### Quiz Controller Updates

**File**: `controllers/quiz.controller.js`

**Import Adaptive Service:**
```javascript
const adaptiveService = require('../services/adaptive/adaptive.service');
```

**Enhanced Quiz Submission:**
```javascript
submit = asyncHandler(async (req, res) => {
  const { answers, timeTaken } = req.body;
  const { attemptId } = req.params;

  if (!answers || !Array.isArray(answers)) {
    throw new AppError('Answers array is required.', 400);
  }

  // Submit and evaluate
  const evaluation = await quizService.submitQuiz(
    attemptId,
    req.user._id,
    answers,
    timeTaken || 0
  );

  // Module 05: Adaptive difficulty adjustment
  const adaptiveUpdate = await adaptiveService.updateDifficultyAfterSubmission(
    req.user._id,
    {
      scorePercentage: evaluation.percentage,
      difficulty: evaluation.difficulty
    }
  );

  // Award gamification XP (async)
  gamificationService
    .processQuizCompletion(req.user._id, evaluation)
    .catch((err) => {
      console.error('Gamification error:', err.message);
    });

  return ApiResponse.success(
    res,
    200,
    'Quiz submitted successfully!',
    { 
      evaluation,
      adaptive: adaptiveUpdate
    }
  );
});
```

**New Endpoints:**
```javascript
/**
 * @route   GET /api/v1/adaptive/recommended-difficulty
 * @desc    Get recommended difficulty based on recent performance - Module 05
 * @access  Private
 */
getRecommendedDifficulty = asyncHandler(async (req, res) => {
  const recommendation = await adaptiveService.analyzePerformance(req.user._id);

  return ApiResponse.success(
    res,
    200,
    'Difficulty recommendation calculated.',
    recommendation
  );
});

/**
 * @route   GET /api/v1/adaptive/performance-stats
 * @desc    Get comprehensive user performance statistics - Module 05
 * @access  Private
 */
getPerformanceStats = asyncHandler(async (req, res) => {
  const stats = await adaptiveService.getUserPerformanceStats(req.user._id);

  return ApiResponse.success(
    res,
    200,
    'Performance statistics retrieved.',
    stats
  );
});
```

## Quiz Service Updates

### Dynamic Timer Assignment

**File**: `services/quiz/quiz.service.js`

**Updated Time Limit Calculation:**
```javascript
// Step 7: Calculate time limit based on difficulty - Module 05
const adaptiveService = require('../adaptive/adaptive.service');
const timeLimit = adaptiveService.getTimeLimit(difficulty);
```

**Enhanced Quiz Submission:**
```javascript
// Update attempt with Module 05 adaptive fields
await QuizAttempt.findByIdAndUpdate(attemptId, {
  answers: evaluation.details.map((d) => ({
    questionId: d.questionId,
    answer: d.userAnswer,
    isCorrect: d.isCorrect,
    timeTaken: 0,
  })),
  score: evaluation.correct,
  percentage: evaluation.percentage,
  correctCount: evaluation.correct,
  wrongCount: evaluation.wrong,
  skippedCount: evaluation.skipped,
  timeTaken: actualTime,
  status: ATTEMPT_STATUS.COMPLETED,
  isAutoSubmitted: isAutoSubmit,
  completedAt: new Date(),
  weakTopics: evaluation.weakTopics,
  // Module 05: Adaptive engine fields
  previousDifficulty: attempt.difficulty,
  adaptiveAdjustment: 'maintained', // Will be updated by adaptive service
});
```

## API Routes

### New Adaptive Endpoints

**File**: `routes/quiz.routes.js`

```javascript
// Module 05: Adaptive Quiz Engine Routes

// Get recommended difficulty based on recent performance
router.get(
  '/adaptive/recommended-difficulty',
  quizController.getRecommendedDifficulty
);

// Get comprehensive user performance statistics
router.get(
  '/adaptive/performance-stats',
  quizController.getPerformanceStats
);
```

## API Response Formats

### Recommended Difficulty Response

```json
{
  "success": true,
  "message": "Difficulty recommendation calculated.",
  "data": {
    "success": true,
    "userId": "user_id",
    "currentDifficulty": "medium",
    "recommendedDifficulty": "hard",
    "shouldAdjust": true,
    "adjustmentReason": "Excellent performance! 3 consecutive high scores (80%+). Recommended to increase difficulty.",
    "metrics": {
      "totalAttempts": 8,
      "averageScore": 85,
      "highScoreCount": 6,
      "lowScoreCount": 1,
      "consecutiveHighScores": 3,
      "consecutiveLowScores": 0,
      "recentPerformance": [
        {
          "score": 92,
          "difficulty": "medium",
          "completedAt": "2026-08-11T00:15:42.000Z"
        },
        {
          "score": 88,
          "difficulty": "medium",
          "completedAt": "2026-08-10T15:30:20.000Z"
        },
        {
          "score": 85,
          "difficulty": "medium",
          "completedAt": "2026-08-09T12:45:10.000Z"
        }
      ]
    }
  }
}
```

### Quiz Submission Response with Adaptive Update

```json
{
  "success": true,
  "message": "Quiz submitted successfully!",
  "data": {
    "evaluation": {
      "attemptId": "attempt_id",
      "correct": 8,
      "wrong": 2,
      "skipped": 0,
      "total": 10,
      "percentage": 80,
      "timeTaken": 1080,
      "isAutoSubmitted": false,
      "difficulty": "medium"
    },
    "adaptive": {
      "success": true,
      "userId": "user_id",
      "previousDifficulty": "medium",
      "newDifficulty": "hard",
      "shouldAdjust": true,
      "adjustmentReason": "Excellent performance! 3 consecutive high scores (80%+). Increasing difficulty.",
      "scorePercentage": 80,
      "consecutiveAnalysis": {
        "consecutiveHighScores": 3,
        "consecutiveLowScores": 0
      }
    }
  }
}
```

### Performance Statistics Response

```json
{
  "success": true,
  "message": "Performance statistics retrieved.",
  "data": {
    "totalAttempts": 25,
    "averageScore": 72,
    "highestScore": 95,
    "lowestScore": 35,
    "difficultyDistribution": {
      "easy": 8,
      "medium": 12,
      "hard": 5
    },
    "currentDifficulty": "medium",
    "recentAttempts": [
      {
        "quizId": "quiz_id",
        "score": 85,
        "difficulty": "medium",
        "completedAt": "2026-08-11T00:15:42.000Z",
        "timeTaken": 1080
      }
    ]
  }
}
```

## Testing

### Unit Tests

```javascript
describe('AdaptiveService', () => {
  test('should calculate correct time limit for easy difficulty', () => {
    const timeLimit = AdaptiveService.getTimeLimit('easy');
    expect(timeLimit).toBe(15);
  });

  test('should calculate correct time limit for hard difficulty', () => {
    const timeLimit = AdaptiveService.getTimeLimit('hard');
    expect(timeLimit).toBe(25);
  });

  test('should recommend difficulty increase after 3 high scores', async () => {
    // Mock attempts with 3 consecutive high scores
    const recommendation = await AdaptiveService.analyzePerformance(userId);
    expect(recommendation.shouldAdjust).toBe(true);
    expect(recommendation.recommendedDifficulty).toBe('hard');
  });

  test('should recommend difficulty decrease after 3 low scores', async () => {
    // Mock attempts with 3 consecutive low scores
    const recommendation = await AdaptiveService.analyzePerformance(userId);
    expect(recommendation.shouldAdjust).toBe(true);
    expect(recommendation.recommendedDifficulty).toBe('easy');
  });
});
```

### Integration Tests

```bash
# Test recommended difficulty endpoint
curl -X GET http://localhost:5000/api/v1/quizzes/adaptive/recommended-difficulty \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test performance stats endpoint
curl -X GET http://localhost:5000/api/v1/quizzes/adaptive/performance-stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test quiz submission with adaptive update
curl -X POST http://localhost:5000/api/v1/quizzes/attempt/ATTEMPT_ID/submit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      {"questionId": "q1", "answer": "A"},
      {"questionId": "q2", "answer": "B"}
    ],
    "timeTaken": 1080
  }'
```

## Monitoring

### Key Metrics

1. **Difficulty Progression Rate**
   - How often users increase difficulty
   - Time between difficulty increases
   - Success rate after difficulty changes

2. **Difficulty Regression Rate**
   - How often users decrease difficulty
   - Recovery rate after regression
   - User retention by difficulty level

3. **Performance Patterns**
   - Average score by difficulty level
   - Time taken by difficulty level
   - Completion rates by difficulty level

## Benefits

### For Students
- **Personalized Learning**: Difficulty adapts to individual performance
- **Appropriate Challenge**: Always working at optimal challenge level
- **Motivation**: Progressive difficulty keeps users engaged
- **Confidence Building**: Support when struggling, challenge when excelling

### For Educators
- **Insightful Analytics**: Track student progression patterns
- **Performance Monitoring**: Identify struggling vs. excelling students
- **Customized Learning**: Tailor content to individual needs
- **Data-Driven Decisions**: Make informed teaching adjustments

### For the Platform
- **Increased Engagement**: Adaptive difficulty improves user retention
- **Better Learning Outcomes**: Personalized challenge levels improve learning
- **Data Collection**: Rich performance data for analysis
- **Scalability**: Automated difficulty scaling for large user bases

## Future Enhancements

### Potential Improvements

1. **Granular Difficulty Levels**
   - Add intermediate difficulty levels (Easy+, Medium-, etc.)
   - Continuous difficulty scale rather than discrete levels

2. **Time-Based Adaptation**
   - Adjust difficulty based on time taken per question
   - Consider both accuracy and speed in difficulty decisions

3. **Topic-Specific Adaptation**
   - Track performance by topic/question type
   - Adjust difficulty based on weak areas

4. **Machine Learning Integration**
   - Use ML models for more sophisticated difficulty prediction
   - Personalized difficulty curves per user

5. **Social Comparison**
   - Compare user performance with peers at similar levels
   - Adjust difficulty based on relative performance

## Troubleshooting

### Common Issues

**Issue**: Difficulty not updating after quiz submission
- **Solution**: Verify QuizAttempt status is COMPLETED and percentage is calculated correctly
- **Check**: Ensure adaptive service is called in quiz submission controller

**Issue**: Time limits not matching difficulty
- **Solution**: Verify adaptive service is imported and used in quiz generation
- **Check**: Ensure difficulty parameter is passed correctly to getTimeLimit

**Issue**: Consecutive performance not tracking correctly
- **Solution**: Verify QuizAttempt.getLastNAttempts returns attempts in correct order
- **Check**: Ensure completedAt timestamps are set correctly

## Conclusion

Module 05 provides a robust adaptive quiz engine that:

✅ **Tracks user performance** with detailed attempt history  
✅ **Analyzes patterns** using consecutive performance analysis  
✅ **Dynamically adjusts difficulty** based on predefined rules  
✅ **Assigns appropriate time limits** based on difficulty levels  
✅ **Provides comprehensive analytics** for performance monitoring  
✅ **Maintains user engagement** through personalized challenge levels  
✅ **Supports educational goals** with adaptive learning principles  

The implementation ensures that users always work at an appropriate challenge level, maximizing learning outcomes while maintaining engagement and motivation.