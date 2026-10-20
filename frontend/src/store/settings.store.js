import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { settingsAPI } from '../api/settings.api.js';
import toast from 'react-hot-toast';

const DEFAULT_SETTINGS = {
  gameplay: {
    soundEffects: true,
    soundVolume: 80,
    backgroundMusic: false,
    timerVisibility: true,
    timerSound: true,
    autoAdvance: false,
    instantFeedback: true,
    defaultDifficulty: 'medium',
  },
  appearance: {
    theme: 'dark', // 'dark' | 'light' | 'midnight'
    accentColor: 'indigo', // 'indigo' | 'emerald' | 'violet' | 'amber' | 'rose'
    fontSize: 'standard', // 'compact' | 'standard' | 'large'
    reducedMotion: false,
    confettiEffects: true,
  },
  ai: {
    preferredEngine: 'gemini', // 'gemini' | 'local_t5'
    defaultQuestionCount: 10,
    questionType: 'mcq', // 'mcq' | 'tf' | 'mixed'
    showSourceCitations: true,
    strictBloomTaxonomy: true,
  },
  notifications: {
    dailyReminders: true,
    reminderTime: '19:00',
    battleInvites: true,
    achievementAlerts: true,
    emailUpdates: false,
  },
  privacy: {
    publicProfile: true,
    showOnLeaderboard: true,
    anonymousBattle: false,
  },
};

const mergeWithDefaults = (incoming) => {
  if (!incoming || typeof incoming !== 'object') return DEFAULT_SETTINGS;
  return {
    gameplay: { ...DEFAULT_SETTINGS.gameplay, ...(incoming.gameplay || {}) },
    appearance: { ...DEFAULT_SETTINGS.appearance, ...(incoming.appearance || {}) },
    ai: { ...DEFAULT_SETTINGS.ai, ...(incoming.ai || {}) },
    notifications: { ...DEFAULT_SETTINGS.notifications, ...(incoming.notifications || {}) },
    privacy: { ...DEFAULT_SETTINGS.privacy, ...(incoming.privacy || {}) },
  };
};

/**
 * @store useSettingsStore
 * @description Global settings state management.
 */
export const useSettingsStore = create(
  persist(
    (set, get) => ({
      // ─── State ──────────────────────────────────────────────────────────────
      settings: DEFAULT_SETTINGS,
      isLoading: false,
      isInitialized: false,

      // ─── Actions ────────────────────────────────────────────────────────────

      /**
       * @action fetchSettings
       * Fetch user settings from server.
       */
      fetchSettings: async () => {
        set({ isLoading: true });
        try {
          const response = await settingsAPI.getSettings();
          const raw = response.data?.data || response.data;
          set({ settings: mergeWithDefaults(raw), isLoading: false, isInitialized: true });
        } catch (error) {
          set({ isLoading: false, settings: DEFAULT_SETTINGS, isInitialized: true });
          const message = error.response?.data?.message || 'Using local preferences.';
          console.warn('Settings fetch fallback:', message);
        }
      },

      /**
       * @action updateSettings
       * Update user settings (partial updates supported).
       */
      updateSettings: async (updates) => {
        set({ isLoading: true });
        try {
          const response = await settingsAPI.updateSettings(updates);
          const raw = response.data?.data || response.data || updates;
          set({ 
            settings: mergeWithDefaults(raw), 
            isLoading: false 
          });
          toast.success('Settings updated successfully!');
          return { success: true };
        } catch (error) {
          // Optimistic local update fallback
          set({ settings: mergeWithDefaults(updates), isLoading: false });
          toast.success('Settings saved locally!');
          return { success: true };
        }
      },

      /**
       * @action resetSettings
       * Reset settings to default values.
       */
      resetSettings: async () => {
        set({ isLoading: true });
        try {
          const response = await settingsAPI.resetSettings();
          const raw = response.data?.data || response.data || DEFAULT_SETTINGS;
          set({ 
            settings: mergeWithDefaults(raw), 
            isLoading: false 
          });
          toast.success('Settings reset to defaults!');
          return { success: true };
        } catch (error) {
          set({ settings: DEFAULT_SETTINGS, isLoading: false });
          toast.success('Settings reset to defaults!');
          return { success: true };
        }
      },

      /**
       * @action setLocalSettings
       * Update settings locally without API call (for UI state).
       */
      setLocalSettings: (updates) => {
        set({ settings: { ...get().settings, ...updates } });
      },
    }),

    {
      name: 'settings-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
