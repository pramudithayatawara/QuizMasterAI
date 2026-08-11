import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Play, Search, Plus, Clock,
  FileText, TrendingUp, Filter, ArrowLeft,
  AlertCircle, RefreshCw, BarChart3, BookOpen,
  Target, Trophy, Award, ArrowUp, ArrowDown, Minus
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
import { cn, getDifficultyClass } from '../../utils/helpers.js';
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

  // Fetch Quizzes
  useEffect(() => {
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
        toast.error('Failed to load quizzes.');
        setQuizzes([]);
        setQuizError(error.message || 'Failed to load quizzes');
      } finally {
        setIsLoadingQuizzes(false);
      }
    };
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
          
          setPerformanceStats(statsRes.data?.data);
          setAdaptiveRecommendation(adaptiveRes.data?.data);
          setPerformanceError(null);
        } catch (error) {
          console.error('Failed to fetch performance data:', error);
          toast.error('Failed to load performance data');
          setPerformanceError(error.message || 'Failed to load performance data');
        } finally {
          setIsLoadingPerformance(false);
        }
      };
      fetchPerformanceData();
    }
  }, [activeTab]);

  const filteredQuizzes = (quizzes || []).filter((quiz) =>
    quiz?.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleQuizSelect = (quizId, pdfId) => {
    setSelectedQuizId(quizId);
    setSelectedPdfId(pdfId);
  };

  const handleBackToList = () => {
    setSelectedQuizId(null);
    setSelectedPdfId(null);
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
              className="mb-4 flex items-center gap-2 text-indigo-400 hover:text-indigo-300"
            >
              <ArrowLeft size={20} />
              Back to Quizzes
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
                onClick={() => window.location.reload()}
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
              : 'Upload a PDF to generate your first quiz.'
            }
            action={
              !searchQuery && (
                <Link to={ROUTES.QUIZ_CREATE}>
                  <Button variant="primary" leftIcon={<Plus size={18} />}>
                    Create Quiz
                  </Button>
                </Link>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredQuizzes.map((quiz, index) => (
              <motion.div
                key={quiz._id || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card hover padding="md" className="h-full flex flex-col group">
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 bg-primary-500/10 rounded-xl
                                    flex items-center justify-center flex-shrink-0
                                    group-hover:scale-110 transition-transform">
                      <Brain size={24} className="text-primary-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-dark-50 truncate mb-1">
                        {quiz.title || 'Untitled Quiz'}
                      </h3>
                      <span className={cn(
                        'difficulty-pill text-xs',
                        getDifficultyClass(quiz.difficulty)
                      )}>
                        {DIFFICULTY_CONFIG[quiz.difficulty]?.label || quiz.difficulty || 'Medium'}
                      </span>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-4 text-sm text-dark-400 mb-4">
                    <span className="flex items-center gap-1">
                      <FileText size={14} />
                      {quiz.totalQuestions || 0} questions
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      {quiz.timeLimit || 0} min
                    </span>
                  </div>

                  {/* Action */}
                  <div className="mt-auto flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      leftIcon={<Play size={16} />}
                      onClick={() => handleQuizSelect(quiz._id, quiz.pdfId)}
                    >
                      View Quiz
                    </Button>
                    <Link
                      to={ROUTES.QUIZ_PLAY.replace(':id', quiz._id || '')}
                      className="flex-1"
                    >
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        leftIcon={<TrendingUp size={16} />}
                      >
                        Start
                      </Button>
                    </Link>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );

  const PerformanceTab = () => (
    <div className="space-y-6">
      {isLoadingPerformance ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="xl" />
        </div>
      ) : performanceError ? (
        <EmptyState
          icon={AlertCircle}
          title="Error loading performance data"
          description={performanceError || 'Something went wrong. Please try again.'}
          action={
            <Button
              variant="primary"
              leftIcon={<RefreshCw size={18} />}
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          }
        />
      ) : (
        <>
          {/* Adaptive Status Banner */}
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

          {/* Performance Stats Grid */}
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
                <p className="text-2xl font-bold text-dark-50">{performanceStats.totalAttempts || 0}</p>
                <p className="text-sm text-dark-400 mt-0.5">Total Quizzes</p>
              </Card>

              <Card padding="md" hover>
                <div className="w-10 h-10 bg-secondary-500/10 rounded-xl flex items-center justify-center mb-3">
                  <Target size={20} className="text-secondary-400" />
                </div>
                <p className="text-2xl font-bold text-dark-50">{performanceStats.averageScore || 0}%</p>
                <p className="text-sm text-dark-400 mt-0.5">Average Score</p>
              </Card>

              <Card padding="md" hover>
                <div className="w-10 h-10 bg-accent-500/10 rounded-xl flex items-center justify-center mb-3">
                  <Trophy size={20} className="text-accent-400" />
                </div>
                <p className="text-2xl font-bold text-dark-50">{performanceStats.highestScore || 0}%</p>
                <p className="text-sm text-dark-400 mt-0.5">Highest Score</p>
              </Card>

              <Card padding="md" hover>
                <div className="w-10 h-10 bg-battle-500/10 rounded-xl flex items-center justify-center mb-3">
                  <Clock size={20} className="text-battle-400" />
                </div>
                <p className="text-2xl font-bold text-dark-50">{performanceStats.lowestScore || 0}%</p>
                <p className="text-sm text-dark-400 mt-0.5">Lowest Score</p>
              </Card>
            </motion.div>
          )}

          {/* Difficulty Distribution */}
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
                    <p className="text-2xl font-bold text-dark-50">{performanceStats.difficultyDistribution?.easy || 0}</p>
                    <p className="text-xs text-dark-400 mt-1">
                      {performanceStats.totalAttempts > 0 
                        ? `${Math.round(((performanceStats.difficultyDistribution?.easy || 0) / performanceStats.totalAttempts) * 100)}%`
                        : '0%'} of total
                    </p>
                  </div>

                  <div className={`p-4 rounded-xl border ${getDifficultyBg('medium')}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-dark-200">Medium</span>
                      <Target size={16} className={getDifficultyColor('medium')} />
                    </div>
                    <p className="text-2xl font-bold text-dark-50">{performanceStats.difficultyDistribution?.medium || 0}</p>
                    <p className="text-xs text-dark-400 mt-1">
                      {performanceStats.totalAttempts > 0 
                        ? `${Math.round(((performanceStats.difficultyDistribution?.medium || 0) / performanceStats.totalAttempts) * 100)}%`
                        : '0%'} of total
                    </p>
                  </div>

                  <div className={`p-4 rounded-xl border ${getDifficultyBg('hard')}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-dark-200">Hard</span>
                      <Award size={16} className={getDifficultyColor('hard')} />
                    </div>
                    <p className="text-2xl font-bold text-dark-50">{performanceStats.difficultyDistribution?.hard || 0}</p>
                    <p className="text-xs text-dark-400 mt-1">
                      {performanceStats.totalAttempts > 0 
                        ? `${Math.round(((performanceStats.difficultyDistribution?.hard || 0) / performanceStats.totalAttempts) * 100)}%`
                        : '0%'} of total
                    </p>
                  </div>
                </div>

                {/* Visual Bar */}
                <div className="h-3 bg-dark-700 rounded-full overflow-hidden flex">
                  {performanceStats.totalAttempts > 0 && (
                    <>
                      {(performanceStats.difficultyDistribution?.easy || 0) > 0 && (
                        <div 
                          className="bg-emerald-500 transition-all duration-300"
                          style={{ width: `${((performanceStats.difficultyDistribution?.easy || 0) / performanceStats.totalAttempts) * 100}%` }}
                        />
                      )}
                      {(performanceStats.difficultyDistribution?.medium || 0) > 0 && (
                        <div 
                          className="bg-blue-500 transition-all duration-300"
                          style={{ width: `${((performanceStats.difficultyDistribution?.medium || 0) / performanceStats.totalAttempts) * 100}%` }}
                        />
                      )}
                      {(performanceStats.difficultyDistribution?.hard || 0) > 0 && (
                        <div 
                          className="bg-purple-500 transition-all duration-300"
                          style={{ width: `${((performanceStats.difficultyDistribution?.hard || 0) / performanceStats.totalAttempts) * 100}%` }}
                        />
                      )}
                    </>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Attempt History */}
          {performanceStats?.recentAttempts && performanceStats.recentAttempts.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card padding="lg">
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={20} className="text-purple-400" />
                  <h3 className="text-lg font-semibold text-dark-200">Recent Attempts</h3>
                </div>
                
                <div className="space-y-3">
                  {performanceStats.recentAttempts.map((attempt, index) => (
                    <Link
                      key={attempt._id || index}
                      to={ROUTES.QUIZ_RESULT.replace(':id', attempt.quizId || '')}
                      className="block"
                    >
                      <Card hover padding="md" className="border border-dark-700 hover:border-purple-500/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-medium text-dark-50">
                                {attempt.quizTitle || 'Untitled Quiz'}
                              </h4>
                              <span className={cn(
                                'px-2 py-1 rounded-md text-xs font-medium border',
                                getDifficultyBg(attempt.difficulty)
                              )}>
                                {attempt.difficulty || 'Medium'}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-dark-400">
                              <span className="flex items-center gap-1">
                                <Clock size={14} />
                                {formatRelativeTime(attempt.completedAt)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Target size={14} />
                                {attempt.score || 0}%
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {attempt.adaptiveStatus && (
                              <div className="flex items-center gap-1 text-sm">
                                {getAdaptiveStatusIcon(attempt.adaptiveStatus)}
                                <span className="capitalize text-dark-400">
                                  {attempt.adaptiveStatus}
                                </span>
                              </div>
                            )}
                            <TrendingUp size={20} className="text-purple-400" />
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <EmptyState
                icon={Trophy}
                title="No attempts yet"
                description="Take some quizzes to see your performance history here."
                action={
                  <Button variant="primary" onClick={() => setActiveTab('browse')}>
                    Browse Quizzes
                  </Button>
                }
              />
            </motion.div>
          )}
        </>
      )}
    </div>
  );

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
        <Link to={ROUTES.QUIZ_CREATE}>
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