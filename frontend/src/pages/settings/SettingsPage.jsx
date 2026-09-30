import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Gamepad2,
  Palette,
  Bell,
  Lock,
  Save,
  RotateCcw,
  Volume2,
  VolumeX,
  Clock,
  Shield,
  Eye,
  EyeOff,
  Check,
  ChevronRight,
} from 'lucide-react';
import { useSettingsStore } from '../../store/settings.store.js';
import Button from '../../components/common/Button.jsx';
import toast from 'react-hot-toast';

/**
 * @component ToggleSwitch
 * @description Custom toggle switch component
 */
const ToggleSwitch = ({ checked, onChange, disabled = false }) => {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
        checked ? 'bg-indigo-500' : 'bg-slate-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <motion.div
        initial={false}
        animate={{ x: checked ? 24 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md"
      />
    </button>
  );
};

/**
 * @page SettingsPage
 * @description User settings page with tabbed layout
 */
const SettingsPage = () => {
  const { settings, isLoading, updateSettings, resetSettings, fetchSettings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState('gameplay');
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize settings on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Update local settings when store changes
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // Check for changes
  useEffect(() => {
    setHasChanges(JSON.stringify(localSettings) !== JSON.stringify(settings));
  }, [localSettings, settings]);

  const tabs = [
    { id: 'gameplay', label: 'Gameplay', icon: Gamepad2 },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Lock },
  ];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updateSettings(localSettings);
      if (result.success) {
        setHasChanges(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
      setIsSaving(true);
      try {
        const result = await resetSettings();
        if (result.success) {
          setHasChanges(false);
        }
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleToggle = (category, field, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [category]: {
        ...(prev?.[category] || {}),
        [field]: value,
      },
    }));
  };

  const handleSelect = (category, field, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [category]: {
        ...(prev?.[category] || {}),
        [field]: value,
      },
    }));
  };

  return (
    <div className="max-w-6xl mx-auto min-h-screen pb-12">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1.5">Settings & Preferences</h1>
          <p className="text-dark-400 text-sm">Customize gameplay audio, visual theme, notification alerts, and privacy</p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReset}
            disabled={isSaving}
            leftIcon={<RotateCcw size={15} />}
          >
            Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={isSaving}
            leftIcon={<Save size={15} />}
          >
            Save Preferences
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-64 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                  : 'text-dark-400 hover:bg-dark-800/50 hover:text-dark-200'
              }`}
            >
              <tab.icon size={18} />
              <span className="font-medium">{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="ml-auto w-1 h-4 bg-primary-500 rounded-full"
                  initial={false}
                />
              )}
            </button>
          ))}
        </div>

        {/* Settings Content */}
        <div className="flex-1">
          <div className="bg-dark-800/50 backdrop-blur-sm border border-dark-700/50 rounded-2xl p-6">
            <AnimatePresence mode="wait">
              {activeTab === 'gameplay' && (
                <motion.div
                  key="gameplay"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center">
                      <Gamepad2 className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">Gameplay Settings</h2>
                      <p className="text-sm text-dark-400">Customize your gaming experience</p>
                    </div>
                  </div>

                  {/* Sound Effects */}
                  <div className="flex items-center justify-between p-4 bg-dark-900/50 rounded-xl border border-dark-700/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-dark-800 rounded-lg flex items-center justify-center">
                        <Volume2 className="w-5 h-5 text-dark-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Sound Effects</p>
                        <p className="text-sm text-dark-400">Enable game sound effects</p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={localSettings.gameplay.soundEffects}
                      onChange={(value) => handleToggle('gameplay', 'soundEffects', value)}
                    />
                  </div>

                  {/* Background Music */}
                  <div className="flex items-center justify-between p-4 bg-dark-900/50 rounded-xl border border-dark-700/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-dark-800 rounded-lg flex items-center justify-center">
                        <VolumeX className="w-5 h-5 text-dark-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Background Music</p>
                        <p className="text-sm text-dark-400">Play ambient music during gameplay</p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={localSettings.gameplay.backgroundMusic}
                      onChange={(value) => handleToggle('gameplay', 'backgroundMusic', value)}
                    />
                  </div>

                  {/* Timer Visibility */}
                  <div className="flex items-center justify-between p-4 bg-dark-900/50 rounded-xl border border-dark-700/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-dark-800 rounded-lg flex items-center justify-center">
                        <Clock className="w-5 h-5 text-dark-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Timer Visibility</p>
                        <p className="text-sm text-dark-400">Show countdown timer during quizzes</p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={localSettings.gameplay.timerVisibility}
                      onChange={(value) => handleToggle('gameplay', 'timerVisibility', value)}
                    />
                  </div>

                  {/* Default Difficulty */}
                  <div className="p-4 bg-dark-900/50 rounded-xl border border-dark-700/50">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-dark-800 rounded-lg flex items-center justify-center">
                        <Gamepad2 className="w-5 h-5 text-dark-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Default Difficulty</p>
                        <p className="text-sm text-dark-400">Preferred difficulty level for new quizzes</p>
                      </div>
                    </div>
                    <select
                      value={localSettings.gameplay.defaultDifficulty}
                      onChange={(e) => handleSelect('gameplay', 'defaultDifficulty', e.target.value)}
                      className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </motion.div>
              )}

              {activeTab === 'appearance' && (
                <motion.div
                  key="appearance"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-secondary-500/20 rounded-xl flex items-center justify-center">
                      <Palette className="w-5 h-5 text-secondary-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">Appearance Settings</h2>
                      <p className="text-sm text-dark-400">Customize visual preferences</p>
                    </div>
                  </div>

                  {/* Theme */}
                  <div className="p-4 bg-dark-900/50 rounded-xl border border-dark-700/50">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-dark-800 rounded-lg flex items-center justify-center">
                        <Palette className="w-5 h-5 text-dark-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Theme</p>
                        <p className="text-sm text-dark-400">Choose your preferred color scheme</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleSelect('appearance', 'theme', 'dark')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          localSettings.appearance.theme === 'dark'
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-dark-700 hover:border-dark-600'
                        }`}
                      >
                        <div className="w-full h-8 bg-dark-900 rounded-lg mb-2" />
                        <p className="text-white text-sm font-medium">Dark</p>
                      </button>
                      <button
                        onClick={() => handleSelect('appearance', 'theme', 'light')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          localSettings.appearance.theme === 'light'
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-dark-700 hover:border-dark-600'
                        }`}
                      >
                        <div className="w-full h-8 bg-white rounded-lg mb-2" />
                        <p className="text-white text-sm font-medium">Light</p>
                      </button>
                    </div>
                  </div>

                  {/* Reduced Motion */}
                  <div className="flex items-center justify-between p-4 bg-dark-900/50 rounded-xl border border-dark-700/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-dark-800 rounded-lg flex items-center justify-center">
                        <Eye className="w-5 h-5 text-dark-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Reduced Motion</p>
                        <p className="text-sm text-dark-400">Minimize animations and transitions</p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={localSettings.appearance.reducedMotion}
                      onChange={(value) => handleToggle('appearance', 'reducedMotion', value)}
                    />
                  </div>
                </motion.div>
              )}

              {activeTab === 'notifications' && (
                <motion.div
                  key="notifications"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-accent-500/20 rounded-xl flex items-center justify-center">
                      <Bell className="w-5 h-5 text-accent-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">Notification Settings</h2>
                      <p className="text-sm text-dark-400">Manage your notification preferences</p>
                    </div>
                  </div>

                  {/* Daily Reminders */}
                  <div className="flex items-center justify-between p-4 bg-dark-900/50 rounded-xl border border-dark-700/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-dark-800 rounded-lg flex items-center justify-center">
                        <Bell className="w-5 h-5 text-dark-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Daily Reminders</p>
                        <p className="text-sm text-dark-400">Get daily quiz reminders</p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={localSettings.notifications.dailyReminders}
                      onChange={(value) => handleToggle('notifications', 'dailyReminders', value)}
                    />
                  </div>

                  {/* Battle Invites */}
                  <div className="flex items-center justify-between p-4 bg-dark-900/50 rounded-xl border border-dark-700/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-dark-800 rounded-lg flex items-center justify-center">
                        <SettingsIcon className="w-5 h-5 text-dark-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Battle Invites</p>
                        <p className="text-sm text-dark-400">Receive battle challenge notifications</p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={localSettings.notifications.battleInvites}
                      onChange={(value) => handleToggle('notifications', 'battleInvites', value)}
                    />
                  </div>

                  {/* Email Updates */}
                  <div className="flex items-center justify-between p-4 bg-dark-900/50 rounded-xl border border-dark-700/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-dark-800 rounded-lg flex items-center justify-center">
                        <Check className="w-5 h-5 text-dark-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Email Updates</p>
                        <p className="text-sm text-dark-400">Receive weekly progress reports via email</p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={localSettings.notifications.emailUpdates}
                      onChange={(value) => handleToggle('notifications', 'emailUpdates', value)}
                    />
                  </div>
                </motion.div>
              )}

              {activeTab === 'privacy' && (
                <motion.div
                  key="privacy"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                      <Lock className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">Privacy Settings</h2>
                      <p className="text-sm text-dark-400">Control your profile visibility</p>
                    </div>
                  </div>

                  {/* Public Profile */}
                  <div className="flex items-center justify-between p-4 bg-dark-900/50 rounded-xl border border-dark-700/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-dark-800 rounded-lg flex items-center justify-center">
                        <Eye className="w-5 h-5 text-dark-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Public Profile</p>
                        <p className="text-sm text-dark-400">Allow others to see your profile</p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={localSettings.privacy.publicProfile}
                      onChange={(value) => handleToggle('privacy', 'publicProfile', value)}
                    />
                  </div>

                  {/* Show on Leaderboard */}
                  <div className="flex items-center justify-between p-4 bg-dark-900/50 rounded-xl border border-dark-700/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-dark-800 rounded-lg flex items-center justify-center">
                    <div className="w-5 h-5 text-yellow-400">🏆</div>
                      </div>
                      <div>
                        <p className="text-white font-medium">Show on Leaderboard</p>
                        <p className="text-sm text-dark-400">Appear in public rankings</p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={localSettings.privacy.showOnLeaderboard}
                      onChange={(value) => handleToggle('privacy', 'showOnLeaderboard', value)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Save/Reset Bar */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50"
          >
            <div className="bg-dark-900/95 backdrop-blur-md border border-dark-700/50 rounded-2xl shadow-2xl p-4 flex items-center gap-4">
              <p className="text-white text-sm">You have unsaved changes</p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReset}
                  disabled={isSaving}
                  leftIcon={<RotateCcw size={16} />}
                >
                  Reset
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  isLoading={isSaving}
                  leftIcon={<Save size={16} />}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SettingsPage;
