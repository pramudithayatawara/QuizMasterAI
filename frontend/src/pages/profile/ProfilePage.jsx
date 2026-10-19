import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Mail, Lock, Save, Camera, Trophy, Zap, 
  BookOpen, Swords, History, Shield, ShieldCheck, Settings, 
  Edit2, X, ChevronRight, Calendar, Award, Upload, 
  Trash2, CheckCircle2, Sparkles, Star, Flame, Eye, EyeOff,
  RefreshCw, Check, ArrowRight, Crown, Target, Compass, KeyRound
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

// ─── System Badges Catalog with Gamified Rarity ──────────────────────────────
const DEFAULT_BADGES = [
  { id: 'badge_first_step', name: 'First Step', description: 'Completed your first quiz successfully', icon: '🎯', category: 'Quiz', requirement: 'Complete 1 quiz', rarity: 'NOVICE', color: 'slate' },
  { id: 'badge_quiz_scholar', name: 'Quiz Scholar', description: 'Completed 5 quizzes on the platform', icon: '📚', category: 'Quiz', requirement: 'Complete 5 quizzes', rarity: 'SCHOLAR', color: 'blue' },
  { id: 'badge_quiz_master', name: 'Quiz Master', description: 'Completed 10 or more quizzes with high accuracy', icon: '🎓', category: 'Quiz', requirement: 'Complete 10 quizzes', rarity: 'MYTHIC', color: 'cyan' },
  { id: 'badge_perfect_100', name: 'Perfectionist', description: 'Scored 100% on any quiz', icon: '💯', category: 'Skill', requirement: 'Score 100% in a quiz', rarity: 'ELITE', color: 'emerald' },
  { id: 'badge_speed_demon', name: 'Speed Demon', description: 'Completed a quiz in record time', icon: '⚡', category: 'Speed', requirement: 'Complete under 60s', rarity: 'SPEED', color: 'amber' },
  { id: 'badge_first_battle', name: 'Gladiator', description: 'Joined and participated in your first live battle session', icon: '⚔️', category: 'Battle', requirement: 'Join 1 battle', rarity: 'SPECIAL', color: 'purple' },
  { id: 'badge_battle_victor', name: 'Battle Victor', description: 'Won your first competitive battle session', icon: '🏆', category: 'Battle', requirement: 'Win 1 battle', rarity: 'RARE', color: 'yellow' },
  { id: 'badge_win_streak', name: 'On Fire', description: 'Maintained a win streak of 3 consecutive battles', icon: '🔥', category: 'Battle', requirement: '3 battle win streak', rarity: 'EPIC', color: 'rose' },
  { id: 'badge_conqueror', name: 'Grand Champion', description: 'Won 5 or more multiplayer battles', icon: '👑', category: 'Battle', requirement: 'Win 5 battles', rarity: 'LEGENDARY', color: 'gold' },
];

