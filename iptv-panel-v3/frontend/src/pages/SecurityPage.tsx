import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Copy, Check, Shield, AlertTriangle, Key, Globe, Search, Ban, Building2, Cpu } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import type { SharingAlert, ApiKey, Session } from '@/types';

interface IpBlock {
  id: string;
  value: string;
  reason?: string;
  blockType: string;
  isActive: boolean;
  createdBy?: string;
  expiresAt?: string;
  createdAt: string;
}

interface AsnBlock {
  id: string;
  asn: string;
  asnName?: string;
  reason?: string;
  isActive: boolean;
  createdAt: string;
}

interface CountryBlock {
  id: string;
  countryCode: string;
  countryName?: string;
  reason?: string;
  isActive: boolean;
  createdAt: string;
}

interface IspBlock {
  id: string;
  ispName: string;
  reason?: string;
  isActive: boolean;
  createdAt: string;
}

interface GeoInfo {
  ip: string;
  country: string;
  countryCode: string;
  city: string;
  region: string;
  ll: [number, number];
  isp: string;
  asn: string;
}

function countryToFlag(code: string): string {
  if (!code || code.length !== 2) return '🌐';
  return code.toUpperCase().replace(/./g, char =>
    String.fromCodePoint(char.charCodeAt(0) + 127397)
  );
}

