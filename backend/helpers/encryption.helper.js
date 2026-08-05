'use strict';

const crypto = require('crypto');
const config = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * @module encryptionHelper
 * @description AES-256-GCM encryption/decryption utility.
 * Used for encrypting sensitive data stored in database.
 * GCM mode provides authenticated encryption (integrity check).
 *
 * @security
 * - Uses AES-256-GCM (authenticated encryption)
 * - Random IV per encryption operation
 * - Auth tag provides tamper detection
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits
const AUTH_TAG_LENGTH = 16;

// ─── Derive 32-byte key ──────────────────────────────────────────────────────
const getKey = () => {
  const secret = config.AES.SECRET_KEY;
  if (!secret) throw new AppError('AES secret key not configured', 500);
  // Ensure exactly 32 bytes using SHA-256
  return crypto.createHash('sha256').update(secret).digest();
};

/**
 * @function encrypt
 * @description Encrypts plaintext using AES-256-GCM.
 * @param {string} plaintext - Data to encrypt
 * @returns {string} Encrypted string: iv:authTag:ciphertext (hex encoded)
 */
const encrypt = (plaintext) => {
  try {
    if (!plaintext) return null;

    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(String(plaintext), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:ciphertext
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    throw new AppError('Encryption failed', 500);
  }
};

/**
 * @function decrypt
 * @description Decrypts AES-256-GCM encrypted string.
 * @param {string} encryptedData - Encrypted string from encrypt()
 * @returns {string} Decrypted plaintext
 */
const decrypt = (encryptedData) => {
  try {
    if (!encryptedData) return null;

    const [ivHex, authTagHex, ciphertext] = encryptedData.split(':');
    if (!ivHex || !authTagHex || !ciphertext) {
      throw new Error('Invalid encrypted data format');
    }

    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new AppError('Decryption failed. Data may be tampered.', 500);
  }
};

/**
 * @function hashToken
 * @description SHA-256 hash a token for secure storage.
 * @param {string} token
 * @returns {string} Hex hash
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * @function generateSecureToken
 * @description Generate cryptographically secure random token.
 * @param {number} bytes - Number of random bytes
 * @returns {string} Hex token
 */
const generateSecureToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

module.exports = {
  encrypt,
  decrypt,
  hashToken,
  generateSecureToken,
};