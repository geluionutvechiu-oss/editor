import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { epgApi } from '../../services/api';
import { Plus, RefreshCw, Trash2, Calendar, X } from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

export function EpgPage() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSource, setNewSource] = useState({ name: '', url: '', update_frequency_hours: 12 });

  const { data: sources, isLoading } = useQuery({
    queryKey: ['epg-sources'],
    queryFn: () => epgApi.sources() as any
  });

  const { data: channels } = useQuery({
    queryKey: ['epg-channels'],
    queryFn: () => epgApi.channels({ limit: 10 }) as any
  });

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this EPG source and all its data?')) return;
    try {
      await epgApi.deleteSource(id);
      toast.success('EPG source deleted');
      queryClient.invalidateQueries({ queryKey: ['epg-sources'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRefresh = async (id: number, name: string) => {
    const t = toast.loading(`Refreshing ${name}...`);
    try {
      await epgApi.refreshSource(id);
      toast.dismiss(t);
      toast.success('EPG refresh started in background');
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['epg-sources'] }), 5000);
    } catch (err: any) {
      toast.dismiss(t);
      toast.error(err.message);
    }
  };

  const handleAddSource = async () => {
    if (!newSource.name || !newSource.url) {
      toast.error('Name and URL are required');
      return;
    }
    try {
      await epgApi.createSource(newSource);
      toast.success('EPG source added');
      setShowAddModal(false);
      setNewSource({ name: '', url: '', update_frequency_hours: 12 });
      queryClient.invalidateQueries({ queryKey: ['epg-sources'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const sourcesData = (sources as any)?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">EPG Sources</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
        >
          <Plus size={14} />
          Add EPG Source
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{sourcesData.length}</p>
          <p className="text-sm text-gray-500 mt-0.5">EPG Sources</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {sourcesData.reduce((sum: number, s: any) => sum + (s.channel_count || 0), 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">Total Channels</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {sourcesData.reduce((sum: number, s: any) => sum + (s.event_count || 0), 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">Total Events</p>
        </div>
      </div>

      {/* Sources Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Source Name</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">URL</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Channels</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Events</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Last Updated</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Update Every</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-500">Loading...</td></tr>
              ) : sourcesData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Calendar size={32} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">No EPG sources configured</p>
                    <p className="text-xs text-gray-400 mt-1">Add an XMLTV source to enable EPG</p>
                  </td>
                </tr>
              ) : (
                sourcesData.map((s: any) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{s.name}</td>
                    <td className="py-3 px-4">
                      <a href={s.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-mono text-indigo-500 hover:underline max-w-[200px] truncate block">
                        {s.url}
                      </a>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{(s.channel_count || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{(s.event_count || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 text-xs text-gray-500">
                      {s.last_updated ? dayjs(s.last_updated).format('MMM D, HH:mm') : 'Never'}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">{s.update_frequency_hours}h</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleRefresh(s.id, s.name)}
                          className="p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded"
                          title="Refresh now"
                        >
                          <RefreshCw size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
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
      </div>

      {/* Add Source Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add EPG Source</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source Name *</label>
                <input
                  value={newSource.name}
                  onChange={(e) => setNewSource({...newSource, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. EPG Main Source"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">XMLTV URL *</label>
                <input
                  value={newSource.url}
                  onChange={(e) => setNewSource({...newSource, url: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white font-mono focus:ring-2 focus:ring-indigo-500"
                  placeholder="http://epg.provider.com/epg.xml.gz"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Update Every (hours)</label>
                <input
                  type="number"
                  value={newSource.update_frequency_hours}
                  onChange={(e) => setNewSource({...newSource, update_frequency_hours: parseInt(e.target.value)})}
                  min={1} max={168}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-lg text-sm">Cancel</button>
                <button onClick={handleAddSource} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Add Source</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
