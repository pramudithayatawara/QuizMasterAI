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
      let quiz = null;
      let attempt = null;

      try {
        const response = await quizAPI.start(quizId);
        const data = response.data?.data || response.data;
        quiz = data?.quiz;
        attempt = data?.attempt;
      } catch (e) {
        // Fallback to getQuizById if /start fails
        const res = await quizAPI.getQuizById(quizId);
        quiz = res.data?.data?.quiz || res.data?.quiz || res.data;
        attempt = { id: 1, _id: '1', quizId };
      }

      if (!quiz) {
        throw new Error('Quiz could not be loaded.');
      }

      const rawQuestions = quiz.questions || [];
      if (rawQuestions.length === 0) {
        throw new Error('This quiz does not have any questions yet.');
      }

      // Normalize questions so all components can access question, options, correctAnswer
      const normalizedQuestions = rawQuestions.map((q, idx) => ({
        id: q.id || q._id || idx + 1,
        _id: q._id || String(q.id || idx + 1),
        question: q.question || q.question_text || 'Quiz Question',
        options: Array.isArray(q.options) ? q.options : [],
        correctAnswer: q.correctAnswer || q.correct_answer || '',
        difficulty: q.difficulty || 'medium',
        type: q.type || q.question_type || 'mcq',
        explanation: q.explanation || ''
      }));

      const timeLimitMin = quiz.timeLimit || quiz.time_limit || Math.max(2, Math.round(normalizedQuestions.length * 1.5));
      const normalizedQuiz = {
        ...quiz,
        questions: normalizedQuestions,
        timeLimit: timeLimitMin,
        totalQuestions: normalizedQuestions.length
      };

      set({
        currentQuiz:     normalizedQuiz,
        currentAttempt:  attempt || { id: 1, _id: '1', quizId },
        currentQuestion: normalizedQuestions[0],
        questionIndex:   0,
        answers:         {},
        timeRemaining:   timeLimitMin * 60,
        isLoading:       false,
      });

      return { success: true };

    } catch (error) {
      set({ isLoading: false });
      const message = error.response?.data?.message || error.message || 'Failed to start quiz.';
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
      const timeTaken = exactTimeTaken !== null 
        ? exactTimeTaken 
        : ((currentQuiz?.timeLimit || 5) * 60) - timeRemaining;

      const attemptId = currentAttempt._id || currentAttempt.id || 1;
      const response = await quizAPI.submit(attemptId, {
        answers: Object.entries(answers).map(([questionId, answer]) => ({
          questionId,
          answer,
        })),
        timeTaken: Math.max(1, timeTaken),
      });

      const data = response.data?.data || response.data;
      const { result, adaptive, aiFeedback, topicAccuracy, performanceMetrics } = data;
      set({ result, isSubmitting: false });

      return { success: true, result, adaptive, aiFeedback, topicAccuracy, performanceMetrics };

    } catch (error) {
      // Local fallback calculation if backend submit network issue
      const questions = currentQuiz?.questions || [];
      let correct = 0;
      questions.forEach((q) => {
        const uAns = answers[q.id] || answers[q._id];
        if (uAns && (uAns === q.correctAnswer || String(uAns).toLowerCase() === String(q.correctAnswer).toLowerCase())) {
          correct++;
        }
      });
      const score = Math.round((correct / Math.max(questions.length, 1)) * 100);
      const fallbackResult = {
        score,
        correctAnswers: correct,
        totalQuestions: questions.length,
        percentage: score,
        passed: score >= 60,
        timeTaken: exactTimeTaken || 45
      };
      set({ result: fallbackResult, isSubmitting: false });
      return { success: true, result: fallbackResult };
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