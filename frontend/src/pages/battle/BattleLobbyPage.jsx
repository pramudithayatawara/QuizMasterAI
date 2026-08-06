import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Users, Clock, Zap, Shield, Target } from 'lucide-react';
import { useBattle } from '../../hooks/useBattle.js';
import { useSocket } from '../../hooks/useSocket.js';
import { DIFFICULTY_CONFIG } from '../../constants/difficulty.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import Avatar from '../../components/common/Avatar.jsx';

/**
 * @page BattleLobbyPage
 * @description Matchmaking lobby for battle mode.
 */
const BattleLobbyPage = () => {
  const {
    isInQueue,
    queuePosition,
    queueSize,
    matchmakingStatus,
    difficulty: matchedDifficulty,
    players,
    joinMatchmaking,
    leaveMatchmaking,
  } = useBattle();

  const { socket } = useSocket();
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
  const [waitTime, setWaitTime] = useState(0);

  // Track wait time
  useEffect(() => {
    let interval;
    if (isInQueue) {
      interval = setInterval(() => setWaitTime((t) => t + 1), 1000);
    } else {
      setWaitTime(0);
    }
    return () => clearInterval(interval);
  }, [isInQueue]);

  const formatWaitTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0
      ? `${m}m ${String(s).padStart(2, '0')}s`
      : `${s}s`;
  };

  const handleJoinQueue = () => {
    joinMatchmaking(selectedDifficulty);
  };

  // ─── Match Found State ─────────────────────────────────────────────────────
  if (matchmakingStatus === 'matched' && players.length > 0) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1,   opacity: 1 }}
          className="text-center space-y-6 max-w-md mx-auto"
        >
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-6xl"
          >
            ⚔️
          </motion.div>
          <h2 className="text-3xl font-bold gradient-text-battle">
            Match Found!
          </h2>
          <p className="text-dark-400">Connecting players...</p>
          <div className="flex items-center justify-center gap-4">
            {players.map((player) => (
              <div key={player.userId} className="flex flex-col items-center gap-2">
                <Avatar name={player.userName} size="lg" ring />
                <span className="text-sm text-dark-300">{player.userName}</span>
              </div>
            ))}
          </div>
          <Spinner size="lg" color="battle" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y:  0  }}
        className="text-center space-y-3"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-battle-600 to-accent-600
                          flex items-center justify-center shadow-glow-purple">
            <Swords size={32} className="text-white" />
          </div>
        </div>
        <h1 className="text-4xl font-bold gradient-text-battle">Battle Mode</h1>
        <p className="text-dark-400 max-w-md mx-auto">
          Compete against other players in real-time quiz battles.
          Answer questions faster to earn bonus points!
        </p>
      </motion.div>

      {/* Matchmaking State */}
      <AnimatePresence mode="wait">
        {isInQueue ? (
          // ─── In Queue ────────────────────────────────────────────────────
          <motion.div
            key="in-queue"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1   }}
            exit={{   opacity: 0, scale: 0.95 }}
          >
            <Card className="text-center py-12 battle-glow border-battle-500/30">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="text-5xl mb-6 inline-block"
              >
                ⚔️
              </motion.div>

              <h2 className="text-2xl font-bold text-dark-50 mb-2">
                Searching for Opponent...
              </h2>
              <p className="text-dark-400 mb-6">
                Difficulty: <span className="text-accent-400 font-semibold capitalize">
                  {selectedDifficulty}
                </span>
              </p>

              {/* Stats */}
              <div className="flex items-center justify-center gap-8 mb-8">
                <div className="text-center">
                  <p className="text-2xl font-bold text-battle-400">
                    {formatWaitTime(waitTime)}
                  </p>
                  <p className="text-xs text-dark-500">Wait Time</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary-400">
                    #{queuePosition}
                  </p>
                  <p className="text-xs text-dark-500">Queue Position</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-secondary-400">
                    {queueSize}
                  </p>
                  <p className="text-xs text-dark-500">In Queue</p>
                </div>
              </div>

              {/* Progress bar to timeout */}
              <div className="max-w-xs mx-auto mb-6">
                <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-battle-500 to-accent-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(waitTime / 60) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-dark-500 mt-1">
                  Auto-cancel in {Math.max(60 - waitTime, 0)}s
                </p>
              </div>

              <Button
                variant="secondary"
                onClick={leaveMatchmaking}
              >
                Cancel Search
              </Button>
            </Card>
          </motion.div>

        ) : (
          // ─── Lobby ───────────────────────────────────────────────────────
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y:  0 }}
            exit={{   opacity: 0, y: 20 }}
            className="space-y-6"
          >
            {/* Difficulty Selection */}
            <Card>
              <h2 className="text-lg font-semibold text-dark-100 mb-4">
                Select Difficulty
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Object.entries(DIFFICULTY_CONFIG).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedDifficulty(key)}
                    className={`p-4 rounded-xl border-2 text-left transition-all duration-200
                      ${selectedDifficulty === key
                        ? `${config.bgColor} ${config.border} ${config.color}`
                        : 'border-dark-600 bg-dark-800/50 text-dark-400 hover:border-dark-500'
                      }`}
                  >
                    <div className="text-2xl mb-2">{config.icon}</div>
                    <p className="font-semibold capitalize">{config.label}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {config.timeLimit} min per round
                    </p>
                  </button>
                ))}
              </div>
            </Card>

            {/* Battle Rules */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon:  Users,
                  label: '2-4 Players',
                  desc:  'Per battle room',
                  color: 'text-primary-400',
                  bg:    'bg-primary-500/10',
                },
                {
                  icon:  Clock,
                  label: '30 Seconds',
                  desc:  'Per question',
                  color: 'text-accent-400',
                  bg:    'bg-accent-500/10',
                },
                {
                  icon:  Zap,
                  label: 'Speed Bonus',
                  desc:  'Answer faster for more points',
                  color: 'text-secondary-400',
                  bg:    'bg-secondary-500/10',
                },
              ].map((rule) => {
                const Icon = rule.icon;
                return (
                  <Card key={rule.label} padding="sm">
                    <div className={`w-10 h-10 ${rule.bg} rounded-xl
                                    flex items-center justify-center mb-3`}>
                      <Icon size={20} className={rule.color} />
                    </div>
                    <p className="font-semibold text-dark-100">{rule.label}</p>
                    <p className="text-xs text-dark-400 mt-1">{rule.desc}</p>
                  </Card>
                );
              })}
            </div>

            {/* Join Battle Button */}
            <Button
              variant="battle"
              size="xl"
              className="w-full"
              onClick={handleJoinQueue}
              leftIcon={<Swords size={22} />}
            >
              Find Battle
            </Button>

            {matchmakingStatus === 'timeout' && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-red-400 text-sm"
              >
                ⚠️ No opponent found. Please try again.
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BattleLobbyPage;