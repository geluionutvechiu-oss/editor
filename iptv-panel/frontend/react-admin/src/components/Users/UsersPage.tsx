import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../services/api';
import {
  Plus, Search, Filter, Edit2, Trash2, UserX, UserCheck,
  RefreshCw, Download, Wifi, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { UserModal } from './UserModal';
import { useAuthStore } from '../../store/authStore';

export function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['users', page, search, statusFilter, roleFilter],
    queryFn: () => usersApi.list({ page, limit: 25, search, status: statusFilter, role: roleFilter }) as any,
    placeholderData: (prev) => prev
  });

  const users = (data as any)?.data || [];
  const pagination = (data as any)?.pagination;

  const handleDelete = async (userId: number, username: string) => {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await usersApi.delete(userId);
      toast.success('User deleted');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleBan = async (user: any) => {
    try {
      await usersApi.update(user.id, { is_banned: !user.is_banned });
      toast.success(user.is_banned ? 'User unbanned' : 'User banned');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleKick = async (userId: number) => {
    try {
      await usersApi.kick(userId);
      toast.success('Active connections terminated');
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getUserStatus = (u: any) => {
    if (u.is_banned) return { label: 'Banned', color: 'bg-red-100 text-red-700' };
    if (!u.is_active) return { label: 'Disabled', color: 'bg-gray-100 text-gray-600' };
    if (u.exp_date && dayjs(u.exp_date).isBefore(dayjs())) return { label: 'Expired', color: 'bg-orange-100 text-orange-700' };
    if (u.exp_date && dayjs(u.exp_date).isBefore(dayjs().add(7, 'day'))) return { label: 'Expiring', color: 'bg-yellow-100 text-yellow-700' };
    return { label: 'Active', color: 'bg-emerald-100 text-emerald-700' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
        <button
          onClick={() => { setEditUser(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search username, email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-transparent dark:text-white"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="banned">Banned</option>
        </select>
        {currentUser?.role === 'admin' && (
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-transparent dark:text-white"
          >
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="reseller">Reseller</option>
            <option value="admin">Admin</option>
          </select>
        )}
        <button onClick={() => refetch()} className="p-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-500">#</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Username</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Expiry</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Connections</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Last Login</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Role</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-500">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-500">No users found</td></tr>
              ) : (
                users.map((u: any) => {
                  const status = getUserStatus(u);
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="py-3 px-4 text-gray-400 text-xs">{u.id}</td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{u.username}</p>
                          {u.email && <p className="text-xs text-gray-500">{u.email}</p>}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500">
                        {u.exp_date ? (
                          <div className="flex items-center gap-1">
                            <Clock size={11} />
                            {dayjs(u.exp_date).format('MMM D, YYYY')}
                          </div>
                        ) : (
                          <span className="text-emerald-600">Never</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-xs">
                          <Wifi size={11} className={u.active_connections > 0 ? 'text-emerald-500' : 'text-gray-400'} />
                          <span className={u.active_connections > 0 ? 'text-emerald-600 font-medium' : 'text-gray-500'}>
                            {u.active_connections}/{u.max_connections}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500">
                        {u.last_login ? dayjs(u.last_login).format('MMM D, HH:mm') : 'Never'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          u.role === 'admin' ? 'bg-red-100 text-red-700' :
                          u.role === 'reseller' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {u.active_connections > 0 && (
                            <button
                              onClick={() => handleKick(u.id)}
                              className="p-1.5 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded"
                              title="Kick connections"
                            >
                              <Wifi size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleBan(u)}
                            className={`p-1.5 rounded ${u.is_banned ? 'text-emerald-500 hover:bg-emerald-50' : 'text-red-500 hover:bg-red-50'}`}
                            title={u.is_banned ? 'Unban' : 'Ban'}
                          >
                            {u.is_banned ? <UserCheck size={14} /> : <UserX size={14} />}
                          </button>
                          <button
                            onClick={() => { setEditUser(u); setShowModal(true); }}
                            className="p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          {currentUser?.role === 'admin' && u.id !== currentUser.id && (
                            <button
                              onClick={() => handleDelete(u.id, u.username)}
                              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500">
              Showing {((page - 1) * pagination.limit) + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                const pageNum = Math.max(1, page - 2) + i;
                if (pageNum > pagination.pages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1.5 text-sm border rounded-lg ${
                      pageNum === page
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                disabled={page === pagination.pages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <UserModal
          user={editUser}
          onClose={() => { setShowModal(false); setEditUser(null); }}
          onSave={() => {
            setShowModal(false);
            setEditUser(null);
            queryClient.invalidateQueries({ queryKey: ['users'] });
          }}
        />
      )}
    </div>
  );
}
