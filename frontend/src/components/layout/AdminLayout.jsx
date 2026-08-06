import React from 'react';
import { Outlet, Link, NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Swords,
  Brain, Settings, ArrowLeft,
} from 'lucide-react';
import { ROUTES } from '../../constants/routes.js';
import { cn } from '../../utils/helpers.js';
import Navbar from './Navbar.jsx';

const ADMIN_NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, path: ROUTES.ADMIN },
  { label: 'Users',     icon: Users,           path: ROUTES.ADMIN_USERS },
  { label: 'Battles',   icon: Swords,          path: ROUTES.ADMIN_BATTLES },
];

/**
 * @component AdminLayout
 * @description Admin panel layout with admin-specific sidebar.
 */
const AdminLayout = () => {
  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        {/* Admin Sidebar */}
        <aside className="w-60 bg-dark-900 border-r border-dark-700/50
                          flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-dark-700/50">
            <div className="flex items-center gap-2">
              <Settings size={18} className="text-primary-400" />
              <span className="font-bold text-dark-100">Admin Panel</span>
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-1">
            {ADMIN_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors',
                      isActive
                        ? 'bg-primary-600/20 text-primary-400 font-medium'
                        : 'text-dark-400 hover:text-dark-100 hover:bg-dark-800'
                    )
                  }
                >
                  <Icon size={18} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="p-3 border-t border-dark-700/50">
            <Link
              to={ROUTES.DASHBOARD}
              className="flex items-center gap-2 text-sm text-dark-400
                         hover:text-dark-100 transition-colors px-3 py-2"
            >
              <ArrowLeft size={16} />
              Back to App
            </Link>
          </div>
        </aside>

        {/* Admin Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;