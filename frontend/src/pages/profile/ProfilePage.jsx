import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Mail, Lock, Save, Camera, Trophy, Zap, 
  BookOpen, Swords, History, Shield, Settings, 
  Edit2, X, ChevronRight, Calendar, Award, Upload, 
  Trash2, CheckCircle2, Sparkles, Star, Flame, Eye,
  RefreshCw, Check, ArrowRight
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth.js';
import { useTheme } from '../../hooks/useTheme.js';
import { userAPI } from '../../api/user.api.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import toast from 'react-hot-toast';

// ─── Level Scaling Curve (mirrors backend) ──────────────────────────────────
const LEVEL_THRESHOLDS = [
  0, 500, 1200, 2200, 3500, 5200, 7200, 9600, 12500, 16000,
  20000, 25000, 31000, 38000, 46000, 55000, 65000, 76000, 88000, 101000
];

const getLevelDetails = (totalXP) => {
  const points = Math.max(0, Number(totalXP) || 0);
  let lvl = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (points >= LEVEL_THRESHOLDS[i]) {
      lvl = i + 1;
    } else {
      break;
    }
  }

  if (lvl >= LEVEL_THRESHOLDS.length) {
    const extra = points - LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
    lvl = Math.min(100, 20 + Math.floor(extra / 15000));
  }

  const currentFloor = lvl <= LEVEL_THRESHOLDS.length 
    ? LEVEL_THRESHOLDS[lvl - 1] 
    : LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (lvl - 20) * 15000;

  const nextCeiling = lvl < LEVEL_THRESHOLDS.length
    ? LEVEL_THRESHOLDS[lvl]
    : currentFloor + 15000;

  const xpNeeded = Math.max(0, nextCeiling - points);
  const xpInLevel = Math.max(0, points - currentFloor);
  const range = Math.max(1, nextCeiling - currentFloor);
  const progressPercent = Math.min(100, Math.max(0, Math.round((xpInLevel / range) * 100)));

  return {
    level: lvl,
    currentFloor,
    nextCeiling,
    xpNeeded,
    xpInLevel,
    progressPercent,
  };
};

