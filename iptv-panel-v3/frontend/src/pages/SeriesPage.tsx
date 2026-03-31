import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Tv, Search, Edit2, Trash2, ChevronDown, ChevronRight, Film, Star } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';

interface Episode {
  id: string;
  title: string;
  season: number;
  episode: number;
  streamUrl: string;
  duration?: number;
}

interface Series {
  id: string;
  name: string;
  icon?: string;
  cover?: string;
  description?: string;
  releaseYear?: number;
  rating?: number;
  genre: string[];
  isActive: boolean;
  category?: { name: string };
  episodeCount: number;
  views: number;
  episodes?: Episode[];
}

export default function SeriesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [epModalOpen, setEpModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Series | null>(null);
  const [editEp, setEditEp] = useState<Episode | null>(null);
  const [activeSeriesId, setActiveSeriesId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', icon: '', cover: '', description: '', releaseYear: '', rating: '', isActive: true });
  const [epForm, setEpForm] = useState({ title: '', season: '1', episode: '1', streamUrl: '', duration: '' });

  const { data, isLoading } = useQuery<{ data: Series[]; total: number }>({
    queryKey: ['series', search],
    queryFn: () => api.get(`/series?search=${search}&limit=50`).then(r => r.data),
  });

  const { data: episodesData } = useQuery<{ data: Episode[] }>({
    queryKey: ['episodes', expanded],
    queryFn: () => api.get(`/series/${expanded}/episodes`).then(r => r.data),
    enabled: !!expanded,
  });

  const saveSeries = useMutation({
    mutationFn: (d: any) => editItem ? api.put(`/series/${editItem.id}`, d) : api.post('/series', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['series'] }); setModalOpen(false); toast({ title: editItem ? 'Series updated' : 'Series created' }); },
  });

  const deleteSeries = useMutation({
    mutationFn: (id: string) => api.delete(`/series/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['series'] }); toast({ title: 'Series deleted' }); },
  });

  const saveEpisode = useMutation({
    mutationFn: (d: any) => editEp
      ? api.put(`/series/${activeSeriesId}/episodes/${editEp.id}`, d)
      : api.post(`/series/${activeSeriesId}/episodes`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['episodes', activeSeriesId] }); setEpModalOpen(false); toast({ title: editEp ? 'Episode updated' : 'Episode added' }); },
  });

  const deleteEpisode = useMutation({
    mutationFn: ({ seriesId, epId }: { seriesId: string; epId: string }) => api.delete(`/series/${seriesId}/episodes/${epId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['episodes', activeSeriesId] }); toast({ title: 'Episode deleted' }); },
  });

  function openAddSeries() {
    setEditItem(null);
    setForm({ name: '', icon: '', cover: '', description: '', releaseYear: '', rating: '', isActive: true });
    setModalOpen(true);
  }

  function openEditSeries(s: Series) {
    setEditItem(s);
    setForm({ name: s.name, icon: s.icon || '', cover: s.cover || '', description: s.description || '', releaseYear: String(s.releaseYear || ''), rating: String(s.rating || ''), isActive: s.isActive });
    setModalOpen(true);
  }

  function openAddEp(seriesId: string) {
    setActiveSeriesId(seriesId);
    setEditEp(null);
    setEpForm({ title: '', season: '1', episode: '1', streamUrl: '', duration: '' });
    setEpModalOpen(true);
  }

  function openEditEp(seriesId: string, ep: Episode) {
    setActiveSeriesId(seriesId);
    setEditEp(ep);
    setEpForm({ title: ep.title, season: String(ep.season), episode: String(ep.episode), streamUrl: ep.streamUrl, duration: String(ep.duration || '') });
    setEpModalOpen(true);
  }

  // Group episodes by season
  const groupedEpisodes = episodesData?.data.reduce((acc: Record<number, Episode[]>, ep) => {
    if (!acc[ep.season]) acc[ep.season] = [];
    acc[ep.season].push(ep);
    return acc;
  }, {}) ?? {};

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Series</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage TV series and episode libraries</p>
        </div>
        <Button onClick={openAddSeries} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0">
          <Plus className="h-4 w-4 mr-2" /> Add Series
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card stat-glow-blue">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">Total Series</p>
            <p className="text-2xl font-bold text-blue-400">{data?.total ?? '—'}</p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-glow-green">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">Active</p>
            <p className="text-2xl font-bold text-green-400">{data?.data.filter(s => s.isActive).length ?? '—'}</p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-glow-purple">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">Total Episodes</p>
            <p className="text-2xl font-bold text-purple-400">{data?.data.reduce((a, s) => a + (s.episodeCount || 0), 0) ?? '—'}</p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-glow-orange">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">Total Views</p>
            <p className="text-2xl font-bold text-orange-400">{data?.data.reduce((a, s) => a + (s.views || 0), 0).toLocaleString() ?? '—'}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search series..." className="pl-9 bg-white/5 border-white/10" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <CardTitle className="ml-auto text-sm text-muted-foreground">{data?.total ?? 0} series</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (
            <div className="space-y-2">
              {data?.data.map(series => (
                <div key={series.id} className="glass rounded-xl overflow-hidden">
                  {/* Series Row */}
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/[0.03] transition-colors group"
                    onClick={() => setExpanded(expanded === series.id ? null : series.id)}
                  >
                    <button className="text-muted-foreground flex-shrink-0">
                      {expanded === series.id
                        ? <ChevronDown className="h-4 w-4 text-blue-400" />
                        : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="w-10 h-14 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {series.icon ? (
                        <img src={series.icon} alt={series.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <Tv className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate group-hover:text-blue-400 transition-colors">{series.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {series.releaseYear && <span className="text-xs text-muted-foreground">{series.releaseYear}</span>}
                        {series.rating && (
                          <span className="text-xs text-yellow-400 flex items-center gap-0.5">
                            <Star className="h-3 w-3" />{series.rating}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">{series.episodeCount} episodes</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${series.isActive ? 'bg-green-500/15 text-green-400' : 'bg-slate-500/15 text-slate-400'}`}>
                          {series.isActive ? 'Active' : 'Hidden'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={e => { e.stopPropagation(); openAddEp(series.id); }}>
                        <Plus className="h-3 w-3 mr-1" />Episode
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={e => { e.stopPropagation(); openEditSeries(series); }}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:text-red-300"
                        onClick={e => { e.stopPropagation(); if (confirm('Delete series?')) deleteSeries.mutate(series.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Episodes Panel */}
                  {expanded === series.id && (
                    <div className="border-t border-white/[0.05] bg-black/20 px-4 py-3">
                      {Object.entries(groupedEpisodes).sort(([a], [b]) => Number(a) - Number(b)).map(([season, episodes]) => (
                        <div key={season} className="mb-4">
                          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Season {season}</p>
                          <div className="space-y-1">
                            {(episodes as Episode[]).sort((a, b) => a.episode - b.episode).map(ep => (
                              <div key={ep.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] group/ep transition-colors">
                                <span className="text-xs text-muted-foreground w-16 flex-shrink-0">S{ep.season}E{ep.episode.toString().padStart(2, '0')}</span>
                                <Film className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-sm flex-1 truncate">{ep.title}</span>
                                {ep.duration && <span className="text-xs text-muted-foreground">{Math.floor(ep.duration / 60)}m</span>}
                                <div className="flex gap-1 opacity-0 group-hover/ep:opacity-100 transition-opacity">
                                  <Button size="sm" variant="ghost" className="h-6 text-xs py-0 px-2"
                                    onClick={() => openEditEp(series.id, ep)}>
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-6 text-xs py-0 px-2 text-red-400 hover:text-red-300"
                                    onClick={() => { if (confirm('Delete episode?')) deleteEpisode.mutate({ seriesId: series.id, epId: ep.id }); }}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {(!episodesData?.data.length) && (
                        <div className="text-center py-6 text-muted-foreground text-sm">
                          No episodes yet.{' '}
                          <button className="text-blue-400 hover:text-blue-300" onClick={() => openAddEp(series.id)}>Add first episode</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {!data?.data.length && !isLoading && (
                <div className="text-center py-16 text-muted-foreground">
                  <Tv className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No series found</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Series Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="glass-card border-white/10 max-w-lg">
          <DialogHeader><DialogTitle>{editItem ? 'Edit Series' : 'Add Series'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input className="mt-1 bg-white/5 border-white/10" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Poster URL</Label><Input className="mt-1 bg-white/5 border-white/10" value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} /></div>
            <div><Label>Backdrop / Cover URL</Label><Input className="mt-1 bg-white/5 border-white/10" value={form.cover} onChange={e => setForm(p => ({ ...p, cover: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Release Year</Label><Input className="mt-1 bg-white/5 border-white/10" type="number" value={form.releaseYear} onChange={e => setForm(p => ({ ...p, releaseYear: e.target.value }))} /></div>
              <div><Label>Rating (0–10)</Label><Input className="mt-1 bg-white/5 border-white/10" type="number" step="0.1" value={form.rating} onChange={e => setForm(p => ({ ...p, rating: e.target.value }))} /></div>
            </div>
            <div><Label>Description</Label><textarea className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground resize-none h-20 focus:outline-none focus:ring-1 focus:ring-blue-500" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="seriesActive" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
              <Label htmlFor="seriesActive">Active (visible to users)</Label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 border-0"
                onClick={() => saveSeries.mutate({ ...form, releaseYear: form.releaseYear ? parseInt(form.releaseYear) : undefined, rating: form.rating ? parseFloat(form.rating) : undefined })}
                disabled={saveSeries.isPending}>
                {saveSeries.isPending ? 'Saving...' : 'Save Series'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Episode Modal */}
      <Dialog open={epModalOpen} onOpenChange={setEpModalOpen}>
        <DialogContent className="glass-card border-white/10 max-w-lg">
          <DialogHeader><DialogTitle>{editEp ? 'Edit Episode' : 'Add Episode'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input className="mt-1 bg-white/5 border-white/10" value={epForm.title} onChange={e => setEpForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Season</Label><Input className="mt-1 bg-white/5 border-white/10" type="number" min="1" value={epForm.season} onChange={e => setEpForm(p => ({ ...p, season: e.target.value }))} /></div>
              <div><Label>Episode</Label><Input className="mt-1 bg-white/5 border-white/10" type="number" min="1" value={epForm.episode} onChange={e => setEpForm(p => ({ ...p, episode: e.target.value }))} /></div>
              <div><Label>Duration (s)</Label><Input className="mt-1 bg-white/5 border-white/10" type="number" value={epForm.duration} onChange={e => setEpForm(p => ({ ...p, duration: e.target.value }))} /></div>
            </div>
            <div><Label>Stream URL *</Label><Input className="mt-1 bg-white/5 border-white/10" placeholder="http://..." value={epForm.streamUrl} onChange={e => setEpForm(p => ({ ...p, streamUrl: e.target.value }))} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setEpModalOpen(false)}>Cancel</Button>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 border-0"
                onClick={() => saveEpisode.mutate({ ...epForm, season: parseInt(epForm.season), episode: parseInt(epForm.episode), duration: epForm.duration ? parseInt(epForm.duration) : undefined })}
                disabled={saveEpisode.isPending}>
                {saveEpisode.isPending ? 'Saving...' : 'Save Episode'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
