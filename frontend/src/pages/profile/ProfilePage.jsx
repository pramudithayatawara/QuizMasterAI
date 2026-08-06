import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Mail, Lock, Save, Camera, Trophy, Zap, 
  BookOpen, Swords, History, Shield, Settings, 
  Edit2, X, ChevronRight, Calendar, Award, Upload, Trash2 
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

const profileSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName:  z.string().min(2, 'Last name must be at least 2 characters'),
  email:     z.string().email('Invalid email address'),
  bio:       z.string().max(200, 'Bio cannot exceed 200 characters').optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Must contain uppercase, lowercase, and number'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

/**
 * @page ProfilePage
 * @description Modern, gamified user profile management page.
 */
const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [stats, setStats] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  
  const fileInputRef = useRef(null);
  const avatarMenuRef = useRef(null);

  // Profile form
  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
    reset: resetProfile,
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName:  user?.lastName  || '',
      email:     user?.email     || '',
      bio:       user?.bio       || '',
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

  // Close avatar menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target)) {
        setShowAvatarMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch profile data on mount
  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    setIsLoading(true);
    try {
      const response = await userAPI.getProfile();
      setProfileData(response.data.data.user);
      setStats(response.data.data.stats);
      
      // Update form with fetched data
      resetProfile({
        firstName: response.data.data.user.firstName,
        lastName: response.data.data.user.lastName,
        email: response.data.data.user.email,
        bio: response.data.data.user.bio || '',
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch profile data.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActivityLog = async () => {
    try {
      const response = await userAPI.getActivityLog();
      setActivityLog(response.data.data.activities);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch activity log.');
    }
  };

  const onProfileSubmit = async (data) => {
    setIsSaving(true);
    try {
      const response = await userAPI.updateProfile(data);
      updateUser(response.data.data.user);
      setProfileData(response.data.data.user);
      toast.success('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile.');
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
      toast.error(error.response?.data?.message || 'Failed to change password.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditCancel = () => {
    resetProfile();
    setIsEditing(false);
  };

  const handlePasswordCancel = () => {
    resetPassword();
    setIsChangingPassword(false);
  };

  const handleAvatarClick = () => {
    setShowAvatarMenu(!showAvatarMenu);
  };

  const handleUploadClick = () => {
    setShowAvatarMenu(false);
    fileInputRef.current?.click();
  };

  const handleRemoveClick = async () => {
    setShowAvatarMenu(false);
    try {
      const response = await userAPI.removeAvatar();
      if (response.data.data.user) {
        updateUser(response.data.data.user);
        setProfileData(response.data.data.user);
      } else {
        // If backend doesn't return user, update locally
        updateUser({ avatar: null });
        setProfileData(prev => ({ ...prev, avatar: null }));
      }
      toast.success('Profile photo removed successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove profile photo.');
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const response = await userAPI.uploadAvatar(file);
      if (response.data.data.user) {
        updateUser(response.data.data.user);
        setProfileData(response.data.data.user);
      } else {
        // If backend doesn't return user, update locally
        updateUser({ avatar: response.data.data.avatar });
        setProfileData(prev => ({ ...prev, avatar: response.data.data.avatar }));
      }
      toast.success('Profile photo updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload profile photo.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'activity') {
      fetchActivityLog();
    }
  };

  // Calculate XP progress
  const totalXP = stats?.totalXP || 0;
  const currentLevel = stats?.level || 1;
  const xpForCurrentLevel = (currentLevel - 1) * 1000;
  const xpForNextLevel = currentLevel * 1000;
  const xpProgress = ((totalXP - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100;
  const xpToNextLevel = xpForNextLevel - totalXP;

  const tabs = [
    { id: 'profile', label: 'Profile Info', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'activity', label: 'Activity Log', icon: History },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ─── Header & Cover Banner ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        {/* Cover Banner */}
        <div className="h-48 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 rounded-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpIi8+PC9zdmc+')] opacity-10" />
        </div>

        {/* Avatar Section */}
        <div className="absolute -bottom-16 left-8">
          <div className="relative" ref={avatarMenuRef}>
            <div 
              className="relative group cursor-pointer"
              onClick={handleAvatarClick}
            >
              {profileData?.avatar ? (
                <img
                  src={profileData.avatar}
                  alt={`${profileData?.firstName} ${profileData?.lastName}`}
                  className="w-28 h-28 rounded-full border-4 border-slate-900 shadow-xl object-cover"
                />
              ) : (
                <Avatar
                  name={`${profileData?.firstName} ${profileData?.lastName}`}
                  size="7xl"
                  className="border-4 border-slate-900 shadow-xl"
                />
              )}
              {/* Camera/Edit Overlay */}
              <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {isUploadingAvatar ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Camera className="w-8 h-8 text-white" />
                )}
              </div>
            </div>

            {/* Avatar Menu */}
            <AnimatePresence>
              {showAvatarMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className={`absolute top-32 left-0 ${isDark ? 'bg-slate-800 border-white/10' : 'bg-white border-light-300'} rounded-xl shadow-2xl overflow-hidden min-w-[200px] z-50`}
                >
                  <button
                    onClick={handleUploadClick}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-700/50 transition-colors text-left"
                  >
                    <Upload className="w-4 h-4 text-indigo-400" />
                    <span className="text-white text-sm">Upload Photo</span>
                  </button>
                  {profileData?.avatar && (
                    <button
                      onClick={handleRemoveClick}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-700/50 transition-colors text-left border-t border-white/10"
                    >
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      <span className="text-white text-sm">Remove Photo</span>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* User Info */}
        <div className="ml-36 mt-4">
          <div className="flex items-center gap-3">
            <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-light-900'}`}>
              {profileData?.firstName} {profileData?.lastName}
            </h1>
            <button
              onClick={() => setIsEditing(true)}
              className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-light-600 hover:text-light-900 hover:bg-light-200'} transition-colors`}
            >
              <Edit2 size={18} />
            </button>
          </div>
          <p className={isDark ? 'text-slate-400' : 'text-light-600'}>{profileData?.email}</p>
        </div>
      </motion.div>

      {/* ─── Level Progress Bar ──────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`${isDark ? 'bg-slate-800/50 border-white/10' : 'bg-white/50 border-light-300'} backdrop-blur-sm rounded-2xl p-6`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
              <Trophy className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className={`font-semibold ${isDark ? 'text-white' : 'text-light-900'}`}>Level {currentLevel}</p>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-light-600'}`}>{xpToNextLevel} XP to next level</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-indigo-400">{totalXP}</p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-light-600'}`}>Total XP</p>
          </div>
        </div>
        <div className={`h-3 ${isDark ? 'bg-slate-700' : 'bg-light-300'} rounded-full overflow-hidden`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${xpProgress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
          />
        </div>
      </motion.div>

      {/* ─── Stat Cards Grid ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {[
          { icon: Trophy, label: 'Level', value: currentLevel, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
          { icon: Zap, label: 'Total XP', value: totalXP, color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
          { icon: BookOpen, label: 'Quizzes', value: stats?.quizzesCompleted || 0, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
          { icon: Swords, label: 'Battles Won', value: stats?.battlesWon || 0, color: 'text-rose-400', bg: 'bg-rose-500/20' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + index * 0.1 }}
            whileHover={{ scale: 1.05 }}
            className={`${isDark ? 'bg-slate-800/40 border-white/10 hover:bg-slate-800/60' : 'bg-white/40 border-light-300 hover:bg-white/60'} backdrop-blur-md rounded-2xl p-6 transition-all cursor-pointer`}
          >
            <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-light-900'}`}>{stat.value}</p>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-light-600'}`}>{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* ─── Tabbed Forms Section ──────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          {/* Tabs */}
          <div className={`flex gap-2 ${isDark ? 'border-white/10' : 'border-light-300'} border-b pb-4 mb-6`}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : `${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' : 'text-light-600 hover:text-light-900 hover:bg-light-200'}`
                }`}
              >
                <tab.icon size={18} />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {isEditing ? (
                  <form onSubmit={handleProfileSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-light-700'} mb-2`}>First Name</label>
                        <Input
                          {...registerProfile('firstName')}
                          error={profileErrors.firstName?.message}
                          placeholder="Enter your first name"
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-light-700'} mb-2`}>Last Name</label>
                        <Input
                          {...registerProfile('lastName')}
                          error={profileErrors.lastName?.message}
                          placeholder="Enter your last name"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-light-700'} mb-2`}>Email</label>
                      <Input
                        {...registerProfile('email')}
                        error={profileErrors.email?.message}
                        placeholder="Enter your email"
                        disabled
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-light-700'} mb-2`}>Bio</label>
                      <textarea
                        {...registerProfile('bio')}
                        placeholder="Tell us about yourself (max 200 characters)"
                        rows={4}
                        className={`w-full ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-light-300 text-light-900 placeholder-light-500'} rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none`}
                      />
                      {profileErrors.bio?.message && (
                        <p className="text-red-400 text-sm mt-1">{profileErrors.bio.message}</p>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <Button
                        type="submit"
                        variant="primary"
                        isLoading={isSaving}
                        leftIcon={<Save size={18} />}
                      >
                        Save Changes
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleEditCancel}
                        leftIcon={<X size={18} />}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-light-600'} mb-1`}>First Name</p>
                        <p className={`font-medium ${isDark ? 'text-white' : 'text-light-900'}`}>{profileData?.firstName}</p>
                      </div>
                      <div>
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-light-600'} mb-1`}>Last Name</p>
                        <p className={`font-medium ${isDark ? 'text-white' : 'text-light-900'}`}>{profileData?.lastName}</p>
                      </div>
                    </div>
                    <div>
                      <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-light-600'} mb-1`}>Email</p>
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-light-900'}`}>{profileData?.email}</p>
                    </div>
                    {profileData?.bio && (
                      <div>
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-light-600'} mb-1`}>Bio</p>
                        <p className={`font-medium ${isDark ? 'text-white' : 'text-light-900'}`}>{profileData.bio}</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'security' && (
              <motion.div
                key="security"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {isChangingPassword ? (
                  <form onSubmit={handlePasswordSubmit} className="space-y-6">
                    <div>
                      <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-light-700'} mb-2`}>Current Password</label>
                      <Input
                        type="password"
                        {...registerPassword('currentPassword')}
                        error={passwordErrors.currentPassword?.message}
                        placeholder="Enter your current password"
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-light-700'} mb-2`}>New Password</label>
                      <Input
                        type="password"
                        {...registerPassword('newPassword')}
                        error={passwordErrors.newPassword?.message}
                        placeholder="Enter your new password"
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-light-700'} mb-2`}>Confirm New Password</label>
                      <Input
                        type="password"
                        {...registerPassword('confirmPassword')}
                        error={passwordErrors.confirmPassword?.message}
                        placeholder="Confirm your new password"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        type="submit"
                        variant="primary"
                        isLoading={isSaving}
                        leftIcon={<Save size={18} />}
                      >
                        Change Password
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handlePasswordCancel}
                        leftIcon={<X size={18} />}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="text-center py-8">
                    <div className={`w-16 h-16 ${isDark ? 'bg-slate-800' : 'bg-light-200'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                      <Lock className={`w-8 h-8 ${isDark ? 'text-slate-400' : 'text-light-600'}`} />
                    </div>
                    <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-light-900'} mb-2`}>Change Password</h3>
                    <p className={isDark ? 'text-slate-400' : 'text-light-600'}>Update your password to keep your account secure</p>
                    <Button
                      variant="primary"
                      onClick={() => setIsChangingPassword(true)}
                      leftIcon={<Shield size={18} />}
                    >
                      Change Password
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'activity' && (
              <motion.div
                key="activity"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="space-y-4">
                  {activityLog.length > 0 ? (
                    activityLog.map((activity, index) => (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`flex items-center gap-4 p-4 ${isDark ? 'bg-slate-800/30 border-white/10 hover:bg-slate-800/50' : 'bg-white/30 border-light-300 hover:bg-white/50'} rounded-xl transition-all`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          activity.type === 'quiz' ? 'bg-emerald-500/20' : 'bg-rose-500/20'
                        }`}>
                          {activity.type === 'quiz' ? (
                            <BookOpen className="w-6 h-6 text-emerald-400" />
                          ) : (
                            <Swords className="w-6 h-6 text-rose-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className={`font-medium ${isDark ? 'text-white' : 'text-light-900'}`}>{activity.title}</h4>
                          <p className={`${isDark ? 'text-slate-400' : 'text-light-600'} text-sm mt-1`}>
                            {activity.type === 'quiz' ? 'Quiz Completed' : 'Battle Finished'} • Score: {activity.score}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`${isDark ? 'text-slate-400' : 'text-light-600'} text-sm`}>
                            {new Date(activity.date).toLocaleDateString()}
                          </p>
                          <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-600' : 'text-light-400'} mt-1`} />
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <History className={`w-16 h-16 ${isDark ? 'text-slate-600' : 'text-light-400'} mx-auto mb-4`} />
                      <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-light-900'} mb-2`}>No Recent Activity</h3>
                      <p className={isDark ? 'text-slate-400' : 'text-light-600'}>Start taking quizzes or battles to see your activity here</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </div>
  );
};

export default ProfilePage;
