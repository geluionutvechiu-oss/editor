import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, RefreshCw, Activity } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import type { Server } from '@/types';
import { socket } from '@/lib/socket';

const schema = z.object({
  name: z.string().min(1), url: z.string().url(), type: z.enum(['XTREAM', 'STALKER', 'M3U']),
  username: z.string().optional(), password: z.string().optional(),
  location: z.string().optional(), maxStreams: z.number().int().min(1).default(1000),
});
type FormData = z.infer<typeof schema>;

export default function ServersPage() {
  const qc = useQueryClient();
  const [editServer, setEditServer] = useState<Server | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [liveServers, setLiveServers] = useState<Record<string, Partial<Server>>>({});
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const { data: servers, isLoading } = useQuery<Server[]>({ queryKey: ['servers'], queryFn: () => api.get('/servers').then(r => r.data) });

  useEffect(() => {
    socket.on('server_stats', (stats: Server[]) => {
      const map: Record<string, Partial<Server>> = {};
      stats.forEach(s => { map[s.id] = s; });
      setLiveServers(map);
    });
    return () => { socket.off('server_stats'); };
  }, []);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { type: 'XTREAM', maxStreams: 1000 } });

  const createMutation = useMutation({
    mutationFn: (d: FormData) => api.post('/servers', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['servers'] }); toast({ title: 'Server added' }); setModalOpen(false); reset(); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) => api.put(`/servers/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['servers'] }); toast({ title: 'Server updated' }); setEditServer(null); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/servers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['servers'] }); toast({ title: 'Server deleted', variant: 'destructive' }); },
  });

  const checkHealth = async (id: string) => {
    setCheckingId(id);
    try {
      const { data } = await api.get(`/servers/${id}/health`);
      qc.invalidateQueries({ queryKey: ['servers'] });
      toast({ title: `Server ${data.status}`, description: data.latency ? `Latency: ${data.latency}ms` : undefined });
    } catch { toast({ title: 'Health check failed', variant: 'destructive' }); }
    finally { setCheckingId(null); }
  };

  const statusVariant = (s: string) => ({ ONLINE: 'online', OFFLINE: 'offline', DEGRADED: 'degraded' }[s] as 'online' | 'offline' | 'degraded' || 'default');

  const openEdit = (s: Server) => {
    setEditServer(s);
    setValue('name', s.name); setValue('url', s.url); setValue('type', s.type);
    setValue('username', s.username || ''); setValue('password', s.password || '');
    setValue('location', s.location || ''); setValue('maxStreams', s.maxStreams);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold">Servers</h2><p className="text-sm text-muted-foreground mt-1">IPTV streaming servers</p></div>
        <Button variant="gradient" size="sm" onClick={() => { reset(); setModalOpen(true); }}><Plus className="h-4 w-4 mr-2" />Add Server</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56" />) :
          servers?.map(server => {
            const live = liveServers[server.id];
            const activeStreams = live?.activeStreams ?? server.activeStreams;
            const pct = Math.min(100, (activeStreams / server.maxStreams) * 100);
            return (
              <Card key={server.id} className="relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-0.5 ${server.status === 'ONLINE' ? 'bg-green-400' : server.status === 'DEGRADED' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{server.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{server.location || server.url}</p>
                    </div>
                    <Badge variant={statusVariant(server.status)}>{server.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div><div className="text-lg font-bold">{activeStreams}</div><div className="text-[10px] text-muted-foreground">Active</div></div>
                    <div><div className="text-lg font-bold">{server.uptime.toFixed(1)}%</div><div className="text-[10px] text-muted-foreground">Uptime</div></div>
                    <div><div className="text-lg font-bold">{((live?.bandwidthMbps ?? server.bandwidthMbps) / 1000).toFixed(1)}G</div><div className="text-[10px] text-muted-foreground">Bandwidth</div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Stream capacity</span>
                      <span>{activeStreams}/{server.maxStreams}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full">
                      <div className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-400' : pct > 60 ? 'bg-yellow-400' : 'bg-green-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => checkHealth(server.id)} loading={checkingId === server.id}><Activity className="h-3.5 w-3.5 mr-1" />Check</Button>
                    <Button size="icon-sm" variant="outline" onClick={() => openEdit(server)}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button size="icon-sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => { if (confirm('Delete server?')) deleteMutation.mutate(server.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>

      <Dialog open={modalOpen || !!editServer} onOpenChange={() => { setModalOpen(false); setEditServer(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editServer ? 'Edit Server' : 'Add Server'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(d => editServer ? updateMutation.mutate({ id: editServer.id, data: d }) : createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Name</Label><Input {...register('name')} />{errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}</div>
              <div className="space-y-1.5"><Label>Type</Label>
                <Select defaultValue="XTREAM" onValueChange={(v) => setValue('type', v as 'XTREAM' | 'STALKER' | 'M3U')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="XTREAM">Xtream Codes</SelectItem><SelectItem value="STALKER">Stalker Portal</SelectItem><SelectItem value="M3U">M3U</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>URL</Label><Input {...register('url')} placeholder="http://server.example.com:8080" />{errors.url && <p className="text-xs text-red-400">{errors.url.message}</p>}</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Username</Label><Input {...register('username')} /></div>
              <div className="space-y-1.5"><Label>Password</Label><Input {...register('password')} type="password" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Location</Label><Input {...register('location')} placeholder="Amsterdam, NL" /></div>
              <div className="space-y-1.5"><Label>Max Streams</Label><Input type="number" {...register('maxStreams', { valueAsNumber: true })} /></div>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => { setModalOpen(false); setEditServer(null); }}>Cancel</Button>
              <Button type="submit" variant="gradient" loading={createMutation.isPending || updateMutation.isPending}>{editServer ? 'Save' : 'Add Server'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
