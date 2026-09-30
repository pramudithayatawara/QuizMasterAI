import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Bell, Menu, LogOut, User, Settings,
  Swords, ChevronDown, TrendingUp, Sparkles,
  CheckCheck, Trophy, Flame, Play, Clock,
  ExternalLink
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store.js';
import { useUIStore } from '../../store/ui.store.js';
import { useTheme } from '../../hooks/useTheme.js';
import { ROUTES } from '../../constants/routes.js';
import { notificationAPI } from '../../api/notification.api.js';
import { gamificationAPI } from '../../api/gamification.api.js';
import { formatRelativeTime } from '../../utils/formatters.js';
import Avatar from '../common/Avatar.jsx';

/**
 * @component Navbar
 * @description Iconic top navigation bar with dynamic level, real notifications flyout, and quick settings.
 */
const Navbar = () => {
  const { user, logout } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(user?.level || 1);
  const [totalXP, setTotalXP] = useState(0);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);

  const notifRef = useRef(null);
  const menuRef = useRef(null);

  const isDark = theme === 'dark';

  // 1. Fetch live user level and notifications
  const fetchNavbarData = async () => {
    try {
      // Gamification profile for dynamic level
      const gamifyRes = await gamificationAPI.getProfile().catch(() => null);
      if (gamifyRes?.data) {
        const p = gamifyRes.data.profile || gamifyRes.data;
        if (p?.level) setCurrentLevel(p.level);
        if (p?.total_points != null) setTotalXP(p.total_points);
      }

      // Notifications
      const notifRes = await notificationAPI.getNotifications().catch(() => null);
      if (notifRes?.data) {
        const list = notifRes.data.notifications || notifRes.data.data || [];
        setNotifications(list);
        const count = notifRes.data.unreadCount ?? list.filter(n => !n.isRead).length;
        setUnreadCount(count);
      }
    } catch (err) {
      console.warn('Navbar background sync:', err);
    }
  };

  useEffect(() => {
    fetchNavbarData();
    const interval = setInterval(fetchNavbarData, 20000); // 20s live polling
    return () => clearInterval(interval);
  }, [user]);

  // Handle outside click for popups
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  const handleNotificationClick = async (notif) => {
    try {
      await notificationAPI.markAsRead(notif.id).catch(() => {});
      setNotifications(prev =>
        prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifOpen(false);
      if (notif.target) {
        navigate(notif.target);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.clearAll().catch(() => {});
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const getNotifIcon = (type) => {
    switch (type) {
      case 'battle':
        return <Swords size={18} className="text-battle-400" />;
      case 'achievement':
        return <Trophy size={18} className="text-amber-400" />;
      case 'streak':
        return <Flame size={18} className="text-orange-400" />;
      case 'quiz':
        return <Brain size={18} className="text-purple-400" />;
      default:
        return <Sparkles size={18} className="text-primary-400" />;
    }
  };

  const isCurrentPath = (path) => location.pathname === path;

  return (
    <nav className={`h-16 ${isDark ? 'bg-dark-900/85 border-dark-700/60' : 'bg-white/85 border-light-300'} backdrop-blur-md border-b
                    flex items-center px-4 lg:px-6 gap-3.5 sticky top-0 z-40`}>
      {/* Sidebar Toggle for Mobile */}
      <button
        onClick={toggleSidebar}
        className={`p-2 rounded-xl ${isDark ? 'text-dark-400 hover:text-dark-100 hover:bg-dark-800' : 'text-light-600 hover:text-light-900 hover:bg-light-200'}
                   transition-colors lg:hidden`}
        aria-label="Toggle Navigation Menu"
      >
        <Menu size={20} />
      </button>

      {/* Brand Logo */}
      <Link to={ROUTES.DASHBOARD} className="flex items-center gap-2.5 mr-auto group">
        <div className="w-8 h-8 bg-gradient-to-tr from-primary-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-md shadow-primary-500/20 group-hover:scale-105 transition-transform">
          <Brain size={17} className="text-white" />
        </div>
        <span className={`font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-light-900'} text-lg hidden sm:block`}>
          QuizAI
        </span>
      </Link>

      {/* Battle CTA Button */}
      <Link
        to={ROUTES.BATTLE_LOBBY}
        className={`hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 border ${
          isCurrentPath(ROUTES.BATTLE_LOBBY)
            ? 'bg-battle-600/30 text-battle-300 border-battle-500/50 shadow-md shadow-battle-600/20'
            : 'bg-battle-600/15 text-battle-400 hover:text-battle-300 border-battle-500/30 hover:bg-battle-600/25'
        }`}
      >
        <Swords size={16} className="text-battle-400" />
        <span>Battle Mode</span>
      </Link>

      {/* Performance Analytics Button */}
      <Link
        to={ROUTES.QUIZ_HISTORY}
        className={`hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 border ${
          isCurrentPath(ROUTES.QUIZ_HISTORY)
            ? 'bg-purple-600/30 text-purple-300 border-purple-500/50 shadow-md shadow-purple-600/20'
            : 'bg-purple-600/15 text-purple-400 hover:text-purple-300 border-purple-500/30 hover:bg-purple-600/25'
        }`}
      >
        <TrendingUp size={16} className="text-purple-400" />
        <span>Performance</span>
      </Link>

      {/* Dynamic Scholar Level Chip */}
      {user && (
        <Link
          to={ROUTES.GAMIFICATION}
          title={`Level ${currentLevel} Scholar (${totalXP} XP) • Click to open Achievements`}
          className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
            isDark
              ? 'bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-primary-500/10 border-amber-500/30 hover:border-amber-400/60 shadow-sm shadow-amber-500/10 hover:scale-[1.02]'
              : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
          }`}
        >
          <Sparkles size={14} className="text-amber-400" />
          <span className={`text-xs ${isDark ? 'text-dark-300' : 'text-light-600'} font-medium`}>Level</span>
          <span className="text-sm font-extrabold text-amber-400">
            {currentLevel}
          </span>
        </Link>
      )}

      {/* Notifications Popover */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => {
            setNotifOpen(!notifOpen);
            if (!notifOpen) fetchNavbarData();
          }}
          className={`relative p-2 rounded-xl transition-all ${
            notifOpen
              ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
              : isDark ? 'text-dark-400 hover:text-dark-100 hover:bg-dark-800' : 'text-light-600 hover:text-light-900 hover:bg-light-200'
          }`}
          aria-label="View notifications"
        >
          <Bell size={19} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-primary-500 rounded-full ring-2 ring-dark-900 animate-pulse" />
          )}
        </button>

        <AnimatePresence>
          {notifOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className={`absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl shadow-2xl z-50 overflow-hidden border ${
                isDark ? 'bg-dark-900 border-dark-700/80' : 'bg-white border-light-300'
              }`}
            >
              {/* Header */}
              <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-dark-800 bg-dark-900/90' : 'border-light-200 bg-light-50'}`}>
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-primary-400" />
                  <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-light-900'}`}>Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-300 font-semibold border border-primary-500/30">
                      {unreadCount} new
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-dark-400 hover:text-primary-400 transition-colors flex items-center gap-1"
                  >
                    <CheckCheck size={14} />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-[380px] overflow-y-auto divide-y divide-dark-800/50">
                {notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3.5 transition-all cursor-pointer flex gap-3 hover:bg-dark-800/60 ${
                        !notif.isRead ? (isDark ? 'bg-primary-950/20' : 'bg-primary-50/40') : ''
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-dark-800 border border-dark-700/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                        {getNotifIcon(notif.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p className={`text-xs font-semibold truncate ${notif.isRead ? 'text-dark-300' : 'text-white'}`}>
                            {notif.title}
                          </p>
                          <span className="text-[10px] text-dark-400 whitespace-nowrap">
                            {formatRelativeTime(new Date(notif.createdAt))}
                          </span>
                        </div>
                        <p className="text-xs text-dark-400 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>

                        {notif.targetText && (
                          <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-primary-400 hover:text-primary-300">
                            <span>{notif.targetText}</span>
                            <ExternalLink size={11} />
                          </div>
                        )}
                      </div>

                      {!notif.isRead && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary-400 self-center flex-shrink-0" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 px-4">
                    <Bell size={28} className="text-dark-600 mx-auto mb-2 opacity-50" />
                    <p className={`text-sm font-semibold ${isDark ? 'text-dark-300' : 'text-light-700'}`}>No notifications</p>
                    <p className="text-xs text-dark-500 mt-0.5">You're all caught up with your quiz activity!</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Settings Navigation Button */}
      <Link
        to={ROUTES.SETTINGS}
        title="Settings"
        className={`p-2 rounded-xl transition-all ${
          isCurrentPath(ROUTES.SETTINGS)
            ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
            : isDark ? 'text-dark-400 hover:text-dark-100 hover:bg-dark-800' : 'text-light-600 hover:text-light-900 hover:bg-light-200'
        }`}
      >
        <Settings size={19} />
      </Link>

      {/* User Menu Dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={`flex items-center gap-2 p-1 rounded-xl transition-colors ${
            isDark ? 'hover:bg-dark-800' : 'hover:bg-light-200'
          }`}
          aria-label="User Account Menu"
        >
          <Avatar
            name={`${user?.firstName || user?.username} ${user?.lastName || ''}`}
            size="sm"
          />
          <ChevronDown
            size={14}
            className={`${isDark ? 'text-dark-400' : 'text-light-600'} transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
          />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className={`absolute right-0 top-full mt-2 w-60 z-50 rounded-2xl shadow-2xl py-2 border ${
                isDark ? 'bg-dark-900 border-dark-700/80' : 'bg-white border-light-300'
              }`}
            >
              {/* User info */}
              <div className={`px-4 py-3 border-b ${isDark ? 'border-dark-800' : 'border-light-200'}`}>
                <p className={`font-bold ${isDark ? 'text-white' : 'text-light-900'} text-sm truncate`}>
                  {user?.firstName ? `${user?.firstName} ${user?.lastName || ''}` : user?.username}
                </p>
                <p className={`text-xs ${isDark ? 'text-dark-400' : 'text-light-600'} truncate mt-0.5`}>
                  {user?.email}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[11px] px-2 py-0.5 rounded-md font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Level {currentLevel} Scholar
                  </span>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <Link
                  to={ROUTES.PROFILE}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                    isDark ? 'text-dark-300 hover:text-white hover:bg-dark-800/70' : 'text-light-700 hover:text-light-900 hover:bg-light-100'
                  }`}
                >
                  <User size={16} className="text-primary-400" />
                  <span>Profile Overview</span>
                </Link>

                <Link
                  to={ROUTES.QUIZ_HISTORY}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                    isDark ? 'text-dark-300 hover:text-white hover:bg-dark-800/70' : 'text-light-700 hover:text-light-900 hover:bg-light-100'
                  }`}
                >
                  <TrendingUp size={16} className="text-purple-400" />
                  <span>Performance History</span>
                </Link>

                <Link
                  to={ROUTES.SETTINGS}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                    isDark ? 'text-dark-300 hover:text-white hover:bg-dark-800/70' : 'text-light-700 hover:text-light-900 hover:bg-light-100'
                  }`}
                >
                  <Settings size={16} className="text-blue-400" />
                  <span>Preferences & Settings</span>
                </Link>

                {(user?.role === 'admin' || user?.id === 1 || user?.username === 'admin') && (
                  <Link
                    to={ROUTES.ADMIN}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                      isDark ? 'text-dark-300 hover:text-white hover:bg-dark-800/70' : 'text-light-700 hover:text-light-900 hover:bg-light-100'
                    }`}
                  >
                    <Settings size={16} className="text-emerald-400" />
                    <span>Admin Panel</span>
                  </Link>
                )}
              </div>

              {/* Sign out */}
              <div className={`border-t ${isDark ? 'border-dark-800' : 'border-light-200'} pt-1`}>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
};

export default Navbar;