import { useEffect } from 'react';
import { useSettingsStore } from '../store/settings.store.js';

/**
 * @hook useTheme
 * @description Hook to apply theme changes to the document
 */
export const useTheme = () => {
  const { settings, fetchSettings, isInitialized } = useSettingsStore();

  useEffect(() => {
    // Initialize settings if not already done
    if (!isInitialized) {
      fetchSettings();
    }
  }, [fetchSettings, isInitialized]);

  useEffect(() => {
    const theme = settings?.appearance?.theme || 'dark';
    
    // Apply theme to document
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, [settings?.appearance?.theme]);

  return {
    theme: settings?.appearance?.theme || 'dark',
    reducedMotion: settings?.appearance?.reducedMotion || false,
  };
};
