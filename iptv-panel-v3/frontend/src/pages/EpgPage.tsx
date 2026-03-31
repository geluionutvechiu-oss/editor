import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Rss, RefreshCw, Edit2, Trash2, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';

interface EpgSource {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  lastFetch?: string;
  fetchStatus?: 'SUCCESS' | 'ERROR' | 'PENDING' | 'NEVER';
  channelCount?: number;
  programCount?: number;
  fetchError?: string;
  autoFetch: boolean;
  fetchInterval: number;
}

function StatusBadge({ status }: { status?: EpgSource['fetchStatus'] }) {
  if (!status || status === 'NEVER') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-500/15 text-slate-400"><Clock className="h-3 w-3" />Never fetched</span>;
  if (status === 'PENDING') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/15 text-blue-400 animate-pulse"><RefreshCw className="h-3 w-3 animate-spin" />Fetching...</span>;
  if (status === 'SUCCESS') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/15 text-green-400"><CheckCircle className="h-3 w-3" />Success</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-400"><XCircle className="h-3 w-3" />Error</span>;
}

export default function EpgPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<EpgSource | null>(null);
  const [form, setForm] = useState({ name: '', url: '', autoFetch: true, fetchInterval: '24', isActive: true });

  const { data, isLoading } = useQuery<{ data: EpgSource[]; total: number }>({
    queryKey: ['epg-sources'],
    queryFn: () => api.get('/epg/sources').then(r => r.data),
    refetchInterval: 10000,
  });

  const saveMutation = useMutation({
    mutationFn: (d: any) => editItem ? api.put(`/epg/sources/${editItem.id}`, d) : api.post('/epg/sources', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['epg-sources'] }); setModalOpen(false); toast({ title: editItem ? 'EPG source updated' : 'EPG source added' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/epg/sources/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['epg-sources'] }); toast({ title: 'EPG source deleted' }); },
  });

  const fetchMutation = useMutation({
    mutationFn: (id: string) => api.post(`/epg/sources/${id}/fetch`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['epg-sources'] }); toast({ title: 'EPG fetch triggered', description: 'Fetching in the background...' }); },
  });

  const fetchAllMutation = useMutation({
    mutationFn: () => api.post('/epg/fetch-all'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['epg-sources'] }); toast({ title: 'Fetching all EPG sources', description: 'Running in background...' }); },
  });

  function openAdd() { setEditItem(null); setForm({ name: '', url: '', autoFetch: true, fetchInterval: '24', isActive: true }); setModalOpen(true); }
  function openEdit(e: EpgSource) {
    setEditItem(e);
    setForm({ name: e.name, url: e.url, autoFetch: e.autoFetch, fetchInterval: String(e.fetchInterval || 24), isActive: e.isActive });
    setModalOpen(true);
  }

  const totalChannels = data?.data.reduce((a, e) => a + (e.channelCount || 0), 0) ?? 0;
  const totalPrograms = data?.data.reduce((a, e) => a + (e.programCount || 0), 0) ?? 0;
  const successCount = data?.data.filter(e => e.fetchStatus === 'SUCCESS').length ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">EPG Sources</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage Electronic Program Guide XML sources</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-white/10 hover:bg-white/5"
            onClick={() => fetchAllMutation.mutate()}
            disabled={fetchAllMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${fetchAllMutation.isPending ? 'animate-spin' : ''}`} />
            Fetch All
          </Button>
          <Button onClick={openAdd} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0">
            <Plus className="h-4 w-4 mr-2" /> Add Source
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card stat-glow-blue">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">EPG Sources</p>
            <p className="text-2xl font-bold text-blue-400">{data?.total ?? '—'}</p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-glow-green">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">Successful</p>
            <p className="text-2xl font-bold text-green-400">{successCount}</p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-glow-purple">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">Channels Mapped</p>
            <p className="text-2xl font-bold text-purple-400">{totalChannels.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-glow-orange">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">Program Entries</p>
            <p className="text-2xl font-bold text-orange-400">{totalPrograms.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Rss className="h-4 w-4 text-blue-400" />
            EPG Sources
            <span className="ml-auto text-sm font-normal text-muted-foreground">{data?.total ?? 0} sources</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : (
            <div className="space-y-3">
              {data?.data.map(source => (
                <div key={source.id} className="glass rounded-xl p-4 hover:border-white/10 transition-colors group">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${source.isActive ? 'bg-blue-500/15' : 'bg-slate-500/15'}`}>
                      <Rss className={`h-5 w-5 ${source.isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-sm font-semibold">{source.name}</p>
                        <StatusBadge status={source.fetchStatus} />
                        {!source.isActive && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-500/15 text-slate-400">Disabled</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{source.url}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {source.channelCount !== undefined && <span>{source.channelCount.toLocaleString()} channels</span>}
                        {source.programCount !== undefined && <span>{source.programCount.toLocaleString()} programs</span>}
                        {source.lastFetch && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last fetch: {new Date(source.lastFetch).toLocaleString()}
                          </span>
                        )}
                        {source.autoFetch && <span>Auto-fetch every {source.fetchInterval}h</span>}
                      </div>
                      {source.fetchError && (
                        <div className="mt-2 flex items-start gap-1.5 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                          <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span className="truncate">{source.fetchError}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="outline" className="h-8 border-white/10 hover:bg-white/5 text-xs"
                        onClick={() => fetchMutation.mutate(source.id)}
                        disabled={fetchMutation.isPending || source.fetchStatus === 'PENDING'}>
                        <RefreshCw className={`h-3 w-3 mr-1 ${source.fetchStatus === 'PENDING' ? 'animate-spin' : ''}`} />
                        Fetch
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(source)}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400 hover:text-red-300" onClick={() => { if (confirm('Delete EPG source?')) deleteMutation.mutate(source.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </div>
              ))}
              {!data?.data.length && !isLoading && (
                <div className="text-center py-16 text-muted-foreground">
                  <Rss className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="mb-2">No EPG sources configured</p>
                  <p className="text-xs">Add XMLTV sources to provide program guide data</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="glass-card border-white/10 max-w-lg">
          <DialogHeader><DialogTitle>{editItem ? 'Edit EPG Source' : 'Add EPG Source'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input className="mt-1 bg-white/5 border-white/10" placeholder="e.g. tvguide.xml" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>XMLTV URL *</Label><Input className="mt-1 bg-white/5 border-white/10" placeholder="http://..." value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} /></div>
            <div>
              <Label>Fetch Interval (hours)</Label>
              <Input className="mt-1 bg-white/5 border-white/10" type="number" min="1" max="168" value={form.fetchInterval} onChange={e => setForm(p => ({ ...p, fetchInterval: e.target.value }))} />
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="autoFetch" checked={form.autoFetch} onChange={e => setForm(p => ({ ...p, autoFetch: e.target.checked }))} className="rounded" />
                <Label htmlFor="autoFetch">Auto-fetch</Label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="epgActive" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
                <Label htmlFor="epgActive">Active</Label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 border-0"
                onClick={() => saveMutation.mutate({ ...form, fetchInterval: parseInt(form.fetchInterval) || 24 })}
                disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save Source'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
