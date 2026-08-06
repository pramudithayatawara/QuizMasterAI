import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/helpers.js';

/**
 * @component ProgressBar
 * @description Animated progress bar.
 */
const ProgressBar = ({
  value     = 0,
  max       = 100,
  color     = 'primary',
  size      = 'md',
  showLabel = false,
  label,
  animated  = true,
  className = '',
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const colors = {
    primary: 'bg-primary-500',
    green:   'bg-secondary-500',
    orange:  'bg-accent-500',
    red:     'bg-red-500',
    battle:  'bg-gradient-to-r from-battle-500 to-accent-500',
    xp:      'bg-gradient-to-r from-primary-500 to-secondary-500',
  };

  const sizes = {
    xs: 'h-1',
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
    xl: 'h-4',
  };

  return (
    <div className={cn('w-full', className)}>
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-dark-400">{label}</span>
          {showLabel && (
            <span className="text-xs font-medium text-dark-200">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}

      <div className={cn('w-full bg-dark-700 rounded-full overflow-hidden', sizes[size])}>
        <motion.div
          className={cn('h-full rounded-full', colors[color])}
          initial={animated ? { width: 0 } : { width: `${percentage}%` }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;