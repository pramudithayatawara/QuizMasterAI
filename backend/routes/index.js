'use strict';

const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const pdfRoutes = require('./pdf.routes');
const quizRoutes = require('./quiz.routes');
const resultRoutes = require('./result.routes');
const gamificationRoutes = require('./gamification.routes');
const battleRoutes = require('./battle.routes');
const adminRoutes = require('./admin.routes');

/**
 * @module routes
 * @description Central route registry.
 * All routes are prefixed with /api/v1 in app.js
 */

// ─── Health check ─────────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    service: 'RAG Quiz Backend',
    version: process.env.API_VERSION || 'v1',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    environment: process.env.NODE_ENV,
  });
});

// ─── Route mounting ───────────────────────────────────────────────────────────
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/pdf', pdfRoutes);
router.use('/quiz', quizRoutes);
router.use('/results', resultRoutes);
router.use('/gamification', gamificationRoutes);
router.use('/battle', battleRoutes);
router.use('/admin', adminRoutes);

module.exports = router;