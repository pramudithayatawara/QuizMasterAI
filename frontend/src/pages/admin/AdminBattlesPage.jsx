import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Swords, Search, Trophy, Clock } from 'lucide-react';
import { adminAPI } from '../../api/admin.api.js';
import Card from '../../components/common/Card.jsx';
import Input from '../../components/common/Input.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { formatRelativeTime, formatDuration } from '../../utils/formatters.js';
import { cn } from '../../utils/helpers.js';
import toast from 'react-hot-toast';

/**
 * @page AdminBattlesPage
 * @description Battle history and management.
 */
const AdminBattlesPage = () => {
  const [battles, setBattles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchBattles = async () => {
      setIsLoading(true);
      try {
        const response = await adminAPI.getBattles({
          page,
          limit: 20,
        });
        setBattles(response.data.data.battles || []);
        setTotalPages(response.data.pagination.totalPages);
      } catch (error) {
        toast.error('Failed to load battles.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchBattles();
  }, [page]);

  const filteredBattles = battles.filter((battle) =>
    battle.roomId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-dark-50">Battle History</h1>
        <p className="text-dark-400 mt-1">View all completed battles</p>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card padding="sm">
          <Input
            placeholder="Search by room ID..."
            leftIcon={<Search size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </Card>
      </motion.div>

      {/* Battle List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="xl" />
          </div>
        ) : filteredBattles.length === 0 ? (
          <EmptyState
            icon={Swords}
            title="No battles found"
            description="No battle history available."
          />
        ) : (
          <div className="space-y-3">
            {filteredBattles.map((battle) => (
              <Card key={battle._id} padding="md" hover>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-battle-500/10 rounded-xl
                                  flex items-center justify-center flex-shrink-0">
                    <Swords size={24} className="text-battle-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-dark-50">
                        {battle.roomId}
                      </h3>
                      <span className={cn(
                        'text-xs px-2 py-1 rounded-full font-medium',
                        battle.status === 'finished'
                          ? 'bg-secondary-500/20 text-secondary-400'
                          : 'bg-dark-700 text-dark-400'
                      )}>
                        {battle.status}
                      </span>
                      <span className="difficulty-pill text-xs badge-medium">
                        {battle.difficulty}
                      </span>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-dark-400">
                      <div className="flex items-center gap-1.5">
                        <Trophy size={14} />
                        <span>
                          Winner: {battle.winnerName || 'Draw'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} />
                        <span>
                          {battle.duration
                            ? formatDuration(battle.duration)
                            : 'N/A'}
                        </span>
                      </div>
                      <span>{battle.players.length} players</span>
                      <span>{formatRelativeTime(battle.startedAt)}</span>
                    </div>

                    {/* Player scores */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {battle.players.map((player) => (
                        <div
                          key={player.userId}
                          className="px-3 py-1.5 bg-dark-800 rounded-lg text-xs"
                        >
                          <span className="text-dark-300">{player.userName}</span>
                          <span className="text-dark-500 mx-1">•</span>
                          <span className="text-primary-400 font-medium">
                            {player.totalPoints} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AdminBattlesPage;