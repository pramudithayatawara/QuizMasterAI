import React from 'react';
import { ArrowUp, ArrowDown, Minus, TrendingUp, Sparkles } from 'lucide-react';
import { cn } from '../../utils/helpers.js';

/**
 * @component AdaptiveBadge
 * @description Module 05: Display adaptive difficulty recommendations and notifications
 * Shows recommended difficulty level and notifies when difficulty is upgraded/downgraded
 */
const AdaptiveBadge = ({ 
  currentDifficulty, 
  recommendedDifficulty, 
  showNotification = false,
  notificationType = null // 'upgraded', 'downgraded', 'maintained'
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
  
  const currentConfig = getDifficultyConfig(currentDifficulty);
  const recommendedConfig = getDifficultyConfig(recommendedDifficulty);
  const notificationConfig = getNotificationConfig(notificationType);
  
  // Determine if difficulty will change
  const willChange = currentDifficulty !== recommendedDifficulty;
  const willIncrease = willChange && 
    ['easy', 'medium', 'hard'].indexOf(recommendedDifficulty) > 
    ['easy', 'medium', 'hard'].indexOf(currentDifficulty);
  
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

export default AdaptiveBadge;