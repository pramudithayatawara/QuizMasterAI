import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, Target, Zap, Send, MessageSquare, CheckCircle, XCircle } from 'lucide-react';
import { useBattle } from '../../hooks/useBattle.js';
import { useAuthStore } from '../../store/auth.store.js';
import { ROUTES } from '../../constants/routes.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import { formatTimer } from '../../utils/formatters.js';
import { cn } from '../../utils/helpers.js';

/**
 * @component BattleQuestionCard
 * @description Isolated question card with preserved snapshot so exit animations
 * never flash the next question's text before unmounting.
 */
const BattleQuestionCard = ({
  question,
  myAnswer,
  isAnswerSubmitted,
  lastAnswerResult,
  timeRemaining,
  onSubmitAnswer,
}) => {
  // Capture snapshot on mount so exit transition smoothly displays this question's state
  const [snapshot] = useState(() => ({
    question,
    myAnswer,
    lastAnswerResult,
  }));

  const displayQ = snapshot.question || question;
  const isExpired = timeRemaining <= 0;
  const isDisabled = isAnswerSubmitted || isExpired;

  return (
    <Card padding="lg">
      {/* Answer result feedback */}
      <AnimatePresence>
        {lastAnswerResult && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl mb-4',
              lastAnswerResult.isCorrect
                ? 'bg-secondary-500/10 border border-secondary-500/30'
                : 'bg-red-500/10 border border-red-500/30'
            )}
          >
            {lastAnswerResult.isCorrect ? (
              <CheckCircle size={20} className="text-secondary-400 flex-shrink-0" />
            ) : (
              <XCircle size={20} className="text-red-400 flex-shrink-0" />
            )}
            <div>
              <p
                className={cn(
                  'font-bold text-sm',
                  lastAnswerResult.isCorrect ? 'text-secondary-400' : 'text-red-400'
                )}
              >
                {lastAnswerResult.isCorrect ? 'Correct!' : 'Incorrect'}
              </p>
              <p className="text-xs text-dark-300">
                {lastAnswerResult.isCorrect
                  ? `+${lastAnswerResult.points} points earned`
                  : 'No points this time'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question text */}
      <h2 className="text-xl font-semibold text-dark-50 leading-relaxed mb-6">
        {displayQ?.question}
      </h2>

      {/* Answer Options */}
      <div className="space-y-3">
        {displayQ?.type === 'mcq'
          ? displayQ.options?.map((option, index) => {
              const optText = typeof option === 'object' ? option.text || option.value : option;
              const isSelected = myAnswer === optText || myAnswer === option;
              const label = ['A', 'B', 'C', 'D'][index];

              return (
                <motion.button
                  key={index}
                  whileHover={!isDisabled ? { scale: 1.01 } : {}}
                  whileTap={!isDisabled ? { scale: 0.99 } : {}}
                  onClick={() => !isDisabled && onSubmitAnswer(optText)}
                  disabled={isDisabled}
                  className={cn(
                    'quiz-option w-full',
                    isSelected && 'selected',
                    isDisabled && 'cursor-not-allowed opacity-75',
                    isSelected &&
                      lastAnswerResult &&
                      (lastAnswerResult.isCorrect
                        ? 'border-secondary-500/80 bg-secondary-500/15 text-secondary-300'
                        : 'border-red-500/80 bg-red-500/15 text-red-300')
                  )}
                >
                  <span
                    className={cn(
                      'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                      'font-bold text-sm transition-colors',
                      isSelected
                        ? lastAnswerResult
                          ? lastAnswerResult.isCorrect
                            ? 'bg-secondary-600 text-white'
                            : 'bg-red-600 text-white'
                          : 'bg-primary-600 text-white'
                        : 'bg-dark-700 text-dark-400'
                    )}
                  >
                    {label}
                  </span>
                  <span className="flex-1 text-left text-dark-100">{optText}</span>
                  {isSelected && isAnswerSubmitted && (
                    <span
                      className={cn(
                        'ml-2 font-bold',
                        lastAnswerResult?.isCorrect ? 'text-secondary-400' : 'text-primary-400'
                      )}
                    >
                      {lastAnswerResult ? (lastAnswerResult.isCorrect ? '✓' : '✗') : '✓'}
                    </span>
                  )}
                </motion.button>
              );
            })
          : ['True', 'False'].map((option) => {
              const isSelected = myAnswer === option;
              return (
                <motion.button
                  key={option}
                  whileHover={!isDisabled ? { scale: 1.01 } : {}}
                  onClick={() => !isDisabled && onSubmitAnswer(option)}
                  disabled={isDisabled}
                  className={cn(
                    'quiz-option w-full',
                    isSelected && 'selected',
                    isDisabled && 'cursor-not-allowed opacity-75',
                    isSelected &&
                      lastAnswerResult &&
                      (lastAnswerResult.isCorrect
                        ? 'border-secondary-500/80 bg-secondary-500/15 text-secondary-300'
                        : 'border-red-500/80 bg-red-500/15 text-red-300')
                  )}
                >
                  <span
                    className={cn(
                      'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                      'font-bold text-sm transition-colors',
                      isSelected
                        ? lastAnswerResult
                          ? lastAnswerResult.isCorrect
                            ? 'bg-secondary-600 text-white'
                            : 'bg-red-600 text-white'
                          : 'bg-primary-600 text-white'
                        : 'bg-dark-700 text-dark-400'
                    )}
                  >
                    {option === 'True' ? '✓' : '✗'}
                  </span>
                  <span className="flex-1 text-left text-dark-100">{option}</span>
                </motion.button>
              );
            })}
      </div>

      {/* Waiting indicator */}
      {isAnswerSubmitted && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 p-3 rounded-xl bg-dark-800/60 border border-dark-700/60 text-center flex items-center justify-center gap-2.5 text-xs text-dark-300"
        >
          <Spinner size="sm" color="battle" />
          <span>Waiting for opponent or next round...</span>
        </motion.div>
      )}
    </Card>
  );
};

