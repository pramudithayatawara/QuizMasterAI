import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Users, Trash2, ToggleLeft, ToggleRight, Eye } from 'lucide-react';
import { adminAPI } from '../../api/admin.api.js';
import Card from '../../components/common/Card.jsx';
import Input from '../../components/common/Input.jsx';
import Button from '../../components/common/Button.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { formatRelativeTime } from '../../utils/formatters.js';
import { cn } from '../../utils/helpers.js';
import toast from 'react-hot-toast';

/**
 * @page AdminUsersPage
 * @description User management page for admins.
 */
const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = async (pageNum = 1) => {
    setIsLoading(true);
    try {
      const response = await adminAPI.getUsers({
        page: pageNum,
        limit: 20,
        search: searchQuery,
      });
      setUsers(response.data.data.users || []);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error) {
      toast.error('Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(page);
  }, [page, searchQuery]);

  const handleToggleStatus = async (userId) => {
    try {
      await adminAPI.toggleUserStatus(userId);
      toast.success('User status updated.');
      fetchUsers(page);
    } catch (error) {
      toast.error('Failed to update user status.');
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await adminAPI.deleteUser(userId);
      toast.success('User deleted successfully.');
      fetchUsers(page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete user.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-dark-50">User Management</h1>
        <p className="text-dark-400 mt-1">Manage all registered users</p>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card padding="sm">
          <Input
            placeholder="Search users by name or email..."
            leftIcon={<Search size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </Card>
      </motion.div>

      {/* User List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="xl" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users found"
            description="Try adjusting your search."
          />
        ) : (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-dark-700">
                  <tr className="text-left text-sm text-dark-400">
                    <th className="p-4">User</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Joined</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {users.map((user) => (
                    <motion.tr
                      key={user._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-dark-800/50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={`${user.firstName} ${user.lastName}`}
                            size="sm"
                          />
                          <span className="font-medium text-dark-100">
                            {user.firstName} {user.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-dark-300">{user.email}</td>
                      <td className="p-4">
                        <span className={cn(
                          'text-xs px-2 py-1 rounded-full font-medium',
                          user.role === 'admin'
                            ? 'bg-accent-500/20 text-accent-400'
                            : 'bg-dark-700 text-dark-400'
                        )}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={cn(
                          'text-xs px-2 py-1 rounded-full font-medium',
                          user.isActive
                            ? 'bg-secondary-500/20 text-secondary-400'
                            : 'bg-red-500/20 text-red-400'
                        )}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-dark-400">
                        {formatRelativeTime(user.createdAt)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleStatus(user._id)}
                            className="p-2 rounded-lg text-dark-400 hover:text-dark-100
                                       hover:bg-dark-700 transition-colors"
                            title={user.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {user.isActive ? (
                              <ToggleRight size={16} />
                            ) : (
                              <ToggleLeft size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(user._id)}
                            className="p-2 rounded-lg text-dark-400 hover:text-red-400
                                       hover:bg-red-500/10 transition-colors"
                            title="Delete user"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-dark-700">
                <p className="text-sm text-dark-400">
                  Page {page} of {totalPages}
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