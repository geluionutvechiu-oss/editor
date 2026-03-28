import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';
import { BarChart2, TrendingUp, DollarSign, Users } from 'lucide-react';

export function ReportsPage() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');

  const { data, isLoading } = useQuery({
    queryKey: ['revenue', period],
    queryFn: () => adminApi.revenue(period) as any
  });

  const { data: logData } = useQuery({
    queryKey: ['connection-logs'],
    queryFn: () => adminApi.connectionLogs({ limit: 100 }) as any
  });

  const revenueData = (data as any)?.data?.subscriptions || [];
  const logs = (logData as any)?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
        <div className="flex gap-2">
          {(['day', 'week', 'month', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                period === p
                  ? 'bg-indigo-600 text-white'
                  : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-6">
          <DollarSign size={20} className="text-emerald-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Subscription Revenue</h3>
        </div>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Revenue']} />
              <Area type="monotone" dataKey="total_revenue" stroke="#10b981" strokeWidth={2} fill="url(#colorRev)" name="Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Subscription Count */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Users size={20} className="text-indigo-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New Subscriptions</h3>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Subscriptions" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Connection Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Connection Logs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-500">User</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Stream</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">IP</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Location</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Duration</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {logs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-500">No logs</td></tr>
              ) : (
                logs.slice(0, 50).map((l: any) => (
                  <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{l.username}</td>
                    <td className="py-3 px-4 text-xs text-gray-500 max-w-[150px] truncate">{l.stream_name || '—'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-500">{l.ip_address}</td>
                    <td className="py-3 px-4 text-xs text-gray-500">{[l.city, l.country].filter(Boolean).join(', ') || '—'}</td>
                    <td className="py-3 px-4 text-xs text-gray-500">{l.duration_secs ? `${Math.floor(l.duration_secs / 60)}m` : '—'}</td>
                    <td className="py-3 px-4 text-xs text-gray-500">{new Date(l.connected_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
