import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, Target, Zap } from 'lucide-react';
import { useBattle } from '../../hooks/useBattle.js';
import { ROUTES } from '../../constants/routes.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import { formatTimer } from '../../utils/formatters.js';
import { cn } from '../../utils/helpers.js';

/**
 * @page BattlePlayPage
 * @description Live battle arena with real-time question display and scoreboard.
 */
const BattlePlayPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    currentQuestion,
    questionIndex,
    totalQuestions,
    timeRemaining,
    myAnswer,
    isAnswerSubmitted,
    lastAnswerResult,
    scores,
    players,
    isFinished,
    battleResult,
    submitAnswer,
    resetBattle,
  } = useBattle();

  // Redirect if battle finished
  useEffect(() => {
    if (isFinished && battleResult) {
      setTimeout(() => {
        navigate(ROUTES.BATTLE_LOBBY);
        resetBattle();
      }, 5000);
    }
  }, [isFinished, battleResult]);

  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="xl" color="battle" />
      </div>
    );
  }

  // Battle Finished State
  if (isFinished && battleResult) {
    return (
      <div className="max-w-2xl mx-auto min-h-[60vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 10, 0] }}
            transition={{ duration: 0.5 }}
            className="text-8xl"
          >
            {battleResult.winner ? '🏆' : '🤝'}
          </motion.div>
          <h1 className="text-4xl font-bold gradient-text-battle">
            {battleResult.message}
          </h1>
          <div className="space-y-3">
            {battleResult.finalScores?.map((player, index) => (
              <Card key={player.userId} padding="sm" className="flex items-center gap-4">
                <span className="text-2xl">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                <Avatar name={player.userName} size="sm" />
                <span className="flex-1 text-dark-100 font-medium">{player.userName}</span>
                <span className="text-primary-400 font-bold">{player.totalPoints} pts</span>
              </Card>
            ))}
          </div>
          <p className="text-dark-400">Redirecting to lobby...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ─── Header (Timer + Scores) ──────────────────────────────────────── */}
      <Card padding="md" className="battle-glow border-battle-500/30">
        <div className="flex items-center justify-between">
          {/* Timer */}
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-battle-400" />
            <span className={cn(
              'text-2xl font-mono font-bold',
              timeRemaining <= 10 ? 'text-red-400 timer-warning' : 'text-dark-100'
            )}>
              {formatTimer(timeRemaining)}
            </span>
          </div>

          {/* Question Progress */}
          <div className="text-center">
            <p className="text-sm text-dark-400">Question</p>
            <p className="text-lg font-bold text-dark-50">
              {questionIndex + 1} / {totalQuestions}
            </p>
          </div>

          {/* Live Indicator */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm text-dark-400">LIVE</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Question Card ────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={questionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card padding="lg">
                {/* Question */}
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-dark-50 leading-relaxed mb-4">
                    {currentQuestion.question}
                  </h2>
                  {lastAnswerResult && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        'p-3 rounded-xl mb-4',
                        lastAnswerResult.isCorrect
                          ? 'bg-secondary-500/10 border border-secondary-500/30'
                          : 'bg-red-500/10 border border-red-500/30'
                      )}
                    >
                      <p className={cn(
                        'font-semibold',
                        lastAnswerResult.isCorrect ? 'text-secondary-400' : 'text-red-400'
                      )}>
                        {lastAnswerResult.isCorrect ? '✓ Correct!' : '✗ Incorrect'}
                      </p>
                      <p className="text-sm text-dark-300 mt-1">
                        +{lastAnswerResult.points} points
                      </p>
                    </motion.div>
                  )}
                </div>

                {/* Options */}
                <div className="space-y-3">
                  {currentQuestion.type === 'mcq'
                    ? currentQuestion.options.map((option, index) => {
                        const isSelected = myAnswer === option;
                        return (
                          <button
                            key={index}
                            onClick={() => !isAnswerSubmitted && submitAnswer(option)}
                            disabled={isAnswerSubmitted}
                            className={cn(
                              'quiz-option w-full',
                              isSelected && 'selected',
                              isAnswerSubmitted && 'cursor-not-allowed opacity-70'
                            )}
                          >
                            <span className={cn(
                              'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                              'font-bold text-sm transition-colors',
                              isSelected
                                ? 'bg-primary-600 text-white'
                                : 'bg-dark-700 text-dark-400'
                            )}>
                              {['A', 'B', 'C', 'D'][index]}
                            </span>
                            <span className="flex-1 text-left text-dark-100">{option}</span>
                          </button>
                        );
                      })
                    : ['True', 'False'].map((option) => {
                        const isSelected = myAnswer === option;
                        return (
                          <button
                            key={option}
                            onClick={() => !isAnswerSubmitted && submitAnswer(option)}
                            disabled={isAnswerSubmitted}
                            className={cn(
                              'quiz-option w-full',
                              isSelected && 'selected',
                              isAnswerSubmitted && 'cursor-not-allowed opacity-70'
                            )}
                          >
                            <span className={cn(
                              'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                              'font-bold text-sm transition-colors',
                              isSelected
                                ? 'bg-primary-600 text-white'
                                : 'bg-dark-700 text-dark-400'
                            )}>
                              {option === 'True' ? '✓' : '✗'}
                            </span>
                            <span className="flex-1 text-left text-dark-100">{option}</span>
                          </button>
                        );
                      })}
                </div>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ─── Live Scoreboard ──────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={18} className="text-accent-400" />
              <h3 className="font-bold text-dark-50">Live Scores</h3>
            </div>
            <div className="space-y-3">
              {scores
                .sort((a, b) => b.totalPoints - a.totalPoints)
                .map((player, index) => (
                  <motion.div
                    key={player.userId}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-xl"
                  >
                    <span className="text-xl">{['🥇', '🥈', '🥉', '4️⃣'][index] || '▪️'}</span>
                    <Avatar name={player.userName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-dark-100 truncate">{player.userName}</p>
                      <p className="text-xs text-dark-400">
                        {player.correctCount} correct
                      </p>
                    </div>
                    <span className="font-bold text-primary-400">{player.totalPoints}</span>
                  </motion.div>
                ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BattlePlayPage;