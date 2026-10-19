import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Swords, Users, Clock, Zap, Target, Copy, Check, 
  Send, UserPlus, Share2, Sparkles, AlertCircle, FileText, UploadCloud, BookOpen, CheckCircle
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
import { playCountdownSound, playCorrectSound } from '../../utils/soundEffects.js';
import { formatTimer } from '../../utils/formatters.js';

/**
 * @page BattleLobbyPage
 * @description Competitive Battle Arena: Private Rooms, Friend Invites, Code/Link Join, 
 * Adaptive Timing, Same-Level Matchmaking, and PDF-RAG Document Question Selection.
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
    leaveMatchmaking,
  } = useBattle();

  const store = useBattleStore();

  // ─── Local State ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'join' | 'quick'
  const [questionSource, setQuestionSource] = useState('dataset'); // 'dataset' | 'pdf'
  const [selectedSubject, setSelectedSubject] = useState('Programming');
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState(10); // Minimum 10 questions
  const [userPdfs, setUserPdfs] = useState([]);
  const [selectedPdfId, setSelectedPdfId] = useState(null);
  const [isLoadingPdfs, setIsLoadingPdfs] = useState(false);

  // Friend invite & live user search states
  const [friendUsername, setFriendUsername] = useState('');
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isStartingBattle, setIsStartingBattle] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [createdRoom, setCreatedRoom] = useState(null);
  const [roomParticipants, setRoomParticipants] = useState([]);
  const [friendJoinedData, setFriendJoinedData] = useState(null);
  const [guestWaitingRoom, setGuestWaitingRoom] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [waitTime, setWaitTime] = useState(0);
  const suggestionsRef = useRef(null);

  // Quick Matchmaking dedicated states
  const [isSearchingQuickMatch, setIsSearchingQuickMatch] = useState(false);
  const [quickMatchSearchSeconds, setQuickMatchSearchSeconds] = useState(0);
  const [quickMatchBattleId, setQuickMatchBattleId] = useState(null);
  const [quickMatchRoomMeta, setQuickMatchRoomMeta] = useState(null);
  const [quickMatchFoundData, setQuickMatchFoundData] = useState(null);
  const [quickMatchCountdown, setQuickMatchCountdown] = useState(null);
  const quickMatchCountdownRef = useRef(null);

  // Click outside to dismiss user suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // ─── Fetch Uploaded PDFs for RAG Battle Option ──────────────────────────────
  useEffect(() => {
    const fetchPdfs = async () => {
      setIsLoadingPdfs(true);
      try {
        const res = await axiosInstance.get('/pdfs');
        const pdfList = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setUserPdfs(pdfList);
        if (pdfList.length > 0) {
          setSelectedPdfId(pdfList[0].id);
        }
      } catch (e) {
        console.warn('Could not load PDFs for battle:', e);
      } finally {
        setIsLoadingPdfs(false);
      }
    };
    fetchPdfs();
  }, []);

  // ─── Track wait time in quick queue ─────────────────────────────────────────
  useEffect(() => {
    let interval;
    if (isInQueue) {
      interval = setInterval(() => setWaitTime((t) => t + 1), 1000);
    } else {
      setWaitTime(0);
    }
    return () => clearInterval(interval);
  }, [isInQueue]);

  const fetchUserSuggestions = async (q = '') => {
    setIsSearchingUsers(true);
    try {
      const res = await axiosInstance.get(`/battle/users-search?query=${encodeURIComponent(q.trim())}`);
      if (res.data?.success) {
        setUserSuggestions(res.data.users || []);
      }
    } catch (e) {
      console.warn('Failed to search users:', e);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  // ─── Live User Suggestion Autocomplete Search ──────────────────────────────
  useEffect(() => {
    const query = friendUsername.trim();
    const timer = setTimeout(() => {
      fetchUserSuggestions(query);
    }, 100);

    return () => clearTimeout(timer);
  }, [friendUsername]);

  // ─── Real-Time Lobby Polling for Opponent Joining ────────────────────────────
  useEffect(() => {
    if (!createdRoom?.battleId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await axiosInstance.get(`/battle/${createdRoom.battleId}/live-state`);
        if (res.data?.success) {
          const opp = res.data.opponent_state;
          if (opp?.hasJoined && !friendJoinedData) {
            playCorrectSound();
            toast.success(`🎮 ${opp.userName} (Level ${opp.level || 1}) joined the battle room!`, { 
              icon: '🎉',
              duration: 5000 
            });
            setFriendJoinedData({
              userName: opp.userName,
              level: opp.level || 1,
              userId: String(opp.userId)
            });
            setRoomParticipants([
              { userId: '1', userName: 'You (Host)', isHost: true, isReady: true },
              { userId: String(opp.userId), userName: `${opp.userName} (Lvl ${opp.level || 1})`, isHost: false, isReady: true }
            ]);
          }
        }
      } catch (e) {
        // tolerate transient poll drops
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [createdRoom?.battleId, friendJoinedData]);

  // ─── Guest Waiting Room Polling (Listens for Host to Start) ────────────────
  useEffect(() => {
    if (!guestWaitingRoom?.battleId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await axiosInstance.get(`/battle/${guestWaitingRoom.battleId}/live-state`);
        if (res.data?.success && res.data.status === 'active' && countdown === null) {
          clearInterval(pollInterval);

          let counter = 3;
          setCountdown(counter);
          playCountdownSound(counter);

          const countInterval = setInterval(() => {
            counter -= 1;
            if (counter > 0) {
              setCountdown(counter);
              playCountdownSound(counter);
            } else {
              clearInterval(countInterval);
              setCountdown(null);
              startBattleGame(guestWaitingRoom);
            }
          }, 1000);
        }
      } catch (e) {
        // tolerate transient poll drops
      }
    }, 800);

    return () => clearInterval(pollInterval);
  }, [guestWaitingRoom?.battleId, countdown]);

  // ─── Quick Match Elapsed Timer ───────────────────────────────────────────────
  useEffect(() => {
    let interval;
    if (isSearchingQuickMatch && !quickMatchFoundData) {
      interval = setInterval(() => setQuickMatchSearchSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isSearchingQuickMatch, quickMatchFoundData]);

  // ─── Quick Match Polling Loop (Detects when an opponent pairs into the queue) ─
  useEffect(() => {
    if (!isSearchingQuickMatch || !quickMatchBattleId || quickMatchFoundData) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await axiosInstance.get(`/battle/${quickMatchBattleId}/live-state`);
        if (res.data?.success) {
          const opp = res.data.opponent_state;
          if ((res.data.status === 'active' || opp?.hasJoined) && opp?.userName && !opp.userName.includes('Waiting')) {
            clearInterval(pollInterval);
            playCorrectSound();
            const oppName = opp.userName;
            const oppLvl = opp.level || 1;
            setQuickMatchFoundData({
              opponentName: oppName,
              opponentLevel: oppLvl
            });

            triggerQuickMatchLaunch(quickMatchBattleId, quickMatchRoomMeta);
          }
        }
      } catch (e) {
        // tolerate transient poll drop
      }
    }, 900);

    return () => clearInterval(pollInterval);
  }, [isSearchingQuickMatch, quickMatchBattleId, quickMatchFoundData, quickMatchRoomMeta]);

  // Cleanup quick match countdown ref on unmount
  useEffect(() => {
    return () => {
      if (quickMatchCountdownRef.current) clearInterval(quickMatchCountdownRef.current);
    };
  }, []);

  // ─── Trigger Quick Match Synchronized Launch ────────────────────────────────
  const triggerQuickMatchLaunch = (bId, roomMeta) => {
    let counter = 3;
    setQuickMatchCountdown(counter);
    playCountdownSound(counter);

    if (quickMatchCountdownRef.current) clearInterval(quickMatchCountdownRef.current);

    quickMatchCountdownRef.current = setInterval(() => {
      counter -= 1;
      if (counter > 0) {
        setQuickMatchCountdown(counter);
        playCountdownSound(counter);
      } else {
        clearInterval(quickMatchCountdownRef.current);
        setQuickMatchCountdown(null);
        setIsSearchingQuickMatch(false);
        startBattleGame(roomMeta || {
          battleId: bId,
          subject: selectedSubject,
          difficulty: selectedDifficulty,
          totalQuestions: 10,
          timePerQuestion: 15
        });
      }
    }, 1000);
  };

  // ─── 1. Create Private Room with Invite Code ────────────────────────────────
  const handleCreateRoom = async () => {
    setIsCreating(true);
    setFriendJoinedData(null);
    try {
      const selectedPdfObj = userPdfs.find(p => p.id === selectedPdfId);
      const isPdfMode = questionSource === 'pdf' && selectedPdfId;
      const pdfDisplayName = selectedPdfObj?.original_name || selectedPdfObj?.name || selectedPdfObj?.title || selectedPdfObj?.filename || 'Lecture Note';

      const payload = {
        title: isPdfMode 
          ? `RAG Battle: ${pdfDisplayName}`
          : `${selectedSubject} Battle Arena`,
        subject: isPdfMode ? pdfDisplayName : selectedSubject,
        difficulty: selectedDifficulty,
        total_questions: questionCount,
        max_players: 2,
        pdf_id: isPdfMode ? selectedPdfId : null
      };

      const res = await axiosInstance.post('/battle/create', payload);
      const data = res.data.data || res.data;
      const battleId = data.battleId || res.data.battle_id;

      setCreatedRoom({
        battleId,
        subject: payload.subject,
        difficulty: selectedDifficulty,
        totalQuestions: questionCount,
        timePerQuestion,
        isPdfBattle: isPdfMode,
        pdfTitle: pdfDisplayName,
        inviteLink: `${window.location.origin}/battle?code=${battleId}`,
        questions: data.questions || []
      });

      setRoomParticipants([
        { userId: '1', userName: 'You (Host)', isHost: true, isReady: true }
      ]);

      toast.success(`Battle Room created! Code: ${battleId}`, { duration: 4000 });
    } catch (err) {
      toast.error('Failed to create battle room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // ─── 2. Send Direct Invite to Friend ─────────────────────────────────────────
  const handleSendInviteToUser = async (targetUsername) => {
    let uname = (targetUsername || friendUsername).trim();
    if (!uname) {
      toast.error("Please enter or select a friend's username");
      return;
    }

    // Auto-resolve if exact match exists in current suggestions
    const exactMatch = userSuggestions.find(
      (u) => u.username.toLowerCase() === uname.toLowerCase() || u.email.toLowerCase() === uname.toLowerCase()
    );
    if (exactMatch) {
      uname = exactMatch.username;
    } else if (userSuggestions.length === 1 && !targetUsername) {
      uname = userSuggestions[0].username;
    }

    if (!createdRoom?.battleId) return;

    try {
      const res = await axiosInstance.post('/battle/invite', {
        battle_id: createdRoom.battleId,
        friend_username: uname
      });
      if (res.data?.success) {
        toast.success(`📩 Live invitation sent to @${uname}!`, {
          icon: '🚀',
          duration: 5000
        });
        setFriendUsername('');
        setShowSuggestions(false);
      } else {
        toast.error(res.data?.message || 'Could not send invitation.');
      }
    } catch (e) {
      const errorMsg = e.response?.data?.detail || e.response?.data?.message || `User '${uname}' was not found. Please choose a valid registered user.`;
      toast.error(`❌ ${errorMsg}`);
    }
  };

  const handleSendInvite = () => handleSendInviteToUser(friendUsername);

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

  // ─── 4. Host Launches Battle ────────────────────────────────────────────────
  const handleStartBattleAsHost = async () => {
    if (isStartingBattle || !createdRoom?.battleId) return;
    setIsStartingBattle(true);

    try {
      await axiosInstance.post(`/battle/${createdRoom.battleId}/start`);

      let counter = 3;
      setCountdown(counter);
      playCountdownSound(counter);

      const countInterval = setInterval(() => {
        counter -= 1;
        if (counter > 0) {
          setCountdown(counter);
          playCountdownSound(counter);
        } else {
          clearInterval(countInterval);
          setCountdown(null);
          startBattleGame(createdRoom);
        }
      }, 1000);
    } catch (err) {
      toast.error('Failed to start battle. Please try again.');
      setIsStartingBattle(false);
    }
  };

  // ─── 5. Join Room with Code (Enters Guest Waiting Room) ───────────────────────
  const handleJoinWithCode = async () => {
    if (!joinCodeInput.trim()) {
      toast.error('Please enter a valid Battle Code');
      return;
    }
    setIsJoining(true);
    const code = joinCodeInput.trim().toUpperCase();

    try {
      await axiosInstance.post(`/battle/${code}/join`);
      toast.success(`Successfully joined battle room ${code}! Waiting for host...`, { icon: '⏳' });
      
      const battleRes = await axiosInstance.get(`/battle/${code}`);
      const bData = battleRes.data;

      setGuestWaitingRoom({
        battleId: code,
        subject: bData.subject || 'General',
        difficulty: bData.difficulty || 'medium',
        totalQuestions: bData.total_questions || 10,
        timePerQuestion: bData.time_per_question || 15,
        questions: bData.questions || [],
        hostName: bData.creator_name || 'Host'
      });
    } catch (e) {
      const msg = e.response?.data?.detail || 'Unable to join battle room';
      toast.error(msg);
    } finally {
      setIsJoining(false);
    }
  };

  // ─── 6. Quick Matchmaking (Skill-based pairing with instant start) ───────────
  const handleQuickMatch = async () => {
    setIsSearchingQuickMatch(true);
    setQuickMatchSearchSeconds(0);
    setQuickMatchFoundData(null);
    setQuickMatchCountdown(null);

    try {
      const res = await axiosInstance.post('/battle/quick-match', {
        subject: selectedSubject,
        difficulty: selectedDifficulty
      });
      const data = res.data;

      if (data.matched) {
        // Paired immediately with a waiting player!
        playCorrectSound();
        const rMeta = {
          battleId: data.battle_id,
          subject: data.subject || selectedSubject,
          difficulty: data.difficulty || selectedDifficulty,
          totalQuestions: data.total_questions || 10,
          timePerQuestion: data.time_per_question || 15,
          questions: data.questions || []
        };
        setQuickMatchBattleId(data.battle_id);
        setQuickMatchRoomMeta(rMeta);
        setQuickMatchFoundData({
          opponentName: data.opponent?.username || 'Opponent',
          opponentLevel: data.opponent?.level || 1
        });

        triggerQuickMatchLaunch(data.battle_id, rMeta);
      } else if (data.waiting) {
        // In queue! Waiting for opponent to search
        const rMeta = {
          battleId: data.battle_id,
          subject: data.subject || selectedSubject,
          difficulty: data.difficulty || selectedDifficulty,
          totalQuestions: data.total_questions || 10,
          timePerQuestion: data.time_per_question || 15,
          questions: data.questions || []
        };
        setQuickMatchBattleId(data.battle_id);
        setQuickMatchRoomMeta(rMeta);
      }
    } catch (e) {
      setIsSearchingQuickMatch(false);
      toast.error('Quick match failed to connect. Please try again.');
    }
  };

  const handleCancelQuickMatch = async () => {
    if (quickMatchCountdownRef.current) clearInterval(quickMatchCountdownRef.current);
    if (quickMatchBattleId) {
      try {
        await axiosInstance.post(`/battle/${quickMatchBattleId}/cancel`);
      } catch (e) {}
    }
    setIsSearchingQuickMatch(false);
    setQuickMatchBattleId(null);
    setQuickMatchFoundData(null);
    setQuickMatchCountdown(null);
    toast('Matchmaking search cancelled', { icon: '🛑' });
  };

  // ─── Launch Battle Arena ────────────────────────────────────────────────────
  const startBattleGame = (roomMeta) => {
    store.resetBattle();
    const count = roomMeta?.totalQuestions || 10;
    const timeLimit = roomMeta?.timePerQuestion || 15;
    const questions = roomMeta?.questions || [];

    store.setMatchFound({
      battleId: roomMeta.battleId,
      roomId: 'room_' + roomMeta.battleId,
      difficulty: roomMeta.difficulty,
      totalQuestions: count,
      players: [
        { userId: '1', userName: 'You (Player 1)', totalPoints: 0 },
        { userId: '2', userName: 'Opponent', totalPoints: 0 }
      ]
    });

    if (questions.length > 0) {
      store.setBattleStarted({
        question: questions[0],
        questionIndex: 0,
        totalQuestions: count,
        timePerQuestion: timeLimit
      });
    }

    toast.success('🚀 Battle Arena Launched!', { icon: '⚔️' });
    navigate(ROUTES.BATTLE_PLAY.replace(':id', roomMeta.battleId));
  };

  // ─── RENDER: 1. Guest Waiting Room (Joined with Code, Waiting for Host) ───
  if (guestWaitingRoom) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-3"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary-600 to-battle-600 flex items-center justify-center shadow-glow">
            <Swords size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold gradient-text-battle">Joined Battle Room</h1>
          <p className="text-dark-400">
            You have successfully joined the room! Waiting for the Host to start the battle.
          </p>
        </motion.div>

        {/* Room Details Card */}
        <Card className="battle-glow border-battle-500/30 text-center py-6 space-y-4">
          <p className="text-xs uppercase font-bold text-dark-400 tracking-wider">Room Code</p>
          <div className="flex items-center justify-center gap-3">
            <span className="font-mono text-4xl font-extrabold text-accent-400 bg-dark-800/80 px-6 py-2 rounded-xl border border-dark-600 tracking-wider">
              {guestWaitingRoom.battleId}
            </span>
          </div>

          <div className="flex items-center justify-center gap-4 text-sm text-dark-300">
            <span>📚 Subject: <strong className="text-white">{guestWaitingRoom.subject}</strong></span>
            <span>•</span>
            <span>🎯 Questions: <strong className="text-accent-400">{guestWaitingRoom.totalQuestions} Qs</strong></span>
            <span>•</span>
            <span>⏱️ Timer: <strong className="text-battle-400">{guestWaitingRoom.timePerQuestion}s / Q</strong></span>
          </div>

          {/* Countdown or Waiting Status */}
          {countdown !== null ? (
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="py-6 space-y-3">
              <p className="text-sm font-bold text-accent-400 uppercase tracking-widest">
                Host Started Battle! Launching in:
              </p>
              <div className="text-7xl font-black text-white animate-pulse">{countdown}</div>
            </motion.div>
          ) : (
            <div className="py-6 space-y-4">
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-battle-500/10 border border-battle-500/30 text-battle-300">
                <Spinner size="sm" />
                <span className="text-sm font-semibold">Waiting for Host to click "Start Battle"...</span>
              </div>
              <p className="text-xs text-dark-400 max-w-md mx-auto">
                Get ready! When the host launches the match, a 3-second synchronized countdown will trigger simultaneously for both of you.
              </p>
              <div className="pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setGuestWaitingRoom(null)}
                >
                  Leave Room
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // ─── RENDER: 2. Host Room Waiting for Friend ────────────────────────────────
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
            Share this invitation code or search your friend below to start the live battle.
          </p>
          {createdRoom.isPdfBattle && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/30 text-accent-400 text-xs font-semibold">
              <FileText size={14} /> Questions Synthesized from: {createdRoom.pdfTitle}
            </div>
          )}
        </motion.div>

        {/* Room Code Card */}
        <Card className="battle-glow border-battle-500/30 text-center py-6">
          <p className="text-xs uppercase font-bold text-dark-400 tracking-wider mb-2">Invitation Code</p>
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="font-mono text-4xl font-extrabold text-accent-400 bg-dark-800/80 px-6 py-2 rounded-xl border border-dark-600 tracking-wider">
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

        {/* Send Direct Message / Invitation to Friend with Live User Autocomplete */}
        <Card className="overflow-visible relative z-30 border-battle-500/30">
          <h3 className="text-base font-semibold text-dark-100 mb-2 flex items-center gap-2">
            <Send size={18} className="text-battle-400" /> Send Live Notification to Friend
          </h3>
          <p className="text-xs text-dark-400 mb-3">
            Type your friend's username or email. Matching registered users will be suggested automatically.
          </p>
          <div className="relative z-40" ref={suggestionsRef}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Type friend's username (e.g. sasi, john)..."
                  value={friendUsername}
                  onChange={(e) => {
                    setFriendUsername(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => {
                    setShowSuggestions(true);
                    if (userSuggestions.length === 0) {
                      fetchUserSuggestions(friendUsername);
                    }
                  }}
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-battle-500"
                />
                {isSearchingUsers && (
                  <div className="absolute right-3 top-3">
                    <Spinner size="sm" />
                  </div>
                )}
              </div>
              <Button variant="battle" onClick={handleSendInvite} leftIcon={<UserPlus size={16} />}>
                Invite
              </Button>
            </div>

            {/* Live Autocomplete Dropdown */}
            <AnimatePresence>
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="absolute left-0 right-0 mt-2 bg-dark-950 border-2 border-battle-500/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden max-h-72 overflow-y-auto divide-y divide-dark-800"
                  style={{ zIndex: 9999 }}
                >
                  <div className="px-3.5 py-2 bg-dark-900 border-b border-dark-800 text-[11px] font-bold text-accent-400 flex items-center justify-between">
                    <span>{friendUsername.trim() ? `Matching users for "${friendUsername}"` : 'Registered QuizMaster Users'}</span>
                    <span className="text-dark-400 font-normal">{userSuggestions.length} found</span>
                  </div>

                  {userSuggestions.length > 0 ? (
                    userSuggestions.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => {
                          setFriendUsername(u.username);
                          setShowSuggestions(false);
                        }}
                        className="p-3 hover:bg-battle-600/20 cursor-pointer flex items-center justify-between transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar name={u.username} size="sm" />
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-dark-900" title="Available" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white group-hover:text-battle-300 transition-colors">
                              @{u.username}
                            </p>
                            <p className="text-xs text-dark-400">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            ⭐ Lvl {u.level || 1}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendInviteToUser(u.username);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-battle-600 hover:bg-battle-500 text-white text-xs font-semibold flex items-center gap-1 transition-all"
                          >
                            <Send size={12} /> Invite
                          </button>
                        </div>
                      </div>
                    ))
                  ) : !isSearchingUsers ? (
                    <div className="p-4 text-center text-xs text-dark-400">
                      No registered users found matching &quot;{friendUsername}&quot;
                    </div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>

        {/* Friend Joined Celebratory Alert */}
        {friendJoinedData && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-gradient-to-r from-green-500/20 via-emerald-500/10 to-transparent border border-green-500/40 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold text-lg">
                ✓
              </div>
              <div>
                <div className="font-bold text-white flex items-center gap-2">
                  <span>🎮 {friendJoinedData.userName} joined the room!</span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-accent-500/20 text-accent-400 border border-accent-500/30">
                    Level {friendJoinedData.level}
                  </span>
                </div>
                <p className="text-xs text-green-300/80">
                  Opponent is ready and waiting for you to launch the battle.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-green-400 uppercase tracking-wider px-2.5 py-1 rounded bg-green-950/60 border border-green-500/30">
              Ready
            </span>
          </motion.div>
        )}

        {/* Participants in Room */}
        <Card className="text-center space-y-4 relative z-10">
          <h3 className="text-sm font-bold text-dark-300 uppercase tracking-wider">Room Participants (2 Max)</h3>
          <div className="flex justify-center gap-8">
            {roomParticipants.map((p, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2">
                <Avatar name={p.userName} size="lg" />
                <span className="text-sm font-semibold text-white">{p.userName}</span>
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span> Ready
                </span>
              </div>
            ))}
            {roomParticipants.length === 1 && (
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full border-2 border-dashed border-dark-600 flex items-center justify-center text-dark-500">
                  <Users size={24} />
                </div>
                <span className="text-sm text-dark-400">Waiting for Opponent...</span>
                <span className="text-xs text-accent-400 animate-pulse">Connecting...</span>
              </div>
            )}
          </div>

          {/* Countdown State or Host Action Controls */}
          {countdown !== null ? (
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="space-y-2 py-4">
              <p className="text-sm font-bold text-accent-400 uppercase tracking-wider">Battle Launching in:</p>
              <div className="text-7xl font-black text-white animate-pulse">{countdown}</div>
            </motion.div>
          ) : friendJoinedData ? (
            <div className="space-y-3 pt-3">
              <Button
                variant="battle"
                size="xl"
                onClick={handleStartBattleAsHost}
                disabled={isStartingBattle}
                className="w-full text-base font-bold shadow-glow-purple py-4 flex items-center justify-center gap-2"
                leftIcon={isStartingBattle ? <Spinner size="sm" /> : <Swords size={22} />}
              >
                {isStartingBattle ? 'Starting Battle Arena...' : '⚔️ Start Battle Now (Host)'}
              </Button>
              <p className="text-xs text-center text-dark-400">
                Only you (the host) can start the battle. When clicked, both players count down together!
              </p>
              <div className="flex justify-center pt-1">
                <Button variant="ghost" size="sm" onClick={() => { setCreatedRoom(null); setFriendJoinedData(null); }}>
                  Cancel Room
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-center gap-2 text-xs text-battle-400">
                <span className="w-2.5 h-2.5 rounded-full bg-battle-400 animate-ping"></span>
                <span>Waiting for opponent to connect via Room Code...</span>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setCreatedRoom(null)}>
                Cancel Room
              </Button>
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
        <h1 className="text-4xl font-bold gradient-text-battle">Multiplayer Battle Arena</h1>
        <p className="text-dark-400 max-w-lg mx-auto text-sm">
          Challenge friends in real-time battles using benchmark datasets or questions generated directly from your uploaded lecture PDFs (RAG)!
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
                ? 'bg-accent-600 text-white shadow-glow-amber'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            ⚡ Quick Match (|Δlvl| ≤ 1)
          </button>
        </div>
      </div>

      {/* TAB 1: Create Room */}
      {activeTab === 'create' && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          
          {/* Question Source Selection (RAG PDF vs Dataset) */}
          <Card className="border-battle-500/30">
            <h2 className="text-lg font-semibold text-dark-100 mb-2 flex items-center gap-2">
              <BookOpen size={20} className="text-battle-400" /> 1. Question Source
            </h2>
            <p className="text-xs text-dark-400 mb-4">
              Choose whether battle questions come from general subjects or your uploaded lecture notes.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <button
                type="button"
                onClick={() => setQuestionSource('dataset')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  questionSource === 'dataset'
                    ? 'border-battle-500 bg-battle-500/10 text-white shadow-glow-purple'
                    : 'border-dark-700 bg-dark-800/40 text-dark-400 hover:border-dark-600'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-white mb-1">
                  <span>📚 Benchmark Curriculum</span>
                </div>
                <p className="text-xs text-dark-400">
                  Verified high-quality questions across Computer Science, Math, Science & General topics.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setQuestionSource('pdf')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  questionSource === 'pdf'
                    ? 'border-accent-500 bg-accent-500/10 text-white shadow-glow-amber'
                    : 'border-dark-700 bg-dark-800/40 text-dark-400 hover:border-dark-600'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-accent-400 mb-1">
                  <span>📄 Uploaded PDF Document (RAG)</span>
                </div>
                <p className="text-xs text-dark-400">
                  Battle using questions dynamically synthesized from your course notes or research PDF.
                </p>
              </button>
            </div>

            {/* If PDF source selected: Show PDF dropdown / cards */}
            {questionSource === 'pdf' && (
              <div className="pt-3 border-t border-dark-700/80 space-y-3">
                <p className="text-xs font-semibold text-accent-400 uppercase tracking-wider">
                  Select Uploaded PDF:
                </p>
                {isLoadingPdfs ? (
                  <div className="flex items-center gap-2 text-xs text-dark-400 py-2">
                    <Spinner size="sm" /> Loading your PDF library...
                  </div>
                ) : userPdfs.length === 0 ? (
                  <div className="p-4 rounded-xl bg-dark-800/70 border border-dark-700 text-center space-y-2">
                    <p className="text-xs text-dark-400">No uploaded PDFs found yet.</p>
                    <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.PDF_MANAGER)} leftIcon={<UploadCloud size={16} />}>
                      Upload Lecture PDF First
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                    {userPdfs.map((pdf) => {
                      const docName = pdf.original_name || pdf.name || pdf.title || pdf.filename || `Document #${pdf.id}`;
                      const sizeStr = pdf.file_size ? `${(pdf.file_size / (1024 * 1024)).toFixed(1)} MB` : '';
                      const chunksStr = pdf.chunk_count ? `${pdf.chunk_count} chunks` : '';
                      const metaInfo = [sizeStr, chunksStr].filter(Boolean).join(' • ');

                      return (
                        <button
                          key={pdf.id}
                          type="button"
                          onClick={() => setSelectedPdfId(pdf.id)}
                          className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                            selectedPdfId === pdf.id
                              ? 'border-accent-500 bg-accent-500/20 text-white font-medium shadow-glow-amber'
                              : 'border-dark-700 bg-dark-800/60 text-dark-300 hover:border-dark-600'
                          }`}
                        >
                          <FileText size={20} className={selectedPdfId === pdf.id ? 'text-accent-400' : 'text-dark-500'} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate text-white" title={docName}>{docName}</p>
                            <p className="text-[10px] text-dark-400 truncate">{metaInfo || 'Ready for Battle'}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Subject selection (if dataset mode) */}
          {questionSource === 'dataset' && (
            <Card>
              <h2 className="text-lg font-semibold text-dark-100 mb-4">2. Select Subject</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {['Programming', 'Mathematics', 'Science', 'General'].map((subj) => (
                  <button
                    key={subj}
                    onClick={() => setSelectedSubject(subj)}
                    className={`p-3.5 rounded-xl border text-center transition-all font-semibold text-sm ${
                      selectedSubject === subj
                        ? 'border-battle-500 bg-battle-500/20 text-white shadow-glow-purple'
                        : 'border-dark-700 bg-dark-800/50 text-dark-300 hover:border-dark-500'
                    }`}
                  >
                    {subj}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Difficulty selection */}
          <Card>
            <h2 className="text-lg font-semibold text-dark-100 mb-4">
              {questionSource === 'dataset' ? '3.' : '2.'} Select Difficulty
            </h2>
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
                  {questionSource === 'dataset' ? '4.' : '3.'} Number of Questions & Adaptive Timer
                </h2>
                <p className="text-xs text-dark-400 mt-0.5">
                  Minimum 10 questions. System dynamically scales timer per round.
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
                Base Time (10 Qs): <strong>15 seconds</strong> | Extra: <strong>+3s per question</strong>
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
            disabled={isCreating || (questionSource === 'pdf' && !selectedPdfId)}
            leftIcon={isCreating ? <Spinner size="sm" /> : <Swords size={22} />}
          >
            {isCreating ? 'Synthesizing Battle Arena...' : 'Create Room & Get Invitation Code'}
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
          {!isSearchingQuickMatch ? (
            <Card>
              <h2 className="text-lg font-semibold text-dark-100 mb-2">Instant Quick Matchmaking</h2>
              <p className="text-xs text-dark-400 mb-6">
                Click find opponent to connect in real time with another player who is also queuing for battle.
                Pairs you with the closest level player and launches the battle automatically!
              </p>

              {/* Subject selector */}
              <div className="mb-5">
                <span className="text-xs uppercase font-bold text-dark-400 block mb-2">1. Select Subject</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['General', 'Science', 'Programming', 'Mathematics'].map((subj) => (
                    <button
                      key={subj}
                      onClick={() => setSelectedSubject(subj)}
                      className={`p-3 rounded-xl border text-center transition-all font-semibold text-xs ${
                        selectedSubject === subj
                          ? 'border-battle-500 bg-battle-500/20 text-white shadow-glow-purple'
                          : 'border-dark-700 bg-dark-800/50 text-dark-300 hover:border-dark-500'
                      }`}
                    >
                      {subj}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty selector */}
              <div className="mb-6">
                <span className="text-xs uppercase font-bold text-dark-400 block mb-2">2. Select Difficulty</span>
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
              </div>

              <Button
                variant="battle"
                size="xl"
                className="w-full"
                onClick={handleQuickMatch}
                leftIcon={<Swords size={22} />}
              >
                Find Opponent (Auto Match)
              </Button>
            </Card>
          ) : (
            /* Live Matchmaking Queue / Match Found View */
            <Card className="battle-glow border-battle-500/50 py-10 text-center space-y-6">
              {!quickMatchFoundData ? (
                <div className="space-y-6">
                  {/* Radar Pulse Animation */}
                  <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-battle-500/20 animate-ping" />
                    <div className="absolute inset-2 rounded-full bg-accent-500/20 animate-pulse" />
                    <div className="relative w-20 h-20 rounded-full bg-dark-900 border-2 border-battle-500 flex items-center justify-center shadow-glow-purple">
                      <Swords size={36} className="text-accent-400 animate-bounce" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-2xl font-extrabold text-white">
                      Searching for Opponent...
                    </h3>
                    <p className="text-sm text-dark-300 mt-1 max-w-md mx-auto">
                      Looking for another player who clicked Quick Match. Matching closest player level...
                    </p>
                  </div>

                  {/* Live Search Stats */}
                  <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-dark-300">
                    <div className="px-3 py-1.5 rounded-lg bg-dark-800 border border-dark-700">
                      ⏱️ Queue Time: <strong className="text-accent-400 font-mono text-sm ml-1">{formatTimer(quickMatchSearchSeconds)}</strong>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-dark-800 border border-dark-700">
                      🎯 Subject: <strong className="text-white ml-1">{selectedSubject}</strong>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-dark-800 border border-dark-700">
                      ⚡ Difficulty: <strong className="text-white ml-1 capitalize">{selectedDifficulty}</strong>
                    </div>
                  </div>

                  <p className="text-xs text-dark-400">
                    💡 Tip: When your friend also clicks &quot;Quick Match&quot;, both of you will connect instantly!
                  </p>

                  <div className="pt-2">
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={handleCancelQuickMatch}
                    >
                      Cancel Matchmaking
                    </Button>
                  </div>
                </div>
              ) : (
                /* Match Found & Launching */
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="space-y-6"
                >
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 text-sm font-bold animate-pulse">
                    <CheckCircle size={18} /> OPPONENT FOUND!
                  </div>

                  <div className="flex items-center justify-center gap-8 py-2">
                    <div className="text-center">
                      <Avatar name="You" size="lg" />
                      <p className="text-sm font-bold text-white mt-2">You</p>
                    </div>

                    <div className="text-4xl font-black gradient-text-battle animate-pulse">VS</div>

                    <div className="text-center">
                      <Avatar name={quickMatchFoundData.opponentName} size="lg" />
                      <p className="text-sm font-bold text-accent-400 mt-2">
                        {quickMatchFoundData.opponentName}
                      </p>
                      <span className="text-xs text-dark-400 font-semibold">Level {quickMatchFoundData.opponentLevel}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-dark-400 font-semibold">
                      Synchronizing Arena... Starting in:
                    </p>
                    <div className="text-7xl font-black text-white animate-pulse">
                      {quickMatchCountdown !== null ? quickMatchCountdown : 3}
                    </div>
                  </div>
                </motion.div>
              )}
            </Card>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default BattleLobbyPage;