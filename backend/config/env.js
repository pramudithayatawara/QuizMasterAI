'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/**
 * @module env
 * @description Centralized environment variable configuration.
 * Validates all required environment variables on startup.
 * Throws descriptive errors if critical variables are missing.
 */

// ─── Required environment variables ────────────────────────────────────────
const REQUIRED_ENV_VARS = [
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'AES_SECRET_KEY',
];

// ─── Validate on startup ────────────────────────────────────────────────────
const validateEnv = () => {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file against .env.example'
    );
  }
};

validateEnv();

// ─── Exported config object ─────────────────────────────────────────────────
const config = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  API_VERSION: process.env.API_VERSION || 'v1',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',

  // Database
  MONGODB_URI: process.env.MONGODB_URI,

  // JWT
  JWT: {
    ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || '15m',
    REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || '7d',
  },

  // AES Encryption
  AES: {
    SECRET_KEY: process.env.AES_SECRET_KEY,
    IV_LENGTH: parseInt(process.env.AES_IV_LENGTH, 10) || 16,
  },

  // Bcrypt
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,

  // Email
  EMAIL: {
    HOST: process.env.EMAIL_HOST,
    PORT: parseInt(process.env.EMAIL_PORT, 10) || 587,
    USER: process.env.EMAIL_USER,
    PASS: process.env.EMAIL_PASS,
    FROM: process.env.EMAIL_FROM,
  },

  // Frontend
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // OpenAI
  OPENAI: {
    API_KEY: process.env.OPENAI_API_KEY,
    MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  },

  // Gemini
  GEMINI: {
    API_KEY: process.env.GEMINI_API_KEY,
    MODEL: process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest',
  },

  // AI Provider selection
  AI_PROVIDER: process.env.AI_PROVIDER || 'openai',

  // Vector Store
  VECTOR_STORE: {
    PATH: process.env.VECTOR_STORE_PATH || './vectorstore',
    DIMENSION: parseInt(process.env.VECTOR_DIMENSION, 10) || 1536,
  },

  // File Upload
  UPLOAD: {
    PATH: process.env.UPLOAD_PATH || './uploads',
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE, 10) || 10485760, // 10MB
  },

  // Rate Limiting
  RATE_LIMIT: {
    WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 900000,
    MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    AUTH_MAX: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 5,
  },

  // Account Security
  SECURITY: {
    MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) || 5,
    LOCK_TIME: parseInt(process.env.LOCK_TIME, 10) || 900000, // 15 minutes
  },

  // Password Reset
  PASSWORD_RESET_EXPIRES: parseInt(process.env.PASSWORD_RESET_EXPIRES, 10) || 3600000,
};

module.exports = config;