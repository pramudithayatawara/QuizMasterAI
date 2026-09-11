import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Trophy, Target, Clock, TrendingUp,
  CheckCircle, XCircle, Home, RotateCcw,
  Brain, Award, ArrowUp, ArrowDown, Sparkles, X,
  AlertCircle, BookOpen, Zap,
} from 'lucide-react';
import { quizAPI } from '../../api/quiz.api.js';
import { ROUTES } from '../../constants/routes.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import ProgressBar from '../../components/common/ProgressBar.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import AdaptiveBadge from '../../components/quiz/AdaptiveBadge.jsx';
import AIFeedback from '../../components/quiz/AIFeedback.jsx';
import { formatDuration, formatScore } from '../../utils/formatters.js';
import { cn } from '../../utils/helpers.js';
import { useNotificationStore } from '../../store/notification.store.js';
import toast from 'react-hot-toast';

/**
 * @page QuizResultPage
 * @description Quiz results with detailed feedback and performance analysis.
 */
const QuizResultPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const response = await quizAPI.review(id);
        const data = response.data.data;
        setResult(data.result || data.review);
      } catch (error) {
        toast.error('Failed to load quiz result.');
        navigate(ROUTES.QUIZ_LIST);
      } finally {
        setIsLoading(false);
      }
    };
    fetchResult();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="xl" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <AlertCircle size={48} className="text-dark-600 mx-auto mb-4" />
        <p className="text-dark-400">Result not found.</p>
        <Link to={ROUTES.QUIZ_LIST}>
          <Button variant="primary" className="mt-4">
            Back to Quizzes
          </Button>
        </Link>
      </div>
    );
  }

  const { value: scoreText, color: scoreColor } = formatScore(result.percentage);
  
  // Module 05: Adaptive difficulty change notification
  const [showAdaptiveNotification, setShowAdaptiveNotification] = useState(false);
  const [adaptiveInfo, setAdaptiveInfo] = useState(null);
  
  // Module 06: AI Feedback state
  const [aiFeedback, setAiFeedback] = useState(null);
  const [topicAccuracy, setTopicAccuracy] = useState(null);
  const [performanceMetrics, setPerformanceMetrics] = useState(null);
  
  useEffect(() => {
    // Check if this result has adaptive information
    if (result.adaptive && result.adaptive.shouldAdjust) {
      setAdaptiveInfo(result.adaptive);
      setShowAdaptiveNotification(true);

      useNotificationStore.getState().addNotification({
        type: 'adaptive',
        title: `Difficulty ${result.adaptive.adjustment === 'upgraded' ? 'Upgraded 🚀' : 'Calibrated'}`,
        message: result.adaptive.message || `Your difficulty level was updated to ${result.adaptive.newDifficulty || 'next level'}.`,
        link: ROUTES.QUIZ_HISTORY,
      });
    }
    
    // Module 06: Check for AI feedback
    if (result.aiFeedback) {
      setAiFeedback(result.aiFeedback);
    }
    
    // Module 06: Check for topic accuracy
    if (result.topicAccuracy) {
      setTopicAccuracy(result.topicAccuracy);
    }
    
    // Module 06: Check for performance metrics
    if (result.performanceMetrics) {
      setPerformanceMetrics(result.performanceMetrics);
    }
  }, [result]);

  const stats = [
    {
      label: 'Score',
      value: scoreText,
      icon: Trophy,
      color: scoreColor,
      bg: result.percentage >= 80
        ? 'bg-secondary-500/10'
        : result.percentage >= 60
        ? 'bg-accent-500/10'
        : 'bg-red-500/10',
    },
    {
      label: 'Correct',
      value: result.correctCount,
      icon: CheckCircle,
      color: 'text-secondary-400',
      bg: 'bg-secondary-500/10',
    },
    {
      label: 'Wrong',
      value: result.wrongCount,
      icon: XCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      label: 'Time Taken',
      value: formatDuration(result.timeTaken),
      icon: Clock,
      color: 'text-primary-400',
      bg: 'bg-primary-500/10',
    },
  ];

  // Module 06: Additional performance stats
  const additionalStats = [];
  
  if (result.difficulty) {
    additionalStats.push({
      label: 'Difficulty',
      value: result.difficulty.charAt(0).toUpperCase() + result.difficulty.slice(1),
      icon: Brain,
      color: result.difficulty === 'hard' ? 'text-purple-400' : result.difficulty === 'medium' ? 'text-blue-400' : 'text-emerald-400',
      bg: result.difficulty === 'hard' ? 'bg-purple-500/10' : result.difficulty === 'medium' ? 'bg-blue-500/10' : 'bg-emerald-500/10',
    });
  }
  
  if (result.skippedCount > 0) {
    additionalStats.push({
      label: 'Skipped',
      value: result.skippedCount,
      icon: AlertCircle,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* ─── Module 05: Adaptive Difficulty Change Notification ──────────────── */}
      {showAdaptiveNotification && adaptiveInfo && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl border ${
            adaptiveInfo.newDifficulty === 'hard'
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : adaptiveInfo.newDifficulty === 'easy'
              ? 'bg-yellow-500/10 border-yellow-500/30'
              : 'bg-blue-500/10 border-blue-500/30'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              {adaptiveInfo.newDifficulty === 'hard' ? (
                <ArrowUp size={20} className="text-emerald-400" />
              ) : adaptiveInfo.newDifficulty === 'easy' ? (
                <ArrowDown size={20} className="text-yellow-400" />
              ) : (
                <Sparkles size={20} className="text-blue-400" />
              )}
            </div>
            <div className="flex-1">
              <p className={`font-semibold text-sm ${
                adaptiveInfo.newDifficulty === 'hard'
                  ? 'text-emerald-400'
                  : adaptiveInfo.newDifficulty === 'easy'
                  ? 'text-yellow-400'
                  : 'text-blue-400'
              }`}>
                {adaptiveInfo.newDifficulty === 'hard'
                  ? '🎉 Difficulty Upgraded!'
                  : adaptiveInfo.newDifficulty === 'easy'
                  ? '📚 Difficulty Adjusted'
                  : '✨ Difficulty Maintained'}
              </p>
              <p className="text-xs text-dark-400 mt-1">
                {adaptiveInfo.adjustmentReason}
              </p>
              <p className="text-xs text-dark-500 mt-1">
                {adaptiveInfo.previousDifficulty?.charAt(0).toUpperCase() + adaptiveInfo.previousDifficulty?.slice(1)} → {adaptiveInfo.newDifficulty?.charAt(0).toUpperCase() + adaptiveInfo.newDifficulty?.slice(1)}
              </p>
            </div>
            <button
              onClick={() => setShowAdaptiveNotification(false)}
              className="text-dark-400 hover:text-dark-300 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}

      {/* ─── Real-Time Adaptive Trajectory Timeline ───────────────────────────── */}
      {result.adaptiveTrajectory && result.adaptiveTrajectory.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card padding="md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="text-purple-400" size={20} />
                <h3 className="text-base font-bold text-dark-50">
                  Adaptive CAT Progression Trajectory
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-dark-400">Final Calibrated Level:</span>
                <span className={cn(
                  'px-2.5 py-1 rounded font-bold uppercase',
                  result.currentDifficultyLevel === 'hard'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : result.currentDifficultyLevel === 'easy'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                )}>
                  {result.currentDifficultyLevel || result.difficulty}
                </span>
              </div>
            </div>

            {/* Trajectory Step Pills / Timeline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {result.adaptiveTrajectory.map((step, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'p-3 rounded-xl border flex flex-col justify-between text-xs space-y-2 transition-all',
                    step.isCorrect
                      ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/5 border-red-500/30 text-red-300'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-dark-300">Q{step.stepNumber || idx + 1}</span>
                    {step.isCorrect ? (
                      <CheckCircle size={16} className="text-emerald-400" />
                    ) : (
                      <XCircle size={16} className="text-red-400" />
                    )}
                  </div>

                  <div>
                    <span className={cn(
                      'px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase',
                      step.difficulty === 'hard'
                        ? 'bg-red-500/20 text-red-400'
                        : step.difficulty === 'easy'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                    )}>
                      {step.difficulty}
                    </span>
                    {step.bloomsTaxonomy && (
                      <span className="ml-1 text-[10px] text-dark-400">
                        ({step.bloomsTaxonomy})
                      </span>
                    )}
                  </div>

                  <div className="text-[10px] text-dark-400 flex items-center justify-between pt-1 border-t border-dark-700/50">
                    <span>{step.timeTaken ? `${step.timeTaken}s` : '—'}</span>
                    <span className="font-mono text-purple-400">
                      θ: {typeof step.abilityThetaAfter === 'number' ? (step.abilityThetaAfter > 0 ? `+${step.abilityThetaAfter}` : step.abilityThetaAfter) : '0.0'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ─── Module 04: Difficulty Breakdown Bar ───────────────────────────────── */}
      {result.difficultyBreakdown && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card padding="md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-dark-200">Question Difficulty Distribution</span>
              <div className="flex gap-3 text-xs">
                <span className="text-emerald-400">Easy: {result.difficultyBreakdown.easy}</span>
                <span className="text-yellow-400">Medium: {result.difficultyBreakdown.medium}</span>
                <span className="text-red-400">Hard: {result.difficultyBreakdown.hard}</span>
              </div>
            </div>
            <div className="h-3 bg-dark-700 rounded-full overflow-hidden flex">
              {result.difficultyBreakdown.easy > 0 && (
                <div 
                  className="bg-emerald-500 transition-all duration-500"
                  style={{ width: `${(result.difficultyBreakdown.easy / result.totalQuestions) * 100}%` }}
                />
              )}
              {result.difficultyBreakdown.medium > 0 && (
                <div 
                  className="bg-yellow-500 transition-all duration-500"
                  style={{ width: `${(result.difficultyBreakdown.medium / result.totalQuestions) * 100}%` }}
                />
              )}
              {result.difficultyBreakdown.hard > 0 && (
                <div 
                  className="bg-red-500 transition-all duration-500"
                  style={{ width: `${(result.difficultyBreakdown.hard / result.totalQuestions) * 100}%` }}
                />
              )}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ─── Module 06: Weak Topics Card ────────────────────────────────────────── */}
      {result.weakTopics && result.weakTopics.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card padding="md" className="bg-gradient-to-r from-yellow-900/40 to-orange-900/40 border-yellow-500/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                <AlertCircle size={20} className="text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-yellow-400">Topics to Review</h3>
                <p className="text-xs text-dark-400">These areas need more attention</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {result.weakTopics.map((topic, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-300 text-sm font-medium border border-yellow-500/30 flex items-center gap-2"
                >
                  <BookOpen size={14} />
                  {topic}
                </span>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ─── Module 06: AI Feedback Component ─────────────────────────────────── */}
      <AIFeedback 
        aiFeedback={aiFeedback}
        topicAccuracy={topicAccuracy}
        performanceMetrics={performanceMetrics}
      />

      {/* ─── Celebration Header ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-4"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 10, 0] }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-7xl"
        >
          {result.percentage >= 80 ? '🎉' : result.percentage >= 60 ? '👏' : '📚'}
        </motion.div>
        <h1 className="text-4xl font-bold text-dark-50">
          {result.percentage >= 80
            ? 'Excellent Work!'
            : result.percentage >= 60
            ? 'Good Job!'
            : 'Keep Practicing!'}
        </h1>
        <p className="text-dark-400 max-w-md mx-auto">
          {result.percentage >= 80
            ? 'Outstanding performance! You have mastered this topic.'
            : result.percentage >= 60
            ? 'Well done! A bit more practice and you will excel.'
            : 'Don\'t give up! Review the material and try again.'}
        </p>
      </motion.div>

      {/* ─── Stats Grid ───────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 lg:grid-cols-6 gap-4"
      >
        {[...stats, ...additionalStats].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
            >
              <Card padding="md" className="text-center">
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
            </motion.div>
          );
        })}
      </motion.div>

      {/* ─── Performance Breakdown ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card>
          <h2 className="text-xl font-bold text-dark-50 mb-4">
            Performance Breakdown
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-dark-400">Correct Answers</span>
                <span className="text-sm font-medium text-secondary-400">
                  {result.correctCount} / {result.totalQuestions}
                </span>
              </div>
              <ProgressBar
                value={(result.correctCount / result.totalQuestions) * 100}
                max={100}
                color="green"
                size="md"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-dark-400">Accuracy</span>
                <span className={cn('text-sm font-medium', scoreColor)}>
                  {scoreText}
                </span>
              </div>
              <ProgressBar
                value={result.percentage}
                max={100}
                color={result.percentage >= 80 ? 'green' : result.percentage >= 60 ? 'orange' : 'red'}
                size="md"
              />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ─── AI Feedback ───────────────────────────────────────────────────── */}
      {result.aiFeedback && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="bg-primary-500/5 border-primary-500/20">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary-500/10 rounded-xl
                              flex items-center justify-center flex-shrink-0">
                <Brain size={24} className="text-primary-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-dark-50 mb-2">
                  AI-Powered Feedback
                </h3>
                <p className="text-dark-300 leading-relaxed">
                  {result.aiFeedback}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ─── Weak Topics ───────────────────────────────────────────────────── */}
      {result.weakTopics && result.weakTopics.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card>
            <h2 className="text-xl font-bold text-dark-50 mb-4">
              Areas for Improvement
            </h2>
            <div className="space-y-2">
              {result.weakTopics.map((topic, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-xl"
                >
                  <TrendingUp size={16} className="text-accent-400 flex-shrink-0" />
                  <span className="text-dark-200">{topic}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ─── XP Reward ─────────────────────────────────────────────────────── */}
      {result.xpEarned > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="bg-gradient-to-r from-primary-900/40 to-secondary-900/40
                           border-primary-500/20 text-center">
            <div className="flex items-center justify-center gap-3">
              <Award size={32} className="text-primary-400" />
              <div>
                <p className="text-2xl font-bold gradient-text">
                  +{result.xpEarned} XP
                </p>
                <p className="text-sm text-dark-400">Experience Points Earned</p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ─── Actions ───────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <Link to={ROUTES.DASHBOARD} className="flex-1">
          <Button variant="secondary" className="w-full" leftIcon={<Home size={18} />}>
            Go to Dashboard
          </Button>
        </Link>
        <Link to={ROUTES.QUIZ_LIST} className="flex-1">
          <Button variant="primary" className="w-full" leftIcon={<RotateCcw size={18} />}>
            Take Another Quiz
          </Button>
        </Link>
      </motion.div>
    </div>
  );
};

export default QuizResultPage;