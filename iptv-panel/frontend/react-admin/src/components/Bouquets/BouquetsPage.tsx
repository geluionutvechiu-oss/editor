import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { useState } from 'react';
import { Plus, Package, Users, Tv, Film, List, X } from 'lucide-react';
import toast from 'react-hot-toast';

export function BouquetsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['bouquets'],
    queryFn: () => adminApi.bouquets() as any
  });

  const bouquets = (data as any)?.data || [];

  const handleCreate = async () => {
    if (!form.name) { toast.error('Name is required'); return; }
    try {
      await adminApi.createBouquet(form);
      toast.success('Bouquet created');
      setShowModal(false);
      setForm({ name: '', description: '' });
      queryClient.invalidateQueries({ queryKey: ['bouquets'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bouquets (Channel Packages)</h1>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
          <Plus size={14} /> New Bouquet
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 animate-pulse h-40" />
          ))
        ) : bouquets.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <Package size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No bouquets yet</p>
            <p className="text-xs text-gray-400 mt-1">Create bouquets to group channels for users</p>
          </div>
        ) : (
          bouquets.map((b: any) => (
            <div key={b.id} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{b.name}</h3>
                  {b.description && <p className="text-xs text-gray-500 mt-0.5">{b.description}</p>}
                </div>
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <Package size={18} className="text-indigo-600" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Tv size={12} className="text-blue-500" />
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{b.live_count || 0}</span>
                  </div>
                  <p className="text-[10px] text-gray-500">Live</p>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Film size={12} className="text-purple-500" />
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{b.vod_count || 0}</span>
                  </div>
                  <p className="text-[10px] text-gray-500">VOD</p>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Users size={12} className="text-emerald-500" />
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{b.user_count || 0}</span>
                  </div>
                  <p className="text-[10px] text-gray-500">Users</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Bouquet</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Premium Package" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Description..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-lg text-sm">Cancel</button>
                <button onClick={handleCreate} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
