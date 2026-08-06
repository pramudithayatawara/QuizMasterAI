import { SOCKET_EVENTS } from '../constants/events.js';

/**
 * @module battleSocket
 * @description Battle mode specific socket event handlers.
 */

/**
 * @function setupBattleSocketListeners
 * @description Setup all battle-related socket event listeners.
 * @param {Socket} socket - Socket.io instance
 * @param {Object} callbacks - Callback functions for each event
 * @returns {Function} Cleanup function to remove all listeners
 */
export const setupBattleSocketListeners = (socket, callbacks) => {
  const listeners = [];

  // Helper to add listener and track it
  const addListener = (event, handler) => {
    socket.on(event, handler);
    listeners.push({ event, handler });
  };

  // ─── Matchmaking Events ────────────────────────────────────────────────────────

  addListener(SOCKET_EVENTS.MATCHMAKING_STATUS, (data) => {
    callbacks.onMatchmakingStatus?.(data);
  });

  addListener(SOCKET_EVENTS.MATCH_PLAYERS, (data) => {
    callbacks.onMatchFound?.(data);
  });

  addListener(SOCKET_EVENTS.MATCHMAKING_TIMEOUT, (data) => {
    callbacks.onMatchmakingTimeout?.(data);
  });

  addListener(SOCKET_EVENTS.QUEUE_STATUS, (data) => {
    callbacks.onQueueStatus?.(data);
  });

  // ─── Battle Events ─────────────────────────────────────────────────────────────

  addListener(SOCKET_EVENTS.JOINED_BATTLE, (data) => {
    callbacks.onJoinedBattle?.(data);
  });

  addListener(SOCKET_EVENTS.START_BATTLE, (data) => {
    callbacks.onBattleStart?.(data);
  });

  addListener(SOCKET_EVENTS.NEXT_QUESTION, (data) => {
    callbacks.onNextQuestion?.(data);
  });

  addListener(SOCKET_EVENTS.ANSWER_RESULT, (data) => {
    callbacks.onAnswerResult?.(data);
  });

  addListener(SOCKET_EVENTS.SCORE_UPDATE, (data) => {
    callbacks.onScoreUpdate?.(data);
  });

  addListener(SOCKET_EVENTS.BATTLE_FINISHED, (data) => {
    callbacks.onBattleFinished?.(data);
  });

  addListener(SOCKET_EVENTS.BATTLE_STATE, (data) => {
    callbacks.onBattleState?.(data);
  });

  addListener(SOCKET_EVENTS.BATTLE_ERROR, (data) => {
    callbacks.onBattleError?.(data);
  });

  // ─── Player Events ─────────────────────────────────────────────────────────────

  addListener(SOCKET_EVENTS.PLAYER_JOINED, (data) => {
    callbacks.onPlayerJoined?.(data);
  });

  addListener(SOCKET_EVENTS.PLAYER_DISCONNECTED, (data) => {
    callbacks.onPlayerDisconnected?.(data);
  });

  // ─── Timer Events ───────────────────────────────────────────────────────────────

  addListener(SOCKET_EVENTS.TIMER_SYNC, (data) => {
    callbacks.onTimerSync?.(data);
  });

  // ─── Chat Events ─────────────────────────────────────────────────────────────────

  addListener(SOCKET_EVENTS.BATTLE_MESSAGE, (data) => {
    callbacks.onBattleMessage?.(data);
  });

  // Return cleanup function
  return () => {
    listeners.forEach(({ event, handler }) => {
      socket.off(event, handler);
    });
  };
};

/**
 * @function emitBattleEvents
 * @description Helper functions to emit battle-related events.
 * @param {Socket} socket - Socket.io instance
 */
export const emitBattleEvents = (socket) => ({
  // Matchmaking
  joinMatchmaking: (data) => socket.emit(SOCKET_EVENTS.JOIN_ROOM, data),
  leaveMatchmaking: () => socket.emit(SOCKET_EVENTS.LEAVE_ROOM),
  getQueueStatus: () => socket.emit(SOCKET_EVENTS.GET_QUEUE_STATUS),
  checkMatchmaking: () => socket.emit(SOCKET_EVENTS.CHECK_MATCHMAKING),

  // Battle
  joinBattle: (data) => socket.emit(SOCKET_EVENTS.JOIN_BATTLE, data),
  submitAnswer: (data) => socket.emit(SOCKET_EVENTS.SUBMIT_ANSWER_LIVE, data),
  getBattleStatus: (data) => socket.emit(SOCKET_EVENTS.GET_BATTLE_STATUS, data),
  syncTimer: (data) => socket.emit(SOCKET_EVENTS.SYNC_TIMER, data),

  // Chat
  sendChatMessage: (data) => socket.emit(SOCKET_EVENTS.BATTLE_CHAT, data),
});

export default {
  setupBattleSocketListeners,
  emitBattleEvents,
};