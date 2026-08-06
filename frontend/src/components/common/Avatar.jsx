import React from 'react';
import { cn } from '../../utils/helpers.js';

/**
 * @component Avatar
 * @description User avatar with fallback initials.
 */
const Avatar = ({
  name     = '',
  src,
  size     = 'md',
  className = '',
  ring     = false,
  ringColor = 'primary',
}) => {
  const sizes = {
    xs:  'w-6 h-6 text-[10px]',
    sm:  'w-8 h-8 text-xs',
    md:  'w-10 h-10 text-sm',
    lg:  'w-12 h-12 text-base',
    xl:  'w-16 h-16 text-lg',
    '2xl': 'w-20 h-20 text-xl',
  };

  const ringColors = {
    primary: 'ring-primary-500',
    battle:  'ring-battle-500',
    green:   'ring-secondary-500',
  };

  // Generate initials from name
  const initials = name
    .split(' ')
    .map((n) => n.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Generate consistent color from name
  const colors = [
    'from-blue-500 to-blue-700',
    'from-purple-500 to-purple-700',
    'from-green-500 to-green-700',
    'from-orange-500 to-orange-700',
    'from-pink-500 to-pink-700',
    'from-teal-500 to-teal-700',
  ];

  const colorIndex = name
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;

  return (
    <div
      className={cn(
        'rounded-full flex-shrink-0 flex items-center justify-center',
        'font-semibold text-white select-none',
        sizes[size],
        ring && `ring-2 ring-offset-2 ring-offset-dark-900 ${ringColors[ringColor]}`,
        !src && `bg-gradient-to-br ${colors[colorIndex]}`,
        className
      )}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full rounded-full object-cover"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      ) : (
        initials || '?'
      )}
    </div>
  );
};

export default Avatar;