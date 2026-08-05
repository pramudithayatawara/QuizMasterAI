'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');

const { combine, timestamp, printf, colorize, errors, json } = format;

// ─── Custom log format for development ─────────────────────────────────────
const devFormat = printf(({ level, message, timestamp: ts, stack }) => {
  return `${ts} [${level}]: ${stack || message}`;
});

// ─── Custom log format for production ──────────────────────────────────────
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

// ─── Transport: Console ─────────────────────────────────────────────────────
const consoleTransport = new transports.Console({
  format: combine(
    colorize({ all: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    devFormat
  ),
});

// ─── Transport: Error log file ──────────────────────────────────────────────
const errorFileTransport = new transports.File({
  filename: path.join('logs', 'error.log'),
  level: 'error',
  format: prodFormat,
  maxsize: 5242880, // 5MB
  maxFiles: 5,
});

// ─── Transport: Combined log file ───────────────────────────────────────────
const combinedFileTransport = new transports.File({
  filename: path.join('logs', 'combined.log'),
  format: prodFormat,
  maxsize: 5242880, // 5MB
  maxFiles: 10,
});

// ─── Logger instance ────────────────────────────────────────────────────────
const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  defaultMeta: { service: 'rag-quiz-backend' },
  transports: [
    consoleTransport,
    errorFileTransport,
    combinedFileTransport,
  ],
  // Do not exit on handled exceptions
  exitOnError: false,
});

// ─── Stream for Morgan HTTP logger ──────────────────────────────────────────
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

module.exports = logger;