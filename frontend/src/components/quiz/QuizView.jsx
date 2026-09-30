import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp,
  FileText, Clock, Eye, AlertCircle, Play, RotateCcw, Info, Zap
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme.js';
import { quizAPI } from '../../api/quiz.api.js';
import { ROUTES } from '../../constants/routes.js';
import toast from 'react-hot-toast';
import { cn } from '../../utils/helpers.js';

/**
 * @component QuizView
 * @description Display generated quiz with questions, options, and context references.
 */
const QuizView = ({ quizId, pdfId, onClose }) => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [quiz, setQuiz] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [expandedContext, setExpandedContext] = useState({});
  const [viewMode, setViewMode] = useState('preview'); // 'preview' or 'test'
  const [showTooltip, setShowTooltip] = useState({});

  // ─── Difficulty Badge Helper - Module 04 ─────────────────────────────────────
  const getDifficultyBadge = (difficulty) => {
    const config = {
      easy: {
        label: 'Easy',
        className: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30'
      },
      medium: {
        label: 'Medium',
        className: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30'
      },
      hard: {
        label: 'Hard',
        className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30'
      }
    };
    return config[difficulty] || config.medium;
  };

  // ─── Bloom's Taxonomy Color Helper - Module 04 ────────────────────────────────
  const getBloomColor = (bloomsLevel) => {
    const colors = {
      'Remember': 'text-blue-400',
      'Understand': 'text-green-400',
      'Apply': 'text-yellow-400',
      'Analyze': 'text-orange-400',
      'Evaluate': 'text-red-400',
      'Create': 'text-purple-400'
    };
    return colors[bloomsLevel] || 'text-gray-400';
  };

  useEffect(() => {
    if (quizId) {
      fetchQuiz();
    }
  }, [quizId]);

  const fetchQuiz = async () => {
    setIsLoading(true);
    try {
      const response = await quizAPI.getQuizById(quizId);
      console.log('Quiz API Response:', response);
      
      // Handle different response structures safely
      let quizData = null;
      if (response?.data) {
        if (response.data.data?.quiz) {
          quizData = response.data.data.quiz;
        } else if (response.data.quiz) {
          quizData = response.data.quiz;
        } else if (response.data.data && typeof response.data.data === 'object' && !Array.isArray(response.data.data)) {
          quizData = response.data.data;
        } else if (typeof response.data === 'object' && (response.data.id || response.data._id || response.data.title)) {
          quizData = response.data;
        }
      }
      
      if (quizData && Array.isArray(quizData.questions)) {
        quizData.questions = quizData.questions.map((q, idx) => ({
          ...q,
          _id: q._id || String(q.id || idx + 1),
          id: q.id || q._id || idx + 1,
          question: q.question || q.question_text || q.questionText || 'Quiz Question',
          questionText: q.questionText || q.question_text || q.question || 'Quiz Question',
          correctAnswer: q.correctAnswer || q.correct_answer || '',
          options: Array.isArray(q.options) ? q.options : [],
          type: q.type || q.question_type || 'mcq',
          difficulty: q.difficulty || 'medium',
          explanation: q.explanation || ''
        }));
        quizData.totalQuestions = quizData.totalQuestions || quizData.total_questions || quizData.questions.length;
        quizData.timeLimit = quizData.timeLimit || quizData.time_limit || Math.max(2, Math.round(quizData.questions.length * 1.5));
      }

      console.log('Extracted & Normalized Quiz Data:', quizData);
      setQuiz(quizData);
    } catch (error) {
      console.error('Quiz fetch error:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch quiz');
      setQuiz(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!pdfId) return;
    
    setIsGenerating(true);
    try {
      toast.loading('Generating quiz... This may take 10-15 seconds.', { id: 'quiz-generation' });
      const response = await quizAPI.generateQuiz({ pdfId, questionCount: 10 });
      toast.dismiss('quiz-generation');
      toast.success('Quiz generated successfully!');
      
      // Handle different response structures safely
      let quizData = null;
      if (response?.data) {
        if (response.data.data?.quiz) {
          quizData = response.data.data.quiz;
        } else if (response.data.quiz) {
          quizData = response.data.quiz;
        } else if (response.data.data) {
          quizData = response.data.data;
        }
      }
      
      setQuiz(quizData);
      setIsGenerating(false);
    } catch (error) {
      toast.dismiss('quiz-generation');
      toast.error(error.response?.data?.message || 'Failed to generate quiz');
      setIsGenerating(false);
      setQuiz(null);
    }
  };

  const handleAnswerSelect = (questionId, answer) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleSubmitQuiz = () => {
    if (!quiz?.questions) {
      toast.error('Quiz data not available');
      return;
    }
    
    const answeredCount = Object.keys(selectedAnswers).length;
    if (answeredCount < quiz.questions.length) {
      toast.error(`Please answer all questions (${answeredCount}/${quiz.questions.length} answered)`);
      return;
    }
    
    setShowResults(true);
    toast.success('Quiz submitted successfully!');
  };

  const handleResetQuiz = () => {
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);
    setShowResults(false);
  };

  const toggleContext = (questionId) => {
    setExpandedContext(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  const getContextForQuestion = (question) => {
    if (!quiz?.contextReferences || !question?.sourceChunkIndex) return null;
    
    const contextRef = quiz.contextReferences.find(
      ref => ref.chunkIndex === question.sourceChunkIndex
    );
    
    return contextRef || null;
  };

  const getScore = () => {
    if (!quiz?.questions || !showResults) return { correct: 0, total: 0, totalQuestions: 0, percentage: 0 };
    
    let correct = 0;
    quiz.questions.forEach((question) => {
      const userAnswer = selectedAnswers[question._id];
      if (userAnswer && (userAnswer === question.correctAnswer || String(userAnswer).toLowerCase() === String(question.correctAnswer).toLowerCase())) {
        correct++;
      }
    });
    
    return {
      correct,
      total: quiz.questions.length,
      totalQuestions: quiz.questions.length,
      percentage: quiz.questions.length > 0 ? Math.round((correct / quiz.questions.length) * 100) : 0
    };
  };

  const getStatusBadge = (type) => {
    const config = {
      mcq: {
        label: 'MCQ',
        className: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      },
      true_false: {
        label: 'True/False',
        className: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      }
    };
    
    const badgeConfig = config[type] || config.mcq;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${badgeConfig.className}`}>
        {badgeConfig.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
        <div className="text-center">
          <p className={`font-medium ${isDark ? 'text-white' : 'text-light-900'}`}>
            Generating Quiz...
          </p>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-light-600'}`}>
            This may take 10-15 seconds
          </p>
        </div>
      </div>
    );
  }

  if (!quiz && pdfId) {
    return (
      <div className="text-center py-16 space-y-4">
        <Brain className="w-16 h-16 mx-auto text-indigo-400" />
        <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-light-900'}`}>
          No Quiz Generated Yet
        </h3>
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-light-600'}`}>
          Generate a quiz from this PDF to test your knowledge
        </p>
        <button
          onClick={handleGenerateQuiz}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors"
        >
          <Brain size={20} />
          Generate Quiz
        </button>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="text-center py-16 space-y-4">
        <AlertCircle className="w-16 h-16 mx-auto text-red-400" />
        <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-light-900'}`}>
          Quiz Not Available
        </h3>
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-light-600'}`}>
          Unable to load quiz data. Please try again.
        </p>
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-medium rounded-xl transition-colors"
        >
          <RotateCcw size={20} />
          Go Back
        </button>
      </div>
    );
  }

  const score = getScore();

  return (
    <div className="space-y-6">
      {/* Quiz Header */}
      <div className={`${isDark ? 'bg-slate-800/40 border-white/10' : 'bg-white/40 border-light-300'} backdrop-blur-md rounded-2xl p-6`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-light-900'}`}>
              {quiz.title || 'Untitled Quiz'}
            </h2>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className={`${isDark ? 'text-slate-400' : 'text-light-600'}`}>
                <Clock size={14} className="inline mr-1" />
                {quiz.timeLimit || 0} minutes
              </span>
              <span className={`${isDark ? 'text-slate-400' : 'text-light-600'}`}>
                <FileText size={14} className="inline mr-1" />
                {quiz.totalQuestions || 0} questions
              </span>
              <span className={`${isDark ? 'text-slate-400' : 'text-light-600'}`}>
                {quiz.mcqCount || 0} MCQs • {quiz.trueFalseCount || 0} True/False
              </span>
            </div>
            
            {/* Module 04: Difficulty Breakdown */}
            {quiz.difficultyBreakdown && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-light-600'}`}>Difficulty Distribution</span>
                  <div className="flex gap-2 text-xs">
                    <span className="text-emerald-400">Easy: {quiz.difficultyBreakdown.easy || 0}</span>
                    <span className="text-yellow-400">Medium: {quiz.difficultyBreakdown.medium || 0}</span>
                    <span className="text-red-400">Hard: {quiz.difficultyBreakdown.hard || 0}</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden flex">
                  {quiz.difficultyBreakdown.easy > 0 && (
                    <div 
                      className="bg-emerald-500 transition-all duration-300"
                      style={{ width: `${(quiz.difficultyBreakdown.easy / (quiz.totalQuestions || 1)) * 100}%` }}
                    />
                  )}
                  {quiz.difficultyBreakdown.medium > 0 && (
                    <div 
                      className="bg-yellow-500 transition-all duration-300"
                      style={{ width: `${(quiz.difficultyBreakdown.medium / (quiz.totalQuestions || 1)) * 100}%` }}
                    />
                  )}
                  {quiz.difficultyBreakdown.hard > 0 && (
                    <div 
                      className="bg-red-500 transition-all duration-300"
                      style={{ width: `${(quiz.difficultyBreakdown.hard / (quiz.totalQuestions || 1)) * 100}%` }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'preview' ? 'test' : 'preview')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'preview'
                  ? `${isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-light-200 hover:bg-light-300 text-light-700'}`
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {viewMode === 'preview' ? <Play size={16} /> : <Eye size={16} />}
              {viewMode === 'preview' ? 'Start Quiz' : 'Preview Mode'}
            </button>
            
            {viewMode === 'test' && !showResults && (
              <button
                onClick={handleSubmitQuiz}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                <CheckCircle size={16} />
                Submit Quiz
              </button>
            )}
            
            {showResults && (
              <button
                onClick={handleResetQuiz}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                <RotateCcw size={16} />
                Retake Quiz
              </button>
            )}
          </div>
        </div>

        {/* Score Display */}
        {showResults && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 p-4 rounded-xl ${
              score.percentage >= 70
                ? 'bg-emerald-500/20 border-emerald-500/30'
                : score.percentage >= 50
                ? 'bg-yellow-500/20 border-yellow-500/30'
                : 'bg-red-500/20 border-red-500/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {score.percentage >= 70 ? (
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                ) : score.percentage >= 50 ? (
                  <AlertCircle className="w-6 h-6 text-yellow-400" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-400" />
                )}
                <span className={`font-semibold ${isDark ? 'text-white' : 'text-light-900'}`}>
                  {score.correct} / {score.totalQuestions} Correct
                </span>
              </div>
              <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-light-900'}`}>
                {score.percentage}%
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {(quiz.questions || []).map((question, index) => {
          const contextRef = getContextForQuestion(question);
          const userAnswer = selectedAnswers[question._id];
          const isCorrect = userAnswer === question.correctAnswer;
          const isExpanded = expandedContext[question._id];

          return (
            <motion.div
              key={question._id || index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`${isDark ? 'bg-slate-800/40 border-white/10' : 'bg-white/40 border-light-300'} backdrop-blur-md rounded-2xl p-6`}
            >
              {/* Question Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-light-600'}`}>
                      Q{index + 1}
                    </span>
                    {getStatusBadge(question.type)}
                    
                    {/* Module 04: Difficulty Badge */}
                    {question.difficulty && (
                      <span className={cn(
                        'px-2.5 py-1 rounded-md text-xs font-semibold border',
                        getDifficultyBadge(question.difficulty).className
                      )}>
                        {getDifficultyBadge(question.difficulty).label}
                      </span>
                    )}

                    {/* Module 04: Bloom's Taxonomy Badge */}
                    {question.bloomsTaxonomy && (
                      <span className={cn(
                        'px-2.5 py-1 rounded-md text-xs font-medium bg-slate-700 border border-slate-600',
                        getBloomColor(question.bloomsTaxonomy)
                      )}>
                        Bloom's: {question.bloomsTaxonomy}
                      </span>
                    )}

                    {/* Module 04: Classification Reason Tooltip */}
                    {question.classificationReason && (
                      <div className="relative">
                        <button
                          className="p-1.5 rounded-md bg-slate-700 border border-slate-600 hover:bg-slate-600 transition-colors"
                          onMouseEnter={() => setShowTooltip(prev => ({ ...prev, [question._id]: true }))}
                          onMouseLeave={() => setShowTooltip(prev => ({ ...prev, [question._id]: false }))}
                        >
                          <Info size={14} className="text-slate-400" />
                        </button>
                        {showTooltip[question._id] && (
                          <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-10">
                            <p className="text-xs text-slate-200 leading-relaxed">
                              <span className="font-semibold text-slate-400">Classification:</span> {question.classificationReason}
                            </p>
                            <div className="absolute bottom-0 left-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-slate-800 border-r border-b border-slate-600"></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className={`text-lg ${isDark ? 'text-white' : 'text-light-900'} leading-relaxed`}>
                    {question.questionText || 'Question text not available'}
                  </p>
                </div>
                
                {viewMode === 'preview' && contextRef && (
                  <button
                    onClick={() => toggleContext(question._id)}
                    className={`ml-4 p-2 rounded-lg transition-colors ${
                      isExpanded
                        ? 'bg-indigo-500/20 text-indigo-400'
                        : `${isDark ? 'bg-slate-700/50 hover:bg-slate-700 text-slate-300' : 'bg-light-200 hover:bg-light-300 text-light-700'}`
                    }`}
                  >
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                )}
              </div>

              {/* Context Reference Accordion */}
              {viewMode === 'preview' && contextRef && (
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`mt-4 p-4 rounded-xl ${isDark ? 'bg-slate-900/50 border-white/10' : 'bg-light-100 border-light-300'}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <FileText size={16} className="text-indigo-400" />
                        <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-light-900'}`}>
                          Context Source (Chunk {contextRef.chunkIndex})
                        </span>
                        <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-light-600'}`}>
                          Relevance: {Math.round(contextRef.relevanceScore * 100)}%
                        </span>
                      </div>
                      <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-light-700'} leading-relaxed`}>
                        {contextRef.text}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {/* Options */}
              <div className="mt-4 space-y-2">
                {(() => {
                  let optionsList = [];
                  if (Array.isArray(question.options)) {
                    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
                    optionsList = question.options.map((opt, i) => ({
                      key: letters[i] || String(i + 1),
                      val: typeof opt === 'string' ? opt : (opt?.text || opt?.label || String(opt)),
                      raw: opt
                    }));
                  } else if (question.options instanceof Map) {
                    optionsList = Array.from(question.options.entries()).map(([k, v]) => ({ key: k, val: v, raw: v }));
                  } else if (typeof question.options === 'object' && question.options !== null) {
                    optionsList = Object.entries(question.options).map(([k, v]) => ({ key: k, val: v, raw: v }));
                  }
                  
                  return optionsList.map(({ key, val }) => {
                    const isSelected = userAnswer === key || userAnswer === val;
                    const isCorrectOption = (
                      question.correctAnswer === key ||
                      question.correctAnswer === val ||
                      String(question.correctAnswer).trim().toLowerCase() === String(val).trim().toLowerCase()
                    );
                    
                    let optionClassName = '';
                    let icon = null;
                    
                    if (viewMode === 'test' && !showResults) {
                      // Test mode - show selection state
                      optionClassName = isSelected
                        ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400'
                        : `${isDark ? 'bg-slate-700/50 border-white/10 hover:bg-slate-700 text-slate-300' : 'bg-light-200 border-light-300 hover:bg-light-300 text-light-700'}`;
                    } else if (showResults) {
                      // Results mode - show correct/incorrect
                      if (isCorrectOption) {
                        optionClassName = 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400';
                        icon = <CheckCircle size={16} />;
                      } else if (isSelected && !isCorrectOption) {
                        optionClassName = 'bg-red-500/20 border-red-500/50 text-red-400';
                        icon = <XCircle size={16} />;
                      } else {
                        optionClassName = `${isDark ? 'bg-slate-700/30 border-white/5' : 'bg-light-200 border-light-300'} ${isDark ? 'text-slate-400' : 'text-light-600'}`;
                      }
                    } else {
                      // Preview mode - show correct answer
                      optionClassName = isCorrectOption
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 font-medium'
                        : `${isDark ? 'bg-slate-700/30 border-white/5' : 'bg-light-200 border-light-300'} ${isDark ? 'text-slate-400' : 'text-light-600'}`;
                      if (isCorrectOption) icon = <CheckCircle size={16} className="text-emerald-400" />;
                    }

                    return (
                      <button
                        key={key}
                        onClick={() => viewMode === 'test' && !showResults && handleAnswerSelect(question._id, val)}
                        disabled={viewMode === 'test' && showResults}
                        className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group ${
                          optionClassName
                        } ${viewMode === 'test' && !showResults ? 'cursor-pointer hover:scale-[1.01]' : 'cursor-default'}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-sm opacity-80">{key}.</span>
                          <span className="flex-1">{val || 'Option not available'}</span>
                        </div>
                        {icon && <span className="ml-2">{icon}</span>}
                      </button>
                    );
                  });
                })()}
              </div>

              {/* Explanation */}
              {showResults && question.explanation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={`mt-4 p-4 rounded-xl ${isDark ? 'bg-slate-900/50 border-white/10' : 'bg-light-100 border-light-300'}`}
                >
                  <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-light-700'}`}>
                    <span className="font-medium">Explanation:</span> {question.explanation || 'No explanation available'}
                  </p>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default QuizView;