import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, Clock, Target, Trophy,
  Award, BarChart3, Calendar, Zap,
  Brain, ArrowUp, ArrowDown, Minus,
} from 'lucide-react';
import { quizAPI } from '../../api/quiz.api.js';
import { ROUTES } from '../../constants/routes.js';
import Card from '../../components/common/Card.jsx';
import ProgressBar from '../../components/common/ProgressBar.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import AdaptiveBadge from '../../components/quiz/AdaptiveBadge.jsx';
import { formatRelativeTime, formatScore, formatDuration } from '../../utils/formatters.js';
import { cn } from '../../utils/helpers.js';
import toast from 'react-hot-toast';

/**
 * @page QuizHistoryPage
 * @description Module 05: Performance history and adaptive analytics page
 */
const QuizHistoryPage = () => {
  const [performanceStats, setPerformanceStats] = useState(null);
  const [adaptiveRecommendation, setAdaptiveRecommendation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, adaptiveRes] = await Promise.all([
          quizAPI.getPerformanceStats(),
          quizAPI.getRecommendedDifficulty(),
        ]);
        
        setPerformanceStats(statsRes.data.data);
        setAdaptiveRecommendation(adaptiveRes.data.data);
      } catch (error) {
        console.error('Failed to fetch performance data:', error);
        toast.error('Failed to load performance data');
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

  const getDifficultyColor = (difficulty) => {
    const colors = {
      easy: 'text-emerald-400',
      medium: 'text-blue-400',
      hard: 'text-purple-400'
    };
    return colors[difficulty] || 'text-gray-400';
  };

  const getDifficultyBg = (difficulty) => {
    const colors = {
      easy: 'bg-emerald-500/10 border-emerald-500/30',
      medium: 'bg-blue-500/10 border-blue-500/30',
      hard: 'bg-purple-500/10 border-purple-500/30'
    };
    return colors[difficulty] || 'bg-gray-500/10 border-gray-500/30';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-dark-50">Performance Analytics</h1>
          <p className="text-dark-400 mt-1">Track your quiz performance and adaptive progress</p>
        </div>
      </motion.div>

      {/* ─── Module 05: Adaptive Status Banner ─────────────────────────────── */}
      {adaptiveRecommendation && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border-purple-500/30">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <TrendingUp size={24} className="text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-dark-200 mb-3">Adaptive Status</h3>
                <AdaptiveBadge
                  currentDifficulty={adaptiveRecommendation.currentDifficulty}
                  recommendedDifficulty={adaptiveRecommendation.recommendedDifficulty}
                  showNotification={adaptiveRecommendation.shouldAdjust}
                  notificationType={
                    adaptiveRecommendation.shouldAdjust
                      ? adaptiveRecommendation.recommendedDifficulty === 'hard'
                        ? 'upgraded'
                        : 'downgraded'
                      : 'maintained'
                  }
                />
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ─── Performance Stats Grid ────────────────────────────────────────── */}
      {performanceStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <Card padding="md" hover>
            <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center mb-3">
              <Brain size={20} className="text-primary-400" />
            </div>
            <p className="text-2xl font-bold text-dark-50">{performanceStats.totalAttempts}</p>
            <p className="text-sm text-dark-400 mt-0.5">Total Quizzes</p>
          </Card>

          <Card padding="md" hover>
            <div className="w-10 h-10 bg-secondary-500/10 rounded-xl flex items-center justify-center mb-3">
              <Target size={20} className="text-secondary-400" />
            </div>
            <p className="text-2xl font-bold text-dark-50">{performanceStats.averageScore}%</p>
            <p className="text-sm text-dark-400 mt-0.5">Average Score</p>
          </Card>

          <Card padding="md" hover>
            <div className="w-10 h-10 bg-accent-500/10 rounded-xl flex items-center justify-center mb-3">
              <Trophy size={20} className="text-accent-400" />
            </div>
            <p className="text-2xl font-bold text-dark-50">{performanceStats.highestScore}%</p>
            <p className="text-sm text-dark-400 mt-0.5">Highest Score</p>
          </Card>

          <Card padding="md" hover>
            <div className="w-10 h-10 bg-battle-500/10 rounded-xl flex items-center justify-center mb-3">
              <Clock size={20} className="text-battle-400" />
            </div>
            <p className="text-2xl font-bold text-dark-50">{performanceStats.lowestScore}%</p>
            <p className="text-sm text-dark-400 mt-0.5">Lowest Score</p>
          </Card>
        </motion.div>
      )}

      {/* ─── Difficulty Distribution ─────────────────────────────────────────── */}
      {performanceStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card padding="lg">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={20} className="text-purple-400" />
              <h3 className="text-lg font-semibold text-dark-200">Difficulty Distribution</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className={`p-4 rounded-xl border ${getDifficultyBg('easy')}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-dark-200">Easy</span>
                  <Brain size={16} className={getDifficultyColor('easy')} />
                </div>
                <p className="text-2xl font-bold text-dark-50">{performanceStats.difficultyDistribution.easy}</p>
                <p className="text-xs text-dark-400 mt-1">
                  {performanceStats.totalAttempts > 0 
                    ? `${Math.round((performanceStats.difficultyDistribution.easy / performanceStats.totalAttempts) * 100)}%`
                    : '0%'} of total
                </p>
              </div>

              <div className={`p-4 rounded-xl border ${getDifficultyBg('medium')}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-dark-200">Medium</span>
                  <Target size={16} className={getDifficultyColor('medium')} />
                </div>
                <p className="text-2xl font-bold text-dark-50">{performanceStats.difficultyDistribution.medium}</p>
                <p className="text-xs text-dark-400 mt-1">
                  {performanceStats.totalAttempts > 0 
                    ? `${Math.round((performanceStats.difficultyDistribution.medium / performanceStats.totalAttempts) * 100)}%`
                    : '0%'} of total
                </p>
              </div>

              <div className={`p-4 rounded-xl border ${getDifficultyBg('hard')}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-dark-200">Hard</span>
                  <Trophy size={16} className={getDifficultyColor('hard')} />
                </div>
                <p className="text-2xl font-bold text-dark-50">{performanceStats.difficultyDistribution.hard}</p>
                <p className="text-xs text-dark-400 mt-1">
                  {performanceStats.totalAttempts > 0 
                    ? `${Math.round((performanceStats.difficultyDistribution.hard / performanceStats.totalAttempts) * 100)}%`
                    : '0%'} of total
                </p>
              </div>
            </div>

            {/* Visual Distribution Bar */}
            <div className="h-4 bg-dark-700 rounded-full overflow-hidden flex">
              {performanceStats.difficultyDistribution.easy > 0 && (
                <div 
                  className="bg-emerald-500 transition-all duration-500"
                  style={{ width: `${(performanceStats.difficultyDistribution.easy / performanceStats.totalAttempts) * 100}%` }}
                />
              )}
              {performanceStats.difficultyDistribution.medium > 0 && (
                <div 
                  className="bg-blue-500 transition-all duration-500"
                  style={{ width: `${(performanceStats.difficultyDistribution.medium / performanceStats.totalAttempts) * 100}%` }}
                />
              )}
              {performanceStats.difficultyDistribution.hard > 0 && (
                <div 
                  className="bg-purple-500 transition-all duration-500"
                  style={{ width: `${(performanceStats.difficultyDistribution.hard / performanceStats.totalAttempts) * 100}%` }}
                />
              )}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ─── Recent Attempts ───────────────────────────────────────────────── */}
      {performanceStats && performanceStats.recentAttempts && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card padding="lg">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={20} className="text-purple-400" />
              <h3 className="text-lg font-semibold text-dark-200">Recent Attempts</h3>
            </div>
            
            <div className="space-y-3">
              {performanceStats.recentAttempts.length > 0 ? (
                performanceStats.recentAttempts.map((attempt, index) => {
                  const { value: scoreText, color: scoreColor } = formatScore(attempt.score);
                  
                  return (
                    <div
                      key={index}
                      className={`p-4 rounded-xl border ${getDifficultyBg(attempt.difficulty)} hover:opacity-80 transition-opacity`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getDifficultyBg(attempt.difficulty)}`}>
                            <Brain size={20} className={getDifficultyColor(attempt.difficulty)} />
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${getDifficultyColor(attempt.difficulty)}`}>
                              {attempt.difficulty.charAt(0).toUpperCase() + attempt.difficulty.slice(1)} Quiz
                            </p>
                            <p className="text-xs text-dark-400">
                              {formatRelativeTime(new Date(attempt.completedAt))}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${scoreColor}`}>{attempt.score}%</p>
                          <p className="text-xs text-dark-400">
                            {formatDuration(attempt.timeTaken)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <Brain size={48} className="text-dark-600 mx-auto mb-3" />
                  <p className="text-dark-400">No quiz attempts yet</p>
                  <p className="text-sm text-dark-500">Start practicing to see your performance here!</p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default QuizHistoryPage;