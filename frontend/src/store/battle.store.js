import { create } from 'zustand';
import { SOCKET_EVENTS } from '../constants/events.js';

/**
 * @store useBattleStore
 * @description Battle mode state management.
 */
export const useBattleStore = create((set, get) => ({
  // ─── State ────────────────────────────────────────────────────────────────
  // Matchmaking
  isInQueue:          false,
  queuePosition:      0,
  queueSize:          0,
  matchmakingStatus:  null,  // 'queued' | 'matched' | 'cancelled' | 'timeout'

  // Battle
  battle:             null,
  battleId:           null,
  roomId:             null,
  players:            [],
  status:             null,  // 'starting' | 'active' | 'finished'
  difficulty:         null,

  // Question
  currentQuestion:    null,
  questionIndex:      0,
  totalQuestions:     0,
  timeLimit:          30,
  timeRemaining:      30,

  // Answers & Scores
  myAnswer:           null,
  isAnswerSubmitted:  false,
  lastAnswerResult:   null,
  scores:             [],

  // Result
  battleResult:       null,
  isFinished:         false,

  // UI
  isLoading:          false,
  chatMessages:       [],

  // ─── Matchmaking Actions ──────────────────────────────────────────────────

  setQueueStatus: (data) => {
    set({
      isInQueue:         data.status === 'queued',
      queuePosition:     data.queuePosition || 0,
      queueSize:         data.queueSize || 0,
      matchmakingStatus: data.status,
    });
  },

  setMatchFound: (data) => {
    set({
      isInQueue:         false,
      matchmakingStatus: 'matched',
      battleId:          data.battleId,
      roomId:            data.roomId,
      players:           data.players,
      difficulty:        data.difficulty,
      totalQuestions:    data.totalQuestions,
    });
  },

  // ─── Battle Actions ───────────────────────────────────────────────────────

  setBattleStarted: (data) => {
    set({
      status:          'active',
      currentQuestion: data.question,
      questionIndex:   data.questionIndex,
      totalQuestions:  data.totalQuestions,
      timeLimit:       data.timePerQuestion,
      timeRemaining:   data.timePerQuestion,
      myAnswer:        null,
      isAnswerSubmitted: false,
    });
  },

  setNextQuestion: (data) => {
    set({
      currentQuestion:   data.question,
      questionIndex:     data.questionIndex,
      totalQuestions:    data.totalQuestions,
      timeLimit:         data.timeLimit,
      timeRemaining:     data.timeLimit,
      myAnswer:          null,
      isAnswerSubmitted: false,
      lastAnswerResult:  null,
    });
  },

  setAnswerResult: (data) => {
    set({
      lastAnswerResult:  data,
      isAnswerSubmitted: true,
    });
  },

  setScoreUpdate: (data) => {
    set({
      scores:    data.scores,
      players:   get().players.map((p) => {
        const score = data.scores.find(
          (s) => s.userId === p.userId
        );
        return score ? { ...p, ...score } : p;
      }),
    });
  },

  setBattleFinished: (data) => {
    set({
      isFinished:   true,
      status:       'finished',
      battleResult: data,
    });
  },

  submitMyAnswer: (answer) => {
    set({
      myAnswer:          answer,
      isAnswerSubmitted: true,
    });
  },

  updateTimer: (time) => {
    set({ timeRemaining: time });
  },

  addChatMessage: (message) => {
    set((state) => ({
      chatMessages: [...state.chatMessages.slice(-50), message],
    }));
  },

  // ─── Reset ────────────────────────────────────────────────────────────────

  resetBattle: () => {
    set({
      isInQueue:          false,
      queuePosition:      0,
      queueSize:          0,
      matchmakingStatus:  null,
      battle:             null,
      battleId:           null,
      roomId:             null,
      players:            [],
      status:             null,
      difficulty:         null,
      currentQuestion:    null,
      questionIndex:      0,
      totalQuestions:     0,
      timeLimit:          30,
      timeRemaining:      30,
      myAnswer:           null,
      isAnswerSubmitted:  false,
      lastAnswerResult:   null,
      scores:             [],
      battleResult:       null,
      isFinished:         false,
      chatMessages:       [],
    });
  },
}));