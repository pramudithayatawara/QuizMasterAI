import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Award, TrendingUp, Zap, Target,
  Crown, Medal, Star, Lock, CheckCircle, Flame,
  Swords, BookOpen, Shield, Sparkles, Check, ArrowRight,
  Filter, Users, Compass, Eye
} from 'lucide-react';
import { gamificationAPI } from '../../api/gamification.api.js';
import { useAuthStore } from '../../store/auth.store.js';
import Card from '../../components/common/Card.jsx';
import ProgressBar from '../../components/common/ProgressBar.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import { formatNumber } from '../../utils/formatters.js';
import { getLevelDetails, getRankMedal, cn } from '../../utils/helpers.js';
import toast from 'react-hot-toast';

// ─── Default Badges Catalog Fallback with Gamified Rarity ─────────────────────
const DEFAULT_BADGES = [
  { id: 'badge_first_step', name: 'First Step', description: 'Completed your first quiz successfully', icon: '🎯', category: 'Quiz', requirement: 'Complete 1 quiz', rarity: 'NOVICE' },
  { id: 'badge_quiz_scholar', name: 'Quiz Scholar', description: 'Completed 5 quizzes on the platform', icon: '📚', category: 'Quiz', requirement: 'Complete 5 quizzes', rarity: 'SCHOLAR' },
  { id: 'badge_quiz_master', name: 'Quiz Master', description: 'Completed 10 or more quizzes with high accuracy', icon: '🎓', category: 'Quiz', requirement: 'Complete 10 quizzes', rarity: 'MYTHIC' },
  { id: 'badge_perfect_100', name: 'Perfectionist', description: 'Scored 100% on any quiz', icon: '💯', category: 'Skill', requirement: 'Score 100% in a quiz', rarity: 'ELITE' },
  { id: 'badge_speed_demon', name: 'Speed Demon', description: 'Completed a quiz in record time', icon: '⚡', category: 'Speed', requirement: 'Complete under 60 seconds', rarity: 'SPEED' },
  { id: 'badge_first_battle', name: 'Gladiator', description: 'Joined and participated in your first live battle session', icon: '⚔️', category: 'Battle', requirement: 'Join 1 live battle', rarity: 'SPECIAL' },
  { id: 'badge_battle_victor', name: 'Battle Victor', description: 'Won your first competitive battle session', icon: '🏆', category: 'Battle', requirement: 'Win 1 battle match', rarity: 'RARE' },
  { id: 'badge_win_streak', name: 'On Fire', description: 'Maintained a win streak of 3 consecutive battles', icon: '🔥', category: 'Battle', requirement: 'Achieve 3 battle win streak', rarity: 'EPIC' },
  { id: 'badge_conqueror', name: 'Grand Champion', description: 'Won 5 or more multiplayer battles', icon: '👑', category: 'Battle', requirement: 'Win 5 multiplayer battles', rarity: 'LEGENDARY' },
];

const RARITY_THEMES = {
  LEGENDARY: { label: 'LEGENDARY', border: 'border-amber-400/80', bg: 'bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-slate-900', glow: 'shadow-amber-500/15 shadow-lg', tag: 'bg-amber-500/25 text-amber-300 border-amber-400/50' },
  EPIC:      { label: 'EPIC', border: 'border-rose-400/80', bg: 'bg-gradient-to-br from-rose-500/20 via-pink-500/10 to-slate-900', glow: 'shadow-rose-500/15 shadow-lg', tag: 'bg-rose-500/25 text-rose-300 border-rose-400/50' },
  RARE:      { label: 'RARE', border: 'border-yellow-400/70', bg: 'bg-gradient-to-br from-yellow-500/20 via-amber-500/10 to-slate-900', glow: 'shadow-yellow-500/15 shadow-lg', tag: 'bg-yellow-500/25 text-yellow-300 border-yellow-400/50' },
  MYTHIC:    { label: 'MYTHIC', border: 'border-cyan-400/70', bg: 'bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-slate-900', glow: 'shadow-cyan-500/15 shadow-lg', tag: 'bg-cyan-500/25 text-cyan-300 border-cyan-400/50' },
  ELITE:     { label: 'ELITE', border: 'border-emerald-400/70', bg: 'bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-slate-900', glow: 'shadow-emerald-500/15 shadow-lg', tag: 'bg-emerald-500/25 text-emerald-300 border-emerald-400/50' },
  SPECIAL:   { label: 'SPECIAL', border: 'border-indigo-400/70', bg: 'bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-slate-900', glow: 'shadow-indigo-500/15 shadow-lg', tag: 'bg-indigo-500/25 text-indigo-300 border-indigo-400/50' },
  SPEED:     { label: 'SPEED', border: 'border-orange-400/70', bg: 'bg-gradient-to-br from-orange-500/20 via-amber-500/10 to-slate-900', glow: 'shadow-orange-500/15 shadow-lg', tag: 'bg-orange-500/25 text-orange-300 border-orange-400/50' },
  SCHOLAR:   { label: 'SCHOLAR', border: 'border-blue-400/70', bg: 'bg-gradient-to-br from-blue-500/20 via-indigo-500/10 to-slate-900', glow: 'shadow-blue-500/15 shadow-lg', tag: 'bg-blue-500/25 text-blue-300 border-blue-400/50' },
  NOVICE:    { label: 'NOVICE', border: 'border-slate-600/40', bg: 'bg-slate-900/60', glow: 'shadow-sm', tag: 'bg-slate-800 text-slate-400 border-slate-700' },
};

