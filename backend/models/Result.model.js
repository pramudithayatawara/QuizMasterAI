'use strict';

const mongoose = require('mongoose');

/**
 * @model Result
 * @description Stores detailed quiz result with AI feedback.
 * One result per quiz attempt.
 * Powers the feedback and analytics engine.
 */

const resultSchema = new mongoose.Schema(
  {
    // ─── References ─────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    quizAttemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuizAttempt',
      required: true,
      unique: true,
    },

    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: true,
    },

    // ─── Score Summary ──────────────────────────────────────────
    score: {
      type: Number,
      required: true,
    },

    percentage: {
      type: Number,
      required: true,
    },

    correctCount: {
      type: Number,
      required: true,
    },

    wrongCount: {
      type: Number,
      required: true,
    },

    skippedCount: {
      type: Number,
      default: 0,
    },

    totalQuestions: {
      type: Number,
      required: true,
    },

    timeTaken: {
      type: Number, // Seconds
      required: true,
    },

    difficulty: {
      type: String,
      required: true,
    },

    // ─── Analysis ───────────────────────────────────────────────
    weakTopics: {
      type: [String],
      default: [],
    },

    strongTopics: {
      type: [String],
      default: [],
    },

    performanceTrend: {
      type: String,
      enum: ['improving', 'declining', 'stable', 'new'],
      default: 'new',
    },

    // ─── AI Feedback ────────────────────────────────────────────
    aiFeedback: {
      overallFeedback: { type: String, default: null },
      strengths: { type: [String], default: [] },
      improvements: { type: [String], default: [] },
      suggestions: { type: [String], default: [] },
      motivationalMessage: { type: String, default: null },
      performanceGrade: {
        type: String,
        enum: ['excellent', 'good', 'average', 'below_average', 'poor'],
        default: 'average',
      },
    },

    // ─── XP Awarded ─────────────────────────────────────────────
    xpAwarded: {
      type: Number,
      default: 0,
    },

    badgesUnlocked: {
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
resultSchema.index({ userId: 1, createdAt: -1 });
resultSchema.index({ quizAttemptId: 1 }, { unique: true });
resultSchema.index({ userId: 1, difficulty: 1 });

// ─── Virtuals ────────────────────────────────────────────────────────────────
resultSchema.virtual('isPassed').get(function () {
  return this.percentage >= 60;
});

resultSchema.virtual('grade').get(function () {
  if (this.percentage >= 90) return 'A';
  if (this.percentage >= 80) return 'B';
  if (this.percentage >= 70) return 'C';
  if (this.percentage >= 60) return 'D';
  return 'F';
});

const Result = mongoose.model('Result', resultSchema);
module.exports = Result;