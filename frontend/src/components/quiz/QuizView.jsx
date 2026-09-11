import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp,
  FileText, Clock, Eye, AlertCircle, Play, RotateCcw, Info,
  Lightbulb, Sparkles, HelpCircle, ArrowRight, LogOut
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme.js';
import { quizAPI } from '../../api/quiz.api.js';
import { ROUTES } from '../../constants/routes.js';
import toast from 'react-hot-toast';
import { cn } from '../../utils/helpers.js';

/**
 * Robust helper to verify whether an answer matches the correct answer
 */
const checkIsCorrectAnswer = (userKey, optionText, correctAnswer, options) => {
  if (!userKey || !correctAnswer) return false;
  
  const normCorrect = String(correctAnswer).trim().toUpperCase();
  const normKey = String(userKey).trim().toUpperCase();
  
  // 1. Direct letter match (e.g. 'A' === 'A')
  if (normKey === normCorrect) return true;

  // 2. Direct string match with option text ('True' === 'True', or exact text)
  if (optionText && String(optionText).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase()) {
    return true;
  }

  // 3. Match against options map or object
  if (options) {
    const rawVal = options instanceof Map ? options.get(userKey) : options[userKey];
    if (rawVal && String(rawVal).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase()) {
      return true;
    }
  }

  return false;
};

/**
 * @component QuizView
 * @description Display generated quiz with interactive knowledge testing, instant feedback, retry option, and context references.
 */
