import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Users, Clock, Zap, Shield, Target, Trophy, Wifi, WifiOff } from 'lucide-react';
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

  const { socket, isAvailable, isConnected } = useSocket();
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

  // ─── Socket Not Available Warning ─────────────────────────────────────────
  if (!isAvailable) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Card className="max-w-md mx-auto text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-orange-500/20 rounded-full flex items-center justify-center">
            <WifiOff size={32} className="text-orange-400" />
          </div>
          <h2 className="text-2xl font-bold text-dark-50 mb-2">
            Battle Mode Unavailable
          </h2>
          <p className="text-dark-400 mb-6">
            Real-time battle mode requires Socket.IO connection.
            The server may not have Socket.IO configured.
          </p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Retry Connection
          </Button>
        </Card>
      </div>
    );
  }

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
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
            className="text-7xl"
          >
            ⚔️
          </motion.div>
          <h2 className="text-4xl font-bold gradient-text-battle">
            Match Found!
          </h2>
          <p className="text-dark-400">Connecting players to battle arena...</p>
          <div className="flex items-center justify-center gap-6 my-4">
            {players.map((player, i) => (
              <React.Fragment key={player.userId}>
                <div className="flex flex-col items-center gap-2">
                  <Avatar name={player.userName} size="lg" ring />
                  <span className="text-sm font-semibold text-dark-200">{player.userName}</span>
                </div>
                {i < players.length - 1 && (
                  <span className="text-3xl text-battle-400 font-black">VS</span>
                )}
              </React.Fragment>
            ))}
          </div>
          <Spinner size="lg" color="battle" />
        </motion.div>
      </div>
    );
  }

  const battleRules = [
    {
      icon:  Users,
      label: '2 Players',
      desc:  'Head-to-head competition',
      color: 'text-primary-400',
      bg:    'bg-primary-500/10',
    },
    {
      icon:  Clock,
      label: '30 Seconds',
      desc:  'Per question timer',
      color: 'text-accent-400',
      bg:    'bg-accent-500/10',
    },
    {
      icon:  Zap,
      label: 'Speed Bonus',
      desc:  'Faster = more points',
      color: 'text-secondary-400',
      bg:    'bg-secondary-500/10',
    },
    {
      icon:  Trophy,
      label: '10 Questions',
      desc:  'Highest score wins',
      color: 'text-battle-400',
      bg:    'bg-battle-500/10',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y:  0  }}
        className="text-center space-y-3"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-battle-600 to-accent-600
                        flex items-center justify-center shadow-glow-purple"
          >
            <Swords size={38} className="text-white" />
          </motion.div>
        </div>
        <h1 className="text-5xl font-bold gradient-text-battle">Battle Mode</h1>
        <p className="text-dark-400 max-w-md mx-auto text-lg">
          Compete against other players in real-time quiz battles.
          Answer faster to earn speed bonus points!
        </p>

        {/* Connection status */}
        <div className="flex items-center justify-center gap-2 mt-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-xs text-dark-500">
            {isConnected ? 'Connected to server' : 'Reconnecting...'}
          </span>
        </div>
      </motion.div>

      {/* Battle Rules */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {battleRules.map((rule, i) => {
          const Icon = rule.icon;
          return (
            <motion.div
              key={rule.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Card padding="sm" className="text-center">
                <div className={`w-10 h-10 ${rule.bg} rounded-xl mx-auto
                                flex items-center justify-center mb-3`}>
                  <Icon size={20} className={rule.color} />
                </div>
                <p className="font-semibold text-dark-100 text-sm">{rule.label}</p>
                <p className="text-xs text-dark-400 mt-1">{rule.desc}</p>
              </Card>
            </motion.div>
          );
        })}
      </div>

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
            <Card className="text-center py-10 battle-glow border-battle-500/30">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                className="text-5xl mb-6 inline-block"
              >
                ⚔️
              </motion.div>

              <h2 className="text-2xl font-bold text-dark-50 mb-2">
                Searching for Opponent...
              </h2>
              <p className="text-dark-400 mb-6">
                Difficulty:{' '}
                <span className="text-accent-400 font-semibold capitalize">
                  {selectedDifficulty}
                </span>
              </p>

              {/* Stats */}
              <div className="flex items-center justify-center gap-8 mb-8">
                <div className="text-center">
                  <p className="text-2xl font-mono font-bold text-battle-400">
                    {formatWaitTime(waitTime)}
                  </p>
                  <p className="text-xs text-dark-500 mt-1">Wait Time</p>
                </div>
                <div className="w-px h-10 bg-dark-700" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary-400">
                    {queueSize || '?'}
                  </p>
                  <p className="text-xs text-dark-500 mt-1">In Queue</p>
                </div>
              </div>

              {/* Progress to timeout */}
              <div className="max-w-xs mx-auto mb-6">
                <div className="flex justify-between text-xs text-dark-500 mb-1.5">
                  <span>Searching</span>
                  <span>Auto-cancel in {Math.max(60 - waitTime, 0)}s</span>
                </div>
                <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-battle-500 to-accent-500 rounded-full"
                    animate={{ width: `${Math.min((waitTime / 60) * 100, 100)}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
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
                    className={`p-5 rounded-xl border-2 text-left transition-all duration-200
                      ${selectedDifficulty === key
                        ? `${config.bgColor} ${config.border} ${config.color} shadow-lg`
                        : 'border-dark-600 bg-dark-800/50 text-dark-400 hover:border-dark-500 hover:bg-dark-800'
                      }`}
                  >
                    <div className="text-3xl mb-3">{config.icon}</div>
                    <p className="font-bold capitalize text-lg">{config.label}</p>
                    <p className="text-xs mt-1 opacity-70">
                      General knowledge & trivia
                    </p>
                    {selectedDifficulty === key && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-2 text-xs font-semibold"
                      >
                        ✓ Selected
                      </motion.div>
                    )}
                  </button>
                ))}
              </div>
            </Card>

            {/* Join Battle Button */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                variant="battle"
                size="xl"
                className="w-full py-5 text-xl"
                onClick={handleJoinQueue}
                disabled={!isConnected}
                leftIcon={<Swords size={24} />}
              >
                {isConnected ? 'Find Battle' : 'Connecting...'}
              </Button>
            </motion.div>

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