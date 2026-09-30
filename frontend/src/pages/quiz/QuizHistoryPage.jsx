import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, Clock, Target, Trophy,
  Award, BarChart3, Calendar, Zap,
  Brain, ArrowUp, ArrowDown, RefreshCw,
  PlusCircle, Play, ChevronRight, CheckCircle2,
  Sparkles
} from 'lucide-react';
import { quizAPI } from '../../api/quiz.api.js';
import { ROUTES } from '../../constants/routes.js';
import Card from '../../components/common/Card.jsx';
import ProgressBar from '../../components/common/ProgressBar.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import AdaptiveBadge from '../../components/quiz/AdaptiveBadge.jsx';
import Button from '../../components/common/Button.jsx';
import { formatRelativeTime, formatScore, formatDuration } from '../../utils/formatters.js';
import toast from 'react-hot-toast';

/**
 * @page QuizHistoryPage
 * @description Iconic performance history and adaptive AI analytics page
 */
const QuizHistoryPage = () => {
  const [performanceStats, setPerformanceStats] = useState(null);
  const [adaptiveRecommendation, setAdaptiveRecommendation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();

  const fetchData = async (showToast = false) => {
    try {
      if (showToast) setIsRefreshing(true);
      const [statsRes, adaptiveRes] = await Promise.all([
        quizAPI.getPerformanceStats(),
        quizAPI.getRecommendedDifficulty(),
      ]);

      const statsData = statsRes?.data?.data || statsRes?.data || {};
      const adaptiveData = adaptiveRes?.data?.data || adaptiveRes?.data || null;

      setPerformanceStats({
        totalAttempts: statsData.totalAttempts ?? 0,
        averageScore: statsData.averageScore ?? 0,
        highestScore: statsData.highestScore ?? 0,
        lowestScore: statsData.lowestScore ?? 0,
        accuracy: statsData.accuracy ?? (statsData.averageScore ?? 0),
        totalAnswers: statsData.totalAnswers ?? 0,
        correctAnswers: statsData.correctAnswers ?? 0,
        difficultyDistribution: statsData.difficultyDistribution || { easy: 0, medium: 0, hard: 0 },
        recentAttempts: statsData.recentAttempts || [],
      });

      setAdaptiveRecommendation(adaptiveData);
      if (showToast) toast.success('Analytics refreshed!');
    } catch (error) {
      console.error('Failed to fetch performance data:', error);
      toast.error('Failed to load performance data');
      // Set safe default state to prevent empty screen
      setPerformanceStats({
        totalAttempts: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        accuracy: 0,
        totalAnswers: 0,
        correctAnswers: 0,
        difficultyDistribution: { easy: 0, medium: 0, hard: 0 },
        recentAttempts: [],
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Spinner size="xl" />
        <p className="text-dark-400 text-sm animate-pulse">Calculating AI learning analytics...</p>
      </div>
    );
  }

  const getDifficultyColor = (difficulty) => {
    const colors = {
      easy: 'text-emerald-400',
      medium: 'text-blue-400',
      hard: 'text-purple-400',
    };
    return colors[difficulty] || 'text-gray-400';
  };

  const getDifficultyBg = (difficulty) => {
    const colors = {
      easy: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
      medium: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
      hard: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
    };
    return colors[difficulty] || 'bg-gray-500/10 border-gray-500/30 text-gray-300';
  };

  const totalAttempts = performanceStats?.totalAttempts || 0;
  const dist = performanceStats?.difficultyDistribution || { easy: 0, medium: 0, hard: 0 };
  const easyPct = totalAttempts > 0 ? Math.round((dist.easy / totalAttempts) * 100) : 0;
  const medPct = totalAttempts > 0 ? Math.round((dist.medium / totalAttempts) * 100) : 0;
  const hardPct = totalAttempts > 0 ? Math.round((dist.hard / totalAttempts) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-800 pb-6"
      >
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <TrendingUp size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Performance Analytics</h1>
              <p className="text-dark-400 text-sm mt-0.5">Track your learning velocity, adaptive engine stats, and score history</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white border border-dark-700 text-sm transition-all"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <Link
            to={ROUTES.QUIZ_AI_GENERATE}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white font-medium text-sm shadow-lg shadow-primary-500/25 transition-all"
          >
            <PlusCircle size={16} />
            <span>New AI Quiz</span>
          </Link>
        </div>
      </motion.div>

      {/* ─── Adaptive AI Status Banner ─────────────────────────────────────── */}
      {adaptiveRecommendation && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950/60 via-indigo-950/40 to-dark-900 border border-purple-500/30 p-6 shadow-xl backdrop-blur-md">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={24} className="text-purple-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Adaptive AI Engine
                    </span>
                    <span className="text-xs text-dark-400">Personalized Difficulty Recommendation</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    {adaptiveRecommendation.adjustmentReason || 'AI has evaluated your performance.'}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <span className="text-xs text-dark-400 block">Recommended Level</span>
                  <span className="text-base font-bold text-white capitalize">
                    {adaptiveRecommendation.recommendedDifficulty || 'Medium'}
                  </span>
                </div>
                <Link
                  to={ROUTES.QUIZ_AI_GENERATE}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-all shadow-md shadow-purple-600/30 flex items-center gap-2"
                >
                  <Play size={15} />
                  <span>Practice {adaptiveRecommendation.recommendedDifficulty || 'Recommended'}</span>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Performance Stats Grid ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <Card padding="md" hover className="border-dark-700/60 bg-dark-900/60 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-primary-500/15 rounded-xl flex items-center justify-center">
              <Brain size={20} className="text-primary-400" />
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary-500/10 text-primary-300 border border-primary-500/20">
              Completed
            </span>
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">{performanceStats.totalAttempts}</p>
          <p className="text-xs text-dark-400 mt-1">Total Quizzes Practiced</p>
        </Card>

        <Card padding="md" hover className="border-dark-700/60 bg-dark-900/60 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center">
              <Target size={20} className="text-blue-400" />
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
              Accuracy
            </span>
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">{performanceStats.averageScore}%</p>
          <p className="text-xs text-dark-400 mt-1">Average Quiz Score</p>
        </Card>

        <Card padding="md" hover className="border-dark-700/60 bg-dark-900/60 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-amber-500/15 rounded-xl flex items-center justify-center">
              <Trophy size={20} className="text-amber-400" />
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Personal Best
            </span>
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">{performanceStats.highestScore}%</p>
          <p className="text-xs text-dark-400 mt-1">Highest Score Achieved</p>
        </Card>

        <Card padding="md" hover className="border-dark-700/60 bg-dark-900/60 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center">
              <CheckCircle2 size={20} className="text-emerald-400" />
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              Answers
            </span>
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">{performanceStats.correctAnswers}</p>
          <p className="text-xs text-dark-400 mt-1">Correct Answers Given</p>
        </Card>
      </motion.div>

      {/* ─── Difficulty Distribution ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card padding="lg" className="border-dark-700/60 bg-dark-900/60 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-purple-500/15 text-purple-400">
                <BarChart3 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Difficulty Breakdown</h3>
                <p className="text-xs text-dark-400">Distribution of challenges completed across difficulty tiers</p>
              </div>
            </div>
            <span className="text-xs text-dark-400 font-medium">
              {totalAttempts} Total Attempt{totalAttempts === 1 ? '' : 's'}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className={`p-4 rounded-xl border ${getDifficultyBg('easy')}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-emerald-300">Easy Tier</span>
                <Brain size={18} className="text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-white">{dist.easy || 0}</p>
              <p className="text-xs text-dark-400 mt-1">{easyPct}% of completed quizzes</p>
            </div>

            <div className={`p-4 rounded-xl border ${getDifficultyBg('medium')}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-blue-300">Medium Tier</span>
                <Target size={18} className="text-blue-400" />
              </div>
              <p className="text-2xl font-bold text-white">{dist.medium || 0}</p>
              <p className="text-xs text-dark-400 mt-1">{medPct}% of completed quizzes</p>
            </div>

            <div className={`p-4 rounded-xl border ${getDifficultyBg('hard')}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-purple-300">Hard Tier</span>
                <Trophy size={18} className="text-purple-400" />
              </div>
              <p className="text-2xl font-bold text-white">{dist.hard || 0}</p>
              <p className="text-xs text-dark-400 mt-1">{hardPct}% of completed quizzes</p>
            </div>
          </div>

          {/* Visual Distribution Progress Bar */}
          <div className="h-3 w-full bg-dark-800 rounded-full overflow-hidden flex p-0.5 border border-dark-700">
            {easyPct > 0 && (
              <div 
                className="bg-emerald-500 rounded-l-full transition-all duration-500"
                style={{ width: `${easyPct}%` }}
                title={`Easy: ${easyPct}%`}
              />
            )}
            {medPct > 0 && (
              <div 
                className={`bg-blue-500 ${easyPct === 0 ? 'rounded-l-full' : ''} ${hardPct === 0 ? 'rounded-r-full' : ''} transition-all duration-500`}
                style={{ width: `${medPct}%` }}
                title={`Medium: ${medPct}%`}
              />
            )}
            {hardPct > 0 && (
              <div 
                className="bg-purple-500 rounded-r-full transition-all duration-500"
                style={{ width: `${hardPct}%` }}
                title={`Hard: ${hardPct}%`}
              />
            )}
            {totalAttempts === 0 && (
              <div className="w-full bg-dark-700/50 rounded-full" />
            )}
          </div>
        </Card>
      </motion.div>

      {/* ─── Recent Attempts Timeline ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card padding="lg" className="border-dark-700/60 bg-dark-900/60 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-400">
                <Calendar size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Quiz Attempt History</h3>
                <p className="text-xs text-dark-400">Detailed timeline of recent quizzes and scores</p>
              </div>
            </div>

            <Link
              to={ROUTES.QUIZZES}
              className="text-xs font-semibold text-primary-400 hover:text-primary-300 flex items-center gap-1"
            >
              Browse All Quizzes <ChevronRight size={14} />
            </Link>
          </div>
          
          <div className="space-y-3">
            {performanceStats.recentAttempts && performanceStats.recentAttempts.length > 0 ? (
              performanceStats.recentAttempts.map((attempt, index) => {
                const scoreVal = attempt.score ?? 0;
                const isGreat = scoreVal >= 80;
                const isOk = scoreVal >= 50;

                return (
                  <div
                    key={attempt.id || index}
                    className="p-4 rounded-xl bg-dark-800/60 hover:bg-dark-800 border border-dark-700/70 hover:border-dark-600 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isGreat ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                        isOk ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' :
                        'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}>
                        <Brain size={22} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">
                          {attempt.quizTitle || `Practice Quiz #${attempt.quizId || index + 1}`}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-md font-medium uppercase tracking-wider ${getDifficultyBg(attempt.difficulty || 'medium')}`}>
                            {attempt.difficulty || 'medium'}
                          </span>
                          <span className="text-xs text-dark-400">
                            {formatRelativeTime(new Date(attempt.completedAt))}
                          </span>
                          <span className="text-xs text-dark-500">•</span>
                          <span className="text-xs text-dark-400">
                            {attempt.totalQuestions || 10} Questions
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-5">
                      <div className="text-right">
                        <p className={`text-xl font-extrabold ${
                          isGreat ? 'text-emerald-400' : isOk ? 'text-blue-400' : 'text-amber-400'
                        }`}>
                          {scoreVal}%
                        </p>
                        <p className="text-xs text-dark-400 flex items-center justify-end gap-1">
                          <Clock size={12} /> {formatDuration(attempt.timeSpent || attempt.timeTaken || 45)}
                        </p>
                      </div>

                      <button
                        onClick={() => navigate(ROUTES.QUIZ_PLAY.replace(':id', attempt.quizId))}
                        className="px-3 py-1.5 rounded-lg bg-dark-700 hover:bg-primary-600 hover:text-white text-dark-300 text-xs font-medium transition-colors flex items-center gap-1.5"
                      >
                        <Play size={13} />
                        <span>Retake</span>
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 px-4 rounded-xl border border-dashed border-dark-700 bg-dark-900/30">
                <div className="w-16 h-16 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mx-auto mb-4">
                  <Brain size={32} className="text-primary-400" />
                </div>
                <h4 className="text-base font-semibold text-white mb-1">No Quiz Attempts Recorded Yet</h4>
                <p className="text-sm text-dark-400 max-w-md mx-auto mb-5">
                  Take a quiz or generate one with AI from any study document. Your adaptive stats, accuracy scores, and performance history will appear here in real time!
                </p>
                <Link
                  to={ROUTES.QUIZ_AI_GENERATE}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-medium text-sm transition-all shadow-lg shadow-primary-600/30"
                >
                  <PlusCircle size={16} />
                  <span>Generate AI Quiz Now</span>
                </Link>
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default QuizHistoryPage;