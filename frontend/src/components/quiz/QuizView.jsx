import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp,
  FileText, Clock, Eye, AlertCircle, Play, RotateCcw
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme.js';
import { quizAPI } from '../../api/quiz.api.js';
import toast from 'react-hot-toast';

/**
 * @component QuizView
 * @description Display generated quiz with questions, options, and context references.
 */
const QuizView = ({ quizId, pdfId, onClose }) => {
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

  useEffect(() => {
    if (quizId) {
      fetchQuiz();
    }
  }, [quizId]);

  const fetchQuiz = async () => {
    setIsLoading(true);
    try {
      const response = await quizAPI.getQuizById(quizId);
      setQuiz(response.data.data.quiz);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch quiz');
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
      
      setQuiz(response.data.data.quiz);
      setIsGenerating(false);
    } catch (error) {
      toast.dismiss('quiz-generation');
      toast.error(error.response?.data?.message || 'Failed to generate quiz');
      setIsGenerating(false);
    }
  };

  const handleAnswerSelect = (questionId, answer) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleSubmitQuiz = () => {
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
    if (!quiz.contextReferences || !question.sourceChunkIndex) return null;
    
    const contextRef = quiz.contextReferences.find(
      ref => ref.chunkIndex === question.sourceChunkIndex
    );
    
    return contextRef || null;
  };

  const getScore = () => {
    if (!quiz || !showResults) return { correct: 0, total: 0, percentage: 0 };
    
    let correct = 0;
    quiz.questions.forEach((question, index) => {
      const userAnswer = selectedAnswers[question._id];
      if (userAnswer === question.correctAnswer) {
        correct++;
      }
    });
    
    return {
      correct,
      total: quiz.questions.length,
      percentage: Math.round((correct / quiz.questions.length) * 100)
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

  const score = getScore();

  return (
    <div className="space-y-6">
      {/* Quiz Header */}
      <div className={`${isDark ? 'bg-slate-800/40 border-white/10' : 'bg-white/40 border-light-300'} backdrop-blur-md rounded-2xl p-6`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-light-900'}`}>
              {quiz.title}
            </h2>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className={`${isDark ? 'text-slate-400' : 'text-light-600'}`}>
                <Clock size={14} className="inline mr-1" />
                {quiz.timeLimit} minutes
              </span>
              <span className={`${isDark ? 'text-slate-400' : 'text-light-600'}`}>
                <FileText size={14} className="inline mr-1" />
                {quiz.totalQuestions} questions
              </span>
              <span className={`${isDark ? 'text-slate-400' : 'text-light-600'}`}>
                {quiz.mcqCount} MCQs • {quiz.trueFalseCount} True/False
              </span>
            </div>
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
        {quiz.questions.map((question, index) => {
          const contextRef = getContextForQuestion(question);
          const userAnswer = selectedAnswers[question._id];
          const isCorrect = userAnswer === question.correctAnswer;
          const isExpanded = expandedContext[question._id];

          return (
            <motion.div
              key={question._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`${isDark ? 'bg-slate-800/40 border-white/10' : 'bg-white/40 border-light-300'} backdrop-blur-md rounded-2xl p-6`}
            >
              {/* Question Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-light-600'}`}>
                      Q{index + 1}
                    </span>
                    {getStatusBadge(question.type)}
                  </div>
                  <p className={`text-lg ${isDark ? 'text-white' : 'text-light-900'} leading-relaxed`}>
                    {question.questionText}
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
                {Array.from(question.options.entries()).map(([key, option]) => {
                  const isSelected = userAnswer === key;
                  const isCorrectOption = key === question.correctAnswer;
                  
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
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : `${isDark ? 'bg-slate-700/30 border-white/5' : 'bg-light-200 border-light-300'} ${isDark ? 'text-slate-400' : 'text-light-600'}`;
                    if (isCorrectOption) icon = <CheckCircle size={16} />;
                  }

                  return (
                    <button
                      key={key}
                      onClick={() => viewMode === 'test' && !showResults && handleAnswerSelect(question._id, key)}
                      disabled={viewMode === 'test' && showResults}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group ${
                        optionClassName
                      } ${viewMode === 'test' && !showResults ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{key}.</span>
                        <span className="flex-1">{option}</span>
                      </div>
                      {icon && <span className="ml-2">{icon}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Explanation */}
              {showResults && question.explanation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={`mt-4 p-4 rounded-xl ${isDark ? 'bg-slate-900/50 border-white/10' : 'bg-light-100 border-light-300'}`}
                >
                  <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-light-700'}`}>
                    <span className="font-medium">Explanation:</span> {question.explanation}
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