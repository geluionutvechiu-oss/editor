import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, Users, Wifi, Globe, X, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import api from '@/lib/api';

interface Connection { id: string; username: string; ipAddress: string; userAgent?: string; streamName?: string; country?: string; bandwidth: number; connectedAt: string; lastSeen: string; }

const countryFlag = (code?: string) => {
  if (!code || code.length !== 2) return '🌐';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(0x1F1E0 + c.charCodeAt(0) - 65));
};

export default function LiveConnectionsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading, dataUpdatedAt } = useQuery<{ data: Connection[]; total: number }>({
    queryKey: ['connections', search],
    queryFn: () => api.get(`/connections?search=${search}&limit=100`).then(r => r.data),
    refetchInterval: 5000,
  });

  const { data: stats } = useQuery<{ total: number; byCountry: any[]; totalBandwidth: number }>({
    queryKey: ['connections-stats'],
    queryFn: () => api.get('/connections/stats/overview').then(r => r.data),
    refetchInterval: 5000,
  });

  const killMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/connections/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['connections'] }); toast({ title: 'Connection terminated' }); },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Live Connections
            <span className="inline-flex items-center gap-1.5 text-sm font-normal text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-0.5">
              <span className="pulse-dot" />
              Live
            </span>
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Active streams · updates every 5s · last {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—'}</p>
        </div>
        <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10" onClick={() => qc.invalidateQueries({ queryKey: ['connections'] })}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card stat-glow-green">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1"><Activity className="h-3 w-3" /> Active Now</p>
            <p className="text-3xl font-bold text-green-400">{stats?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-glow-blue">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1"><Wifi className="h-3 w-3" /> Bandwidth</p>
            <p className="text-3xl font-bold text-blue-400">{stats ? (stats.totalBandwidth).toFixed(1) : 0}<span className="text-sm font-normal text-muted-foreground ml-1">Mbps</span></p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-glow-purple">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1"><Globe className="h-3 w-3" /> Countries</p>
            <p className="text-3xl font-bold text-purple-400">{stats?.byCountry.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-glow-orange">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">Top Country</p>
            <p className="text-xl font-bold text-orange-400">
              {stats?.byCountry[0] ? `${countryFlag(stats.byCountry[0].country)} ${stats.byCountry[0]._count}` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="glass-card lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Input placeholder="Search by username or IP..." className="max-w-sm bg-white/5 border-white/10" value={search} onChange={e => setSearch(e.target.value)} />
              <CardTitle className="ml-auto text-sm text-muted-foreground">{data?.total ?? 0} active</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="space-y-2">{Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-12" />)}</div> : data?.total === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No active connections</p>
              </div>
            ) : (
              <div className="space-y-1">
                {data?.data.map(conn => (
                  <div key={conn.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors group border border-transparent hover:border-white/[0.05]">
                    <span className="text-lg flex-shrink-0">{countryFlag(conn.country)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-blue-400">{conn.username}</span>
                        <span className="text-xs text-muted-foreground font-mono">{conn.ipAddress}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {conn.streamName && <span className="text-xs text-muted-foreground truncate max-w-[200px]">▶ {conn.streamName}</span>}
                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(conn.connectedAt), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-mono text-green-400">{conn.bandwidth.toFixed(1)} Mbps</p>
                      <p className="text-[10px] text-muted-foreground">{conn.userAgent?.substring(0, 20) || 'Unknown'}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-500/10 flex-shrink-0"
                      onClick={() => killMutation.mutate(conn.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3"><CardTitle className="text-sm">By Country</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats?.byCountry.map((c: any) => (
                <div key={c.country} className="flex items-center gap-2">
                  <span className="text-base">{countryFlag(c.country)}</span>
                  <span className="text-xs text-muted-foreground flex-1">{c.country || 'Unknown'}</span>
                  <span className="text-xs font-semibold">{c._count}</span>
                  <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (c._count / (stats?.total || 1)) * 100)}%` }} />
                  </div>
                </div>
              ))}
              {!stats?.byCountry.length && <p className="text-xs text-muted-foreground text-center py-4">No data</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
