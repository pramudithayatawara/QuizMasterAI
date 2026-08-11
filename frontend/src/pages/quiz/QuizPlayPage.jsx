import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Flag, Clock,
  CheckCircle, XCircle, AlertCircle, Info, Timer,
} from 'lucide-react';
import { useQuizStore } from '../../store/quiz.store.js';
import { ROUTES } from '../../constants/routes.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import ProgressBar from '../../components/common/ProgressBar.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import Modal from '../../components/common/Modal.jsx';
import QuizTimer from '../../components/quiz/QuizTimer.jsx';
import AdaptiveBadge from '../../components/quiz/AdaptiveBadge.jsx';
import { cn } from '../../utils/helpers.js';
import toast from 'react-hot-toast';

/**
 * @page QuizPlayPage
 * @description Interactive quiz play interface with timer and navigation.
 */
const QuizPlayPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    currentQuiz,
    currentQuestion,
    questionIndex,
    answers,
    timeRemaining,
    isLoading,
    isSubmitting,
    startQuiz,
    selectAnswer,
    nextQuestion,
    previousQuestion,
    submitQuiz,
    updateTimer,
    clearQuizState,
  } = useQuizStore();

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showAutoSubmitModal, setShowAutoSubmitModal] = useState(false);
  const [quizStartTime, setQuizStartTime] = useState(null);
  const [adaptiveNotification, setAdaptiveNotification] = useState(null);

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

  // ─── Initialize Quiz ──────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const result = await startQuiz(id);
      if (!result.success) {
        toast.error('Failed to start quiz.');
        navigate(ROUTES.QUIZ_LIST);
      } else {
        // Module 05: Record quiz start time for accurate time tracking
        setQuizStartTime(Date.now());
      }
    };
    init();

    return () => clearQuizState();
  }, [id]);

  // ─── Timer Countdown with Auto-Submit - Module 05 ─────────────────────────────
  useEffect(() => {
    if (!currentQuiz || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      const newTime = timeRemaining - 1;
      updateTimer(newTime);

      if (newTime <= 0 && !autoSubmitted) {
        setAutoSubmitted(true);
        setShowAutoSubmitModal(true);
        // Auto-submit after showing modal
        setTimeout(() => {
          handleSubmit(true);
        }, 2000);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentQuiz, timeRemaining, autoSubmitted]);

  // ─── Submit Handler with Time Tracking - Module 05 ─────────────────────────────
  const handleSubmit = async (isTimeout = false) => {
    // Module 05: Calculate exact time taken
    const timeTakenSeconds = quizStartTime 
      ? Math.floor((Date.now() - quizStartTime) / 1000)
      : (currentQuiz?.timeLimit * 60) - timeRemaining;

    const result = await submitQuiz(isTimeout, timeTakenSeconds);
    
    if (result.success) {
      // Module 05: Check for adaptive difficulty adjustment
      if (result.adaptive && result.adaptive.shouldAdjust) {
        const notificationType = result.adaptive.newDifficulty === 'hard' ? 'upgraded' : 'downgraded';
        setAdaptiveNotification({
          type: notificationType,
          previousDifficulty: result.adaptive.previousDifficulty,
          newDifficulty: result.adaptive.newDifficulty,
          reason: result.adaptive.adjustmentReason
        });
        
        // Show adaptive notification
        setTimeout(() => {
          toast.success(
            notificationType === 'upgraded' 
              ? '🎉 Great job! Your adaptive difficulty has been upgraded!' 
              : 'Let\'s build your foundation! Difficulty adjusted for better learning.'
          );
        }, 1000);
      }
      
      // Module 06: Show AI feedback notification
      if (result.aiFeedback && result.aiFeedback.confidenceLevel === 'high') {
        setTimeout(() => {
          toast.success('🤖 AI feedback generated successfully!');
        }, 1500);
      }
      
      navigate(ROUTES.QUIZ_RESULT.replace(':id', currentQuiz._id));
    }
  };

  const confirmSubmit = () => {
    setShowSubmitModal(false);
    handleSubmit(false);
  };

  // ─── Answer Selection ─────────────────────────────────────────────────────
  const handleAnswerSelect = (answer) => {
    if (!currentQuestion) return;
    selectAnswer(currentQuestion._id, answer);
  };

  // ─── Loading State ────────────────────────────────────────────────────────
  if (isLoading || !currentQuiz || !currentQuestion) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="xl" />
      </div>
    );
  }

  const selectedAnswer = answers[currentQuestion._id];
  const progress = ((questionIndex + 1) / currentQuiz.questions.length) * 100;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ─── Module 05: Sticky Header with Timer ─────────────────────────────── */}
      <div className="sticky top-16 z-20 mb-6">
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-dark-50 mb-1">
              {currentQuiz.title}
            </h1>
            <p className="text-sm text-dark-400">
              Question {questionIndex + 1} of {currentQuiz.questions.length}
            </p>
          </div>
          {/* Module 05: Enhanced Quiz Timer with progress bar and auto-submit */}
          <QuizTimer 
            timeRemaining={timeRemaining}
            totalTime={currentQuiz.timeLimit * 60} // Convert minutes to seconds
            onTimeout={() => {
              if (!autoSubmitted) {
                setAutoSubmitted(true);
                setShowAutoSubmitModal(true);
                // Auto-submit after showing modal
                setTimeout(() => {
                  handleSubmit(true);
                }, 2000);
              }
            }}
            difficulty={currentQuiz.difficulty}
          />
        </div>
        </Card>
      </div>

      {/* ─── Quiz Content ──────────────────────────────────────────────────── */}
      <Card padding="md">
        <ProgressBar
          value={progress}
          max={100}
          color="primary"
          size="md"
          showLabel={false}
        />
      </Card>
      </div>

      {/* ─── Quiz Content ──────────────────────────────────────────────────── */}
      <Card padding="md">
        {/* Module 04: Difficulty Breakdown Bar */}
        {currentQuiz.difficultyBreakdown && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-dark-400 font-medium">Difficulty Distribution</span>
              <div className="flex gap-2 text-xs">
                <span className="text-emerald-400">Easy: {currentQuiz.difficultyBreakdown.easy}</span>
                <span className="text-yellow-400">Medium: {currentQuiz.difficultyBreakdown.medium}</span>
                <span className="text-red-400">Hard: {currentQuiz.difficultyBreakdown.hard}</span>
              </div>
            </div>
            <div className="h-2 bg-dark-700 rounded-full overflow-hidden flex">
              {currentQuiz.difficultyBreakdown.easy > 0 && (
                <div 
                  className="bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(currentQuiz.difficultyBreakdown.easy / currentQuiz.totalQuestions) * 100}%` }}
                />
              )}
              {currentQuiz.difficultyBreakdown.medium > 0 && (
                <div 
                  className="bg-yellow-500 transition-all duration-300"
                  style={{ width: `${(currentQuiz.difficultyBreakdown.medium / currentQuiz.totalQuestions) * 100}%` }}
                />
              )}
              {currentQuiz.difficultyBreakdown.hard > 0 && (
                <div 
                  className="bg-red-500 transition-all duration-300"
                  style={{ width: `${(currentQuiz.difficultyBreakdown.hard / currentQuiz.totalQuestions) * 100}%` }}
                />
              )}
            </div>
          </div>
        )}

        {/* Question Progress */}
        <ProgressBar
          value={progress}
          max={100}
          color="primary"
          size="md"
          showLabel={false}
        />
      </Card>

      {/* ─── Question Card ────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={questionIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <Card padding="lg">
            {/* Question Text */}
            <div className="mb-6">
              <div className="flex items-start gap-3 mb-4">
                <span className="flex-shrink-0 w-8 h-8 bg-primary-500/10 rounded-lg
                                 flex items-center justify-center text-primary-400 font-bold">
                  {questionIndex + 1}
                </span>
                <h2 className="text-lg font-semibold text-dark-50 leading-relaxed">
                  {currentQuestion.question}
                </h2>
              </div>

              {currentQuestion.context && (
                <div className="ml-11 p-3 bg-dark-800/50 rounded-lg border border-dark-700">
                  <p className="text-sm text-dark-300 italic">
                    Context: {currentQuestion.context}
                  </p>
                </div>
              )}

              {/* Module 04: Difficulty Classification Badges */}
              <div className="ml-11 flex flex-wrap items-center gap-2 mt-3">
                {/* Difficulty Badge */}
                {currentQuestion.difficulty && (
                  <span className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-semibold border',
                    getDifficultyBadge(currentQuestion.difficulty).className
                  )}>
                    {getDifficultyBadge(currentQuestion.difficulty).label}
                  </span>
                )}

                {/* Bloom's Taxonomy Badge */}
                {currentQuestion.bloomsTaxonomy && (
                  <span className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium bg-dark-700 border border-dark-600',
                    getBloomColor(currentQuestion.bloomsTaxonomy)
                  )}>
                    Bloom's: {currentQuestion.bloomsTaxonomy}
                  </span>
                )}

                {/* Classification Reason Tooltip */}
                {currentQuestion.classificationReason && (
                  <div className="relative">
                    <button
                      className="p-1.5 rounded-md bg-dark-700 border border-dark-600 hover:bg-dark-600 transition-colors"
                      onMouseEnter={() => setShowTooltip(true)}
                      onMouseLeave={() => setShowTooltip(false)}
                    >
                      <Info size={14} className="text-dark-400" />
                    </button>
                    {showTooltip && (
                      <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-dark-800 border border-dark-600 rounded-lg shadow-xl z-10">
                        <p className="text-xs text-dark-200 leading-relaxed">
                          <span className="font-semibold text-dark-400">Classification:</span> {currentQuestion.classificationReason}
                        </p>
                        <div className="absolute bottom-0 left-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-dark-800 border-r border-b border-dark-600"></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Answer Options */}
            <div className="space-y-3">
              {currentQuestion.type === 'mcq' ? (
                // MCQ Options
                currentQuestion.options.map((option, index) => {
                  const optionLabel = ['A', 'B', 'C', 'D'][index];
                  const isSelected = selectedAnswer === option;

                  return (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(option)}
                      className={cn(
                        'quiz-option w-full',
                        isSelected && 'selected'
                      )}
                    >
                      <span className={cn(
                        'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                        'font-bold text-sm transition-colors',
                        isSelected
                          ? 'bg-primary-600 text-white'
                          : 'bg-dark-700 text-dark-400'
                      )}>
                        {optionLabel}
                      </span>
                      <span className="flex-1 text-left text-dark-100">
                        {option}
                      </span>
                      {isSelected && (
                        <CheckCircle size={20} className="text-primary-400" />
                      )}
                    </button>
                  );
                })
              ) : (
                // True/False Options
                ['True', 'False'].map((option) => {
                  const isSelected = selectedAnswer === option;
                  return (
                    <button
                      key={option}
                      onClick={() => handleAnswerSelect(option)}
                      className={cn(
                        'quiz-option w-full',
                        isSelected && 'selected'
                      )}
                    >
                      <span className={cn(
                        'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                        'font-bold text-sm transition-colors',
                        isSelected
                          ? 'bg-primary-600 text-white'
                          : 'bg-dark-700 text-dark-400'
                      )}>
                        {option === 'True' ? '✓' : '✗'}
                      </span>
                      <span className="flex-1 text-left text-dark-100">
                        {option}
                      </span>
                      {isSelected && (
                        <CheckCircle size={20} className="text-primary-400" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* ─── Navigation ───────────────────────────────────────────────────── */}
      <Card padding="md">
        <div className="flex items-center justify-between">
          {/* Previous */}
          <Button
            variant="secondary"
            onClick={previousQuestion}
            disabled={questionIndex === 0}
            leftIcon={<ChevronLeft size={18} />}
          >
            Previous
          </Button>

          {/* Status */}
          <div className="text-center">
            <p className="text-sm text-dark-400">
              Answered: {answeredCount} / {currentQuiz.questions.length}
            </p>
          </div>

          {/* Next or Submit */}
          {questionIndex < currentQuiz.questions.length - 1 ? (
            <Button
              variant="primary"
              onClick={nextQuestion}
              rightIcon={<ChevronRight size={18} />}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => setShowSubmitModal(true)}
              leftIcon={<Flag size={18} />}
            >
              Submit Quiz
            </Button>
          )}
        </div>
      </Card>

      {/* ─── Submit Confirmation Modal ────────────────────────────────────── */}
      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Submit Quiz"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-4 bg-accent-500/10 border border-accent-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-accent-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-dark-300">
                <p className="font-semibold mb-1">Are you sure?</p>
                <p>
                  You have answered {answeredCount} out of {currentQuiz.questions.length} questions.
                  {answeredCount < currentQuiz.questions.length && (
                    <span className="text-accent-400">
                      {' '}Unanswered questions will be marked as incorrect.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowSubmitModal(false)}
            >
              Review Answers
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={confirmSubmit}
              isLoading={isSubmitting}
            >
              Submit
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Auto-Submit Modal - Module 05 ─────────────────────────────────────────── */}
      <Modal
        isOpen={showAutoSubmitModal}
        onClose={() => setShowAutoSubmitModal(false)}
        title="Time's Up!"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <Timer size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-dark-300">
                <p className="font-semibold mb-1">Auto-Submit Triggered</p>
                <p>
                  Your time has expired! Your quiz has been automatically submitted with your current answers.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowAutoSubmitModal(false);
                // Navigate to results after closing modal
                navigate(ROUTES.QUIZ_RESULT.replace(':id', currentQuiz._id));
              }}
            >
              View Results
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default QuizPlayPage;