'use strict';

const mongoose = require('mongoose');
const { DIFFICULTY } = require('../constants/difficulty');

/**
 * @model UserSettings
 * @description User preferences and settings for QuizAI platform.
 * Linked to User via userId reference.
 */

const userSettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // ─── Gameplay Settings ─────────────────────────────────────────────
    gameplay: {
      soundEffects: {
        type: Boolean,
        default: true,
      },
      backgroundMusic: {
        type: Boolean,
        default: false,
      },
      timerVisibility: {
        type: Boolean,
        default: true,
      },
      defaultDifficulty: {
        type: String,
        enum: Object.values(DIFFICULTY),
        default: DIFFICULTY.MEDIUM,
      },
    },

    // ─── Appearance Settings ────────────────────────────────────────────
    appearance: {
      theme: {
        type: String,
        enum: ['dark', 'light'],
        default: 'dark',
      },
      reducedMotion: {
        type: Boolean,
        default: false,
      },
    },

    // ─── Notification Settings ────────────────────────────────────────────
    notifications: {
      dailyReminders: {
        type: Boolean,
        default: true,
      },
      battleInvites: {
        type: Boolean,
        default: true,
      },
      emailUpdates: {
        type: Boolean,
        default: false,
      },
    },

    // ─── Privacy Settings ───────────────────────────────────────────────
    privacy: {
      publicProfile: {
        type: Boolean,
        default: true,
      },
      showOnLeaderboard: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ═══════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════
userSettingsSchema.index({ userId: 1 }, { unique: true });

// ═══════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════

/**
 * @method getSettings
 * @description Get all settings as a plain object
 */
userSettingsSchema.methods.getSettings = function () {
  return {
    gameplay: this.gameplay,
    appearance: this.appearance,
    notifications: this.notifications,
    privacy: this.privacy,
  };
};

/**
 * @method updateSettings
 * @description Update settings with partial data
 */
userSettingsSchema.methods.updateSettings = function (updates) {
  if (updates.gameplay) {
    Object.assign(this.gameplay, updates.gameplay);
  }
  if (updates.appearance) {
    Object.assign(this.appearance, updates.appearance);
  }
  if (updates.notifications) {
    Object.assign(this.notifications, updates.notifications);
  }
  if (updates.privacy) {
    Object.assign(this.privacy, updates.privacy);
  }
  return this.save();
};

const UserSettings = mongoose.model('UserSettings', userSettingsSchema);

module.exports = UserSettings;
