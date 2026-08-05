'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

const config = require('./config/env');
const helmetConfig = require('./config/helmet');
const corsOptions = require('./config/cors');
const { globalLimiter } = require('./config/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');
const { sanitizeInput } = require('./middleware/sanitize.middleware');
const routes = require('./routes/index');
const logger = require('./utils/logger');

/**
 * @module app
 * @description Express application factory.
 * Configures all middleware in correct order and mounts routes.
 * Does NOT start the server (handled in server.js).
 */

const app = express();

// ═══════════════════════════════════════════════════════════════
// SECURITY MIDDLEWARE (Must be first)
// ═══════════════════════════════════════════════════════════════

// 1. Helmet - HTTP security headers
app.use(helmet(helmetConfig));

// 2. CORS - Cross-origin resource sharing
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight

// 3. Global rate limiter
app.use(globalLimiter);

// ═══════════════════════════════════════════════════════════════
// REQUEST PARSING MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

// 4. JSON body parser (100kb limit to prevent large payload attacks)
app.use(express.json({ limit: '100kb' }));

// 5. URL-encoded body parser
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// ═══════════════════════════════════════════════════════════════
// SANITIZATION MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

// 6. MongoDB injection prevention
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn(`MongoDB injection attempt blocked. Key: ${key}, IP: ${req.ip}`);
  },
}));

// 7. HTTP Parameter Pollution prevention
app.use(hpp({
  whitelist: ['sort', 'fields', 'difficulty', 'type'],
}));

// 8. XSS sanitization (custom middleware)
app.use(sanitizeInput);

// ═══════════════════════════════════════════════════════════════
// LOGGING MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

// 9. Morgan HTTP request logging
const morganFormat = config.IS_PRODUCTION ? 'combined' : 'dev';
app.use(morgan(morganFormat, { stream: logger.stream }));

// ═══════════════════════════════════════════════════════════════
// STATIC FILES
// ═══════════════════════════════════════════════════════════════

// 10. Static file serving (not PDF files - they use signed URLs)
// app.use('/static', express.static('public'));

// ═══════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════

// 11. Mount all routes under /api/v1
app.use(`/api/${config.API_VERSION}`, routes);

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLING (Must be last)
// ═══════════════════════════════════════════════════════════════

// 12. 404 handler for undefined routes
app.use(notFoundHandler);

// 13. Global error handler
app.use(errorHandler);

module.exports = app;