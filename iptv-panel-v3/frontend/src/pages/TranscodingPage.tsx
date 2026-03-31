import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Cpu, Edit2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';

interface Profile { id: string; name: string; videoCodec: string; audioCodec: string; resolution?: string; bitrate?: string; extraArgs?: string; isActive: boolean; _count?: { streams: number }; }

export default function TranscodingPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Profile | null>(null);
  const [form, setForm] = useState({ name: '', videoCodec: 'copy', audioCodec: 'copy', resolution: '', bitrate: '', extraArgs: '', isActive: true });

  const { data: profiles, isLoading } = useQuery<Profile[]>({
    queryKey: ['transcoding'],
    queryFn: () => api.get('/transcoding').then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (d: any) => editItem ? api.put(`/transcoding/${editItem.id}`, d) : api.post('/transcoding', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transcoding'] }); setModalOpen(false); toast({ title: 'Profile saved' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/transcoding/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transcoding'] }); toast({ title: 'Profile deleted' }); },
  });

  function openAdd() { setEditItem(null); setForm({ name: '', videoCodec: 'copy', audioCodec: 'copy', resolution: '', bitrate: '', extraArgs: '', isActive: true }); setModalOpen(true); }
  function openEdit(p: Profile) { setEditItem(p); setForm({ name: p.name, videoCodec: p.videoCodec, audioCodec: p.audioCodec, resolution: p.resolution || '', bitrate: p.bitrate || '', extraArgs: p.extraArgs || '', isActive: p.isActive }); setModalOpen(true); }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transcoding Profiles</h1>
          <p className="text-muted-foreground text-sm mt-0.5">FFmpeg transcoding configuration</p>
        </div>
        <Button onClick={openAdd} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0">
          <Plus className="h-4 w-4 mr-2" /> New Profile
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="glass-card stat-glow-blue"><CardContent className="p-4"><p className="text-muted-foreground text-xs mb-1">Total Profiles</p><p className="text-2xl font-bold text-blue-400">{profiles?.length ?? '—'}</p></CardContent></Card>
        <Card className="glass-card stat-glow-green"><CardContent className="p-4"><p className="text-muted-foreground text-xs mb-1">Active Profiles</p><p className="text-2xl font-bold text-green-400">{profiles?.filter(p => p.isActive).length ?? '—'}</p></CardContent></Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-3"><CardTitle className="text-sm text-muted-foreground">{profiles?.length ?? 0} profiles</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20" />)}</div> : profiles?.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground"><Cpu className="h-10 w-10 mx-auto mb-2 opacity-20" /><p>No profiles yet</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {profiles?.map(profile => (
                <div key={profile.id} className="glass rounded-xl p-4 glass-hover group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><Cpu className="h-4 w-4 text-blue-400" /></div>
                      <div>
                        <p className="text-sm font-semibold">{profile.name}</p>
                        <p className="text-xs text-muted-foreground">{profile._count?.streams || 0} streams using this</p>
                      </div>
                    </div>
                    <Badge variant={profile.isActive ? 'active' : 'suspended'} className="text-[10px]">{profile.isActive ? 'Active' : 'Off'}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="bg-white/5 rounded-lg px-2 py-1.5">
                      <p className="text-muted-foreground/70 mb-0.5">Video Codec</p>
                      <p className="font-mono font-semibold text-purple-400">{profile.videoCodec}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg px-2 py-1.5">
                      <p className="text-muted-foreground/70 mb-0.5">Audio Codec</p>
                      <p className="font-mono font-semibold text-blue-400">{profile.audioCodec}</p>
                    </div>
                    {profile.resolution && <div className="bg-white/5 rounded-lg px-2 py-1.5">
                      <p className="text-muted-foreground/70 mb-0.5">Resolution</p>
                      <p className="font-mono font-semibold">{profile.resolution}</p>
                    </div>}
                    {profile.bitrate && <div className="bg-white/5 rounded-lg px-2 py-1.5">
                      <p className="text-muted-foreground/70 mb-0.5">Bitrate</p>
                      <p className="font-mono font-semibold">{profile.bitrate}</p>
                    </div>}
                  </div>
                  {profile.extraArgs && <p className="text-[10px] font-mono text-muted-foreground bg-black/30 rounded px-2 py-1 mb-3 truncate">{profile.extraArgs}</p>}
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" className="h-7 text-xs flex-1" onClick={() => openEdit(profile)}><Edit2 className="h-3 w-3 mr-1" />Edit</Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(profile.id); }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="glass-card border-white/10 max-w-lg">
          <DialogHeader><DialogTitle>{editItem ? 'Edit Profile' : 'New Transcode Profile'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Profile Name *</Label><Input className="mt-1 bg-white/5 border-white/10" placeholder="e.g. HD 1080p, SD 480p" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Video Codec</Label><Input className="mt-1 bg-white/5 border-white/10 font-mono" placeholder="copy / libx264" value={form.videoCodec} onChange={e => setForm(p => ({ ...p, videoCodec: e.target.value }))} /></div>
              <div><Label>Audio Codec</Label><Input className="mt-1 bg-white/5 border-white/10 font-mono" placeholder="copy / aac" value={form.audioCodec} onChange={e => setForm(p => ({ ...p, audioCodec: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Resolution</Label><Input className="mt-1 bg-white/5 border-white/10 font-mono" placeholder="1920x1080" value={form.resolution} onChange={e => setForm(p => ({ ...p, resolution: e.target.value }))} /></div>
              <div><Label>Bitrate</Label><Input className="mt-1 bg-white/5 border-white/10 font-mono" placeholder="4000k" value={form.bitrate} onChange={e => setForm(p => ({ ...p, bitrate: e.target.value }))} /></div>
            </div>
            <div><Label>Extra FFmpeg Args</Label><Input className="mt-1 bg-white/5 border-white/10 font-mono text-xs" placeholder="-preset fast -crf 23" value={form.extraArgs} onChange={e => setForm(p => ({ ...p, extraArgs: e.target.value }))} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 border-0" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