const QuizView = ({ quizId, pdfId, onClose }) => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [quiz, setQuiz] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedContext, setExpandedContext] = useState({});
  const [showTooltip, setShowTooltip] = useState({});

  // ─── Interactive Knowledge Test State ──────────────────────────────────────
  // questionStates[qId]: { selectedKey: 'A', status: 'unanswered' | 'correct' | 'wrong' | 'revealed' }
  const [questionStates, setQuestionStates] = useState({});

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
      
      let quizData = null;
      if (response?.data) {
        if (response.data.data?.quiz) {
          quizData = response.data.data.quiz;
        } else if (response.data.quiz) {
          quizData = response.data.quiz;
        } else if (response.data.data) {
          quizData = response.data.data;
        } else if (typeof response.data === 'object' && response.data._id) {
          quizData = response.data;
        }
      }
      
      setQuiz(quizData);
      // Reset interactive state when loading a new quiz
      setQuestionStates({});
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
      setQuestionStates({});
      setIsGenerating(false);
    } catch (error) {
      toast.dismiss('quiz-generation');
      toast.error(error.response?.data?.message || 'Failed to generate quiz');
      setIsGenerating(false);
      setQuiz(null);
    }
  };

  // ─── Interactive Knowledge Selection Handler ─────────────────────────────────
  const handleSelectOption = (question, key, optionText) => {
    const qId = question._id;
    const currentState = questionStates[qId];

    // If question is already answered correctly or revealed, prevent re-clicking
    if (currentState?.status === 'correct' || currentState?.status === 'revealed') {
      return;
    }

    const isCorrect = checkIsCorrectAnswer(key, optionText, question.correctAnswer, question.options);

    if (isCorrect) {
      setQuestionStates(prev => ({
        ...prev,
        [qId]: {
          selectedKey: key,
          status: 'correct',
        }
      }));
      toast.success('Correct answer! 🎉', {
        id: `toast-correct-${qId}`,
        duration: 3500,
      });
    } else {
      setQuestionStates(prev => ({
        ...prev,
        [qId]: {
          selectedKey: key,
          status: 'wrong',
        }
      }));
      toast.error('Wrong answer! ❌', {
        id: `toast-wrong-${qId}`,
        duration: 3500,
      });
    }
  };

  // ─── Retry Question Handler ──────────────────────────────────────────────────
  const handleRetryQuestion = (questionId) => {
    setQuestionStates(prev => ({
      ...prev,
      [questionId]: {
        selectedKey: null,
        status: 'unanswered',
      }
    }));
    toast('Choose your answer again! 🔄', {
      icon: '🔄',
      duration: 2000,
    });
  };

  // ─── Reveal Correct Answer Handler ───────────────────────────────────────────
  const handleRevealCorrectAnswer = (questionId) => {
    setQuestionStates(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        status: 'revealed',
      }
    }));
    toast('Correct answer revealed! 💡', {
      icon: '💡',
      duration: 2500,
    });
  };

  // ─── Advance to Next Question Handler ────────────────────────────────────────
  const handleNextQuestion = (currentIndex) => {
    const nextIndex = currentIndex + 1;
    const total = quiz?.questions?.length || 0;
    
    if (nextIndex < total) {
      const nextCard = document.getElementById(`question-card-${nextIndex}`);
      if (nextCard) {
        nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        nextCard.classList.add('ring-2', 'ring-indigo-500');
        setTimeout(() => {
          nextCard.classList.remove('ring-2', 'ring-indigo-500');
        }, 1500);
      }
      toast(`Proceeded to Question ${nextIndex + 1} 🎯`, { icon: '➡️' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.success('🎉 Congratulations! You have finished all questions in this quiz.');
    }
  };

  // ─── Quit Quiz Handler ───────────────────────────────────────────────────────
  const handleQuitQuiz = () => {
    if (onClose) {
      onClose();
    } else {
      navigate('/quizzes');
    }
    toast('Exited quiz.', { icon: '👋' });
  };

  // ─── Reset All Questions ─────────────────────────────────────────────────────
  const handleResetAll = () => {
    setQuestionStates({});
    toast.success('Quiz reset! Test your knowledge from the start.');
  };

  // ─── Reveal All Answers for quick study review ────────────────────────────────
  const handleRevealAll = () => {
    if (!quiz?.questions) return;
    const allRevealed = {};
    quiz.questions.forEach(q => {
      allRevealed[q._id] = {
        selectedKey: null,
        status: 'revealed',
      };
    });
    setQuestionStates(allRevealed);
    toast('All correct answers revealed for review! 💡', { icon: '💡' });
  };

  const toggleContext = (questionId) => {
    setExpandedContext(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  const getContextForQuestion = (question) => {
    if (!quiz?.contextReferences || !question?.sourceChunkIndex) return null;
    return quiz.contextReferences.find(ref => ref.chunkIndex === question.sourceChunkIndex) || null;
  };

  // Compute live knowledge score
  const getKnowledgeStats = () => {
    if (!quiz?.questions) return { correct: 0, wrong: 0, answered: 0, total: 0, percentage: 0 };
    const total = quiz.questions.length;
    let correct = 0;
    let wrong = 0;

    quiz.questions.forEach(q => {
      const state = questionStates[q._id];
      if (state?.status === 'correct') correct++;
      else if (state?.status === 'wrong') wrong++;
    });

    const answered = Object.values(questionStates).filter(s => s.status === 'correct' || s.status === 'wrong' || s.status === 'revealed').length;
    const percentage = answered > 0 ? Math.round((correct / answered) * 100) : 0;

    return { correct, wrong, answered, total, percentage };
  };

  const getStatusBadge = (type) => {
    const config = {
      mcq: {
        label: 'MCQ',
        className: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      },
      true_false: {
        label: 'True / False',
        className: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      }
    };
    
    const badgeConfig = config[type] || config.mcq;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeConfig.className}`}>
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
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-indigo-600/30"
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
        {onClose && (
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-medium rounded-xl transition-colors"
          >
            <RotateCcw size={20} />
            Go Back
          </button>
        )}
      </div>
    );
  }

  const stats = getKnowledgeStats();

  return (
    <div className="space-y-6">
      {/* ─── Quiz Header & Interactive Knowledge Status ───────────────────────── */}
      <div className={`${isDark ? 'bg-slate-800/60 border-white/10' : 'bg-white border-light-300'} backdrop-blur-md rounded-2xl p-6 border shadow-xl`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap mb-1">
              <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-light-900'}`}>
                {quiz.title || 'Knowledge Test Quiz'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                <Sparkles size={12} /> Interactive Knowledge Test
              </span>
            </div>

            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className={`${isDark ? 'text-slate-400' : 'text-light-600'}`}>
                <Clock size={14} className="inline mr-1" />
                {quiz.timeLimit || 15} mins
              </span>
              <span className={`${isDark ? 'text-slate-400' : 'text-light-600'}`}>
                <FileText size={14} className="inline mr-1" />
                {quiz.totalQuestions || quiz.questions?.length || 0} questions
              </span>
              <span className={`${isDark ? 'text-slate-400' : 'text-light-600'}`}>
                {quiz.mcqCount || 0} MCQs • {quiz.trueFalseCount || 0} True/False
              </span>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleResetAll}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                isDark 
                  ? 'bg-slate-700/60 hover:bg-slate-700 border-white/10 text-slate-300' 
                  : 'bg-light-200 hover:bg-light-300 border-light-300 text-light-700'
              }`}
              title="Reset all questions to try again"
            >
              <RotateCcw size={14} />
              Reset Test
            </button>

            <button
              onClick={handleRevealAll}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                isDark 
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300' 
                  : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700'
              }`}
              title="Reveal all answers for revision"
            >
              <Lightbulb size={14} />
              Reveal All
            </button>

            <button
              onClick={() => navigate(ROUTES.QUIZ_PLAY.replace(':id', quiz._id))}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-500/25 hover:scale-105 active:scale-95"
            >
              <Play size={16} />
              Play Full Timed Quiz
            </button>
          </div>
        </div>

        {/* Live Score Tracker Bar */}
        <div className="mt-5 pt-4 border-t border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-2">
            <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-light-700'}`}>
              Your Progress: <span className="font-bold text-indigo-400">{stats.answered} / {stats.total} Answered</span>
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <CheckCircle size={14} /> {stats.correct} Correct
              </span>
              <span className="flex items-center gap-1 text-red-400 font-semibold">
                <XCircle size={14} /> {stats.wrong} Wrong
              </span>
              {stats.answered > 0 && (
                <span className={`font-bold px-2 py-0.5 rounded ${isDark ? 'bg-slate-700 text-white' : 'bg-light-200 text-dark-800'}`}>
                  {stats.percentage}% Accuracy
                </span>
              )}
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="h-2 bg-slate-700/60 rounded-full overflow-hidden flex">
            {stats.correct > 0 && (
              <div 
                className="bg-emerald-500 transition-all duration-300"
                style={{ width: `${(stats.correct / (stats.total || 1)) * 100}%` }}
                title={`${stats.correct} correct`}
              />
            )}
            {stats.wrong > 0 && (
              <div 
                className="bg-red-500 transition-all duration-300"
                style={{ width: `${(stats.wrong / (stats.total || 1)) * 100}%` }}
                title={`${stats.wrong} wrong`}
              />
            )}
          </div>
        </div>
      </div>

      {/* ─── Questions List ──────────────────────────────────────────────────── */}
      <div className="space-y-5">
        {(quiz.questions || []).map((question, index) => {
          const qId = question._id || `q-${index}`;
          const qState = questionStates[qId] || { status: 'unanswered', selectedKey: null };
          const contextRef = getContextForQuestion(question);
          const isExpanded = expandedContext[qId];

          // Normalized options entries
          const optionsEntries = question.options instanceof Map 
            ? Array.from(question.options.entries())
            : Object.entries(question.options || {});

          return (
            <motion.div
              key={qId}
              id={`question-card-${index}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className={`rounded-2xl p-6 border transition-all ${
                qState.status === 'correct'
                  ? 'border-emerald-500/40 bg-emerald-950/10 shadow-lg shadow-emerald-950/20'
                  : qState.status === 'wrong'
                  ? 'border-red-500/40 bg-red-950/10 shadow-lg shadow-red-950/20'
                  : qState.status === 'revealed'
                  ? 'border-amber-500/40 bg-amber-950/10'
                  : `${isDark ? 'bg-slate-800/40 border-white/10 hover:border-white/20' : 'bg-white border-light-300'} backdrop-blur-md`
              }`}
            >
              {/* Question Header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-light-200 text-light-700'}`}>
                      Question {index + 1}
                    </span>
                    {getStatusBadge(question.type)}
                    
                    {/* Difficulty Badge */}
                    {question.difficulty && (
                      <span className={cn(
                        'px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                        getDifficultyBadge(question.difficulty).className
                      )}>
                        {getDifficultyBadge(question.difficulty).label}
                      </span>
                    )}

                    {/* Bloom's Taxonomy Badge */}
                    {question.bloomsTaxonomy && (
                      <span className={cn(
                        'px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700/80 border border-slate-600',
                        getBloomColor(question.bloomsTaxonomy)
                      )}>
                        Bloom's: {question.bloomsTaxonomy}
                      </span>
                    )}

                    {/* Question Status Badge */}
                    {qState.status === 'correct' && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle size={12} /> Correct
                      </span>
                    )}
                    {qState.status === 'wrong' && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1">
                        <XCircle size={12} /> Incorrect
                      </span>
                    )}
                    {qState.status === 'revealed' && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1">
                        <Lightbulb size={12} /> Answer Revealed
                      </span>
                    )}

                    {/* Classification Reason Tooltip */}
                    {question.classificationReason && (
                      <div className="relative">
                        <button
                          className="p-1 rounded-md bg-slate-700/80 border border-slate-600 hover:bg-slate-600 transition-colors"
                          onMouseEnter={() => setShowTooltip(prev => ({ ...prev, [qId]: true }))}
                          onMouseLeave={() => setShowTooltip(prev => ({ ...prev, [qId]: false }))}
                          aria-label="Classification reason"
                        >
                          <Info size={12} className="text-slate-400" />
                        </button>
                        {showTooltip[qId] && (
                          <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-20">
                            <p className="text-xs text-slate-200 leading-relaxed">
                              <span className="font-semibold text-slate-400">Classification:</span> {question.classificationReason}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <p className={`text-base sm:text-lg font-medium ${isDark ? 'text-white' : 'text-light-900'} leading-relaxed`}>
                    {question.questionText || 'Question text not available'}
                  </p>
                </div>
                
                {contextRef && (
                  <button
                    onClick={() => toggleContext(qId)}
                    className={`p-2 rounded-xl transition-all flex-shrink-0 ${
                      isExpanded
                        ? 'bg-indigo-500/20 text-indigo-400'
                        : `${isDark ? 'bg-slate-700/50 hover:bg-slate-700 text-slate-300' : 'bg-light-200 hover:bg-light-300 text-light-700'}`
                    }`}
                    title="Toggle Context Reference"
                  >
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                )}
              </div>

              {/* Context Reference Accordion */}
              {contextRef && (
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`mb-4 p-4 rounded-xl border ${isDark ? 'bg-slate-900/60 border-white/10' : 'bg-light-100 border-light-300'}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <FileText size={16} className="text-indigo-400" />
                        <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-light-900'}`}>
                          Context Source (Chunk #{contextRef.chunkIndex})
                        </span>
                        {contextRef.relevanceScore && (
                          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-light-600'}`}>
                            Relevance: {Math.round(contextRef.relevanceScore * 100)}%
                          </span>
                        )}
                      </div>
                      <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-light-700'} leading-relaxed`}>
                        {contextRef.text}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {/* ─── Interactive Options ─────────────────────────────────────── */}
              <div className="space-y-2.5">
                {optionsEntries.map(([key, optionText]) => {
                  const isThisKey = key === qState.selectedKey;
                  const isThisCorrectOption = checkIsCorrectAnswer(key, optionText, question.correctAnswer, question.options);

                  let optionStyle = '';
                  let rightBadge = null;
                  let icon = null;

                  if (qState.status === 'correct') {
                    if (isThisKey) {
                      // Player's answer was correct! Highlight in rich green
                      optionStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/40 font-semibold shadow-md shadow-emerald-500/10';
                      icon = <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />;
                      rightBadge = (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 font-semibold flex items-center gap-1">
                          Correct Answer
                        </span>
                      );
                    } else {
                      optionStyle = isDark 
                        ? 'bg-slate-800/30 border-white/5 text-slate-500 opacity-60' 
                        : 'bg-light-200/40 border-light-300 text-light-400 opacity-60';
                    }
                  } else if (qState.status === 'wrong') {
                    if (isThisKey) {
                      // Player's answer was wrong! Highlight in vibrant red
                      optionStyle = 'bg-red-500/20 border-red-500 text-red-300 ring-2 ring-red-500/40 font-semibold shadow-md shadow-red-500/10';
                      icon = <XCircle size={18} className="text-red-400 flex-shrink-0" />;
                      rightBadge = (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-500/30 text-red-300 font-semibold flex items-center gap-1">
                          Your Answer (Incorrect)
                        </span>
                      );
                    } else {
                      optionStyle = isDark 
                        ? 'bg-slate-800/40 border-white/10 text-slate-400' 
                        : 'bg-light-100 border-light-300 text-light-600';
                    }
                  } else if (qState.status === 'revealed') {
                    if (isThisCorrectOption) {
                      // Correct option revealed in green!
                      optionStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/40 font-semibold';
                      icon = <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />;
                      rightBadge = (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 font-semibold flex items-center gap-1">
                          Correct Answer
                        </span>
                      );
                    } else if (isThisKey) {
                      // User's previous incorrect answer
                      optionStyle = 'bg-red-500/10 border-red-500/30 text-red-400 line-through opacity-75';
                      icon = <XCircle size={18} className="text-red-400 flex-shrink-0" />;
                    } else {
                      optionStyle = isDark 
                        ? 'bg-slate-800/30 border-white/5 text-slate-500 opacity-60' 
                        : 'bg-light-200/40 border-light-300 text-light-400 opacity-60';
                    }
                  } else {
                    // Default unanswered state - Clean, inviting player to test knowledge
                    optionStyle = isDark 
                      ? 'bg-slate-700/30 border-white/10 hover:bg-slate-700/70 hover:border-indigo-500/60 text-slate-200 hover:scale-[1.01]' 
                      : 'bg-light-100 border-light-300 hover:bg-light-200 hover:border-indigo-500/60 text-light-800 hover:scale-[1.01]';
                  }

                  const isClickable = qState.status === 'unanswered' || qState.status === 'wrong';

                  return (
                    <button
                      key={key}
                      onClick={() => handleSelectOption(question, key, optionText)}
                      disabled={qState.status === 'correct' || qState.status === 'revealed'}
                      className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-center justify-between gap-3 ${optionStyle} ${
                        isClickable ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                          isThisKey && qState.status === 'correct'
                            ? 'bg-emerald-500 text-white'
                            : isThisKey && qState.status === 'wrong'
                            ? 'bg-red-500 text-white'
                            : isThisCorrectOption && qState.status === 'revealed'
                            ? 'bg-emerald-500 text-white'
                            : isDark
                            ? 'bg-slate-700 text-slate-300'
                            : 'bg-light-300 text-light-700'
                        }`}>
                          {key}
                        </span>
                        <span className="text-sm font-medium leading-relaxed truncate-words">
                          {optionText || 'Option text unavailable'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {rightBadge}
                        {icon}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* ─── Feedback & Action: When Answer is WRONG ─────────────────── */}
              {qState.status === 'wrong' && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="mt-4 p-4 rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/10 via-amber-500/5 to-transparent backdrop-blur-md"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AlertCircle size={18} className="text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-red-300">
                          Wrong answer! ❌
                        </p>
                        <p className="text-xs text-slate-300 mt-0.5">
                          Would you like to retry, or should I show the correct answer?
                        </p>
                      </div>
                    </div>

                    {/* The 2 required action buttons */}
                    <div className="flex items-center gap-2.5 flex-shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => handleRetryQuestion(qId)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 hover:border-slate-500 text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm"
                      >
                        <RotateCcw size={14} className="text-indigo-400" />
                        Retry
                      </button>

                      <button
                        onClick={() => handleRevealCorrectAnswer(qId)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-md shadow-amber-500/20"
                      >
                        <Lightbulb size={14} />
                        Show Correct Answer
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─── Feedback: When Answer is CORRECT ────────────────────────── */}
              {qState.status === 'correct' && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="mt-4 p-4 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent backdrop-blur-md shadow-md shadow-emerald-500/5"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle size={18} className="text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-emerald-300">
                        Correct answer! 🎉 Excellent job!
                      </p>
                      {question.explanation && (
                        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                          <span className="font-semibold text-emerald-400">Explanation:</span> {question.explanation}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ─── Interactive Prompt on Correct Answer ─────────────────── */}
                  <div className="pt-3 border-t border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-emerald-200">
                      What would you like to do next?
                    </p>

                    <div className="flex items-center gap-2 flex-wrap self-end sm:self-center">
                      {/* 1. Retry Question */}
                      <button
                        onClick={() => handleRetryQuestion(qId)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 hover:border-slate-500 text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm"
                        title="Retry this question again"
                      >
                        <RotateCcw size={13} className="text-indigo-400" />
                        Retry
                      </button>

                      {/* 2. Next Question */}
                      <button
                        onClick={() => handleNextQuestion(index)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-md shadow-emerald-600/20"
                        title="Continue to next question"
                      >
                        <span>{index + 1 < (quiz.questions?.length || 0) ? 'Next Question' : 'Finish Quiz'}</span>
                        <ArrowRight size={13} />
                      </button>

                      {/* 3. Quit */}
                      <button
                        onClick={handleQuitQuiz}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                        title="Quit this quiz"
                      >
                        <LogOut size={13} />
                        Quit
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─── Feedback: When Answer is REVEALED ───────────────────────── */}
              {qState.status === 'revealed' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Lightbulb size={18} className="text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-amber-300">
                          Correct Answer: Option {question.correctAnswer}
                        </p>
                        {question.explanation && (
                          <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                            <span className="font-semibold text-amber-400">Explanation:</span> {question.explanation}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRetryQuestion(qId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 text-xs font-medium transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                    >
                      <RotateCcw size={12} />
                      Try Again
                    </button>
                  </div>
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