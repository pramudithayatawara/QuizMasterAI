'use strict';

const express = require('express');
const router = express.Router();
const { param } = require('express-validator');

const resultController = require('../controllers/result.controller');
const { validate } = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.post(
  '/generate/:attemptId',
  [param('attemptId').isMongoId()],
  validate,
  resultController.generate
);

router.get('/analytics', resultController.getAnalytics);

router.get(
  '/attempt/:attemptId',
  [param('attemptId').isMongoId()],
  validate,
  resultController.getByAttempt
);

router.get('/', resultController.getAll);

module.exports = router;