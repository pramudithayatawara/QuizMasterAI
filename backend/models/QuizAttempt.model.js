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

    // Module 05: Adaptive Engine Fields
    previousDifficulty: {
      type: String,
      enum: Object.values(DIFFICULTY),
      default: null,
    },

    adaptiveAdjustment: {
      type: String,
      enum: ['increased', 'decreased', 'maintained'],
      default: 'maintained',
    },

    // ─── Question-by-Question Real-Time Adaptive CAT Fields ──────
    isAdaptive: {
      type: Boolean,
      default: false,
    },

    currentAbilityTheta: {
      type: Number,
      default: 0.0, // IRT ability scale (-3.0 to +3.0)
    },

    currentDifficultyLevel: {
      type: String,
      enum: Object.values(DIFFICULTY),
      default: DIFFICULTY.MEDIUM,
    },

    consecutiveCorrect: {
      type: Number,
      default: 0,
    },

    consecutiveIncorrect: {
      type: Number,
      default: 0,
    },

    servedQuestionIds: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },

    adaptiveTrajectory: {
      type: [
        {
          stepNumber: Number,
          questionId: mongoose.Schema.Types.ObjectId,
          questionText: String,
          difficulty: String,
          bloomsTaxonomy: String,
          selectedAnswer: String,
          correctAnswer: String,
          isCorrect: Boolean,
          explanation: String,
          timeTaken: Number,
          abilityThetaAfter: Number,
          calibratedDifficulty: String,
          adjustment: String,
          calibrationReason: String,
          answeredAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
    },

    // ─── Analysis ───────────────────────────────────────────────
    weakTopics: {
      type: [String],
      default: [],
    },

    // Module 06: AI Feedback & Remediation
    aiFeedback: {
      summary: {
        type: String,
        default: null,
      },
      suggestedImprovements: {
        type: [String],
        default: [],
      },
      recommendedTopicsToReview: {
        type: [String],
        default: [],
      },
      confidenceLevel: {
        type: String,
        enum: ['high', 'medium', 'low'],
        default: 'medium',
      },
      feedbackGeneratedAt: {
        type: Date,
        default: null,
      },
    },

    // Module 06: Performance Analytics
    performanceMetrics: {
      averageTimePerQuestion: {
        type: Number,
        default: 0,
      },
      fastestQuestionTime: {
        type: Number,
        default: 0,
      },
      slowestQuestionTime: {
        type: Number,
        default: 0,
      },
      topicAccuracy: {
        type: Map,
        of: Number, // topic name -> accuracy percentage
        default: {},
      },
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
    .select('percentage difficulty completedAt score adaptiveAdjustment previousDifficulty');
};

const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);
module.exports = QuizAttempt;