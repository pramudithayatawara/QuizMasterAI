import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Brain, Bell, Menu, LogOut, User, Settings,
  Swords, ChevronDown, TrendingUp,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store.js';
import { useUIStore } from '../../store/ui.store.js';
import { useTheme } from '../../hooks/useTheme.js';
import { ROUTES } from '../../constants/routes.js';
import { formatNumber } from '../../utils/formatters.js';
import Avatar from '../common/Avatar.jsx';
import NotificationDropdown from './NotificationDropdown.jsx';

/**
 * @component Navbar
 * @description Top navigation bar with user menu.
 */
const Navbar = () => {
  const { user, logout }    = useAuthStore();
  const { toggleSidebar }   = useUIStore();
  const { theme }           = useTheme();
  const navigate            = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  const isDark = theme === 'dark';

  return (
    <nav className={`h-16 ${isDark ? 'bg-dark-900/80' : 'bg-white/80'} backdrop-blur-md ${isDark ? 'border-dark-700/50' : 'border-light-300'} border-b
                    flex items-center px-4 lg:px-6 gap-4 sticky top-0 z-30`}>
      {/* Sidebar Toggle */}
      <button
        onClick={toggleSidebar}
        className={`p-2 rounded-xl ${isDark ? 'text-dark-400 hover:text-dark-100 hover:bg-dark-800' : 'text-light-600 hover:text-light-900 hover:bg-light-200'}
                   transition-colors lg:hidden`}
      >
        <Menu size={20} />
      </button>

      {/* Logo */}
      <Link to={ROUTES.DASHBOARD} className="flex items-center gap-2.5 mr-auto">
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
          <Brain size={16} className="text-white" />
        </div>
        <span className={`font-bold ${isDark ? 'text-dark-50' : 'text-light-900'} text-lg hidden sm:block`}>QuizAI</span>
      </Link>

      {/* Battle CTA */}
      <Link
        to={ROUTES.BATTLE_LOBBY}
        className="hidden md:flex items-center gap-2 px-4 py-2
                   bg-gradient-to-r from-battle-600/20 to-accent-600/20
                   border border-battle-500/30 rounded-xl
                   text-battle-400 hover:text-battle-300
                   transition-all duration-200 text-sm font-medium"
      >
        <Swords size={16} />
        Battle Mode
      </Link>

      {/* Module 05: Adaptive Analytics Link */}
      <Link
        to={ROUTES.QUIZ_HISTORY}
        className="hidden md:flex items-center gap-2 px-4 py-2
                   bg-gradient-to-r from-purple-600/20 to-indigo-600/20
                   border border-purple-500/30 rounded-xl
                   text-purple-400 hover:text-purple-300
                   transition-all duration-200 text-sm font-medium"
      >
        <TrendingUp size={16} />
        Performance
      </Link>

      {/* User XP */}
      {user && (
        <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5
                        ${isDark ? 'bg-dark-800 border-dark-700' : 'bg-light-100 border-light-200'} rounded-xl border`}>
          <span className={`text-xs ${isDark ? 'text-dark-400' : 'text-light-600'}`}>Level</span>
          <span className="text-sm font-bold text-primary-400">
            {user.level || 1}
          </span>
        </div>
      )}

      {/* Notifications */}
      <NotificationDropdown />

      {/* Settings */}
      <Link
        to={ROUTES.SETTINGS}
        className={`p-2 rounded-xl ${isDark ? 'text-dark-400 hover:text-dark-100 hover:bg-dark-800' : 'text-light-600 hover:text-light-900 hover:bg-light-200'}
                   transition-colors`}
      >
        <Settings size={20} />
      </Link>

      {/* User Menu */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={`flex items-center gap-2 p-1.5 rounded-xl
                     ${isDark ? 'hover:bg-dark-800' : 'hover:bg-light-200'} transition-colors`}
        >
          <Avatar
            name={`${user?.firstName} ${user?.lastName}`}
            size="sm"
          />
          <ChevronDown
            size={14}
            className={`${isDark ? 'text-dark-400' : 'text-light-600'} transition-transform ${menuOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1   }}
              className={`absolute right-0 top-full mt-2 w-56 z-50
                         ${isDark ? 'glass-card' : 'bg-white border-light-300'} shadow-2xl py-2`}
            >
              {/* User info */}
              <div className={`px-4 py-3 border-b ${isDark ? 'border-dark-700' : 'border-light-200'}`}>
                <p className={`font-semibold ${isDark ? 'text-dark-50' : 'text-light-900'} text-sm`}>
                  {user?.firstName} {user?.lastName}
                </p>
                <p className={`text-xs ${isDark ? 'text-dark-400' : 'text-light-600'}`}>{user?.email}</p>
              </div>

              {/* Menu items */}
              <Link
                to={ROUTES.PROFILE}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm
                           ${isDark ? 'text-dark-300 hover:text-dark-100 hover:bg-dark-700/50' : 'text-light-700 hover:text-light-900 hover:bg-light-100'}
                           transition-colors`}
              >
                <User size={16} /> Profile
              </Link>

              {user?.role === 'admin' && (
                <Link
                  to={ROUTES.ADMIN}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm
                             ${isDark ? 'text-dark-300 hover:text-dark-100 hover:bg-dark-700/50' : 'text-light-700 hover:text-light-900 hover:bg-light-100'}
                             transition-colors`}
                >
                  <Settings size={16} /> Admin Panel
                </Link>
              )}

              <div className={`border-t ${isDark ? 'border-dark-700' : 'border-light-200'} mt-2 pt-2`}>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm
                             text-red-400 hover:text-red-300 hover:bg-red-500/10
                             transition-colors"
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;