import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, Clock, Target, Zap, ArrowRight, RotateCcw, 
  CheckCircle, XCircle, Volume2, VolumeX, Swords, ChevronDown, ChevronUp, FileText
} from 'lucide-react';
import { ROUTES } from '../../constants/routes.js';
import { useAuthStore } from '../../store/auth.store.js';
import axiosInstance from '../../api/axios.instance.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import { formatTimer } from '../../utils/formatters.js';
import { cn } from '../../utils/helpers.js';
import toast from 'react-hot-toast';
import { 
  playCorrectSound, playWrongSound, playVictorySound, 
  playEmotePopSound, toggleMuteSfx, getMuteStatus 
} from '../../utils/soundEffects.js';

// Fallback questions pool if room data needs backup
const FALLBACK_10_QUESTIONS = [
  { _id: 'q1', question: 'Which keyword is used to define a function in Python?', type: 'mcq', options: ['function', 'func', 'define', 'def'], correctAnswer: 'def', explanation: 'In Python, def is used to define functions.' },
  { _id: 'q2', question: 'What is the primary function of RAM in a computer system?', type: 'mcq', options: ['Permanent storage', 'Temporary volatile data storage', 'Power supply', 'Display graphics'], correctAnswer: 'Temporary volatile data storage', explanation: 'RAM holds active runtime code and data temporarily.' },
  { _id: 'q3', question: 'What is the average time complexity of looking up a key in a Python dictionary?', type: 'mcq', options: ['O(n)', 'O(1)', 'O(log n)', 'O(n^2)'], correctAnswer: 'O(1)', explanation: 'Hash maps provide constant-time average lookup O(1).' },
  { _id: 'q4', question: 'What is the derivative of f(x) = x^2 with respect to x?', type: 'mcq', options: ['x^1', '2x', '1x', '3x^2'], correctAnswer: '2x', explanation: 'Power rule: d/dx(x^n) = n*x^(n-1).' },
  { _id: 'q5', question: "What is Newton's First Law of Motion also known as?", type: 'mcq', options: ['Law of Gravitation', 'Law of Acceleration', 'Law of Inertia', 'Action Reaction'], correctAnswer: 'Law of Inertia', explanation: 'An object in motion remains in motion unless acted upon by an external force.' },
  { _id: 'q6', question: 'What does SQL stand for in database architecture?', type: 'mcq', options: ['Structured Query Language', 'Simple Question Logic', 'Sequential Query Library', 'Standard Query Layout'], correctAnswer: 'Structured Query Language', explanation: 'SQL is the standard language for relational database management.' },
  { _id: 'q7', question: 'What is the chemical formula for water?', type: 'mcq', options: ['CO2', 'H2O', 'NaCl', 'O2'], correctAnswer: 'H2O', explanation: 'Water consists of two Hydrogen atoms and one Oxygen atom.' },
  { _id: 'q8', question: 'Which data structure follows the Last-In First-Out (LIFO) principle?', type: 'mcq', options: ['Queue', 'Stack', 'Array', 'Linked List'], correctAnswer: 'Stack', explanation: 'Stack operates on LIFO (Last-In First-Out).' },
  { _id: 'q9', question: 'What is the powerhouse organelle of the cell?', type: 'mcq', options: ['Ribosome', 'Nucleus', 'Mitochondria', 'Chloroplast'], correctAnswer: 'Mitochondria', explanation: 'Mitochondria generate the majority of cellular ATP.' },
  { _id: 'q10', question: 'What is the speed of light in vacuum approximately?', type: 'mcq', options: ['300,000 km/s', '150,000 km/s', '500,000 km/s', '1,000,000 km/s'], correctAnswer: '300,000 km/s', explanation: 'c ≈ 299,792 km/s, rounded to 300,000 km/s.' }
];

const EMOTE_OPTIONS = ['🔥', '⚡', '🤯', '👏', '⚔️'];

/**
 * @page BattlePlayPage
 * @description Real-time Peer-to-Peer Battle Arena with Live Polling, Emotes, Audio SFX,
 * Opponent Answering Status Indicator, and Comparative Post-Match Question Review.
 */
const BattlePlayPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // ─── Battle State ───────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [battleMeta, setBattleMeta] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [timePerQuestion, setTimePerQuestion] = useState(15);
  const [timeRemaining, setTimeRemaining] = useState(15);
  const [myAnswer, setMyAnswer] = useState(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [lastAnswerResult, setLastAnswerResult] = useState(null);
  const [myScore, setMyScore] = useState(0);

  // ─── Peer / Opponent State ──────────────────────────────────────────────────
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentName, setOpponentName] = useState('Opponent');
  const [opponentLevel, setOpponentLevel] = useState(1);
  const [opponentAnsweredIndices, setOpponentAnsweredIndices] = useState([]);
  const [opponentAnsweredCount, setOpponentAnsweredCount] = useState(0);
  const [isOpponentFinished, setIsOpponentFinished] = useState(false);
  const [isWaitingForOpponent, setIsWaitingForOpponent] = useState(false);
  const [waitingElapsedSeconds, setWaitingElapsedSeconds] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [finalResult, setFinalResult] = useState(null);
  const [detailedReview, setDetailedReview] = useState([]);
  const [showReviewAccordion, setShowReviewAccordion] = useState(false);

  // ─── Audio & Emotes ─────────────────────────────────────────────────────────
  const [isMuted, setIsMuted] = useState(getMuteStatus());
  const [activeFloatingEmote, setActiveFloatingEmote] = useState(null);
  const lastProcessedEmoteTime = useRef(0);
  const timerRef = useRef(null);
  const isFinishingRef = useRef(false);

  // ─── 1. Load Battle Data on Mount ───────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const fetchBattleData = async () => {
      setIsLoading(true);
      try {
        const res = await axiosInstance.get(`/battle/${id}`);
        const data = res.data;

        if (isMounted) {
          setBattleMeta(data);
          const qList = (data.questions && data.questions.length > 0)
            ? data.questions
            : FALLBACK_10_QUESTIONS;

          setQuestions(qList);
          const tLimit = data.time_per_question || 15;
          setTimePerQuestion(tLimit);
          setTimeRemaining(tLimit);

          // Find opponent if present
          if (data.participants && data.participants.length > 1) {
            const opp = data.participants.find(p => p.userName && !p.userName.includes('(Host)'));
            if (opp) setOpponentName(opp.userName);
          }

          setIsLoading(false);

          if (data.status === 'completed') {
            finishBattle();
          }
        }
      } catch (err) {
        if (isMounted) {
          setQuestions(FALLBACK_10_QUESTIONS);
          setTimePerQuestion(15);
          setTimeRemaining(15);
          setIsLoading(false);
        }
      }
    };

    fetchBattleData();

    return () => {
      isMounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id]);

  // ─── Real-Time Peer Polling Loop (800ms) ────────────────────────────────────
  useEffect(() => {
    if (isLoading || isFinished) return;

    const syncPeerState = async () => {
      if (isFinishingRef.current) return;
      try {
        const res = await axiosInstance.get(`/battle/${id}/live-state`);
        if (res.data?.success) {
          const opp = res.data.opponent_state;
          if (opp?.hasJoined) {
            if (opp.userName) setOpponentName(opp.userName);
            if (opp.level) setOpponentLevel(opp.level);
            if (typeof opp.score === 'number') setOpponentScore(opp.score);
            if (Array.isArray(opp.answeredIndices)) {
              setOpponentAnsweredIndices(opp.answeredIndices);
            }
            const oppCount = (typeof opp.answersCount === 'number')
              ? opp.answersCount
              : (opp.answeredIndices?.length || 0);
            setOpponentAnsweredCount(oppCount);
            if (opp.isFinished) {
              setIsOpponentFinished(true);
            }
          }

          // Check for incoming peer emote
          if (res.data.latest_emote) {
            const em = res.data.latest_emote;
            if (em.timestamp > lastProcessedEmoteTime.current) {
              lastProcessedEmoteTime.current = em.timestamp;
              setActiveFloatingEmote(em);
              playEmotePopSound();
              setTimeout(() => setActiveFloatingEmote(null), 3000);
            }
          }

          if (res.data.status === 'completed' && !isFinished) {
            finishBattle();
            return;
          }

          // If waiting for opponent to finish, auto-finish when peer completes
          if (isWaitingForOpponent && !isFinished) {
            const oppCount = (typeof opp?.answersCount === 'number')
              ? opp.answersCount
              : (opp?.answeredIndices?.length || 0);
            const totalQ = questions.length > 0 ? questions.length : 10;
            if (opp?.isFinished || oppCount >= totalQ) {
              finishBattle();
            }
          }
        }
      } catch (e) {
        // Silently tolerate transient poll drops
      }
    };

    const pollInterval = setInterval(syncPeerState, 800);
    return () => clearInterval(pollInterval);
  }, [id, isLoading, isFinished, isWaitingForOpponent, questions.length]);

  // ─── Waiting Timer for Opponent to Finish (with 60s Safety Timeout) ────────
  useEffect(() => {
    let interval;
    if (isWaitingForOpponent && !isFinished) {
      interval = setInterval(() => {
        setWaitingElapsedSeconds((prev) => {
          if (prev >= 60) {
            finishBattle();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isWaitingForOpponent, isFinished]);

  // ─── 2. Robust Live Countdown Timer ─────────────────────────────────────────
  useEffect(() => {
    if (isLoading || isFinished || isAnswerSubmitted) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLoading, isFinished, isAnswerSubmitted, questionIndex]);

  // ─── 3. Handle Time Expiration ──────────────────────────────────────────────
  const handleTimeExpired = useCallback(() => {
    if (isAnswerSubmitted || isFinished) return;

    setIsAnswerSubmitted(true);
    playWrongSound();
    setLastAnswerResult({
      isCorrect: false,
      points: 0,
      message: "Time's Up!"
    });

    axiosInstance.post(`/battle/${id}/submit`, {
      score: 0,
      answers: { [questionIndex]: '__TIMEOUT__' }
    }).catch(() => {});

    setTimeout(() => {
      moveToNextQuestion();
    }, 1500);
  }, [isAnswerSubmitted, isFinished, questionIndex, questions.length, id]);

  // ─── 4. User Submits Answer ─────────────────────────────────────────────────
  const handleSubmitAnswer = (selectedOption) => {
    if (isAnswerSubmitted || isFinished) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setIsAnswerSubmitted(true);
    setMyAnswer(selectedOption);

    const currentQ = questions[questionIndex];
    const isCorrect = (selectedOption === currentQ.correctAnswer || selectedOption === currentQ.correctOption);

    // Audio SFX
    if (isCorrect) {
      playCorrectSound();
    } else {
      playWrongSound();
    }

    // Speed bonus: 100 base + remaining seconds * 5
    const pointsGained = isCorrect ? 100 + (timeRemaining * 5) : 0;
    setMyScore((prev) => prev + pointsGained);

    setLastAnswerResult({
      isCorrect,
      points: pointsGained,
      correctAnswer: currentQ.correctAnswer || currentQ.correctOption,
      message: isCorrect ? 'Correct!' : 'Incorrect'
    });

    // Real-time peer score sync: post to backend
    axiosInstance.post(`/battle/${id}/submit`, {
      score: pointsGained,
      answers: { [questionIndex]: selectedOption }
    }).catch(() => {});

    setTimeout(() => {
      moveToNextQuestion();
    }, 1600);
  };

  // ─── 5. Advance Question or Wait for Opponent to Finish ──────────────────────
  const moveToNextQuestion = () => {
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex((prev) => prev + 1);
      setMyAnswer(null);
      setIsAnswerSubmitted(false);
      setLastAnswerResult(null);
      setTimeRemaining(timePerQuestion);
    } else {
      // User has answered all questions!
      const totalQ = questions.length > 0 ? questions.length : 10;
      // Mark self as finished in backend
      axiosInstance.post(`/battle/${id}/submit`, {
        score: 0,
        answers: {},
        is_finished: true
      }).catch(() => {});

      const oppCount = Math.max(opponentAnsweredCount, opponentAnsweredIndices.length);
      const oppDone = isOpponentFinished || oppCount >= totalQ;
      if (oppDone) {
        finishBattle();
      } else {
        setIsWaitingForOpponent(true);
      }
    }
  };

  // ─── 6. Finish Battle & Update Leaderboard ───────────────────────────────────
  const finishBattle = async () => {
    if (isFinishingRef.current) return;
    isFinishingRef.current = true;
    setIsWaitingForOpponent(false);
    setIsFinished(true);

    try {
      const res = await axiosInstance.post(`/battle/${id}/complete`);
      const data = res.data || {};

      // 1. Resolve final scores accurately from server response
      let finalMy = myScore;
      let finalOpp = opponentScore;
      const currentUserId = user?.id || localStorage.getItem('userId') || null;
      const currentUsername = (user?.username || localStorage.getItem('username') || '').trim().toLowerCase();

      if (Array.isArray(data.scores) && data.scores.length > 0) {
        const myP = data.scores.find(p => 
          (currentUserId && String(p.user_id) === String(currentUserId)) ||
          (p.username && p.username.toLowerCase() === currentUsername)
        );
        const oppP = data.scores.find(p => p !== myP);
        if (myP && typeof myP.score === 'number') finalMy = myP.score;
        if (oppP && typeof oppP.score === 'number') finalOpp = oppP.score;
      }

      // 2. Strict Draw evaluation:
      // If backend explicitly returned is_draw, obey it!
      // Otherwise only draw if both final scores are strictly equal and positive.
      const isDraw = (typeof data.is_draw === 'boolean')
        ? data.is_draw
        : (finalMy > 0 && finalMy === finalOpp);

      // 3. Strict Winner evaluation:
      let userWon = false;
      if (!isDraw) {
        if (data.winner_id && currentUserId) {
          userWon = String(data.winner_id) === String(currentUserId);
        } else if (data.winner_name && currentUsername) {
          userWon = data.winner_name.trim().toLowerCase() === currentUsername;
        } else {
          userWon = finalMy > finalOpp;
        }
      }

      if (userWon) {
        playVictorySound();
      }

      let msg = '🤝 Match Drawn! Both players performed equally well!';
      if (!isDraw) {
        msg = userWon ? '🏆 Victory! You Won the Battle!' : '⚔️ Good Game! Opponent Won.';
      }

      setFinalResult({
        userWon,
        isDraw,
        myFinalScore: finalMy,
        oppFinalScore: finalOpp,
        winnerName: isDraw ? 'Draw' : (userWon ? 'You' : (data.winner_name || opponentName)),
        message: msg
      });

      if (Array.isArray(data.detailed_review)) {
        setDetailedReview(data.detailed_review);
      }

      toast.success(msg, { duration: 6000 });
    } catch (e) {
      const finalMy = myScore;
      const finalOpp = opponentScore;
      const isDraw = finalMy > 0 && finalMy === finalOpp;
      const userWon = !isDraw && (finalMy > finalOpp);
      let msg = isDraw ? '🤝 Match Drawn!' : (userWon ? '🏆 Victory! You Won the Battle!' : '⚔️ Good Game! Opponent Won.');
      setFinalResult({
        userWon,
        isDraw,
        myFinalScore: finalMy,
        oppFinalScore: finalOpp,
        winnerName: isDraw ? 'Draw' : (userWon ? 'You' : opponentName),
        message: msg
      });
    }
  };

  // ─── 7. Send Live Emote Reaction ────────────────────────────────────────────
  const handleSendEmote = async (emote) => {
    playEmotePopSound();
    setActiveFloatingEmote({ userName: 'You', emote });
    setTimeout(() => setActiveFloatingEmote(null), 2500);

    try {
      await axiosInstance.post(`/battle/${id}/emote`, { emote });
    } catch (e) {}
  };

  // Check if opponent has answered the current question index
  const hasOpponentAnsweredCurrent = opponentAnsweredIndices.includes(String(questionIndex)) || 
                                     opponentAnsweredIndices.includes(Number(questionIndex)) ||
                                     opponentAnsweredCount > questionIndex;

  const currentQ = questions[questionIndex] || FALLBACK_10_QUESTIONS[0];

  // ─── LOADING STATE ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Spinner size="xl" color="battle" />
        <p className="text-dark-300 font-medium">Loading Battle Arena & Questions...</p>
      </div>
    );
  }

  // ─── WAITING FOR OPPONENT TO FINISH ─────────────────────────────────────────
  if (isWaitingForOpponent && !isFinished) {
    const totalQ = questions.length > 0 ? questions.length : 10;
    const oppAnsweredCount = Math.max(opponentAnsweredCount, opponentAnsweredIndices.length);
    const oppProgressPct = Math.min(100, Math.round((oppAnsweredCount / totalQ) * 100));
    const isOppFinished = isOpponentFinished || oppAnsweredCount >= totalQ;

    return (
      <div className="max-w-2xl mx-auto min-h-[60vh] py-10 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center justify-center p-4 rounded-full bg-accent-500/10 border border-accent-500/30 text-accent-400 mb-2">
            <CheckCircle size={44} className="text-accent-400 animate-pulse" />
          </div>

          <h2 className="text-3xl font-extrabold text-white">
            You've Completed All Questions! 🎉
          </h2>
          <p className="text-dark-300 text-sm max-w-md mx-auto">
            Great job! Please wait while <strong className="text-white">{opponentName}</strong> completes the battle.
            The final victory screen will unlock automatically the moment both players finish!
          </p>

          {/* Opponent Live Progress Card */}
          <Card padding="lg" className="border-battle-500/30 bg-dark-900/90 text-left mt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Avatar name={opponentName} size="md" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-base">{opponentName}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-dark-700 text-dark-300 font-semibold">
                      Level {opponentLevel}
                    </span>
                  </div>
                  {isOppFinished ? (
                    <span className="text-xs text-accent-400 font-semibold flex items-center gap-1.5 mt-0.5">
                      <CheckCircle size={14} className="text-accent-400" />
                      Completed All Questions! Finalizing...
                    </span>
                  ) : (
                    <span className="text-xs text-battle-400 font-medium flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-ping inline-block" />
                      Answering Question #{Math.min(totalQ, oppAnsweredCount + 1)}...
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-dark-400 block font-medium">Progress</span>
                <span className="text-sm font-extrabold text-white">
                  {Math.min(totalQ, oppAnsweredCount)} / {totalQ} Qs
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-dark-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-battle-500 to-accent-500 h-full transition-all duration-500 rounded-full"
                style={{ width: `${oppProgressPct}%` }}
              />
            </div>

            {/* Head to Head live scores */}
            <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-dark-800">
              <div className="p-3 rounded-xl bg-dark-800/80 border border-dark-700 text-center">
                <span className="text-xs text-dark-400 uppercase font-semibold block">Your Score</span>
                <span className="text-2xl font-black text-accent-400">{myScore} pts</span>
              </div>
              <div className="p-3 rounded-xl bg-dark-800/80 border border-dark-700 text-center">
                <span className="text-xs text-dark-400 uppercase font-semibold block">{opponentName}'s Score</span>
                <span className="text-2xl font-black text-primary-400">{opponentScore} pts</span>
              </div>
            </div>

            {/* Live Emote Reactions */}
            <div className="mt-5 pt-4 border-t border-dark-800 text-center">
              <span className="text-xs text-dark-400 font-medium block mb-2">Send a live reaction to {opponentName}:</span>
              <div className="flex justify-center gap-2">
                {EMOTE_OPTIONS.map((emote, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendEmote(emote)}
                    className="text-2xl p-2.5 rounded-xl bg-dark-800 hover:bg-dark-700 border border-dark-700 hover:border-accent-500/50 hover:scale-110 active:scale-95 transition-all"
                  >
                    {emote}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-center gap-2 text-xs text-dark-500 pt-2">
            <Spinner size="xs" color="battle" />
            <span>Waiting for opponent ({waitingElapsedSeconds}s elapsed)... Auto-concludes if inactive.</span>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── FINISHED STATE: VICTORY SCREEN WITH COMPARATIVE REVIEW ─────────────────
  if (isFinished && finalResult) {
    return (
      <div className="max-w-3xl mx-auto min-h-[65vh] py-8 space-y-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6 w-full"
        >
          <motion.div
            animate={{ rotate: [0, 8, -8, 8, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 0.8 }}
            className="text-8xl"
          >
            {finalResult.isDraw ? '🤝' : (finalResult.userWon ? '🏆' : '⚔️')}
          </motion.div>

          <h1 className="text-4xl font-extrabold gradient-text-battle">
            {finalResult.message}
          </h1>

          <p className="text-dark-400 text-sm">
            Battle Completed! All <strong className="text-white">{questions.length} Questions</strong> answered. 
            Points and XP bonuses have been synchronized to the global Leaderboard!
          </p>

          {/* Final Scoreboard Cards */}
          <div className="space-y-3 max-w-md mx-auto">
            {/* Player 1: You */}
            <Card padding="md" className={cn(
              'flex items-center gap-4 border-2 transition-all',
              finalResult.isDraw 
                ? 'border-battle-500/50 bg-battle-500/10' 
                : (finalResult.userWon ? 'border-accent-500/50 bg-accent-500/10' : 'border-dark-700 bg-dark-800/60')
            )}>
              <span className="text-3xl">{finalResult.isDraw ? '🤝' : (finalResult.userWon ? '🥇' : '🥈')}</span>
              <Avatar name="You" size="md" />
              <div className="flex-1 text-left">
                <p className="font-bold text-white">You</p>
                <p className="text-xs text-dark-400">{finalResult.isDraw ? 'Tie / Draw' : (finalResult.userWon ? 'Winner (+250 XP)' : 'Runner-up (+60 XP)')}</p>
              </div>
              <span className="text-2xl font-black text-accent-400">{finalResult.myFinalScore} pts</span>
            </Card>

            {/* Player 2: Opponent */}
            <Card padding="md" className={cn(
              'flex items-center gap-4 border-2 transition-all',
              finalResult.isDraw 
                ? 'border-battle-500/50 bg-battle-500/10' 
                : (!finalResult.userWon ? 'border-accent-500/50 bg-accent-500/10' : 'border-dark-700 bg-dark-800/60')
            )}>
              <span className="text-3xl">{finalResult.isDraw ? '🤝' : (!finalResult.userWon ? '🥇' : '🥈')}</span>
              <Avatar name={opponentName} size="md" />
              <div className="flex-1 text-left">
                <p className="font-bold text-white">{opponentName} (Level {opponentLevel})</p>
                <p className="text-xs text-dark-400">{finalResult.isDraw ? 'Tie / Draw' : (!finalResult.userWon ? 'Winner' : 'Runner-up')}</p>
              </div>
              <span className="text-2xl font-black text-primary-400">{finalResult.oppFinalScore} pts</span>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 pt-2">
            <Button
              variant="battle"
              size="lg"
              onClick={() => navigate(ROUTES.BATTLE_LOBBY)}
              leftIcon={<RotateCcw size={18} />}
            >
              Play Another Battle
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate(ROUTES.GAMIFICATION)}
              leftIcon={<Trophy size={18} />}
            >
              View Leaderboard
            </Button>
          </div>

          {/* Academic Question-by-Question Breakdown Accordion */}
          {detailedReview.length > 0 && (
            <div className="mt-8 pt-6 border-t border-dark-700 text-left">
              <button
                onClick={() => setShowReviewAccordion(!showReviewAccordion)}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-dark-800 border border-dark-700 hover:border-dark-600 transition-colors"
              >
                <span className="font-bold text-white flex items-center gap-2">
                  <Target size={18} className="text-accent-400" />
                  Head-to-Head Question Breakdown ({detailedReview.length} Questions)
                </span>
                {showReviewAccordion ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              <AnimatePresence>
                {showReviewAccordion && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 mt-3 overflow-hidden"
                  >
                    {detailedReview.map((item, idx) => (
                      <Card key={idx} padding="md" className="border-dark-700 bg-dark-800/80">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <p className="text-sm font-semibold text-white">
                            <span className="text-accent-400 mr-1.5">Q{item.index}.</span>
                            {item.question}
                          </p>
                        </div>

                        {/* Answers comparison */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-dark-700/60">
                          <div className="p-2 rounded-lg bg-dark-900 border border-dark-700">
                            <span className="text-dark-400 block mb-0.5">Your Answer:</span>
                            <span className="font-bold text-white">
                              {item.playerAnswers?.[String(user?.id)]?.answer || item.playerAnswers?.[Number(user?.id)]?.answer || myAnswer || 'Submitted'}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-dark-900 border border-dark-700">
                            <span className="text-dark-400 block mb-0.5">Correct Answer:</span>
                            <span className="font-bold text-green-400">{item.correctAnswer}</span>
                          </div>
                        </div>

                        {item.explanation && (
                          <p className="text-[11px] text-dark-400 mt-2 flex items-center gap-1.5">
                            <FileText size={12} className="text-battle-400 flex-shrink-0" />
                            {item.explanation}
                          </p>
                        )}
                      </Card>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // ─── ACTIVE PLAYING ARENA ───────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-6 relative">
      
      {/* Floating Incoming Emote Popup */}
      <AnimatePresence>
        {activeFloatingEmote && (
          <motion.div
            initial={{ opacity: 0, scale: 0.3, y: 50 }}
            animate={{ opacity: 1, scale: 1.2, y: -20 }}
            exit={{ opacity: 0, scale: 0.5, y: -80 }}
            transition={{ duration: 0.4 }}
            className="fixed top-24 right-10 z-50 pointer-events-none"
          >
            <div className="p-4 rounded-2xl bg-dark-900/95 border-2 border-accent-500 shadow-glow-amber text-center">
              <span className="text-5xl block animate-bounce">{activeFloatingEmote.emote}</span>
              <span className="text-xs font-bold text-accent-400 mt-1 block">
                {activeFloatingEmote.userName}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar: Progress, Timer, Live Opponent Indicator & SFX Mute */}
      <Card className="battle-glow border-battle-500/30">
        <div className="flex items-center justify-between gap-4">
          
          {/* Left: Progress */}
          <div>
            <span className="text-xs uppercase font-bold text-dark-400 tracking-wider">Battle Arena</span>
            <div className="text-sm font-extrabold text-white">
              Question <span className="text-accent-400">{questionIndex + 1}</span> of {questions.length}
            </div>
          </div>

          {/* Center: Live Timer */}
          <div className="flex items-center gap-2">
            <Clock size={20} className={timeRemaining <= 5 ? 'text-red-400 animate-pulse' : 'text-accent-400'} />
            <span className={cn(
              'font-mono text-3xl font-extrabold tracking-wider',
              timeRemaining <= 5 ? 'text-red-400 animate-bounce' : 'text-white'
            )}>
              {timeRemaining}s
            </span>
          </div>

          {/* Right: Sound Toggle & Subject */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMuted(toggleMuteSfx())}
              className="p-2 rounded-xl bg-dark-800 border border-dark-700 text-dark-300 hover:text-white transition-colors"
              title={isMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
            >
              {isMuted ? <VolumeX size={18} className="text-red-400" /> : <Volume2 size={18} className="text-accent-400" />}
            </button>
            <div className="text-right hidden sm:block">
              <span className="text-xs text-dark-400 block">Topic</span>
              <span className="text-xs font-bold text-white truncate max-w-[120px] block">
                {battleMeta?.subject || 'Live Arena'}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-dark-800 h-1.5 rounded-full mt-4 overflow-hidden">
          <div
            className="bg-gradient-to-r from-battle-500 to-accent-500 h-full transition-all duration-300"
            style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </Card>

      {/* Main Grid: Question Card (2 Cols) + Scoreboard & Emotes (1 Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Question Box */}
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={questionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card padding="lg" className="border-dark-700">
                {/* Question Header & Live Opponent Status Pill */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2 text-xs font-bold text-battle-400 uppercase tracking-wider">
                      <Target size={14} /> Question #{questionIndex + 1}
                    </span>

                    {/* Real-Time Opponent Answering Status */}
                    {hasOpponentAnsweredCurrent ? (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-500/15 text-green-400 border border-green-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping"></span>
                        Opponent Answered!
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] text-dark-400 bg-dark-800 border border-dark-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse"></span>
                        Opponent Thinking...
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl font-bold text-white leading-relaxed">
                    {currentQ.question}
                  </h2>

                  {/* Immediate Feedback Notification */}
                  {lastAnswerResult && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        'p-3.5 rounded-xl mt-4 flex items-center justify-between border',
                        lastAnswerResult.isCorrect
                          ? 'bg-green-500/15 border-green-500/40 text-green-400'
                          : 'bg-red-500/15 border-red-500/40 text-red-400'
                      )}
                    >
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        {lastAnswerResult.isCorrect ? <CheckCircle size={18} /> : <XCircle size={18} />}
                        <span>
                          {lastAnswerResult.isCorrect
                            ? `Correct! +${lastAnswerResult.points} points`
                            : `Incorrect! Correct: ${lastAnswerResult.correctAnswer}`}
                        </span>
                      </div>
                      <span className="text-xs text-dark-400">Loading next question...</span>
                    </motion.div>
                  )}
                </div>

                {/* MCQ Options A, B, C, D */}
                <div className="space-y-3">
                  {currentQ.options && currentQ.options.map((option, idx) => {
                    const isSelected = myAnswer === option;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSubmitAnswer(option)}
                        disabled={isAnswerSubmitted}
                        className={cn(
                          'w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all font-medium text-sm',
                          isSelected
                            ? 'border-primary-500 bg-primary-500/20 text-white shadow-glow'
                            : 'border-dark-700 bg-dark-800/50 text-dark-200 hover:border-dark-500 hover:bg-dark-800',
                          isAnswerSubmitted && 'cursor-not-allowed opacity-75'
                        )}
                      >
                        <span className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 transition-colors',
                          isSelected ? 'bg-primary-600 text-white' : 'bg-dark-700 text-dark-300'
                        )}>
                          {['A', 'B', 'C', 'D'][idx]}
                        </span>
                        <span className="flex-1">{option}</span>
                      </button>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right Column: Live Scoreboard & Emotes */}
        <div className="lg:col-span-1 space-y-4">
          
          {/* Live Scoreboard */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={18} className="text-accent-400" />
              <h3 className="font-bold text-white text-base">Live Scoreboard</h3>
            </div>

            <div className="space-y-3">
              {/* You */}
              <div className="flex items-center gap-3 p-3.5 bg-dark-800/80 rounded-xl border border-primary-500/30">
                <span className="text-2xl">{myScore >= opponentScore ? '🥇' : '🥈'}</span>
                <Avatar name="You" size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm">You</p>
                  <p className="text-xs text-accent-400">Score</p>
                </div>
                <span className="text-xl font-black text-accent-400">{myScore}</span>
              </div>

              {/* Opponent */}
              <div className="flex items-center gap-3 p-3.5 bg-dark-800/80 rounded-xl border border-dark-700">
                <span className="text-2xl">{opponentScore > myScore ? '🥇' : '🥈'}</span>
                <Avatar name={opponentName} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-dark-200 text-sm truncate">{opponentName}</p>
                  <p className="text-xs text-primary-400">Level {opponentLevel}</p>
                </div>
                <span className="text-xl font-black text-primary-400">{opponentScore}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-dark-700 text-xs text-dark-400 space-y-1">
              <p>📍 Room Code: <strong className="text-white">{id}</strong></p>
              <p>⏱️ Time Per Question: <strong className="text-accent-400">{timePerQuestion}s</strong></p>
            </div>
          </Card>

          {/* Quick Emote Reactions Bar */}
          <Card className="text-center py-4">
            <span className="text-xs font-semibold text-dark-300 block mb-3 uppercase tracking-wider">
              Send Emote Reaction
            </span>
            <div className="flex justify-center gap-2">
              {EMOTE_OPTIONS.map((emote) => (
                <button
                  key={emote}
                  onClick={() => handleSendEmote(emote)}
                  className="w-10 h-10 rounded-xl bg-dark-800 border border-dark-700 hover:border-accent-500 hover:scale-110 active:scale-95 transition-all text-xl flex items-center justify-center"
                >
                  {emote}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BattlePlayPage;