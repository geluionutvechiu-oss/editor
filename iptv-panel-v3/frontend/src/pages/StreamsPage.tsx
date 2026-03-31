import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import { Plus, Edit2, Trash2, Play, Tv, Package, Upload, Link2, Search, Radio, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import type { Plan } from '@/types';

interface Stream {
  id: string;
  name: string;
  streamUrl: string;
  type: string;
  status: string;
  categoryId?: string;
  logoUrl?: string;
  epgChannelId?: string;
  sortOrder: number;
  category?: { id: string; name: string };
}

interface Category { id: string; name: string; type: string; }

interface ParsedChannel { name: string; url: string; group?: string; logo?: string; selected: boolean; }

function parseM3U(text: string): ParsedChannel[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const channels: ParsedChannel[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF:')) {
      const info = lines[i];
      const url = lines[i + 1];
      if (url && !url.startsWith('#')) {
        const nameMatch = info.match(/,(.+)$/);
        const groupMatch = info.match(/group-title="([^"]*)"/);
        const logoMatch = info.match(/tvg-logo="([^"]*)"/);
        channels.push({
          name: nameMatch ? nameMatch[1].trim() : 'Unknown',
          url,
          group: groupMatch?.[1] || undefined,
          logo: logoMatch?.[1] || undefined,
          selected: true,
        });
        i++;
      }
    }
  }
  return channels;
}

function useAllBouquets(plans: Plan[] | undefined) {
  if (!plans) return [];
  const all = plans.flatMap(p => p.bouquets);
  return [...new Set(all)].sort();
}

