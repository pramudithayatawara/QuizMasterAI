import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { authAPI } from '../api/auth.api.js';
import { disconnectSocket } from '../socket/socket.client.js';
import toast from 'react-hot-toast';

/**
 * @store useAuthStore
 * @description Global authentication state management.
 */
export const useAuthStore = create(
  persist(
    (set, get) => ({
      // ─── State ──────────────────────────────────────────────────────────────
      user:         null,
      accessToken:  null,
      isLoading:    false,
      isInitialized: false,

      // ─── Computed ───────────────────────────────────────────────────────────
      isAuthenticated: () => !!get().user && !!get().accessToken,
      isAdmin:         () => get().user?.role === 'admin',

      // ─── Actions ────────────────────────────────────────────────────────────

      /**
       * @action initializeAuth
       * Restore auth state from localStorage on app mount.
       */
      initializeAuth: () => {
        const stored = localStorage.getItem('accessToken');
        if (stored) {
          set({ accessToken: stored });
        }

        // Listen for forced logout events (from axios interceptor)
        window.addEventListener('auth:logout', () => {
          get().logout(false); // Silent logout
        });

        set({ isInitialized: true });
      },

      /**
       * @action register
       */
      register: async (data) => {
        set({ isLoading: true });
        try {
          const response = await authAPI.register(data);
          const { user } = response.data;

          localStorage.setItem('accessToken', response.data.accessToken || null);
          set({ user, accessToken: response.data.accessToken || null, isLoading: false });

          toast.success(`Welcome to QuizAI, ${user.firstName}! 🎉`);
          return { success: true };

        } catch (error) {
          set({ isLoading: false });
          const message = error.response?.data?.message || 'Registration failed.';
          toast.error(message);
          return { success: false, message };
        }
      },

      /**
       * @action login
       */
      login: async (credentials) => {
        set({ isLoading: true });
        try {
          const response = await authAPI.login(credentials);
          const { user, tokens } = response.data;

          localStorage.setItem('accessToken', tokens.accessToken);
          set({ user, accessToken: tokens.accessToken, isLoading: false });

          toast.success(`Welcome back, ${user.firstName}! 👋`);
          return { success: true, user };

        } catch (error) {
          set({ isLoading: false });
          const message = error.response?.data?.message || 'Login failed.';
          toast.error(message);
          return { success: false, message };
        }
      },

      /**
       * @action logout
       */
      logout: async (showToast = true) => {
        try {
          await authAPI.logout();
        } catch {
          // Continue logout even if API fails
        }

        disconnectSocket();
        localStorage.removeItem('accessToken');

        set({
          user:        null,
          accessToken: null,
          isLoading:   false,
        });

        if (showToast) {
          toast.success('Logged out successfully.');
        }
      },

      /**
       * @action fetchMe
       * Fetch fresh user data from server.
       */
      fetchMe: async () => {
        try {
          const response = await authAPI.getMe();
          set({ user: response.data.user });
        } catch {
          // Token might be invalid, logout
          get().logout(false);
        }
      },

      /**
       * @action updateUser
       * Update user in store after profile update.
       */
      updateUser: (updatedUser) => {
        set({ user: { ...get().user, ...updatedUser } });
      },

      updateAvatar: (avatarUrl) => {
        set({ user: { ...get().user, avatar: avatarUrl } });
      },

      /**
       * @action setToken
       */
      setToken: (token) => {
        localStorage.setItem('accessToken', token);
        set({ accessToken: token });
      },
    }),

    {
      name:    'auth-store',
      storage: createJSONStorage(() => localStorage),
      // Only persist user and token
      partialize: (state) => ({
        user:        state.user,
        accessToken: state.accessToken,
      }),
    }
  )
);