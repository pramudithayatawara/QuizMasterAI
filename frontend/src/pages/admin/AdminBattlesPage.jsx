import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Swords, Search, Trophy, Clock, Trash2,
  Play, Users, RefreshCw, AlertCircle, Sparkles
} from 'lucide-react';
import { adminAPI } from '../../api/admin.api.js';
import { ROUTES } from '../../constants/routes.js';
import Card from '../../components/common/Card.jsx';
import Input from '../../components/common/Input.jsx';
import Button from '../../components/common/Button.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { formatRelativeTime } from '../../utils/formatters.js';
import { cn } from '../../utils/helpers.js';
import toast from 'react-hot-toast';

/**
 * @page AdminBattlesPage
 * @description Battle arena session monitor and administration page
 */
const AdminBattlesPage = () => {
  const [battles, setBattles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchBattles = async (pageNum = 1, showToast = false) => {
    setIsLoading(true);
    if (showToast) setIsRefreshing(true);
    try {
      const response = await adminAPI.getBattles({
        page: pageNum,
        limit: 20,
        search: searchQuery,
      });
      const data = response.data?.data || response.data || {};
      const battleList = data.battles || response.data?.battles || [];
      setBattles(battleList);
      const pagination = response.data?.pagination || {};
      setTotalPages(pagination.totalPages || 1);
      setTotalCount(pagination.total || battleList.length);
      if (showToast) toast.success('Battle sessions refreshed!');
    } catch (error) {
      console.error('Failed to load battles:', error);
      toast.error('Failed to load battles.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBattles(page);
  }, [page, searchQuery]);

  const handleDeleteBattle = async (battleId) => {
    if (!confirm(`Are you sure you want to remove battle session "${battleId}"?`)) return;
    try {
      await adminAPI.deleteBattle(battleId);
      toast.success('Battle session removed.');
      fetchBattles(page);
    } catch (error) {
      toast.error('Failed to remove battle session.');
    }
  };

  const filteredBattles = battles.filter((b) => {
    const text = `${b.roomId || ''} ${b.title || ''} ${b.winnerName || ''} ${b.hostName || ''}`.toLowerCase();
    return text.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-800 pb-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-battle-600/20 text-battle-400 border border-battle-500/30 flex items-center justify-center">
            <Swords size={20} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Battle Arena Monitor</h1>
            <p className="text-dark-400 text-sm mt-0.5">
              Inspect active matchmaking rooms, historical showdowns, and manage {totalCount} battle sessions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchBattles(page, true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white border border-dark-700 text-sm transition-all"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <Link
            to={ROUTES.BATTLE_LOBBY}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-battle-600 hover:bg-battle-500 text-white font-medium text-sm shadow-lg shadow-battle-600/25 transition-all"
          >
            <Swords size={16} />
            <span>Go to Battle Lobby</span>
          </Link>
        </div>
      </motion.div>

      {/* ─── Search ──────────────────────────────────────────────────────── */}
      <div className="max-w-md">
        <Input
          placeholder="Search by battle room ID, title, or player..."
          leftIcon={<Search size={16} />}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* ─── Battle List ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Spinner size="xl" />
            <p className="text-dark-400 text-sm">Querying active battles...</p>
          </div>
        ) : filteredBattles.length === 0 ? (
          <EmptyState
            icon={Swords}
            title="No battle sessions found"
            description="Create or challenge a friend to a battle to start seeing live showdowns."
          />
        ) : (
          <div className="space-y-3">
            {filteredBattles.map((battle) => {
              const isFinished = battle.status === 'finished' || battle.status === 'completed';
              const isWaiting = battle.status === 'waiting';
              const pCount = battle.playersCount ?? (battle.players ? battle.players.length : 1);

              return (
                <Card
                  key={battle.id || battle._id}
                  padding="md"
                  hover
                  className="border-dark-700/60 bg-dark-900/60 backdrop-blur-sm"
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-battle-500/15 rounded-xl border border-battle-500/30 flex items-center justify-center flex-shrink-0">
                        <Swords size={22} className="text-battle-400" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                          <h3 className="font-bold text-white text-base">
                            {battle.title || `Battle Arena (${battle.roomId})`}
                          </h3>
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-dark-800 text-primary-300 border border-dark-700">
                            {battle.roomId}
                          </span>
                          <span className={cn(
                            'text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider',
                            isFinished
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : isWaiting
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-battle-500/15 text-battle-400 border border-battle-500/30'
                          )}>
                            {battle.status}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-dark-800 text-dark-300 capitalize border border-dark-700">
                            {battle.difficulty || 'medium'}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-dark-400 flex-wrap">
                          <span className="flex items-center gap-1.5 text-amber-300">
                            <Trophy size={14} className="text-amber-400" />
                            <span>Winner: <strong>{battle.winnerName || 'In Progress'}</strong></span>
                          </span>

                          <span className="flex items-center gap-1">
                            <Users size={14} className="text-dark-400" />
                            <span>{pCount} Player{pCount === 1 ? '' : 's'}</span>
                          </span>

                          <span>Host: <strong className="text-white">{battle.hostName || 'Player'}</strong></span>

                          <span>{battle.totalQuestions || 10} Questions</span>

                          {battle.createdAt && (
                            <span className="text-dark-500">
                              {formatRelativeTime(new Date(battle.createdAt))}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <Link
                        to={`/battle/${battle.roomId || battle.battleId}/play`}
                        className="px-3.5 py-1.5 rounded-xl bg-dark-800 hover:bg-primary-600 hover:text-white text-xs font-semibold text-dark-300 transition-colors flex items-center gap-1.5"
                      >
                        <Play size={13} />
                        <span>Inspect Arena</span>
                      </Link>

                      <button
                        onClick={() => handleDeleteBattle(battle.roomId || battle.id)}
                        className="p-2 rounded-xl text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete Battle"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 p-4 rounded-xl border border-dark-800 bg-dark-900/60">
            <p className="text-xs text-dark-400">
              Page <span className="font-semibold text-white">{page}</span> of{' '}
              <span className="font-semibold text-white">{totalPages}</span>
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AdminBattlesPage;