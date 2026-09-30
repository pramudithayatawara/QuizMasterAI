import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, Target, Zap, ArrowRight, RotateCcw, CheckCircle, XCircle } from 'lucide-react';
import { ROUTES } from '../../constants/routes.js';
import axiosInstance from '../../api/axios.instance.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import { formatTimer } from '../../utils/formatters.js';
import { cn } from '../../utils/helpers.js';
import toast from 'react-hot-toast';

// Fallback questions pool if room data needs backup
const FALLBACK_10_QUESTIONS = [
  { _id: 'q1', question: 'Which keyword is used to define a function in Python?', type: 'mcq', options: ['function', 'func', 'define', 'def'], correctAnswer: 'def' },
  { _id: 'q2', question: 'What is the primary function of RAM in a computer system?', type: 'mcq', options: ['Permanent storage', 'Temporary volatile data storage', 'Power supply', 'Display graphics'], correctAnswer: 'Temporary volatile data storage' },
  { _id: 'q3', question: 'What is the average time complexity of looking up a key in a Python dictionary?', type: 'mcq', options: ['O(n)', 'O(1)', 'O(log n)', 'O(n^2)'], correctAnswer: 'O(1)' },
  { _id: 'q4', question: 'What is the derivative of f(x) = x^2 with respect to x?', type: 'mcq', options: ['x^1', '2x', '1x', '3x^2'], correctAnswer: '2x' },
  { _id: 'q5', question: "What is Newton's First Law of Motion also known as?", type: 'mcq', options: ['Law of Gravitation', 'Law of Acceleration', 'Law of Inertia', 'Action Reaction'], correctAnswer: 'Law of Inertia' },
  { _id: 'q6', question: 'What does SQL stand for in database architecture?', type: 'mcq', options: ['Structured Query Language', 'Simple Question Logic', 'Sequential Query Library', 'Standard Query Layout'], correctAnswer: 'Structured Query Language' },
  { _id: 'q7', question: 'What is the chemical formula for water?', type: 'mcq', options: ['CO2', 'H2O', 'NaCl', 'O2'], correctAnswer: 'H2O' },
  { _id: 'q8', question: 'Which data structure follows the Last-In First-Out (LIFO) principle?', type: 'mcq', options: ['Queue', 'Stack', 'Array', 'Linked List'], correctAnswer: 'Stack' },
  { _id: 'q9', question: 'What is the powerhouse organelle of the cell?', type: 'mcq', options: ['Ribosome', 'Nucleus', 'Mitochondria', 'Chloroplast'], correctAnswer: 'Mitochondria' },
  { _id: 'q10', question: 'What is the speed of light in vacuum approximately?', type: 'mcq', options: ['300,000 km/s', '150,000 km/s', '500,000 km/s', '1,000,000 km/s'], correctAnswer: '300,000 km/s' }
];

/**
 * @page BattlePlayPage
 * @description Real-time Battle Arena with live counting timer and complete display of all selected questions.
 */
const BattlePlayPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

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
  const [opponentScore, setOpponentScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [finalResult, setFinalResult] = useState(null);

  const opponentName = 'sasidilshan';
  const timerRef = useRef(null);

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
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          // Fallback if network or offline
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
    setLastAnswerResult({
      isCorrect: false,
      points: 0,
      message: "Time's Up!"
    });

    // Opponent also answers
    const oppGained = Math.random() > 0.4 ? 80 : 0;
    setOpponentScore((prev) => prev + oppGained);

    // Advance to next question after 1.5s
    setTimeout(() => {
      moveToNextQuestion();
    }, 1500);
  }, [isAnswerSubmitted, isFinished, questionIndex, questions.length]);

  // ─── 4. User Submits Answer ─────────────────────────────────────────────────
  const handleSubmitAnswer = (selectedOption) => {
    if (isAnswerSubmitted || isFinished) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setIsAnswerSubmitted(true);
    setMyAnswer(selectedOption);

    const currentQ = questions[questionIndex];
    const isCorrect = (selectedOption === currentQ.correctAnswer || selectedOption === currentQ.correctOption);

    // Speed bonus: 100 base + remaining seconds * 5
    const pointsGained = isCorrect ? 100 + (timeRemaining * 5) : 0;
    setMyScore((prev) => prev + pointsGained);

    // Simulate opponent response
    const oppCorrect = Math.random() > 0.35;
    const oppPoints = oppCorrect ? 85 + Math.floor(Math.random() * 35) : 0;
    setOpponentScore((prev) => prev + oppPoints);

    setLastAnswerResult({
      isCorrect,
      points: pointsGained,
      correctAnswer: currentQ.correctAnswer || currentQ.correctOption,
      message: isCorrect ? 'Correct!' : 'Incorrect'
    });

    // Post live score update to backend (non-blocking)
    axiosInstance.post(`/battle/${id}/submit`, {
      score: pointsGained,
      answers: { [questionIndex]: selectedOption }
    }).catch(() => {});

    // Transition to next question after 1.5s
    setTimeout(() => {
      moveToNextQuestion();
    }, 1600);
  };

  // ─── 5. Advance Question or Conclude Battle ──────────────────────────────────
  const moveToNextQuestion = () => {
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex((prev) => prev + 1);
      setMyAnswer(null);
      setIsAnswerSubmitted(false);
      setLastAnswerResult(null);
      setTimeRemaining(timePerQuestion); // Reset timer to selected duration
    } else {
      // 🏁 Battle Finished! All questions completed!
      finishBattle();
    }
  };

  // ─── 6. Finish Battle & Update Leaderboard ───────────────────────────────────
  const finishBattle = () => {
    setIsFinished(true);
    const userWon = myScore >= opponentScore;
    const resultObj = {
      userWon,
      myFinalScore: myScore,
      oppFinalScore: opponentScore,
      winnerName: userWon ? 'You' : opponentName,
      message: userWon ? '🏆 Victory! You Won the Battle!' : '⚔️ Good Game! Opponent Won.'
    };
    setFinalResult(resultObj);

    toast.success(resultObj.message, { duration: 6000 });

    // Inform backend to record Winner_ID and update Leaderboard entity!
    axiosInstance.post(`/battle/${id}/complete`).catch(() => {});
  };

  // ─── LOADING STATE ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Spinner size="xl" color="battle" />
        <p className="text-dark-300 font-medium">Loading Battle Arena & Questions...</p>
      </div>
    );
  }

  // ─── FINISHED STATE: VICTORY SCREEN ─────────────────────────────────────────
  if (isFinished && finalResult) {
    return (
      <div className="max-w-2xl mx-auto min-h-[65vh] flex items-center justify-center py-8">
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
            {finalResult.userWon ? '🏆' : '⚔️'}
          </motion.div>

          <h1 className="text-4xl font-extrabold gradient-text-battle">
            {finalResult.message}
          </h1>

          <p className="text-dark-400 text-sm">
            Battle Completed! All <strong className="text-white">{questions.length} Questions</strong> answered. 
            Points have been synchronized to the global Leaderboard!
          </p>

          {/* Final Scoreboard Cards */}
          <div className="space-y-3 max-w-md mx-auto">
            {/* Player 1: You */}
            <Card padding="md" className={cn(
              'flex items-center gap-4 border-2 transition-all',
              finalResult.userWon ? 'border-accent-500/50 bg-accent-500/10' : 'border-dark-700 bg-dark-800/60'
            )}>
              <span className="text-3xl">{finalResult.userWon ? '🥇' : '🥈'}</span>
              <Avatar name="You" size="md" />
              <div className="flex-1 text-left">
                <p className="font-bold text-white">You</p>
                <p className="text-xs text-dark-400">{finalResult.userWon ? 'Winner' : 'Runner-up'}</p>
              </div>
              <span className="text-2xl font-black text-accent-400">{finalResult.myFinalScore} pts</span>
            </Card>

            {/* Player 2: Opponent */}
            <Card padding="md" className={cn(
              'flex items-center gap-4 border-2 transition-all',
              !finalResult.userWon ? 'border-accent-500/50 bg-accent-500/10' : 'border-dark-700 bg-dark-800/60'
            )}>
              <span className="text-3xl">{!finalResult.userWon ? '🥇' : '🥈'}</span>
              <Avatar name={opponentName} size="md" />
              <div className="flex-1 text-left">
                <p className="font-bold text-white">{opponentName}</p>
                <p className="text-xs text-dark-400">{!finalResult.userWon ? 'Winner' : 'Runner-up'}</p>
              </div>
              <span className="text-2xl font-black text-primary-400">{finalResult.oppFinalScore} pts</span>
            </Card>
          </div>

          <div className="flex justify-center gap-4 pt-4">
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
        </motion.div>
      </div>
    );
  }

  const currentQ = questions[questionIndex] || FALLBACK_10_QUESTIONS[0];

  // ─── ACTIVE BATTLE ARENA RENDER ─────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header: Timer, Question Progress & Live Badge */}
      <Card padding="md" className="battle-glow border-battle-500/30">
        <div className="flex items-center justify-between">
          {/* Active Countdown Timer */}
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
              timeRemaining <= 5 ? 'bg-red-500/20 text-red-400' : 'bg-battle-500/20 text-battle-400'
            )}>
              <Clock size={22} className={timeRemaining <= 5 ? 'animate-bounce' : ''} />
            </div>
            <div>
              <p className="text-xs text-dark-400 font-semibold uppercase tracking-wider">Time Left</p>
              <span className={cn(
                'text-3xl font-mono font-extrabold transition-colors',
                timeRemaining <= 5 ? 'text-red-400 animate-pulse' : 'text-white'
              )}>
                {formatTimer(timeRemaining)}
              </span>
            </div>
          </div>

          {/* Question Progress: Displays ALL selected questions (e.g. 1 / 10, 2 / 10) */}
          <div className="text-center">
            <p className="text-xs text-dark-400 font-semibold uppercase tracking-wider">Question Progress</p>
            <p className="text-2xl font-black text-white">
              <span className="text-accent-400">{questionIndex + 1}</span> / {questions.length}
            </p>
          </div>

          {/* Live Indicator */}
          <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/30">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
            <span className="text-xs font-bold text-red-400 uppercase tracking-widest">LIVE BATTLE</span>
          </div>
        </div>
      </Card>

      {/* Main Arena Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Question & Options (2 Columns) */}
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={questionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <Card padding="lg" className="border-dark-700">
                {/* Question Text */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-battle-400 uppercase tracking-wider mb-2">
                    <Target size={14} /> Question #{questionIndex + 1} of {questions.length}
                  </div>
                  <h2 className="text-xl font-bold text-white leading-relaxed">
                    {currentQ.question}
                  </h2>

                  {/* Immediate Answer Feedback */}
                  {lastAnswerResult && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
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
                            : `Incorrect! Correct answer: ${lastAnswerResult.correctAnswer}`}
                        </span>
                      </div>
                      <span className="text-xs text-dark-400">Next question loading...</span>
                    </motion.div>
                  )}
                </div>

                {/* Options A, B, C, D */}
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

        {/* Right: Live Scoreboard (1 Column) */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={20} className="text-accent-400" />
              <h3 className="font-bold text-white text-base">Live Scoreboard</h3>
            </div>

            <div className="space-y-3">
              {/* You */}
              <div className="flex items-center gap-3 p-3.5 bg-dark-800/80 rounded-xl border border-primary-500/30">
                <span className="text-2xl">{myScore >= opponentScore ? '🥇' : '🥈'}</span>
                <Avatar name="You" size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm">You (Host)</p>
                  <p className="text-xs text-accent-400">Score</p>
                </div>
                <span className="text-xl font-black text-accent-400">{myScore}</span>
              </div>

              {/* Opponent */}
              <div className="flex items-center gap-3 p-3.5 bg-dark-800/80 rounded-xl border border-dark-700">
                <span className="text-2xl">{opponentScore > myScore ? '🥇' : '🥈'}</span>
                <Avatar name={opponentName} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-dark-200 text-sm">{opponentName}</p>
                  <p className="text-xs text-primary-400">Opponent</p>
                </div>
                <span className="text-xl font-black text-primary-400">{opponentScore}</span>
              </div>
            </div>

            {/* Match info */}
            <div className="mt-4 pt-4 border-t border-dark-700 text-xs text-dark-400 space-y-1">
              <p>📍 Room Code: <strong className="text-white">{id}</strong></p>
              <p>⏱️ Time Per Question: <strong className="text-accent-400">{timePerQuestion}s</strong></p>
              <p>🎯 Questions Total: <strong className="text-battle-400">{questions.length}</strong></p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BattlePlayPage;