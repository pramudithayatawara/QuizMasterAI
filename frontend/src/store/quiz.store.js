import { create } from 'zustand';
import { quizAPI } from '../api/quiz.api.js';
import toast from 'react-hot-toast';

/**
 * @store useQuizStore
 * @description Quiz state management.
 */
export const useQuizStore = create((set, get) => ({
  // ─── State ────────────────────────────────────────────────────────────────
  quizzes:           [],
  currentQuiz:       null,
  currentAttempt:    null,
  currentQuestion:   null,
  questionIndex:     0,
  answers:           {},          // { questionId: answer }
  timeRemaining:     0,
  isLoading:         false,
  isSubmitting:      false,
  result:            null,

  // ─── Actions ──────────────────────────────────────────────────────────────

  fetchQuizzes: async (params) => {
    set({ isLoading: true });
    try {
      const response = await quizAPI.getAll(params);
      set({ quizzes: response.data.data.quizzes, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      toast.error('Failed to load quizzes.');
    }
  },

  startQuiz: async (quizId) => {
    set({ isLoading: true });
    try {
      const response = await quizAPI.start(quizId);
      const { quiz, attempt } = response.data.data;

      set({
        currentQuiz:     quiz,
        currentAttempt:  attempt,
        currentQuestion: quiz.questions[0],
        questionIndex:   0,
        answers:         {},
        timeRemaining:   quiz.timeLimit * 60,
        isLoading:       false,
      });

      return { success: true };

    } catch (error) {
      set({ isLoading: false });
      const message = error.response?.data?.message || 'Failed to start quiz.';
      toast.error(message);
      return { success: false, message };
    }
  },

  selectAnswer: (questionId, answer) => {
    set((state) => ({
      answers: { ...state.answers, [questionId]: answer },
    }));
  },

  nextQuestion: () => {
    const { currentQuiz, questionIndex } = get();
    const nextIndex = questionIndex + 1;

    if (nextIndex < currentQuiz.questions.length) {
      set({
        questionIndex:   nextIndex,
        currentQuestion: currentQuiz.questions[nextIndex],
      });
    }
  },

  previousQuestion: () => {
    const { currentQuiz, questionIndex } = get();
    const prevIndex = questionIndex - 1;

    if (prevIndex >= 0) {
      set({
        questionIndex:   prevIndex,
        currentQuestion: currentQuiz.questions[prevIndex],
      });
    }
  },

  updateTimer: (time) => {
    set({ timeRemaining: time });
  },

  submitQuiz: async (isTimeout = false, exactTimeTaken = null) => {
    const { currentAttempt, answers, timeRemaining, currentQuiz } = get();

    if (!currentAttempt) return { success: false };

    set({ isSubmitting: true });
    try {
      // Module 05: Use exact time taken if provided, otherwise calculate from timer
      const timeTaken = exactTimeTaken !== null 
        ? exactTimeTaken 
        : (currentQuiz.timeLimit * 60) - timeRemaining;

      const response = await quizAPI.submit(currentAttempt._id, {
        answers: Object.entries(answers).map(([questionId, answer]) => ({
          questionId,
          answer,
        })),
        timeTaken,
      });

      const { result, adaptive, aiFeedback, topicAccuracy, performanceMetrics } = response.data.data;
      set({ result, isSubmitting: false });

      // Module 05: Return adaptive information
      // Module 06: Return AI feedback and performance metrics
      return { success: true, result, adaptive, aiFeedback, topicAccuracy, performanceMetrics };

    } catch (error) {
      set({ isSubmitting: false });
      toast.error('Failed to submit quiz.');
      return { success: false };
    }
  },

  clearQuizState: () => {
    set({
      currentQuiz:     null,
      currentAttempt:  null,
      currentQuestion: null,
      questionIndex:   0,
      answers:         {},
      timeRemaining:   0,
      result:          null,
    });
  },
}));