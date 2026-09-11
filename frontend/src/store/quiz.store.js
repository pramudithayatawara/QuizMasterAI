import { create } from 'zustand';
import { quizAPI } from '../api/quiz.api.js';
import toast from 'react-hot-toast';

/**
 * @store useQuizStore
 * @description Quiz state management.
 */
export const useQuizStore = create((set, get) => ({
  // ─── State ────────────────────────────────────────────────────────────────
  quizzes:                 [],
  currentQuiz:             null,
  currentAttempt:          null,
  currentQuestion:         null,
  questionIndex:           0,
  totalAdaptiveQuestions:  10,
  answers:                 {},          // { questionId: answer }
  timeRemaining:           0,
  isLoading:               false,
  isSubmitting:            false,
  isSubmittingStep:        false,
  isAdaptiveMode:          false,
  currentDifficultyLevel:  'medium',
  adaptiveCalibration:     null,
  adaptiveTrajectory:      [],
  lastStepResult:          null,
  result:                  null,

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

  startQuiz: async (quizId, options = {}) => {
    set({ isLoading: true });
    try {
      const response = await quizAPI.start(quizId, options);
      const data = response.data.data;
      const { quiz, attempt, currentQuestion, isAdaptive, currentQuestionIndex, difficulty, totalQuestions } = data;

      if (isAdaptive) {
        set({
          currentQuiz: quiz || { _id: quizId, totalQuestions: totalQuestions || 10, difficulty: difficulty || 'medium' },
          currentAttempt: attempt,
          currentQuestion: currentQuestion,
          questionIndex: (currentQuestionIndex || 1) - 1,
          totalAdaptiveQuestions: totalQuestions || 10,
          isAdaptiveMode: true,
          currentDifficultyLevel: attempt?.currentDifficultyLevel || difficulty || 'medium',
          adaptiveCalibration: {
            currentDifficultyLevel: attempt?.currentDifficultyLevel || difficulty || 'medium',
            streak: attempt?.consecutiveCorrect || 0,
            abilityTheta: attempt?.currentAbilityTheta || 0,
            adjustment: 'maintained',
            reason: 'Initial calibration question',
          },
          adaptiveTrajectory: attempt?.trajectory || [],
          answers: {},
          timeRemaining: (data.timeLimit || attempt?.timeLimit || 20) * 60,
          isLoading: false,
          lastStepResult: null,
        });

        return { success: true, isAdaptive: true };
      }

      // Standard non-adaptive quiz
      set({
        currentQuiz:     quiz,
        currentAttempt:  attempt,
        currentQuestion: quiz.questions[0],
        questionIndex:   0,
        isAdaptiveMode:  false,
        answers:         {},
        timeRemaining:   quiz.timeLimit * 60,
        isLoading:       false,
        lastStepResult:  null,
      });

      return { success: true, isAdaptive: false };

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

      const response = await quizAPI.submit(currentAttempt.id || currentAttempt._id, {
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

  submitAdaptiveStep: async (answer, timeTaken = 0) => {
    const { currentAttempt, currentQuestion, questionIndex, totalAdaptiveQuestions } = get();
    if (!currentAttempt || !currentQuestion) return { success: false };

    set({ isSubmittingStep: true });
    try {
      const attemptId = currentAttempt.id || currentAttempt._id;
      const response = await quizAPI.submitAdaptiveStep(attemptId, {
        questionId: currentQuestion._id,
        answer,
        timeTaken,
      });

      const data = response.data.data;
      const { finished, stepResult, calibration, nextQuestion, currentQuestionIndex, evaluation } = data;

      // Update trajectory & calibration state
      set((state) => ({
        isSubmittingStep: false,
        lastStepResult: stepResult,
        adaptiveCalibration: calibration,
        currentDifficultyLevel: calibration?.currentDifficultyLevel || state.currentDifficultyLevel,
        adaptiveTrajectory: [
          ...state.adaptiveTrajectory,
          {
            ...stepResult,
            ...calibration,
            questionText: currentQuestion.questionText,
            selectedAnswer: answer,
          },
        ],
        answers: { ...state.answers, [currentQuestion._id]: answer },
      }));

      if (finished) {
        set({ result: evaluation, isSubmitting: false });
        return { finished: true, evaluation, calibration, stepResult };
      }

      // Transition to the newly calibrated next question
      set({
        currentQuestion: nextQuestion,
        questionIndex: (currentQuestionIndex || questionIndex + 2) - 1,
      });

      return { finished: false, stepResult, calibration, nextQuestion };

    } catch (error) {
      set({ isSubmittingStep: false });
      const message = error.response?.data?.message || 'Failed to evaluate adaptive step.';
      toast.error(message);
      return { success: false, message };
    }
  },

  clearQuizState: () => {
    set({
      currentQuiz:             null,
      currentAttempt:          null,
      currentQuestion:         null,
      questionIndex:           0,
      totalAdaptiveQuestions:  10,
      answers:                 {},
      timeRemaining:           0,
      isLoading:               false,
      isSubmitting:            false,
      isSubmittingStep:        false,
      isAdaptiveMode:          false,
      currentDifficultyLevel:  'medium',
      adaptiveCalibration:     null,
      adaptiveTrajectory:      [],
      lastStepResult:          null,
      result:                  null,
    });
  },
}));