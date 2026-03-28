import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { streamsApi } from '../../services/api';
import {
  Plus, Search, Upload, Edit2, Trash2, Activity,
  CheckCircle, XCircle, HelpCircle, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { StreamModal } from './StreamModal';
import { BulkImportModal } from './BulkImportModal';

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'online': return <CheckCircle size={14} className="text-emerald-500" />;
    case 'offline': return <XCircle size={14} className="text-red-500" />;
    default: return <HelpCircle size={14} className="text-gray-400" />;
  }
};

export function StreamsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editStream, setEditStream] = useState<any>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['streams', page, search, categoryFilter, statusFilter],
    queryFn: () => streamsApi.list({ page, limit: 50, search, category_id: categoryFilter, status: statusFilter }) as any,
    placeholderData: (prev) => prev
  });

  const { data: categories } = useQuery({
    queryKey: ['stream-categories'],
    queryFn: () => streamsApi.categories() as any
  });

  const streams = (data as any)?.data || [];
  const pagination = (data as any)?.pagination;

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete stream "${name}"?`)) return;
    try {
      await streamsApi.delete(id);
      toast.success('Stream deleted');
      queryClient.invalidateQueries({ queryKey: ['streams'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCheckHealth = async (id: number) => {
    const toastId = toast.loading('Checking stream...');
    try {
      const result = await streamsApi.checkHealth(id) as any;
      const health = result.data;
      toast.dismiss(toastId);
      if (health.online) {
        toast.success(`Stream is online (${health.latency}ms)`);
      } else {
        toast.error(`Stream is offline: ${health.error || 'Unknown error'}`);
      }
      queryClient.invalidateQueries({ queryKey: ['streams'] });
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Live Streams</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
          >
            <Upload size={14} />
            Import M3U
          </button>
          <button
            onClick={() => { setEditStream(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
          >
            <Plus size={14} />
            Add Stream
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search streams..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-transparent dark:text-white"
        >
          <option value="">All Categories</option>
          {((categories as any)?.data || []).map((c: any) => (
            <option key={c.id} value={c.id}>{c.category_name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-transparent dark:text-white"
        >
          <option value="">All Status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="unknown">Unknown</option>
        </select>
        <button onClick={() => refetch()} className="p-2 text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50">
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
                <th className="text-left py-3 px-4 font-medium text-gray-500">Stream</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Category</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">EPG ID</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-500">Loading...</td></tr>
              ) : streams.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-500">No streams found</td></tr>
              ) : (
                streams.map((s: any) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="py-3 px-4 text-gray-400 text-xs">{s.num || s.id}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {s.stream_icon ? (
                          <img
                            src={s.stream_icon}
                            alt=""
                            className="w-8 h-8 rounded object-contain bg-gray-100 dark:bg-gray-700"
                            onError={(e: any) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <Activity size={14} className="text-gray-400" />
                          </div>
                        )}
                        <span className="font-medium text-gray-900 dark:text-white truncate max-w-[250px]">
                          {s.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">{s.category_name || '—'}</td>
                    <td className="py-3 px-4 text-xs font-mono text-gray-500">{s.epg_channel_id || '—'}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <StatusIcon status={s.stream_status} />
                        <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">{s.stream_status}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleCheckHealth(s.id)}
                          className="p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded"
                          title="Check health"
                        >
                          <Activity size={14} />
                        </button>
                        <button
                          onClick={() => { setEditStream(s); setShowModal(true); }}
                          className="p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.name)}
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500">
              {pagination.total} total streams
            </p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">
                Previous
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {pagination.pages}</span>
              <button disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <StreamModal
          stream={editStream}
          categories={(categories as any)?.data || []}
          onClose={() => { setShowModal(false); setEditStream(null); }}
          onSave={() => {
            setShowModal(false);
            setEditStream(null);
            queryClient.invalidateQueries({ queryKey: ['streams'] });
          }}
        />
      )}

      {showImport && (
        <BulkImportModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            queryClient.invalidateQueries({ queryKey: ['streams'] });
          }}
        />
      )}
    </div>
  );
}
