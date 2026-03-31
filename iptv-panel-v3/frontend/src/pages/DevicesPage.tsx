import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Tv2, Smartphone, Edit2, Trash2, Lock, Unlock, Search } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import api from '@/lib/api';

interface Device { id: string; macAddress: string; model?: string; ipAddress?: string; imageVersion?: string; lastSeen?: string; isActive: boolean; isLocked: boolean; client?: { id: string; username: string } | null; }

export default function DevicesPage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') === 'enigma2' ? 'enigma2' : 'mag');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Device | null>(null);
  const [form, setForm] = useState({ macAddress: '', model: '', ipAddress: '', imageVersion: '', isActive: true, isLocked: false });
  const qc = useQueryClient();

  const endpoint = tab === 'mag' ? '/devices/mag' : '/devices/enigma2';

  const { data, isLoading } = useQuery<{ data: Device[]; total: number }>({
    queryKey: ['devices', tab, search],
    queryFn: () => api.get(`${endpoint}?search=${search}&limit=50`).then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (d: any) => editItem ? api.put(`${endpoint}/${editItem.id}`, d) : api.post(endpoint, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['devices', tab] }); setModalOpen(false); toast({ title: 'Device saved' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`${endpoint}/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['devices', tab] }); toast({ title: 'Device removed' }); },
  });

  const toggleLockMutation = useMutation({
    mutationFn: ({ id, locked }: { id: string; locked: boolean }) => api.put(`${endpoint}/${id}`, { isLocked: locked }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['devices', tab] }); },
  });

  function openAdd() { setEditItem(null); setForm({ macAddress: '', model: '', ipAddress: '', imageVersion: '', isActive: true, isLocked: false }); setModalOpen(true); }
  function openEdit(d: Device) { setEditItem(d); setForm({ macAddress: d.macAddress, model: d.model || '', ipAddress: d.ipAddress || '', imageVersion: d.imageVersion || '', isActive: d.isActive, isLocked: d.isLocked }); setModalOpen(true); }

  const DeviceIcon = tab === 'mag' ? Tv2 : Smartphone;
  const iconColor = tab === 'mag' ? 'text-blue-400' : 'text-purple-400';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Devices</h1>
          <p className="text-muted-foreground text-sm mt-0.5">MAG and Enigma2 device management</p>
        </div>
        <Button onClick={openAdd} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0">
          <Plus className="h-4 w-4 mr-2" /> Add Device
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="mag" className="data-[state=active]:bg-white/10 gap-1.5"><Tv2 className="h-3.5 w-3.5" /> MAG Devices</TabsTrigger>
          <TabsTrigger value="enigma2" className="data-[state=active]:bg-white/10 gap-1.5"><Smartphone className="h-3.5 w-3.5" /> Enigma2</TabsTrigger>
        </TabsList>

        {['mag', 'enigma2'].map(t => (
          <TabsContent key={t} value={t}>
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by MAC address..." className="pl-9 bg-white/5 border-white/10" value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <CardTitle className="ml-auto text-sm text-muted-foreground">{data?.total ?? 0} devices</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? <div className="space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-14" />)}</div> : data?.total === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <DeviceIcon className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p>No {t === 'mag' ? 'MAG' : 'Enigma2'} devices registered</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {data?.data.map(device => (
                      <div key={device.id} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-colors group border border-transparent hover:border-white/[0.05]">
                        <div className={`w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 ${iconColor}`}>
                          <DeviceIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono font-semibold">{device.macAddress}</p>
                          <p className="text-xs text-muted-foreground">
                            {device.model || 'Unknown model'} · {device.ipAddress || 'No IP'}
                            {device.lastSeen ? ` · ${formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true })}` : ''}
                          </p>
                        </div>
                        {device.client && (
                          <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full px-2 py-0.5">{device.client.username}</span>
                        )}
                        <div className="flex items-center gap-1.5">
                          {device.isLocked ? (
                            <Badge className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">Locked</Badge>
                          ) : (
                            <Badge variant="active" className="text-[10px]">Active</Badge>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title={device.isLocked ? 'Unlock' : 'Lock'}
                            onClick={() => toggleLockMutation.mutate({ id: device.id, locked: !device.isLocked })}>
                            {device.isLocked ? <Unlock className="h-3.5 w-3.5 text-green-400" /> : <Lock className="h-3.5 w-3.5 text-orange-400" />}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(device)}><Edit2 className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" onClick={() => { if (confirm('Remove device?')) deleteMutation.mutate(device.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="glass-card border-white/10 max-w-md">
          <DialogHeader><DialogTitle>{editItem ? 'Edit Device' : `Add ${tab === 'mag' ? 'MAG' : 'Enigma2'} Device`}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>MAC Address *</Label><Input className="mt-1 bg-white/5 border-white/10 font-mono" placeholder="00:1A:2B:3C:4D:5E" value={form.macAddress} onChange={e => setForm(p => ({ ...p, macAddress: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Model</Label><Input className="mt-1 bg-white/5 border-white/10" placeholder="MAG 322" value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} /></div>
              <div><Label>IP Address</Label><Input className="mt-1 bg-white/5 border-white/10 font-mono" value={form.ipAddress} onChange={e => setForm(p => ({ ...p, ipAddress: e.target.value }))} /></div>
            </div>
            {tab === 'mag' && <div><Label>Image Version</Label><Input className="mt-1 bg-white/5 border-white/10" value={form.imageVersion} onChange={e => setForm(p => ({ ...p, imageVersion: e.target.value }))} /></div>}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 border-0" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save Device'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
