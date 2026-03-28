import { useQuery } from '@tanstack/react-query';
import { adminApi, usersApi } from '../../services/api';
import { Wifi, X } from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

export function ActiveConnectionsTable() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['active-connections'],
    queryFn: () => adminApi.activeConnections() as any,
    refetchInterval: 10000
  });

  const connections = (data as any)?.data || [];

  const handleKick = async (userId: number) => {
    try {
      await usersApi.kick(userId);
      toast.success('Connection terminated');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to kick user');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Wifi size={20} className="text-emerald-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Active Connections
          </h3>
          <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs font-semibold px-2 py-0.5 rounded-full">
            {connections.length}
          </span>
        </div>
        <button
          onClick={() => refetch()}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50">
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">User</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">IP Address</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Stream</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Connected</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">User Agent</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">Loading...</td>
              </tr>
            ) : connections.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">No active connections</td>
              </tr>
            ) : (
              connections.slice(0, 20).map((conn: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {conn.username || `User #${conn.userId}`}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-gray-600 dark:text-gray-400">
                    {conn.ip}
                  </td>
                  <td className="py-3 px-4">
                    {conn.streamType && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        conn.streamType === 'live' ? 'bg-emerald-100 text-emerald-700' :
                        conn.streamType === 'vod' ? 'bg-blue-100 text-blue-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {conn.streamType}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">
                    {conn.connectedAt ? dayjs(conn.connectedAt).fromNow() : '—'}
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-400 max-w-[200px] truncate">
                    {conn.userAgent || '—'}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleKick(conn.userId)}
                      className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Disconnect"
                    >
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
