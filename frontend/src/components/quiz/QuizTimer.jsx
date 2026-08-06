import React from 'react';
import { Clock } from 'lucide-react';
import { formatTimer } from '../../utils/formatters.js';
import { cn } from '../../utils/helpers.js';

/**
 * @component QuizTimer
 * @description Countdown timer with warning state.
 */
const QuizTimer = ({ timeRemaining }) => {
  const isWarning = timeRemaining <= 60; // Last minute
  const isCritical = timeRemaining <= 10; // Last 10 seconds

  return (
    <div className={cn(
      'flex items-center gap-2 px-4 py-2 rounded-xl border font-mono font-bold',
      isCritical
        ? 'bg-red-500/20 border-red-500/30 text-red-400 timer-warning'
        : isWarning
        ? 'bg-accent-500/20 border-accent-500/30 text-accent-400'
        : 'bg-dark-700 border-dark-600 text-dark-300'
    )}>
      <Clock size={18} />
      <span className="text-lg">{formatTimer(timeRemaining)}</span>
    </div>
  );
};

export default QuizTimer;