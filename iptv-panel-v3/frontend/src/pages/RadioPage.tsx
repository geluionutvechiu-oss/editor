import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Radio, Search, Edit2, Trash2, Globe, Music } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';

interface RadioStream {
  id: string;
  name: string;
  streamUrl: string;
  icon?: string;
  country?: string;
  genre?: string;
  bitrate?: number;
  isActive: boolean;
  listeners: number;
}

const GENRES = ['Pop', 'Rock', 'Jazz', 'Classical', 'Electronic', 'Hip Hop', 'R&B', 'Country', 'News', 'Sports', 'Talk', 'Other'];

export default function RadioPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<RadioStream | null>(null);
  const [form, setForm] = useState({ name: '', streamUrl: '', icon: '', country: '', genre: '', bitrate: '', isActive: true });

  const { data, isLoading } = useQuery<{ data: RadioStream[]; total: number }>({
    queryKey: ['radio', search, filterGenre, filterCountry],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      if (filterGenre) params.set('genre', filterGenre);
      if (filterCountry) params.set('country', filterCountry);
      return api.get(`/radio?${params}`).then(r => r.data);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (d: any) => editItem ? api.put(`/radio/${editItem.id}`, d) : api.post('/radio', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['radio'] }); setModalOpen(false); toast({ title: editItem ? 'Station updated' : 'Station added' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/radio/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['radio'] }); toast({ title: 'Station deleted' }); },
  });

  function openAdd() { setEditItem(null); setForm({ name: '', streamUrl: '', icon: '', country: '', genre: '', bitrate: '', isActive: true }); setModalOpen(true); }
  function openEdit(r: RadioStream) { setEditItem(r); setForm({ name: r.name, streamUrl: r.streamUrl, icon: r.icon || '', country: r.country || '', genre: r.genre || '', bitrate: String(r.bitrate || ''), isActive: r.isActive }); setModalOpen(true); }

  const countries = [...new Set(data?.data.map(r => r.country).filter(Boolean) as string[])].sort();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Radio Streams</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage internet radio stations and streams</p>
        </div>
        <Button onClick={openAdd} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0">
          <Plus className="h-4 w-4 mr-2" /> Add Station
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card stat-glow-blue">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">Total Stations</p>
            <p className="text-2xl font-bold text-blue-400">{data?.total ?? '—'}</p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-glow-green">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">Active</p>
            <p className="text-2xl font-bold text-green-400">{data?.data.filter(r => r.isActive).length ?? '—'}</p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-glow-purple">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">Countries</p>
            <p className="text-2xl font-bold text-purple-400">{countries.length}</p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-glow-orange">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">Live Listeners</p>
            <p className="text-2xl font-bold text-orange-400">{data?.data.reduce((a, r) => a + (r.listeners || 0), 0) ?? '—'}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search stations..." className="pl-9 bg-white/5 border-white/10" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={filterGenre}
              onChange={e => setFilterGenre(e.target.value)}
            >
              <option value="">All Genres</option>
              {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={filterCountry}
              onChange={e => setFilterCountry(e.target.value)}
            >
              <option value="">All Countries</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <CardTitle className="ml-auto text-sm text-muted-foreground">{data?.total ?? 0} stations</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-3 pb-2 text-xs text-muted-foreground uppercase tracking-wider">
                <div className="w-8" />
                <div>Station</div>
                <div className="w-24">Genre</div>
                <div className="w-20">Country</div>
                <div className="w-16 text-right">Bitrate</div>
                <div className="w-16 text-right">Actions</div>
              </div>
              {data?.data.map(station => (
                <div key={station.id} className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 items-center px-3 py-2.5 rounded-lg table-row-hover group transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {station.icon ? (
                      <img src={station.icon} alt={station.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <Radio className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{station.name}</p>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${station.isActive ? 'bg-green-500/15 text-green-400' : 'bg-slate-500/15 text-slate-400'}`}>
                        {station.isActive ? 'Live' : 'Offline'}
                      </span>
                      {station.listeners > 0 && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Music className="h-2.5 w-2.5" />{station.listeners}</span>}
                    </div>
                  </div>
                  <div className="w-24">
                    {station.genre ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">{station.genre}</span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                  <div className="w-20">
                    {station.country ? (
                      <span className="text-xs flex items-center gap-1 text-muted-foreground"><Globe className="h-3 w-3" />{station.country}</span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                  <div className="w-16 text-right">
                    {station.bitrate ? <span className="text-xs text-muted-foreground">{station.bitrate}kbps</span> : <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                  <div className="w-16 flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(station)}><Edit2 className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" onClick={() => { if (confirm('Delete station?')) deleteMutation.mutate(station.id); }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
              {!data?.data.length && !isLoading && (
                <div className="text-center py-16 text-muted-foreground">
                  <Radio className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No radio stations found</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="glass-card border-white/10 max-w-lg">
          <DialogHeader><DialogTitle>{editItem ? 'Edit Station' : 'Add Station'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input className="mt-1 bg-white/5 border-white/10" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Stream URL *</Label><Input className="mt-1 bg-white/5 border-white/10" placeholder="http://..." value={form.streamUrl} onChange={e => setForm(p => ({ ...p, streamUrl: e.target.value }))} /></div>
            <div><Label>Logo URL</Label><Input className="mt-1 bg-white/5 border-white/10" value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Genre</Label>
                <select className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={form.genre} onChange={e => setForm(p => ({ ...p, genre: e.target.value }))}>
                  <option value="">Select genre</option>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div><Label>Country</Label><Input className="mt-1 bg-white/5 border-white/10" placeholder="e.g. United States" value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} /></div>
            </div>
            <div><Label>Bitrate (kbps)</Label><Input className="mt-1 bg-white/5 border-white/10" type="number" value={form.bitrate} onChange={e => setForm(p => ({ ...p, bitrate: e.target.value }))} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="radioActive" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
              <Label htmlFor="radioActive">Active</Label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 border-0"
                onClick={() => saveMutation.mutate({ ...form, bitrate: form.bitrate ? parseInt(form.bitrate) : undefined })}
                disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save Station'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
