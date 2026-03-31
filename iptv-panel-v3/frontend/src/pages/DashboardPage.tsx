import { useQuery } from '@tanstack/react-query';
import { Users, Activity, DollarSign, Server, AlertTriangle, TrendingUp } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import type { DashboardStats, ChartData, Server as IServer } from '@/types';
import { format } from 'date-fns';
import { getSocket } from '@/lib/socket';

export default function DashboardPage() {
  const [liveServers, setLiveServers] = useState<IServer[]>([]);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: chartData, isLoading: chartLoading } = useQuery<ChartData>({
    queryKey: ['dashboard-charts'],
    queryFn: () => api.get('/dashboard/chart-data').then(r => r.data),
  });

  const { data: auditLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['dashboard-audit-logs'],
    queryFn: () => api.get('/dashboard/audit-logs?limit=10').then(r => r.data),
  });

  useEffect(() => {
    getSocket().on('server_stats', (servers: IServer[]) => setLiveServers(servers));
    return () => { getSocket().off('server_stats'); };
  }, []);

  const servers = liveServers.length > 0 ? liveServers : (stats?.servers || []);

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Clients" value={stats?.clients.total ?? '—'} icon={<Users className="h-5 w-5" />} iconColor="text-blue-400" subLabel={`${stats?.clients.active ?? 0} active`} loading={statsLoading} />
        <StatCard title="Active Now" value={stats?.clients.active ?? '—'} icon={<Activity className="h-5 w-5" />} iconColor="text-green-400" subLabel={`${stats?.clients.expiringSoon ?? 0} expiring soon`} loading={statsLoading} />
        <StatCard title="Monthly Revenue" value={stats ? `$${stats.revenue.mrr.toFixed(2)}` : '—'} icon={<DollarSign className="h-5 w-5" />} iconColor="text-purple-400" subLabel={`ARR $${stats?.revenue.arr.toFixed(0) ?? '0'}`} loading={statsLoading} />
        <StatCard title="Servers" value={servers.length} icon={<Server className="h-5 w-5" />} iconColor="text-orange-400" subLabel={`${servers.filter(s => s.status === 'ONLINE').length} online`} loading={statsLoading} />
      </div>

      {/* Expiring alert */}
      {(stats?.clients.expiringSoon ?? 0) > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-400">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-medium">{stats!.clients.expiringSoon} clients expire in the next 7 days</span>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-400" />New Clients — Last 30 Days</CardTitle></CardHeader>
          <CardContent>
            {chartLoading ? <Skeleton className="h-48" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData?.clientsByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} interval={4} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#f1f5f9' }} />
                  <Line type="monotone" dataKey="count" stroke="#60a5fa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-purple-400" />Revenue — Last 6 Months</CardTitle></CardHeader>
          <CardContent>
            {chartLoading ? <Skeleton className="h-48" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData?.revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#f1f5f9' }} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="url(#purpleGrad)" radius={[4, 4, 0, 0]} />
                  <defs>
                    <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" />
                      <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Server status */}
        <Card>
          <CardHeader><CardTitle>Server Status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {servers.length === 0 ? <div className="text-sm text-muted-foreground">No servers configured</div> : servers.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${s.status === 'ONLINE' ? 'bg-green-400 status-pulse' : s.status === 'DEGRADED' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                  <span className="text-sm font-medium truncate max-w-[120px]">{s.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">{s.activeStreams}/{s.maxStreams}</div>
                  <div className="w-16 h-1 bg-slate-800 rounded-full mt-1">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(100, (s.activeStreams / s.maxStreams) * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Client breakdown */}
        <Card>
          <CardHeader><CardTitle>Client Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {statsLoading ? <Skeleton className="h-32" /> : (
              <>
                {[
                  { label: 'Active', value: stats?.clients.active ?? 0, color: 'bg-green-400' },
                  { label: 'Suspended', value: stats?.clients.suspended ?? 0, color: 'bg-red-400' },
                  { label: 'Expired', value: stats?.clients.expired ?? 0, color: 'bg-orange-400' },
                ].map(({ label, value, color }) => {
                  const total = stats?.clients.total || 1;
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full">
                        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${(value / total) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {logsLoading ? <Skeleton className="h-32" /> : auditLogs?.data?.slice(0, 6).map((log: { id: string; action: string; user?: { username: string }; ip?: string; createdAt: string }) => (
              <div key={log.id} className="flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{log.action}</div>
                  <div className="text-xs text-muted-foreground">{log.user?.username || 'System'} · {format(new Date(log.createdAt), 'HH:mm')}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
