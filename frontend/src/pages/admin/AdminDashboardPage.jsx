import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, FileText, Brain, Swords, TrendingUp, Activity } from 'lucide-react';
import { adminAPI } from '../../api/admin.api.js';
import Card from '../../components/common/Card.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import { formatNumber, formatRelativeTime } from '../../utils/formatters.js';
import { cn } from '../../utils/helpers.js';
import toast from 'react-hot-toast';

/**
 * @page AdminDashboardPage
 * @description Admin overview with system statistics.
 */
const AdminDashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await adminAPI.getDashboard();
        setStats(response.data.data.stats);
        setRecentUsers(response.data.data.recentUsers || []);
      } catch (error) {
        toast.error('Failed to load dashboard data.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="xl" />
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Users',
      value: formatNumber(stats?.totalUsers || 0),
      change: `+${stats?.todayUsers || 0} today`,
      icon: Users,
      color: 'text-primary-400',
      bg: 'bg-primary-500/10',
    },
    {
      label: 'Total PDFs',
      value: formatNumber(stats?.totalPDFs || 0),
      icon: FileText,
      color: 'text-secondary-400',
      bg: 'bg-secondary-500/10',
    },
    {
      label: 'Total Quizzes',
      value: formatNumber(stats?.totalQuizzes || 0),
      change: `+${stats?.todayQuizzes || 0} today`,
      icon: Brain,
      color: 'text-accent-400',
      bg: 'bg-accent-500/10',
    },
    {
      label: 'Battles Completed',
      value: formatNumber(stats?.totalBattles || 0),
      icon: Swords,
      color: 'text-battle-400',
      bg: 'bg-battle-500/10',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-dark-50">Admin Dashboard</h1>
        <p className="text-dark-400 mt-1">System overview and statistics</p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
            >
              <Card padding="md" hover>
                <div className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center mb-3',
                  stat.bg
                )}>
                  <Icon size={24} className={stat.color} />
                </div>
                <p className="text-2xl font-bold text-dark-50 mb-1">
                  {stat.value}
                </p>
                <p className="text-sm text-dark-400">{stat.label}</p>
                {stat.change && (
                  <p className="text-xs text-secondary-400 mt-2 flex items-center gap-1">
                    <TrendingUp size={12} />
                    {stat.change}
                  </p>
                )}
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Recent Users */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-dark-50">Recent Users</h2>
            <Activity size={20} className="text-dark-500" />
          </div>
          <div className="space-y-3">
            {recentUsers.map((user, index) => (
              <motion.div
                key={user._id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                className="flex items-center justify-between p-3 bg-dark-800/50 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-500/10 rounded-full
                                  flex items-center justify-center">
                    <Users size={18} className="text-primary-400" />
                  </div>
                  <div>
                    <p className="font-medium text-dark-100">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-dark-400">{user.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn(
                    'text-xs px-2 py-1 rounded-full font-medium',
                    user.role === 'admin'
                      ? 'bg-accent-500/20 text-accent-400'
                      : 'bg-dark-700 text-dark-400'
                  )}>
                    {user.role}
                  </span>
                  <p className="text-xs text-dark-500 mt-1">
                    {formatRelativeTime(user.createdAt)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default AdminDashboardPage;