const RARITY_CONFIG = {
  LEGENDARY: { label: 'LEGENDARY', border: 'border-amber-400/80', bg: 'bg-gradient-to-br from-amber-500/25 via-yellow-500/10 to-slate-900', glow: 'shadow-amber-500/20 shadow-xl', tag: 'bg-amber-500/25 text-amber-300 border-amber-400/50' },
  EPIC:      { label: 'EPIC', border: 'border-rose-400/80', bg: 'bg-gradient-to-br from-rose-500/25 via-pink-500/10 to-slate-900', glow: 'shadow-rose-500/20 shadow-xl', tag: 'bg-rose-500/25 text-rose-300 border-rose-400/50' },
  RARE:      { label: 'RARE', border: 'border-yellow-400/70', bg: 'bg-gradient-to-br from-yellow-500/20 via-amber-500/10 to-slate-900', glow: 'shadow-yellow-500/15 shadow-lg', tag: 'bg-yellow-500/25 text-yellow-300 border-yellow-400/50' },
  MYTHIC:    { label: 'MYTHIC', border: 'border-cyan-400/70', bg: 'bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-slate-900', glow: 'shadow-cyan-500/15 shadow-lg', tag: 'bg-cyan-500/25 text-cyan-300 border-cyan-400/50' },
  ELITE:     { label: 'ELITE', border: 'border-emerald-400/70', bg: 'bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-slate-900', glow: 'shadow-emerald-500/15 shadow-lg', tag: 'bg-emerald-500/25 text-emerald-300 border-emerald-400/50' },
  SPECIAL:   { label: 'SPECIAL', border: 'border-indigo-400/70', bg: 'bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-slate-900', glow: 'shadow-indigo-500/15 shadow-lg', tag: 'bg-indigo-500/25 text-indigo-300 border-indigo-400/50' },
  SPEED:     { label: 'SPEED', border: 'border-orange-400/70', bg: 'bg-gradient-to-br from-orange-500/20 via-amber-500/10 to-slate-900', glow: 'shadow-orange-500/15 shadow-lg', tag: 'bg-orange-500/25 text-orange-300 border-orange-400/50' },
  SCHOLAR:   { label: 'SCHOLAR', border: 'border-blue-400/70', bg: 'bg-gradient-to-br from-blue-500/20 via-indigo-500/10 to-slate-900', glow: 'shadow-blue-500/15 shadow-lg', tag: 'bg-blue-500/25 text-blue-300 border-blue-400/50' },
  NOVICE:    { label: 'NOVICE', border: 'border-slate-500/40', bg: 'bg-slate-900/60', glow: 'shadow-sm', tag: 'bg-slate-800 text-slate-400 border-slate-700' },
};

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
 * @description Master Command Hub profile experience with interactive sidebar navigation.
 */
