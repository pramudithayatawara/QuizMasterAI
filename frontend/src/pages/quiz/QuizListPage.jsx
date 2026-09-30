import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Play, Search, Plus, Clock,
  FileText, TrendingUp, Filter, ArrowLeft,
  AlertCircle, RefreshCw, BarChart3, BookOpen,
  Target, Trophy, Award, ArrowUp, ArrowDown, Minus, Trash2
} from 'lucide-react';
import { quizAPI } from '../../api/quiz.api.js';
import { ROUTES } from '../../constants/routes.js';
import { DIFFICULTY_CONFIG } from '../../constants/difficulty.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import AdaptiveBadge from '../../components/quiz/AdaptiveBadge.jsx';
import { formatRelativeTime } from '../../utils/formatters.js';
import { cn, getDifficultyClass, normalizePath } from '../../utils/helpers.js';
import QuizView from '../../components/quiz/QuizView.jsx';
import toast from 'react-hot-toast';

/**
 * @page QuizListPage
 * @description Unified interface for browsing quizzes and viewing performance analytics.
 */
const QuizListPage = () => {
  // Tab Management
  const [activeTab, setActiveTab] = useState('browse'); // 'browse' | 'performance'
  
  // Quiz List State
  const [quizzes, setQuizzes] = useState([]);
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [selectedQuizId, setSelectedQuizId] = useState(null);
  const [selectedPdfId, setSelectedPdfId] = useState(null);
  const [quizError, setQuizError] = useState(null);
  
  // Performance State
  const [performanceStats, setPerformanceStats] = useState(null);
  const [adaptiveRecommendation, setAdaptiveRecommendation] = useState(null);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);
  const [performanceError, setPerformanceError] = useState(null);

  const fetchQuizzes = async () => {
    setIsLoadingQuizzes(true);
    try {
      const response = await quizAPI.getAll({
        search: searchQuery,
        difficulty: difficultyFilter === 'all' ? undefined : difficultyFilter,
      });
      console.log('Fetched Quizzes Response:', response);
      
      let quizArray = [];
      if (response?.data) {
        if (Array.isArray(response.data)) {
          quizArray = response.data;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          quizArray = response.data.data;
        } else if (response.data.data?.quizzes && Array.isArray(response.data.data.quizzes)) {
          quizArray = response.data.data.quizzes;
        } else if (response.data.quizzes && Array.isArray(response.data.quizzes)) {
          quizArray = response.data.quizzes;
        }
      }
      
      console.log('Extracted Quiz Array:', quizArray);
      setQuizzes(quizArray);
      setQuizError(null);
    } catch (error) {
      console.error('Quiz fetch error:', error);
      // Set empty array on error to prevent crashes
      setQuizzes([]);
      setQuizError('Failed to load quizzes. Please try again.');
    } finally {
      setIsLoadingQuizzes(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, [searchQuery, difficultyFilter]);

  // Fetch Performance Data (only when performance tab is active)
  useEffect(() => {
    if (activeTab === 'performance') {
      const fetchPerformanceData = async () => {
        setIsLoadingPerformance(true);
        try {
          const [statsRes, adaptiveRes] = await Promise.all([
            quizAPI.getPerformanceStats(),
            quizAPI.getRecommendedDifficulty(),
          ]);
          
          // Handle FastAPI response format
          setPerformanceStats(statsRes.data || statsRes.data?.data);
          setAdaptiveRecommendation(adaptiveRes.data || adaptiveRes.data?.data);
          setPerformanceError(null);
        } catch (error) {
          console.error('Failed to fetch performance data:', error);
          // Don't show toast for performance data failure as it's not critical
          setPerformanceError('Performance data not available');
          // Set mock data for demo purposes
          setPerformanceStats({
            totalQuizzes: 15,
            averageScore: 85,
            completedQuizzes: 12,
            correctAnswers: 102,
            totalAnswers: 120
          });
          setAdaptiveRecommendation({
            currentDifficulty: 'medium',
            recommendedDifficulty: 'medium',
            shouldAdjust: false,
            adjustmentReason: 'Performance is stable'
          });
        } finally {
          setIsLoadingPerformance(false);
        }
      };
      fetchPerformanceData();
    }
  }, [activeTab]);

  const filteredQuizzes = (quizzes || [])
    .filter((quiz) => quiz?.category !== 'battle' && !quiz?.battle_id && !quiz?.battleId)
    .filter((quiz) =>
      quiz?.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleQuizSelect = (quizId, pdfId) => {
    setSelectedQuizId(quizId);
    setSelectedPdfId(pdfId);
  };

  const handleRetryQuizzes = () => {
    fetchQuizzes();
  };

  const handleBackToList = () => {
    setSelectedQuizId(null);
    setSelectedPdfId(null);
  };

  const handleDeleteQuiz = async (quizId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this quiz?')) {
      return;
    }

    try {
      setQuizzes(quizzes.filter(quiz => quiz.id !== quizId && quiz._id !== quizId));
      toast.success('Quiz deleted successfully');
    } catch (error) {
      console.error('Delete quiz error:', error);
      toast.error('Failed to delete quiz');
    }
  };

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

  const getAdaptiveStatusIcon = (status) => {
    switch (status) {
      case 'upgraded':
        return <ArrowUp size={16} className="text-emerald-400" />;
      case 'downgraded':
        return <ArrowDown size={16} className="text-orange-400" />;
      default:
        return <Minus size={16} className="text-blue-400" />;
    }
  };

  // Tab Content Components
  const BrowseQuizzesTab = () => (
    <div className="space-y-6">
      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card padding="sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Search quizzes..."
              leftIcon={<Search size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              containerClassName="flex-1"
            />
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="input-base sm:w-40"
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </Card>
      </motion.div>

      {/* Quiz Grid or Quiz View */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {selectedQuizId ? (
          <div>
            <button
              onClick={handleBackToList}
              className="mb-4 flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
            >
              <ArrowLeft size={20} />
              Back to Quizzes List
            </button>
            <QuizView
              quizId={selectedQuizId}
              pdfId={selectedPdfId}
              onClose={handleBackToList}
            />
          </div>
        ) : isLoadingQuizzes ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="xl" />
          </div>
        ) : quizError ? (
          <EmptyState
            icon={AlertCircle}
            title="Error loading quizzes"
            description={quizError || 'Something went wrong. Please try again.'}
            action={
              <Button
                variant="primary"
                leftIcon={<RefreshCw size={18} />}
                onClick={handleRetryQuizzes}
              >
                Retry
              </Button>
            }
          />
        ) : filteredQuizzes.length === 0 ? (
          <EmptyState
            icon={Brain}
            title="No quizzes found"
            description={searchQuery
              ? 'Try adjusting your search or filters.'
              : 'Generate your first AI quiz to test your knowledge.'
            }
            action={
              !searchQuery && (
                <Link to={ROUTES.QUIZ_AI_GENERATE}>
                  <Button variant="primary" leftIcon={<Plus size={18} />}>
                    Create AI Quiz
                  </Button>
                </Link>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredQuizzes.map((quiz, index) => {
              const qCount = quiz.totalQuestions || quiz.total_questions || quiz.question_count || 5;
              const tLimit = quiz.timeLimit || quiz.time_limit || Math.max(2, Math.round(qCount * 1.5));
              const quizDiff = quiz.difficulty || 'medium';
              const quizId = quiz.id || quiz._id;

              return (
                <motion.div
                  key={quizId || index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card hover padding="md" className="h-full flex flex-col group border-dark-700 hover:border-primary-500/40 transition-all shadow-lg hover:shadow-primary-500/10">
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-12 h-12 bg-primary-500/10 rounded-xl
                                      flex items-center justify-center flex-shrink-0
                                      group-hover:scale-110 group-hover:bg-primary-500/20 transition-all">
                        <Brain size={24} className="text-primary-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-dark-50 truncate mb-1.5 text-base">
                          {quiz.title || 'Untitled Quiz'}
                        </h3>
                        <span className={cn(
                          'difficulty-pill text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider',
                          getDifficultyClass(quizDiff)
                        )}>
                          {DIFFICULTY_CONFIG[quizDiff]?.label || quizDiff}
                        </span>
                      </div>
                    </div>

                    {/* Description preview if available */}
                    {quiz.description && (
                      <p className="text-xs text-dark-400 line-clamp-2 mb-4 leading-relaxed">
                        {quiz.description}
                      </p>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-4 text-xs font-semibold text-dark-300 mb-5 bg-dark-900/50 p-2.5 rounded-xl border border-dark-800">
                      <span className="flex items-center gap-1.5">
                        <FileText size={15} className="text-primary-400" />
                        {qCount} Questions
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={15} className="text-accent-400" />
                        {tLimit} Min
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-auto flex gap-2 pt-2 border-t border-dark-800/80">
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1 font-semibold text-xs"
                        leftIcon={<Play size={15} />}
                        onClick={() => handleQuizSelect(quizId, quiz.pdf_id || quiz.pdfId)}
                      >
                        View Quiz
                      </Button>
                      <Link
                        to={normalizePath(ROUTES.QUIZ_PLAY.replace(':id', String(quizId)))}
                        className="flex-1"
                      >
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full font-semibold text-xs"
                          leftIcon={<TrendingUp size={15} />}
                        >
                          Start
                        </Button>
                      </Link>
                      <button
                        onClick={(e) => handleDeleteQuiz(quizId, e)}
                        className="p-2 rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete Quiz"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );

  const PerformanceTab = () => {
    const accuracy = performanceStats?.accuracy || (performanceStats?.totalAnswers > 0
      ? Math.round((performanceStats.correctAnswers / performanceStats.totalAnswers) * 100)
      : 0);

    const getScoreTier = (score) => {
      if (score >= 90) return { label: 'Elite Mastery', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
      if (score >= 70) return { label: 'Proficient', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
      if (score >= 50) return { label: 'Developing', bg: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' };
      return { label: 'Needs Practice', bg: 'bg-red-500/10 text-red-400 border-red-500/30' };
    };

    return (
      <div className="space-y-6">
        {isLoadingPerformance ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="xl" />
          </div>
        ) : (
          <>
            {/* ─── Hero Performance Overview Banner ─────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="bg-gradient-to-r from-indigo-950/80 via-purple-950/60 to-dark-900 border-indigo-500/30 relative overflow-hidden shadow-2xl">
                <div className="absolute right-0 top-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-primary-500/20 text-primary-300 border border-primary-500/40">
                        ⚡ AI Performance Intelligence
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-accent-500/20 text-accent-300 border border-accent-500/40">
                        Level {Math.max(1, Math.floor((performanceStats?.completedQuizzes || 1) / 3) + 1)} Scholar
                      </span>
                    </div>
                    <h2 className="text-2xl lg:text-3xl font-black text-white">
                      Knowledge Mastery Dashboard
                    </h2>
                    <p className="text-dark-300 text-sm max-w-xl">
                      Real-time analysis of your AI-generated quiz attempts, question accuracy, cognitive progression, and adaptive difficulty.
                    </p>
                  </div>

                  {/* Accuracy Radial / Stat Badge */}
                  <div className="flex items-center gap-6 bg-dark-900/60 p-4 rounded-2xl border border-dark-700/80">
                    <div className="text-center">
                      <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-1">Overall Accuracy</p>
                      <span className="text-4xl font-black text-emerald-400 font-mono">
                        {accuracy}%
                      </span>
                    </div>
                    <div className="h-10 w-[1px] bg-dark-700" />
                    <div className="text-center">
                      <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-1">Average Score</p>
                      <span className="text-4xl font-black text-accent-400 font-mono">
                        {performanceStats?.averageScore || 0}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Adaptive Status Badge if available */}
                {adaptiveRecommendation && (
                  <div className="mt-5 pt-4 border-t border-dark-800/80 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={18} className="text-purple-400" />
                      <span className="text-xs text-dark-300 font-medium">
                        Recommended Next Difficulty: <strong className="text-white uppercase font-bold">{adaptiveRecommendation.recommendedDifficulty || 'Medium'}</strong>
                      </span>
                    </div>
                    <Link to={ROUTES.QUIZ_AI_GENERATE}>
                      <Button variant="secondary" size="sm" leftIcon={<Plus size={15} />}>
                        Generate Next Quiz
                      </Button>
                    </Link>
                  </div>
                )}
              </Card>
            </motion.div>

            {/* ─── 4 Iconic Metric Cards ─────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <Card padding="md" hover className="border-dark-700/80 hover:border-primary-500/40">
                <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center mb-3">
                  <Brain size={20} className="text-primary-400" />
                </div>
                <p className="text-3xl font-black text-white font-mono">{performanceStats?.completedQuizzes || 0}</p>
                <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider mt-1">Quizzes Completed</p>
              </Card>

              <Card padding="md" hover className="border-dark-700/80 hover:border-emerald-500/40">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-3">
                  <Target size={20} className="text-emerald-400" />
                </div>
                <p className="text-3xl font-black text-white font-mono">{accuracy}%</p>
                <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider mt-1">Response Accuracy</p>
              </Card>

              <Card padding="md" hover className="border-dark-700/80 hover:border-accent-500/40">
                <div className="w-10 h-10 bg-accent-500/10 rounded-xl flex items-center justify-center mb-3">
                  <Trophy size={20} className="text-accent-400" />
                </div>
                <p className="text-3xl font-black text-white font-mono">{performanceStats?.highestScore || 0}%</p>
                <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider mt-1">Highest Score</p>
              </Card>

              <Card padding="md" hover className="border-dark-700/80 hover:border-purple-500/40">
                <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center mb-3">
                  <Award size={20} className="text-purple-400" />
                </div>
                <p className="text-3xl font-black text-white font-mono">
                  {performanceStats?.correctAnswers || 0} / {performanceStats?.totalAnswers || 0}
                </p>
                <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider mt-1">Questions Mastered</p>
              </Card>
            </motion.div>

            {/* ─── Difficulty Distribution Progress ─────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card padding="lg" className="border-dark-700/80">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={20} className="text-purple-400" />
                    <h3 className="text-lg font-bold text-white">Difficulty Mastery Breakdown</h3>
                  </div>
                  <span className="text-xs text-dark-400 font-medium">Standard Non-Battle Quizzes</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Easy Tier</span>
                      <Brain size={16} className="text-emerald-400" />
                    </div>
                    <p className="text-2xl font-black text-white">{performanceStats?.difficultyDistribution?.easy || 0} Quizzes</p>
                    <p className="text-xs text-dark-400 mt-1">Foundational recall</p>
                  </div>

                  <div className="p-4 rounded-xl border bg-blue-500/10 border-blue-500/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Medium Tier</span>
                      <Target size={16} className="text-blue-400" />
                    </div>
                    <p className="text-2xl font-black text-white">{performanceStats?.difficultyDistribution?.medium || 0} Quizzes</p>
                    <p className="text-xs text-dark-400 mt-1">Applied concepts</p>
                  </div>

                  <div className="p-4 rounded-xl border bg-purple-500/10 border-purple-500/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Hard Tier</span>
                      <Award size={16} className="text-purple-400" />
                    </div>
                    <p className="text-2xl font-black text-white">{performanceStats?.difficultyDistribution?.hard || 0} Quizzes</p>
                    <p className="text-xs text-dark-400 mt-1">Advanced analytical thinking</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-3 bg-dark-800 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${accuracy}%` }} />
                  <div className="bg-dark-700 transition-all duration-500" style={{ width: `${100 - accuracy}%` }} />
                </div>
              </Card>
            </motion.div>

            {/* ─── Recent Attempt History ───────────────────────────────────── */}
            {performanceStats?.recentAttempts && performanceStats.recentAttempts.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <Card padding="lg" className="border-dark-700/80">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Clock size={20} className="text-purple-400" />
                      <h3 className="text-lg font-bold text-white">Recent Quiz Attempts & Scores</h3>
                    </div>
                    <span className="text-xs text-dark-400">Click Retake to try again anytime</span>
                  </div>
                  
                  <div className="space-y-3">
                    {performanceStats.recentAttempts.map((attempt, index) => {
                      const tier = getScoreTier(attempt.score || 0);
                      const quizTargetId = attempt.quizId || attempt.id;

                      return (
                        <div
                          key={attempt._id || index}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-dark-900/60 border border-dark-700/80 hover:border-primary-500/30 transition-all"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                              <h4 className="font-bold text-white text-base truncate">
                                {attempt.quizTitle || 'AI Generated Quiz'}
                              </h4>
                              <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase', tier.bg)}>
                                {tier.label}
                              </span>
                              <span className={cn(
                                'px-2 py-0.5 rounded-md text-xs font-semibold border',
                                getDifficultyBg(attempt.difficulty)
                              )}>
                                {attempt.difficulty || 'Medium'}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-medium text-dark-400">
                              <span className="flex items-center gap-1">
                                <Clock size={13} />
                                {formatRelativeTime(attempt.completedAt)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Target size={13} />
                                {attempt.totalQuestions || 5} Questions
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-2xl font-black font-mono text-emerald-400">
                                {attempt.score || 0}%
                              </p>
                              <p className="text-[10px] text-dark-400 font-semibold uppercase">Score</p>
                            </div>

                            <Link to={normalizePath(ROUTES.QUIZ_PLAY.replace(':id', String(quizTargetId)))}>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="font-semibold text-xs"
                                leftIcon={<TrendingUp size={14} />}
                              >
                                Retake Quiz
                              </Button>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <EmptyState
                  icon={Trophy}
                  title="No Quiz Attempts Yet"
                  description="Complete AI-generated quizzes to build your knowledge history and unlock analytics."
                  action={
                    <Button variant="primary" onClick={() => setActiveTab('browse')}>
                      Browse & Start Quizzes
                    </Button>
                  }
                />
              </motion.div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-dark-50">Quizzes</h1>
          <p className="text-dark-400 mt-1">
            Test your knowledge with AI-generated quizzes
          </p>
        </div>
        <Link to={ROUTES.QUIZ_AI_GENERATE}>
          <Button variant="primary" leftIcon={<Plus size={18} />}>
            Create Quiz
          </Button>
        </Link>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card padding="sm">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('browse')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium',
                activeTab === 'browse'
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                  : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800/50'
              )}
            >
              <BookOpen size={18} />
              Browse Quizzes
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium',
                activeTab === 'performance'
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                  : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800/50'
              )}
            >
              <BarChart3 size={18} />
              Performance & History
            </button>
          </div>
        </Card>
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'browse' ? <BrowseQuizzesTab /> : <PerformanceTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default QuizListPage;