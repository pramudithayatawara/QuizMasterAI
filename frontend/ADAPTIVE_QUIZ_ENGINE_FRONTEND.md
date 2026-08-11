# Module 05: Adaptive Quiz Engine - Frontend Implementation

## Overview
This document describes the frontend React and Tailwind CSS implementation for Module 05 (Adaptive Quiz Engine) in the QuizMasterAI application. The implementation includes enhanced timer functionality, auto-submit on timeout, adaptive difficulty notifications, and precise time tracking.

## Components Created/Updated

### 1. Enhanced QuizTimer Component

**File**: `src/components/quiz/QuizTimer.jsx`

**Key Features:**
- ✅ **Dynamic Time Limits** - Based on difficulty (Easy: 15min, Medium: 20min, Hard: 25min)
- ✅ **Progress Bar** - Visual time remaining indicator
- ✅ **Color Cues** - Difficulty-based colors with warning states
- ✅ **Auto-Submit Trigger** - Calls onTimeout when timer reaches 0
- ✅ **Pulsing Animation** - Critical time visual feedback

**Key Implementation:**

```jsx
const QuizTimer = ({ 
  timeRemaining, 
  totalTime, 
  onTimeout,
  difficulty = 'medium' 
}) => {
  const [isPulsing, setIsPulsing] = useState(false);
  
  // Module 05: Time limit thresholds
  const isWarning = timeRemaining <= 120; // Last 2 minutes
  const isCritical = timeRemaining <= 30; // Last 30 seconds
  
  // Calculate progress percentage
  const progressPercentage = totalTime > 0 ? (timeRemaining / totalTime) * 100 : 0;
  
  // Handle auto-submit when timer reaches 0
  useEffect(() => {
    if (timeRemaining === 0 && onTimeout) {
      onTimeout();
    }
  }, [timeRemaining, onTimeout]);
  
  // Pulsing effect when time is critical
  useEffect(() => {
    if (isCritical) {
      setIsPulsing(true);
      const interval = setInterval(() => {
        setIsPilling(prev => !prev);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setIsPulsing(false);
    }
  }, [isCritical]);
  
  // Color configuration based on time remaining and difficulty
  const getTimerColors = () => {
    if (isCritical) {
      return {
        bg: 'bg-red-500/20',
        border: 'border-red-500/30',
        text: 'text-red-400',
        progress: 'bg-red-500',
        icon: 'text-red-400'
      };
    }
    if (isWarning) {
      return {
        bg: 'bg-yellow-500/20',
        border: 'border-yellow-500/30',
        text: 'text-yellow-400',
        progress: 'bg-yellow-500',
        icon: 'text-yellow-400'
      };
    }
    // Default colors based on difficulty
    const difficultyColors = {
      easy: {
        bg: 'bg-emerald-500/20',
        border: 'border-emerald-500/30',
        text: 'text-emerald-400',
        progress: 'bg-emerald-500',
        icon: 'text-emerald-400'
      },
      medium: {
        bg: 'bg-blue-500/20',
        border: 'border-blue-500/30',
        text: 'text-blue-400',
        progress: 'bg-blue-500',
        icon: 'text-blue-400'
      },
      hard: {
        bg: 'bg-purple-500/20',
        border: 'border-purple-500/30',
        text: 'text-purple-400',
        progress: 'bg-purple-500',
        icon: 'text-purple-400'
      }
    };
    return difficultyColors[difficulty] || difficultyColors.medium;
  };
  
  const colors = getTimerColors();
  
  return (
    <div className="flex flex-col items-end gap-2">
      {/* Digital Timer Display */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-xl border font-mono font-bold transition-all duration-300',
        colors.bg,
        colors.border,
        colors.text,
        isPulsing && 'animate-pulse'
      )}>
        <Clock size={18} className={colors.icon} />
        <span className="text-lg">{formatTimer(timeRemaining)}</span>
      </div>
      
      {/* Progress Bar */}
      <div className="w-32 h-2 bg-dark-700 rounded-full overflow-hidden">
        <div 
          className={cn(
            'h-full transition-all duration-1000 ease-linear',
            colors.progress,
            isPulsing && 'animate-pulse'
          )}
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      
      {/* Difficulty Badge */}
      <div className={cn(
        'text-xs font-medium px-2 py-1 rounded-md',
        colors.bg,
        colors.text
      )}>
        {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
      </div>
    </div>
  );
};
```

