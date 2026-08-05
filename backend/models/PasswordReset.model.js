'use strict';

const mongoose = require('mongoose');

/**
 * @model PasswordReset
 * @description Manages secure password reset tokens.
 * Token is hashed before storage.
 * Single-use: marked as used after consumption.
 */

const passwordResetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Hashed token stored (plain token sent via email)
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // Auto-delete after expiry
    },

    isUsed: {
      type: Boolean,
      default: false,
    },

    usedAt: {
      type: Date,
      default: null,
    },

    // Track request origin
    ipAddress: {
      type: String,
      default: null,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// ─── Instance Methods ────────────────────────────────────────────────────────

/**
 * @method markAsUsed
 * @description Mark token as used to prevent reuse.
 */
passwordResetSchema.methods.markAsUsed = function () {
  this.isUsed = true;
  this.usedAt = new Date();
  return this.save();
};

const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);
module.exports = PasswordReset;