import React from 'react';
import { cn } from '../../utils/helpers.js';
import Spinner from './Spinner.jsx';

/**
 * @component Button
 * @description Reusable button with variants and loading state.
 */
const Button = ({
  children,
  variant   = 'primary',
  size      = 'md',
  isLoading = false,
  disabled  = false,
  leftIcon,
  rightIcon,
  className = '',
  onClick,
  type = 'button',
  ...props
}) => {
  const variants = {
    primary:   'btn-primary',
    secondary: 'btn-secondary',
    danger:    'btn-danger',
    battle:    'btn-battle',
    ghost:     'text-dark-300 hover:text-dark-100 hover:bg-dark-800 px-4 py-2 rounded-xl transition-colors',
    link:      'text-primary-400 hover:text-primary-300 underline-offset-4 hover:underline p-0',
  };

  const sizes = {
    xs:  'text-xs px-3 py-1.5',
    sm:  'text-sm px-4 py-2',
    md:  'text-sm px-6 py-3',
    lg:  'text-base px-8 py-4',
    xl:  'text-lg px-10 py-5',
  };

  // Override variant sizing for custom sizes
  const sizeOverride = ['ghost', 'link'].includes(variant)
    ? ''
    : sizes[size];

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={cn(
        variants[variant],
        sizeOverride,
        'relative',
        className
      )}
      {...props}
    >
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner size="sm" color={variant === 'secondary' ? 'primary' : 'white'} />
        </span>
      )}
      <span className={cn('flex items-center gap-2', isLoading && 'invisible')}>
        {leftIcon && <span>{leftIcon}</span>}
        {children}
        {rightIcon && <span>{rightIcon}</span>}
      </span>
    </button>
  );
};

export default Button;