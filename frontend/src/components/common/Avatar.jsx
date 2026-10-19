import React, { useState, useEffect } from 'react';
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
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  const sizes = {
    xs:   'w-6 h-6 text-[10px]',
    sm:   'w-8 h-8 text-xs',
    md:   'w-10 h-10 text-sm',
    lg:   'w-12 h-12 text-base',
    xl:   'w-16 h-16 text-lg',
    '2xl': 'w-20 h-20 text-xl',
    '3xl': 'w-24 h-24 text-2xl',
    '4xl': 'w-28 h-28 text-3xl',
    '5xl': 'w-32 h-32 text-4xl',
    '6xl': 'w-36 h-36 text-5xl',
    '7xl': 'w-40 h-40 text-6xl',
  };

  const ringColors = {
    primary: 'ring-primary-500',
    battle:  'ring-battle-500',
    green:   'ring-secondary-500',
    indigo:  'ring-indigo-500',
    amber:   'ring-amber-500',
  };

  // Generate initials from name
  const initials = (name || '')
    .trim()
    .split(/\s+/)
    .map((n) => n.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Generate consistent color from name
  const colors = [
    'from-blue-500 to-indigo-700',
    'from-purple-500 to-indigo-700',
    'from-emerald-500 to-teal-700',
    'from-amber-500 to-orange-700',
    'from-rose-500 to-pink-700',
    'from-cyan-500 to-blue-700',
  ];

  const colorIndex = (name || '')
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;

  const showImage = Boolean(src && !imgError);

  return (
    <div
      className={cn(
        'rounded-full flex-shrink-0 flex items-center justify-center',
        'font-bold text-white select-none relative overflow-hidden',
        sizes[size] || sizes.md,
        ring && `ring-2 ring-offset-2 ring-offset-dark-900 ${ringColors[ringColor] || ringColors.primary}`,
        !showImage && `bg-gradient-to-br ${colors[colorIndex]} shadow-inner`,
        className
      )}
    >
      {showImage ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          className="w-full h-full rounded-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span>{initials || '?'}</span>
      )}
    </div>
  );
};

export default Avatar;