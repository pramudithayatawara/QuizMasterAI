'use strict';

const mongoose = require('mongoose');
const { DIFFICULTY } = require('../constants/difficulty');

/**
 * @model Battle
 * @description Multiplayer battle session entity.
 * Tracks players, questions, scores, and battle outcome.
 */

// ─── Player Score Sub-Schema ─────────────────────────────────────────────────
const playerScoreSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    userName: { type: String, required: true },

    score: { type: Number, default: 0 },

    correctCount: { type: Number, default: 0 },

    wrongCount: { type: Number, default: 0 },

    bonusPoints: { type: Number, default: 0 }, // Speed bonus

    totalPoints: { type: Number, default: 0 },

    rank: { type: Number, default: 0 },

    isConnected: { type: Boolean, default: true },

    finishedAt: { type: Date, default: null },
  },
  { _id: false }
);

// ─── Battle Schema ───────────────────────────────────────────────────────────
const battleSchema = new mongoose.Schema(
  {
    // ─── Room ────────────────────────────────────────────────────
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // ─── Players ─────────────────────────────────────────────────
    players: {
      type: [playerScoreSchema],
      validate: {
        validator: (v) => v.length >= 2 && v.length <= 4,
        message: 'Battle requires 2-4 players',
      },
    },

    maxPlayers: {
      type: Number,
      default: 2,
      min: 2,
      max: 4,
    },

    // ─── Quiz ────────────────────────────────────────────────────
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      default: null,
    },

    questions: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    currentQuestionIndex: {
      type: Number,
      default: 0,
    },

    // ─── Difficulty ──────────────────────────────────────────────
    difficulty: {
      type: String,
      enum: Object.values(DIFFICULTY),
      default: DIFFICULTY.MEDIUM,
    },

    // ─── Status ──────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['waiting', 'starting', 'active', 'finished', 'cancelled'],
      default: 'waiting',
      index: true,
    },

    // ─── Winner ──────────────────────────────────────────────────
    winnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    winnerName: {
      type: String,
      default: null,
    },

    isDraw: {
      type: Boolean,
      default: false,
    },

    // ─── Timing ──────────────────────────────────────────────────
    startedAt: {
      type: Date,
      default: null,
    },

    finishedAt: {
      type: Date,
      default: null,
    },

    waitingStartedAt: {
      type: Date,
      default: Date.now,
    },

    maxWaitTime: {
      type: Number,
      default: 60000, // 60 seconds max wait
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
battleSchema.index({ status: 1, difficulty: 1 }); // Matchmaking queries
battleSchema.index({ 'players.userId': 1 });
battleSchema.index({ createdAt: -1 });

// ─── Virtuals ────────────────────────────────────────────────────────────────
battleSchema.virtual('duration').get(function () {
  if (!this.startedAt || !this.finishedAt) return null;
  return Math.round((this.finishedAt - this.startedAt) / 1000);
});

battleSchema.virtual('playerCount').get(function () {
  return this.players.length;
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

/**
 * @method getPlayerScore
 */
battleSchema.methods.getPlayerScore = function (userId) {
  return this.players.find(
    (p) => p.userId.toString() === userId.toString()
  );
};

/**
 * @method updatePlayerScore
 */
battleSchema.methods.updatePlayerScore = function (userId, points, isCorrect) {
  const player = this.getPlayerScore(userId);
  if (player) {
    player.score += points;
    player.totalPoints += points;
    if (isCorrect) player.correctCount++;
    else player.wrongCount++;
  }
  return this;
};

/**
 * @method determineWinner
 */
battleSchema.methods.determineWinner = function () {
  if (this.players.length === 0) return null;

  const sorted = [...this.players].sort(
    (a, b) => b.totalPoints - a.totalPoints
  );

  // Check for draw
  if (sorted[0].totalPoints === sorted[1]?.totalPoints) {
    this.isDraw = true;
    return null;
  }

  this.winnerId = sorted[0].userId;
  this.winnerName = sorted[0].userName;

  // Assign ranks
  sorted.forEach((player, index) => {
    const p = this.players.find(
      (pl) => pl.userId.toString() === player.userId.toString()
    );
    if (p) p.rank = index + 1;
  });

  return sorted[0];
};

const Battle = mongoose.model('Battle', battleSchema);
module.exports = Battle;