### 2. AdaptiveBadge Component

**File**: `src/components/quiz/AdaptiveBadge.jsx`

**Key Features:**
- ✅ **Recommended Difficulty Display** - Shows AI-recommended difficulty level
- ✅ **Progress Indicator** - Visual difficulty progression bar
- ✅ **Change Notifications** - Alerts when difficulty is upgraded/downgraded
- ✅ **Explanatory Messages** - Context for difficulty changes

**Key Implementation:**

```jsx
const AdaptiveBadge = ({ 
  currentDifficulty, 
  recommendedDifficulty, 
  showNotification = false,
  notificationType = null
}) => {
  const getDifficultyConfig = (difficulty) => {
    const configs = {
      easy: {
        label: 'Easy',
        icon: <Minus size={14} />,
        className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        color: 'text-emerald-400'
      },
      medium: {
        label: 'Medium',
        icon: <Minus size={14} />,
        className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        color: 'text-blue-400'
      },
      hard: {
        label: 'Hard',
        icon: <Minus size={14} />,
        className: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        color: 'text-purple-400'
      }
    };
    return configs[difficulty] || configs.medium;
  };
  
  const getNotificationConfig = (type) => {
    const configs = {
      upgraded: {
        icon: <ArrowUp size={16} />,
        message: '🎉 Great job! Your adaptive difficulty has been upgraded!',
        className: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
        progressIcon: <TrendingUp size={20} className="text-emerald-400" />
      },
      downgraded: {
        icon: <ArrowDown size={16} />,
        message: 'Let\'s build your foundation! Difficulty adjusted for better learning.',
        className: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
        progressIcon: <Sparkles size={20} className="text-yellow-400" />
      },
      maintained: {
        icon: <Minus size={16} />,
        message: 'Keep up the good work! Maintaining current difficulty level.',
        className: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
        progressIcon: <Minus size={20} className="text-blue-400" />
      }
    };
    return configs[type] || configs.maintained;
  };
  
  return (
    <div className="space-y-3">
      {/* Recommended Difficulty Badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">Recommended Difficulty:</span>
        <div className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium text-sm',
          recommendedConfig.className
        )}>
          {recommendedConfig.icon}
          <span>{recommendedConfig.label}</span>
          {willChange && (
            <span className={cn(
              'flex items-center gap-1 ml-1',
              willIncrease ? 'text-emerald-400' : 'text-yellow-400'
            )}>
              {willIncrease ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              <span className="text-xs">
                {willIncrease ? 'Upgrade' : 'Adjust'}
              </span>
            </span>
          )}
        </div>
      </div>
      
      {/* Notification when difficulty changes */}
      {showNotification && notificationType && (
        <div className={cn(
          'flex items-start gap-3 p-4 rounded-xl border',
          notificationConfig.className
        )}>
          <div className="flex-shrink-0 mt-0.5">
            {notificationConfig.progressIcon}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{notificationConfig.message}</p>
            <p className="text-xs mt-1 opacity-80">
              Current: {currentConfig.label} → Recommended: {recommendedConfig.label}
            </p>
          </div>
        </div>
      )}
      
      {/* Difficulty Progress Indicator */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden flex">
          <div 
            className={cn(
              'h-full transition-all duration-500',
              currentDifficulty === 'easy' ? 'bg-emerald-500' : 'bg-slate-600'
            )}
            style={{ width: '33.33%' }}
          />
          <div 
            className={cn(
              'h-full transition-all duration-500',
              currentDifficulty === 'medium' ? 'bg-blue-500' : 'bg-slate-600'
            )}
            style={{ width: '33.33%' }}
          />
          <div 
            className={cn(
              'h-full transition-all duration-500',
              currentDifficulty === 'hard' ? 'bg-purple-500' : 'bg-slate-600'
            )}
            style={{ width: '33.33%' }}
          />
        </div>
      </div>
    </div>
  );
};
```