const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Navigation tab state ('badges' | 'profile' | 'security' | 'activity')
  const [activeTab, setActiveTab] = useState('badges');
  const [badgeFilter, setBadgeFilter] = useState('all'); // 'all' | 'unlocked' | 'locked' | 'battle' | 'quiz'
  const [activityFilter, setActivityFilter] = useState('all'); // 'all' | 'battle' | 'quiz'

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Password visibility states
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  
  // Profile & stats state
  const [profileData, setProfileData] = useState(null);
  const [stats, setStats] = useState(null);
  const [badges, setBadges] = useState(DEFAULT_BADGES);
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
    watch: watchProfile,
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
    watch: watchPassword,
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const newPasswordValue = watchPassword('newPassword') || '';

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
        // Merge with rarity config
        const merged = badgesList.map(b => {
          const def = DEFAULT_BADGES.find(d => d.id === b.id);
          return {
            ...def,
            ...b,
            rarity: def?.rarity || 'RARE',
          };
        });
        setBadges(merged);
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
      toast.success('Profile details saved!');
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

  // Unlocked badges list & count
  const unlockedBadgeIds = useMemo(() => {
    const list = stats?.badges || [];
    return new Set(list.map(b => (typeof b === 'string' ? b : b.id)));
  }, [stats?.badges]);

  const unlockedCount = useMemo(() => {
    return badges.filter(b => b.is_unlocked || unlockedBadgeIds.has(b.id)).length;
  }, [badges, unlockedBadgeIds]);

  const badgeCompletionPercent = Math.round((unlockedCount / Math.max(1, badges.length)) * 100);

  // Highest unlocked badge for spotlight
  const featuredBadge = useMemo(() => {
    const unlocked = badges.filter(b => b.is_unlocked || unlockedBadgeIds.has(b.id));
    if (unlocked.length === 0) return badges[0];
    return unlocked[unlocked.length - 1];
  }, [badges, unlockedBadgeIds]);

  // Filtered badges
  const filteredBadges = useMemo(() => {
    return badges.filter(b => {
      const isUnlocked = b.is_unlocked || unlockedBadgeIds.has(b.id);
      if (badgeFilter === 'unlocked') return isUnlocked;
      if (badgeFilter === 'locked') return !isUnlocked;
      if (badgeFilter === 'battle') return b.category?.toLowerCase() === 'battle';
      if (badgeFilter === 'quiz') return b.category?.toLowerCase() !== 'battle';
      return true; // 'all'
    });
  }, [badges, badgeFilter, unlockedBadgeIds]);

  // Filtered activities
  const filteredActivities = useMemo(() => {
    if (activityFilter === 'battle') return activityLog.filter(a => a.type === 'battle');
    if (activityFilter === 'quiz') return activityLog.filter(a => a.type === 'quiz');
    return activityLog;
  }, [activityLog, activityFilter]);

  const fullName = (profileData?.firstName || profileData?.lastName)
    ? `${profileData?.firstName || ''} ${profileData?.lastName || ''}`.trim()
    : (profileData?.username || user?.username || 'Quiz Master');

  const avatarSrc = profileData?.avatar || user?.avatar || null;

  // ─── 4 Main Navigation Items ──────────────────────────────────────────────
  const navSections = [
    {
      id: 'badges',
      label: 'Badges & Trophies',
      subtitle: `${unlockedCount} of ${badges.length} Unlocked (${badgeCompletionPercent}%)`,
      icon: Trophy,
      badgeText: `${unlockedCount}/${badges.length}`,
      color: 'amber',
      accentGlow: 'from-amber-500/20 to-yellow-500/5',
      borderColor: 'border-amber-500/40',
      activeColor: 'text-amber-400',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    },
    {
      id: 'profile',
      label: 'Profile Details',
      subtitle: 'Personal info, bio & credentials',
      icon: User,
      badgeText: 'Active',
      color: 'indigo',
      accentGlow: 'from-indigo-500/20 to-purple-500/5',
      borderColor: 'border-indigo-500/40',
      activeColor: 'text-indigo-400',
      badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    },
    {
      id: 'security',
      label: 'Security & Password',
      subtitle: 'Protection & access credentials',
      icon: ShieldCheck,
      badgeText: 'Protected',
      color: 'emerald',
      accentGlow: 'from-emerald-500/20 to-teal-500/5',
      borderColor: 'border-emerald-500/40',
      activeColor: 'text-emerald-400',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    },
    {
      id: 'activity',
      label: 'Recent Battles & Quizzes',
      subtitle: 'Match performance & battle logs',
      icon: Swords,
      badgeText: `${activityLog.length || 'Live'}`,
      color: 'rose',
      accentGlow: 'from-rose-500/20 to-pink-500/5',
      borderColor: 'border-rose-500/40',
      activeColor: 'text-rose-400',
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* ─── Hero Header & Banner (Sleek Cyber Arena, No Heavy Purple) ─────────── */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden shadow-2xl border border-cyan-500/20 bg-gradient-to-b from-slate-900 to-slate-950"
      >
        {/* Sleek Dark Tech Cover Banner */}
        <div className="h-44 md:h-48 relative overflow-hidden bg-[#0a0f1d] border-b border-white/10">
          {/* Cyber Isometric Grid Background Texture */}
          <div 
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(6, 182, 212, 0.15) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(6, 182, 212, 0.15) 1px, transparent 1px)
              `,
              backgroundSize: '28px 28px'
            }}
          />

          {/* Deep Carbon Radial Shadows & Lighting */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-950/40 via-slate-900/80 to-slate-950/90" />
          <div className="absolute -top-16 -left-16 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -top-10 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Abstract Cyber Constellation / Circuit SVG */}
          <div className="absolute inset-0 flex items-center justify-end pr-10 pointer-events-none opacity-25">
            <svg width="460" height="190" viewBox="0 0 460 190" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M40 95 L140 95 L180 50 L260 50 L300 95 L420 95" stroke="url(#tech_line)" strokeWidth="1.5" strokeDasharray="4 4" />
              <path d="M90 140 L160 140 L210 95 L320 95 L360 140 L440 140" stroke="rgba(6, 182, 212, 0.4)" strokeWidth="1.2" />
              <circle cx="180" cy="50" r="5" fill="#06B6D4" />
              <circle cx="260" cy="50" r="4" fill="#3B82F6" />
              <circle cx="210" cy="95" r="5" fill="#F59E0B" />
              <circle cx="300" cy="95" r="6" stroke="#06B6D4" strokeWidth="2" fill="#0A0F1D" />
              <circle cx="360" cy="140" r="4" fill="#06B6D4" />
              <defs>
                <linearGradient id="tech_line" x1="40" y1="95" x2="420" y2="95" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#06B6D4" />
                  <stop offset="0.5" stopColor="#3B82F6" />
                  <stop offset="1" stopColor="#F59E0B" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Season / Scholar Badge Pill at Top Left */}
          <div className="absolute top-4 left-6 md:left-8 flex items-center gap-2 z-10">
            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 backdrop-blur-md flex items-center gap-1.5 shadow-sm">
              <Sparkles size={12} className="text-cyan-400" />
              AI Scholar Arena • Season 1
            </span>
          </div>

          {/* Top Quick Actions at Top Right */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <button
              onClick={handleOpenAvatarModal}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 text-white backdrop-blur-md border border-white/20 transition-all shadow-md active:scale-95"
            >
              <Camera size={14} className="text-cyan-300" />
              <span>Change Photo</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('profile');
                setIsEditing(true);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white backdrop-blur-md border border-cyan-400/30 transition-all shadow-md active:scale-95"
            >
              <Edit2 size={14} />
              <span>Edit Profile</span>
            </button>
          </div>
        </div>

        {/* Profile Identity Bar */}
        <div className="px-6 md:px-8 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 -mt-16 sm:-mt-20">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
              <div className="relative group cursor-pointer" onClick={handleOpenAvatarModal}>
                <div className="relative w-32 h-32 md:w-36 md:h-36 rounded-full p-1.5 bg-gradient-to-tr from-cyan-400 via-blue-500 to-amber-400 shadow-2xl shadow-cyan-500/25 ring-4 ring-slate-950">
                  <Avatar
                    name={fullName}
                    src={avatarSrc}
                    size="7xl"
                    className="w-full h-full rounded-full object-cover border-2 border-slate-900 bg-slate-800"
                  />
                  <div className="absolute inset-1.5 rounded-full bg-black/60 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs">
                    <Camera size={26} className="text-cyan-400 mb-1" />
                    <span className="text-[11px] font-bold tracking-wide">Change</span>
                  </div>
                </div>

                <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs px-2.5 py-1 rounded-full shadow-lg border-2 border-slate-950 flex items-center gap-1">
                  <Trophy size={12} className="text-slate-950 fill-current" />
                  <span>Lvl {currentLevel}</span>
                </div>
              </div>

              <div className="text-center sm:text-left space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                    {fullName}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                    Level {currentLevel} Scholar
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 shadow-sm">
                    <Award size={11} className="text-cyan-300" />
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
                  <span className="text-cyan-400 font-semibold">@{profileData?.username || user?.username}</span>
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

            <div className="hidden lg:flex flex-col items-end justify-center bg-slate-900/80 border border-white/10 rounded-2xl px-5 py-3 backdrop-blur-md">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Total Knowledge Points</span>
              <span className="text-3xl font-black bg-gradient-to-r from-cyan-400 via-blue-300 to-amber-300 bg-clip-text text-transparent">
                {totalXP.toLocaleString()} XP
              </span>
              <span className="text-xs text-cyan-400 font-semibold mt-0.5">
                {levelInfo.xpNeeded.toLocaleString()} XP to Level {currentLevel + 1}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── 4-Stat Metric Cards ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          {
            icon: Trophy,
            label: 'Global Rank',
            value: `#${currentRank}`,
            subtext: 'Global Leaderboard',
            textColor: 'text-amber-400',
            bgColor: 'bg-amber-500/15',
            borderColor: 'border-amber-500/30'
          },
          {
            icon: Zap,
            label: 'Total XP',
            value: totalXP.toLocaleString(),
            subtext: `${levelInfo.progressPercent}% into Level ${currentLevel}`,
            textColor: 'text-indigo-400',
            bgColor: 'bg-indigo-500/15',
            borderColor: 'border-indigo-500/30'
          },
          {
            icon: BookOpen,
            label: 'Quizzes Taken',
            value: quizzesCompleted,
            subtext: `Avg Accuracy ${avgScore}%`,
            textColor: 'text-emerald-400',
            bgColor: 'bg-emerald-500/15',
            borderColor: 'border-emerald-500/30'
          },
          {
            icon: Swords,
            label: 'Battles Won',
            value: battlesWon,
            subtext: winStreak > 0 ? `${winStreak} Streak 🔥` : 'Ready to clash',
            textColor: 'text-rose-400',
            bgColor: 'bg-rose-500/15',
            borderColor: 'border-rose-500/30'
          },
        ].map((stat) => (
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

      {/* ─── NEW STRUCTURE: 2-Column Command Hub ─────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ─── LEFT COLUMN: Navigation Console Dock ─────────────────────────────── */}
        <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-3 backdrop-blur-xl shadow-xl space-y-2">
            <div className="px-3 pt-2 pb-1">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                Scholar Console
              </p>
            </div>

            {/* 4 Interactive Navigation Cards */}
            {navSections.map((nav) => {
              const isActive = activeTab === nav.id;
              return (
                <button
                  key={nav.id}
                  onClick={() => {
                    setActiveTab(nav.id);
                    if (nav.id === 'activity') fetchActivityLog();
                  }}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 relative overflow-hidden group ${
                    isActive
                      ? `bg-gradient-to-r ${nav.accentGlow} ${nav.borderColor} shadow-xl shadow-indigo-500/10 ring-1 ring-white/10`
                      : 'bg-slate-800/40 border-white/5 hover:bg-slate-800/80 hover:border-white/10'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-indigo-400 via-purple-400 to-amber-400 rounded-r-full" />
                  )}

                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md transition-transform group-hover:scale-105 ${
                        isActive
                          ? 'bg-slate-800 border border-white/20 text-white'
                          : 'bg-slate-800/60 border border-white/5 text-slate-400 group-hover:text-slate-200'
                      }`}
                    >
                      <nav.icon size={20} className={isActive ? nav.activeColor : ''} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`font-bold text-sm truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>
                          {nav.label}
                        </span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${nav.badgeClass}`}>
                          {nav.badgeText}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 truncate font-medium">
                        {nav.subtitle}
                      </p>
                    </div>

                    <ChevronRight
                      size={16}
                      className={`transition-all duration-200 flex-shrink-0 ${
                        isActive ? `${nav.activeColor} translate-x-1` : 'text-slate-600 group-hover:text-slate-400'
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Trophy Spotlight Card on Sidebar */}
          <div className="bg-gradient-to-br from-amber-500/15 via-slate-900 to-indigo-950/40 border border-amber-500/30 rounded-3xl p-5 shadow-xl relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                <Crown size={12} className="text-amber-400 fill-amber-400" />
                Featured Trophy
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {featuredBadge?.rarity || 'RARE'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/30 to-yellow-400/20 border border-amber-400/50 flex items-center justify-center text-2xl shadow-md">
                {featuredBadge?.icon || '🏆'}
              </div>
              <div>
                <p className="text-sm font-bold text-white">{featuredBadge?.name || 'Grand Champion'}</p>
                <p className="text-xs text-slate-400 line-clamp-1">{featuredBadge?.description || 'Earned via live battles'}</p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-400">Total Unlocked:</span>
              <span className="font-bold text-amber-300">{unlockedCount} / {badges.length} Badges</span>
            </div>
          </div>
        </div>

        {/* ─── RIGHT COLUMN: Main Interactive Canvas Stage ──────────────────────── */}
        <div className="flex-1 min-w-0 w-full">
          <AnimatePresence mode="wait">
            {/* ─── 1. Badges & Trophies Showcase ─────────────────────────────────── */}
            {activeTab === 'badges' && (
              <motion.div
                key="badges"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {/* Showcase Banner with Completion Bar & Filter Chips */}
                <div className="rounded-3xl p-6 bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-xl relative overflow-hidden">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 font-black text-2xl shadow-lg shadow-amber-500/20">
                        🏆
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          Achievements & Trophies
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {unlockedCount} of {badges.length} Unlocked
                          </span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Conquer quizzes and multiplayer arena matches to collect all platform honors.
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-2xl font-black text-amber-400">{badgeCompletionPercent}%</span>
                      <p className="text-xs text-slate-400 font-medium">Trophy Mastery</p>
                    </div>
                  </div>

                  {/* Mastery Progress Bar */}
                  <div className="relative w-full h-2.5 bg-slate-800 rounded-full overflow-hidden mb-5 border border-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${badgeCompletionPercent}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-indigo-500 rounded-full"
                    />
                  </div>

                  {/* Filter Chips Bar */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                    <span className="text-xs text-slate-400 font-bold mr-1">Filter:</span>
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
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                            : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/5'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Badges Grid with Rarity Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredBadges.map((badge) => {
                    const isUnlocked = badge.is_unlocked || unlockedBadgeIds.has(badge.id);
                    const rarityStyle = RARITY_CONFIG[badge.rarity] || RARITY_CONFIG.RARE;

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
                          {/* Top Row: Rarity Tag & Unlock Status */}
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

                          {/* Badge Icon & Name */}
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
                              <p className="text-xs text-indigo-300/80 font-medium capitalize mt-0.5">
                                {badge.category ? `${badge.category} Category` : 'Platform Award'}
                              </p>
                            </div>
                          </div>

                          <p className="text-xs text-slate-400 line-clamp-2 mt-2">
                            {badge.description}
                          </p>
                        </div>

                        {/* Footer: Requirements */}
                        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Goal:</span>
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

            {/* ─── 2. Profile Details ────────────────────────────────────────────── */}
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-xl">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                    <div>
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <User size={20} className="text-indigo-400" />
                        Scholar Profile & Bio
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">Manage your display credentials, identity, and bio narrative.</p>
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
                          Bio / Scholar Tagline (Max 200 characters)
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Identity Bento Box */}
                      <div className="p-5 rounded-2xl bg-slate-800/40 border border-white/5 space-y-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">Account Identity</span>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-xs text-slate-500 block">Full Name</span>
                            <span className="text-base font-bold text-white">{fullName}</span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500 block">Username</span>
                            <span className="font-semibold text-indigo-300">@{profileData?.username || user?.username}</span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500 block">Primary Email</span>
                            <span className="font-medium text-slate-300">{profileData?.email || user?.email}</span>
                          </div>
                        </div>
                      </div>

                      {/* Bio & Scholar Statement Bento Box */}
                      <div className="p-5 rounded-2xl bg-slate-800/40 border border-white/5 flex flex-col justify-between space-y-3">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Scholar Creed / Bio</span>
                          <p className="text-sm text-slate-300 italic mt-2 leading-relaxed">
                            "{profileData?.bio || 'Lifelong learner mastering quizzes and battles with AI.'}"
                          </p>
                        </div>
                        <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                          <span>Joined: {profileData?.created_at ? new Date(profileData.created_at).toLocaleDateString() : '2026'}</span>
                          <span className="font-semibold text-emerald-400">Verified Scholar</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ─── 3. Security & Password ────────────────────────────────────────── */}
            {activeTab === 'security' && (
              <motion.div
                key="security"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-xl">
                  {/* Security Header Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-slate-800 to-indigo-950/30 border border-emerald-500/30 mb-6">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                        <ShieldCheck size={26} />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">Account Security Active</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Your sessions and passwords are encrypted and securely authenticated.</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 self-start sm:self-auto">
                      Status: Protected
                    </span>
                  </div>

                  {isChangingPassword ? (
                    <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-5 max-w-xl">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                          Current Password
                        </label>
                        <div className="relative">
                          <Input
                            type={showCurrentPass ? 'text' : 'password'}
                            {...registerPassword('currentPassword')}
                            error={passwordErrors.currentPassword?.message}
                            placeholder="Enter current password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPass(!showCurrentPass)}
                            className="absolute right-3.5 top-3 text-slate-400 hover:text-white"
                          >
                            {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                          New Password
                        </label>
                        <div className="relative">
                          <Input
                            type={showNewPass ? 'text' : 'password'}
                            {...registerPassword('newPassword')}
                            error={passwordErrors.newPassword?.message}
                            placeholder="Enter new password (min. 6 characters)"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPass(!showNewPass)}
                            className="absolute right-3.5 top-3 text-slate-400 hover:text-white"
                          >
                            {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                          Confirm New Password
                        </label>
                        <div className="relative">
                          <Input
                            type={showConfirmPass ? 'text' : 'password'}
                            {...registerPassword('confirmPassword')}
                            error={passwordErrors.confirmPassword?.message}
                            placeholder="Re-enter new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPass(!showConfirmPass)}
                            className="absolute right-3.5 top-3 text-slate-400 hover:text-white"
                          >
                            {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
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
                    <div className="text-center py-8 bg-slate-800/40 rounded-2xl border border-white/5">
                      <div className="w-16 h-16 rounded-3xl bg-slate-800 text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-inner">
                        <KeyRound size={28} />
                      </div>
                      <h4 className="text-lg font-bold text-white">Need to update your password?</h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-6">
                        Keep your QuizMaster AI account safe by maintaining a unique password.
                      </p>
                      <Button
                        variant="primary"
                        onClick={() => setIsChangingPassword(true)}
                        leftIcon={<KeyRound size={16} />}
                      >
                        Change Password
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ─── 4. Recent Battles & Quizzes ───────────────────────────────────── */}
            {activeTab === 'activity' && (
              <motion.div
                key="activity"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="rounded-3xl p-6 bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-white/10">
                    <div>
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <History size={20} className="text-rose-400" />
                        Match & Quiz Timeline
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">Comprehensive audit log of recent quiz assessments and 1v1 battles.</p>
                    </div>

                    {/* Filter and Refresh */}
                    <div className="flex items-center gap-2">
                      <div className="flex bg-slate-800/80 p-1 rounded-xl border border-white/5 text-xs font-bold">
                        <button
                          onClick={() => setActivityFilter('all')}
                          className={`px-3 py-1 rounded-lg transition-all ${activityFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                        >
                          All
                        </button>
                        <button
                          onClick={() => setActivityFilter('battle')}
                          className={`px-3 py-1 rounded-lg transition-all ${activityFilter === 'battle' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                        >
                          Battles
                        </button>
                        <button
                          onClick={() => setActivityFilter('quiz')}
                          className={`px-3 py-1 rounded-lg transition-all ${activityFilter === 'quiz' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                        >
                          Quizzes
                        </button>
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
                  </div>

                  {filteredActivities.length > 0 ? (
                    <div className="space-y-3">
                      {filteredActivities.map((act, index) => (
                        <div
                          key={act.id || index}
                          className="p-4 rounded-2xl bg-slate-800/40 border border-white/5 hover:border-indigo-500/30 transition-all flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3.5">
                            <div
                              className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-md flex-shrink-0 ${
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
                                <span className="capitalize font-semibold text-slate-300">
                                  {act.type === 'quiz' ? 'Solo Quiz Practice' : '1v1 Live Clash'}
                                </span>
                                <span>•</span>
                                <span className="text-amber-400 font-bold">{act.score}</span>
                              </div>
                            </div>
                          </div>

                          <span className="text-xs text-slate-500 font-medium">
                            {act.date ? new Date(act.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <History size={36} className="text-slate-600 mx-auto mb-3" />
                      <h4 className="text-base font-bold text-white">No Activities Logged Yet</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Take a quiz from a PDF or challenge an opponent in the battle lobby to start seeing your performance record here!
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

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

              <div className="p-6">
                {avatarTab === 'upload' ? (
                  <div className="space-y-4">
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
