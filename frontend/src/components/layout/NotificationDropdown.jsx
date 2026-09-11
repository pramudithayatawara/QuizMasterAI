import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellOff,
  CheckCheck,
  Check,
  Trash2,
  Sparkles,
  Swords,
  Trophy,
  Brain,
  Clock,
  Settings as SettingsIcon,
  ChevronRight,
  TrendingUp,
  RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNotificationStore } from '../../store/notification.store.js';
import { useTheme } from '../../hooks/useTheme.js';
import { formatRelativeTime } from '../../utils/formatters.js';
import { ROUTES } from '../../constants/routes.js';

/**
 * @component NotificationDropdown
 * @description Interactive notification center with real-time badges, filtering, and quick navigation.
 */
const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const {
    notifications = [],
    markAsRead,
    toggleRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    resetToDefault,
  } = useNotificationStore();

  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const unreadCount = safeNotifications.filter((n) => !n.read).length;

  // Filtered notifications
  const displayedNotifications =
    filter === 'unread'
      ? safeNotifications.filter((n) => !n.read)
      : safeNotifications;

  // Close dropdown on outside click or ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    const handleClickOutside = (e) => {
      const path = e.composedPath ? e.composedPath() : [];
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        !path.includes(containerRef.current)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Action handlers with feedback
  const handleMarkAllAsRead = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (unreadCount === 0) {
      toast('All notifications are already marked as read', { icon: 'ℹ️' });
      return;
    }
    markAllAsRead();
    toast.success('All notifications marked as read');
  };

  const handleDeleteNotification = (e, notifId) => {
    e.preventDefault();
    e.stopPropagation();
    removeNotification(notifId);
    toast.success('Notification removed');
  };

  const handleToggleRead = (e, notifId, currentRead) => {
    e.preventDefault();
    e.stopPropagation();
    toggleRead(notifId);
    toast.success(currentRead ? 'Marked as unread' : 'Marked as read');
  };

  const handleClearAll = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (safeNotifications.length === 0) return;
    clearAll();
    toast.success('All notifications cleared');
  };

  const handleResetDemo = (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetToDefault();
    toast.success('Notifications restored');
  };

  // Type helper for styling and icons
  const getTypeConfig = (type) => {
    switch (type) {
      case 'adaptive':
        return {
          icon: TrendingUp,
          bg: isDark ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' : 'bg-purple-100 text-purple-600 border-purple-200',
          badge: 'Adaptive AI',
        };
      case 'battle':
        return {
          icon: Swords,
          bg: isDark ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-amber-100 text-amber-600 border-amber-200',
          badge: 'Battle Arena',
        };
      case 'achievement':
        return {
          icon: Trophy,
          bg: isDark ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' : 'bg-yellow-100 text-yellow-600 border-yellow-200',
          badge: 'Achievement',
        };
      case 'quiz':
        return {
          icon: Brain,
          bg: isDark ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-600 border-emerald-200',
          badge: 'Quiz',
        };
      case 'system':
      default:
        return {
          icon: Sparkles,
          bg: isDark ? 'bg-primary-500/15 text-primary-400 border-primary-500/30' : 'bg-primary-100 text-primary-600 border-primary-200',
          badge: 'System',
        };
    }
  };

  const handleItemClick = (notif) => {
    markAsRead(notif.id);
    if (notif.link) {
      setIsOpen(false);
      navigate(notif.link);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="View notifications"
        className={`relative p-2.5 rounded-xl transition-all duration-200 ${
          isOpen
            ? isDark
              ? 'bg-dark-800 text-primary-400 ring-2 ring-primary-500/30'
              : 'bg-light-200 text-primary-600 ring-2 ring-primary-500/30'
            : isDark
            ? 'text-dark-400 hover:text-dark-100 hover:bg-dark-800'
            : 'text-light-600 hover:text-light-900 hover:bg-light-200'
        }`}
      >
        <Bell size={20} className={unreadCount > 0 ? 'text-primary-400' : ''} />

        {/* Unread notification indicator badge */}
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center
                       bg-gradient-to-r from-red-500 to-primary-500 text-white
                       text-[10px] font-bold rounded-full shadow-lg shadow-red-500/30 border border-dark-900"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute right-0 top-full mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] z-50
                       rounded-2xl border shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden ${
                         isDark
                           ? 'bg-dark-900/95 border-dark-700/80 shadow-black/60'
                           : 'bg-white/95 border-light-300 shadow-slate-300/60'
                       }`}
          >
            {/* Header */}
            <div
              className={`p-4 border-b flex items-center justify-between gap-2 ${
                isDark ? 'border-dark-800 bg-dark-900/50' : 'border-light-200 bg-light-50/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-primary-500/10 text-primary-400 border border-primary-500/20">
                  <Bell size={16} />
                </div>
                <div>
                  <h3
                    className={`font-semibold text-sm ${
                      isDark ? 'text-dark-50' : 'text-light-900'
                    }`}
                  >
                    Notifications
                  </h3>
                  <p className={`text-[11px] ${isDark ? 'text-dark-400' : 'text-light-600'}`}>
                    {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                  </p>
                </div>
              </div>

              {/* Mark all as read button */}
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={unreadCount === 0}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  unreadCount > 0
                    ? 'text-primary-400 hover:text-primary-300 hover:bg-primary-500/10 cursor-pointer'
                    : isDark
                    ? 'text-dark-600 opacity-50 cursor-not-allowed'
                    : 'text-light-400 opacity-50 cursor-not-allowed'
                }`}
                title={unreadCount > 0 ? 'Mark all as read' : 'All notifications already read'}
              >
                <CheckCheck size={14} />
                <span>Mark all read</span>
              </button>
            </div>

            {/* Filter Tabs */}
            <div
              className={`px-3 py-2 border-b flex items-center gap-2 ${
                isDark ? 'border-dark-800 bg-dark-950/40' : 'border-light-200 bg-light-100/40'
              }`}
            >
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                  filter === 'all'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : isDark
                    ? 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
                    : 'text-light-600 hover:text-light-900 hover:bg-light-200'
                }`}
              >
                All
                <span
                  className={`px-1.5 py-0.2 text-[10px] rounded-full ${
                    filter === 'all'
                      ? 'bg-primary-700/80 text-white'
                      : isDark
                      ? 'bg-dark-800 text-dark-400'
                      : 'bg-light-200 text-light-600'
                  }`}
                >
                  {safeNotifications.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                  filter === 'unread'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : isDark
                    ? 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
                    : 'text-light-600 hover:text-light-900 hover:bg-light-200'
                }`}
              >
                Unread
                {unreadCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 text-[10px] rounded-full font-semibold ${
                      filter === 'unread'
                        ? 'bg-primary-700/80 text-white'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-dark-800/40 divide-light-200/50">
              {displayedNotifications.length === 0 ? (
                <div className="py-10 px-4 text-center flex flex-col items-center justify-center">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
                      isDark ? 'bg-dark-800/80 text-dark-500' : 'bg-light-200 text-light-400'
                    }`}
                  >
                    <BellOff size={22} />
                  </div>
                  <h4
                    className={`text-sm font-medium mb-1 ${
                      isDark ? 'text-dark-200' : 'text-light-800'
                    }`}
                  >
                    {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
                  </h4>
                  <p className={`text-xs max-w-[240px] mb-3 ${isDark ? 'text-dark-400' : 'text-light-500'}`}>
                    {filter === 'unread'
                      ? 'You have caught up with all unread alerts.'
                      : 'Your notification center is empty.'}
                  </p>

                  {safeNotifications.length === 0 && (
                    <button
                      type="button"
                      onClick={handleResetDemo}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-400 bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/30 rounded-lg transition-colors cursor-pointer"
                    >
                      <RotateCcw size={13} />
                      <span>Restore sample notifications</span>
                    </button>
                  )}
                </div>
              ) : (
                displayedNotifications.map((notif) => {
                  const typeConfig = getTypeConfig(notif.type);
                  const Icon = typeConfig.icon;

                  return (
                    <div
                      key={notif.id}
                      className={`relative p-3.5 flex items-start gap-3 transition-colors ${
                        !notif.read
                          ? isDark
                            ? 'bg-primary-500/[0.07] hover:bg-primary-500/[0.12]'
                            : 'bg-primary-50/80 hover:bg-primary-100/80'
                          : isDark
                          ? 'hover:bg-dark-800/50'
                          : 'hover:bg-light-100'
                      }`}
                    >
                      {/* Left accent bar for unread */}
                      {!notif.read && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-500 to-indigo-500" />
                      )}

                      {/* Icon */}
                      <div
                        onClick={() => handleItemClick(notif)}
                        className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center border cursor-pointer ${typeConfig.bg}`}
                      >
                        <Icon size={16} />
                      </div>

                      {/* Content (clickable to open link) */}
                      <div
                        onClick={() => handleItemClick(notif)}
                        className="flex-1 min-w-0 cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${typeConfig.bg}`}
                          >
                            {typeConfig.badge}
                          </span>
                          <span
                            className={`text-[11px] flex items-center gap-1 ${
                              isDark ? 'text-dark-400' : 'text-light-500'
                            }`}
                          >
                            <Clock size={10} />
                            {formatRelativeTime(notif.createdAt)}
                          </span>
                        </div>

                        <h4
                          className={`text-xs leading-snug mb-1 truncate ${
                            notif.read
                              ? isDark
                                ? 'text-dark-300 font-medium'
                                : 'text-light-700 font-medium'
                              : isDark
                              ? 'text-dark-50 font-bold'
                              : 'text-light-900 font-bold'
                          }`}
                        >
                          {notif.title}
                        </h4>

                        <p
                          className={`text-xs line-clamp-2 leading-relaxed ${
                            isDark ? 'text-dark-400' : 'text-light-600'
                          }`}
                        >
                          {notif.message}
                        </p>

                        {notif.link && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-primary-400 mt-1 font-medium hover:underline">
                            View details <ChevronRight size={11} />
                          </span>
                        )}
                      </div>

                      {/* Dedicated Action Buttons Column (Right Side) */}
                      <div
                        className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Toggle Read/Unread */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleRead(e, notif.id, notif.read)}
                          title={notif.read ? 'Mark as unread' : 'Mark as read'}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            notif.read
                              ? isDark
                                ? 'text-dark-500 hover:text-primary-400 hover:bg-dark-700'
                                : 'text-light-400 hover:text-primary-600 hover:bg-light-200'
                              : 'text-primary-400 bg-primary-500/10 hover:bg-primary-500/20'
                          }`}
                        >
                          <Check
                            size={14}
                            className={notif.read ? 'text-dark-400' : 'text-primary-400 stroke-[2.5]'}
                          />
                        </button>

                        {/* Delete Single Notification */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteNotification(e, notif.id)}
                          title="Delete notification"
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isDark
                              ? 'text-dark-400 hover:text-red-400 hover:bg-red-500/10'
                              : 'text-light-500 hover:text-red-500 hover:bg-red-50'
                          }`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div
              className={`p-3 border-t flex items-center justify-between gap-2 text-xs ${
                isDark ? 'border-dark-800 bg-dark-900/70' : 'border-light-200 bg-light-50/70'
              }`}
            >
              {safeNotifications.length > 0 ? (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                    isDark
                      ? 'text-dark-400 hover:text-red-400 hover:bg-red-500/10'
                      : 'text-light-500 hover:text-red-500 hover:bg-red-50'
                  }`}
                  title="Remove all notifications"
                >
                  <Trash2 size={13} />
                  <span>Clear all</span>
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate(ROUTES.SETTINGS);
                }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${
                  isDark
                    ? 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
                    : 'text-light-600 hover:text-light-900 hover:bg-light-200'
                } transition-colors cursor-pointer`}
              >
                <SettingsIcon size={13} />
                <span>Settings</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationDropdown;
