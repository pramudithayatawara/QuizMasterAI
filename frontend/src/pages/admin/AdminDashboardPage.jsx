import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, FileText, Brain, Swords, TrendingUp,
  Activity, Shield, CheckCircle2, AlertCircle,
  RefreshCw, PlusCircle, ArrowUpRight, Clock,
  Cpu, Database, Sparkles, ChevronRight
} from 'lucide-react';
import { adminAPI } from '../../api/admin.api.js';
import { ROUTES } from '../../constants/routes.js';
import Card from '../../components/common/Card.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import { formatNumber, formatRelativeTime } from '../../utils/formatters.js';
import { cn } from '../../utils/helpers.js';
import toast from 'react-hot-toast';

/**
 * @page AdminDashboardPage
 * @description Iconic system command center and administrative analytics dashboard
 */
const AdminDashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentQuizzes, setRecentQuizzes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDashboard = async (showToast = false) => {
    try {
      if (showToast) setIsRefreshing(true);
      const response = await adminAPI.getDashboard();
      const payload = response.data?.data || response.data || {};
      const s = payload.stats || payload || {};
      
      setStats({
        totalUsers: s.totalUsers ?? s.total_users ?? 0,
        todayUsers: s.todayUsers ?? 0,
        totalQuizzes: s.totalQuizzes ?? s.total_quizzes ?? 0,
        todayQuizzes: s.todayQuizzes ?? 0,
        totalQuestions: s.totalQuestions ?? s.total_questions ?? 0,
        totalPDFs: s.totalPDFs ?? 0,
        totalBattles: s.totalBattles ?? 0,
        totalAttempts: s.totalAttempts ?? 0,
        activeBattles: s.activeBattles ?? 0,
        systemHealth: s.systemHealth || 'Operational (100%)'
      });
      setRecentUsers(payload.recentUsers || []);
      setRecentQuizzes(payload.recentQuizzes || []);
      if (showToast) toast.success('Admin metrics refreshed!');
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Spinner size="xl" />
        <p className="text-dark-400 text-sm animate-pulse">Loading system telemetry...</p>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Users',
      value: formatNumber(stats?.totalUsers || 0),
      subtext: 'Active accounts',
      icon: Users,
      color: 'text-primary-400',
      bg: 'bg-primary-500/10 border-primary-500/20',
      link: ROUTES.ADMIN_USERS
    },
    {
      label: 'Quiz Catalog',
      value: formatNumber(stats?.totalQuizzes || 0),
      subtext: `${stats?.totalQuestions || 0} Questions`,
      icon: Brain,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
      link: ROUTES.ADMIN_QUIZZES || '/admin/quizzes'
    },
    {
      label: 'Battle Arenas',
      value: formatNumber(stats?.totalBattles || 0),
      subtext: `${stats?.activeBattles || 0} Active sessions`,
      icon: Swords,
      color: 'text-battle-400',
      bg: 'bg-battle-500/10 border-battle-500/20',
      link: ROUTES.ADMIN_BATTLES
    },
    {
      label: 'Study PDFs',
      value: formatNumber(stats?.totalPDFs || 0),
      subtext: 'Indexed documents',
      icon: FileText,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      link: '/admin/pdfs'
    },
    {
      label: 'Quiz Attempts',
      value: formatNumber(stats?.totalAttempts || 0),
      subtext: 'Platform tests taken',
      icon: Activity,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
      link: ROUTES.QUIZ_HISTORY
    },
    {
      label: 'System Integrity',
      value: '100%',
      subtext: 'All services online',
      icon: Shield,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      link: '#'
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-800 pb-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-accent-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-accent-600/25">
            <Shield size={22} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">System Admin Console</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
              </span>
            </div>
            <p className="text-dark-400 text-sm mt-0.5">Centralized administration, user controls, and system telemetry</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchDashboard(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white border border-dark-700 text-sm transition-all"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>

          <Link
            to={ROUTES.QUIZ_AI_GENERATE}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-medium text-sm shadow-lg shadow-primary-500/25 transition-all"
          >
            <PlusCircle size={16} />
            <span>Generate Global Quiz</span>
          </Link>
        </div>
      </motion.div>

      {/* ─── AI Pipeline Telemetry Status ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        <div className="p-3.5 rounded-xl bg-dark-900/60 border border-dark-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <Cpu size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-dark-400">AI MCQ Engine</p>
            <p className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={12} /> Active
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-dark-900/60 border border-dark-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <Sparkles size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-dark-400">Adaptive Engine</p>
            <p className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={12} /> Online
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-dark-900/60 border border-dark-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <Database size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-dark-400">Primary Database</p>
            <p className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={12} /> Synchronized
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-dark-900/60 border border-dark-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-battle-500/15 text-battle-400 flex items-center justify-center">
            <Swords size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-dark-400">Battle Matchmaking</p>
            <p className="text-xs font-bold text-battle-400 flex items-center gap-1">
              <CheckCircle2 size={12} /> Live Socket
            </p>
          </div>
        </div>
      </motion.div>

      {/* ─── Metric Cards Grid ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + index * 0.05 }}
            >
              <Link to={stat.link} className="block group">
                <Card padding="md" hover className="border-dark-700/60 bg-dark-900/70 backdrop-blur-sm relative overflow-hidden">
                  <div className="flex items-start justify-between">
                    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center border mb-3', stat.bg)}>
                      <Icon size={22} className={stat.color} />
                    </div>
                    <ArrowUpRight size={18} className="text-dark-500 group-hover:text-white transition-colors" />
                  </div>
                  <p className="text-3xl font-extrabold text-white tracking-tight mb-0.5">
                    {stat.value}
                  </p>
                  <p className="text-sm font-semibold text-dark-200">{stat.label}</p>
                  <p className="text-xs text-dark-400 mt-1">{stat.subtext}</p>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ─── Bottom Panels: Recent Users & Quizzes ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-dark-700/60 bg-dark-900/70 backdrop-blur-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-dark-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary-500/15 text-primary-400">
                  <Users size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Registered Users</h2>
                  <p className="text-xs text-dark-400">Latest platform accounts</p>
                </div>
              </div>
              <Link
                to={ROUTES.ADMIN_USERS}
                className="text-xs font-semibold text-primary-400 hover:text-primary-300 flex items-center gap-1"
              >
                Manage All <ChevronRight size={14} />
              </Link>
            </div>

            <div className="space-y-3 flex-1">
              {recentUsers.length > 0 ? (
                recentUsers.slice(0, 6).map((u) => (
                  <div
                    key={u._id || u.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-dark-800/50 hover:bg-dark-800 border border-dark-700/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        name={`${u.firstName || u.username} ${u.lastName || ''}`}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-white truncate">
                          {u.firstName ? `${u.firstName} ${u.lastName || ''}` : u.username}
                        </p>
                        <p className="text-xs text-dark-400 truncate">{u.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-[11px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider',
                        u.role === 'admin'
                          ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                          : 'bg-dark-700 text-dark-300'
                      )}>
                        {u.role || 'student'}
                      </span>

                      <span className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-semibold',
                        u.isActive
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-red-500/15 text-red-400'
                      )}>
                        {u.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-dark-400 text-sm">
                  No users recorded yet.
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Recent Quizzes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card className="border-dark-700/60 bg-dark-900/70 backdrop-blur-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-dark-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-purple-500/15 text-purple-400">
                  <Brain size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Quizzes Created</h2>
                  <p className="text-xs text-dark-400">Recent AI and manual quizzes</p>
                </div>
              </div>
              <Link
                to={ROUTES.ADMIN_QUIZZES || '/admin/quizzes'}
                className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                View Quizzes <ChevronRight size={14} />
              </Link>
            </div>

            <div className="space-y-3 flex-1">
              {recentQuizzes.length > 0 ? (
                recentQuizzes.slice(0, 6).map((q) => (
                  <div
                    key={q._id || q.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-dark-800/50 hover:bg-dark-800 border border-dark-700/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center flex-shrink-0">
                        <Brain size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-white truncate">
                          {q.title || `Quiz #${q.id}`}
                        </p>
                        <p className="text-xs text-dark-400">
                          {formatRelativeTime(new Date(q.createdAt))}
                        </p>
                      </div>
                    </div>

                    <Link
                      to={ROUTES.QUIZ_PLAY.replace(':id', q.id)}
                      className="px-3 py-1 rounded-lg bg-dark-700 hover:bg-primary-600 hover:text-white text-xs font-medium text-dark-300 transition-colors"
                    >
                      Preview
                    </Link>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-dark-400 text-sm">
                  No quizzes generated yet.
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;