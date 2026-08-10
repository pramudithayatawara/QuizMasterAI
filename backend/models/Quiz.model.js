'use strict';

const mongoose = require('mongoose');
const { DIFFICULTY } = require('../constants/difficulty');
const { QUESTION_TYPES, QUIZ_STATUS } = require('../constants/quiz');

/**
 * @model Quiz
 * @description Core quiz entity generated from PDF via RAG pipeline.
 * Contains questions with options, correct answers, and metadata.
 */

// ─── Question Sub-Schema ─────────────────────────────────────────────────────
const questionSchema = new mongoose.Schema(
  {
    questionText: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: Object.values(QUESTION_TYPES),
      required: true,
    },

    // Options: { A: '...', B: '...', C: '...', D: '...' }
    // For True/False: { A: 'True', B: 'False' }
    options: {
      type: Map,
      of: String,
      required: true,
    },

    correctAnswer: {
      type: String,
      required: true,
      trim: true,
    },

    explanation: {
      type: String,
      default: null,
    },

    topic: {
      type: String,
      default: 'General',
      trim: true,
    },

    difficulty: {
      type: String,
      enum: Object.values(DIFFICULTY),
      required: true,
    },

    bloomsLevel: {
      type: String,
      enum: ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'],
      default: 'remember',
    },

    // Reference to source chunk in vector store
    sourceChunkIndex: {
      type: Number,
      default: null,
    },

    // AI classification metadata
    conceptComplexity: {
      type: Number,
      min: 0,
      max: 10,
      default: 5,
    },

    reasoningRequired: {
      type: Number,
      min: 0,
      max: 10,
      default: 5,
    },

    order: {
      type: Number,
      required: true,
    },
  },
  { _id: true }
);

// ─── Quiz Schema ─────────────────────────────────────────────────────────────
const quizSchema = new mongoose.Schema(
  {
    // ─── Ownership ──────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    pdfId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PDF',
      required: true,
      index: true,
    },

    // ─── Quiz Info ──────────────────────────────────────────────
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },

    description: {
      type: String,
      default: null,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },

    // ─── Questions ──────────────────────────────────────────────
    questions: {
      type: [questionSchema],
      validate: {
        validator: (v) => v.length >= 10,
        message: 'Quiz must have at least 10 questions',
      },
    },

    totalQuestions: {
      type: Number,
      required: true,
      min: 10,
    },

    mcqCount: {
      type: Number,
      default: 0,
    },

    trueFalseCount: {
      type: Number,
      default: 0,
    },

    // ─── Difficulty ─────────────────────────────────────────────
    difficulty: {
      type: String,
      enum: Object.values(DIFFICULTY),
      required: true,
      index: true,
    },

    // ─── Timer ──────────────────────────────────────────────────
    timeLimit: {
      type: Number, // Minutes
      required: true,
    },

    // ─── Status ─────────────────────────────────────────────────
    status: {
      type: String,
      enum: Object.values(QUIZ_STATUS),
      default: QUIZ_STATUS.DRAFT,
      index: true,
    },

    // ─── RAG Metadata ───────────────────────────────────────────
    retrievedChunks: {
      type: [Number], // Chunk indices used for generation
      default: [],
    },

    generationModel: {
      type: String,
      default: null, // Track which AI model generated this (e.g., 'gemini-pro')
    },

    contextReferences: {
      type: [{
        chunkIndex: Number,
        text: String,
        relevanceScore: Number
      }],
      default: [], // Detailed context references for traceability
    },

    // ─── Battle Mode ─────────────────────────────────────────────
    isBattleQuiz: {
      type: Boolean,
      default: false,
    },

    // ─── Soft Delete ────────────────────────────────────────────
    deletedAt: {
      type: Date,
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
quizSchema.index({ userId: 1, difficulty: 1 });
quizSchema.index({ userId: 1, status: 1 });
quizSchema.index({ pdfId: 1 });
quizSchema.index({ createdAt: -1 });

// ─── Query Filter ────────────────────────────────────────────────────────────
quizSchema.pre(/^find/, function (next) {
  this.where({ deletedAt: null });
  next();
});

// ─── Virtuals ────────────────────────────────────────────────────────────────
quizSchema.virtual('timeLimitSeconds').get(function () {
  return this.timeLimit * 60;
});

// ─── Instance Methods ─────────────────────────────────────────────────────────
quizSchema.methods.softDelete = function () {
  return this.updateOne({ deletedAt: new Date() });
};

// Get questions without correct answers (for sending to client during quiz)
quizSchema.methods.getQuestionsForClient = function () {
  return this.questions.map((q) => ({
    _id: q._id,
    questionText: q.questionText,
    type: q.type,
    options: q.options,
    topic: q.topic,
    difficulty: q.difficulty,
    order: q.order,
  }));
};

const Quiz = mongoose.model('Quiz', quizSchema);
module.exports = Quiz;