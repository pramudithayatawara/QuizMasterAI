import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { settingsAPI } from '../api/settings.api.js';
import toast from 'react-hot-toast';

/**
 * @store useSettingsStore
 * @description Global settings state management.
 */
export const useSettingsStore = create(
  persist(
    (set, get) => ({
      // ─── State ──────────────────────────────────────────────────────────────
      settings: {
        gameplay: {
          soundEffects: true,
          backgroundMusic: false,
          timerVisibility: true,
          defaultDifficulty: 'medium',
        },
        appearance: {
          theme: 'dark',
          reducedMotion: false,
        },
        notifications: {
          dailyReminders: true,
          battleInvites: true,
          emailUpdates: false,
        },
        privacy: {
          publicProfile: true,
          showOnLeaderboard: true,
        },
      },
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
          set({ settings: response.data.data, isLoading: false, isInitialized: true });
        } catch (error) {
          set({ isLoading: false });
          const message = error.response?.data?.message || 'Failed to fetch settings.';
          toast.error(message);
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
          set({ 
            settings: response.data.data, 
            isLoading: false 
          });
          toast.success('Settings updated successfully!');
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          const message = error.response?.data?.message || 'Failed to update settings.';
          toast.error(message);
          return { success: false, message };
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
          set({ 
            settings: response.data.data, 
            isLoading: false 
          });
          toast.success('Settings reset to defaults!');
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          const message = error.response?.data?.message || 'Failed to reset settings.';
          toast.error(message);
          return { success: false, message };
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
