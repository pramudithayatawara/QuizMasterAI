'use strict';

const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const asyncHandler = require('../utils/asyncHandler');
const settingsController = require('../controllers/settings.controller');
const settingsValidator = require('../validators/settings.validator');

/**
 * @router SettingsRoutes
 * @baseURL /api/v1/settings
 */

// All routes require authentication
router.use(protect);

// ─── Get Settings ─────────────────────────────────────────────────────────────
router.get(
  '/',
  asyncHandler(settingsController.getSettings)
);

// ─── Update Settings ───────────────────────────────────────────────────────────
router.put(
  '/',
  settingsValidator.updateSettings,
  validate,
  asyncHandler(settingsController.updateSettings)
);

// ─── Reset Settings ───────────────────────────────────────────────────────────
router.post(
  '/reset',
  asyncHandler(settingsController.resetSettings)
);

module.exports = router;
