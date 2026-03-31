import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Download, MoreHorizontal, Key, RefreshCw, Pause, Play, Trash2, Filter } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { CreateClientModal } from '@/components/clients/CreateClientModal';
import { CredentialsModal } from '@/components/clients/CredentialsModal';
import api from '@/lib/api';
import type { Client, PaginatedResponse } from '@/types';

type StatusFilter = 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';

export default function ClientsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [selected, setSelected] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [credentialsClient, setCredentialsClient] = useState<Client | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const { data, isLoading } = useQuery<PaginatedResponse<Client>>({
    queryKey: ['clients', page, search, status],
    queryFn: () => api.get('/clients', { params: { page, limit: 25, search: search || undefined, status: status === 'ALL' ? undefined : status } }).then(r => r.data),
  });

  const suspendMutation = useMutation({ mutationFn: (id: string) => api.post(`/clients/${id}/suspend`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast({ title: 'Client suspended' }); } });
  const activateMutation = useMutation({ mutationFn: (id: string) => api.post(`/clients/${id}/activate`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast({ title: 'Client activated', variant: 'success' } as never); } });
  const deleteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/clients/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast({ title: 'Client deleted', variant: 'destructive' }); } });
  const bulkMutation = useMutation({ mutationFn: (body: object) => api.post('/clients/bulk', body), onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setSelected([]); toast({ title: 'Bulk action applied' }); } });

  const toggleSelect = (id: string) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const selectAll = () => setSelected(data?.data.map(c => c.id) || []);

  const statusBadge = (s: string) => {
    const map: Record<string, 'active' | 'suspended' | 'expired'> = { ACTIVE: 'active', SUSPENDED: 'suspended', EXPIRED: 'expired' };
    return <Badge variant={map[s] || 'default'}>{s}</Badge>;
  };

  const exportCSV = () => { window.open('/api/clients/export', '_blank'); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Clients</h2>
          <p className="text-sm text-muted-foreground mt-1">{data?.total ?? 0} total clients</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
          <Button variant="gradient" size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />New Client</Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search clients..."
              className="w-full pl-9 h-9 rounded-lg border border-border bg-slate-800/50 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['ALL', 'ACTIVE', 'SUSPENDED', 'EXPIRED'] as StatusFilter[]).map(s => (
              <button key={s} onClick={() => { setStatus(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${status === s ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'border border-border text-muted-foreground hover:text-foreground'}`}>
                {s}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-blue-500/30 bg-blue-500/10">
          <span className="text-sm font-medium text-blue-400">{selected.length} selected</span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="ghost" onClick={() => bulkMutation.mutate({ ids: selected, action: 'activate' })}>Activate</Button>
            <Button size="sm" variant="ghost" onClick={() => bulkMutation.mutate({ ids: selected, action: 'suspend' })}>Suspend</Button>
            <Button size="sm" variant="ghost" onClick={() => bulkMutation.mutate({ ids: selected, action: 'renew', days: 30 })}>Renew 30d</Button>
            <Button size="sm" variant="destructive" onClick={() => bulkMutation.mutate({ ids: selected, action: 'delete' })}>Delete</Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="p-4 w-8"><input type="checkbox" className="rounded" onChange={e => e.target.checked ? selectAll() : setSelected([])} checked={selected.length === data?.data.length && data?.data.length > 0} /></th>
                <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Username</th>
                <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Plan</th>
                <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Expires</th>
                <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Devices</th>
                <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Seen</th>
                <th className="p-4 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 8 }).map((_, j) => <td key={j} className="p-4"><Skeleton className="h-4 w-full" /></td>)}
                </tr>
              )) : data?.data.map((client) => (
                <tr key={client.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors group">
                  <td className="p-4"><input type="checkbox" className="rounded" checked={selected.includes(client.id)} onChange={() => toggleSelect(client.id)} /></td>
                  <td className="p-4">
                    <div className="font-medium text-sm">{client.username}</div>
                    <div className="text-xs text-muted-foreground">{client.maxConnections} max connections</div>
                  </td>
                  <td className="p-4">{statusBadge(client.status)}</td>
                  <td className="p-4 text-sm text-muted-foreground">{client.plan?.name || '—'}</td>
                  <td className="p-4">
                    <div className="text-sm">{format(new Date(client.expiresAt), 'MMM d, yyyy')}</div>
                    <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(client.expiresAt), { addSuffix: true })}</div>
                  </td>
                  <td className="p-4 text-sm">{client.deviceCount}/{client.maxConnections}</td>
                  <td className="p-4 text-sm text-muted-foreground">{client.lastSeen ? formatDistanceToNow(new Date(client.lastSeen), { addSuffix: true }) : '—'}</td>
                  <td className="p-4">
                    <div className="relative">
                      <Button size="icon-sm" variant="ghost" onClick={() => setOpenMenu(openMenu === client.id ? null : client.id)}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                      {openMenu === client.id && (
                        <div className="absolute right-0 top-8 w-44 rounded-xl border border-border bg-slate-900 shadow-2xl z-50 py-1" onBlur={() => setOpenMenu(null)}>
                          <button onClick={() => { setCredentialsClient(client); setOpenMenu(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-white/[0.04]"><Key className="h-3.5 w-3.5 text-muted-foreground" />Credentials</button>
                          <button onClick={() => { setOpenMenu(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-white/[0.04]"><RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />Renew</button>
                          {client.status === 'ACTIVE'
                            ? <button onClick={() => { suspendMutation.mutate(client.id); setOpenMenu(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-white/[0.04] text-yellow-400"><Pause className="h-3.5 w-3.5" />Suspend</button>
                            : <button onClick={() => { activateMutation.mutate(client.id); setOpenMenu(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-white/[0.04] text-green-400"><Play className="h-3.5 w-3.5" />Activate</button>
                          }
                          <div className="border-t border-border my-1" />
                          <button onClick={() => { if (confirm('Delete this client?')) { deleteMutation.mutate(client.id); setOpenMenu(null); } }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" />Delete</button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <span className="text-sm text-muted-foreground">Page {page} of {data.pages} ({data.total} total)</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      <CreateClientModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(client) => { setCredentialsClient(client); qc.invalidateQueries({ queryKey: ['clients'] }); }} />
      {credentialsClient && <CredentialsModal client={credentialsClient} open={!!credentialsClient} onClose={() => setCredentialsClient(null)} />}
    </div>
  );
}
