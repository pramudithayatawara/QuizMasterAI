import React, { forwardRef } from 'react';
import { cn } from '../../utils/helpers.js';

/**
 * @component Input
 * @description Reusable form input with error display.
 */
const Input = forwardRef(({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  className = '',
  containerClassName = '',
  type = 'text',
  required,
  ...props
}, ref) => {
  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      {/* Label */}
      {label && (
        <label className="text-sm font-medium text-dark-200">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}

      {/* Input wrapper */}
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-dark-400 z-10">
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          type={type}
          className={cn(
            'input-base',
            leftIcon  && '!pl-10', // ! (Important) මඟින් input-base හි padding override කරයි
            rightIcon && '!pr-10', // ! (Important) මඟින් right padding override කරයි
            error     && 'border-red-500 focus:ring-red-500',
            className
          )}
          {...props}
        />

        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-dark-400 z-10">
            {rightIcon}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}

      {/* Hint */}
      {hint && !error && (
        <p className="text-xs text-dark-400">{hint}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;