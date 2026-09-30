import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Brain, FileText, Trophy, Swords,
  TrendingUp, Zap, Target, Clock,
  ChevronRight, Plus,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store.js';
import { gamificationAPI } from '../../api/gamification.api.js';
import { quizAPI } from '../../api/quiz.api.js';
import { ROUTES } from '../../constants/routes.js';
import Card from '../../components/common/Card.jsx';
import ProgressBar from '../../components/common/ProgressBar.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import { formatRelativeTime, formatScore } from '../../utils/formatters.js';
import { getLevelProgress, getRankMedal, normalizePath } from '../../utils/helpers.js';

/**
 * @page DashboardPage
 * @description Main dashboard with stats, recent activity, and quick actions.
 */
const DashboardPage = () => {
  const { user } = useAuthStore();
  const [profile,     setProfile]     = useState(null);
  const [recentQuizzes, setRecentQuizzes] = useState([]);
  const [isLoading,   setIsLoading]   = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, quizRes] = await Promise.all([
          gamificationAPI.getProfile(),
          quizAPI.getAll({ limit: 5, sortBy: 'createdAt', order: 'desc' }),
        ]);
        setProfile(profileRes.data.data.profile);
        setRecentQuizzes(quizRes.data.data.quizzes || []);
      } catch {
        // Silently handle
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="xl" />
      </div>
    );
  }

  const levelProgress = getLevelProgress(
    profile?.totalXP || 0,
    profile?.level   || 1
  );

  const quickStats = [
    {
      label:  'Total XP',
      value:  profile?.totalXP || 0,
      icon:   Zap,
      color:  'text-primary-400',
      bg:     'bg-primary-500/10',
    },
    {
      label:  'Quizzes Done',
      value:  profile?.totalQuizzes || 0,
      icon:   Brain,
      color:  'text-secondary-400',
      bg:     'bg-secondary-500/10',
    },
    {
      label:  'Win Streak',
      value:  `${profile?.winStreak || 0}🔥`,
      icon:   Trophy,
      color:  'text-accent-400',
      bg:     'bg-accent-500/10',
    },
    {
      label:  'Battles Won',
      value:  profile?.battlesWon || 0,
      icon:   Swords,
      color:  'text-battle-400',
      bg:     'bg-battle-500/10',
    },
  ];

  const quickActions = [
    {
      label:       'Upload PDF',
      description: 'Add new study material',
      icon:        FileText,
      path:        ROUTES.PDF_LIST,
      color:       'from-primary-600 to-primary-800',
      glow:        'glow',
    },
    {
      label:       'Generate Quiz',
      description: 'Create AI-powered quiz',
      icon:        Brain,
      path:        ROUTES.QUIZ_LIST,
      color:       'from-secondary-600 to-secondary-800',
      glow:        'green',
    },
    {
      label:       'Battle Mode',
      description: 'Compete with others',
      icon:        Swords,
      path:        ROUTES.BATTLE_LOBBY,
      color:       'from-battle-600 to-accent-600',
      glow:        'purple',
    },
  ];

  return (
    <div className="space-y-8">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y:  0  }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-dark-50">
            Welcome back, {user?.firstName}! 👋
          </h1>
          <p className="text-dark-400 mt-1">
            Ready to continue your learning journey?
          </p>
        </div>
        <Link to={ROUTES.PDF_LIST}>
          <button className="btn-primary gap-2 hidden sm:flex">
            <Plus size={18} />
            New Quiz
          </button>
        </Link>
      </motion.div>

      {/* ─── Level Progress Card ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y:  0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-gradient-to-r from-primary-900/40 to-dark-800/40
                         border-primary-500/20">
          <div className="flex items-center gap-4">
            {/* Level badge */}
            <div className="w-16 h-16 rounded-2xl bg-primary-600/20 border border-primary-500/30
                            flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-black text-primary-400">
                {profile?.level || 1}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-dark-200 font-medium">
                  Level {profile?.level || 1}
                </span>
                <span className="text-sm text-dark-400">
                  {profile?.totalXP || 0} / {(profile?.level || 1) * 1000} XP
                </span>
              </div>
              <ProgressBar
                value={levelProgress}
                max={100}
                color="xp"
                size="lg"
                animated
              />
              <p className="text-xs text-dark-400 mt-1">
                {Math.round(100 - levelProgress)}% to level {(profile?.level || 1) + 1}
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ─── Quick Stats ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y:  0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {quickStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} padding="md" hover>
              <div className={`w-10 h-10 ${stat.bg} rounded-xl
                              flex items-center justify-center mb-3`}>
                <Icon size={20} className={stat.color} />
              </div>
              <p className="text-2xl font-bold text-dark-50">{stat.value}</p>
              <p className="text-sm text-dark-400 mt-0.5">{stat.label}</p>
            </Card>
          );
        })}
      </motion.div>

      {/* ─── Quick Actions ────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y:  0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-lg font-semibold text-dark-100 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.label} to={action.path}>
                <Card
                  hover
                  glow
                  glowColor={action.glow}
                  className="group cursor-pointer"
                >
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${action.color}
                                  flex items-center justify-center mb-4
                                  group-hover:scale-110 transition-transform`}>
                    <Icon size={24} className="text-white" />
                  </div>
                  <h3 className="font-semibold text-dark-50 mb-1">
                    {action.label}
                  </h3>
                  <p className="text-sm text-dark-400">{action.description}</p>
                  <ChevronRight
                    size={16}
                    className="mt-3 text-dark-500 group-hover:text-dark-300
                               group-hover:translate-x-1 transition-all"
                  />
                </Card>
              </Link>
            );
          })}
        </div>
      </motion.div>

      {/* ─── Recent Quizzes ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y:  0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-dark-100">Recent Quizzes</h2>
          <Link
            to={ROUTES.QUIZ_LIST}
            className="text-sm text-primary-400 hover:text-primary-300 transition-colors
                       flex items-center gap-1"
          >
            View all <ChevronRight size={14} />
          </Link>
        </div>

        {recentQuizzes.length === 0 ? (
          <Card className="text-center py-12">
            <Brain size={48} className="text-dark-600 mx-auto mb-4" />
            <p className="text-dark-400">No quizzes yet.</p>
            <Link to={ROUTES.PDF_LIST} className="btn-primary mt-4 inline-flex">
              Upload your first PDF
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {recentQuizzes.map((quiz) => (
              <Link key={quiz._id} to={normalizePath(ROUTES.QUIZ_PLAY.replace(':id', quiz._id))}>
                <Card
                  hover
                  padding="sm"
                  className="flex items-center gap-4 group"
                >
                  <div className="w-10 h-10 bg-primary-500/10 rounded-xl
                                  flex items-center justify-center flex-shrink-0">
                    <Brain size={20} className="text-primary-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-dark-100 truncate">{quiz.title}</p>
                    <p className="text-xs text-dark-400 mt-0.5">
                      {quiz.totalQuestions} questions •{' '}
                      {formatRelativeTime(quiz.createdAt)}
                    </p>
                  </div>
                  <span className={`difficulty-pill text-xs ${
                    quiz.difficulty === 'easy'   ? 'badge-easy'   :
                    quiz.difficulty === 'medium' ? 'badge-medium' : 'badge-hard'
                  }`}>
                    {quiz.difficulty}
                  </span>
                  <ChevronRight
                    size={16}
                    className="text-dark-600 group-hover:text-dark-300 transition-colors"
                  />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default DashboardPage;