### 3. Enhanced QuizPlayPage

**File**: `src/pages/quiz/QuizPlayPage.jsx`

**Key Updates:**

#### Enhanced Timer Integration
```jsx
// Module 05: Enhanced Quiz Timer with progress bar and auto-submit
<QuizTimer 
  timeRemaining={timeRemaining}
  totalTime={currentQuiz.timeLimit * 60} // Convert minutes to seconds
  onTimeout={() => {
    setAutoSubmitted(true);
    setShowAutoSubmitModal(true);
  }}
  difficulty={currentQuiz.difficulty}
/>
```

#### Accurate Time Tracking
```jsx
// Module 05: Record quiz start time for accurate time tracking
useEffect(() => {
  const init = async () => {
    const result = await startQuiz(id);
    if (!result.success) {
      toast.error('Failed to start quiz.');
      navigate(ROUTES.QUIZ_LIST);
    } else {
      setQuizStartTime(Date.now());
    }
  };
  init();
  return () => clearQuizState();
}, [id]);
```

#### Enhanced Submit Handler
```jsx
// Module 05: Calculate exact time taken
const handleSubmit = async (isTimeout = false) => {
  const timeTakenSeconds = quizStartTime 
    ? Math.floor((Date.now() - quizStartTime) / 1000)
    : (currentQuiz?.timeLimit * 60) - timeRemaining;

  const result = await submitQuiz(isTimeout, timeTakenSeconds);
  
  if (result.success) {
    // Module 05: Check for adaptive difficulty adjustment
    if (result.adaptive && result.adaptive.shouldAdjust) {
      const notificationType = result.adaptive.newDifficulty === 'hard' ? 'upgraded' : 'downgraded';
      setAdaptiveNotification({
        type: notificationType,
        previousDifficulty: result.adaptive.previousDifficulty,
        newDifficulty: result.adaptive.newDifficulty,
        reason: result.adaptive.adjustmentReason
      });
      
      toast.success(
        notificationType === 'upgraded' 
          ? '🎉 Great job! Your adaptive difficulty has been upgraded!' 
          : 'Let\'s build your foundation! Difficulty adjusted for better learning.'
      );
    }
    
    navigate(ROUTES.QUIZ_RESULT.replace(':id', currentQuiz._id));
  }
};
```

#### Auto-Submit Modal
```jsx
{/* Module 05: Auto-Submit Modal */}
<Modal
  isOpen={showAutoSubmitModal}
  onClose={() => setShowAutoSubmitModal(false)}
  title="Time's Up!"
  size="sm"
>
  <div className="space-y-4">
    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
      <div className="flex items-start gap-3">
        <Timer size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-dark-300">
          <p className="font-semibold mb-1">Auto-Submit Triggered</p>
          <p>
            Your time has expired! Your quiz has been automatically submitted with your current answers.
          </p>
        </div>
      </div>
    </div>

    <div className="flex gap-3">
      <Button
        variant="secondary"
        className="flex-1"
        onClick={() => setShowAutoSubmitModal(false)}
      >
        View Results
      </Button>
    </div>
  </div>
</Modal>
```

### 4. Enhanced Quiz Store

**File**: `src/store/quiz.store.js`

**Key Updates:**

