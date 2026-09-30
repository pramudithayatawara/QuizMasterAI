import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Users, Trash2, ToggleLeft, ToggleRight,
  Shield, ShieldAlert, Award, RefreshCw, UserCheck,
  UserX, Filter, Sparkles, CheckCircle2
} from 'lucide-react';
import { adminAPI } from '../../api/admin.api.js';
import Card from '../../components/common/Card.jsx';
import Input from '../../components/common/Input.jsx';
import Button from '../../components/common/Button.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { formatRelativeTime, formatNumber } from '../../utils/formatters.js';
import { cn } from '../../utils/helpers.js';
import toast from 'react-hot-toast';

/**
 * @page AdminUsersPage
 * @description Complete user management and RBAC administration page
 */
const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchUsers = async (pageNum = 1, showToast = false) => {
    setIsLoading(true);
    if (showToast) setIsRefreshing(true);
    try {
      const response = await adminAPI.getUsers({
        page: pageNum,
        limit: 20,
        search: searchQuery,
      });
      const data = response.data?.data || response.data || {};
      const userList = data.users || response.data?.users || [];
      setUsers(userList);
      const pagination = response.data?.pagination || {};
      setTotalPages(pagination.totalPages || 1);
      setTotalCount(pagination.total || userList.length);
      if (showToast) toast.success('User list updated!');
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error('Failed to load users.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers(page);
  }, [page, searchQuery]);

  const handleToggleStatus = async (userId, currentActive, username) => {
    try {
      await adminAPI.toggleUserStatus(userId);
      toast.success(`${username} is now ${!currentActive ? 'Active' : 'Suspended'}`);
      fetchUsers(page);
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to update user status.';
      toast.error(msg);
    }
  };

  const handleRoleChange = async (userId, currentRole, username) => {
    const newRole = currentRole === 'admin' ? 'student' : 'admin';
    if (!confirm(`Are you sure you want to change ${username}'s role to ${newRole.toUpperCase()}?`)) return;
    try {
      await adminAPI.updateUserRole(userId, newRole);
      toast.success(`${username} promoted to ${newRole.toUpperCase()}`);
      fetchUsers(page);
    } catch (error) {
      toast.error('Failed to update role.');
    }
  };

  const handleDelete = async (userId, username) => {
    if (userId === 1) {
      toast.error('Root administrator account cannot be deleted.');
      return;
    }
    if (!confirm(`Permanently delete account for "${username}"? All quiz data will be cascade removed.`)) return;
    try {
      await adminAPI.deleteUser(userId);
      toast.success(`User ${username} deleted successfully.`);
      fetchUsers(page);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user.');
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter === 'all') return true;
    if (roleFilter === 'admin') return u.role === 'admin';
    if (roleFilter === 'student') return u.role !== 'admin';
    return true;
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
          <div className="w-10 h-10 rounded-xl bg-primary-600/20 text-primary-400 border border-primary-500/30 flex items-center justify-center">
            <Users size={20} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">User Management</h1>
            <p className="text-dark-400 text-sm mt-0.5">
              Control access roles, account status, and manage {totalCount} registered users
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchUsers(page, true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white border border-dark-700 text-sm transition-all"
        >
          <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </motion.div>

      {/* ─── Search & Filters Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search by name, username, or email..."
            leftIcon={<Search size={16} />}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {/* Role Filters */}
        <div className="flex items-center bg-dark-900 border border-dark-800 rounded-xl p-1 gap-1">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              roleFilter === 'all'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            All ({users.length})
          </button>
          <button
            onClick={() => setRoleFilter('admin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              roleFilter === 'admin'
                ? 'bg-accent-600 text-white shadow-sm'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            Admins
          </button>
          <button
            onClick={() => setRoleFilter('student')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              roleFilter === 'student'
                ? 'bg-dark-700 text-white shadow-sm'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            Students
          </button>
        </div>
      </div>

      {/* ─── Users Table ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Spinner size="xl" />
            <p className="text-dark-400 text-sm">Querying user database...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users match query"
            description="Try adjusting your search criteria or role filter."
          />
        ) : (
          <Card padding="none" className="border-dark-700/60 bg-dark-900/60 backdrop-blur-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-dark-800/80 border-b border-dark-700/80 text-dark-300 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4">User</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Level / XP</th>
                    <th className="p-4">Joined</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-800/60">
                  {filteredUsers.map((u) => {
                    const uid = u.id || u._id;
                    const isActive = u.isActive ?? u.is_active ?? true;
                    const isAdmin = u.role === 'admin';

                    return (
                      <tr
                        key={uid}
                        className="hover:bg-dark-800/40 transition-colors"
                      >
                        {/* Name & Avatar */}
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar
                              name={`${u.firstName || u.username} ${u.lastName || ''}`}
                              size="sm"
                            />
                            <div>
                              <p className="font-semibold text-white">
                                {u.firstName ? `${u.firstName} ${u.lastName || ''}` : u.username}
                              </p>
                              <p className="text-xs text-dark-400">@{u.username}</p>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="p-4 text-dark-300 font-mono text-xs">{u.email}</td>

                        {/* Role (clickable to change) */}
                        <td className="p-4">
                          <button
                            onClick={() => handleRoleChange(uid, u.role, u.username)}
                            title="Click to toggle role (Admin / Student)"
                            className={cn(
                              'text-xs px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border',
                              isAdmin
                                ? 'bg-accent-500/20 text-accent-300 border-accent-500/30 hover:bg-accent-500/30'
                                : 'bg-dark-800 text-dark-300 border-dark-700 hover:border-dark-600'
                            )}
                          >
                            <Shield size={12} className={isAdmin ? 'text-accent-400' : 'text-dark-500'} />
                            <span>{u.role || 'student'}</span>
                          </button>
                        </td>

                        {/* Status (Toggle Active / Suspended) */}
                        <td className="p-4">
                          <button
                            onClick={() => handleToggleStatus(uid, isActive, u.username)}
                            className={cn(
                              'text-xs px-2.5 py-0.5 rounded-full font-semibold transition-all inline-flex items-center gap-1.5',
                              isActive
                                ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30'
                                : 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30'
                            )}
                          >
                            <span className={cn('w-1.5 h-1.5 rounded-full', isActive ? 'bg-emerald-400' : 'bg-red-400')} />
                            <span>{isActive ? 'Active' : 'Suspended'}</span>
                          </button>
                        </td>

                        {/* Level & XP */}
                        <td className="p-4 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-400">Lvl {u.level || 1}</span>
                            <span className="text-dark-500">•</span>
                            <span className="text-dark-400">{formatNumber(u.points || 0)} XP</span>
                          </div>
                        </td>

                        {/* Joined Date */}
                        <td className="p-4 text-xs text-dark-400 whitespace-nowrap">
                          {formatRelativeTime(new Date(u.createdAt || u.created_at))}
                        </td>

                        {/* Actions */}
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleToggleStatus(uid, isActive, u.username)}
                              className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-colors"
                              title={isActive ? 'Suspend User' : 'Activate User'}
                            >
                              {isActive ? (
                                <ToggleRight size={18} className="text-emerald-400" />
                              ) : (
                                <ToggleLeft size={18} className="text-red-400" />
                              )}
                            </button>

                            {uid !== 1 && (
                              <button
                                onClick={() => handleDelete(uid, u.username)}
                                className="p-1.5 rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete User"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-dark-800 bg-dark-900/40">
                <p className="text-xs text-dark-400">
                  Showing Page <span className="font-semibold text-white">{page}</span> of{' '}
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
          </Card>
        )}
      </motion.div>
    </div>
  );
};

export default AdminUsersPage;