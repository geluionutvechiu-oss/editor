import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Edit2, Trash2, Play, Tv, Package } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import type { Plan } from '@/types';

// Bouquets are stored as part of plans — we manage them through plans
// Streams page shows bouquet management and plan-bouquet assignment

const bouquetSchema = z.object({ name: z.string().min(1, 'Name required') });
type BouquetForm = z.infer<typeof bouquetSchema>;

// Get all unique bouquets from all plans
function useAllBouquets() {
  return useQuery<string[]>({
    queryKey: ['all-bouquets'],
    queryFn: async () => {
      const plans: Plan[] = await api.get('/plans').then(r => r.data);
      const all = plans.flatMap(p => p.bouquets);
      return [...new Set(all)].sort();
    },
  });
}

export default function StreamsPage() {
  const qc = useQueryClient();
  const [addBouquetOpen, setAddBouquetOpen] = useState(false);
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState<{ alive: boolean; latency?: number; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const { data: bouquets, isLoading: bouquetsLoading } = useAllBouquets();
  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({ queryKey: ['plans'], queryFn: () => api.get('/plans').then(r => r.data) });
  const { data: servers } = useQuery({ queryKey: ['servers'], queryFn: () => api.get('/servers').then(r => r.data) });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BouquetForm>({ resolver: zodResolver(bouquetSchema) });

  // Add bouquet to all plans (or could be a separate endpoint)
  const addBouquetMutation = useMutation({
    mutationFn: async (data: BouquetForm) => {
      // Add this bouquet to all plans that don't have it
      const plansData: Plan[] = await api.get('/plans').then(r => r.data);
      await Promise.all(plansData.map(p =>
        p.bouquets.includes(data.name) ? null :
          api.put(`/plans/${p.id}`, { bouquets: [...p.bouquets, data.name] })
      ));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-bouquets'] });
      qc.invalidateQueries({ queryKey: ['plans'] });
      toast({ title: 'Bouquet added to all plans' });
      setAddBouquetOpen(false);
      reset();
    },
  });

  const testStream = async () => {
    if (!testUrl) return;
    setTesting(true);
    setTestResult(null);
    try {
      // Use first server for test
      const serversData = await api.get('/servers').then(r => r.data);
      if (!serversData?.length) { toast({ title: 'No servers configured', variant: 'destructive' }); setTesting(false); return; }
      const { data } = await api.post(`/servers/${serversData[0].id}/test-stream`, { streamUrl: testUrl });
      setTestResult(data);
    } catch {
      setTestResult({ alive: false, error: 'Test failed' });
    }
    setTesting(false);
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Streams & Bouquets</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage channel packages and stream testing</p>
        </div>
        <Button variant="gradient" size="sm" onClick={() => setAddBouquetOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />New Bouquet
        </Button>
      </div>

      <Tabs defaultValue="bouquets">
        <TabsList>
          <TabsTrigger value="bouquets">Bouquets</TabsTrigger>
          <TabsTrigger value="plans">Plan Assignment</TabsTrigger>
          <TabsTrigger value="test">Stream Tester</TabsTrigger>
          <TabsTrigger value="xtream">Xtream API</TabsTrigger>
        </TabsList>

        {/* Bouquets */}
        <TabsContent value="bouquets">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {bouquetsLoading ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-20" />) :
              bouquets?.map(b => (
                <Card key={b} className="flex flex-col items-center justify-center p-4 text-center hover:border-white/20 transition-all cursor-default">
                  <Package className="h-6 w-6 text-blue-400 mb-2" />
                  <span className="text-sm font-medium">{b}</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    {plans?.filter(p => p.bouquets.includes(b)).length ?? 0} plans
                  </span>
                </Card>
              ))
            }
          </div>
        </TabsContent>

        {/* Plan assignment */}
        <TabsContent value="plans">
          <div className="space-y-4">
            {plansLoading ? <Skeleton className="h-40" /> : plans?.map(plan => (
              <Card key={plan.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    <Badge variant="secondary">{plan.bouquets.length} bouquets</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {plan.bouquets.map(b => (
                      <span key={b} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 border border-border">
                        <Tv className="h-3 w-3 text-blue-400" />{b}
                      </span>
                    ))}
                    {plan.bouquets.length === 0 && <span className="text-sm text-muted-foreground">No bouquets assigned</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Stream tester */}
        <TabsContent value="test">
          <Card>
            <CardHeader><CardTitle>Test Stream URL</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Stream URL</Label>
                <div className="flex gap-3">
                  <Input
                    value={testUrl}
                    onChange={e => setTestUrl(e.target.value)}
                    placeholder="http://server:8080/live/user/pass/streamid.ts"
                    className="flex-1"
                  />
                  <Button variant="gradient" onClick={testStream} loading={testing}>
                    <Play className="h-4 w-4 mr-2" />Test
                  </Button>
                </div>
              </div>

              {testResult && (
                <div className={`p-4 rounded-xl border ${testResult.alive ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
                  {testResult.alive ? (
                    <div className="space-y-1">
                      <div className="font-medium">✓ Stream is live</div>
                      {testResult.latency && <div className="text-sm">Latency: {testResult.latency}ms</div>}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="font-medium">✗ Stream is not accessible</div>
                      {testResult.error && <div className="text-sm">{testResult.error}</div>}
                    </div>
                  )}
                </div>
              )}

              <div className="p-4 rounded-xl bg-slate-800/50 border border-border">
                <p className="text-sm text-muted-foreground">
                  The tester sends an HTTP request to the stream URL and checks if it responds within 8 seconds.
                  Uses the first configured server as proxy.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Xtream API reference */}
        <TabsContent value="xtream">
          <Card>
            <CardHeader>
              <CardTitle>Xtream Codes API Compatibility</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">All Xtream Codes compatible apps work with this panel. Use client credentials to connect.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {xtreamApiEndpoints.map(ep => (
                <div key={ep.path} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-slate-800/30">
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

      {/* Add Bouquet Modal */}
      <Dialog open={addBouquetOpen} onOpenChange={() => setAddBouquetOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Bouquet</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(d => addBouquetMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Bouquet Name</Label>
              <Input {...register('name')} placeholder="Sports HD" />
              {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
            </div>
            <p className="text-xs text-muted-foreground">This bouquet will be available to assign to plans.</p>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setAddBouquetOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gradient" loading={addBouquetMutation.isPending}>Add</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
