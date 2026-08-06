import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Flag, Clock,
  CheckCircle, XCircle, AlertCircle,
} from 'lucide-react';
import { useQuizStore } from '../../store/quiz.store.js';
import { ROUTES } from '../../constants/routes.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import ProgressBar from '../../components/common/ProgressBar.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import Modal from '../../components/common/Modal.jsx';
import QuizTimer from '../../components/quiz/QuizTimer.jsx';
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

  // ─── Initialize Quiz ──────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const result = await startQuiz(id);
      if (!result.success) {
        toast.error('Failed to start quiz.');
        navigate(ROUTES.QUIZ_LIST);
      }
    };
    init();

    return () => clearQuizState();
  }, [id]);

  // ─── Timer Countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentQuiz || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      const newTime = timeRemaining - 1;
      updateTimer(newTime);

      if (newTime <= 0 && !autoSubmitted) {
        setAutoSubmitted(true);
        handleSubmit(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentQuiz, timeRemaining, autoSubmitted]);

  // ─── Submit Handler ───────────────────────────────────────────────────────
  const handleSubmit = async (isTimeout = false) => {
    const result = await submitQuiz(isTimeout);
    if (result.success) {
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
      {/* ─── Quiz Header ──────────────────────────────────────────────────── */}
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
          <QuizTimer timeRemaining={timeRemaining} />
        </div>
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
    </div>
  );
};

export default QuizPlayPage;