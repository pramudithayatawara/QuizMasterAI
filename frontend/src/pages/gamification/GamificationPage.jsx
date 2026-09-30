import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Award, TrendingUp, Zap, Target,
  Crown, Medal, Star, Lock, CheckCircle,
} from 'lucide-react';
import { gamificationAPI } from '../../api/gamification.api.js';
import { useAuthStore } from '../../store/auth.store.js';
import Card from '../../components/common/Card.jsx';
import ProgressBar from '../../components/common/ProgressBar.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import { formatNumber, getOrdinal } from '../../utils/formatters.js';
import { getLevelProgress, getRankMedal, cn } from '../../utils/helpers.js';
import toast from 'react-hot-toast';

/**
 * @page GamificationPage
 * @description Achievements, badges, and leaderboard.
 */
const GamificationPage = () => {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [badges, setBadges] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview | badges | leaderboard

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [profileRes, badgesRes, leaderboardRes] = await Promise.all([
          gamificationAPI.getProfile(),
          gamificationAPI.getBadges(),
          gamificationAPI.getLeaderboard({ limit: 100 }),
        ]);
        setProfile(profileRes.data?.data?.profile || profileRes.data?.profile || profileRes.data);
        setBadges(badgesRes.data?.data?.badges || badgesRes.data?.badges || (Array.isArray(badgesRes.data) ? badgesRes.data : []));
        setLeaderboard(leaderboardRes.data?.data?.leaderboard || leaderboardRes.data?.leaderboard || (Array.isArray(leaderboardRes.data) ? leaderboardRes.data : []));
      } catch (error) {
        toast.error('Failed to load gamification data.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="xl" />
      </div>
    );
  }

  const levelProgress = getLevelProgress(profile?.totalXP || 0, profile?.level || 1);

  const stats = [
    {
      label: 'Total XP',
      value: formatNumber(profile?.totalXP || 0),
      icon: Zap,
      color: 'text-primary-400',
      bg: 'bg-primary-500/10',
    },
    {
      label: 'Current Level',
      value: profile?.level || 1,
      icon: TrendingUp,
      color: 'text-secondary-400',
      bg: 'bg-secondary-500/10',
    },
    {
      label: 'Badges Earned',
      value: badges.filter((b) => b.unlocked).length,
      icon: Award,
      color: 'text-accent-400',
      bg: 'bg-accent-500/10',
    },
    {
      label: 'Win Streak',
      value: `${profile?.winStreak || 0}🔥`,
      icon: Target,
      color: 'text-battle-400',
      bg: 'bg-battle-500/10',
    },
  ];

  return (
    <div className="space-y-8">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-3"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-secondary-600
                          flex items-center justify-center shadow-glow">
            <Trophy size={32} className="text-white" />
          </div>
        </div>
        <h1 className="text-4xl font-bold gradient-text">Achievements</h1>
        <p className="text-dark-400 max-w-md mx-auto">
          Track your progress, earn badges, and compete on the leaderboard
        </p>
      </motion.div>

      {/* ─── Level Progress ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-gradient-to-r from-primary-900/40 to-secondary-900/40
                         border-primary-500/20">
          <div className="flex items-center gap-6">
            <Avatar
              name={
                (user?.firstName || user?.lastName)
                  ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
                  : (user?.username || 'Player')
              }
              size="2xl"
              ring
              ringColor="primary"
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-dark-50 mb-1">
                Level {profile?.level || 1}
              </h2>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm text-dark-400">
                  {profile?.totalXP || 0} / {(profile?.level || 1) * 1000} XP
                </span>
                <span className="text-sm text-primary-400 font-medium">
                  {Math.round(100 - levelProgress)}% to next level
                </span>
              </div>
              <ProgressBar
                value={levelProgress}
                max={100}
                color="xp"
                size="lg"
                animated
              />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ─── Stats Grid ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} padding="md" hover className="text-center">
              <div className={cn(
                'w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3',
                stat.bg
              )}>
                <Icon size={24} className={stat.color} />
              </div>
              <p className={cn('text-2xl font-bold', stat.color)}>
                {stat.value}
              </p>
              <p className="text-sm text-dark-400 mt-1">{stat.label}</p>
            </Card>
          );
        })}
      </motion.div>

      {/* ─── Tabs ────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card padding="none">
          <div className="flex border-b border-dark-700">
            {[
              { id: 'overview',    label: 'Overview',    icon: TrendingUp },
              { id: 'badges',      label: 'Badges',      icon: Award },
              { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-6 py-4',
                    'font-medium transition-colors relative',
                    activeTab === tab.id
                      ? 'text-primary-400'
                      : 'text-dark-400 hover:text-dark-200'
                  )}
                >
                  <Icon size={18} />
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-dark-50 mb-4">
                      Recent Achievements
                    </h3>
                    <div className="space-y-3">
                      {badges
                        .filter((b) => b.unlocked)
                        .slice(0, 5)
                        .map((badge) => (
                          <div
                            key={badge.id}
                            className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-xl"
                          >
                            <span className="text-2xl">{badge.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-dark-100">{badge.name}</p>
                              <p className="text-xs text-dark-400">{badge.description}</p>
                            </div>
                            <CheckCircle size={16} className="text-secondary-400" />
                          </div>
                        ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-dark-50 mb-4">
                      Performance Stats
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-dark-400">Quiz Streak</span>
                          <span className="text-dark-200 font-medium">
                            {profile?.quizStreak || 0} days
                          </span>
                        </div>
                        <ProgressBar
                          value={(profile?.quizStreak || 0) * 10}
                          max={100}
                          color="primary"
                          size="sm"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-dark-400">Battles Won</span>
                          <span className="text-dark-200 font-medium">
                            {profile?.battlesWon || 0}
                          </span>
                        </div>
                        <ProgressBar
                          value={(profile?.battlesWon || 0) * 5}
                          max={100}
                          color="battle"
                          size="sm"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-dark-400">Total Quizzes</span>
                          <span className="text-dark-200 font-medium">
                            {profile?.totalQuizzes || 0}
                          </span>
                        </div>
                        <ProgressBar
                          value={(profile?.totalQuizzes || 0) * 2}
                          max={100}
                          color="green"
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Badges Tab */}
            {activeTab === 'badges' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {badges.map((badge) => (
                  <Card
                    key={badge.id}
                    padding="md"
                    className={cn(
                      'text-center transition-all',
                      badge.unlocked
                        ? 'hover:scale-105'
                        : 'opacity-50 grayscale'
                    )}
                  >
                    <div className={cn(
                      'text-5xl mb-3',
                      !badge.unlocked && 'filter blur-sm'
                    )}>
                      {badge.unlocked ? badge.icon : <Lock size={32} className="mx-auto text-dark-600" />}
                    </div>
                    <h3 className="font-semibold text-dark-100 mb-1">
                      {badge.name}
                    </h3>
                    <p className="text-xs text-dark-400 mb-2">
                      {badge.description}
                    </p>
                    {badge.unlocked ? (
                      <span className="text-xs text-secondary-400 font-medium">
                        ✓ Unlocked
                      </span>
                    ) : (
                      <span className="text-xs text-dark-500">
                        🔒 Locked
                      </span>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {/* Leaderboard Tab */}
            {activeTab === 'leaderboard' && (
              <div className="space-y-2">
                {leaderboard.map((entry, index) => {
                  const isCurrentUser = entry.userId === user?._id;
                  const isTopThree = index < 3;

                  return (
                    <motion.div
                      key={entry._id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={cn(
                        'flex items-center gap-4 p-4 rounded-xl transition-all',
                        isCurrentUser
                          ? 'bg-primary-500/10 border-2 border-primary-500/30'
                          : 'bg-dark-800/50 border border-dark-700 hover:bg-dark-800'
                      )}
                    >
                      {/* Rank */}
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        'font-bold text-lg flex-shrink-0',
                        isTopThree
                          ? 'bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-glow-orange'
                          : 'bg-dark-700 text-dark-400'
                      )}>
                        {getRankMedal(entry.rank)}
                      </div>

                      {/* Avatar & Name */}
                      <Avatar
                        name={entry.userName}
                        size="md"
                        ring={isTopThree}
                        ringColor={isTopThree ? 'green' : undefined}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'font-semibold truncate',
                          isCurrentUser ? 'text-primary-400' : 'text-dark-100'
                        )}>
                          {entry.userName}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-primary-500">(You)</span>
                          )}
                        </p>
                        <p className="text-xs text-dark-400">
                          Level {entry.level}
                        </p>
                      </div>

                      {/* Points */}
                      <div className="text-right">
                        <p className="font-bold text-dark-50">
                          {formatNumber(entry.totalPoints)}
                        </p>
                        <p className="text-xs text-dark-400">points</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default GamificationPage;