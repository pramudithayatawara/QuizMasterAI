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
  Sparkles,
  Bot,
  Zap,
  Sliders,
  CheckCircle2,
  KeyRound,
  FileText,
  UserCheck,
  HelpCircle,
  Play
} from 'lucide-react';
import { useSettingsStore } from '../../store/settings.store.js';
import { useAuthStore } from '../../store/auth.store.js';
import { authAPI } from '../../api/auth.api.js';
import { playCorrectSound } from '../../utils/soundEffects.js';
import Button from '../../components/common/Button.jsx';
import toast from 'react-hot-toast';

/**
 * @component ToggleSwitch
 * @description Sleek animated toggle switch
 */
const ToggleSwitch = ({ checked, onChange, disabled = false }) => {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/40 ${
        checked ? 'bg-primary-500' : 'bg-slate-700/80 border border-slate-600/40'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <motion.div
        initial={false}
        animate={{ x: checked ? 24 : 3 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-md"
      />
    </button>
  );
};

/**
 * @page SettingsPage
 * @description Comprehensive settings, preferences, appearance, AI generation, and account security.
 */
const SettingsPage = () => {
  const { settings, isLoading, updateSettings, resetSettings, fetchSettings } = useSettingsStore();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState('appearance');
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    setHasChanges(JSON.stringify(localSettings) !== JSON.stringify(settings));
  }, [localSettings, settings]);

  const tabs = [
    { id: 'appearance', label: 'Appearance', icon: Palette, badge: 'Themes' },
    { id: 'gameplay', label: 'Gameplay & Audio', icon: Gamepad2 },
    { id: 'ai', label: 'AI & Generation', icon: Bot, badge: 'RAG' },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Account & Security', icon: Lock },
  ];

  const handleToggle = (category, field, value) => {
    setLocalSettings((prev) => ({
      ...prev,
      [category]: {
        ...(prev?.[category] || {}),
        [field]: value,
      },
    }));
  };

  const handleSelect = (category, field, value) => {
    setLocalSettings((prev) => ({
      ...prev,
      [category]: {
        ...(prev?.[category] || {}),
        [field]: value,
      },
    }));

    // Live theme preview
    if (category === 'appearance' && field === 'theme') {
      if (value === 'light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    }
  };

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
    if (window.confirm('Reset all preferences to system defaults?')) {
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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      toast.error('Please fill in both current and new passwords.');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long.');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await authAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success('Password changed successfully! 🔐');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const isLight = localSettings?.appearance?.theme === 'light';

  return (
    <div className="max-w-6xl mx-auto min-h-screen pb-20">
      {/* Page Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-dark-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Settings & Preferences</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-primary-500/15 text-primary-400 border border-primary-500/30">
              Cloud Synced
            </span>
          </div>
          <p className="text-dark-400 text-sm">
            Customize visual themes, gameplay audio, AI question generation parameters, and security
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReset}
            disabled={isSaving}
            leftIcon={<RotateCcw size={15} />}
          >
            Reset Defaults
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={isSaving}
            leftIcon={<Save size={15} />}
            className="shadow-lg shadow-primary-500/25"
          >
            Save Preferences
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar Tabs */}
        <div className="w-full lg:w-64 space-y-1.5 flex-shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all text-left font-medium text-sm relative ${
                  isActive
                    ? 'bg-primary-600/20 text-primary-300 border border-primary-500/40 shadow-sm'
                    : 'text-dark-400 hover:text-dark-100 hover:bg-dark-800/60 border border-transparent'
                }`}
              >
                <div
                  className={`p-2 rounded-xl transition-colors ${
                    isActive ? 'bg-primary-500/20 text-primary-400' : 'bg-dark-800 text-dark-400'
                  }`}
                >
                  <Icon size={18} />
                </div>
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-dark-700/80 text-dark-300 border border-dark-600/50">
                    {tab.badge}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="activeSettingsIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-primary-500 rounded-r-full"
                  />
                )}
              </button>
            );
          })}

          {/* Quick Info Box */}
          <div className="mt-6 p-4 rounded-2xl bg-dark-800/40 border border-dark-700/40 text-xs space-y-2">
            <p className="font-semibold text-dark-300 flex items-center gap-1.5">
              <Shield size={14} className="text-emerald-400" />
              Role: <span className="text-emerald-300 font-bold uppercase">{user?.role || 'student'}</span>
            </p>
            <p className="text-dark-500">
              User ID #{user?.id || 1} • {user?.email || 'user@quizmaster.ai'}
            </p>
          </div>
        </div>

        {/* Tab Content Cards */}
        <div className="flex-1">
          <div className="bg-dark-900/70 backdrop-blur-xl border border-dark-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
            <AnimatePresence mode="wait">
              {/* ─────────────────────────────────────────────────────────────
                  TAB 1: APPEARANCE (Fixed & Beautified!)
              ───────────────────────────────────────────────────────────── */}
              {activeTab === 'appearance' && (
                <motion.div
                  key="appearance"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-8"
                >
                  <div className="border-b border-dark-800 pb-5">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Palette className="w-5 h-5 text-indigo-400" />
                      Visual Interface & Themes
                    </h2>
                    <p className="text-sm text-dark-400 mt-1">
                      Choose how QuizMasterAI looks and feels across your devices.
                    </p>
                  </div>

                  {/* Themes Gallery */}
                  <div>
                    <label className="block text-sm font-semibold text-dark-200 mb-3">
                      Theme Preset
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Dark Nebula Card */}
                      <div
                        onClick={() => handleSelect('appearance', 'theme', 'dark')}
                        className={`cursor-pointer group relative p-4 rounded-2xl border-2 transition-all ${
                          localSettings?.appearance?.theme === 'dark'
                            ? 'border-primary-500 bg-primary-500/10 shadow-lg shadow-primary-500/10'
                            : 'border-dark-800 bg-dark-950/60 hover:border-dark-700'
                        }`}
                      >
                        {/* Mini UI Mockup */}
                        <div className="h-24 w-full bg-slate-900 rounded-xl p-2.5 border border-slate-800 flex flex-col justify-between mb-3 shadow-inner">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                            </div>
                            <div className="w-12 h-2 rounded bg-indigo-500/50" />
                          </div>
                          <div className="space-y-1.5">
                            <div className="w-3/4 h-2.5 rounded bg-slate-700/80" />
                            <div className="w-1/2 h-2 rounded bg-slate-800" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-white text-sm">Dark Nebula (Default)</p>
                            <p className="text-xs text-dark-400">Deep slate, high contrast, low eye fatigue</p>
                          </div>
                          {localSettings?.appearance?.theme === 'dark' && (
                            <CheckCircle2 size={18} className="text-primary-400" />
                          )}
                        </div>
                      </div>

                      {/* Clean Light Card (Polished & Elegant - No blinding white box!) */}
                      <div
                        onClick={() => handleSelect('appearance', 'theme', 'light')}
                        className={`cursor-pointer group relative p-4 rounded-2xl border-2 transition-all ${
                          localSettings?.appearance?.theme === 'light'
                            ? 'border-primary-500 bg-primary-500/10 shadow-lg shadow-primary-500/10'
                            : 'border-dark-800 bg-dark-950/60 hover:border-dark-700'
                        }`}
                      >
                        {/* Mini Light UI Mockup */}
                        <div className="h-24 w-full bg-slate-100 rounded-xl p-2.5 border border-slate-300 flex flex-col justify-between mb-3 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                              <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                              <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                            </div>
                            <div className="w-12 h-2 rounded bg-blue-500" />
                          </div>
                          <div className="space-y-1.5">
                            <div className="w-3/4 h-2.5 rounded bg-slate-300" />
                            <div className="w-1/2 h-2 rounded bg-slate-200" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-white text-sm">Clean Slate (Light)</p>
                            <p className="text-xs text-dark-400">Daytime clarity with polished contrast</p>
                          </div>
                          {localSettings?.appearance?.theme === 'light' && (
                            <CheckCircle2 size={18} className="text-primary-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Accent Colors */}
                  <div>
                    <label className="block text-sm font-semibold text-dark-200 mb-2">
                      Accent Glow Tint
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                      {[
                        { id: 'indigo', name: 'Indigo Purple', color: 'bg-indigo-500' },
                        { id: 'emerald', name: 'Emerald Green', color: 'bg-emerald-500' },
                        { id: 'violet', name: 'Royal Violet', color: 'bg-purple-500' },
                        { id: 'amber', name: 'Cyber Amber', color: 'bg-amber-500' },
                        { id: 'rose', name: 'Rose Red', color: 'bg-rose-500' },
                      ].map((accent) => {
                        const isSelected = (localSettings?.appearance?.accentColor || 'indigo') === accent.id;
                        return (
                          <button
                            key={accent.id}
                            type="button"
                            onClick={() => handleSelect('appearance', 'accentColor', accent.id)}
                            className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-2 ${
                              isSelected
                                ? 'border-primary-500 bg-primary-500/10'
                                : 'border-dark-800 bg-dark-950/40 hover:border-dark-700'
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-full ${accent.color} shadow-md`} />
                            <span className="text-xs font-medium text-dark-200">{accent.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Motion & Effects */}
                  <div className="space-y-3 pt-2">
                    <h3 className="text-sm font-semibold text-dark-200">Motion & Visual Polish</h3>

                    <div className="flex items-center justify-between p-4 bg-dark-950/50 rounded-2xl border border-dark-800">
                      <div>
                        <p className="text-white font-medium text-sm">Reduced Motion</p>
                        <p className="text-xs text-dark-400">Disable 3D card flips, spring bounces, and parallax</p>
                      </div>
                      <ToggleSwitch
                        checked={localSettings?.appearance?.reducedMotion || false}
                        onChange={(val) => handleToggle('appearance', 'reducedMotion', val)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-dark-950/50 rounded-2xl border border-dark-800">
                      <div>
                        <p className="text-white font-medium text-sm">Victory Confetti & Visual Effects</p>
                        <p className="text-xs text-dark-400">Show celebration particles when winning battles or acing quizzes</p>
                      </div>
                      <ToggleSwitch
                        checked={localSettings?.appearance?.confettiEffects ?? true}
                        onChange={(val) => handleToggle('appearance', 'confettiEffects', val)}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 2: GAMEPLAY & AUDIO
              ───────────────────────────────────────────────────────────── */}
              {activeTab === 'gameplay' && (
                <motion.div
                  key="gameplay"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-6"
                >
                  <div className="border-b border-dark-800 pb-5">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Gamepad2 className="w-5 h-5 text-primary-400" />
                      Gameplay & Audio Settings
                    </h2>
                    <p className="text-sm text-dark-400 mt-1">
                      Configure interactive quiz parameters, sound volume, timers, and difficulty.
                    </p>
                  </div>

                  {/* Sound Effects with Volume & Test Button */}
                  <div className="p-4 bg-dark-950/50 rounded-2xl border border-dark-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-400">
                          <Volume2 size={20} />
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">Interactive Sound Effects</p>
                          <p className="text-xs text-dark-400">Synthesized chimes for correct/wrong answers & countdowns</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => playCorrectSound()}
                          className="px-2.5 py-1 text-xs rounded-lg bg-dark-800 text-dark-200 hover:text-white border border-dark-700 flex items-center gap-1 transition-colors"
                        >
                          <Play size={12} /> Test Sound
                        </button>
                        <ToggleSwitch
                          checked={localSettings?.gameplay?.soundEffects ?? true}
                          onChange={(val) => handleToggle('gameplay', 'soundEffects', val)}
                        />
                      </div>
                    </div>

                    {localSettings?.gameplay?.soundEffects && (
                      <div className="pt-2 border-t border-dark-800/80 flex items-center gap-4">
                        <span className="text-xs text-dark-400 w-24">Volume ({localSettings?.gameplay?.soundVolume || 80}%)</span>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          value={localSettings?.gameplay?.soundVolume || 80}
                          onChange={(e) => handleSelect('gameplay', 'soundVolume', Number(e.target.value))}
                          className="flex-1 accent-primary-500 cursor-pointer h-1.5 bg-dark-800 rounded-lg"
                        />
                      </div>
                    )}
                  </div>

                  {/* Countdown Timer */}
                  <div className="flex items-center justify-between p-4 bg-dark-950/50 rounded-2xl border border-dark-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400">
                        <Clock size={20} />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">Visible Countdown Timer</p>
                        <p className="text-xs text-dark-400">Display circular animated timer on quiz questions</p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={localSettings?.gameplay?.timerVisibility ?? true}
                      onChange={(val) => handleToggle('gameplay', 'timerVisibility', val)}
                    />
                  </div>

                  {/* Instant Answer Explanation */}
                  <div className="flex items-center justify-between p-4 bg-dark-950/50 rounded-2xl border border-dark-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">Instant Explanation Rationale</p>
                        <p className="text-xs text-dark-400">Display citation and rationale immediately after picking an answer</p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={localSettings?.gameplay?.instantFeedback ?? true}
                      onChange={(val) => handleToggle('gameplay', 'instantFeedback', val)}
                    />
                  </div>

                  {/* Auto-advance */}
                  <div className="flex items-center justify-between p-4 bg-dark-950/50 rounded-2xl border border-dark-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400">
                        <Zap size={20} />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">Auto-Advance to Next Question</p>
                        <p className="text-xs text-dark-400">Automatically progress after submitting without clicking 'Next'</p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={localSettings?.gameplay?.autoAdvance || false}
                      onChange={(val) => handleToggle('gameplay', 'autoAdvance', val)}
                    />
                  </div>

                  {/* Default Difficulty */}
                  <div className="p-4 bg-dark-950/50 rounded-2xl border border-dark-800">
                    <label className="block text-sm font-semibold text-white mb-1.5">
                      Default Quiz Starting Difficulty
                    </label>
                    <p className="text-xs text-dark-400 mb-3">
                      When launching new quizzes, start at this baseline difficulty level
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {['easy', 'medium', 'hard'].map((lvl) => {
                        const isSelected = (localSettings?.gameplay?.defaultDifficulty || 'medium') === lvl;
                        return (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => handleSelect('gameplay', 'defaultDifficulty', lvl)}
                            className={`py-2.5 px-4 rounded-xl border text-sm font-bold uppercase transition-all ${
                              isSelected
                                ? 'bg-primary-500 text-white border-primary-500 shadow-md'
                                : 'bg-dark-900 text-dark-300 border-dark-700 hover:border-dark-600'
                            }`}
                          >
                            {lvl}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 3: AI & GENERATION (NEW RESEARCH SUPERPOWER!)
              ───────────────────────────────────────────────────────────── */}
              {activeTab === 'ai' && (
                <motion.div
                  key="ai"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-6"
                >
                  <div className="border-b border-dark-800 pb-5">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Bot className="w-5 h-5 text-indigo-400" />
                      AI Model & RAG Generation Parameters
                    </h2>
                    <p className="text-sm text-dark-400 mt-1">
                      Configure the underlying neural models, chunk citations, and Bloom's taxonomy depth.
                    </p>
                  </div>

                  {/* Model Engine Selector */}
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">
                      Preferred Question Generation Engine
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Gemini Flash */}
                      <div
                        onClick={() => handleSelect('ai', 'preferredEngine', 'gemini')}
                        className={`cursor-pointer p-4 rounded-2xl border-2 transition-all relative ${
                          (localSettings?.ai?.preferredEngine || 'gemini') === 'gemini'
                            ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                            : 'border-dark-800 bg-dark-950/40 hover:border-dark-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs px-2 py-0.5 rounded font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Recommended
                          </span>
                          {(localSettings?.ai?.preferredEngine || 'gemini') === 'gemini' && (
                            <CheckCircle2 size={18} className="text-indigo-400" />
                          )}
                        </div>
                        <h4 className="font-bold text-white text-base">Google Gemini Flash</h4>
                        <p className="text-xs text-dark-400 mt-1 leading-relaxed">
                          Cloud neural engine. High reasoning accuracy, deep distractors, and Bloom's taxonomy compliance.
                        </p>
                      </div>

                      {/* Offline Local Model */}
                      <div
                        onClick={() => handleSelect('ai', 'preferredEngine', 'local_t5')}
                        className={`cursor-pointer p-4 rounded-2xl border-2 transition-all relative ${
                          localSettings?.ai?.preferredEngine === 'local_t5'
                            ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                            : 'border-dark-800 bg-dark-950/40 hover:border-dark-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs px-2 py-0.5 rounded font-bold bg-slate-700 text-slate-300">
                            Offline Safe
                          </span>
                          {localSettings?.ai?.preferredEngine === 'local_t5' && (
                            <CheckCircle2 size={18} className="text-indigo-400" />
                          )}
                        </div>
                        <h4 className="font-bold text-white text-base">Local HuggingFace T5</h4>
                        <p className="text-xs text-dark-400 mt-1 leading-relaxed">
                          Runs 100% locally on your machine without internet or external API calls.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Default Question Count */}
                  <div className="p-4 bg-dark-950/50 rounded-2xl border border-dark-800">
                    <label className="block text-sm font-semibold text-white mb-1.5">
                      Default Question Count
                    </label>
                    <p className="text-xs text-dark-400 mb-3">
                      Number of questions to synthesize per generated quiz session
                    </p>
                    <div className="grid grid-cols-4 gap-3">
                      {[5, 10, 15, 20].map((num) => {
                        const isSelected = (localSettings?.ai?.defaultQuestionCount || 10) === num;
                        return (
                          <button
                            key={num}
                            type="button"
                            onClick={() => handleSelect('ai', 'defaultQuestionCount', num)}
                            className={`py-2 px-3 rounded-xl border text-sm font-bold transition-all ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-500'
                                : 'bg-dark-900 text-dark-300 border-dark-700 hover:border-dark-600'
                            }`}
                          >
                            {num} Questions
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Source Citations */}
                  <div className="flex items-center justify-between p-4 bg-dark-950/50 rounded-2xl border border-dark-800">
                    <div>
                      <p className="text-white font-medium text-sm">Display Source Document Citations</p>
                      <p className="text-xs text-dark-400">
                        Include PDF chunk references and exact page snippets proving source validity
                      </p>
                    </div>
                    <ToggleSwitch
                      checked={localSettings?.ai?.showSourceCitations ?? true}
                      onChange={(val) => handleToggle('ai', 'showSourceCitations', val)}
                    />
                  </div>

                  {/* Strict Bloom's Taxonomy */}
                  <div className="flex items-center justify-between p-4 bg-dark-950/50 rounded-2xl border border-dark-800">
                    <div>
                      <p className="text-white font-medium text-sm">Bloom's Taxonomy Classification</p>
                      <p className="text-xs text-dark-400">
                        Label questions as Recall (Easy), Application (Medium), or Analysis (Hard)
                      </p>
                    </div>
                    <ToggleSwitch
                      checked={localSettings?.ai?.strictBloomTaxonomy ?? true}
                      onChange={(val) => handleToggle('ai', 'strictBloomTaxonomy', val)}
                    />
                  </div>
                </motion.div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 4: NOTIFICATIONS
              ───────────────────────────────────────────────────────────── */}
              {activeTab === 'notifications' && (
                <motion.div
                  key="notifications"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-5"
                >
                  <div className="border-b border-dark-800 pb-5">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Bell className="w-5 h-5 text-amber-400" />
                      Notification Alerts
                    </h2>
                    <p className="text-sm text-dark-400 mt-1">
                      Manage real-time alerts, daily study schedules, and challenge invitations.
                    </p>
                  </div>

                  {/* Daily Study Reminders */}
                  <div className="p-4 bg-dark-950/50 rounded-2xl border border-dark-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium text-sm">Daily Study Streak Reminders</p>
                        <p className="text-xs text-dark-400">Get gentle reminders to maintain your quiz learning streak</p>
                      </div>
                      <ToggleSwitch
                        checked={localSettings?.notifications?.dailyReminders ?? true}
                        onChange={(val) => handleToggle('notifications', 'dailyReminders', val)}
                      />
                    </div>

                    {localSettings?.notifications?.dailyReminders && (
                      <div className="pt-2 border-t border-dark-800/80 flex items-center justify-between">
                        <span className="text-xs text-dark-400">Preferred Reminder Time</span>
                        <input
                          type="time"
                          value={localSettings?.notifications?.reminderTime || '19:00'}
                          onChange={(e) => handleSelect('notifications', 'reminderTime', e.target.value)}
                          className="bg-dark-900 border border-dark-700 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Battle Challenges */}
                  <div className="flex items-center justify-between p-4 bg-dark-950/50 rounded-2xl border border-dark-800">
                    <div>
                      <p className="text-white font-medium text-sm">Multiplayer Battle Challenges</p>
                      <p className="text-xs text-dark-400">Receive instant pop-up invitations when friends challenge you</p>
                    </div>
                    <ToggleSwitch
                      checked={localSettings?.notifications?.battleInvites ?? true}
                      onChange={(val) => handleToggle('notifications', 'battleInvites', val)}
                    />
                  </div>

                  {/* Achievement & Badge Alerts */}
                  <div className="flex items-center justify-between p-4 bg-dark-950/50 rounded-2xl border border-dark-800">
                    <div>
                      <p className="text-white font-medium text-sm">Achievements & Level-Up Celebrations</p>
                      <p className="text-xs text-dark-400">Instant toast celebration when unlocking new badges and milestones</p>
                    </div>
                    <ToggleSwitch
                      checked={localSettings?.notifications?.achievementAlerts ?? true}
                      onChange={(val) => handleToggle('notifications', 'achievementAlerts', val)}
                    />
                  </div>
                </motion.div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 5: ACCOUNT & SECURITY (Includes Password Change!)
              ───────────────────────────────────────────────────────────── */}
              {activeTab === 'privacy' && (
                <motion.div
                  key="privacy"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-6"
                >
                  <div className="border-b border-dark-800 pb-5">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Lock className="w-5 h-5 text-red-400" />
                      Account Privacy & Security
                    </h2>
                    <p className="text-sm text-dark-400 mt-1">
                      Manage profile visibility, leaderboards, and update password credentials.
                    </p>
                  </div>

                  {/* Privacy Toggles */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-dark-950/50 rounded-2xl border border-dark-800">
                      <div>
                        <p className="text-white font-medium text-sm">Public Scholar Profile</p>
                        <p className="text-xs text-dark-400">Allow other students to view your badges and stats</p>
                      </div>
                      <ToggleSwitch
                        checked={localSettings?.privacy?.publicProfile ?? true}
                        onChange={(val) => handleToggle('privacy', 'publicProfile', val)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-dark-950/50 rounded-2xl border border-dark-800">
                      <div>
                        <p className="text-white font-medium text-sm">Display on Global Leaderboard</p>
                        <p className="text-xs text-dark-400">Show your XP score and rank on the public scholar leaderboard</p>
                      </div>
                      <ToggleSwitch
                        checked={localSettings?.privacy?.showOnLeaderboard ?? true}
                        onChange={(val) => handleToggle('privacy', 'showOnLeaderboard', val)}
                      />
                    </div>
                  </div>

                  {/* Change Password Form */}
                  <div className="p-5 bg-dark-950/70 rounded-3xl border border-dark-800 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-dark-800">
                      <KeyRound size={18} className="text-primary-400" />
                      <h3 className="font-bold text-white text-sm">Change Account Password</h3>
                    </div>

                    <form onSubmit={handleChangePassword} className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-dark-300 mb-1">
                          Current Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword.current ? 'text' : 'password'}
                            value={passwordData.currentPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                            placeholder="Enter current password"
                            className="w-full bg-dark-900 border border-dark-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword({ ...showPassword, current: !showPassword.current })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
                          >
                            {showPassword.current ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-dark-300 mb-1">
                            New Password
                          </label>
                          <div className="relative">
                            <input
                              type={showPassword.new ? 'text' : 'password'}
                              value={passwordData.newPassword}
                              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                              placeholder="Minimum 6 characters"
                              className="w-full bg-dark-900 border border-dark-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword({ ...showPassword, new: !showPassword.new })}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
                            >
                              {showPassword.new ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-dark-300 mb-1">
                            Confirm New Password
                          </label>
                          <div className="relative">
                            <input
                              type={showPassword.confirm ? 'text' : 'password'}
                              value={passwordData.confirmPassword}
                              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                              placeholder="Repeat new password"
                              className="w-full bg-dark-900 border border-dark-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
                            >
                              {showPassword.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <Button
                          type="submit"
                          variant="primary"
                          size="sm"
                          isLoading={isChangingPassword}
                          leftIcon={<KeyRound size={14} />}
                        >
                          Update Password
                        </Button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Floating Save/Reset Bottom Bar */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50"
          >
            <div className="bg-dark-950/95 backdrop-blur-2xl border border-primary-500/40 rounded-full shadow-2xl px-6 py-3.5 flex items-center gap-5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <p className="text-white text-sm font-semibold">Unsaved Preference Changes</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReset}
                  disabled={isSaving}
                  leftIcon={<RotateCcw size={14} />}
                >
                  Discard
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  isLoading={isSaving}
                  leftIcon={<Save size={14} />}
                  className="shadow-md shadow-primary-500/30"
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