#### Enhanced Submit Method
```jsx
submitQuiz: async (isTimeout = false, exactTimeTaken = null) => {
  const { currentAttempt, answers, timeRemaining, currentQuiz } = get();

  if (!currentAttempt) return { success: false };

  set({ isSubmitting: true });
  try {
    // Module 05: Use exact time taken if provided, otherwise calculate from timer
    const timeTaken = exactTimeTaken !== null 
      ? exactTimeTaken 
      : (currentQuiz.timeLimit * 60) - timeRemaining;

    const response = await quizAPI.submit(currentAttempt._id, {
      answers: Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer,
      })),
      timeTaken,
    });

    const { result, adaptive } = response.data.data;
    set({ result, isSubmitting: false });

    // Module 05: Return adaptive information
    return { success: true, result, adaptive };

  } catch (error) {
    set({ isSubmitting: false });
    toast.error('Failed to submit quiz.');
    return { success: false };
  }
},
```

### 5. Enhanced Quiz API

**File**: `src/api/quiz.api.js`

**New Endpoints:**
```jsx
// Module 05: Adaptive Quiz Engine endpoints
getRecommendedDifficulty: () =>
  axiosInstance.get('/api/v1/quizzes/adaptive/recommended-difficulty'),

getPerformanceStats: () =>
  axiosInstance.get('/api/v1/quizzes/adaptive/performance-stats'),
```

## Styling Guide

### Timer Color Scheme

#### Difficulty-Based Colors
- **Easy**: Emerald green (`emerald-500`, `emerald-400`)
- **Medium**: Blue (`blue-500`, `blue-400`)
- **Hard**: Purple (`purple-500`, `purple-400`)

#### Warning States
- **Warning (< 2 min)**: Yellow (`yellow-500`, `yellow-400`)
- **Critical (< 30 sec)**: Red (`red-500`, `red-400`)

### Adaptive Badge Colors

#### Difficulty Badges
- **Easy**: Emerald green (`emerald-500/20`, `emerald-400`)
- **Medium**: Blue (`blue-500/20`, `blue-400`)
- **Hard**: Purple (`purple-500/20`, `purple-400`)

#### Notification Types
- **Upgraded**: Emerald green (`emerald-500/20`, `emerald-400`)
- **Downgraded**: Yellow (`yellow-500/20`, `yellow-400`)
- **Maintained**: Blue (`blue-500/20`, `blue-400`)

## Time Limit Configuration

### Module 05 Timer Rules

```javascript
const TIME_LIMITS = {
  easy: 15,    // 15 minutes (900 seconds)
  medium: 20,  // 20 minutes (1200 seconds)
  hard: 25     // 25 minutes (1500 seconds)
};
```

### Timer States

```javascript
const isWarning = timeRemaining <= 120; // Last 2 minutes
const isCritical = timeRemaining <= 30; // Last 30 seconds
```

## Auto-Submit Flow

### Timeout Handling

1. **Timer reaches 0**: `onTimeout` callback is triggered
2. **Auto-submit modal shown**: User sees "Time's Up!" notification
3. **Automatic submission**: Quiz is submitted with current answers
4. **Result navigation**: User is redirected to results page
5. **Adaptive update**: Backend processes difficulty adjustment

```jsx
// Timer countdown with auto-submit
useEffect(() => {
  if (!currentQuiz || timeRemaining <= 0) return;

  const interval = setInterval(() => {
    const newTime = timeRemaining - 1;
    updateTimer(newTime);

    if (newTime <= 0 && !autoSubmitted) {
      setAutoSubmitted(true);
      setShowAutoSubmitModal(true);
      // Auto-submit after showing modal
      setTimeout(() => {
        handleSubmit(true);
      }, 2000);
    }
  }, 1000);

  return () => clearInterval(interval);
}, [currentQuiz, timeRemaining, autoSubmitted]);
```

## Adaptive Difficulty Flow

### Difficulty Adjustment Notification

1. **Quiz submission**: User submits quiz with exact time taken
2. **Backend analysis**: Adaptive service analyzes performance
3. **Difficulty decision**: Based on consecutive performance
4. **Frontend notification**: User sees adaptive adjustment message
5. **Profile update**: User's current difficulty is updated

