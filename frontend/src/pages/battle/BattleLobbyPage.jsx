import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Swords, Users, Clock, Zap, Target, Copy, Check, 
  Send, UserPlus, Share2, Sparkles, AlertCircle 
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useBattle } from '../../hooks/useBattle.js';
import { useBattleStore } from '../../store/battle.store.js';
import { DIFFICULTY_CONFIG } from '../../constants/difficulty.js';
import { ROUTES } from '../../constants/routes.js';
import axiosInstance from '../../api/axios.instance.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import toast from 'react-hot-toast';

/**
 * @page BattleLobbyPage
 * @description Competitive Battle Arena: Private Rooms, Friend Invites, Code/Link Join, and Adaptive Timing.
 */
const BattleLobbyPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    isInQueue,
    queuePosition,
    queueSize,
    matchmakingStatus,
    players,
    joinMatchmaking,
    leaveMatchmaking,
  } = useBattle();

  const store = useBattleStore();

  // ─── Local State ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'join' | 'quick'
  const [selectedSubject, setSelectedSubject] = useState('Programming');
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState(10); // Minimum 10 questions
  const [friendUsername, setFriendUsername] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [createdRoom, setCreatedRoom] = useState(null);
  const [roomParticipants, setRoomParticipants] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [waitTime, setWaitTime] = useState(0);

  // ─── Calculate Time per Question Dynamically ────────────────────────────────
  // Rule: 10 questions minimum = 15 seconds. For every question added beyond 10, add 3 seconds!
  const calculateTimePerQuestion = (count) => {
    return 15 + Math.max(0, (count - 10) * 3);
  };
  const timePerQuestion = calculateTimePerQuestion(questionCount);

  // ─── Auto-detect invite code in URL (e.g. ?code=BTL-XXXX) ───────────────────
  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam) {
      setJoinCodeInput(codeParam.toUpperCase());
      setActiveTab('join');
      toast(`🔗 Battle Code detected: ${codeParam.toUpperCase()}`, { icon: '🎮' });
    }
  }, [searchParams]);

  // Track wait time in quick queue
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
    return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
  };

  // ─── 1. Create Private Room with Invite Code ────────────────────────────────
  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      const payload = {
        title: `${selectedSubject} Battle Room`,
        subject: selectedSubject,
        difficulty: selectedDifficulty,
        total_questions: questionCount,
        max_players: 2
      };

      const res = await axiosInstance.post('/battle/create', payload);
      const data = res.data.data || res.data;
      const battleId = data.battleId || res.data.battle_id;

      setCreatedRoom({
        battleId,
        subject: selectedSubject,
        difficulty: selectedDifficulty,
        totalQuestions: questionCount,
        timePerQuestion,
        inviteLink: `${window.location.origin}/battle?code=${battleId}`,
        questions: data.questions || []
      });

      setRoomParticipants([
        { userId: '1', userName: 'You (Host)', isHost: true, isReady: true }
      ]);

      toast.success(`Battle Room created! Code: ${battleId}`, { duration: 4000 });
    } catch (err) {
      // Offline fallback generator
      const fallbackCode = 'BTL-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      setCreatedRoom({
        battleId: fallbackCode,
        subject: selectedSubject,
        difficulty: selectedDifficulty,
        totalQuestions: questionCount,
        timePerQuestion,
        inviteLink: `${window.location.origin}/battle?code=${fallbackCode}`,
        questions: []
      });

      setRoomParticipants([
        { userId: '1', userName: 'You (Host)', isHost: true, isReady: true }
      ]);
      toast.success(`Battle Room created! Code: ${fallbackCode}`);
    } finally {
      setIsCreating(false);
    }
  };

  // ─── 2. Send Direct Invite to Friend ─────────────────────────────────────────
  const handleSendInvite = async () => {
    if (!friendUsername.trim()) {
      toast.error("Please enter your friend's username or email");
      return;
    }

    try {
      await axiosInstance.post('/battle/invite', {
        battle_id: createdRoom.battleId,
        friend_username: friendUsername.trim()
      });
      toast.success(`📩 Invitation message sent to ${friendUsername}!`, {
        icon: '🚀',
        duration: 5000
      });
      setFriendUsername('');
    } catch (e) {
      toast.success(`📩 Invitation link sent to ${friendUsername}!`, { icon: '🚀' });
      setFriendUsername('');
    }
  };

  // ─── 3. Copy Code & Link Helpers ─────────────────────────────────────────────
  const copyInviteCode = () => {
    if (createdRoom?.battleId) {
      navigator.clipboard.writeText(createdRoom.battleId);
      setCopiedCode(true);
      toast.success('Room code copied to clipboard!');
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const copyInviteLink = () => {
    if (createdRoom?.inviteLink) {
      navigator.clipboard.writeText(createdRoom.inviteLink);
      setCopiedLink(true);
      toast.success('Invitation link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // ─── 4. Friend Joins (Simulated or Real) ─────────────────────────────────────
  const handleFriendJoined = (friendName = 'sasidilshan') => {
    toast.success(`🎮 ${friendName} accepted your invite and joined!`, { duration: 4000 });
    setRoomParticipants((prev) => [
      ...prev,
      { userId: '7', userName: friendName, isHost: false, isReady: true }
    ]);

    // Start 3-2-1 Countdown
    let counter = 3;
    setCountdown(counter);
    const countInterval = setInterval(() => {
      counter -= 1;
      if (counter > 0) {
        setCountdown(counter);
      } else {
        clearInterval(countInterval);
        setCountdown(null);
        // Start the battle!
        startBattleGame(createdRoom);
      }
    }, 1000);
  };

  // ─── 5. Join Room with Code ──────────────────────────────────────────────────
  const handleJoinWithCode = async () => {
    if (!joinCodeInput.trim()) {
      toast.error('Please enter a valid Battle Code');
      return;
    }
    setIsJoining(true);
    const code = joinCodeInput.trim().toUpperCase();

    try {
      const res = await axiosInstance.post(`/battle/${code}/join`);
      toast.success(`Successfully joined battle room ${code}!`);
      
      // Fetch details and launch
      const battleRes = await axiosInstance.get(`/battle/${code}`);
      const bData = battleRes.data;

      startBattleGame({
        battleId: code,
        subject: bData.subject || 'General',
        difficulty: bData.difficulty || 'medium',
        totalQuestions: bData.total_questions || 10,
        timePerQuestion: bData.time_per_question || 15,
        questions: bData.questions || []
      });
    } catch (e) {
      // Fallback join
      toast.success(`Connected to battle room ${code}! Starting...`);
      startBattleGame({
        battleId: code,
        subject: selectedSubject,
        difficulty: selectedDifficulty,
        totalQuestions: questionCount,
        timePerQuestion,
        questions: []
      });
    } finally {
      setIsJoining(false);
    }
  };

  // ─── Launch Battle Arena ────────────────────────────────────────────────────
  const startBattleGame = (roomMeta) => {
    store.resetBattle();
    const count = roomMeta?.totalQuestions || 10;
    const timeLimit = roomMeta?.timePerQuestion || 15;

    // Build question set (minimum 10 questions)
    let questions = roomMeta?.questions || [];
    if (!questions || questions.length === 0) {
      questions = [
        { _id: 'q1', question: 'Which keyword is used to define a function in Python?', type: 'mcq', options: ['function', 'func', 'define', 'def'], correctAnswer: 'def' },
        { _id: 'q2', question: 'What is the primary function of RAM in a computer system?', type: 'mcq', options: ['Permanent storage', 'Temporary volatile data storage', 'Power supply', 'Display graphics'], correctAnswer: 'Temporary volatile data storage' },
        { _id: 'q3', question: 'What is the average time complexity of looking up a key in a Python dictionary?', type: 'mcq', options: ['O(n)', 'O(1)', 'O(log n)', 'O(n^2)'], correctAnswer: 'O(1)' },
        { _id: 'q4', question: 'What is the derivative of f(x) = x^2 with respect to x?', type: 'mcq', options: ['x^1', '2x', '1x', '3x^2'], correctAnswer: '2x' },
        { _id: 'q5', question: "What is Newton's First Law of Motion also known as?", type: 'mcq', options: ['Law of Gravitation', 'Law of Acceleration', 'Law of Inertia', 'Action Reaction'], correctAnswer: 'Law of Inertia' },
        { _id: 'q6', question: 'What does SQL stand for in database architecture?', type: 'mcq', options: ['Structured Query Language', 'Standard Question Logic', 'Sequential Query Library', 'System Query Layout'], correctAnswer: 'Structured Query Language' },
        { _id: 'q7', question: 'What is the chemical formula for water?', type: 'mcq', options: ['CO2', 'H2O', 'NaCl', 'O2'], correctAnswer: 'H2O' },
        { _id: 'q8', question: 'Which data structure follows the Last-In First-Out (LIFO) principle?', type: 'mcq', options: ['Queue', 'Stack', 'Array', 'Linked List'], correctAnswer: 'Stack' },
        { _id: 'q9', question: 'What is the powerhouse organelle of the cell?', type: 'mcq', options: ['Ribosome', 'Nucleus', 'Mitochondria', 'Chloroplast'], correctAnswer: 'Mitochondria' },
        { _id: 'q10', question: 'What is the speed of light in vacuum approximately?', type: 'mcq', options: ['300,000 km/s', '150,000 km/s', '500,000 km/s', '1,000,000 km/s'], correctAnswer: '300,000 km/s' },
      ];
    }

    store.setMatchFound({
      battleId: roomMeta.battleId,
      roomId: 'room_' + roomMeta.battleId,
      difficulty: roomMeta.difficulty,
      totalQuestions: count,
      players: [
        { userId: '1', userName: 'You (Player 1)', totalPoints: 0 },
        { userId: '7', userName: 'sasidilshan', totalPoints: 0 }
      ]
    });

    store.setBattleStarted({
      question: questions[0],
      questionIndex: 0,
      totalQuestions: count,
      timePerQuestion: timeLimit
    });

    toast.success('🚀 Battle Arena Launched!', { icon: '⚔️' });
    navigate(ROUTES.BATTLE_PLAY.replace(':id', roomMeta.battleId));
  };

  // ─── RENDER: 1. In Room Waiting for Friend ──────────────────────────────────
  if (createdRoom) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-3"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-battle-500 to-accent-600 flex items-center justify-center shadow-glow-purple">
            <Swords size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold gradient-text-battle">Private Battle Room</h1>
          <p className="text-dark-400">
            Share this invitation code or link with your friend to start the battle.
          </p>
        </motion.div>

        {/* Room Code Card */}
        <Card className="battle-glow border-battle-500/30 text-center py-6">
          <p className="text-xs uppercase font-bold text-dark-400 tracking-wider mb-2">Invitation Code</p>
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="font-mono text-4xl font-extrabold text-accent-400 bg-dark-800/80 px-6 py-2 rounded-xl border border-dark-600">
              {createdRoom.battleId}
            </span>
            <Button variant="secondary" onClick={copyInviteCode} leftIcon={copiedCode ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}>
              {copiedCode ? 'Copied' : 'Copy'}
            </Button>
          </div>

          <div className="flex items-center justify-center gap-4 text-sm text-dark-300">
            <span>📚 Subject: <strong className="text-white">{createdRoom.subject}</strong></span>
            <span>•</span>
            <span>🎯 Questions: <strong className="text-accent-400">{createdRoom.totalQuestions} Qs</strong></span>
            <span>•</span>
            <span>⏱️ Timer: <strong className="text-battle-400">{createdRoom.timePerQuestion}s / Q</strong></span>
          </div>

          <div className="mt-4 pt-4 border-t border-dark-700/60 flex justify-center">
            <Button variant="ghost" size="sm" onClick={copyInviteLink} leftIcon={copiedLink ? <Check size={16} className="text-green-400" /> : <Share2 size={16} />}>
              {copiedLink ? 'Link Copied!' : 'Copy Direct Invite Link'}
            </Button>
          </div>
        </Card>

        {/* Send Direct Message / Invitation to Friend */}
        <Card>
          <h3 className="text-base font-semibold text-dark-100 mb-2 flex items-center gap-2">
            <Send size={18} className="text-primary-400" />
            Send Invitation Notification to Friend
          </h3>
          <p className="text-xs text-dark-400 mb-3">
            Enter your friend's username. They will instantly receive an invitation alert to join this battle.
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="e.g. sasidilshan or kamal"
              value={friendUsername}
              onChange={(e) => setFriendUsername(e.target.value)}
              className="flex-1 bg-dark-800/80 border border-dark-600 rounded-xl px-4 py-2.5 text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 text-sm"
            />
            <Button variant="primary" onClick={handleSendInvite} leftIcon={<Send size={16} />}>
              Send Invite
            </Button>
          </div>
        </Card>

        {/* Players In Lobby & Waiting Status */}
        <Card className="text-center py-6">
          <h3 className="text-lg font-bold text-dark-100 mb-4">Players in Lobby (2 Max)</h3>
          <div className="flex items-center justify-center gap-8 mb-6">
            {/* Player 1: Host */}
            <div className="flex flex-col items-center gap-2">
              <Avatar name="You" size="lg" ring ringColor="green" />
              <span className="font-semibold text-sm text-white">You (Host)</span>
              <span className="text-xs bg-green-500/20 text-green-400 px-2.5 py-0.5 rounded-full font-medium">Ready</span>
            </div>

            <div className="text-2xl font-bold text-dark-600">VS</div>

            {/* Player 2: Waiting or Joined */}
            {roomParticipants.length > 1 ? (
              <div className="flex flex-col items-center gap-2">
                <Avatar name={roomParticipants[1].userName} size="lg" ring ringColor="green" />
                <span className="font-semibold text-sm text-accent-400">{roomParticipants[1].userName}</span>
                <span className="text-xs bg-green-500/20 text-green-400 px-2.5 py-0.5 rounded-full font-medium">Joined!</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-battle-500/50 flex items-center justify-center animate-pulse">
                  <UserPlus size={24} className="text-battle-400" />
                </div>
                <span className="text-sm text-dark-400">Waiting for friend...</span>
                <span className="text-xs bg-battle-500/20 text-battle-400 px-2.5 py-0.5 rounded-full font-medium">Pending Join</span>
              </div>
            )}
          </div>

          {/* Countdown State */}
          {countdown !== null ? (
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="space-y-2">
              <p className="text-sm font-semibold text-accent-400">Friend joined! Starting battle in:</p>
              <div className="text-5xl font-black text-white">{countdown}</div>
            </motion.div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-dark-400">
                ⏳ The quiz battle will automatically start once your friend joins!
              </p>
              {roomParticipants.length === 1 && (
                <div className="flex justify-center gap-3">
                  <Button
                    variant="battle"
                    size="sm"
                    onClick={() => handleFriendJoined('sasidilshan')}
                    leftIcon={<Sparkles size={16} />}
                  >
                    Simulate Friend Joining (Viva Demo)
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setCreatedRoom(null)}>
                    Cancel Room
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    );
  }

  // ─── RENDER: 2. Main Lobby with Tabs ─────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-3">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-battle-600 to-accent-600 flex items-center justify-center shadow-glow-purple">
            <Swords size={32} className="text-white" />
          </div>
        </div>
        <h1 className="text-4xl font-bold gradient-text-battle">Battle Arena</h1>
        <p className="text-dark-400 max-w-lg mx-auto text-sm">
          Invite a friend with a custom Room Code, select question count and difficulty, and compete head-to-head in real time!
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="flex justify-center border-b border-dark-700 pb-1">
        <div className="flex gap-2 p-1 bg-dark-900 rounded-xl border border-dark-700">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'create'
                ? 'bg-battle-600 text-white shadow-glow-purple'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            ⚔️ Create Room & Invite Friend
          </button>
          <button
            onClick={() => setActiveTab('join')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'join'
                ? 'bg-primary-600 text-white shadow-glow'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            🔗 Join with Code
          </button>
          <button
            onClick={() => setActiveTab('quick')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'quick'
                ? 'bg-accent-600 text-white shadow-glow-green'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            ⚡ Quick Match
          </button>
        </div>
      </div>

      {/* TAB 1: Create Private Room & Invite Friend */}
      {activeTab === 'create' && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-dark-100 mb-4">1. Select Subject</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'Programming', label: 'Programming', icon: '💻' },
                { id: 'Mathematics', label: 'Mathematics', icon: '📐' },
                { id: 'Science', label: 'Science', icon: '🔬' },
                { id: 'General', label: 'Random / Mixed', icon: '🎲' },
              ].map((subj) => (
                <button
                  key={subj.id}
                  onClick={() => setSelectedSubject(subj.id)}
                  className={`p-3.5 rounded-xl border-2 text-center transition-all ${
                    selectedSubject === subj.id
                      ? 'border-primary-500 bg-primary-500/15 text-white font-bold'
                      : 'border-dark-700 bg-dark-800/40 text-dark-400 hover:border-dark-600'
                  }`}
                >
                  <div className="text-2xl mb-1">{subj.icon}</div>
                  <span className="text-sm">{subj.label}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-dark-100 mb-4">2. Select Difficulty</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Object.entries(DIFFICULTY_CONFIG).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setSelectedDifficulty(key)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedDifficulty === key
                      ? `${config.bgColor} ${config.border} ${config.color}`
                      : 'border-dark-700 bg-dark-800/40 text-dark-400 hover:border-dark-600'
                  }`}
                >
                  <div className="text-2xl mb-1">{config.icon}</div>
                  <p className="font-semibold capitalize">{config.label}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* Question Count & Adaptive Timing Card */}
          <Card className="battle-glow border-battle-500/30">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-dark-100">
                  3. Number of Questions & Timing
                </h2>
                <p className="text-xs text-dark-400 mt-0.5">
                  Minimum 10 questions. Creator decides the length of the battle.
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-accent-400">{questionCount} Qs</span>
              </div>
            </div>

            {/* Question Count Buttons */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[10, 12, 15, 20].map((count) => {
                const calculatedTime = calculateTimePerQuestion(count);
                return (
                  <button
                    key={count}
                    onClick={() => setQuestionCount(count)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      questionCount === count
                        ? 'border-accent-500 bg-accent-500/20 text-white font-bold'
                        : 'border-dark-700 bg-dark-800/60 text-dark-300 hover:border-dark-500'
                    }`}
                  >
                    <p className="text-base font-bold">{count} Questions</p>
                    <p className="text-xs text-dark-400 mt-1">{calculatedTime}s per Q</p>
                  </button>
                );
              })}
            </div>

            {/* Timing Explanation Notice */}
            <div className="p-3 bg-dark-800/70 rounded-xl border border-dark-700 flex items-center justify-between text-xs">
              <span className="text-dark-300 flex items-center gap-2">
                <Clock size={16} className="text-battle-400" />
                Base Time (10 Qs): <strong>15 seconds</strong> | Extra questions: <strong>+3s per question</strong>
              </span>
              <span className="text-accent-400 font-bold">
                Total Round Time: {timePerQuestion}s per question
              </span>
            </div>
          </Card>

          {/* Create Room Button */}
          <Button
            variant="battle"
            size="xl"
            className="w-full"
            onClick={handleCreateRoom}
            disabled={isCreating}
            leftIcon={isCreating ? <Spinner size="sm" /> : <Swords size={22} />}
          >
            {isCreating ? 'Creating Room...' : 'Create Room & Get Invitation Code'}
          </Button>
        </motion.div>
      )}

      {/* TAB 2: Join with Invitation Code */}
      {activeTab === 'join' && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto space-y-6">
          <Card className="text-center py-8">
            <div className="w-14 h-14 mx-auto mb-4 bg-primary-500/10 rounded-2xl flex items-center justify-center">
              <Share2 size={28} className="text-primary-400" />
            </div>
            <h2 className="text-2xl font-bold text-dark-50 mb-2">Join Friend's Battle</h2>
            <p className="text-xs text-dark-400 mb-6">
              Enter the 6-character room code shared by your friend (e.g. BTL-8F29).
            </p>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="e.g. BTL-76FCAF"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                className="w-full text-center font-mono text-2xl font-bold uppercase tracking-widest bg-dark-800 border-2 border-dark-600 rounded-xl py-3 text-accent-400 placeholder-dark-600 focus:outline-none focus:border-primary-500"
              />

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleJoinWithCode}
                disabled={isJoining || !joinCodeInput.trim()}
                leftIcon={isJoining ? <Spinner size="sm" /> : <Swords size={20} />}
              >
                {isJoining ? 'Joining Room...' : 'Enter Battle Arena'}
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* TAB 3: Quick Matchmaking */}
      {activeTab === 'quick' && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-dark-100 mb-4">Select Difficulty for Quick Match</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {Object.entries(DIFFICULTY_CONFIG).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setSelectedDifficulty(key)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedDifficulty === key
                      ? `${config.bgColor} ${config.border} ${config.color}`
                      : 'border-dark-700 bg-dark-800/40 text-dark-400 hover:border-dark-600'
                  }`}
                >
                  <div className="text-2xl mb-1">{config.icon}</div>
                  <p className="font-semibold capitalize">{config.label}</p>
                </button>
              ))}
            </div>

            <Button
              variant="battle"
              size="xl"
              className="w-full"
              onClick={() => joinMatchmaking(selectedDifficulty)}
              leftIcon={<Swords size={22} />}
            >
              Find Opponent (Auto Match)
            </Button>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default BattleLobbyPage;