export default function StreamsPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  // Channel state
  const [search, setSearch] = useState('');
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [editChannel, setEditChannel] = useState<Stream | null>(null);
  const [channelForm, setChannelForm] = useState({ name: '', streamUrl: '', categoryId: '', logoUrl: '', epgChannelId: '', sortOrder: '0' });

  // Import state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importTab, setImportTab] = useState<'url' | 'file'>('url');
  const [m3uUrl, setM3uUrl] = useState('');
  const [parsedChannels, setParsedChannels] = useState<ParsedChannel[]>([]);
  const [importing, setImporting] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importCategoryId, setImportCategoryId] = useState('');

  // Stream tester
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState<{ alive: boolean; latency?: number; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const { data: streamsData, isLoading: streamsLoading } = useQuery<{ data: Stream[]; total: number }>({
    queryKey: ['streams-live', search],
    queryFn: () => api.get(`/streams?type=LIVE&search=${search}&limit=200`).then(r => r.data),
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories', 'LIVE'],
    queryFn: () => api.get('/categories?type=LIVE&limit=100').then(r => Array.isArray(r.data) ? r.data : (r.data.data ?? [])),
  });

  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: () => api.get('/plans').then(r => r.data),
  });

  const { data: servers } = useQuery({
    queryKey: ['servers'],
    queryFn: () => api.get('/servers').then(r => r.data),
  });

  const bouquets = useAllBouquets(plans);

  const saveMutation = useMutation({
    mutationFn: (d: any) => editChannel ? api.put(`/streams/${editChannel.id}`, d) : api.post('/streams', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['streams-live'] });
      setChannelModalOpen(false);
      toast({ title: editChannel ? 'Channel updated' : 'Channel added' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/streams/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['streams-live'] }); toast({ title: 'Channel deleted' }); },
  });

  function openAdd() {
    setEditChannel(null);
    setChannelForm({ name: '', streamUrl: '', categoryId: '', logoUrl: '', epgChannelId: '', sortOrder: '0' });
    setChannelModalOpen(true);
  }

  function openEdit(s: Stream) {
    setEditChannel(s);
    setChannelForm({ name: s.name, streamUrl: s.streamUrl, categoryId: s.categoryId || '', logoUrl: s.logoUrl || '', epgChannelId: s.epgChannelId || '', sortOrder: String(s.sortOrder) });
    setChannelModalOpen(true);
  }

  async function loadM3UFromUrl() {
    if (!m3uUrl.trim()) return;
    setImportLoading(true);
    try {
      const resp = await api.get('/streams/proxy-m3u', { params: { url: m3uUrl } });
      const text = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
      const channels = parseM3U(text);
      if (channels.length === 0) {
        toast({ title: 'No channels found in M3U', variant: 'destructive' });
      } else {
        setParsedChannels(channels);
        toast({ title: `Parsed ${channels.length} channels` });
      }
    } catch {
      toast({ title: 'Failed to fetch M3U', description: 'Check the URL and try again', variant: 'destructive' });
    }
    setImportLoading(false);
  }

  function loadM3UFromFile(file: File) {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const channels = parseM3U(text);
      if (channels.length === 0) {
        toast({ title: 'No channels found in file', variant: 'destructive' });
      } else {
        setParsedChannels(channels);
        toast({ title: `Parsed ${channels.length} channels from file` });
      }
    };
    reader.readAsText(file);
  }

  async function importSelected() {
    const selected = parsedChannels.filter(c => c.selected);
    if (!selected.length) { toast({ title: 'Select at least one channel', variant: 'destructive' }); return; }
    setImporting(true);
    let ok = 0, fail = 0;
    for (const ch of selected) {
      try {
        await api.post('/streams', {
          name: ch.name,
          streamUrl: ch.url,
          type: 'LIVE',
          categoryId: importCategoryId || undefined,
          logoUrl: ch.logo || undefined,
          sortOrder: 0,
        });
        ok++;
      } catch { fail++; }
    }
    setImporting(false);
    qc.invalidateQueries({ queryKey: ['streams-live'] });
    setImportModalOpen(false);
    setParsedChannels([]);
    toast({ title: `Imported ${ok} channels${fail ? `, ${fail} failed` : ''}` });
  }

  function toggleAll(val: boolean) {
    setParsedChannels(prev => prev.map(c => ({ ...c, selected: val })));
  }

  async function testStream() {
    if (!testUrl) return;
    setTesting(true);
    setTestResult(null);
    try {
      const serversData = await api.get('/servers').then(r => r.data);
      if (!serversData?.length) { toast({ title: 'No servers configured', variant: 'destructive' }); setTesting(false); return; }
      const { data } = await api.post(`/servers/${serversData[0].id}/test-stream`, { streamUrl: testUrl });
      setTestResult(data);
    } catch {
      setTestResult({ alive: false, error: 'Test failed' });
    }
    setTesting(false);
  }

  const xtreamApiEndpoints = [
    { method: 'GET', path: '/player_api.php?username=X&password=X', desc: 'Login / User Info' },
    { method: 'GET', path: '/player_api.php?username=X&password=X&action=get_live_categories', desc: 'Live Categories' },
    { method: 'GET', path: '/player_api.php?username=X&password=X&action=get_live_streams', desc: 'Live Streams' },
    { method: 'GET', path: '/player_api.php?username=X&password=X&action=get_vod_streams', desc: 'VOD Streams' },
    { method: 'GET', path: '/player_api.php?username=X&password=X&action=get_series', desc: 'Series' },
    { method: 'GET', path: '/get.php?username=X&password=X&type=m3u_plus', desc: 'M3U Playlist' },
    { method: 'GET', path: '/xmltv.php?username=X&password=X', desc: 'XMLTV EPG' },
    { method: 'GET', path: '/live/:user/:pass/:streamId.ts', desc: 'Live Stream (proxied)' },
  ];

  const selectedCount = parsedChannels.filter(c => c.selected).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Streams & Channels</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage live TV channels, bouquets and stream testing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-white/10 hover:bg-white/5" onClick={() => { setParsedChannels([]); setM3uUrl(''); setImportTab('url'); setImportModalOpen(true); }}>
            <Upload className="h-4 w-4 mr-2" /> Import M3U
          </Button>
          <Button onClick={openAdd} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0">
            <Plus className="h-4 w-4 mr-2" /> Add Channel
          </Button>
        </div>
      </div>

      <Tabs defaultValue="channels">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="channels" className="data-[state=active]:bg-white/10 gap-1.5"><Tv className="h-3.5 w-3.5" /> Channels</TabsTrigger>
          <TabsTrigger value="bouquets" className="data-[state=active]:bg-white/10 gap-1.5"><Package className="h-3.5 w-3.5" /> Bouquets</TabsTrigger>
          <TabsTrigger value="test" className="data-[state=active]:bg-white/10 gap-1.5"><Play className="h-3.5 w-3.5" /> Tester</TabsTrigger>
          <TabsTrigger value="xtream" className="data-[state=active]:bg-white/10 gap-1.5"><Radio className="h-3.5 w-3.5" /> Xtream API</TabsTrigger>
        </TabsList>

        {/* Channels */}
        <TabsContent value="channels">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search channels..." className="pl-9 bg-white/5 border-white/10" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <CardTitle className="ml-auto text-sm text-muted-foreground">{streamsData?.total ?? 0} channels</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {streamsLoading ? (
                <div className="space-y-2">{Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : !streamsData?.total ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Tv className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="mb-4">No channels yet</p>
                  <div className="flex gap-3 justify-center">
                    <Button variant="outline" className="border-white/10" onClick={() => { setParsedChannels([]); setM3uUrl(''); setImportModalOpen(true); }}>
                      <Upload className="h-4 w-4 mr-2" /> Import M3U
                    </Button>
                    <Button className="bg-gradient-to-r from-blue-600 to-purple-600 border-0" onClick={openAdd}>
                      <Plus className="h-4 w-4 mr-2" /> Add Channel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-3 pb-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-white/[0.05]">
                    <div className="w-8 text-center">#</div>
                    <div>Channel</div>
                    <div className="w-28">Category</div>
                    <div className="w-20 text-center">Status</div>
                    <div className="w-16 text-right">Actions</div>
                  </div>
                  {streamsData?.data.map((stream, idx) => (
                    <div key={stream.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors group border border-transparent hover:border-white/[0.05]">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                        {stream.logoUrl ? (
                          <img src={stream.logoUrl} alt="" className="w-6 h-6 object-contain rounded" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">{idx + 1}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{stream.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{stream.streamUrl}</p>
                      </div>
                      <div className="w-28">
                        {stream.category ? (
                          <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">{stream.category.name}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                      <div className="w-20 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stream.status === 'ACTIVE' ? 'bg-green-500/15 text-green-400' : stream.status === 'OFFLINE' ? 'bg-red-500/15 text-red-400' : 'bg-slate-500/15 text-slate-400'}`}>
                          {stream.status}
                        </span>
                      </div>
                      <div className="w-16 flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(stream)}><Edit2 className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" onClick={() => { if (confirm('Delete channel?')) deleteMutation.mutate(stream.id); }}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bouquets */}
        <TabsContent value="bouquets">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {plansLoading ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-20" />) :
              bouquets.map(b => (
                <Card key={b} className="glass-card flex flex-col items-center justify-center p-4 text-center hover:border-white/20 transition-all cursor-default">
                  <Package className="h-6 w-6 text-blue-400 mb-2" />
                  <span className="text-sm font-medium">{b}</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    {plans?.filter(p => p.bouquets.includes(b)).length ?? 0} plans
                  </span>
                </Card>
              ))
            }
            {!plansLoading && bouquets.length === 0 && (
              <div className="col-span-full text-center py-10 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p>No bouquets — assign them in Plans</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Stream Tester */}
        <TabsContent value="test">
          <Card className="glass-card">
            <CardHeader><CardTitle>Test Stream URL</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Stream URL</Label>
                <div className="flex gap-3 mt-1">
                  <Input value={testUrl} onChange={e => setTestUrl(e.target.value)} placeholder="http://server:8080/live/user/pass/streamid.ts" className="flex-1 bg-white/5 border-white/10" />
                  <Button className="bg-gradient-to-r from-blue-600 to-purple-600 border-0" onClick={testStream} disabled={testing}>
                    <Play className="h-4 w-4 mr-2" />{testing ? 'Testing...' : 'Test'}
                  </Button>
                </div>
              </div>
              {testResult && (
                <div className={`p-4 rounded-xl border ${testResult.alive ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
                  {testResult.alive ? (
                    <div><div className="font-medium">✓ Stream is live</div>{testResult.latency && <div className="text-sm mt-1">Latency: {testResult.latency}ms</div>}</div>
                  ) : (
                    <div><div className="font-medium">✗ Stream not accessible</div>{testResult.error && <div className="text-sm mt-1">{testResult.error}</div>}</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Xtream API */}
        <TabsContent value="xtream">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Xtream Codes API Compatibility</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">All Xtream Codes compatible apps work with this panel. Use client credentials to connect.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {xtreamApiEndpoints.map(ep => (
                <div key={ep.path} className="flex items-center gap-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-500/20 text-green-400 flex-shrink-0">{ep.method}</span>
                  <code className="text-xs font-mono text-blue-300 flex-1 break-all">{ep.path}</code>
                  <span className="text-xs text-muted-foreground hidden md:block flex-shrink-0">{ep.desc}</span>
                </div>
              ))}
              <div className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-400">
                <strong>Compatible apps:</strong> TiviMate, IPTV Smarters Pro, OTT Navigator, Duplex Play, GSE Smart IPTV, Perfect Player, and any Xtream Codes API compatible app.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Channel Modal */}
      <Dialog open={channelModalOpen} onOpenChange={setChannelModalOpen}>
        <DialogContent className="glass-card border-white/10 max-w-md">
          <DialogHeader><DialogTitle>{editChannel ? 'Edit Channel' : 'Add Live TV Channel'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Channel Name *</Label><Input className="mt-1 bg-white/5 border-white/10" value={channelForm.name} onChange={e => setChannelForm(p => ({ ...p, name: e.target.value }))} placeholder="CNN International" /></div>
            <div>
              <Label>Stream URL *</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Restream URL, HLS, RTMP, or direct TS link</p>
              <Input className="mt-1 bg-white/5 border-white/10 font-mono text-xs" value={channelForm.streamUrl} onChange={e => setChannelForm(p => ({ ...p, streamUrl: e.target.value }))} placeholder="http://provider:8080/live/user/pass/id.ts" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={channelForm.categoryId || '__none__'} onValueChange={v => setChannelForm(p => ({ ...p, categoryId: v === '__none__' ? '' : v }))}>
                <SelectTrigger className="mt-1 bg-white/5 border-white/10"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No category</SelectItem>
                  {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Logo URL</Label><Input className="mt-1 bg-white/5 border-white/10" value={channelForm.logoUrl} onChange={e => setChannelForm(p => ({ ...p, logoUrl: e.target.value }))} placeholder="https://..." /></div>
              <div><Label>EPG Channel ID</Label><Input className="mt-1 bg-white/5 border-white/10" value={channelForm.epgChannelId} onChange={e => setChannelForm(p => ({ ...p, epgChannelId: e.target.value }))} placeholder="cnn.us" /></div>
            </div>
            <div><Label>Sort Order</Label><Input className="mt-1 bg-white/5 border-white/10" type="number" min="0" value={channelForm.sortOrder} onChange={e => setChannelForm(p => ({ ...p, sortOrder: e.target.value }))} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setChannelModalOpen(false)}>Cancel</Button>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 border-0"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate({ ...channelForm, type: 'LIVE', sortOrder: parseInt(channelForm.sortOrder) || 0, categoryId: channelForm.categoryId || undefined, logoUrl: channelForm.logoUrl || undefined, epgChannelId: channelForm.epgChannelId || undefined })}>
                {saveMutation.isPending ? 'Saving...' : 'Save Channel'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import M3U Modal */}
      <Dialog open={importModalOpen} onOpenChange={v => { setImportModalOpen(v); if (!v) setParsedChannels([]); }}>
        <DialogContent className="glass-card border-white/10 max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Import M3U Playlist</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
            {parsedChannels.length === 0 ? (
              <>
                <div className="flex gap-1 p-1 glass rounded-xl w-fit">
                  {(['url', 'file'] as const).map(t => (
                    <button key={t} onClick={() => setImportTab(t)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${importTab === t ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}>
                      {t === 'url' ? <><Link2 className="h-3.5 w-3.5 inline mr-1.5" />From URL</> : <><Upload className="h-3.5 w-3.5 inline mr-1.5" />From File</>}
                    </button>
                  ))}
                </div>

                {importTab === 'url' ? (
                  <div className="space-y-3">
                    <div>
                      <Label>M3U / M3U8 URL</Label>
                      <div className="flex gap-2 mt-1">
                        <Input className="flex-1 bg-white/5 border-white/10 font-mono text-sm" value={m3uUrl} onChange={e => setM3uUrl(e.target.value)} placeholder="http://provider.com/get.php?username=X&password=X&type=m3u_plus" />
                        <Button className="bg-gradient-to-r from-blue-600 to-purple-600 border-0" onClick={loadM3UFromUrl} disabled={importLoading}>
                          {importLoading ? 'Loading...' : 'Load'}
                        </Button>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 flex gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      The URL is fetched server-side via the proxy endpoint. Xtream Codes M3U URLs are supported.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input ref={fileRef} type="file" accept=".m3u,.m3u8,.txt" className="hidden" onChange={e => { if (e.target.files?.[0]) loadM3UFromFile(e.target.files[0]); }} />
                    <div
                      className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500/40 hover:bg-blue-500/5 transition-all"
                      onClick={() => fileRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadM3UFromFile(f); }}>
                      <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm font-medium">Drop M3U file here or click to browse</p>
                      <p className="text-xs text-muted-foreground mt-1">Supports .m3u, .m3u8, .txt</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleAll(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <CheckSquare className="h-3.5 w-3.5" /> Select All
                    </button>
                    <button onClick={() => toggleAll(false)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <Square className="h-3.5 w-3.5" /> None
                    </button>
                    <span className="text-xs text-muted-foreground">{selectedCount} / {parsedChannels.length} selected</span>
                  </div>
                  <Button variant="ghost" className="text-xs h-7" onClick={() => setParsedChannels([])}>← Back</Button>
                </div>

                <div>
                  <Label>Import to Category</Label>
                  <Select value={importCategoryId || '__none__'} onValueChange={v => setImportCategoryId(v === '__none__' ? '' : v)}>
                    <SelectTrigger className="mt-1 bg-white/5 border-white/10"><SelectValue placeholder="No category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No category</SelectItem>
                      {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
                  {parsedChannels.map((ch, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer" onClick={() => setParsedChannels(p => p.map((c, i) => i === idx ? { ...c, selected: !c.selected } : c))}>
                      <div className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center transition-colors ${ch.selected ? 'bg-blue-500 border-blue-500' : 'border-white/20'}`}>
                        {ch.selected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      {ch.logo ? (
                        <img src={ch.logo} alt="" className="w-6 h-6 object-contain rounded flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <Tv className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ch.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{ch.url}</p>
                      </div>
                      {ch.group && <span className="text-xs text-muted-foreground flex-shrink-0">{ch.group}</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {parsedChannels.length > 0 && (
            <div className="flex justify-end gap-3 pt-4 border-t border-white/[0.05] flex-shrink-0">
              <Button variant="ghost" onClick={() => { setImportModalOpen(false); setParsedChannels([]); }}>Cancel</Button>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 border-0"
                onClick={importSelected} disabled={importing || selectedCount === 0}>
                {importing ? 'Importing...' : `Import ${selectedCount} Channels`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
