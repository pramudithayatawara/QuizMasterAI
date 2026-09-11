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

  // ─── Timer Management ───────────────────────────────────────────────────────
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback((seconds) => {
    stopTimer();
    useBattleStore.setState({ timeRemaining: seconds });

    timerRef.current = setInterval(() => {
      // Use functional setState to avoid stale closure
      useBattleStore.setState((state) => ({
        timeRemaining: Math.max(state.timeRemaining - 1, 0),
      }));
    }, 1000);
  }, [stopTimer]);

  const resetTimer = useCallback((seconds) => {
    startTimer(seconds);
  }, [startTimer]);

  // Cleanup timer on unmount
  useEffect(() => () => stopTimer(), [stopTimer]);

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
        toast.success('⚔️ Match found! Joining battle...', { duration: 3000 });
        // Join the battle room immediately so we receive startBattle
        emit(SOCKET_EVENTS.JOIN_BATTLE, { battleId: data.battleId });
      }
    );

    const offMatchmakingTimeout = on(
      SOCKET_EVENTS.MATCHMAKING_TIMEOUT,
      (data) => {
        store.setQueueStatus({ status: 'timeout' });
        toast.error(data.message || 'Matchmaking timed out. Please try again.');
      }
    );

    // Joined battle room confirmation
    const offJoinedBattle = on(
      SOCKET_EVENTS.JOINED_BATTLE,
      (data) => {
        if (data.success) {
          useBattleStore.setState((s) => ({
            battleId: data.battleId || s.battleId,
            roomId:   data.roomId   || s.roomId,
          }));
        }
      }
    );

    // Battle events
    const offStartBattle = on(
      SOCKET_EVENTS.START_BATTLE,
      (data) => {
        const currentBattle = useBattleStore.getState();
        if (currentBattle.status === 'active' && currentBattle.currentQuestion) {
          return; // Ignore duplicate startBattle events
        }
        store.setBattleStarted(data);
        startTimer(data.timePerQuestion || 30);
        navigate(ROUTES.BATTLE_PLAY.replace(':id', data.battleId));
      }
    );

    const offNextQuestion = on(
      SOCKET_EVENTS.NEXT_QUESTION,
      (data) => {
        const current = useBattleStore.getState();
        // Prevent duplicate nextQuestion processing for the same index & question
        if (
          current.questionIndex === data.questionIndex &&
          current.currentQuestion &&
          (current.currentQuestion._id === data.question?._id ||
            current.currentQuestion.question === data.question?.question)
        ) {
          return;
        }
        store.setNextQuestion(data);
        resetTimer(data.timeLimit || 30);
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

    const offBattleState = on(
      'battleState',
      (data) => {
        const current = useBattleStore.getState();
        if (data.status === 'active' && data.question) {
          // Only adopt state if we don't currently have an active question
          if (!current.currentQuestion) {
            store.setBattleStarted({
              ...data,
              questionIndex: typeof data.currentQuestionIndex === 'number' ? data.currentQuestionIndex : 0,
            });
            startTimer(data.timePerQuestion || 30);
          }
        } else if (data.status === 'finished') {
          store.setBattleFinished(data);
        }
      }
    );

    return () => {
      offMatchmakingStatus();
      offMatchPlayers();
      offMatchmakingTimeout();
      offJoinedBattle();
      offStartBattle();
      offNextQuestion();
      offAnswerResult();
      offScoreUpdate();
      offBattleFinished();
      offPlayerDisconnected();
      offBattleMessage();
      offBattleError();
      offBattleState();
    };
  }, [socket, startTimer, resetTimer, stopTimer]);

  // ─── Actions ────────────────────────────────────────────────────────────────
  const joinMatchmaking = useCallback((difficulty) => {
    emit(SOCKET_EVENTS.JOIN_ROOM, { difficulty });
  }, [emit]);

  const leaveMatchmaking = useCallback(() => {
    emit(SOCKET_EVENTS.LEAVE_ROOM);
    store.resetBattle();
  }, [emit, store]);

  const rejoinBattle = useCallback((battleId) => {
    if (!battleId) return;
    emit(SOCKET_EVENTS.JOIN_BATTLE, { battleId });
    emit('getBattleStatus', { battleId });
  }, [emit]);

  const submitAnswer = useCallback((answer) => {
    if (store.isAnswerSubmitted) return;

    store.submitMyAnswer(answer);
    emit(SOCKET_EVENTS.SUBMIT_ANSWER_LIVE, {
      battleId:      store.battleId,
      questionId:    store.currentQuestion?._id || store.currentQuestion?.id || `q-${store.questionIndex}`,
      questionIndex: store.questionIndex,
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
    rejoinBattle,
    submitAnswer,
    sendChatMessage,
    resetBattle: store.resetBattle,
  };
};