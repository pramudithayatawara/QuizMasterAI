import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, FileText, Brain, Swords,
  Trophy, User, ChevronRight, X,
} from 'lucide-react';
import { useUIStore } from '../../store/ui.store.js';
import { useTheme } from '../../hooks/useTheme.js';
import { ROUTES } from '../../constants/routes.js';
import { cn } from '../../utils/helpers.js';

/**
 * @component Sidebar
 * @description Navigation sidebar with active state indicators.
 */

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    icon:  LayoutDashboard,
    path:  ROUTES.DASHBOARD,
  },
  {
    label: 'My PDFs',
    icon:  FileText,
    path:  ROUTES.PDF_LIST,
  },
  {
    label: 'Quizzes',
    icon:  Brain,
    path:  ROUTES.QUIZ_LIST,
  },
  {
    label: 'Battle Mode',
    icon:  Swords,
    path:  ROUTES.BATTLE_LOBBY,
    badge: 'LIVE',
    badgeColor: 'bg-battle-500',
  },
  {
    label: 'Achievements',
    icon:  Trophy,
    path:  ROUTES.GAMIFICATION,
  },
  {
    label: 'Profile',
    icon:  User,
    path:  ROUTES.PROFILE,
  },
];

const NavItem = ({ item, isCollapsed, isDark }) => {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 px-3 py-2.5 rounded-xl',
          'transition-all duration-200 relative',
          isActive
            ? 'bg-primary-600/20 text-primary-400 font-semibold'
            : isDark 
              ? 'text-dark-400 hover:text-dark-100 hover:bg-dark-800/50'
              : 'text-light-600 hover:text-light-900 hover:bg-light-200'
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Active indicator */}
          {isActive && (
            <motion.div
              layoutId="activeNav"
              className="absolute left-0 top-1/2 -translate-y-1/2
                         w-1 h-6 bg-primary-500 rounded-r-full"
            />
          )}

          <Icon size={20} className="flex-shrink-0" />

          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{   opacity: 0, width: 0 }}
                className="text-sm whitespace-nowrap overflow-hidden"
              >
                {item.label}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Badge */}
          {item.badge && !isCollapsed && (
            <span className={cn(
              'ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white',
              item.badgeColor
            )}>
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
};

const Sidebar = () => {
  const { isSidebarOpen, setSidebar } = useUIStore();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setSidebar(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        animate={{ width: isSidebarOpen ? 240 : 72 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className={cn(
          'fixed lg:relative z-30 h-full',
          isDark ? 'bg-dark-900/90 backdrop-blur-md border-r border-dark-700/50' : 'bg-white/90 backdrop-blur-md border-r border-light-300',
          'flex flex-col overflow-hidden',
          'transition-all duration-300',
          // Mobile: slide in/out
          !isSidebarOpen && 'lg:flex -translate-x-full lg:translate-x-0'
        )}
        style={{ width: isSidebarOpen ? 240 : 72 }}
      >
        {/* Mobile close button */}
        <div className="lg:hidden flex justify-end p-3">
          <button
            onClick={() => setSidebar(false)}
            className={`p-2 rounded-lg ${isDark ? 'text-dark-400 hover:text-dark-100 hover:bg-dark-800' : 'text-light-600 hover:text-light-900 hover:bg-light-200'}
                       transition-colors`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.path}
              item={item}
              isCollapsed={!isSidebarOpen}
              isDark={isDark}
            />
          ))}
        </nav>

        {/* Collapse toggle (desktop) */}
        <div className={`hidden lg:flex p-3 ${isDark ? 'border-t border-dark-700/50' : 'border-t border-light-300'}`}>
          <button
            onClick={() => setSidebar(!isSidebarOpen)}
            className={`w-full flex items-center justify-center p-2
                       rounded-xl ${isDark ? 'text-dark-400 hover:text-dark-100 hover:bg-dark-800' : 'text-light-600 hover:text-light-900 hover:bg-light-200'}
                       transition-colors`}
          >
            <ChevronRight
              size={16}
              className={cn(
                'transition-transform duration-300',
                isSidebarOpen && 'rotate-180'
              )}
            />
          </button>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;