'use strict';

/**
 * @module badges
 * @description Achievement badge definitions.
 * Each badge has unlock criteria evaluated automatically.
 */

const BADGES = Object.freeze([
  {
    id: 'first_quiz',
    name: 'First Step',
    description: 'Complete your first quiz',
    icon: '🎯',
    criteria: { type: 'total_quizzes', value: 1 },
    xpReward: 50,
  },
  {
    id: 'quiz_master_10',
    name: 'Quiz Enthusiast',
    description: 'Complete 10 quizzes',
    icon: '📚',
    criteria: { type: 'total_quizzes', value: 10 },
    xpReward: 200,
  },
  {
    id: 'quiz_master_50',
    name: 'Quiz Master',
    description: 'Complete 50 quizzes',
    icon: '🏆',
    criteria: { type: 'total_quizzes', value: 50 },
    xpReward: 1000,
  },
  {
    id: 'perfect_score',
    name: 'Perfectionist',
    description: 'Score 100% on any quiz',
    icon: '💯',
    criteria: { type: 'perfect_score', value: 100 },
    xpReward: 300,
  },
  {
    id: 'win_streak_3',
    name: 'On Fire',
    description: 'Win 3 battles in a row',
    icon: '🔥',
    criteria: { type: 'win_streak', value: 3 },
    xpReward: 150,
  },
  {
    id: 'win_streak_10',
    name: 'Unstoppable',
    description: 'Win 10 battles in a row',
    icon: '⚡',
    criteria: { type: 'win_streak', value: 10 },
    xpReward: 500,
  },
  {
    id: 'hard_quiz',
    name: 'Challenge Seeker',
    description: 'Complete a Hard difficulty quiz',
    icon: '💪',
    criteria: { type: 'difficulty_completed', value: 'hard' },
    xpReward: 250,
  },
  {
    id: 'upload_5',
    name: 'Knowledge Sharer',
    description: 'Upload 5 PDF documents',
    icon: '📄',
    criteria: { type: 'total_uploads', value: 5 },
    xpReward: 100,
  },
  {
    id: 'daily_streak_7',
    name: 'Dedicated Learner',
    description: 'Maintain a 7-day quiz streak',
    icon: '📅',
    criteria: { type: 'quiz_streak', value: 7 },
    xpReward: 400,
  },
  {
    id: 'battle_winner',
    name: 'Warrior',
    description: 'Win your first battle',
    icon: '⚔️',
    criteria: { type: 'total_wins', value: 1 },
    xpReward: 100,
  },
]);

module.exports = { BADGES };