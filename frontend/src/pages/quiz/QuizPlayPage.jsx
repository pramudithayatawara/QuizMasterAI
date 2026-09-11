import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Flag, Clock,
  CheckCircle, XCircle, AlertCircle, Info, Timer,
  Sparkles, Zap, Flame, Award, ArrowRight, Lightbulb
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
 * @description Interactive quiz play interface supporting both Standard and Real-Time Adaptive CAT mode.
 */
const QuizPlayPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    currentQuiz,
    currentQuestion,
    questionIndex,
    totalAdaptiveQuestions,
    answers,
    timeRemaining,
    isLoading,
    isSubmitting,
    isSubmittingStep,
    isAdaptiveMode,
    currentDifficultyLevel,
    adaptiveCalibration,
    adaptiveTrajectory,
    lastStepResult,
    startQuiz,
    selectAnswer,
    nextQuestion,
    previousQuestion,
    submitQuiz,
    submitAdaptiveStep,
    updateTimer,
    clearQuizState,
  } = useQuizStore();

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showAutoSubmitModal, setShowAutoSubmitModal] = useState(false);
  const [quizStartTime, setQuizStartTime] = useState(null);
  const [stepStartTime, setStepStartTime] = useState(Date.now());
  const [stepFeedback, setStepFeedback] = useState(null);

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
      const searchParams = new URLSearchParams(window.location.search);
      const isAdaptiveQuery = searchParams.get('adaptive') === 'true';

      const result = await startQuiz(id, { isAdaptive: isAdaptiveQuery });
      if (!result.success) {
        toast.error('Failed to start quiz.');
        navigate(ROUTES.QUIZ_LIST);
      } else {
        setQuizStartTime(Date.now());
        setStepStartTime(Date.now());
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
        setTimeout(() => {
          handleSubmit(true);
        }, 2000);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentQuiz, timeRemaining, autoSubmitted]);

  // ─── Normalized Options ───────────────────────────────────────────────────
  const normalizedOptions = useMemo(() => {
    if (!currentQuestion?.options) return [];
    if (Array.isArray(currentQuestion.options)) {
      return currentQuestion.options.map((opt, idx) => ({
        key: ['A', 'B', 'C', 'D'][idx] || String(idx),
        text: opt,
      }));
    }
    if (currentQuestion.options instanceof Map) {
      return Array.from(currentQuestion.options.entries()).map(([k, v]) => ({
        key: k,
        text: v,
      }));
    }
    return Object.entries(currentQuestion.options).map(([k, v]) => ({
      key: k,
      text: v,
    }));
  }, [currentQuestion]);

  // ─── Submit Standard Quiz ──────────────────────────────────────────────────
  const handleSubmit = async (isTimeout = false) => {
    const timeTakenSeconds = quizStartTime 
      ? Math.floor((Date.now() - quizStartTime) / 1000)
      : (currentQuiz?.timeLimit * 60) - timeRemaining;

    const result = await submitQuiz(isTimeout, timeTakenSeconds);
    
    if (result.success) {
      navigate(ROUTES.QUIZ_RESULT.replace(':id', currentQuiz._id || id));
    }
  };

  // ─── Submit Adaptive Step (Question-by-Question CAT) ───────────────────────
  const handleAdaptiveStepSubmit = async () => {
    if (!selectedAnswer) {
      toast.error('Please select an option first.');
      return;
    }

    const timeSpent = Math.max(1, Math.floor((Date.now() - stepStartTime) / 1000));
    const result = await submitAdaptiveStep(selectedAnswer, timeSpent);

    if (result.finished) {
      toast.success('🎉 Adaptive Quiz Completed!');
      navigate(ROUTES.QUIZ_RESULT.replace(':id', currentQuiz._id || result.attemptId || id));
      return;
    }

    if (result.stepResult) {
      setStepFeedback(result);
    }
  };

  const handleContinueNextAdaptiveQuestion = () => {
    setStepFeedback(null);
    setStepStartTime(Date.now());
  };

  const confirmSubmit = () => {
    setShowSubmitModal(false);
    handleSubmit(false);
  };

  const handleAnswerSelect = (answerKey) => {
    if (!currentQuestion || (isAdaptiveMode && stepFeedback)) return;
    selectAnswer(currentQuestion._id, answerKey);
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
  const totalQuestionsCount = isAdaptiveMode
    ? (totalAdaptiveQuestions || currentQuiz.totalQuestions || 10)
    : (currentQuiz.questions?.length || currentQuiz.totalQuestions || 10);
  const progress = Math.min(100, ((questionIndex + 1) / totalQuestionsCount) * 100);
  const answeredCount = Object.keys(answers).length;
  const questionTitle = currentQuestion.questionText || currentQuestion.question;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ─── Sticky Header with Timer & Adaptive Live Bar ────────────────────── */}
      <div className="sticky top-16 z-20 mb-4 space-y-3">
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-dark-50">
                  {currentQuiz.title || 'Adaptive Quiz'}
                </h1>
                {isAdaptiveMode && (
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                    <Sparkles size={12} /> Adaptive CAT
                  </span>
                )}
              </div>
              <p className="text-sm text-dark-400">
                Question {questionIndex + 1} of {totalQuestionsCount}
              </p>
            </div>

            {/* Quiz Timer */}
            <QuizTimer 
              timeRemaining={timeRemaining}
              totalTime={currentQuiz.timeLimit * 60}
              onTimeout={() => {
                if (!autoSubmitted) {
                  setAutoSubmitted(true);
                  setShowAutoSubmitModal(true);
                  setTimeout(() => handleSubmit(true), 2000);
                }
              }}
              difficulty={currentDifficultyLevel || currentQuiz.difficulty}
            />
          </div>

          {/* Real-Time Live Adaptive Gauge */}
          {isAdaptiveMode && (
            <div className="mt-4 pt-4 border-t border-dark-700/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-dark-400">Live Difficulty Calibration:</span>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className={cn(
                    'px-2.5 py-1 rounded-md font-bold transition-all duration-300',
                    currentDifficultyLevel === 'easy'
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400/50 scale-105'
                      : 'bg-dark-800 text-dark-400 border border-dark-700 opacity-60'
                  )}>
                    Easy
                  </span>
                  <span className="text-dark-600 font-mono">➔</span>
                  <span className={cn(
                    'px-2.5 py-1 rounded-md font-bold transition-all duration-300',
                    currentDifficultyLevel === 'medium'
                      ? 'bg-yellow-500 text-dark-950 shadow-lg shadow-yellow-500/30 ring-2 ring-yellow-400/50 scale-105'
                      : 'bg-dark-800 text-dark-400 border border-dark-700 opacity-60'
                  )}>
                    Medium ⚡
                  </span>
                  <span className="text-dark-600 font-mono">➔</span>
                  <span className={cn(
                    'px-2.5 py-1 rounded-md font-bold transition-all duration-300',
                    currentDifficultyLevel === 'hard'
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 ring-2 ring-red-400/50 scale-105'
                      : 'bg-dark-800 text-dark-400 border border-dark-700 opacity-60'
                  )}>
                    Hard 🔥
                  </span>
                </div>
              </div>

              {/* Streak Counter */}
              {adaptiveCalibration?.streak > 1 && (
                <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full font-semibold">
                  <Flame size={14} className="animate-bounce" />
                  <span>{adaptiveCalibration.streak} Streak!</span>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Progress Bar */}
        <Card padding="sm">
          <ProgressBar
            value={progress}
            max={100}
            color={isAdaptiveMode ? 'secondary' : 'primary'}
            size="md"
            showLabel={false}
          />
        </Card>
      </div>

      {/* ─── Question Card ──────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion._id || questionIndex}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.25 }}
        >
          <Card padding="lg">
            {/* Question Header */}
            <div className="mb-6">
              <div className="flex items-start gap-3 mb-4">
                <span className="flex-shrink-0 w-8 h-8 bg-primary-500/10 rounded-lg flex items-center justify-center text-primary-400 font-bold text-sm">
                  {questionIndex + 1}
                </span>
                <h2 className="text-lg font-semibold text-dark-50 leading-relaxed">
                  {questionTitle}
                </h2>
              </div>

              {/* Badges: Difficulty & Bloom's Taxonomy */}
              <div className="ml-11 flex flex-wrap items-center gap-2 mt-2">
                {currentQuestion.difficulty && (
                  <span className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-semibold border',
                    getDifficultyBadge(currentQuestion.difficulty).className
                  )}>
                    {getDifficultyBadge(currentQuestion.difficulty).label}
                  </span>
                )}

                {currentQuestion.bloomsTaxonomy && (
                  <span className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium bg-dark-700/80 border border-dark-600',
                    getBloomColor(currentQuestion.bloomsTaxonomy)
                  )}>
                    Bloom's: {currentQuestion.bloomsTaxonomy}
                  </span>
                )}

                {currentQuestion.topic && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-dark-800 text-dark-300 border border-dark-700">
                    Topic: {currentQuestion.topic}
                  </span>
                )}
              </div>
            </div>

            {/* Answer Options */}
            <div className="space-y-3">
              {normalizedOptions.map((opt) => {
                const isSelected = selectedAnswer === opt.key || selectedAnswer === opt.text;
                const isCorrectOption = stepFeedback && (opt.key === stepFeedback.stepResult?.correctAnswer || opt.text === stepFeedback.stepResult?.correctAnswer);
                const isWrongSelection = stepFeedback && isSelected && !stepFeedback.stepResult?.isCorrect;

                return (
                  <button
                    key={opt.key}
                    type="button"
                    disabled={isSubmittingStep || Boolean(stepFeedback)}
                    onClick={() => handleAnswerSelect(opt.key)}
                    className={cn(
                      'quiz-option w-full text-left transition-all p-3.5 rounded-xl border flex items-center gap-3',
                      stepFeedback
                        ? isCorrectOption
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-200'
                          : isWrongSelection
                            ? 'bg-red-500/15 border-red-500 text-red-200'
                            : 'bg-dark-800/40 border-dark-700 text-dark-400 opacity-60'
                        : isSelected
                          ? 'bg-primary-500/20 border-primary-500 text-primary-100 ring-2 ring-primary-500/30'
                          : 'bg-dark-800/60 border-dark-700 hover:border-dark-600 text-dark-100'
                    )}
                  >
                    <span className={cn(
                      'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-colors',
                      stepFeedback
                        ? isCorrectOption
                          ? 'bg-emerald-500 text-white'
                          : isWrongSelection
                            ? 'bg-red-500 text-white'
                            : 'bg-dark-700 text-dark-400'
                        : isSelected
                          ? 'bg-primary-500 text-white'
                          : 'bg-dark-700 text-dark-300'
                    )}>
                      {opt.key}
                    </span>
                    <span className="flex-1 text-sm font-medium">
                      {opt.text}
                    </span>
                    {stepFeedback && isCorrectOption && (
                      <CheckCircle size={20} className="text-emerald-400 flex-shrink-0" />
                    )}
                    {stepFeedback && isWrongSelection && (
                      <XCircle size={20} className="text-red-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Micro-Feedback Card for Adaptive Step */}
            {isAdaptiveMode && stepFeedback && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className={cn(
                  'mt-5 p-4 rounded-xl border',
                  stepFeedback.stepResult?.isCorrect
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                )}
              >
                <div className="flex items-start gap-3">
                  {stepFeedback.stepResult?.isCorrect ? (
                    <CheckCircle className="text-emerald-400 mt-0.5 flex-shrink-0" size={20} />
                  ) : (
                    <XCircle className="text-red-400 mt-0.5 flex-shrink-0" size={20} />
                  )}
                  <div className="space-y-1.5 text-sm">
                    <p className="font-semibold text-base">
                      {stepFeedback.stepResult?.isCorrect ? 'Correct Answer!' : 'Incorrect Answer'}
                    </p>
                    {stepFeedback.stepResult?.explanation && (
                      <p className="text-dark-200 text-xs leading-relaxed">
                        <span className="font-medium text-dark-300">Explanation:</span> {stepFeedback.stepResult.explanation}
                      </p>
                    )}
                    {stepFeedback.calibration?.reason && (
                      <div className="flex items-center gap-2 pt-1 text-xs font-medium text-purple-300">
                        <Sparkles size={14} />
                        <span>{stepFeedback.calibration.reason}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* ─── Bottom Navigation / Action Bar ──────────────────────────────────── */}
      <Card padding="md">
        {isAdaptiveMode ? (
          /* Adaptive Mode Action Button */
          <div className="flex items-center justify-between">
            <div className="text-xs text-dark-400">
              Question {questionIndex + 1} of {totalQuestionsCount}
            </div>

            {!stepFeedback ? (
              <Button
                variant="primary"
                onClick={handleAdaptiveStepSubmit}
                isLoading={isSubmittingStep}
                disabled={!selectedAnswer}
                rightIcon={<ArrowRight size={18} />}
              >
                Submit Answer
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleContinueNextAdaptiveQuestion}
                rightIcon={<ArrowRight size={18} />}
              >
                Continue to Next Question
              </Button>
            )}
          </div>
        ) : (
          /* Standard Quiz Mode Navigation */
          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              onClick={previousQuestion}
              disabled={questionIndex === 0}
              leftIcon={<ChevronLeft size={18} />}
            >
              Previous
            </Button>

            <div className="text-center">
              <p className="text-sm text-dark-400">
                Answered: {answeredCount} / {currentQuiz.questions?.length || totalQuestionsCount}
              </p>
            </div>

            {questionIndex < (currentQuiz.questions?.length || 10) - 1 ? (
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
        )}
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
                  You have answered {answeredCount} out of {currentQuiz.questions?.length || 10} questions.
                  {answeredCount < (currentQuiz.questions?.length || 10) && (
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

      {/* ─── Auto-Submit Modal on Timeout ─────────────────────────────────── */}
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
                navigate(ROUTES.QUIZ_RESULT.replace(':id', currentQuiz._id || id));
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