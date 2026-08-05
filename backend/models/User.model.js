'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config/env');
const { ROLES, ROLE_LIST } = require('../constants/roles');
const { DIFFICULTY } = require('../constants/difficulty');

/**
 * @model User
 * @description Primary user entity.
 * Handles password hashing, login attempt tracking,
 * account locking, and role-based access.
 */

const userSchema = new mongoose.Schema(
  {
    // ─── Personal Info ──────────────────────────────────────────
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      minlength: [2, 'First name must be at least 2 characters'],
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },

    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      minlength: [2, 'Last name must be at least 2 characters'],
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },

    // ─── Authentication ─────────────────────────────────────────
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never return password in queries
    },

    role: {
      type: String,
      enum: {
        values: ROLE_LIST,
        message: 'Role must be either admin or user',
      },
      default: ROLES.USER,
    },

    // ─── Account Status ─────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // ─── Security: Login Attempt Tracking ───────────────────────
    loginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    lockUntil: {
      type: Date,
      default: null,
    },

    // ─── Adaptive Engine: Current Difficulty ────────────────────
    currentDifficulty: {
      type: String,
      enum: Object.values(DIFFICULTY),
      default: DIFFICULTY.EASY,
    },

    // ─── Gamification ───────────────────────────────────────────
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

    quizStreak: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastQuizDate: {
      type: Date,
      default: null,
    },

    // ─── Profile ────────────────────────────────────────────────
    avatar: {
      type: String,
      default: null,
    },

    bio: {
      type: String,
      maxlength: [200, 'Bio cannot exceed 200 characters'],
      default: null,
    },

    // ─── Soft Delete ────────────────────────────────────────────
    deletedAt: {
      type: Date,
      default: null,
    },

    // ─── Password Reset ─────────────────────────────────────────
    passwordChangedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.loginAttempts;
        delete ret.lockUntil;
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
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ totalXP: -1 }); // Leaderboard queries
userSchema.index({ deletedAt: 1 });
userSchema.index({ createdAt: -1 });

// ═══════════════════════════════════════════════════════════════
// VIRTUALS
// ═══════════════════════════════════════════════════════════════

// Full name virtual
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Check if account is locked
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// ═══════════════════════════════════════════════════════════════
// PRE-SAVE HOOKS
// ═══════════════════════════════════════════════════════════════

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Only hash if password is modified
  if (!this.isModified('password')) return next();

  try {
    this.password = await bcrypt.hash(
      this.password,
      config.BCRYPT_SALT_ROUNDS
    );

    // Update passwordChangedAt when password is changed
    if (!this.isNew) {
      this.passwordChangedAt = new Date(Date.now() - 1000);
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Filter soft-deleted users from queries
userSchema.pre(/^find/, function (next) {
  this.where({ deletedAt: null });
  next();
});

// ═══════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════

/**
 * @method comparePassword
 * @description Compare plain password with hashed password.
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * @method incrementLoginAttempts
 * @description Track failed login attempts and lock account if needed.
 */
userSchema.methods.incrementLoginAttempts = async function () {
  // Reset lock if it has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1, lockUntil: null },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account after max attempts
  if (
    this.loginAttempts + 1 >= config.SECURITY.MAX_LOGIN_ATTEMPTS &&
    !this.isLocked
  ) {
    updates.$set = {
      lockUntil: new Date(Date.now() + config.SECURITY.LOCK_TIME),
    };
  }

  return this.updateOne(updates);
};

/**
 * @method resetLoginAttempts
 * @description Reset login attempts after successful login.
 */
userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $set: { loginAttempts: 0, lockUntil: null },
  });
};

/**
 * @method softDelete
 * @description Soft delete user account.
 */
userSchema.methods.softDelete = function () {
  return this.updateOne({ deletedAt: new Date() });
};

/**
 * @method changedPasswordAfter
 * @description Check if password was changed after JWT was issued.
 */
userSchema.methods.changedPasswordAfter = function (jwtIssuedAt) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return jwtIssuedAt < changedTimestamp;
  }
  return false;
};

// ═══════════════════════════════════════════════════════════════
// STATIC METHODS
// ═══════════════════════════════════════════════════════════════

/**
 * @static findByEmail
 * @description Find user by email including password field.
 */
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() }).select('+password +loginAttempts +lockUntil');
};

const User = mongoose.model('User', userSchema);
module.exports = User;