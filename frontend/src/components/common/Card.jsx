import React from 'react';
import { cn } from '../../utils/helpers.js';
import { useTheme } from '../../hooks/useTheme.js';

/**
 * @component Card
 * @description Reusable glass-morphism card with theme support.
 */
const Card = ({
  children,
  className   = '',
  padding     = 'md',
  hover       = false,
  glow        = false,
  glowColor   = 'primary',
  onClick,
  ...props
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const paddings = {
    none: '',
    sm:   'p-4',
    md:   'p-6',
    lg:   'p-8',
    xl:   'p-10',
  };

  const glowColors = {
    primary: 'hover:shadow-glow',
    green:   'hover:shadow-glow-green',
    purple:  'hover:shadow-glow-purple',
    orange:  'hover:shadow-glow-orange',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        isDark 
          ? 'bg-dark-800/60 backdrop-blur-md border border-dark-700/50 rounded-2xl'
          : 'bg-white/60 backdrop-blur-md border border-light-300 rounded-2xl',
        paddings[padding],
        hover && 'transition-all duration-300 cursor-pointer hover:-translate-y-1',
        glow  && glowColors[glowColor],
        onClick && 'cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;