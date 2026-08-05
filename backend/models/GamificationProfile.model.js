'use strict';

const mongoose = require('mongoose');

/**
 * @model GamificationProfile
 * @description Stores user gamification data.
 * XP, levels, badges, streaks, points.
 * One profile per user.
 */

// ─── Badge Sub-Schema ─────────────────────────────────────────────────────────
const earnedBadgeSchema = new mongoose.Schema(
  {
    badgeId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    icon: { type: String },
    earnedAt: { type: Date, default: Date.now },
    xpRewarded: { type: Number, default: 0 },
  },
  { _id: false }
);

// ─── Gamification Schema ─────────────────────────────────────────────────────
const gamificationProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // ─── XP & Level ─────────────────────────────────────────────
    totalXP: {
      type: Number,
      default: 0,
      min: 0,
    },

    level: {
      type: Number,
      default: 1,
      min: 1,
    },

    // ─── Points ─────────────────────────────────────────────────
    totalPoints: {
      type: Number,
      default: 0,
      min: 0,
    },

    dailyPoints: {
      type: Number,
      default: 0,
    },

    weeklyPoints: {
      type: Number,
      default: 0,
    },

    monthlyPoints: {
      type: Number,
      default: 0,
    },

    lastDailyReset: {
      type: Date,
      default: Date.now,
    },

    // ─── Streaks ─────────────────────────────────────────────────
    quizStreak: {
      type: Number,
      default: 0,
      min: 0,
    },

    winStreak: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxWinStreak: {
      type: Number,
      default: 0,
    },

    maxQuizStreak: {
      type: Number,
      default: 0,
    },

    lastQuizDate: {
      type: Date,
      default: null,
    },

    lastBattleDate: {
      type: Date,
      default: null,
    },

    // ─── Badges ─────────────────────────────────────────────────
    badges: {
      type: [earnedBadgeSchema],
      default: [],
    },

    // ─── Statistics ──────────────────────────────────────────────
    totalQuizzes: {
      type: Number,
      default: 0,
    },

    totalBattles: {
      type: Number,
      default: 0,
    },

    totalWins: {
      type: Number,
      default: 0,
    },

    totalUploads: {
      type: Number,
      default: 0,
    },

    perfectScores: {
      type: Number,
      default: 0,
    },

    difficultiesCompleted: {
      type: [String],
      default: [],
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
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
gamificationProfileSchema.index({ totalPoints: -1 }); // Leaderboard
gamificationProfileSchema.index({ totalXP: -1 });
gamificationProfileSchema.index({ level: -1 });

// ─── Instance Methods ─────────────────────────────────────────────────────────

/**
 * @method addXP
 * @description Add XP and recalculate level.
 */
gamificationProfileSchema.methods.addXP = async function (xp) {
  const { getLevelFromXP } = require('../constants/gamification');
  this.totalXP += xp;
  this.level = getLevelFromXP(this.totalXP);
  return this.save();
};

/**
 * @method addPoints
 * @description Add points to all point categories.
 */
gamificationProfileSchema.methods.addPoints = async function (points) {
  this.totalPoints += points;
  this.dailyPoints += points;
  this.weeklyPoints += points;
  this.monthlyPoints += points;
  return this.save();
};

/**
 * @method hasBadge
 * @description Check if user already has a specific badge.
 */
gamificationProfileSchema.methods.hasBadge = function (badgeId) {
  return this.badges.some((b) => b.badgeId === badgeId);
};

/**
 * @method awardBadge
 * @description Award a badge to the user.
 */
gamificationProfileSchema.methods.awardBadge = function (badge) {
  if (!this.hasBadge(badge.id)) {
    this.badges.push({
      badgeId: badge.id,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      xpRewarded: badge.xpReward,
    });
  }
  return this;
};

const GamificationProfile = mongoose.model(
  'GamificationProfile',
  gamificationProfileSchema
);
module.exports = GamificationProfile;