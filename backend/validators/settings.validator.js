'use strict';

const { body } = require('express-validator');
const { DIFFICULTY } = require('../constants/difficulty');

/**
 * @module settingsValidator
 * @description Input validation rules for settings endpoints.
 */

const settingsValidator = {
  // ─── Update Settings ─────────────────────────────────────────────────────
  updateSettings: [
    // Gameplay settings
    body('gameplay.soundEffects')
      .optional()
      .isBoolean()
      .withMessage('Sound effects must be a boolean'),
    
    body('gameplay.backgroundMusic')
      .optional()
      .isBoolean()
      .withMessage('Background music must be a boolean'),
    
    body('gameplay.timerVisibility')
      .optional()
      .isBoolean()
      .withMessage('Timer visibility must be a boolean'),
    
    body('gameplay.defaultDifficulty')
      .optional()
      .isIn(Object.values(DIFFICULTY))
      .withMessage('Invalid difficulty level'),

    // Appearance settings
    body('appearance.theme')
      .optional()
      .isIn(['dark', 'light'])
      .withMessage('Theme must be either dark or light'),
    
    body('appearance.reducedMotion')
      .optional()
      .isBoolean()
      .withMessage('Reduced motion must be a boolean'),

    // Notification settings
    body('notifications.dailyReminders')
      .optional()
      .isBoolean()
      .withMessage('Daily reminders must be a boolean'),
    
    body('notifications.battleInvites')
      .optional()
      .isBoolean()
      .withMessage('Battle invites must be a boolean'),
    
    body('notifications.emailUpdates')
      .optional()
      .isBoolean()
      .withMessage('Email updates must be a boolean'),

    // Privacy settings
    body('privacy.publicProfile')
      .optional()
      .isBoolean()
      .withMessage('Public profile must be a boolean'),
    
    body('privacy.showOnLeaderboard')
      .optional()
      .isBoolean()
      .withMessage('Show on leaderboard must be a boolean'),
  ],
};

module.exports = settingsValidator;
