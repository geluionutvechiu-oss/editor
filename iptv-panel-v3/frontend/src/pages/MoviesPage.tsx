import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Film, Search, Edit2, Trash2, Star } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';

interface Movie {
  id: string;
  name: string;
  streamUrl: string;
  icon?: string;
  description?: string;
  releaseYear?: number;
  rating?: number;
  genre: string[];
  isActive: boolean;
  category?: { name: string };
  views: number;
}

export default function MoviesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Movie | null>(null);
  const [form, setForm] = useState({
    name: '',
    streamUrl: '',
    icon: '',
    description: '',
    releaseYear: '',
    rating: '',
    isActive: true,
  });

  const { data, isLoading } = useQuery<{ data: Movie[]; total: number }>({
    queryKey: ['movies', search],
    queryFn: () => api.get(`/movies?search=${search}&limit=50`).then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (d: any) =>
      editItem ? api.put(`/movies/${editItem.id}`, d) : api.post('/movies', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movies'] });
      setModalOpen(false);
      toast({ title: editItem ? 'Movie updated' : 'Movie added' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/movies/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movies'] });
      toast({ title: 'Movie deleted' });
    },
  });

  function openAdd() {
    setEditItem(null);
    setForm({ name: '', streamUrl: '', icon: '', description: '', releaseYear: '', rating: '', isActive: true });
    setModalOpen(true);
  }

  function openEdit(m: Movie) {
    setEditItem(m);
    setForm({
      name: m.name,
      streamUrl: m.streamUrl,
      icon: m.icon || '',
      description: m.description || '',
      releaseYear: String(m.releaseYear || ''),
      rating: String(m.rating || ''),
      isActive: m.isActive,
    });
    setModalOpen(true);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Movies / VOD</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your Video on Demand library</p>
        </div>
        <Button
          onClick={openAdd}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0"
        >
          <Plus className="h-4 w-4 mr-2" /> Add Movie
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card stat-glow-blue">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">Total Movies</p>
            <p className="text-2xl font-bold text-blue-400">{data?.total ?? '—'}</p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-glow-green">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">Active</p>
            <p className="text-2xl font-bold text-green-400">{data?.data.filter(m => m.isActive).length ?? '—'}</p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-glow-purple">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">Total Views</p>
            <p className="text-2xl font-bold text-purple-400">
              {data?.data.reduce((a, m) => a + (m.views || 0), 0).toLocaleString() ?? '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-glow-orange">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">Hidden</p>
            <p className="text-2xl font-bold text-orange-400">
              {data?.data.filter(m => !m.isActive).length ?? '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search movies..."
                className="pl-9 bg-white/5 border-white/10"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <CardTitle className="ml-auto text-sm text-muted-foreground">{data?.total ?? 0} movies</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {data?.data.map(movie => (
                <div
                  key={movie.id}
                  className="glass rounded-xl p-3 glass-hover group cursor-pointer"
                  onClick={() => openEdit(movie)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-16 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {movie.icon ? (
                        <img
                          src={movie.icon}
                          alt={movie.name}
                          className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <Film className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-blue-400 transition-colors">{movie.name}</p>
                      <p className="text-xs text-muted-foreground">{movie.releaseYear || '—'}</p>
                      {movie.rating && (
                        <p className="text-xs text-yellow-400 flex items-center gap-1 mt-1">
                          <Star className="h-3 w-3" />{movie.rating}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${movie.isActive ? 'bg-green-500/15 text-green-400' : 'bg-slate-500/15 text-slate-400'}`}>
                          {movie.isActive ? 'Active' : 'Hidden'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{movie.views} views</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs flex-1"
                      onClick={e => { e.stopPropagation(); openEdit(movie); }}
                    >
                      <Edit2 className="h-3 w-3 mr-1" />Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs text-red-400 hover:text-red-300"
                      onClick={e => { e.stopPropagation(); if (confirm('Delete this movie?')) deleteMutation.mutate(movie.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="glass-card border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Movie' : 'Add Movie'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                className="mt-1 bg-white/5 border-white/10"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Stream URL *</Label>
              <Input
                className="mt-1 bg-white/5 border-white/10"
                placeholder="http://..."
                value={form.streamUrl}
                onChange={e => setForm(p => ({ ...p, streamUrl: e.target.value }))}
              />
            </div>
            <div>
              <Label>Poster / Icon URL</Label>
              <Input
                className="mt-1 bg-white/5 border-white/10"
                value={form.icon}
                onChange={e => setForm(p => ({ ...p, icon: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Release Year</Label>
                <Input
                  className="mt-1 bg-white/5 border-white/10"
                  type="number"
                  value={form.releaseYear}
                  onChange={e => setForm(p => ({ ...p, releaseYear: e.target.value }))}
                />
              </div>
              <div>
                <Label>Rating (0–10)</Label>
                <Input
                  className="mt-1 bg-white/5 border-white/10"
                  type="number"
                  step="0.1"
                  value={form.rating}
                  onChange={e => setForm(p => ({ ...p, rating: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <textarea
                className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground resize-none h-20 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="isActive">Active (visible to users)</Label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button
                className="bg-gradient-to-r from-blue-600 to-purple-600 border-0"
                onClick={() =>
                  saveMutation.mutate({
                    ...form,
                    releaseYear: form.releaseYear ? parseInt(form.releaseYear) : undefined,
                    rating: form.rating ? parseFloat(form.rating) : undefined,
                  })
                }
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving...' : 'Save Movie'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