export default function SecurityPage() {
  const qc = useQueryClient();

  // IP Blocks
  const [addIpBlockOpen, setAddIpBlockOpen] = useState(false);
  const [ipBlockForm, setIpBlockForm] = useState({ value: '', reason: '', blockType: 'IP' });

  // Country Blocks
  const [addCountryBlockOpen, setAddCountryBlockOpen] = useState(false);
  const [countryBlockForm, setCountryBlockForm] = useState({ countryCode: '', countryName: '', reason: '' });

  // ASN Blocks
  const [addAsnBlockOpen, setAddAsnBlockOpen] = useState(false);
  const [asnBlockForm, setAsnBlockForm] = useState({ asn: '', asnName: '', reason: '' });

  // ISP Blocks
  const [addIspBlockOpen, setAddIspBlockOpen] = useState(false);
  const [ispBlockForm, setIspBlockForm] = useState({ ispName: '', reason: '' });

  // API Keys
  const [addKeyOpen, setAddKeyOpen] = useState(false);
  const [keyForm, setKeyForm] = useState({ name: '', permissions: 'read' });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Geo Lookup
  const [lookupIp, setLookupIp] = useState('');
  const [geoResult, setGeoResult] = useState<GeoInfo | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  // Queries
  const { data: ipBlocks, isLoading: ipBlocksLoading } = useQuery<IpBlock[]>({ queryKey: ['ip-blocks'], queryFn: () => api.get('/security/ip-blocks').then(r => r.data) });
  const { data: countryBlocks, isLoading: countryBlocksLoading } = useQuery<CountryBlock[]>({ queryKey: ['country-blocks'], queryFn: () => api.get('/security/country-blocks').then(r => r.data) });
  const { data: asnBlocks, isLoading: asnBlocksLoading } = useQuery<AsnBlock[]>({ queryKey: ['asn-blocks'], queryFn: () => api.get('/security/asn-blocks').then(r => r.data) });
  const { data: ispBlocks, isLoading: ispBlocksLoading } = useQuery<IspBlock[]>({ queryKey: ['isp-blocks'], queryFn: () => api.get('/security/isp-blocks').then(r => r.data) });
  const { data: alerts, isLoading: alertsLoading } = useQuery<SharingAlert[]>({ queryKey: ['sharing-alerts'], queryFn: () => api.get('/security/sharing-alerts').then(r => r.data) });
  const { data: apiKeys, isLoading: keysLoading } = useQuery<ApiKey[]>({ queryKey: ['api-keys'], queryFn: () => api.get('/security/api-keys').then(r => r.data) });
  const { data: sessions } = useQuery<Session[]>({ queryKey: ['sessions'], queryFn: () => api.get('/security/sessions').then(r => r.data) });

  // Mutations - IP Blocks
  const addIpBlockMutation = useMutation({
    mutationFn: (d: typeof ipBlockForm) => api.post('/security/ip-blocks', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ip-blocks'] }); toast({ title: 'IP block added' }); setAddIpBlockOpen(false); setIpBlockForm({ value: '', reason: '', blockType: 'IP' }); },
    onError: () => toast({ title: 'Failed to add IP block', variant: 'destructive' }),
  });
  const deleteIpBlockMutation = useMutation({ mutationFn: (id: string) => api.delete(`/security/ip-blocks/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['ip-blocks'] }) });

  // Mutations - Country Blocks
  const addCountryBlockMutation = useMutation({
    mutationFn: (d: typeof countryBlockForm) => api.post('/security/country-blocks', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['country-blocks'] }); toast({ title: 'Country block added' }); setAddCountryBlockOpen(false); setCountryBlockForm({ countryCode: '', countryName: '', reason: '' }); },
    onError: () => toast({ title: 'Failed to add country block', variant: 'destructive' }),
  });
  const deleteCountryBlockMutation = useMutation({ mutationFn: (id: string) => api.delete(`/security/country-blocks/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['country-blocks'] }) });

  // Mutations - ASN Blocks
  const addAsnBlockMutation = useMutation({
    mutationFn: (d: typeof asnBlockForm) => api.post('/security/asn-blocks', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['asn-blocks'] }); toast({ title: 'ASN block added' }); setAddAsnBlockOpen(false); setAsnBlockForm({ asn: '', asnName: '', reason: '' }); },
    onError: () => toast({ title: 'Failed to add ASN block', variant: 'destructive' }),
  });
  const deleteAsnBlockMutation = useMutation({ mutationFn: (id: string) => api.delete(`/security/asn-blocks/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['asn-blocks'] }) });

  // Mutations - ISP Blocks
  const addIspBlockMutation = useMutation({
    mutationFn: (d: typeof ispBlockForm) => api.post('/security/isp-blocks', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['isp-blocks'] }); toast({ title: 'ISP block added' }); setAddIspBlockOpen(false); setIspBlockForm({ ispName: '', reason: '' }); },
    onError: () => toast({ title: 'Failed to add ISP block', variant: 'destructive' }),
  });
  const deleteIspBlockMutation = useMutation({ mutationFn: (id: string) => api.delete(`/security/isp-blocks/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['isp-blocks'] }) });

  // Mutations - Alerts, Keys, Sessions
  const resolveAlertMutation = useMutation({ mutationFn: (id: string) => api.post(`/security/sharing-alerts/${id}/resolve`), onSuccess: () => qc.invalidateQueries({ queryKey: ['sharing-alerts'] }) });
  const addKeyMutation = useMutation({
    mutationFn: (d: typeof keyForm) => api.post('/security/api-keys', { name: d.name, permissions: [d.permissions] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['api-keys'] }); toast({ title: 'API key created' }); setAddKeyOpen(false); },
  });
  const revokeKeyMutation = useMutation({ mutationFn: (id: string) => api.delete(`/security/api-keys/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }) });
  const killSessionMutation = useMutation({ mutationFn: (id: string) => api.delete(`/security/sessions/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }) });

  const copyKey = (key: string) => { navigator.clipboard.writeText(key); setCopiedKey(key); setTimeout(() => setCopiedKey(null), 2000); };

  const handleGeoLookup = async () => {
    if (!lookupIp.trim()) return;
    setGeoLoading(true);
    setGeoError('');
    setGeoResult(null);
    try {
      const res = await api.get(`/security/geo-lookup?ip=${encodeURIComponent(lookupIp.trim())}`);
      setGeoResult(res.data);
    } catch {
      setGeoError('No geo data found for this IP.');
    } finally {
      setGeoLoading(false);
    }
  };

  const DeleteBtn = ({ onDelete }: { onDelete: () => void }) => (
    <Button size="icon-sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={onDelete}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Shield className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Security</h2>
          <p className="text-sm text-muted-foreground">Manage blocking rules, sessions, and API access</p>
        </div>
      </div>

      {/* IP Geo Lookup Tool */}
      <Card className="glass-card animate-fade-in">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Search className="h-4 w-4 text-blue-400" />
            IP Geo Lookup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              value={lookupIp}
              onChange={e => setLookupIp(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGeoLookup()}
              placeholder="Enter IP address (e.g. 8.8.8.8)"
              className="max-w-xs"
            />
            <Button variant="outline" onClick={handleGeoLookup} loading={geoLoading}>
              <Search className="h-4 w-4 mr-2" />Lookup
            </Button>
          </div>
          {geoError && <p className="text-sm text-red-400 mt-2">{geoError}</p>}
          {geoResult && (
            <div className="mt-3 flex flex-wrap gap-3">
              <Badge variant="secondary" className="text-sm gap-1">
                {countryToFlag(geoResult.countryCode)} {geoResult.country || geoResult.countryCode}
              </Badge>
              {geoResult.city && <Badge variant="secondary" className="text-sm">🏙 {geoResult.city}{geoResult.region ? `, ${geoResult.region}` : ''}</Badge>}
              {geoResult.isp && <Badge variant="secondary" className="text-sm">🏢 {geoResult.isp}</Badge>}
              {geoResult.asn && <Badge variant="secondary" className="text-sm">📡 {geoResult.asn}</Badge>}
              {geoResult.ll && <Badge variant="secondary" className="text-sm font-mono">📍 {geoResult.ll[0].toFixed(2)}, {geoResult.ll[1].toFixed(2)}</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="ip-blocks">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="ip-blocks" className="flex items-center gap-1.5">
            <Ban className="h-3.5 w-3.5" />Firewall IP
            {ipBlocks && ipBlocks.length > 0 && <span className="ml-1 h-4 w-4 rounded-full bg-red-500/20 text-red-400 text-[10px] flex items-center justify-center">{ipBlocks.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="country-blocks" className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />Blocaje Țară
          </TabsTrigger>
          <TabsTrigger value="asn-blocks" className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5" />Blocaje ASN
          </TabsTrigger>
          <TabsTrigger value="isp-blocks" className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" />Blocaje ISP
          </TabsTrigger>
          <TabsTrigger value="sharing">
            Alerte Partajare
            {alerts && alerts.length > 0 && <span className="ml-1 h-4 w-4 rounded-full bg-yellow-500 text-black text-[10px] flex items-center justify-center">{alerts.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="flex items-center gap-1.5">
            <Key className="h-3.5 w-3.5" />Chei API
          </TabsTrigger>
          <TabsTrigger value="sessions">Sesiuni</TabsTrigger>
        </TabsList>

        {/* IP Blocks */}
        <TabsContent value="ip-blocks" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button variant="gradient" size="sm" onClick={() => setAddIpBlockOpen(true)}><Plus className="h-4 w-4 mr-2" />Adaugă Bloc IP</Button>
          </div>
          <Card className="glass-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {['Tip', 'IP / CIDR', 'Motiv', 'Creat', ''].map(h => (
                      <th key={h} className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ipBlocksLoading ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">{Array.from({ length: 5 }).map((_, j) => <td key={j} className="p-4"><Skeleton className="h-4" /></td>)}</tr>
                  )) : ipBlocks?.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Niciun bloc IP configurat</td></tr>
                  ) : ipBlocks?.map(b => (
                    <tr key={b.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="p-4"><Badge variant={b.blockType === 'IP' ? 'suspended' : 'secondary'}>{b.blockType}</Badge></td>
                      <td className="p-4 font-mono text-sm text-red-300">{b.value}</td>
                      <td className="p-4 text-sm text-muted-foreground">{b.reason || '—'}</td>
                      <td className="p-4 text-sm text-muted-foreground">{format(new Date(b.createdAt), 'dd MMM yyyy')}</td>
                      <td className="p-4"><DeleteBtn onDelete={() => deleteIpBlockMutation.mutate(b.id)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Country Blocks */}
        <TabsContent value="country-blocks" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button variant="gradient" size="sm" onClick={() => setAddCountryBlockOpen(true)}><Plus className="h-4 w-4 mr-2" />Blochează Țară</Button>
          </div>
          <Card className="glass-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {['Steag', 'Cod', 'Țară', 'Motiv', 'Creat', ''].map(h => (
                      <th key={h} className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {countryBlocksLoading ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">{Array.from({ length: 6 }).map((_, j) => <td key={j} className="p-4"><Skeleton className="h-4" /></td>)}</tr>
                  )) : countryBlocks?.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nicio țară blocată</td></tr>
                  ) : countryBlocks?.map(b => (
                    <tr key={b.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 text-2xl">{countryToFlag(b.countryCode)}</td>
                      <td className="p-4 font-mono text-sm font-bold">{b.countryCode}</td>
                      <td className="p-4 text-sm">{b.countryName || '—'}</td>
                      <td className="p-4 text-sm text-muted-foreground">{b.reason || '—'}</td>
                      <td className="p-4 text-sm text-muted-foreground">{format(new Date(b.createdAt), 'dd MMM yyyy')}</td>
                      <td className="p-4"><DeleteBtn onDelete={() => deleteCountryBlockMutation.mutate(b.id)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ASN Blocks */}
        <TabsContent value="asn-blocks" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button variant="gradient" size="sm" onClick={() => setAddAsnBlockOpen(true)}><Plus className="h-4 w-4 mr-2" />Blochează ASN</Button>
          </div>
          <Card className="glass-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {['ASN', 'Nume ASN', 'Motiv', 'Creat', ''].map(h => (
                      <th key={h} className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {asnBlocksLoading ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">{Array.from({ length: 5 }).map((_, j) => <td key={j} className="p-4"><Skeleton className="h-4" /></td>)}</tr>
                  )) : asnBlocks?.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Niciun ASN blocat</td></tr>
                  ) : asnBlocks?.map(b => (
                    <tr key={b.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 font-mono text-sm text-orange-300">{b.asn}</td>
                      <td className="p-4 text-sm">{b.asnName || '—'}</td>
                      <td className="p-4 text-sm text-muted-foreground">{b.reason || '—'}</td>
                      <td className="p-4 text-sm text-muted-foreground">{format(new Date(b.createdAt), 'dd MMM yyyy')}</td>
                      <td className="p-4"><DeleteBtn onDelete={() => deleteAsnBlockMutation.mutate(b.id)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ISP Blocks */}
        <TabsContent value="isp-blocks" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button variant="gradient" size="sm" onClick={() => setAddIspBlockOpen(true)}><Plus className="h-4 w-4 mr-2" />Blochează ISP</Button>
          </div>
          <Card className="glass-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {['Furnizor ISP', 'Motiv', 'Creat', ''].map(h => (
                      <th key={h} className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ispBlocksLoading ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">{Array.from({ length: 4 }).map((_, j) => <td key={j} className="p-4"><Skeleton className="h-4" /></td>)}</tr>
                  )) : ispBlocks?.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Niciun ISP blocat</td></tr>
                  ) : ispBlocks?.map(b => (
                    <tr key={b.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 text-sm font-medium">{b.ispName}</td>
                      <td className="p-4 text-sm text-muted-foreground">{b.reason || '—'}</td>
                      <td className="p-4 text-sm text-muted-foreground">{format(new Date(b.createdAt), 'dd MMM yyyy')}</td>
                      <td className="p-4"><DeleteBtn onDelete={() => deleteIspBlockMutation.mutate(b.id)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Sharing Alerts */}
        <TabsContent value="sharing" className="space-y-4 mt-4">
          {alertsLoading ? <Skeleton className="h-32" /> : alerts?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nicio alertă de partajare activă</div>
          ) : alerts?.map(alert => (
            <div key={alert.id} className="flex items-start gap-4 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 animate-fade-in">
              <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-sm">{alert.client?.username || 'Client necunoscut'}</div>
                <div className="text-xs text-muted-foreground mt-1">Detectat pe {alert.ips.length} IP-uri simultan: {alert.ips.join(', ')}</div>
                <div className="text-xs text-muted-foreground">{format(new Date(alert.createdAt), 'dd MMM yyyy HH:mm')}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => resolveAlertMutation.mutate(alert.id)}>Rezolvă</Button>
            </div>
          ))}
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="api-keys" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button variant="gradient" size="sm" onClick={() => setAddKeyOpen(true)}><Plus className="h-4 w-4 mr-2" />Cheie Nouă</Button>
          </div>
          <Card className="glass-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {['Nume', 'Cheie', 'Permisiuni', 'Ultima Utilizare', ''].map(h => (
                      <th key={h} className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keysLoading ? Array.from({ length: 2 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">{Array.from({ length: 5 }).map((_, j) => <td key={j} className="p-4"><Skeleton className="h-4" /></td>)}</tr>
                  )) : apiKeys?.map(k => (
                    <tr key={k.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 font-medium text-sm">{k.name}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{k.key.slice(0, 20)}...</span>
                          <button onClick={() => copyKey(k.key)} className="text-muted-foreground hover:text-foreground transition-colors">
                            {copiedKey === k.key ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="p-4"><div className="flex gap-1 flex-wrap">{k.permissions.map(p => <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>)}</div></td>
                      <td className="p-4 text-sm text-muted-foreground">{k.lastUsed ? format(new Date(k.lastUsed), 'dd MMM, HH:mm') : 'Niciodată'}</td>
                      <td className="p-4"><Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => revokeKeyMutation.mutate(k.id)}>Revocare</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Sessions */}
        <TabsContent value="sessions" className="space-y-4 mt-4">
          <Card className="glass-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {['Utilizator', 'IP', 'Dispozitiv', 'Ultima Activitate', 'Expiră', ''].map(h => (
                      <th key={h} className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions?.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nicio sesiune activă</td></tr>
                  ) : sessions?.map(s => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 text-sm">{s.user?.username || '—'}</td>
                      <td className="p-4 font-mono text-sm">{s.ip}</td>
                      <td className="p-4 text-sm text-muted-foreground truncate max-w-[150px]">{s.device || '—'}</td>
                      <td className="p-4 text-sm text-muted-foreground">{format(new Date(s.lastActive), 'dd MMM, HH:mm')}</td>
                      <td className="p-4 text-sm text-muted-foreground">{format(new Date(s.expiresAt), 'dd MMM yyyy')}</td>
                      <td className="p-4"><Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => killSessionMutation.mutate(s.id)}>Termină</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add IP Block Modal */}
      <Dialog open={addIpBlockOpen} onOpenChange={() => setAddIpBlockOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adaugă Bloc IP</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tip Bloc</Label>
              <Select value={ipBlockForm.blockType} onValueChange={v => setIpBlockForm(p => ({ ...p, blockType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="IP">IP</SelectItem>
                  <SelectItem value="CIDR">CIDR Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Adresă IP / Range</Label>
              <Input value={ipBlockForm.value} onChange={e => setIpBlockForm(p => ({ ...p, value: e.target.value }))} placeholder="192.168.1.1 sau 10.0.0.0/24" />
            </div>
            <div className="space-y-1.5">
              <Label>Motiv (opțional)</Label>
              <Input value={ipBlockForm.reason} onChange={e => setIpBlockForm(p => ({ ...p, reason: e.target.value }))} placeholder="Tentativă de forță brută" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setAddIpBlockOpen(false)}>Anulează</Button>
              <Button variant="gradient" onClick={() => addIpBlockMutation.mutate(ipBlockForm)} loading={addIpBlockMutation.isPending}>Blochează</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Country Block Modal */}
      <Dialog open={addCountryBlockOpen} onOpenChange={() => setAddCountryBlockOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Blochează Țară</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Cod Țară (ISO 2 litere)</Label>
              <Input
                value={countryBlockForm.countryCode}
                onChange={e => setCountryBlockForm(p => ({ ...p, countryCode: e.target.value.toUpperCase().slice(0, 2) }))}
                placeholder="ex. RO, DE, US"
                maxLength={2}
              />
              <p className="text-xs text-muted-foreground">Cod ISO 2 litere, ex: RO, DE, US, FR, GB</p>
            </div>
            <div className="space-y-1.5">
              <Label>Nume Țară (opțional)</Label>
              <Input value={countryBlockForm.countryName} onChange={e => setCountryBlockForm(p => ({ ...p, countryName: e.target.value }))} placeholder="România" />
            </div>
            <div className="space-y-1.5">
              <Label>Motiv (opțional)</Label>
              <Input value={countryBlockForm.reason} onChange={e => setCountryBlockForm(p => ({ ...p, reason: e.target.value }))} placeholder="Restricție geografică" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setAddCountryBlockOpen(false)}>Anulează</Button>
              <Button variant="gradient" onClick={() => addCountryBlockMutation.mutate(countryBlockForm)} loading={addCountryBlockMutation.isPending}>Blochează</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add ASN Block Modal */}
      <Dialog open={addAsnBlockOpen} onOpenChange={() => setAddAsnBlockOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Blochează ASN</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>ASN</Label>
              <Input value={asnBlockForm.asn} onChange={e => setAsnBlockForm(p => ({ ...p, asn: e.target.value }))} placeholder="ex. AS12345" />
            </div>
            <div className="space-y-1.5">
              <Label>Nume ASN (opțional)</Label>
              <Input value={asnBlockForm.asnName} onChange={e => setAsnBlockForm(p => ({ ...p, asnName: e.target.value }))} placeholder="ex. AS-TELEKOM" />
            </div>
            <div className="space-y-1.5">
              <Label>Motiv (opțional)</Label>
              <Input value={asnBlockForm.reason} onChange={e => setAsnBlockForm(p => ({ ...p, reason: e.target.value }))} placeholder="Rețea VPN" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setAddAsnBlockOpen(false)}>Anulează</Button>
              <Button variant="gradient" onClick={() => addAsnBlockMutation.mutate(asnBlockForm)} loading={addAsnBlockMutation.isPending}>Blochează</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add ISP Block Modal */}
      <Dialog open={addIspBlockOpen} onOpenChange={() => setAddIspBlockOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Blochează ISP</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nume ISP</Label>
              <Input value={ispBlockForm.ispName} onChange={e => setIspBlockForm(p => ({ ...p, ispName: e.target.value }))} placeholder="ex. Vodafone Romania" />
            </div>
            <div className="space-y-1.5">
              <Label>Motiv (opțional)</Label>
              <Input value={ispBlockForm.reason} onChange={e => setIspBlockForm(p => ({ ...p, reason: e.target.value }))} placeholder="Furnizor VPN" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setAddIspBlockOpen(false)}>Anulează</Button>
              <Button variant="gradient" onClick={() => addIspBlockMutation.mutate(ispBlockForm)} loading={addIspBlockMutation.isPending}>Blochează</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add API Key Modal */}
      <Dialog open={addKeyOpen} onOpenChange={() => setAddKeyOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Creare Cheie API</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nume Cheie</Label>
              <Input value={keyForm.name} onChange={e => setKeyForm(p => ({ ...p, name: e.target.value }))} placeholder="Integrarea Mea" />
            </div>
            <div className="space-y-1.5">
              <Label>Permisiuni</Label>
              <Select value={keyForm.permissions} onValueChange={v => setKeyForm(p => ({ ...p, permissions: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Doar Citire</SelectItem>
                  <SelectItem value="write">Citire și Scriere</SelectItem>
                  <SelectItem value="*">Acces Complet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setAddKeyOpen(false)}>Anulează</Button>
              <Button variant="gradient" onClick={() => addKeyMutation.mutate(keyForm)} loading={addKeyMutation.isPending}>Creează</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
