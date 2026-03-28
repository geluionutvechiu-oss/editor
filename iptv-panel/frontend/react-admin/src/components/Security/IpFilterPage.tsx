import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { Plus, Trash2, Shield, AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

export function IpFilterPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ip_address: '', cidr: '', type: 'blacklist', reason: '', expires_at: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['ip-filter'],
    queryFn: () => adminApi.ipFilter() as any
  });

  const filters = (data as any)?.data || [];
  const blacklist = filters.filter((f: any) => f.type === 'blacklist');
  const whitelist = filters.filter((f: any) => f.type === 'whitelist');

  const handleDelete = async (id: number) => {
    try {
      await adminApi.deleteIpFilter(id);
      toast.success('Filter removed');
      queryClient.invalidateQueries({ queryKey: ['ip-filter'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAdd = async () => {
    if (!form.ip_address) { toast.error('IP address required'); return; }
    try {
      await adminApi.addIpFilter(form);
      toast.success('IP filter added');
      setShowModal(false);
      setForm({ ip_address: '', cidr: '', type: 'blacklist', reason: '', expires_at: '' });
      queryClient.invalidateQueries({ queryKey: ['ip-filter'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const FilterTable = ({ title, items, icon }: { title: string; items: any[]; icon: React.ReactNode }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center gap-2 p-6 border-b border-gray-200 dark:border-gray-700">
        {icon}
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
        <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs px-2 py-0.5 rounded-full font-medium">{items.length}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-700/50">
            <th className="text-left py-3 px-4 font-medium text-gray-500">IP / CIDR</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Reason</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Expires</th>
            <th className="py-3 px-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {items.length === 0 ? (
            <tr><td colSpan={4} className="text-center py-6 text-gray-500">No entries</td></tr>
          ) : (
            items.map((f: any) => (
              <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="py-3 px-4 font-mono text-sm text-gray-900 dark:text-white">
                  {f.cidr || f.ip_address}
                </td>
                <td className="py-3 px-4 text-xs text-gray-500">{f.reason || '—'}</td>
                <td className="py-3 px-4 text-xs text-gray-500">
                  {f.expires_at ? dayjs(f.expires_at).format('MMM D, YYYY') : 'Permanent'}
                </td>
                <td className="py-3 px-4 text-right">
                  <button onClick={() => handleDelete(f.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">IP Filter</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
        >
          <Plus size={14} />
          Add Filter
        </button>
      </div>

      <FilterTable
        title="Blacklist"
        items={blacklist}
        icon={<AlertTriangle size={18} className="text-red-500" />}
      />
      <FilterTable
        title="Whitelist"
        items={whitelist}
        icon={<Shield size={18} className="text-emerald-500" />}
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add IP Filter</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IP Address *</label>
                <input
                  value={form.ip_address}
                  onChange={e => setForm({...form, ip_address: e.target.value})}
                  placeholder="192.168.1.1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CIDR Range (optional)</label>
                <input
                  value={form.cidr}
                  onChange={e => setForm({...form, cidr: e.target.value})}
                  placeholder="192.168.1.0/24"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm({...form, type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="blacklist">Blacklist (Block)</option>
                  <option value="whitelist">Whitelist (Allow only)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                <input
                  value={form.reason}
                  onChange={e => setForm({...form, reason: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expires At (optional)</label>
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={e => setForm({...form, expires_at: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-lg text-sm">Cancel</button>
                <button onClick={handleAdd} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Add Filter</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
