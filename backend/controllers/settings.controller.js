'use strict';

const UserSettings = require('../models/UserSettings.model');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { DIFFICULTY } = require('../constants/difficulty');

/**
 * @controller SettingsController
 * @description Handles user settings operations.
 */

/**
 * @function getSettings
 * @description Get current user settings
 */
const getSettings = asyncHandler(async (req, res) => {
  let settings = await UserSettings.findOne({ userId: req.user._id });

  // Create default settings if they don't exist
  if (!settings) {
    settings = await UserSettings.create({ userId: req.user._id });
  }

  return ApiResponse.success(
    res,
    200,
    'Settings retrieved successfully.',
    settings.getSettings()
  );
});

/**
 * @function updateSettings
 * @description Update user settings (partial updates supported)
 */
const updateSettings = asyncHandler(async (req, res) => {
  const updates = req.body;

  // Find or create settings
  let settings = await UserSettings.findOne({ userId: req.user._id });
  
  if (!settings) {
    settings = await UserSettings.create({ userId: req.user._id });
  }

  // Update only provided fields
  const updatedSettings = await settings.updateSettings(updates);

  return ApiResponse.success(
    res,
    200,
    'Settings updated successfully.',
    updatedSettings.getSettings()
  );
});

/**
 * @function resetSettings
 * @description Reset settings to default values
 */
const resetSettings = asyncHandler(async (req, res) => {
  await UserSettings.findOneAndDelete({ userId: req.user._id });
  
  // Create fresh default settings
  const settings = await UserSettings.create({ userId: req.user._id });

  return ApiResponse.success(
    res,
    200,
    'Settings reset to defaults successfully.',
    settings.getSettings()
  );
});

module.exports = {
  getSettings,
  updateSettings,
  resetSettings,
};