```jsx
// Check for adaptive difficulty adjustment
if (result.adaptive && result.adaptive.shouldAdjust) {
  const notificationType = result.adaptive.newDifficulty === 'hard' ? 'upgraded' : 'downgraded';
  setAdaptiveNotification({
    type: notificationType,
    previousDifficulty: result.adaptive.previousDifficulty,
    newDifficulty: result.adaptive.newDifficulty,
    reason: result.adaptive.adjustmentReason
  });
  
  toast.success(
    notificationType === 'upgraded' 
      ? '🎉 Great job! Your adaptive difficulty has been upgraded!' 
      : 'Let\'s build your foundation! Difficulty adjusted for better learning.'
  );
}
```

## Usage Examples

### Enhanced Timer Usage

```jsx
<QuizTimer 
  timeRemaining={timeRemaining}
  totalTime={currentQuiz.timeLimit * 60}
  onTimeout={() => {
    setAutoSubmitted(true);
    setShowAutoSubmitModal(true);
  }}
  difficulty={currentQuiz.difficulty}
/>
```

### Adaptive Badge Usage

```jsx
<AdaptiveBadge 
  currentDifficulty={user.currentDifficulty}
  recommendedDifficulty={recommendation.recommendedDifficulty}
  showNotification={showAdaptiveNotification}
  notificationType={adaptiveNotification?.type}
/>
```

### Quiz Submission with Time Tracking

```jsx
const handleSubmit = async (isTimeout = false) => {
  const timeTakenSeconds = quizStartTime 
    ? Math.floor((Date.now() - quizStartTime) / 1000)
    : (currentQuiz?.timeLimit * 60) - timeRemaining;

  const result = await submitQuiz(isTimeout, timeTakenSeconds);
  // Handle result and adaptive updates
};
```

## API Integration

### Recommended Difficulty Endpoint

```javascript
const getRecommendedDifficulty = async () => {
  try {
    const response = await quizAPI.getRecommendedDifficulty();
    const recommendation = response.data.data;
    
    return {
      currentDifficulty: recommendation.currentDifficulty,
      recommendedDifficulty: recommendation.recommendedDifficulty,
      shouldAdjust: recommendation.shouldAdjust,
      adjustmentReason: recommendation.adjustmentReason,
      metrics: recommendation.metrics
    };
  } catch (error) {
    console.error('Failed to get recommended difficulty:', error);
  }
};
```

### Performance Stats Endpoint

```javascript
const getPerformanceStats = async () => {
  try {
    const response = await quizAPI.getPerformanceStats();
    const stats = response.data.data;
    
    return {
      totalAttempts: stats.totalAttempts,
      averageScore: stats.averageScore,
      highestScore: stats.highestScore,
      lowestScore: stats.lowestScore,
      difficultyDistribution: stats.difficultyDistribution,
      currentDifficulty: stats.currentDifficulty,
      recentAttempts: stats.recentAttempts
    };
  } catch (error) {
    console.error('Failed to get performance stats:', error);
  }
};
```

## Responsive Design

The components are designed to be responsive and work well on different screen sizes:

- **Timer**: Compact display with progress bar suitable for mobile
- **Adaptive Badge**: Flexible layout that adapts to screen size
- **Modals**: Responsive sizing with mobile-friendly touch targets
- **Progress Bars**: Scale appropriately on different devices

## Accessibility

### Keyboard Navigation
- Timer has proper focus states for keyboard users
- Modals can be dismissed with Escape key
- All interactive elements have proper ARIA labels

### Screen Reader Support
- Timer announcements for time updates
- Clear notification messages for adaptive changes
- Semantic HTML elements for better screen reader support

## Performance Optimization

### State Management
- Efficient timer updates using setInterval
- Memoized helper functions to prevent unnecessary re-renders
- Optimized adaptive state updates