/**
 * @page GamificationPage
 * @description Modern, gamified achievements showcase, leveling milestones, and global leaderboard.
 */
const GamificationPage = () => {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [badges, setBadges] = useState(DEFAULT_BADGES);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('badges'); // 'badges' | 'overview' | 'leaderboard'
  const [badgeFilter, setBadgeFilter] = useState('all'); // 'all' | 'unlocked' | 'locked' | 'battle' | 'quiz'

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [profileRes, badgesRes, leaderboardRes] = await Promise.all([
          gamificationAPI.getProfile(),
          gamificationAPI.getBadges(),
          gamificationAPI.getLeaderboard({ limit: 100 }),
        ]);

        const prof = profileRes.data?.data?.profile || profileRes.data?.profile || profileRes.data;
        const bdgs = badgesRes.data?.data?.badges || badgesRes.data?.badges || (Array.isArray(badgesRes.data) ? badgesRes.data : []);
        const lb = leaderboardRes.data?.data?.leaderboard || leaderboardRes.data?.leaderboard || (Array.isArray(leaderboardRes.data) ? leaderboardRes.data : []);

        setProfile(prof);

        if (Array.isArray(bdgs) && bdgs.length > 0) {
          const merged = bdgs.map((b) => {
            const def = DEFAULT_BADGES.find((d) => d.id === b.id);
            return {
              ...def,
              ...b,
              unlocked: Boolean(b.unlocked || b.is_unlocked),
              rarity: def?.rarity || 'RARE',
            };
          });
          setBadges(merged);
        } else {
          setBadges(DEFAULT_BADGES);
        }

        setLeaderboard(Array.isArray(lb) ? lb : []);
      } catch (error) {
        console.error('Gamification fetch error:', error);
        toast.error('Failed to load gamification data.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Total XP & Progressive Level breakdown
  const totalXP = profile?.totalXP || user?.total_points || 0;
  const levelInfo = useMemo(() => getLevelDetails(totalXP), [totalXP]);
  const currentLevel = profile?.level || levelInfo.level;
  const userRank = profile?.rank || 2;

  // Badge count metrics
  const unlockedBadges = useMemo(() => badges.filter((b) => b.unlocked), [badges]);
  const unlockedCount = unlockedBadges.length;
  const badgeCompletionPercent = Math.round((unlockedCount / Math.max(1, badges.length)) * 100);

  // Filtered badges
  const filteredBadges = useMemo(() => {
    return badges.filter((b) => {
      if (badgeFilter === 'unlocked') return b.unlocked;
      if (badgeFilter === 'locked') return !b.unlocked;
      if (badgeFilter === 'battle') return b.category?.toLowerCase() === 'battle';
      if (badgeFilter === 'quiz') return b.category?.toLowerCase() !== 'battle';
      return true;
    });
  }, [badges, badgeFilter]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Spinner size="xl" />
        <p className="text-xs text-slate-400 font-semibold tracking-wide">Loading Scholar Arena...</p>
      </div>
    );
  }

  // 4 Radiant Metric Stats
  const statCards = [
    {
      label: 'Total Knowledge XP',
      value: totalXP.toLocaleString(),
      subtext: `${levelInfo.progressPercent}% to Level ${currentLevel + 1}`,
      icon: Zap,
      textColor: 'text-indigo-400',
      bgColor: 'bg-indigo-500/15',
      borderColor: 'border-indigo-500/30',
    },
    {
      label: 'Global Rank',
      value: `#${userRank}`,
      subtext: 'Global Scholar Arena',
      icon: Crown,
      textColor: 'text-amber-400',
      bgColor: 'bg-amber-500/15',
      borderColor: 'border-amber-500/30',
    },
    {
      label: 'Trophies Earned',
      value: `${unlockedCount} / ${badges.length}`,
      subtext: `${badgeCompletionPercent}% Honor Completed`,
      icon: Award,
      textColor: 'text-cyan-400',
      bgColor: 'bg-cyan-500/15',
      borderColor: 'border-cyan-500/30',
    },
    {
      label: 'Battle Win Streak',
      value: `${profile?.winStreak || 0}🔥`,
      subtext: profile?.winStreak > 0 ? 'On fire in arena' : 'Ready to duel',
      icon: Flame,
      textColor: 'text-rose-400',
      bgColor: 'bg-rose-500/15',
      borderColor: 'border-rose-500/30',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-7 pb-16">
      {/* ─── Hero Header & Arena Title ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-7 md:p-8 relative overflow-hidden bg-gradient-to-r from-slate-900 via-[#0a101f] to-slate-950 border border-cyan-500/20 shadow-2xl"
      >
        {/* Cyber Grid SVG Background */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(6, 182, 212, 0.2) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(6, 182, 212, 0.2) 1px, transparent 1px)
            `,
            backgroundSize: '30px 30px',
          }}
        />

        <div className="absolute -top-12 -left-12 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 shadow-xl shadow-amber-500/25 flex-shrink-0">
              <Trophy size={34} className="fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  Hall of Honors
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Season 1
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Scholar Achievements & Ranks
              </h1>
              <p className="text-xs text-slate-400 max-w-xl mt-1">
                Unlock prestigious platform badges, level up your knowledge score, and rise through the global leaderboards.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 self-start md:self-auto bg-slate-900/80 border border-white/10 rounded-2xl px-5 py-3 backdrop-blur-md">
            <div>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Trophy Mastery</p>
              <p className="text-2xl font-black text-amber-400">{unlockedCount} / {badges.length}</p>
            </div>
            <div className="h-9 w-px bg-white/10" />
            <div>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Global Tier</p>
              <p className="text-2xl font-black text-cyan-400">Rank #{userRank}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Level Progression Card (Clean & Accurate) ────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-3xl p-6 bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-xl relative overflow-hidden"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-5">
          {/* Avatar + Tier Title */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full p-1 bg-gradient-to-tr from-cyan-400 via-blue-500 to-amber-400 shadow-lg shadow-cyan-500/20">
                <Avatar
                  name={
                    (user?.firstName || user?.lastName)
                      ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
                      : (user?.username || 'Player')
                  }
                  src={user?.avatar}
                  size="xl"
                  className="w-full h-full rounded-full object-cover border-2 border-slate-900"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full border border-slate-900 shadow-md">
                Lvl {currentLevel}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">
                  Level {currentLevel} Scholar
                </h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {levelInfo.progressPercent}% to Level {currentLevel + 1}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Collect <span className="text-amber-400 font-bold">{levelInfo.xpNeeded.toLocaleString()} XP</span> in quizzes or battles to reach Level {currentLevel + 1}.
              </p>
            </div>
          </div>

          {/* Current & Next Milestone */}
          <div className="flex items-center gap-6 text-right">
            <div>
              <p className="text-xs text-slate-400 font-medium">Accumulated XP</p>
              <p className="text-lg font-black text-white">{totalXP.toLocaleString()} XP</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-xs text-slate-400 font-medium">Next Threshold</p>
              <p className="text-lg font-black text-cyan-400">{levelInfo.nextCeiling.toLocaleString()} XP</p>
            </div>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="relative w-full h-3.5 bg-slate-800/90 rounded-full overflow-hidden p-0.5 border border-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${levelInfo.progressPercent}%` }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-amber-400 shadow-md relative"
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
          </motion.div>
        </div>

        <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2 font-medium">
          <span>Level {currentLevel} ({levelInfo.currentFloor.toLocaleString()} XP)</span>
          <span className="text-cyan-300 font-bold">{levelInfo.progressPercent}% Completed</span>
          <span>Level {currentLevel + 1} ({levelInfo.nextCeiling.toLocaleString()} XP)</span>
        </div>
      </motion.div>

      {/* ─── 4-Stat Metric Cards Grid ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className={`p-5 rounded-2xl bg-slate-900/70 border ${stat.borderColor} backdrop-blur-md shadow-lg flex flex-col justify-between transition-transform duration-200 hover:-translate-y-1`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400">{stat.label}</span>
              <div className={`w-9 h-9 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon size={18} className={stat.textColor} />
              </div>
            </div>
            <div>
              <p className={`text-2xl md:text-3xl font-black ${stat.textColor} tracking-tight`}>
                {stat.value}
              </p>
              <p className="text-xs text-slate-400 mt-1 font-medium truncate">
                {stat.subtext}
              </p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ─── Navigation Tabs Switcher ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto scrollbar-none">
        {[
          { id: 'badges', label: 'Trophies & Badges', icon: Award, count: badges.length },
          { id: 'overview', label: 'Performance Analytics', icon: TrendingUp },
          { id: 'leaderboard', label: 'Global Leaderboard', icon: Trophy, count: leaderboard.length },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Interactive Tab Panels ──────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {/* ─── 1. Badges & Trophies Grid Tab ─────────────────────────────────────── */}
        {activeTab === 'badges' && (
          <motion.div
            key="badges"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Filter Pills Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/60 border border-white/5 backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400 font-bold mr-1 flex items-center gap-1">
                  <Filter size={13} />
                  Filter By:
                </span>
                {[
                  { id: 'all', label: `All (${badges.length})` },
                  { id: 'unlocked', label: `Unlocked 🌟 (${unlockedCount})` },
                  { id: 'locked', label: `Locked 🔒 (${badges.length - unlockedCount})` },
                  { id: 'battle', label: 'Battles ⚔️' },
                  { id: 'quiz', label: 'Quizzes 📚' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setBadgeFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      badgeFilter === f.id
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                        : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/5'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <span className="text-xs text-slate-400 font-medium">
                Showing <strong className="text-white">{filteredBadges.length}</strong> trophies
              </span>
            </div>

            {/* Badges Grid with Rarity Styles (NO blur filters!) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBadges.map((badge) => {
                const isUnlocked = badge.unlocked;
                const rarityStyle = RARITY_THEMES[badge.rarity] || RARITY_THEMES.RARE;

                return (
                  <motion.div
                    key={badge.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`p-5 rounded-2xl border transition-all duration-300 relative flex flex-col justify-between overflow-hidden group ${
                      isUnlocked
                        ? `${rarityStyle.bg} ${rarityStyle.border} ${rarityStyle.glow} hover:scale-[1.02]`
                        : 'bg-slate-900/40 border-white/5 opacity-60 hover:opacity-85'
                    }`}
                  >
                    {isUnlocked && (
                      <div className="absolute -top-6 -right-6 w-20 h-20 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
                    )}

                    <div>
                      {/* Top Rarity & Lock Status */}
                      <div className="flex items-center justify-between gap-1 mb-3">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${isUnlocked ? rarityStyle.tag : 'bg-slate-800 text-slate-500 border-white/5'}`}>
                          {badge.rarity || 'SCHOLAR'}
                        </span>
                        {isUnlocked ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                            <Check size={10} /> Unlocked
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-white/5 flex items-center gap-1">
                            <Lock size={10} /> Locked
                          </span>
                        )}
                      </div>

                      {/* Icon & Title */}
                      <div className="flex items-center gap-3.5 mb-2">
                        <div
                          className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-lg flex-shrink-0 transition-transform group-hover:scale-110 ${
                            isUnlocked
                              ? 'bg-slate-950/80 border border-amber-400/50'
                              : 'bg-slate-800/80 border border-white/10 grayscale'
                          }`}
                        >
                          {badge.icon || '🏆'}
                        </div>

                        <div className="min-w-0">
                          <h4 className={`font-extrabold text-base leading-tight truncate ${isUnlocked ? 'text-white' : 'text-slate-300'}`}>
                            {badge.name}
                          </h4>
                          <p className="text-xs text-cyan-300/80 font-medium capitalize mt-0.5">
                            {badge.category ? `${badge.category} Award` : 'Scholar Challenge'}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-2 mt-2">
                        {badge.description}
                      </p>
                    </div>

                    {/* How to unlock requirement */}
                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Unlock Goal:</span>
                      <span className={`font-semibold truncate ml-2 ${isUnlocked ? 'text-amber-300' : 'text-slate-400'}`}>
                        {badge.requirement || 'Play to earn'}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ─── 2. Overview & Analytics Tab ───────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recently Unlocked Trophies */}
              <div className="rounded-3xl p-6 bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Sparkles size={18} className="text-amber-400" />
                    Unlocked Honors
                  </h3>
                  <span className="text-xs text-amber-300 font-semibold">
                    {unlockedCount} Earned
                  </span>
                </div>

                <div className="space-y-3">
                  {unlockedBadges.length > 0 ? (
                    unlockedBadges.map((badge) => (
                      <div
                        key={badge.id}
                        className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-800/40 border border-white/5 hover:border-amber-500/30 transition-all"
                      >
                        <span className="text-3xl p-2 rounded-xl bg-slate-900 border border-white/10 shadow-sm">
                          {badge.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-white truncate">{badge.name}</p>
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {badge.rarity || 'RARE'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{badge.description}</p>
                        </div>
                        <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      No badges unlocked yet. Start with your first quiz or arena battle!
                    </div>
                  )}
                </div>
              </div>

              {/* Learning & Arena Progress Meters */}
              <div className="rounded-3xl p-6 bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-xl space-y-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <TrendingUp size={18} className="text-cyan-400" />
                    Learning & Arena Metrics
                  </h3>
                  <span className="text-xs text-cyan-300 font-semibold">Live Performance</span>
                </div>

                <div className="space-y-4">
                  {/* Streak Progress */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Flame size={14} className="text-rose-400" />
                        Arena Win Streak
                      </span>
                      <span className="text-white font-bold">{profile?.winStreak || 0} Matches</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full"
                        style={{ width: `${Math.min(100, (profile?.winStreak || 0) * 20)}%` }}
                      />
                    </div>
                  </div>

                  {/* Battles Won */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Swords size={14} className="text-indigo-400" />
                        Arena Battles Won
                      </span>
                      <span className="text-white font-bold">{profile?.battlesWon || 0} Wins</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full"
                        style={{ width: `${Math.min(100, (profile?.battlesWon || 0) * 10)}%` }}
                      />
                    </div>
                  </div>

                  {/* Total Quizzes */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <BookOpen size={14} className="text-emerald-400" />
                        Quizzes Completed
                      </span>
                      <span className="text-white font-bold">{profile?.totalQuizzes || 0} Quizzes</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                        style={{ width: `${Math.min(100, (profile?.totalQuizzes || 0) * 10)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── 3. Global Leaderboard Tab ─────────────────────────────────────────── */}
        {activeTab === 'leaderboard' && (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="rounded-3xl p-6 bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Crown size={20} className="text-amber-400 fill-amber-400" />
                    Global Scholar Hierarchy
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Top-performing scholars ranked by total knowledge XP and arena wins.</p>
                </div>
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-white/5">
                  <Users size={14} className="text-cyan-400" />
                  {leaderboard.length} Ranked Scholars
                </span>
              </div>

              {/* Leaderboard Table / Cards */}
              <div className="space-y-2.5">
                {leaderboard.map((entry, index) => {
                  const isCurrentUser = Boolean(
                    (entry.userId && user?.id && Number(entry.userId) === Number(user.id)) ||
                    (entry.userId && user?._id && String(entry.userId) === String(user._id)) ||
                    (entry.userName && user?.username && entry.userName.toLowerCase() === user.username.toLowerCase())
                  );
                  const isTopThree = index < 3;
                  const rankMedal = getRankMedal(entry.rank || index + 1);

                  return (
                    <motion.div
                      key={entry.userId || entry._id || index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${
                        isCurrentUser
                          ? 'bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-slate-900 border-2 border-cyan-400/50 shadow-lg shadow-cyan-500/10'
                          : 'bg-slate-800/40 border border-white/5 hover:bg-slate-800/80'
                      }`}
                    >
                      {/* Rank Medal / Badge */}
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg flex-shrink-0 shadow-md ${
                          index === 0
                            ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 ring-2 ring-amber-300'
                            : index === 1
                            ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-950 ring-2 ring-slate-200'
                            : index === 2
                            ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white ring-2 ring-amber-500'
                            : 'bg-slate-800 text-slate-400 border border-white/5'
                        }`}
                      >
                        {rankMedal}
                      </div>

                      {/* Avatar */}
                      <Avatar
                        name={entry.userName || 'Scholar'}
                        size="md"
                        className="rounded-full border border-white/10"
                      />

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-bold text-sm truncate ${isCurrentUser ? 'text-cyan-300' : 'text-white'}`}>
                            {entry.userName}
                          </p>
                          {isCurrentUser && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-medium">
                          Level {entry.level || 1} Scholar
                        </p>
                      </div>

                      {/* Points / XP */}
                      <div className="text-right">
                        <p className="font-black text-base text-amber-300">
                          {formatNumber(entry.totalPoints || entry.totalXP || 0)}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">XP Points</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GamificationPage;