/**
 * @page BattlePlayPage
 * @description Live battle arena with real-time question display and scoreboard.
 */
const BattlePlayPage = () => {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { user }  = useAuthStore();
  const chatRef   = useRef(null);
  const [chatMsg, setChatMsg]   = useState('');
  const [showChat, setShowChat] = useState(false);

  const {
    currentQuestion,
    questionIndex,
    totalQuestions,
    timeRemaining,
    timeLimit,
    myAnswer,
    isAnswerSubmitted,
    lastAnswerResult,
    scores,
    players,
    isFinished,
    battleResult,
    chatMessages,
    submitAnswer,
    sendChatMessage,
    resetBattle,
    rejoinBattle,
  } = useBattle();

  // Rejoin / restore battle if loaded directly or refreshed
  useEffect(() => {
    if (id && !currentQuestion && !isFinished) {
      rejoinBattle(id);
    }
  }, [id, currentQuestion, isFinished, rejoinBattle]);

  // Redirect if battle finished
  useEffect(() => {
    if (isFinished && battleResult) {
      const timer = setTimeout(() => {
        navigate(ROUTES.BATTLE_LOBBY);
        resetBattle();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [isFinished, battleResult, navigate, resetBattle]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSendChat = () => {
    if (!chatMsg.trim()) return;
    sendChatMessage(chatMsg.trim());
    setChatMsg('');
  };

  const timerPercent = timeLimit > 0 ? (timeRemaining / timeLimit) * 100 : 0;
  const timerColor   = timeRemaining <= 5  ? 'text-red-400'
                     : timeRemaining <= 10 ? 'text-orange-400'
                     : 'text-dark-100';

  const myScore = scores.find((s) => s.userId?.toString() === user?._id?.toString());
  const opponentScores = scores.filter((s) => s.userId?.toString() !== user?._id?.toString());

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (!currentQuestion && !isFinished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Spinner size="xl" color="battle" />
        <p className="text-dark-400 animate-pulse">Waiting for battle to start...</p>
      </div>
    );
  }

  // ─── Battle Finished State ─────────────────────────────────────────────────
  if (isFinished && battleResult) {
    const isWinner  = battleResult.winner?.userId === user?._id?.toString();
    const isDraw    = battleResult.isDraw;
    const sortedScores = [...(battleResult.finalScores || scores)]
      .sort((a, b) => b.totalPoints - a.totalPoints);

    return (
      <div className="max-w-2xl mx-auto min-h-[60vh] flex items-center justify-center py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full space-y-6 text-center"
        >
          {/* Trophy / Draw emoji */}
          <motion.div
            animate={isWinner
              ? { rotate: [0, 15, -15, 10, -10, 0], scale: [1, 1.2, 1] }
              : { scale: [1, 1.05, 1] }
            }
            transition={{ duration: 0.8 }}
            className="text-9xl"
          >
            {isDraw ? '🤝' : isWinner ? '🏆' : '💪'}
          </motion.div>

          <div>
            <h1 className={cn(
              'text-4xl font-black mb-2',
              isWinner ? 'gradient-text-battle' : isDraw ? 'text-accent-400' : 'text-dark-100'
            )}>
              {isDraw ? "It's a Draw!" : isWinner ? 'You Win!' : 'Better Luck Next Time!'}
            </h1>
            <p className="text-dark-400">{battleResult.message}</p>
          </div>

          {/* Final Scores */}
          <div className="space-y-3">
            {sortedScores.map((player, index) => {
              const isMe = player.userId === user?._id?.toString();
              return (
                <motion.div
                  key={player.userId || index}
                  initial={{ opacity: 0, x: index === 0 ? -30 : 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.15 }}
                >
                  <Card
                    padding="sm"
                    className={cn(
                      'flex items-center gap-4',
                      isMe && 'border border-primary-500/40 bg-primary-500/5'
                    )}
                  >
                    <span className="text-2xl w-8 text-center">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                    </span>
                    <Avatar name={player.userName} size="sm" />
                    <div className="flex-1 text-left">
                      <p className={cn('font-bold', isMe ? 'text-primary-300' : 'text-dark-100')}>
                        {player.userName} {isMe && '(You)'}
                      </p>
                      <p className="text-xs text-dark-400">
                        {player.correctCount || 0} correct answers
                      </p>
                    </div>
                    <span className="text-xl font-black text-accent-400">
                      {player.totalPoints} <span className="text-sm font-normal text-dark-400">pts</span>
                    </span>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <p className="text-dark-500 text-sm">Returning to lobby in 6 seconds...</p>

          <Button
            variant="battle"
            onClick={() => { navigate(ROUTES.BATTLE_LOBBY); resetBattle(); }}
          >
            Back to Lobby
          </Button>
        </motion.div>
      </div>
    );
  }

  // ─── Battle Active ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* ─── Battle Header ─────────────────────────────────────────────────── */}
      <Card padding="md" className="battle-glow border-battle-500/30">
        <div className="flex items-center justify-between gap-4">
          {/* Timer */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-12 h-12 flex-shrink-0">
              {/* Circular timer */}
              <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
                <circle
                  cx="22" cy="22" r="18"
                  fill="none" stroke="currentColor"
                  strokeWidth="3"
                  className="text-dark-700"
                />
                <motion.circle
                  cx="22" cy="22" r="18"
                  fill="none"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 18}`}
                  strokeDashoffset={`${2 * Math.PI * 18 * (1 - timerPercent / 100)}`}
                  className={cn(
                    'transition-all duration-1000',
                    timeRemaining <= 5  ? 'stroke-red-500'
                    : timeRemaining <= 10 ? 'stroke-orange-400'
                    : 'stroke-battle-400'
                  )}
                />
              </svg>
              <span className={cn(
                'absolute inset-0 flex items-center justify-center text-sm font-mono font-bold',
                timerColor
              )}>
                {timeRemaining}
              </span>
            </div>
            <div>
              <p className="text-xs text-dark-500">Time Left</p>
              <p className={cn('text-xl font-mono font-bold', timerColor)}>
                {formatTimer(timeRemaining)}
              </p>
            </div>
          </div>

          {/* Question Progress */}
          <div className="text-center">
            <p className="text-xs text-dark-500 mb-0.5">Question</p>
            <p className="text-2xl font-bold text-dark-50">
              {questionIndex + 1}
              <span className="text-dark-500 text-base"> / {totalQuestions}</span>
            </p>
            {/* progress dots */}
            <div className="flex gap-1 mt-1 justify-center">
              {Array.from({ length: totalQuestions }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-1.5 h-1.5 rounded-full transition-all',
                    i < questionIndex ? 'bg-secondary-500'
                    : i === questionIndex ? 'bg-battle-400 scale-125'
                    : 'bg-dark-700'
                  )}
                />
              ))}
            </div>
          </div>

          {/* Live indicator + chat toggle */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm text-dark-400 font-semibold">LIVE</span>
            </div>
            <button
              onClick={() => setShowChat((v) => !v)}
              className="p-2 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors relative"
            >
              <MessageSquare size={18} className="text-dark-400" />
              {chatMessages.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-battle-500 rounded-full
                                 text-white text-[10px] font-bold flex items-center justify-center">
                  {Math.min(chatMessages.length, 9)}
                </span>
              )}
            </button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ─── Question Column ──────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion?._id || currentQuestion?.question || questionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <BattleQuestionCard
                question={currentQuestion}
                myAnswer={myAnswer}
                isAnswerSubmitted={isAnswerSubmitted}
                lastAnswerResult={lastAnswerResult}
                timeRemaining={timeRemaining}
                onSubmitAnswer={submitAnswer}
              />
            </motion.div>
          </AnimatePresence>

          {/* ─── Chat Panel ─────────────────────────────────────────────── */}
          <AnimatePresence>
            {showChat && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Card padding="sm">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare size={16} className="text-dark-400" />
                    <h4 className="text-sm font-semibold text-dark-200">Battle Chat</h4>
                  </div>

                  {/* Messages */}
                  <div
                    ref={chatRef}
                    className="h-32 overflow-y-auto space-y-2 mb-3 pr-1 scrollbar-thin"
                  >
                    {chatMessages.length === 0 ? (
                      <p className="text-xs text-dark-600 text-center py-4">
                        No messages yet. Say hello! 👋
                      </p>
                    ) : (
                      chatMessages.map((msg, i) => (
                        <div key={i} className={cn(
                          'flex gap-2 text-xs',
                          msg.userId?.toString() === user?._id?.toString() && 'flex-row-reverse'
                        )}>
                          <span className="font-semibold text-primary-400 flex-shrink-0">
                            {msg.userId?.toString() === user?._id?.toString() ? 'You' : msg.userName}:
                          </span>
                          <span className="text-dark-300">{msg.message}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Input */}
                  <div className="flex gap-2">
                    <input
                      value={chatMsg}
                      onChange={(e) => setChatMsg(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                      placeholder="Type a message..."
                      maxLength={100}
                      className="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-3 py-1.5
                                 text-sm text-dark-100 focus:outline-none focus:border-battle-500
                                 placeholder:text-dark-600"
                    />
                    <button
                      onClick={handleSendChat}
                      className="p-2 bg-battle-600 hover:bg-battle-500 rounded-lg transition-colors"
                    >
                      <Send size={14} className="text-white" />
                    </button>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Sidebar: Scores + Players ────────────────────────────────── */}
        <div className="space-y-4">
          {/* Live Scoreboard */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={18} className="text-accent-400" />
              <h3 className="font-bold text-dark-50">Live Scores</h3>
            </div>
            <div className="space-y-3">
              {scores.length > 0
                ? [...scores]
                    .sort((a, b) => b.totalPoints - a.totalPoints)
                    .map((player, index) => {
                      const isMe = player.userId === user?._id?.toString();
                      return (
                        <motion.div
                          key={player.userId}
                          layout
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-xl transition-all',
                            isMe
                              ? 'bg-primary-500/10 border border-primary-500/20'
                              : 'bg-dark-800/50'
                          )}
                        >
                          <span className="text-xl">
                            {['🥇', '🥈', '🥉', '4️⃣'][index] || '▪️'}
                          </span>
                          <Avatar name={player.userName} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              'font-semibold truncate text-sm',
                              isMe ? 'text-primary-300' : 'text-dark-100'
                            )}>
                              {player.userName} {isMe && '(You)'}
                            </p>
                            <p className="text-xs text-dark-500">
                              {player.correctCount || 0} correct
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary-400 text-sm">
                              {player.totalPoints}
                            </p>
                            <p className="text-xs text-dark-600">pts</p>
                          </div>
                        </motion.div>
                      );
                    })
                : players.map((player) => {
                    const isMe = player.userId === user?._id?.toString();
                    return (
                      <div
                        key={player.userId}
                        className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-xl"
                      >
                        <Avatar name={player.userName} size="sm" />
                        <p className={cn('font-medium text-sm', isMe ? 'text-primary-300' : 'text-dark-200')}>
                          {player.userName} {isMe && '(You)'}
                        </p>
                        <span className="ml-auto text-dark-500 text-xs">0 pts</span>
                      </div>
                    );
                  })}
            </div>
          </Card>

          {/* Speed Tip */}
          <Card padding="sm">
            <div className="flex items-start gap-3">
              <Zap size={16} className="text-accent-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-dark-200">Speed Bonus</p>
                <p className="text-xs text-dark-500 mt-0.5">
                  Answer quickly to earn up to +50 bonus points!
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BattlePlayPage;