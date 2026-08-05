'use strict';

const mongoose = require('mongoose');
const { ATTEMPT_STATUS } = require('../constants/quiz');
const { DIFFICULTY } = require('../constants/difficulty');

/**
 * @model QuizAttempt
 * @description Records each user quiz attempt.
 * Tracks answers, timing, and completion status.
 * Core data source for adaptive engine and feedback.
 */

// ─── Answer Sub-Schema ───────────────────────────────────────────────────────
const answerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    answer: {
      type: String,
      default: null, // null = skipped
    },

    isCorrect: {
      type: Boolean,
      default: false,
    },

    timeTaken: {
      type: Number, // Seconds spent on this question
      default: 0,
    },

    answeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// ─── Quiz Attempt Schema ─────────────────────────────────────────────────────
const quizAttemptSchema = new mongoose.Schema(
  {
    // ─── References ─────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: true,
      index: true,
    },

    pdfId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PDF',
      required: true,
    },

    // ─── Answers ────────────────────────────────────────────────
    answers: {
      type: [answerSchema],
      default: [],
    },

    // ─── Scores ─────────────────────────────────────────────────
    score: {
      type: Number,
      default: 0,
      min: 0,
    },

    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    correctCount: {
      type: Number,
      default: 0,
    },

    wrongCount: {
      type: Number,
      default: 0,
    },

    skippedCount: {
      type: Number,
      default: 0,
    },

    totalQuestions: {
      type: Number,
      required: true,
    },

    // ─── Timing ─────────────────────────────────────────────────
    timeTaken: {
      type: Number, // Total seconds taken
      default: 0,
    },

    timeLimit: {
      type: Number, // Time limit in seconds
      required: true,
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    // ─── Status ─────────────────────────────────────────────────
    status: {
      type: String,
      enum: Object.values(ATTEMPT_STATUS),
      default: ATTEMPT_STATUS.ONGOING,
      index: true,
    },

    isAutoSubmitted: {
      type: Boolean,
      default: false,
    },

    // ─── Difficulty Played ───────────────────────────────────────
    difficulty: {
      type: String,
      enum: Object.values(DIFFICULTY),
      required: true,
    },

    // ─── Analysis ───────────────────────────────────────────────
    weakTopics: {
      type: [String],
      default: [],
    },

    // Battle mode reference
    battleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Battle',
      default: null,
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
quizAttemptSchema.index({ userId: 1, createdAt: -1 });
quizAttemptSchema.index({ userId: 1, status: 1 });
quizAttemptSchema.index({ quizId: 1 });
quizAttemptSchema.index({ userId: 1, difficulty: 1 });

// ─── Virtuals ────────────────────────────────────────────────────────────────
quizAttemptSchema.virtual('timeTakenMinutes').get(function () {
  return (this.timeTaken / 60).toFixed(1);
});

quizAttemptSchema.virtual('isPassed').get(function () {
  return this.percentage >= 60;
});

// ─── Static Methods ──────────────────────────────────────────────────────────

/**
 * @static getLastNAttempts
 * @description Get last N completed quiz attempts for a user.
 * Used by adaptive engine.
 */
quizAttemptSchema.statics.getLastNAttempts = function (userId, n = 10) {
  return this.find({
    userId,
    status: ATTEMPT_STATUS.COMPLETED,
  })
    .sort({ completedAt: -1 })
    .limit(n)
    .select('percentage difficulty completedAt score');
};

const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);
module.exports = QuizAttempt;