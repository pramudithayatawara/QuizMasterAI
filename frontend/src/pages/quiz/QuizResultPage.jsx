import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Trophy, Target, Clock, TrendingUp,
  CheckCircle, XCircle, Home, RotateCcw,
  Brain, Award, ArrowUp, ArrowDown, Sparkles, X,
  AlertCircle, BookOpen, Zap, Save, Loader2,
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
import toast from 'react-hot-toast';
import { useTheme } from '../../hooks/useTheme.js';
import { extractErrorMessage, logErrorDetails } from '../../utils/errorUtils.js';

/**
 * @page QuizResultPage
 * @description Quiz results with detailed feedback and performance analysis.
 */
const QuizResultPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const response = await quizAPI.review(id);
        setResult(response.data.data.result);
      } catch (error) {
        logErrorDetails(error, 'fetchResult');
        toast.error(extractErrorMessage(error) || 'Failed to load quiz result.');
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
  
  // Get difficulty badge component
  const getDifficultyBadge = (difficulty) => {
    const difficultyConfig = {
      easy: {
        color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        icon: Zap,
        label: 'Easy'
      },
      medium: {
        color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
        icon: Award,
        label: 'Medium'
      },
      hard: {
        color: 'bg-red-500/10 text-red-400 border-red-500/30',
        icon: Brain,
        label: 'Hard'
      }
    };

    const config = difficultyConfig[difficulty?.toLowerCase()] || difficultyConfig.medium;
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium ${config.color}`}>
        <Icon size={12} />
        <span>{config.label}</span>
      </div>
    );
  };
  
  // Module 05: Adaptive difficulty change notification
  const [showAdaptiveNotification, setShowAdaptiveNotification] = useState(false);
  const [adaptiveInfo, setAdaptiveInfo] = useState(null);
  
  // Module 06: AI Feedback state
  const [aiFeedback, setAiFeedback] = useState(null);
  const [topicAccuracy, setTopicAccuracy] = useState(null);
  const [performanceMetrics, setPerformanceMetrics] = useState(null);
  
  // Priority 30 & 31 states
  const [isSavingQuiz, setIsSavingQuiz] = useState(false);
  const [savedQuizId, setSavedQuizId] = useState(null);
  const [questionDifficulties, setQuestionDifficulties] = useState({});
  
  useEffect(() => {
    // Check if this result has adaptive information
    if (result?.adaptive && result.adaptive.shouldAdjust) {
      setAdaptiveInfo(result.adaptive);
      setShowAdaptiveNotification(true);
    }
    
    // Module 06: Check for AI feedback
    if (result?.aiFeedback) {
      setAiFeedback(result.aiFeedback);
    }
    
    // Module 06: Check for topic accuracy
    if (result?.topicAccuracy) {
      setTopicAccuracy(result.topicAccuracy);
    }
    
    // Module 06: Check for performance metrics
    if (result?.performanceMetrics) {
      setPerformanceMetrics(result.performanceMetrics);
    }
    
    // Initialize question difficulties from result if available
    if (Array.isArray(result?.questions)) {
      const difficulties = {};
      result.questions.forEach((q, index) => {
        if (q.difficulty) {
          difficulties[q.id || index] = {
            difficulty: q.difficulty,
            cognitive_level: q.cognitive_level,
            difficulty_score: q.difficulty_score
          };
        }
      });
      setQuestionDifficulties(difficulties);
    }
  }, [result]);

  // Priority 30: Save quiz handler
  const handleSaveQuiz = async () => {
    if (!result || !Array.isArray(result.questions) || result.questions.length === 0) {
      toast.error('No quiz data available to save');
      return;
    }

    setIsSavingQuiz(true);
    try {
      const userId = localStorage.getItem('userId') || 1;
      
      console.log('💾 Saving quiz result with data:', {
        user_id: userId,
        quiz_title: `Quiz Result - ${new Date().toLocaleDateString()}`,
        quiz_description: `Quiz completed with ${result.percentage}% accuracy`,
        questions_count: result.questions.length,
        percentage: result.percentage
      });

      const quizData = {
        user_id: parseInt(userId),
        quiz_title: `Quiz Result - ${new Date().toLocaleDateString()}`,
        quiz_description: `Quiz completed with ${result.percentage}% accuracy`,
        questions: result.questions.map((q, index) => {
          console.log('📝 Processing question:', {
            index,
            question: q.question,
            type: q.type,
            has_options: !!q.options,
            has_correct_answer: !!q.correctAnswer,
            has_difficulty: !!q.difficulty
          });

          return {
            question_text: q.question || '',
            question_type: q.type || 'mcq',
            options: Array.isArray(q.options) ? q.options : [],
            correct_answer: q.correctAnswer || '',
            difficulty: q.difficulty || 'medium',
            source_chunk_index: index,
            confidence_score: q.confidence_score || 0.8,
            question_metadata: {
              user_answer: q.userAnswer,
              is_correct: q.isCorrect,
              explanation: q.explanation,
              quiz_result_id: id
            },
            tags: [q.type || 'mcq', q.difficulty || 'medium']
          };
        }),
        pdf_id: result.pdf_id || null,
        category: result.category || 'Quiz Result',
        quiz_metadata: {
          result_id: id,
          percentage: result.percentage || 0,
          time_taken: result.timeTaken || 0,
          completed_at: new Date().toISOString(),
          correct_count: result.correctCount || 0,
          wrong_count: result.wrongCount || 0,
          total_questions: result.totalQuestions || result.questions.length
        },
        tags: ['quiz-result', 'completed']
      };

      console.log('📤 Sending quiz data to storage API:', quizData);

      const response = await quizAPI.storeQuiz(quizData);
      
      console.log('📊 Storage API response:', response);
      
      if (response.data && response.data.quiz_id) {
        setSavedQuizId(response.data.quiz_id);
        toast.success(`Quiz saved successfully! Quiz ID: ${response.data.quiz_id}`);
        
        // Optionally trigger difficulty categorization
        await handleCategorizeDifficulty(response.data.quiz_id);
      } else {
        throw new Error('Failed to save quiz - no quiz_id in response');
      }
    } catch (error) {
      logErrorDetails(error, 'handleSaveQuiz');
      
      // Detailed error logging
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
      }
      
      const errorMessage = extractErrorMessage(error) || 'Failed to save quiz';
      toast.error(errorMessage);
    } finally {
      setIsSavingQuiz(false);
    }
  };

  // Priority 31: Difficulty categorization handler
  const handleCategorizeDifficulty = async (quizId) => {
    if (!quizId) {
      toast.error('No quiz ID available for categorization');
      return;
    }

    console.log('🎯 Starting difficulty categorization for quiz:', quizId);

    try {
      const response = await quizAPI.categorizeDifficulty(quizId);
      
      console.log('📊 Categorization response:', response);
      
      if (response.data) {
        const difficulties = {};
        response.data.categorizations?.forEach((cat, index) => {
          difficulties[cat.question_id] = {
            difficulty: cat.difficulty,
            cognitive_level: cat.cognitive_level,
            difficulty_score: cat.difficulty_score
          };
        });
        
        setQuestionDifficulties(difficulties);
        toast.success(`Difficulty categorized: ${response.data.easy_count} Easy, ${response.data.medium_count} Medium, ${response.data.hard_count} Hard`);
      } else {
        console.warn('⚠️ No categorization data in response');
      }
    } catch (error) {
      logErrorDetails(error, 'handleCategorizeDifficulty');
      
      // Detailed error logging
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
      }
      
      toast.error(extractErrorMessage(error) || 'Failed to categorize difficulty');
    }
  };

  const stats = [
    {
      label: 'Score',
      value: scoreText,
      icon: Trophy,
      color: scoreColor,
      bg: (result?.percentage || 0) >= 80
        ? 'bg-secondary-500/10'
        : (result?.percentage || 0) >= 60
        ? 'bg-accent-500/10'
        : 'bg-red-500/10',
    },
    {
      label: 'Correct',
      value: result?.correctCount || 0,
      icon: CheckCircle,
      color: 'text-secondary-400',
      bg: 'bg-secondary-500/10',
    },
    {
      label: 'Wrong',
      value: result?.wrongCount || 0,
      icon: XCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      label: 'Time Taken',
      value: formatDuration(result?.timeTaken || 0),
      icon: Clock,
      color: 'text-primary-400',
      bg: 'bg-primary-500/10',
    },
  ];

  // Module 06: Additional performance stats
  const additionalStats = [];
  
  if (result?.difficulty) {
    const difficulty = result.difficulty || 'medium';
    additionalStats.push({
      label: 'Difficulty',
      value: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
      icon: Brain,
      color: difficulty === 'hard' ? 'text-purple-400' : difficulty === 'medium' ? 'text-blue-400' : 'text-emerald-400',
      bg: difficulty === 'hard' ? 'bg-purple-500/10' : difficulty === 'medium' ? 'bg-blue-500/10' : 'bg-emerald-500/10',
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

      {/* ─── Module 04: Difficulty Breakdown Bar ───────────────────────────────── */}
      {result?.difficultyBreakdown && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card padding="md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-dark-200">Question Difficulty Distribution</span>
              <div className="flex gap-3 text-xs">
                <span className="text-emerald-400">Easy: {result.difficultyBreakdown.easy || 0}</span>
                <span className="text-yellow-400">Medium: {result.difficultyBreakdown.medium || 0}</span>
                <span className="text-red-400">Hard: {result.difficultyBreakdown.hard || 0}</span>
              </div>
            </div>
            <div className="h-3 bg-dark-700 rounded-full overflow-hidden flex">
              {(result.difficultyBreakdown.easy || 0) > 0 && (
                <div 
                  className="bg-emerald-500 transition-all duration-500"
                  style={{ width: `${((result.difficultyBreakdown.easy || 0) / (result.totalQuestions || 1)) * 100}%` }}
                />
              )}
              {(result.difficultyBreakdown.medium || 0) > 0 && (
                <div 
                  className="bg-yellow-500 transition-all duration-500"
                  style={{ width: `${((result.difficultyBreakdown.medium || 0) / (result.totalQuestions || 1)) * 100}%` }}
                />
              )}
              {(result.difficultyBreakdown.hard || 0) > 0 && (
                <div 
                  className="bg-red-500 transition-all duration-500"
                  style={{ width: `${((result.difficultyBreakdown.hard || 0) / (result.totalQuestions || 1)) * 100}%` }}
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
              {Array.isArray(result.weakTopics) && result.weakTopics.length > 0 ? (
                result.weakTopics.map((topic, index) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-300 text-sm font-medium border border-yellow-500/30 flex items-center gap-2"
                  >
                    <BookOpen size={14} />
                    {topic}
                  </span>
                ))
              ) : (
                <span className="text-sm text-dark-400">No weak topics identified</span>
              )}
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
          {(result?.percentage || 0) >= 80 ? '🎉' : (result?.percentage || 0) >= 60 ? '👏' : '📚'}
        </motion.div>
        <h1 className="text-4xl font-bold text-dark-50">
          {(result?.percentage || 0) >= 80
            ? 'Excellent Work!'
            : (result?.percentage || 0) >= 60
            ? 'Good Job!'
            : 'Keep Practicing!'}
        </h1>
        <p className="text-dark-400 max-w-md mx-auto">
          {(result?.percentage || 0) >= 80
            ? 'Outstanding performance! You have mastered this topic.'
            : (result?.percentage || 0) >= 60
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
        {Array.isArray(stats) && Array.isArray(additionalStats) && [...stats, ...additionalStats].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label || index}
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
      {Array.isArray(result.weakTopics) && result.weakTopics.length > 0 && (
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
      {result?.xpEarned && result.xpEarned > 0 && (
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

      {/* ─── Priority 31: Question Breakdown with Difficulty Badges ─────────────── */}
      {Array.isArray(result.questions) && result.questions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}
        >
          <Card>
            <h2 className="text-xl font-bold text-dark-50 mb-4">
              Question Breakdown
            </h2>
            <div className="space-y-3">
              {result.questions.map((q, index) => {
                const questionId = q.id || index;
                const difficultyInfo = questionDifficulties[questionId];
                const difficulty = difficultyInfo?.difficulty || q.difficulty || 'medium';
                
                return (
                  <div
                    key={questionId}
                    className={`p-4 rounded-xl border ${
                      q.isCorrect
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-red-500/5 border-red-500/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-dark-400">
                            Q{index + 1}
                          </span>
                          {q.isCorrect ? (
                            <CheckCircle size={16} className="text-emerald-400" />
                          ) : (
                            <XCircle size={16} className="text-red-400" />
                          )}
                          {/* Priority 31: Difficulty Badge */}
                          {getDifficultyBadge(difficulty)}
                        </div>
                        <p className="text-dark-200 mb-2">{q.question || 'No question text'}</p>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-dark-400">Your answer:</span>
                          <span className={`font-medium ${
                            q.isCorrect ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {q.userAnswer || 'Not answered'}
                          </span>
                        </div>
                        {q.explanation && (
                          <div className={`mt-2 p-2 rounded-lg text-sm ${
                            isDark ? 'bg-slate-800/50 text-gray-300' : 'bg-gray-100 text-gray-600'
                          }`}>
                            <span className="font-medium">Explanation:</span> {q.explanation}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
        {/* Priority 30: Save Quiz Button */}
        <button
          onClick={handleSaveQuiz}
          disabled={isSavingQuiz || !result?.questions}
          className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
            isSavingQuiz || !result?.questions
              ? 'bg-slate-700 text-gray-400 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {isSavingQuiz ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Saving Quiz...</span>
            </>
          ) : (
            <>
              <Save size={18} />
              <span>Save Quiz</span>
            </>
          )}
        </button>
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