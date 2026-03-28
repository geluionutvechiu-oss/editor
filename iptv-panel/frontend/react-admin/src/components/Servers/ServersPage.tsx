import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { useState } from 'react';
import { Plus, Edit2, Trash2, Server, CheckCircle, XCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

export function ServersPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', domain: '', ip_address: '', http_port: 8080, https_port: 8443, max_clients: 1000, is_load_balancer: false, weight: 1, notes: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['servers'],
    queryFn: () => adminApi.servers() as any
  });

  const servers = (data as any)?.data || [];

  const handleAdd = async () => {
    if (!form.name || !form.domain || !form.ip_address) { toast.error('Name, domain, and IP are required'); return; }
    try {
      await adminApi.createServer(form);
      toast.success('Server added');
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this server?')) return;
    try {
      await adminApi.deleteServer(id);
      toast.success('Server deleted');
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleStatus = async (s: any) => {
    const newStatus = s.status === 'online' ? 'maintenance' : 'online';
    try {
      await adminApi.updateServer(s.id, { status: newStatus });
      toast.success(`Server set to ${newStatus}`);
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Server Management</h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
          <Plus size={14} /> Add Server
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 animate-pulse h-40" />
          ))
        ) : servers.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <Server size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No servers configured</p>
          </div>
        ) : (
          servers.map((s: any) => (
            <div key={s.id} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${s.status === 'online' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    <Server size={20} className={s.status === 'online' ? 'text-emerald-600' : 'text-red-600'} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{s.name}</h3>
                    <p className="text-xs text-gray-500">{s.domain}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {s.status === 'online' ? (
                    <CheckCircle size={16} className="text-emerald-500" />
                  ) : (
                    <XCircle size={16} className="text-red-500" />
                  )}
                  <span className={`text-xs font-medium capitalize ${s.status === 'online' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {s.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-4">
                <div><span className="font-medium">IP:</span> {s.ip_address}</div>
                <div><span className="font-medium">Port:</span> {s.http_port}</div>
                <div><span className="font-medium">Clients:</span> {s.total_clients || 0}/{s.max_clients}</div>
                {s.is_load_balancer && <div className="text-indigo-600 font-medium">Load Balancer</div>}
              </div>

              {/* CPU/RAM bars */}
              {s.cpu_load > 0 && (
                <div className="space-y-1 mb-4">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>CPU</span><span>{s.cpu_load}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${s.cpu_load > 80 ? 'bg-red-500' : s.cpu_load > 60 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                      style={{ width: `${s.cpu_load}%` }} />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => handleToggleStatus(s)}
                  className={`flex-1 py-1.5 text-xs rounded-lg font-medium border transition-colors ${
                    s.status === 'online'
                      ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'
                      : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                  }`}>
                  {s.status === 'online' ? 'Set Maintenance' : 'Set Online'}
                </button>
                <button onClick={() => handleDelete(s.id)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg border border-red-200">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Server</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: 'Server Name', key: 'name', placeholder: 'Main Server' },
                { label: 'Domain', key: 'domain', placeholder: 'streaming.example.com' },
                { label: 'IP Address', key: 'ip_address', placeholder: '1.2.3.4' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label} *</label>
                  <input value={(form as any)[key]} onChange={e => setForm({...form, [key]: e.target.value})}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500" />
                </div>
              ))}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">HTTP Port</label>
                  <input type="number" value={form.http_port} onChange={e => setForm({...form, http_port: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">HTTPS Port</label>
                  <input type="number" value={form.https_port} onChange={e => setForm({...form, https_port: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Max Clients</label>
                  <input type="number" value={form.max_clients} onChange={e => setForm({...form, max_clients: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={form.is_load_balancer} onChange={e => setForm({...form, is_load_balancer: e.target.checked})}
                  className="w-4 h-4 text-indigo-600 rounded" />
                Is Load Balancer
              </label>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-lg text-sm">Cancel</button>
                <button onClick={handleAdd} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Add Server</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