// ─── Preset Avatars Catalog ──────────────────────────────────────────────────
const PRESET_AVATARS = [
  { id: 'cyber-scholar', name: 'Cyber Scholar', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Scholar' },
  { id: 'quantum-bot', name: 'Quantum Bot', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Quantum' },
  { id: 'robo-champ', name: 'Robo Champ', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Champion' },
  { id: 'astro-genius', name: 'Astro Genius', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Genius' },
  { id: 'master-felix', name: 'Master Felix', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix' },
  { id: 'scholar-aneka', name: 'Scholar Aneka', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka' },
  { id: 'sage-elena', name: 'Sage Elena', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Elena' },
  { id: 'pixel-hero', name: 'Pixel Hero', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Hero' },
  { id: 'code-ninja', name: 'Code Ninja', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Ninja' },
  { id: 'pro-aiden', name: 'Pro Aiden', url: 'https://api.dicebear.com/7.x/personas/svg?seed=Aiden' },
];

// ─── System Standard Badges Catalog Fallback ────────────────────────────────
const DEFAULT_BADGES = [
  { id: 'badge_first_step', name: 'First Step', description: 'Completed your first quiz successfully', icon: '🎯', category: 'Quiz', requirement: 'Complete 1 quiz' },
  { id: 'badge_quiz_scholar', name: 'Quiz Scholar', description: 'Completed 5 quizzes on the platform', icon: '📚', category: 'Quiz', requirement: 'Complete 5 quizzes' },
  { id: 'badge_quiz_master', name: 'Quiz Master', description: 'Completed 10 or more quizzes with high accuracy', icon: '🎓', category: 'Quiz', requirement: 'Complete 10 quizzes' },
  { id: 'badge_perfect_100', name: 'Perfectionist', description: 'Scored 100% on any quiz', icon: '💯', category: 'Skill', requirement: 'Score 100% in a quiz' },
  { id: 'badge_speed_demon', name: 'Speed Demon', description: 'Completed a quiz in record time', icon: '⚡', category: 'Speed', requirement: 'Complete a quiz under 60 seconds' },
  { id: 'badge_first_battle', name: 'Gladiator', description: 'Joined and participated in your first live battle session', icon: '⚔️', category: 'Battle', requirement: 'Join 1 battle' },
  { id: 'badge_battle_victor', name: 'Battle Victor', description: 'Won your first competitive battle session', icon: '🏆', category: 'Battle', requirement: 'Win 1 battle' },
  { id: 'badge_win_streak', name: 'On Fire', description: 'Maintained a win streak of 3 consecutive battles', icon: '🔥', category: 'Battle', requirement: 'Achieve 3 battle win streak' },
  { id: 'badge_conqueror', name: 'Grand Champion', description: 'Won 5 or more multiplayer battles', icon: '👑', category: 'Battle', requirement: 'Win 5 battles' },
];

const profileSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName:  z.string().min(2, 'Last name must be at least 2 characters'),
  email:     z.string().email('Invalid email address'),
  bio:       z.string().max(200, 'Bio cannot exceed 200 characters').optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

/**
 * @page ProfilePage
 * @description Modern, sleek Gamer & Scholar profile management experience.
 */
const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState('badges');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Profile & stats state
  const [profileData, setProfileData] = useState(null);
  const [stats, setStats] = useState(null);
  const [badges, setBadges] = useState([]);
  const [activityLog, setActivityLog] = useState([]);

  // Avatar Modal State
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarTab, setAvatarTab] = useState('upload'); // 'upload' | 'presets'
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  
  const fileInputRef = useRef(null);

  // Profile form
  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
    reset: resetProfile,
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      bio: '',
    },
  });

  // Password form
  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
    reset: resetPassword,
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  // Fetch initial profile, badges and stats
  useEffect(() => {
    fetchProfileData();
    fetchBadges();
  }, []);

  const fetchProfileData = async () => {
    setIsLoading(true);
    try {
      const response = await userAPI.getProfile();
      const userData = response.data?.user || response.data?.data?.user || response.data;
      const statsData = response.data?.stats || response.data?.data?.stats;
      
      setProfileData(userData);
      setStats(statsData);
      
      if (userData) {
        const uName = userData.username || '';
        const parts = uName.includes(' ') ? uName.split(' ') : [uName, ''];
        resetProfile({
          firstName: userData.firstName || userData.first_name || parts[0] || '',
          lastName: userData.lastName || userData.last_name || parts.slice(1).join(' ') || '',
          email: userData.email || '',
          bio: userData.bio || '',
        });
      }
    } catch (error) {
      console.error('Profile fetch error:', error);
      if (user) {
        setProfileData(user);
        const uName = user.username || '';
        const parts = uName.includes(' ') ? uName.split(' ') : [uName, ''];
        resetProfile({
          firstName: user.firstName || parts[0] || '',
          lastName: user.lastName || parts.slice(1).join(' ') || '',
          email: user.email || '',
          bio: user.bio || '',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBadges = async () => {
    try {
      const res = await userAPI.getBadges();
      const badgesList = res.data?.badges || res.data?.data?.badges || [];
      if (Array.isArray(badgesList) && badgesList.length > 0) {
        setBadges(badgesList);
      } else {
        setBadges(DEFAULT_BADGES);
      }
    } catch (err) {
      console.warn('Badges fetch fallback to defaults:', err);
      setBadges(DEFAULT_BADGES);
    }
  };

  const fetchActivityLog = async () => {
    try {
      const response = await userAPI.getActivityLog();
      const activities = response.data || response.data?.data?.activities || [];
      setActivityLog(Array.isArray(activities) ? activities : []);
    } catch (error) {
      console.error('Activity log error:', error);
      setActivityLog([]);
    }
  };

  const onProfileSubmit = async (data) => {
    setIsSaving(true);
    try {
      const response = await userAPI.updateProfile(data);
      const updatedUser = response.data?.user || response.data;
      if (updatedUser) {
        updateUser(updatedUser);
        setProfileData(updatedUser);
      }
      toast.success('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error(error.response?.data?.detail || error.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const onPasswordSubmit = async (data) => {
    setIsSaving(true);
    try {
      await userAPI.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success('Password changed successfully!');
      resetPassword();
      setIsChangingPassword(false);
    } catch (error) {
      console.error('Password change error:', error);
      toast.error(error.response?.data?.detail || error.message || 'Failed to change password.');
    } finally {
      setIsSaving(false);
    }
  };

  // Avatar Modal Handlers
  const handleOpenAvatarModal = () => {
    setPreviewFile(null);
    setPreviewUrl(null);
    setSelectedPreset(null);
    setIsAvatarModalOpen(true);
  };

  const handleCloseAvatarModal = () => {
    setIsAvatarModalOpen(false);
    setPreviewFile(null);
    setPreviewUrl(null);
    setSelectedPreset(null);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a valid image file (PNG, JPG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB.');
      return;
    }

    setPreviewFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setSelectedPreset(null);
  };

  const handleUploadAvatarConfirm = async () => {
    if (!previewFile) {
      toast.error('Please select an image first.');
      return;
    }

    setIsSavingAvatar(true);
    try {
      const res = await userAPI.uploadAvatar(previewFile);
      const avatarUrl = res.data?.avatar || res.data?.user?.avatar;
      const updatedUser = res.data?.user || { ...profileData, avatar: avatarUrl };
      
      updateUser(updatedUser);
      setProfileData(prev => ({ ...prev, avatar: avatarUrl }));
      toast.success('Profile picture updated!');
      handleCloseAvatarModal();
    } catch (err) {
      console.error('Avatar upload failed:', err);
      toast.error(err.response?.data?.detail || 'Failed to upload image.');
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleSelectPresetConfirm = async (presetUrl) => {
    setIsSavingAvatar(true);
    try {
      const res = await userAPI.updateProfile({ avatar: presetUrl });
      const updatedUser = res.data?.user || { ...profileData, avatar: presetUrl };
      
      updateUser(updatedUser);
      setProfileData(prev => ({ ...prev, avatar: presetUrl }));
      toast.success('Scholar Avatar equipped!');
      handleCloseAvatarModal();
    } catch (err) {
      console.error('Failed to equip preset avatar:', err);
      toast.error(err.response?.data?.detail || 'Failed to apply avatar.');
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setIsSavingAvatar(true);
    try {
      await userAPI.removeAvatar();
      updateUser({ avatar: null });
      setProfileData(prev => ({ ...prev, avatar: null }));
      toast.success('Avatar removed. Showing initials.');
      handleCloseAvatarModal();
    } catch (err) {
      console.error('Failed to remove avatar:', err);
      toast.error(err.response?.data?.detail || 'Failed to remove avatar.');
    } finally {
      setIsSavingAvatar(false);
    }
  };

  // Progression calculation
  const totalXP = stats?.totalXP || profileData?.total_points || user?.total_points || 0;
  const levelInfo = useMemo(() => getLevelDetails(totalXP), [totalXP]);
  const currentLevel = stats?.level || levelInfo.level;
  const currentRank = stats?.rank || 2;
  const winStreak = stats?.winStreak || 0;
  const battlesWon = stats?.battlesWon || 0;
  const quizzesCompleted = stats?.quizzesCompleted || 0;
  const avgScore = stats?.averageScore || 0;

  // Unlocked badges list
  const unlockedBadgeIds = useMemo(() => {
    const list = stats?.badges || [];
    return new Set(list.map(b => (typeof b === 'string' ? b : b.id)));
  }, [stats?.badges]);

  const fullName = (profileData?.firstName || profileData?.lastName)
    ? `${profileData?.firstName || ''} ${profileData?.lastName || ''}`.trim()
    : (profileData?.username || user?.username || 'Quiz Master');

  const avatarSrc = profileData?.avatar || user?.avatar || null;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* ─── Hero Header & Banner ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden shadow-2xl border border-indigo-500/20 bg-gradient-to-b from-slate-900/90 to-slate-950"
      >
        {/* Glowing Decorative Cover Banner */}
        <div className="h-56 relative overflow-hidden bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-950">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-purple-500/10 to-transparent" />
          <div className="absolute inset-0 bg-grid-pattern opacity-15" />
          
          {/* Animated Glow Orbs */}
          <div className="absolute -top-12 -left-12 w-64 h-64 bg-indigo-600/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-10 right-10 w-72 h-72 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Top Corner Action Controls */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <button
              onClick={handleOpenAvatarModal}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 transition-all shadow-md active:scale-95"
            >
              <Camera size={14} className="text-indigo-300" />
              <span>Change Photo</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('profile');
                setIsEditing(true);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-600/80 hover:bg-indigo-600 text-white backdrop-blur-md border border-indigo-400/30 transition-all shadow-md active:scale-95"
            >
              <Edit2 size={14} />
              <span>Edit Profile</span>
            </button>
          </div>
        </div>

        {/* Profile Identity Bar */}
        <div className="px-6 md:px-8 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 -mt-20">
            {/* Avatar with Glowing Border & Level Badge */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
              <div className="relative group cursor-pointer" onClick={handleOpenAvatarModal}>
                <div className="relative w-32 h-32 md:w-36 md:h-36 rounded-full p-1.5 bg-gradient-to-tr from-amber-400 via-indigo-500 to-purple-600 shadow-2xl shadow-indigo-500/30 ring-4 ring-slate-950">
                  <Avatar
                    name={fullName}
                    src={avatarSrc}
                    size="7xl"
                    className="w-full h-full rounded-full object-cover border-2 border-slate-900 bg-slate-800"
                  />
                  {/* Hover Overlay */}
                  <div className="absolute inset-1.5 rounded-full bg-black/60 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs">
                    <Camera size={26} className="text-amber-400 mb-1" />
                    <span className="text-[11px] font-bold tracking-wide">Change</span>
                  </div>
                </div>

                {/* Level Crown Badge */}
                <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs px-2.5 py-1 rounded-full shadow-lg border-2 border-slate-950 flex items-center gap-1">
                  <Trophy size={12} className="text-slate-950 fill-current" />
                  <span>Lvl {currentLevel}</span>
                </div>
              </div>

              {/* Names & Taglines */}
              <div className="text-center sm:text-left space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                    {fullName}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                    Level {currentLevel} Scholar
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1 shadow-sm">
                    <Award size={11} className="text-indigo-300" />
                    Rank #{currentRank}
                  </span>
                  {winStreak > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 shadow-sm">
                      <Flame size={12} className="text-rose-400 fill-rose-400" />
                      {winStreak} Win Streak
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-400 font-medium">
                  <span className="text-indigo-400 font-semibold">@{profileData?.username || user?.username}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Mail size={12} />
                    {profileData?.email || user?.email}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    Joined {profileData?.created_at ? new Date(profileData.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '2026'}
                  </span>
                </div>

                {profileData?.bio && (
                  <p className="text-xs text-slate-300 max-w-xl line-clamp-2 pt-1 italic">
                    "{profileData.bio}"
                  </p>
                )}
              </div>
            </div>

            {/* Quick Level Summary Stat */}
            <div className="hidden lg:flex flex-col items-end justify-center bg-slate-900/60 border border-white/10 rounded-2xl px-5 py-3 backdrop-blur-md">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Total Knowledge Points</span>
              <span className="text-3xl font-black bg-gradient-to-r from-indigo-400 via-purple-300 to-amber-300 bg-clip-text text-transparent">
                {totalXP.toLocaleString()} XP
              </span>
              <span className="text-xs text-indigo-400 font-semibold mt-0.5">
                {levelInfo.xpNeeded.toLocaleString()} XP to Level {currentLevel + 1}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Level Progression Card ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-3xl p-6 bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-xl relative overflow-hidden"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 font-black text-xl">
              {currentLevel}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Tier Progress</h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {levelInfo.progressPercent}% to Lvl {currentLevel + 1}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Earn <span className="text-amber-400 font-bold">{levelInfo.xpNeeded.toLocaleString()} XP</span> in quizzes or battles to advance to Level {currentLevel + 1}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-right">
            <div>
              <p className="text-xs text-slate-400 font-medium">Current XP</p>
              <p className="text-base font-bold text-white">{totalXP.toLocaleString()} XP</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-xs text-slate-400 font-medium">Next Milestone</p>
              <p className="text-base font-bold text-indigo-400">{levelInfo.nextCeiling.toLocaleString()} XP</p>
            </div>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="relative w-full h-4 bg-slate-800/80 rounded-full overflow-hidden p-0.5 border border-white/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${levelInfo.progressPercent}%` }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-400 shadow-md relative"
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
          </motion.div>
        </div>

        <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2 font-medium">
          <span>Level {currentLevel} ({levelInfo.currentFloor.toLocaleString()} XP)</span>
          <span>{levelInfo.progressPercent}% Completed</span>
          <span>Level {currentLevel + 1} ({levelInfo.nextCeiling.toLocaleString()} XP)</span>
        </div>
      </motion.div>

      {/* ─── 4-Stat Grid ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          {
            icon: Trophy,
            label: 'Global Rank',
            value: `#${currentRank}`,
            subtext: 'Global Leaderboard',
            color: 'from-amber-500 to-yellow-600',
            textColor: 'text-amber-400',
            bgColor: 'bg-amber-500/15',
            borderColor: 'border-amber-500/30'
          },
          {
            icon: Zap,
            label: 'Total XP',
            value: totalXP.toLocaleString(),
            subtext: `${levelInfo.progressPercent}% into Level ${currentLevel}`,
            color: 'from-indigo-500 to-purple-600',
            textColor: 'text-indigo-400',
            bgColor: 'bg-indigo-500/15',
            borderColor: 'border-indigo-500/30'
          },
          {
            icon: BookOpen,
            label: 'Quizzes Taken',
            value: quizzesCompleted,
            subtext: `Avg Accuracy ${avgScore}%`,
            color: 'from-emerald-500 to-teal-600',
            textColor: 'text-emerald-400',
            bgColor: 'bg-emerald-500/15',
            borderColor: 'border-emerald-500/30'
          },
          {
            icon: Swords,
            label: 'Battles Won',
            value: battlesWon,
            subtext: winStreak > 0 ? `${winStreak} Streak 🔥` : 'Ready to clash',
            color: 'from-rose-500 to-pink-600',
            textColor: 'text-rose-400',
            bgColor: 'bg-rose-500/15',
            borderColor: 'border-rose-500/30'
          },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={`p-5 rounded-2xl bg-slate-900/60 border ${stat.borderColor} backdrop-blur-md shadow-lg flex flex-col justify-between transition-transform duration-200 hover:-translate-y-1`}
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

      {/* ─── Navigation Tabs ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto scrollbar-none">
        {[
          { id: 'badges', label: 'Badges & Trophies', icon: Award, count: badges.length },
          { id: 'profile', label: 'Profile Details', icon: User },
          { id: 'security', label: 'Security & Password', icon: Shield },
          { id: 'activity', label: 'Recent Battles & Quizzes', icon: History },
        ].map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id);
                if (t.id === 'activity') fetchActivityLog();
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <t.icon size={16} />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Tab Content Panes ─────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {/* Tab 1: Badges Showcase */}
        {activeTab === 'badges' && (
          <motion.div
            key="badges"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <Sparkles size={20} className="text-amber-400" />
                  Achievements Showcase
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Unlock prestigious badges by mastering quizzes, winning battles, and staying consistent.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {badges.map((badge) => {
                const isUnlocked = badge.is_unlocked || unlockedBadgeIds.has(badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                      isUnlocked
                        ? 'bg-gradient-to-br from-slate-900/90 to-indigo-950/60 border-amber-500/40 shadow-xl shadow-amber-500/5 hover:border-amber-400'
                        : 'bg-slate-900/40 border-white/5 opacity-70 hover:opacity-90'
                    }`}
                  >
                    {isUnlocked && (
                      <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                    )}

                    <div className="flex items-start gap-4">
                      <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-md flex-shrink-0 ${
                          isUnlocked
                            ? 'bg-gradient-to-tr from-amber-500/20 to-yellow-400/20 border border-amber-400/40 ring-2 ring-amber-400/20'
                            : 'bg-slate-800/80 border border-white/10 grayscale'
                        }`}
                      >
                        {badge.icon || '🏆'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className={`font-bold text-base truncate ${isUnlocked ? 'text-amber-300' : 'text-slate-300'}`}>
                            {badge.name}
                          </h4>
                          {isUnlocked ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Unlocked
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-500 border border-white/5">
                              Locked
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                          {badge.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-indigo-400">
                        {badge.category ? `${badge.category} Award` : 'Challenge'}
                      </span>
                      <span className="text-slate-500 truncate ml-2">
                        {badge.requirement || 'Play to earn'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Tab 2: Profile Details */}
        {activeTab === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-xl">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-xl font-bold text-white">Personal Information</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Manage your public scholar profile and identity.</p>
                </div>
                {!isEditing && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    leftIcon={<Edit2 size={15} />}
                  >
                    Edit Details
                  </Button>
                )}
              </div>

              {isEditing ? (
                <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                        First Name
                      </label>
                      <Input
                        {...registerProfile('firstName')}
                        error={profileErrors.firstName?.message}
                        placeholder="First Name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                        Last Name
                      </label>
                      <Input
                        {...registerProfile('lastName')}
                        error={profileErrors.lastName?.message}
                        placeholder="Last Name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Email Address
                    </label>
                    <Input
                      {...registerProfile('email')}
                      error={profileErrors.email?.message}
                      placeholder="Email"
                      disabled
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Email is tied to your account login and cannot be altered directly.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Bio / Tagline (Max 200 characters)
                    </label>
                    <textarea
                      {...registerProfile('bio')}
                      rows={3}
                      placeholder="e.g. Passionate computer science student aiming for the top leaderboard rank!"
                      className="w-full bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                    />
                    {profileErrors.bio?.message && (
                      <p className="text-red-400 text-xs mt-1">{profileErrors.bio.message}</p>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      isLoading={isSaving}
                      leftIcon={<Save size={16} />}
                    >
                      Save Changes
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        resetProfile();
                        setIsEditing(false);
                      }}
                      leftIcon={<X size={16} />}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-800/40 p-4 rounded-2xl border border-white/5">
                      <span className="text-xs text-slate-400 font-semibold block mb-1">First Name</span>
                      <p className="text-base font-bold text-white">
                        {profileData?.firstName || profileData?.first_name || '—'}
                      </p>
                    </div>
                    <div className="bg-slate-800/40 p-4 rounded-2xl border border-white/5">
                      <span className="text-xs text-slate-400 font-semibold block mb-1">Last Name</span>
                      <p className="text-base font-bold text-white">
                        {profileData?.lastName || profileData?.last_name || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-800/40 p-4 rounded-2xl border border-white/5">
                    <span className="text-xs text-slate-400 font-semibold block mb-1">Email Address</span>
                    <p className="text-base font-bold text-white">{profileData?.email || user?.email}</p>
                  </div>

                  <div className="bg-slate-800/40 p-4 rounded-2xl border border-white/5">
                    <span className="text-xs text-slate-400 font-semibold block mb-1">Bio</span>
                    <p className="text-sm text-slate-300 italic">
                      {profileData?.bio || 'No bio written yet. Click "Edit Details" to add one!'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Tab 3: Security & Password */}
        {activeTab === 'security' && (
          <motion.div
            key="security"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-xl max-w-2xl">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Password & Security</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Ensure your account is protected with a strong password.</p>
                </div>
              </div>

              {isChangingPassword ? (
                <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Current Password
                    </label>
                    <Input
                      type="password"
                      {...registerPassword('currentPassword')}
                      error={passwordErrors.currentPassword?.message}
                      placeholder="Enter current password"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      New Password
                    </label>
                    <Input
                      type="password"
                      {...registerPassword('newPassword')}
                      error={passwordErrors.newPassword?.message}
                      placeholder="Enter new password (min. 6 characters)"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Confirm New Password
                    </label>
                    <Input
                      type="password"
                      {...registerPassword('confirmPassword')}
                      error={passwordErrors.confirmPassword?.message}
                      placeholder="Re-enter new password"
                    />
                  </div>

                  <div className="flex gap-3 pt-3">
                    <Button
                      type="submit"
                      variant="primary"
                      isLoading={isSaving}
                      leftIcon={<Save size={16} />}
                    >
                      Update Password
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        resetPassword();
                        setIsChangingPassword(false);
                      }}
                      leftIcon={<X size={16} />}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-3xl bg-slate-800 text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-inner">
                    <Lock size={28} />
                  </div>
                  <h4 className="text-lg font-bold text-white">Update Your Password</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-6">
                    We recommend choosing a unique password with a mixture of letters, numbers, and symbols.
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => setIsChangingPassword(true)}
                    leftIcon={<Lock size={16} />}
                  >
                    Change Password
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Tab 4: Match & Quiz History */}
        {activeTab === 'activity' && (
          <motion.div
            key="activity"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Recent Performance</h3>
                <p className="text-xs text-slate-400 mt-0.5">Chronological record of completed quizzes and live battles.</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchActivityLog}
                leftIcon={<RefreshCw size={14} />}
              >
                Refresh
              </Button>
            </div>

            {activityLog.length > 0 ? (
              <div className="space-y-3">
                {activityLog.map((act, index) => (
                  <div
                    key={act.id || index}
                    className="p-4 rounded-2xl bg-slate-900/70 border border-white/10 backdrop-blur-md flex items-center justify-between gap-4 transition-all hover:border-indigo-500/40"
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg shadow-md ${
                          act.type === 'quiz'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {act.type === 'quiz' ? <BookOpen size={20} /> : <Swords size={20} />}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{act.title}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span className="capitalize">{act.type === 'quiz' ? 'Solo Practice' : '1v1 Live Battle'}</span>
                          <span>•</span>
                          <span className="text-amber-400 font-semibold">{act.score}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-xs text-slate-400 font-medium">
                      {act.date ? new Date(act.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-900/50 rounded-3xl border border-white/5">
                <History size={36} className="text-slate-600 mx-auto mb-3" />
                <h4 className="text-base font-bold text-white">No Activities Recorded Yet</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Take your first PDF quiz or challenge an opponent in a live 1v1 battle to start logging your history!
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Avatar Customization Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {isAvatarModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-indigo-500/30 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Camera size={18} className="text-amber-400" />
                    Customize Profile Picture
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Upload your own photo or choose a curated scholar avatar.
                  </p>
                </div>
                <button
                  onClick={handleCloseAvatarModal}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Sub-Tabs */}
              <div className="px-6 pt-4 flex gap-2">
                <button
                  onClick={() => setAvatarTab('upload')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                    avatarTab === 'upload'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white'
                  }`}
                >
                  Upload Photo
                </button>
                <button
                  onClick={() => setAvatarTab('presets')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                    avatarTab === 'presets'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white'
                  }`}
                >
                  Preset Avatars
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                {avatarTab === 'upload' ? (
                  <div className="space-y-4">
                    {/* Preview Area */}
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-28 h-28 rounded-full ring-4 ring-indigo-500/40 p-1 bg-slate-950 shadow-xl overflow-hidden mb-3">
                        <Avatar
                          name={fullName}
                          src={previewUrl || avatarSrc}
                          size="7xl"
                          className="w-full h-full rounded-full object-cover"
                        />
                      </div>
                      <p className="text-xs text-slate-400">
                        {previewFile ? previewFile.name : 'Current Photo Preview'}
                      </p>
                    </div>

                    {/* Drop / Select zone */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-indigo-500/30 hover:border-indigo-400/70 rounded-2xl p-6 text-center cursor-pointer transition-all bg-indigo-500/5 hover:bg-indigo-500/10"
                    >
                      <Upload size={28} className="text-indigo-400 mx-auto mb-2" />
                      <p className="text-sm font-bold text-white">Click to browse file</p>
                      <p className="text-xs text-slate-400 mt-1">PNG, JPG, or WEBP up to 5MB</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>

                    {previewFile && (
                      <Button
                        variant="primary"
                        fullWidth
                        isLoading={isSavingAvatar}
                        onClick={handleUploadAvatarConfirm}
                        leftIcon={<Check size={16} />}
                      >
                        Apply New Photo
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400">
                      Pick a high-resolution cyber or scholar avatar to instantly represent your gamer persona:
                    </p>

                    <div className="grid grid-cols-5 gap-3 max-h-64 overflow-y-auto pr-1">
                      {PRESET_AVATARS.map((p) => {
                        const isSelected = (selectedPreset === p.url) || (!selectedPreset && avatarSrc === p.url);
                        return (
                          <div
                            key={p.id}
                            onClick={() => setSelectedPreset(p.url)}
                            className={`p-1.5 rounded-2xl cursor-pointer border-2 transition-all flex flex-col items-center gap-1 ${
                              isSelected
                                ? 'border-amber-400 bg-amber-400/10 scale-105'
                                : 'border-white/10 hover:border-indigo-400/50 bg-slate-800/60'
                            }`}
                          >
                            <img
                              src={p.url}
                              alt={p.name}
                              className="w-12 h-12 rounded-xl object-cover"
                            />
                            <span className="text-[10px] text-slate-300 font-medium truncate w-full text-center">
                              {p.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {selectedPreset && selectedPreset !== avatarSrc && (
                      <Button
                        variant="primary"
                        fullWidth
                        isLoading={isSavingAvatar}
                        onClick={() => handleSelectPresetConfirm(selectedPreset)}
                        leftIcon={<Check size={16} />}
                      >
                        Equip Selected Avatar
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-950/60 border-t border-white/10 flex items-center justify-between">
                {avatarSrc ? (
                  <button
                    onClick={handleRemoveAvatar}
                    disabled={isSavingAvatar}
                    className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-semibold transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    <span>Remove Photo</span>
                  </button>
                ) : (
                  <div />
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseAvatarModal}
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfilePage;
