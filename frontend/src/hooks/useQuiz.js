import { useEffect, useCallback } from 'react';
import { useQuizStore } from '../store/quiz.store.js';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes.js';
import toast from 'react-hot-toast';

/**
 * @hook useQuiz
 * @description Complete quiz management hook with timer and navigation.
 */
export const useQuiz = () => {
  const store = useQuizStore();
  const navigate = useNavigate();

  // ─── Fetch Quizzes ─────────────────────────────────────────────────────────────
  const fetchQuizzes = useCallback((params) => {
    store.fetchQuizzes(params);
  }, [store]);

  // ─── Start Quiz ─────────────────────────────────────────────────────────────────
  const startQuiz = useCallback(async (quizId) => {
    const result = await store.startQuiz(quizId);
    if (result.success) {
      navigate(ROUTES.QUIZ_PLAY.replace(':id', quizId));
    }
    return result;
  }, [store, navigate]);

  // ─── Submit Quiz ────────────────────────────────────────────────────────────────
  const submitQuiz = useCallback(async (isTimeout = false) => {
    const result = await store.submitQuiz(isTimeout);
    if (result.success) {
      navigate(ROUTES.QUIZ_RESULT.replace(':id', store.currentQuiz._id));
    }
    return result;
  }, [store, navigate]);

  // ─── Navigation ─────────────────────────────────────────────────────────────────
  const goToNextQuestion = useCallback(() => {
    const { currentQuiz, questionIndex } = store;
    if (questionIndex < currentQuiz.questions.length - 1) {
      store.nextQuestion();
    } else {
      // Last question, submit quiz
      submitQuiz();
    }
  }, [store, submitQuiz]);

  const goToPreviousQuestion = useCallback(() => {
    store.previousQuestion();
  }, [store]);

  // ─── Timer Management ───────────────────────────────────────────────────────────
  useEffect(() => {
    let timerInterval;
    
    if (store.currentQuiz && store.timeRemaining > 0 && !store.result) {
      timerInterval = setInterval(() => {
        store.updateTimer(store.timeRemaining - 1);
        
        if (store.timeRemaining <= 1) {
          clearInterval(timerInterval);
          submitQuiz(true); // Auto-submit on timeout
        }
      }, 1000);
    }

    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [store.currentQuiz, store.timeRemaining, store.result, store, submitQuiz]);

  // ─── Cleanup ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      // Cleanup when component unmounts
      if (!store.result) {
        // Optional: auto-save progress or warn user
      }
    };
  }, [store.result]);

  return {
    // State
    quizzes: store.quizzes,
    currentQuiz: store.currentQuiz,
    currentAttempt: store.currentAttempt,
    currentQuestion: store.currentQuestion,
    questionIndex: store.questionIndex,
    answers: store.answers,
    timeRemaining: store.timeRemaining,
    isLoading: store.isLoading,
    isSubmitting: store.isSubmitting,
    result: store.result,

    // Actions
    fetchQuizzes,
    startQuiz,
    selectAnswer: store.selectAnswer,
    goToNextQuestion,
    goToPreviousQuestion,
    submitQuiz,
    clearQuizState: store.clearQuizState,
  };
};