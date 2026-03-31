import { useQuery } from '@tanstack/react-query';
import { Users, Activity, DollarSign, Server, AlertTriangle, TrendingUp, Wifi, Clock } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import type { DashboardStats, ChartData, Server as IServer } from '@/types';
import { format, formatDistanceToNow } from 'date-fns';
import { getSocket } from '@/lib/socket';

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.07 } },
};

interface StatCardProps {
  title: string;
  value: string | number;
  subLabel?: string;
  icon: React.ReactNode;
  color: string;
  glow: string;
  loading?: boolean;
  trend?: number;
}

function StatCard({ title, value, subLabel, icon, color, glow, loading, trend }: StatCardProps) {
  return (
    <motion.div variants={fadeInUp}>
      <motion.div
        className="glass-card p-5 relative overflow-hidden group cursor-default"
        style={{ boxShadow: `0 0 30px ${glow}, 0 4px 20px rgba(0,0,0,0.3)` }}
        whileHover={{ y: -3, boxShadow: `0 0 50px ${glow}, 0 8px 30px rgba(0,0,0,0.4)` }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {/* Gradient background shimmer */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: `radial-gradient(circle at 70% 50%, ${glow} 0%, transparent 60%)` }} />

        <div className="relative">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
              <span style={{ color }}>{icon}</span>
            </div>
            {trend !== undefined && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-24 mt-1" />
          ) : (
            <p className="text-3xl font-bold tracking-tight text-white">{value}</p>
          )}
          {subLabel && !loading && (
            <p className="text-xs text-muted-foreground mt-1.5">{subLabel}</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

const customTooltipStyle = {
  background: 'rgba(9,14,28,0.95)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  color: '#f1f5f9',
  backdropFilter: 'blur(16px)',
  fontSize: 12,
};

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
    queryFn: () => api.get('/dashboard/audit-logs?limit=8').then(r => r.data),
  });

  useEffect(() => {
    try {
      getSocket().on('server_stats', (servers: IServer[]) => setLiveServers(servers));
      return () => { getSocket().off('server_stats'); };
    } catch { return undefined; }
  }, []);

  const servers = liveServers.length > 0 ? liveServers : (stats?.servers || []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tablou de Bord</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Monitorizare în timp real a sistemului IPTV</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="pulse-dot" />
          <span>Live</span>
        </div>
      </div>

      {/* Expiring alert */}
      {(stats?.clients.expiringSoon ?? 0) > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl border"
          style={{ borderColor: 'rgba(234,179,8,0.3)', background: 'rgba(234,179,8,0.06)' }}
        >
          <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0" />
          <span className="text-sm text-yellow-400 font-medium">
            {stats!.clients.expiringSoon} abonamente expiră în următoarele 7 zile
          </span>
        </motion.div>
      )}

      {/* Stats grid */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        <StatCard
          title="Total Clienți"
          value={stats?.clients.total ?? '—'}
          icon={<Users className="h-5 w-5" />}
          color="#60a5fa"
          glow="rgba(96,165,250,0.15)"
          subLabel={`${stats?.clients.active ?? 0} activi`}
          loading={statsLoading}
          trend={12}
        />
        <StatCard
          title="Online Acum"
          value={stats?.clients.active ?? '—'}
          icon={<Activity className="h-5 w-5" />}
          color="#34d399"
          glow="rgba(52,211,153,0.15)"
          subLabel={`${stats?.clients.expiringSoon ?? 0} expiră în curând`}
          loading={statsLoading}
        />
        <StatCard
          title="Venit Lunar"
          value={stats ? `$${stats.revenue.mrr.toFixed(2)}` : '—'}
          icon={<DollarSign className="h-5 w-5" />}
          color="#a78bfa"
          glow="rgba(167,139,250,0.15)"
          subLabel={`ARR $${stats?.revenue.arr.toFixed(0) ?? '0'}`}
          loading={statsLoading}
          trend={8}
        />
        <StatCard
          title="Servere"
          value={servers.length || '—'}
          icon={<Server className="h-5 w-5" />}
          color="#fb923c"
          glow="rgba(251,146,60,0.15)"
          subLabel={`${servers.filter(s => s.status === 'ONLINE').length} online`}
          loading={statsLoading}
        />
      </motion.div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="h-4 w-4 text-blue-400" />
                Clienți Noi — Ultimele 30 Zile
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartLoading ? <Skeleton className="h-48" /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData?.clientsByDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} interval={6} />
                    <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={customTooltipStyle} />
                    <Area type="monotone" dataKey="count" stroke="#60a5fa" strokeWidth={2} fill="url(#blueGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <DollarSign className="h-4 w-4 text-purple-400" />
                Venituri — Ultimele 6 Luni
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartLoading ? <Skeleton className="h-48" /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData?.revenueByMonth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={customTooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Venituri']} />
                    <Bar dataKey="revenue" fill="url(#purpleGrad)" radius={[4, 4, 0, 0]} />
                    <defs>
                      <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" />
                        <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Server status */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="glass-card h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Server className="h-4 w-4 text-orange-400" />
                Status Servere
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {servers.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">Niciun server configurat</div>
              ) : servers.map((s) => (
                <div key={s.id} className="space-y-2 pb-3 border-b border-white/[0.04] last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${s.status === 'ONLINE' ? 'bg-green-400 pulse-online' : s.status === 'DEGRADED' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                      <span className="text-sm font-medium truncate max-w-[120px]">{s.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">{s.activeStreams}/{s.maxStreams}</span>
                  </div>
                  <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: s.status === 'ONLINE' ? 'linear-gradient(90deg, #60a5fa, #a78bfa)' : '#ef4444' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (s.activeStreams / (s.maxStreams || 1)) * 100)}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Client breakdown */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="glass-card h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-blue-400" />
                Distribuție Clienți
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {statsLoading ? <Skeleton className="h-32" /> : (
                <>
                  {[
                    { label: 'Activi', value: stats?.clients.active ?? 0, color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
                    { label: 'Suspendați', value: stats?.clients.suspended ?? 0, color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
                    { label: 'Expirați', value: stats?.clients.expired ?? 0, color: '#fb923c', bg: 'rgba(251,146,60,0.15)' },
                  ].map(({ label, value, color, bg }) => {
                    const total = stats?.clients.total || 1;
                    const pct = Math.round((value / total) * 100);
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-sm mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                            <span className="text-muted-foreground">{label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{value}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded-md font-medium" style={{ background: bg, color }}>{pct}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.4 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent activity */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="glass-card h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-slate-400" />
                Activitate Recentă
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {logsLoading ? <Skeleton className="h-32" /> : auditLogs?.data?.slice(0, 7).map((log: { id: string; action: string; user?: { username: string }; ip?: string; createdAt: string }, idx: number) => (
                <motion.div
                  key={log.id}
                  className="flex items-start gap-3 py-2.5 border-b last:border-0"
                  style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + idx * 0.05 }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60 mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate text-slate-300">{log.action}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {log.user?.username || 'System'} · {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                </motion.div>
              ))}
              {!logsLoading && !auditLogs?.data?.length && (
                <div className="text-center py-6 text-muted-foreground text-sm">Nicio activitate recentă</div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
