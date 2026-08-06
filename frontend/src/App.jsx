import React, { useEffect } from 'react';
import AppRoutes from './routes/index.jsx';
import { useAuthStore } from './store/auth.store.js';
import { useTheme } from './hooks/useTheme.js';

/**
 * @component App
 * @description Root application component.
 * Initializes auth state and renders routes.
 */
const App = () => {
  const { initializeAuth } = useAuthStore();
  const { theme } = useTheme();

  useEffect(() => {
    // Restore auth state from localStorage on mount
    initializeAuth();
  }, [initializeAuth]);

  return <AppRoutes />;
};

export default App;