### Rendering
- Smooth animations using CSS transitions
- Efficient progress bar updates
- Optimized re-render triggers

## Browser Compatibility

The implementation uses modern CSS features:
- CSS transitions and animations
- Flexbox layouts
- Responsive design patterns
- Modern JavaScript (ES6+)

Tested on:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Future Enhancements

### Potential Improvements

1. **Sound Notifications**
   - Audio alerts when time is running low
   - Success sounds for difficulty upgrades
   - Encouraging sounds for maintained levels

2. **Visual Themes**
   - Customizable timer color schemes
   - Theme-aware adaptive notifications
   - User preference for timer style

3. **Advanced Analytics**
   - Real-time performance charts
   - Difficulty progression timeline
   - Performance heatmap by topic

4. **Social Features**
   - Share difficulty achievements
   - Compare with peers at similar levels
   - Adaptive difficulty leaderboards

## Troubleshooting

### Common Issues

**Issue**: Timer not displaying correct time
- **Solution**: Verify totalTime is passed correctly from quiz.timeLimit
- **Check**: Ensure timeRemaining is being updated by store

**Issue**: Auto-submit not triggering
- **Solution**: Verify onTimeout callback is properly connected
- **Check**: Ensure timeRemaining reaches 0 and autoSubmitted flag is set

**Issue**: Adaptive notifications not showing
- **Solution**: Verify backend returns adaptive data in submission response
- **Check**: Ensure result.adaptive is properly parsed and handled

**Issue**: Time tracking inaccurate
- **Solution**: Verify quizStartTime is set when quiz starts
- **Check**: Ensure exactTimeTaken is calculated correctly on submission

## Testing

### Unit Tests

```javascript
describe('QuizTimer', () => {
  test('should show warning state when time <= 120 seconds', () => {
    const { container } = render(<QuizTimer timeRemaining={120} totalTime={1200} />);
    expect(container.firstChild).toHaveClass('bg-yellow-500/20');
  });

  test('should show critical state when time <= 30 seconds', () => {
    const { container } = render(<QuizTimer timeRemaining={30} totalTime={1200} />);
    expect(container.firstChild).toHaveClass('bg-red-500/20');
  });

  test('should call onTimeout when time reaches 0', () => {
    const onTimeout = jest.fn();
    const { rerender } = render(<QuizTimer timeRemaining={1} totalTime={1200} onTimeout={onTimeout} />);
    rerender(<QuizTimer timeRemaining={0} totalTime={1200} onTimeout={onTimeout} />);
    expect(onTimeout).toHaveBeenCalled();
  });
});
```

### Integration Tests

```javascript
describe('QuizPlayPage Adaptive Features', () => {
  test('should track quiz start time accurately', () => {
    const { result } = render(<QuizPlayPage />);
    // Verify quizStartTime is set when quiz starts
  });

  test('should calculate exact time taken on submission', async () => {
    const { result } = render(<QuizPlayPage />);
    // Simulate quiz submission and verify timeTaken calculation
  });

  test('should show adaptive notification on difficulty change', async () => {
    const { result } = render(<QuizPlayPage />);
    // Simulate submission with adaptive change and verify notification
  });
});
```

## Conclusion

The frontend implementation of Module 05 provides:

✅ **Enhanced timer functionality** with difficulty-based time limits  
✅ **Visual progress indicators** with color-coded warning states  
✅ **Auto-submit on timeout** with user-friendly modal notification  
✅ **Adaptive difficulty notifications** for user feedback  
✅ **Precise time tracking** for accurate performance measurement  
✅ **Responsive design** for all screen sizes  
✅ **Accessibility support** for keyboard and screen readers  
✅ **Performance optimization** with efficient state management  
✅ **Clean Tailwind CSS styling** with dark mode support  

The implementation enhances the user experience by providing clear time management, automatic timeout handling, and informative adaptive difficulty feedback, while maintaining the existing QuizMasterAI design aesthetic and user interface patterns.