'use strict';

const mongoose = require('mongoose');

/**
 * @model Leaderboard
 * @description Global leaderboard for ranking users.
 * Updated after each quiz and battle.
 * Supports global, weekly, and monthly rankings.
 */

const leaderboardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // ─── Rankings ────────────────────────────────────────────────
    globalRank: {
      type: Number,
      default: 0,
    },

    weeklyRank: {
      type: Number,
      default: 0,
    },

    monthlyRank: {
      type: Number,
      default: 0,
    },

    // ─── Points ──────────────────────────────────────────────────
    totalPoints: {
      type: Number,
      default: 0,
      index: true,
    },

    weeklyPoints: {
      type: Number,
      default: 0,
    },

    monthlyPoints: {
      type: Number,
      default: 0,
    },

    // ─── Stats ───────────────────────────────────────────────────
    totalQuizzes: {
      type: Number,
      default: 0,
    },

    totalWins: {
      type: Number,
      default: 0,
    },

    averageScore: {
      type: Number,
      default: 0,
    },

    level: {
      type: Number,
      default: 1,
    },

    // ─── Cache ───────────────────────────────────────────────────
    // Cached user info to avoid joins
    userName: {
      type: String,
      default: '',
    },

    userAvatar: {
      type: String,
      default: null,
    },

    badges: {
      type: [String], // Top 3 badge IDs
      default: [],
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
leaderboardSchema.index({ totalPoints: -1 });
leaderboardSchema.index({ weeklyPoints: -1 });
leaderboardSchema.index({ monthlyPoints: -1 });
leaderboardSchema.index({ globalRank: 1 });

// ─── Static Methods ──────────────────────────────────────────────────────────

/**
 * @static getGlobalTop
 * @description Get top N users from global leaderboard.
 */
leaderboardSchema.statics.getGlobalTop = function (limit = 100) {
  return this.find()
    .sort({ totalPoints: -1 })
    .limit(limit)
    .populate('userId', 'firstName lastName avatar level');
};

/**
 * @static getUserRank
 * @description Get a specific user's rank.
 */
leaderboardSchema.statics.getUserRank = async function (userId) {
  const userEntry = await this.findOne({ userId });
  if (!userEntry) return null;

  const rank = await this.countDocuments({
    totalPoints: { $gt: userEntry.totalPoints },
  });

  return {
    ...userEntry.toObject(),
    globalRank: rank + 1,
  };
};

const Leaderboard = mongoose.model('Leaderboard', leaderboardSchema);
module.exports = Leaderboard;