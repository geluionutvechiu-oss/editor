import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';
import {
  Users, Tv, Film, Server, Activity, Wifi, WifiOff,
  TrendingUp, Clock, Shield, AlertTriangle
} from 'lucide-react';
import { adminApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { StatCard } from './StatCard';
import { ActiveConnectionsTable } from './ActiveConnectionsTable';
import { RecentLoginsTable } from './RecentLoginsTable';
import dayjs from 'dayjs';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

export function DashboardPage() {
  const { user } = useAuthStore();
  const wsRef = useRef<WebSocket | null>(null);
  const [realtimeStats, setRealtimeStats] = useState<any>(null);

  const { data: dashboard, isLoading, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => adminApi.dashboard() as any,
    refetchInterval: 30000
  });

  const { data: revenue } = useQuery({
    queryKey: ['revenue'],
    queryFn: () => adminApi.revenue('month') as any,
    enabled: user?.role === 'admin'
  });

  // WebSocket for real-time stats
  useEffect(() => {
    if (user?.role !== 'admin') return;

    const wsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      const token = localStorage.getItem('iptv_token');
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'auth_ok') {
        ws.send(JSON.stringify({ type: 'subscribe_stats' }));
      } else if (msg.type === 'stats') {
        setRealtimeStats(msg.data);
      }
    };

    ws.onerror = () => {};
    ws.onclose = () => {};

    return () => {
      ws.close();
    };
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
      </div>
    );
  }

  const data = (dashboard as any)?.data;
  const stats = realtimeStats || {};

  const streamStatusData = data?.streams ? [
    { name: 'Online', value: data.streams.online || 0 },
    { name: 'Offline', value: data.streams.offline || 0 },
    { name: 'Unknown', value: data.streams.unknown || 0 }
  ] : [];

  const revenueData = (revenue as any)?.data?.subscriptions?.map((r: any) => ({
    period: r.period,
    revenue: parseFloat(r.total_revenue) || 0,
    count: r.count || 0
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last updated: {dayjs().format('MMM D, YYYY HH:mm:ss')}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Activity size={16} />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={data?.users?.total_users || 0}
          sub={`${data?.users?.active_users || 0} active`}
          icon={<Users className="text-indigo-500" size={24} />}
          trend={+2.5}
          color="indigo"
        />
        <StatCard
          title="Active Connections"
          value={stats.active_connections ?? data?.active_connections ?? 0}
          sub="Live right now"
          icon={<Wifi className="text-emerald-500" size={24} />}
          color="emerald"
          live
        />
        <StatCard
          title="Live Streams"
          value={data?.streams?.total_streams || 0}
          sub={`${data?.streams?.online || 0} online`}
          icon={<Tv className="text-blue-500" size={24} />}
          color="blue"
        />
        <StatCard
          title="VOD Content"
          value={(data?.vod?.total || 0) + (data?.series?.total || 0)}
          sub={`${data?.vod?.total || 0} movies · ${data?.series?.total || 0} series`}
          icon={<Film className="text-purple-500" size={24} />}
          color="purple"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Expiring Soon"
          value={data?.users?.expiring_soon || 0}
          sub="Within 7 days"
          icon={<Clock className="text-yellow-500" size={24} />}
          color="yellow"
          alert={data?.users?.expiring_soon > 0}
        />
        <StatCard
          title="Expired Users"
          value={data?.users?.expired_users || 0}
          sub="Need renewal"
          icon={<AlertTriangle className="text-red-500" size={24} />}
          color="red"
          alert={data?.users?.expired_users > 0}
        />
        <StatCard
          title="Offline Streams"
          value={data?.streams?.offline || 0}
          sub="Need attention"
          icon={<WifiOff className="text-red-500" size={24} />}
          color="red"
          alert={data?.streams?.offline > 0}
        />
        <StatCard
          title="Banned Users"
          value={data?.users?.banned_users || 0}
          sub="Total banned"
          icon={<Shield className="text-orange-500" size={24} />}
          color="orange"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        {user?.role === 'admin' && (
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Monthly Revenue</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Revenue']} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Stream Status Pie */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Stream Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={streamStatusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
              >
                {streamStatusData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Streams + Servers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Streams */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Streams (24h)</h3>
          <div className="space-y-3">
            {(data?.top_streams || []).slice(0, 8).map((s: any) => (
              <div key={s.id} className="flex items-center gap-3">
                {s.stream_icon && (
                  <img src={s.stream_icon} alt="" className="w-8 h-8 rounded object-contain bg-gray-100" onError={(e: any) => e.target.style.display='none'} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.name}</p>
                </div>
                <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 px-2 py-1 rounded-full">
                  {s.connection_count}
                </span>
              </div>
            ))}
            {(!data?.top_streams || data.top_streams.length === 0) && (
              <p className="text-sm text-gray-500">No data yet</p>
            )}
          </div>
        </div>

        {/* Servers */}
        {user?.role === 'admin' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Servers</h3>
            <div className="space-y-3">
              {(data?.servers || []).map((server: any) => (
                <div key={server.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${server.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{server.name}</p>
                      <p className="text-xs text-gray-500">{server.domain}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {server.total_clients}/{server.max_clients} clients
                    </p>
                    {server.cpu_load > 0 && (
                      <p className="text-xs text-gray-400">CPU: {server.cpu_load}%</p>
                    )}
                  </div>
                </div>
              ))}
              {(!data?.servers || data.servers.length === 0) && (
                <p className="text-sm text-gray-500">No servers configured</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Active Connections */}
      <ActiveConnectionsTable />

      {/* Recent Logins */}
      <RecentLoginsTable logins={data?.recent_logins || []} />
    </div>
  );
}
