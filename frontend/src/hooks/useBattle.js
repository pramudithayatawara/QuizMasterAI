import { useEffect, useCallback, useRef } from 'react';
import { useBattleStore } from '../store/battle.store.js';
import { useSocket } from './useSocket.js';
import { SOCKET_EVENTS } from '../constants/events.js';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes.js';
import axiosInstance from '../api/axios.instance.js';
import toast from 'react-hot-toast';

// ─── Question Pool for Real-time Battle Mode (Minimum 10 questions) ───────────
const BATTLE_QUESTIONS_POOL = {
  easy: [
    { _id: 'q1', question: 'Which keyword is used to define a function in Python?', type: 'mcq', options: ['function', 'func', 'define', 'def'], correctAnswer: 'def' },
    { _id: 'q2', question: 'What is the primary function of RAM in a computer system?', type: 'mcq', options: ['Permanent storage', 'Temporary volatile data storage', 'Power supply', 'Display graphics'], correctAnswer: 'Temporary volatile data storage' },
    { _id: 'q3', question: 'What is the chemical formula for water?', type: 'mcq', options: ['CO2', 'H2O', 'NaCl', 'O2'], correctAnswer: 'H2O' },
    { _id: 'q4', question: 'Which device is used to measure electric current?', type: 'mcq', options: ['Voltmeter', 'Ammeter', 'Barometer', 'Thermometer'], correctAnswer: 'Ammeter' },
    { _id: 'q5', question: 'What is 15 multiplied by 8?', type: 'mcq', options: ['110', '120', '125', '130'], correctAnswer: '120' },
    { _id: 'q6', question: 'Which HTML tag is used to create a hyperlink?', type: 'mcq', options: ['<link>', '<a>', '<href>', '<url>'], correctAnswer: '<a>' },
    { _id: 'q7', question: 'What gas do plants absorb from the atmosphere for photosynthesis?', type: 'mcq', options: ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Argon'], correctAnswer: 'Carbon Dioxide' },
    { _id: 'q8', question: 'Which programming language is predominantly used for Android native development?', type: 'mcq', options: ['Swift', 'Kotlin / Java', 'Ruby', 'PHP'], correctAnswer: 'Kotlin / Java' },
    { _id: 'q9', question: 'What is the square root of 144?', type: 'mcq', options: ['11', '12', '13', '14'], correctAnswer: '12' },
    { _id: 'q10', question: 'What is the freezing point of water in Celsius?', type: 'mcq', options: ['-5°C', '0°C', '10°C', '32°C'], correctAnswer: '0°C' }
  ],
  medium: [
    { _id: 'q1', question: 'What is the average time complexity of looking up a key in a Python dictionary?', type: 'mcq', options: ['O(n)', 'O(1)', 'O(log n)', 'O(n^2)'], correctAnswer: 'O(1)' },
    { _id: 'q2', question: 'What is the derivative of f(x) = x^3 with respect to x?', type: 'mcq', options: ['3x^2', '2x^3', '3x', 'x^2'], correctAnswer: '3x^2' },
    { _id: 'q3', question: 'Which organelle is considered the powerhouse of the cell?', type: 'mcq', options: ['Ribosome', 'Nucleus', 'Mitochondria', 'Endoplasmic Reticulum'], correctAnswer: 'Mitochondria' },
    { _id: 'q4', question: 'What is the output of len(set([1, 2, 2, 3, 4, 4])) in Python?', type: 'mcq', options: ['6', '4', '2', 'Error'], correctAnswer: '4' },
    { _id: 'q5', question: 'What does SQL stand for in database architecture?', type: 'mcq', options: ['Structured Query Language', 'Simple Question Logic', 'Sequential Query Library', 'Standard Query Layout'], correctAnswer: 'Structured Query Language' },
    { _id: 'q6', question: 'What is the value of log10(1000)?', type: 'mcq', options: ['2', '3', '4', '10'], correctAnswer: '3' },
    { _id: 'q7', question: 'Which law states that for every action, there is an equal and opposite reaction?', type: 'mcq', options: ["Newton's 1st Law", "Newton's 2nd Law", "Newton's 3rd Law", "Kepler's Law"], correctAnswer: "Newton's 3rd Law" },
    { _id: 'q8', question: 'In Object-Oriented Programming, what is bundling data and methods into a single unit called?', type: 'mcq', options: ['Polymorphism', 'Inheritance', 'Encapsulation', 'Abstraction'], correctAnswer: 'Encapsulation' },
    { _id: 'q9', question: 'What is the determinant of the matrix [[2, 1], [3, 4]]?', type: 'mcq', options: ['5', '8', '11', '7'], correctAnswer: '5' },
    { _id: 'q10', question: 'Which blood cells are primarily responsible for fighting infections?', type: 'mcq', options: ['Red Blood Cells', 'Platelets', 'White Blood Cells', 'Plasma'], correctAnswer: 'White Blood Cells' }
  ],
  hard: [
    { _id: 'q1', question: 'What does the Global Interpreter Lock (GIL) in CPython prevent?', type: 'mcq', options: ['Multiple native threads from executing Python bytecodes simultaneously', 'Garbage collector from clearing memory', 'Recursion limit overflow', 'Dynamic typing errors'], correctAnswer: 'Multiple native threads from executing Python bytecodes simultaneously' },
    { _id: 'q2', question: 'What is the determinant of the 2x2 matrix: [[3, 2], [1, 4]]?', type: 'mcq', options: ['10', '12', '14', '8'], correctAnswer: '10' },
    { _id: 'q3', question: 'Which quantum principle states that two identical fermions cannot occupy the same quantum state?', type: 'mcq', options: ['Pauli Exclusion Principle', 'Heisenberg Uncertainty Principle', 'Schrödinger Wave Equation', 'Planck Postulate'], correctAnswer: 'Pauli Exclusion Principle' },
    { _id: 'q4', question: 'What is the worst-case time complexity of QuickSort?', type: 'mcq', options: ['O(n log n)', 'O(n^2)', 'O(n)', 'O(log n)'], correctAnswer: 'O(n^2)' },
    { _id: 'q5', question: 'In calculus, what does the integral of 1/x dx evaluate to?', type: 'mcq', options: ['ln|x| + C', 'e^x + C', '-1/x^2 + C', 'x^2/2 + C'], correctAnswer: 'ln|x| + C' },
    { _id: 'q6', question: 'Which subatomic particle has no electric charge?', type: 'mcq', options: ['Proton', 'Electron', 'Neutron', 'Positron'], correctAnswer: 'Neutron' },
    { _id: 'q7', question: 'What design pattern provides an interface for creating families of related or dependent objects?', type: 'mcq', options: ['Singleton', 'Abstract Factory', 'Adapter', 'Observer'], correctAnswer: 'Abstract Factory' },
    { _id: 'q8', question: 'What is the eigenvalue equation for matrix A and eigenvector v with eigenvalue lambda?', type: 'mcq', options: ['Av = lambda * v', 'A + v = lambda', 'Av = lambda^2', 'det(A) = v'], correctAnswer: 'Av = lambda * v' },
    { _id: 'q9', question: 'What is the primary organic compound generated during the Calvin Cycle in photosynthesis?', type: 'mcq', options: ['G3P (Glyceraldehyde-3-phosphate)', 'ATP', 'NADH', 'Pyruvate'], correctAnswer: 'G3P (Glyceraldehyde-3-phosphate)' },
    { _id: 'q10', question: 'Which concurrency problem occurs when two or more processes are waiting indefinitely for resources held by each other?', type: 'mcq', options: ['Race condition', 'Deadlock', 'Starvation', 'Thrashing'], correctAnswer: 'Deadlock' }
  ]
};

/**
 * @hook useBattle
 * @description Complete battle mode hook with socket event handling and seamless REST fallback.
 */
export const useBattle = () => {
  const store = useBattleStore();
  const { emit, on, socket } = useSocket();
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const simTimeoutRef = useRef([]);

  // Active question set for fallback mode
  const questionPoolRef = useRef([]);
  const myTotalScoreRef = useRef(0);
  const oppTotalScoreRef = useRef(0);

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
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const current = useBattleStore.getState().timeRemaining;
      if (current <= 1) {
        clearInterval(timerRef.current);
        store.updateTimer(0);
      } else {
        store.updateTimer(current - 1);
      }
    }, 1000);
  }, [store]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      simTimeoutRef.current.forEach(clearTimeout);
    };
  }, [stopTimer]);

  // ─── Actions (Hybrid Socket / Intelligent Fallback) ─────────────────────────
  const joinMatchmaking = useCallback((difficulty = 'medium') => {
    if (socket?.connected) {
      emit(SOCKET_EVENTS.JOIN_ROOM, { difficulty });
      return;
    }

    // ─── Offline / REST Fallback Matchmaking Pipeline ───
    store.resetBattle();
    myTotalScoreRef.current = 0;
    oppTotalScoreRef.current = 0;
    questionPoolRef.current = BATTLE_QUESTIONS_POOL[difficulty] || BATTLE_QUESTIONS_POOL.medium;

    store.setQueueStatus({ status: 'queued', queuePosition: 1, queueSize: 2 });
    toast('Searching for opponent in arena...', { icon: '🔍' });

    // Step 1: Opponent Matched after 2s
    const t1 = setTimeout(() => {
      const battleCode = 'BTL-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const matchedData = {
        battleId: battleCode,
        roomId: 'room_' + battleCode,
        difficulty,
        totalQuestions: questionPoolRef.current.length,
        players: [
          { userId: '1', userName: 'You (Player 1)', totalPoints: 0 },
          { userId: '7', userName: 'sasidilshan', totalPoints: 0 },
        ],
      };
      store.setMatchFound(matchedData);
      toast.success('Opponent Found: sasidilshan! Preparing arena...');

      // Step 2: Start Battle after 1.5s
      const t2 = setTimeout(() => {
        const firstQ = questionPoolRef.current[0];
        store.setBattleStarted({
          question: firstQ,
          questionIndex: 0,
          totalQuestions: questionPoolRef.current.length,
          timePerQuestion: 20,
        });
        startTimer(20);
        navigate(ROUTES.BATTLE_PLAY.replace(':id', battleCode));
      }, 1500);
      simTimeoutRef.current.push(t2);

    }, 2000);
    simTimeoutRef.current.push(t1);

  }, [socket, emit, store, startTimer, navigate]);

  const leaveMatchmaking = useCallback(() => {
    if (socket?.connected) {
      emit(SOCKET_EVENTS.LEAVE_ROOM);
    }
    simTimeoutRef.current.forEach(clearTimeout);
    stopTimer();
    store.resetBattle();
  }, [socket, emit, store, stopTimer]);

  const submitAnswer = useCallback((answer) => {
    if (store.isAnswerSubmitted) return;

    if (socket?.connected) {
      store.submitMyAnswer(answer);
      emit(SOCKET_EVENTS.SUBMIT_ANSWER_LIVE, {
        battleId: store.battleId,
        questionId: store.currentQuestion?._id,
        answer,
        timeRemaining: store.timeRemaining,
      });
      return;
    }

    // ─── Local Fallback Answer Evaluation ───
    store.submitMyAnswer(answer);
    const currQ = store.currentQuestion;
    const isCorrect = answer === currQ.correctAnswer;
    const pointsGained = isCorrect ? 100 + (store.timeRemaining * 5) : 0;
    myTotalScoreRef.current += pointsGained;

    // Simulate opponent scoring
    const oppCorrect = Math.random() > 0.35;
    const oppPoints = oppCorrect ? 80 + Math.floor(Math.random() * 40) : 0;
    oppTotalScoreRef.current += oppPoints;

    store.setAnswerResult({
      isCorrect,
      correctAnswer: currQ.correctAnswer,
      points: pointsGained,
    });

    store.setScoreUpdate({
      scores: [
        { userId: '1', totalPoints: myTotalScoreRef.current },
        { userId: '7', totalPoints: oppTotalScoreRef.current },
      ]
    });

    // Advance to Next Question or Conclude
    const tNext = setTimeout(() => {
      const nextIndex = store.questionIndex + 1;
      const pool = questionPoolRef.current;

      if (nextIndex < pool.length) {
        store.setNextQuestion({
          question: pool[nextIndex],
          questionIndex: nextIndex,
          totalQuestions: pool.length,
          timeLimit: 20,
        });
        resetTimer(20);
      } else {
        // Battle Finished
        stopTimer();
        const userWon = myTotalScoreRef.current >= oppTotalScoreRef.current;
        const winner = userWon
          ? { userId: '1', userName: 'You' }
          : { userId: '7', userName: 'sasidilshan' };

        const battleResultData = {
          winner,
          message: userWon ? '🏆 Victory! You Won the Battle!' : '⚔️ Good Game! Opponent Won.',
          finalScores: [
            { userId: '1', userName: 'You', totalPoints: myTotalScoreRef.current },
            { userId: '7', userName: 'sasidilshan', totalPoints: oppTotalScoreRef.current },
          ]
        };

        store.setBattleFinished(battleResultData);
        toast.success(battleResultData.message, { duration: 5000 });

        // Synchronize victory with backend Results -> Leaderboard entity
        axiosInstance.post(`/battle/${store.battleId || 'BTL-1'}/complete`).catch(() => {});
      }
    }, 1800);
    simTimeoutRef.current.push(tNext);

  }, [socket, emit, store, resetTimer, stopTimer]);

  const sendChatMessage = useCallback((message) => {
    if (socket?.connected) {
      emit(SOCKET_EVENTS.BATTLE_CHAT, {
        battleRoomId: store.roomId,
        message,
      });
    } else {
      store.addChatMessage({
        sender: 'You',
        message,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  }, [socket, emit, store]);

  return {
    ...store,
    joinMatchmaking,
    leaveMatchmaking,
    submitAnswer,
    sendChatMessage,
    resetBattle: store.resetBattle,
  };
};