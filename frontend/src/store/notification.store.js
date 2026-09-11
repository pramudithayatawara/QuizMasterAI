import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ROUTES } from '../constants/routes.js';

export const INITIAL_NOTIFICATIONS = [
  {
    id: 'notif-adaptive-01',
    type: 'adaptive',
    title: 'Adaptive AI Difficulty Calibrated',
    message: 'Your recent quiz performance indicates high mastery. Recommended difficulty has been adjusted for optimal learning.',
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(), // 35 mins ago
    read: false,
    link: ROUTES.QUIZ_HISTORY,
  },
  {
    id: 'notif-battle-01',
    type: 'battle',
    title: 'PvP Battle Arena is Live!',
    message: 'Put your knowledge to the test in real-time PvP Quiz Battles and climb the leaderboard.',
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
    read: false,
    link: ROUTES.BATTLE_LOBBY,
  },
  {
    id: 'notif-achievement-01',
    type: 'achievement',
    title: 'Explorer Rank Unlocked! 🏆',
    message: 'Welcome to QuizMasterAI! You earned the Explorer badge for getting started.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    read: true,
    link: ROUTES.GAMIFICATION,
  },
  {
    id: 'notif-system-01',
    type: 'system',
    title: 'Daily Practice Streak',
    message: 'Complete a quick quiz today to maintain your daily study streak and earn bonus XP.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    read: true,
    link: ROUTES.QUIZ_LIST,
  },
];

/**
 * @store useNotificationStore
 * @description Global notification store with persistence and helper methods.
 */
export const useNotificationStore = create(
  persist(
    (set, get) => ({
      notifications: INITIAL_NOTIFICATIONS,

      /**
       * Add a new notification to the top of the feed.
       */
      addNotification: ({
        type = 'system',
        title,
        message,
        link = null,
        data = null,
      }) => {
        const newNotif = {
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type,
          title,
          message,
          link,
          data,
          createdAt: new Date().toISOString(),
          read: false,
        };

        set((state) => {
          const list = Array.isArray(state.notifications) ? state.notifications : [];
          return { notifications: [newNotif, ...list] };
        });

        return newNotif;
      },

      /**
       * Mark a specific notification as read.
       */
      markAsRead: (id) => {
        set((state) => {
          const list = Array.isArray(state.notifications) ? state.notifications : [];
          return {
            notifications: list.map((n) =>
              n.id === id ? { ...n, read: true } : n
            ),
          };
        });
      },

      /**
       * Toggle read/unread status of a notification.
       */
      toggleRead: (id) => {
        let newStatus = true;
        set((state) => {
          const list = Array.isArray(state.notifications) ? state.notifications : [];
          return {
            notifications: list.map((n) => {
              if (n.id === id) {
                newStatus = !n.read;
                return { ...n, read: !n.read };
              }
              return n;
            }),
          };
        });
        return newStatus;
      },

      /**
       * Mark all notifications as read.
       */
      markAllAsRead: () => {
        set((state) => {
          const list = Array.isArray(state.notifications) ? state.notifications : [];
          return {
            notifications: list.map((n) => ({ ...n, read: true })),
          };
        });
      },

      /**
       * Delete a specific notification.
       */
      removeNotification: (id) => {
        set((state) => {
          const list = Array.isArray(state.notifications) ? state.notifications : [];
          return {
            notifications: list.filter((n) => n.id !== id),
          };
        });
      },

      /**
       * Clear all notifications.
       */
      clearAll: () => {
        set({ notifications: [] });
      },

      /**
       * Reset notifications back to initial demo state.
       */
      resetToDefault: () => {
        set({ notifications: INITIAL_NOTIFICATIONS });
      },
    }),
    {
      name: 'quiz-notifications-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ notifications: state.notifications }),
    }
  )
);
