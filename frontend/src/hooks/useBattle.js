import { useEffect, useCallback, useRef } from 'react';
import { useBattleStore } from '../store/battle.store.js';
import { useSocket } from './useSocket.js';
import { SOCKET_EVENTS } from '../constants/events.js';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes.js';
import toast from 'react-hot-toast';

/**
 * @hook useBattle
 * @description Complete battle mode hook with socket event handling.
 */
export const useBattle = () => {
  const store    = useBattleStore();
  const { emit, on, socket } = useSocket();
  const navigate = useNavigate();
  const timerRef = useRef(null);

  // ─── Socket Event Listeners ─────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Matchmaking events
    const offMatchmakingStatus = on(
      SOCKET_EVENTS.MATCHMAKING_STATUS,
      (data) => store.setQueueStatus(data)
    );

    const offMatchPlayers = on(
      SOCKET_EVENTS.MATCH_PLAYERS,
      (data) => {
        store.setMatchFound(data);
        toast.success('Match found! Joining battle...');
        // Join the battle room
        emit(SOCKET_EVENTS.JOIN_BATTLE, { battleId: data.battleId });
      }
    );

    const offMatchmakingTimeout = on(
      SOCKET_EVENTS.MATCHMAKING_TIMEOUT,
      (data) => {
        store.setQueueStatus({ status: 'timeout' });
        toast.error(data.message || 'Matchmaking timed out.');
      }
    );

    // Battle events
    const offStartBattle = on(
      SOCKET_EVENTS.START_BATTLE,
      (data) => {
        store.setBattleStarted(data);
        startTimer(data.timePerQuestion);
        navigate(ROUTES.BATTLE_PLAY.replace(':id', data.battleId));
      }
    );

    const offNextQuestion = on(
      SOCKET_EVENTS.NEXT_QUESTION,
      (data) => {
        store.setNextQuestion(data);
        resetTimer(data.timeLimit);
      }
    );

    const offAnswerResult = on(
      SOCKET_EVENTS.ANSWER_RESULT,
      (data) => store.setAnswerResult(data)
    );

    const offScoreUpdate = on(
      SOCKET_EVENTS.SCORE_UPDATE,
      (data) => store.setScoreUpdate(data)
    );

    const offBattleFinished = on(
      SOCKET_EVENTS.BATTLE_FINISHED,
      (data) => {
        stopTimer();
        store.setBattleFinished(data);
        const msg = data.winner
          ? `🏆 ${data.winner.userName} wins!`
          : "🤝 It's a draw!";
        toast.success(msg, { duration: 5000 });
      }
    );

    const offPlayerDisconnected = on(
      SOCKET_EVENTS.PLAYER_DISCONNECTED,
      (data) => {
        toast(`⚠️ ${data.message}`, { icon: '⚠️' });
      }
    );

    const offBattleMessage = on(
      SOCKET_EVENTS.BATTLE_MESSAGE,
      (data) => store.addChatMessage(data)
    );

    const offBattleError = on(
      SOCKET_EVENTS.BATTLE_ERROR,
      (data) => toast.error(data.message)
    );

    return () => {
      offMatchmakingStatus();
      offMatchPlayers();
      offMatchmakingTimeout();
      offStartBattle();
      offNextQuestion();
      offAnswerResult();
      offScoreUpdate();
      offBattleFinished();
      offPlayerDisconnected();
      offBattleMessage();
      offBattleError();
    };
  }, [socket]);

  // ─── Timer Management ───────────────────────────────────────────────────────
  const startTimer = useCallback((seconds) => {
    store.updateTimer(seconds);
    timerRef.current = setInterval(() => {
      store.updateTimer(Math.max(store.timeRemaining - 1, 0));
    }, 1000);
  }, []);

  const resetTimer = useCallback((seconds) => {
    stopTimer();
    startTimer(seconds);
  }, [startTimer]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => () => stopTimer(), [stopTimer]);

  // ─── Actions ────────────────────────────────────────────────────────────────
  const joinMatchmaking = useCallback((difficulty) => {
    emit(SOCKET_EVENTS.JOIN_ROOM, { difficulty });
  }, [emit]);

  const leaveMatchmaking = useCallback(() => {
    emit(SOCKET_EVENTS.LEAVE_ROOM);
    store.resetBattle();
  }, [emit]);

  const submitAnswer = useCallback((answer) => {
    if (store.isAnswerSubmitted) return;

    store.submitMyAnswer(answer);
    emit(SOCKET_EVENTS.SUBMIT_ANSWER_LIVE, {
      battleId:      store.battleId,
      questionId:    store.currentQuestion?._id,
      answer,
      timeRemaining: store.timeRemaining,
    });
  }, [emit, store]);

  const sendChatMessage = useCallback((message) => {
    emit(SOCKET_EVENTS.BATTLE_CHAT, {
      battleRoomId: store.roomId,
      message,
    });
  }, [emit, store.roomId]);

  return {
    // State
    ...store,
    // Actions
    joinMatchmaking,
    leaveMatchmaking,
    submitAnswer,
    sendChatMessage,
    resetBattle: store.resetBattle,
  };
};