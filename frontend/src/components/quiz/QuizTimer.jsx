import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { formatTimer } from '../../utils/formatters.js';
import { cn } from '../../utils/helpers.js';

/**
 * @component QuizTimer
 * @description Module 05: Enhanced countdown timer with progress bar and auto-submit
 * Supports dynamic time limits based on difficulty (Easy: 15min, Medium: 20min, Hard: 25min)
 */
const QuizTimer = ({ 
  timeRemaining, 
  totalTime, 
  onTimeout,
  difficulty = 'medium' 
}) => {
  const [isPulsing, setIsPulsing] = useState(false);
  
  // Module 05: Time limit thresholds based on difficulty
  const isWarning = timeRemaining <= 120; // Last 2 minutes (120 seconds)
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
        setIsPulsing(prev => !prev);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setIsPulsing(false);
    }
  }, [isCritical]);
  
  // Color configuration based on time remaining
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

export default QuizTimer;