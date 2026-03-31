import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Copy, Check, Shield, AlertTriangle, Key } from 'lucide-react';
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
import type { FirewallRule, SharingAlert, ApiKey, Session } from '@/types';

export default function SecurityPage() {
  const qc = useQueryClient();
  const [addRuleOpen, setAddRuleOpen] = useState(false);
  const [addKeyOpen, setAddKeyOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({ type: 'BLACKLIST', value: '', reason: '' });
  const [keyForm, setKeyForm] = useState({ name: '', permissions: 'read' });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data: rules, isLoading: rulesLoading } = useQuery<FirewallRule[]>({ queryKey: ['firewall'], queryFn: () => api.get('/security/firewall').then(r => r.data) });
  const { data: alerts, isLoading: alertsLoading } = useQuery<SharingAlert[]>({ queryKey: ['sharing-alerts'], queryFn: () => api.get('/security/sharing-alerts').then(r => r.data) });
  const { data: apiKeys, isLoading: keysLoading } = useQuery<ApiKey[]>({ queryKey: ['api-keys'], queryFn: () => api.get('/security/api-keys').then(r => r.data) });
  const { data: sessions } = useQuery<Session[]>({ queryKey: ['sessions'], queryFn: () => api.get('/security/sessions').then(r => r.data) });

  const addRuleMutation = useMutation({
    mutationFn: (d: typeof ruleForm) => api.post('/security/firewall', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['firewall'] }); toast({ title: 'Rule added' }); setAddRuleOpen(false); setRuleForm({ type: 'BLACKLIST', value: '', reason: '' }); },
  });
  const deleteRuleMutation = useMutation({ mutationFn: (id: string) => api.delete(`/security/firewall/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['firewall'] }) });
  const resolveAlertMutation = useMutation({ mutationFn: (id: string) => api.post(`/security/sharing-alerts/${id}/resolve`), onSuccess: () => qc.invalidateQueries({ queryKey: ['sharing-alerts'] }) });
  const addKeyMutation = useMutation({
    mutationFn: (d: typeof keyForm) => api.post('/security/api-keys', { name: d.name, permissions: [d.permissions] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['api-keys'] }); toast({ title: 'API key created' }); setAddKeyOpen(false); },
  });
  const revokeKeyMutation = useMutation({ mutationFn: (id: string) => api.delete(`/security/api-keys/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }) });
  const killSessionMutation = useMutation({ mutationFn: (id: string) => api.delete(`/security/sessions/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }) });

  const copyKey = (key: string) => { navigator.clipboard.writeText(key); setCopiedKey(key); setTimeout(() => setCopiedKey(null), 2000); };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Shield className="h-5 w-5 text-blue-400" />
        </div>
        <div><h2 className="text-2xl font-bold">Security</h2><p className="text-sm text-muted-foreground">Manage firewall, sessions, and API access</p></div>
      </div>

      <Tabs defaultValue="firewall">
        <TabsList>
          <TabsTrigger value="firewall">Firewall</TabsTrigger>
          <TabsTrigger value="sharing">Sharing Alerts {alerts && alerts.length > 0 && <span className="ml-1 h-4 w-4 rounded-full bg-yellow-500 text-black text-[10px] flex items-center justify-center">{alerts.length}</span>}</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>

        {/* Firewall */}
        <TabsContent value="firewall" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="gradient" size="sm" onClick={() => setAddRuleOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Rule</Button>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-border">{['Type', 'IP / Range', 'Reason', 'Created', ''].map(h => <th key={h} className="p-4 text-left text-xs font-medium text-muted-foreground uppercase">{h}</th>)}</tr></thead>
                <tbody>
                  {rulesLoading ? Array.from({ length: 3 }).map((_, i) => <tr key={i} className="border-b border-border/50">{Array.from({ length: 5 }).map((_, j) => <td key={j} className="p-4"><Skeleton className="h-4" /></td>)}</tr>) :
                    rules?.map(r => (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                        <td className="p-4"><Badge variant={r.type === 'BLACKLIST' ? 'suspended' : 'active'}>{r.type}</Badge></td>
                        <td className="p-4 font-mono text-sm">{r.value}</td>
                        <td className="p-4 text-sm text-muted-foreground">{r.reason || '—'}</td>
                        <td className="p-4 text-sm text-muted-foreground">{format(new Date(r.createdAt), 'MMM d, yyyy')}</td>
                        <td className="p-4"><Button size="icon-sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => deleteRuleMutation.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Sharing Alerts */}
        <TabsContent value="sharing" className="space-y-4">
          {alertsLoading ? <Skeleton className="h-32" /> : alerts?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No active sharing alerts</div>
          ) : alerts?.map(alert => (
            <div key={alert.id} className="flex items-start gap-4 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10">
              <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-sm">{alert.client?.username || 'Unknown client'}</div>
                <div className="text-xs text-muted-foreground mt-1">Detected on {alert.ips.length} IPs simultaneously: {alert.ips.join(', ')}</div>
                <div className="text-xs text-muted-foreground">{format(new Date(alert.createdAt), 'MMM d, yyyy HH:mm')}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => resolveAlertMutation.mutate(alert.id)}>Resolve</Button>
            </div>
          ))}
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="api-keys" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="gradient" size="sm" onClick={() => setAddKeyOpen(true)}><Plus className="h-4 w-4 mr-2" />New Key</Button>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-border">{['Name', 'Key', 'Permissions', 'Last Used', ''].map(h => <th key={h} className="p-4 text-left text-xs font-medium text-muted-foreground uppercase">{h}</th>)}</tr></thead>
                <tbody>
                  {keysLoading ? Array.from({ length: 2 }).map((_, i) => <tr key={i} className="border-b border-border/50">{Array.from({ length: 5 }).map((_, j) => <td key={j} className="p-4"><Skeleton className="h-4" /></td>)}</tr>) :
                    apiKeys?.map(k => (
                      <tr key={k.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                        <td className="p-4 font-medium text-sm">{k.name}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">{k.key.slice(0, 20)}...</span>
                            <button onClick={() => copyKey(k.key)} className="text-muted-foreground hover:text-foreground">
                              {copiedKey === k.key ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </td>
                        <td className="p-4"><div className="flex gap-1 flex-wrap">{k.permissions.map(p => <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>)}</div></td>
                        <td className="p-4 text-sm text-muted-foreground">{k.lastUsed ? format(new Date(k.lastUsed), 'MMM d, HH:mm') : 'Never'}</td>
                        <td className="p-4"><Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => revokeKeyMutation.mutate(k.id)}>Revoke</Button></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Sessions */}
        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-border">{['User', 'IP', 'Device', 'Last Active', 'Expires', ''].map(h => <th key={h} className="p-4 text-left text-xs font-medium text-muted-foreground uppercase">{h}</th>)}</tr></thead>
                <tbody>
                  {sessions?.map(s => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                      <td className="p-4 text-sm">{s.user?.username || '—'}</td>
                      <td className="p-4 font-mono text-sm">{s.ip}</td>
                      <td className="p-4 text-sm text-muted-foreground truncate max-w-[150px]">{s.device || '—'}</td>
                      <td className="p-4 text-sm text-muted-foreground">{format(new Date(s.lastActive), 'MMM d, HH:mm')}</td>
                      <td className="p-4 text-sm text-muted-foreground">{format(new Date(s.expiresAt), 'MMM d, yyyy')}</td>
                      <td className="p-4"><Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => killSessionMutation.mutate(s.id)}>Kill</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Rule Modal */}
      <Dialog open={addRuleOpen} onOpenChange={() => setAddRuleOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Firewall Rule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Type</Label>
              <Select value={ruleForm.type} onValueChange={v => setRuleForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="BLACKLIST">Blacklist (Block)</SelectItem><SelectItem value="WHITELIST">Whitelist (Allow)</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>IP Address / Range</Label><Input value={ruleForm.value} onChange={e => setRuleForm(p => ({ ...p, value: e.target.value }))} placeholder="192.168.1.1 or 10.0.0.0/24" /></div>
            <div className="space-y-1.5"><Label>Reason (optional)</Label><Input value={ruleForm.reason} onChange={e => setRuleForm(p => ({ ...p, reason: e.target.value }))} placeholder="Brute force attempt" /></div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setAddRuleOpen(false)}>Cancel</Button>
              <Button variant="gradient" onClick={() => addRuleMutation.mutate(ruleForm)} loading={addRuleMutation.isPending}>Add Rule</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add API Key Modal */}
      <Dialog open={addKeyOpen} onOpenChange={() => setAddKeyOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create API Key</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Key Name</Label><Input value={keyForm.name} onChange={e => setKeyForm(p => ({ ...p, name: e.target.value }))} placeholder="My Integration" /></div>
            <div className="space-y-1.5"><Label>Permissions</Label>
              <Select value={keyForm.permissions} onValueChange={v => setKeyForm(p => ({ ...p, permissions: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="read">Read only</SelectItem><SelectItem value="write">Read & Write</SelectItem><SelectItem value="*">Full Access</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setAddKeyOpen(false)}>Cancel</Button>
              <Button variant="gradient" onClick={() => addKeyMutation.mutate(keyForm)} loading={addKeyMutation.isPending}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
