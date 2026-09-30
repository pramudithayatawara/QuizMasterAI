export const DIFFICULTY = {
  RANDOM: 'random',
  EASY:   'easy',
  MEDIUM: 'medium',
  HARD:   'hard',
};

export const DIFFICULTY_CONFIG = {
  random: {
    label:     'Random / Mixed',
    color:     'text-indigo-400',
    bgColor:   'bg-indigo-500/20',
    border:    'border-indigo-500/30',
    timeLimit: 20,
    icon:      '🔀',
  },
  easy: {
    label:     'Easy',
    color:     'text-secondary-400',
    bgColor:   'bg-secondary-500/20',
    border:    'border-secondary-500/30',
    timeLimit: 15,  // minutes
    icon:      '🟢',
  },
  medium: {
    label:     'Medium',
    color:     'text-accent-400',
    bgColor:   'bg-accent-500/20',
    border:    'border-accent-500/30',
    timeLimit: 20,
    icon:      '🟡',
  },
  hard: {
    label:     'Hard',
    color:     'text-red-400',
    bgColor:   'bg-red-500/20',
    border:    'border-red-500/30',
    timeLimit: 25,
    icon:      '🔴',
  },
};