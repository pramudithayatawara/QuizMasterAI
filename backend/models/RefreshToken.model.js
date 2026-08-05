'use strict';

const mongoose = require('mongoose');

/**
 * @model RefreshToken
 * @description Stores hashed refresh tokens for secure rotation.
 * Token itself is hashed before storage (SHA-256).
 * Supports token revocation and expiry.
 */

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Store hashed token (never plain token)
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // MongoDB TTL auto-delete
    },

    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Device/session tracking
    userAgent: {
      type: String,
      default: null,
    },

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
    toJSON: {
      transform: (doc, ret) => {
        delete ret.tokenHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
refreshTokenSchema.index({ userId: 1, isRevoked: 1 });
refreshTokenSchema.index({ tokenHash: 1 }, { unique: true });

// ─── Static Methods ──────────────────────────────────────────────────────────

/**
 * @static revokeAllForUser
 * @description Revoke all refresh tokens for a user (logout all devices).
 */
refreshTokenSchema.statics.revokeAllForUser = function (userId) {
  return this.updateMany(
    { userId, isRevoked: false },
    { $set: { isRevoked: true } }
  );
};

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
module.exports = RefreshToken;