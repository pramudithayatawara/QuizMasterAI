import React from 'react';
import { cn } from '../../utils/helpers.js';

/**
 * @component Spinner
 * @description Loading spinner with size variants.
 */
const Spinner = ({ size = 'md', className = '', color = 'primary' }) => {
  const sizeClasses = {
    xs:  'w-3 h-3 border',
    sm:  'w-4 h-4 border-2',
    md:  'w-6 h-6 border-2',
    lg:  'w-10 h-10 border-2',
    xl:  'w-14 h-14 border-4',
  };

  const colorClasses = {
    primary: 'border-primary-500 border-t-transparent',
    white:   'border-white border-t-transparent',
    battle:  'border-battle-500 border-t-transparent',
  };

  return (
    <div
      className={cn(
        'rounded-full animate-spin',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
};

export default Spinner;