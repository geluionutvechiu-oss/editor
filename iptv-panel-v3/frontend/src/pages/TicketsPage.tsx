import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, LifeBuoy, MessageSquare, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import api from '@/lib/api';

interface Ticket { id: string; subject: string; message: string; status: string; priority: string; clientName?: string; clientEmail?: string; response?: string; createdAt: string; updatedAt: string; }

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  OPEN: { label: 'Open', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Clock },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', icon: AlertTriangle },
  RESOLVED: { label: 'Resolved', color: 'bg-green-500/10 text-green-400 border-green-500/20', icon: CheckCircle },
  CLOSED: { label: 'Closed', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: CheckCircle },
};
const priorityColor: Record<string, string> = { LOW: 'text-slate-400', MEDIUM: 'text-blue-400', HIGH: 'text-orange-400', URGENT: 'text-red-400' };

export default function TicketsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [response, setResponse] = useState('');
  const [form, setForm] = useState({ subject: '', message: '', priority: 'MEDIUM', clientName: '', clientEmail: '' });

  const { data, isLoading } = useQuery<{ data: Ticket[]; total: number }>({
    queryKey: ['tickets', statusFilter],
    queryFn: () => api.get(`/tickets?${statusFilter ? `status=${statusFilter}&` : ''}limit=50`).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post('/tickets', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets'] }); setModalOpen(false); toast({ title: 'Ticket created' }); },
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, resp }: { id: string; resp: string }) => api.post(`/tickets/${id}/respond`, { response: resp }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets'] }); setDetailOpen(false); toast({ title: 'Response sent' }); },
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/tickets/${id}/resolve`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets'] }); setDetailOpen(false); toast({ title: 'Ticket resolved' }); },
  });

  const counts = data?.data.reduce((acc: Record<string, number>, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {}) || {};

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Support Tickets</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage customer support requests</p>
        </div>
        <Button onClick={() => { setForm({ subject: '', message: '', priority: 'MEDIUM', clientName: '', clientEmail: '' }); setModalOpen(true); }}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0">
          <Plus className="h-4 w-4 mr-2" /> New Ticket
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(statusConfig).map(([s, cfg]) => {
          const Icon = cfg.icon;
          return (
            <Card key={s} className={`glass-card cursor-pointer transition-all ${statusFilter === s ? 'ring-1 ring-blue-500/50' : ''}`} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-muted-foreground text-xs">{cfg.label}</p>
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">{counts[s] || 0}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-3"><CardTitle className="text-sm text-muted-foreground">{data?.total ?? 0} tickets {statusFilter ? `· ${statusConfig[statusFilter]?.label}` : ''}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16" />)}</div> : data?.total === 0 ? (
            <div className="text-center py-10 text-muted-foreground"><LifeBuoy className="h-10 w-10 mx-auto mb-2 opacity-20" /><p>No tickets</p></div>
          ) : (
            <div className="space-y-2">
              {data?.data.map(ticket => {
                const sc = statusConfig[ticket.status] || statusConfig.OPEN;
                return (
                  <div key={ticket.id} className="flex items-start gap-3 px-4 py-3 rounded-xl glass-hover cursor-pointer border border-transparent hover:border-white/[0.06]" onClick={() => { setSelected(ticket); setResponse(ticket.response || ''); setDetailOpen(true); }}>
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{ticket.subject}</p>
                        <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 ${sc.color}`}>{sc.label}</span>
                        <span className={`text-[10px] font-semibold ${priorityColor[ticket.priority]}`}>{ticket.priority}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{ticket.clientName || 'Anonymous'} {ticket.clientEmail ? `· ${ticket.clientEmail}` : ''}</p>
                    </div>
                    <p className="text-xs text-muted-foreground flex-shrink-0">{formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="glass-card border-white/10 max-w-lg">
          <DialogHeader><DialogTitle>New Support Ticket</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Subject *</Label><Input className="mt-1 bg-white/5 border-white/10" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Client Name</Label><Input className="mt-1 bg-white/5 border-white/10" value={form.clientName} onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))} /></div>
              <div><Label>Client Email</Label><Input className="mt-1 bg-white/5 border-white/10" type="email" value={form.clientEmail} onChange={e => setForm(p => ({ ...p, clientEmail: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                <SelectTrigger className="mt-1 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent>{['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Message *</Label><textarea className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground resize-none h-24" value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 border-0" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>Create Ticket</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="glass-card border-white/10 max-w-2xl">
          <DialogHeader><DialogTitle>{selected?.subject}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="glass rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Message from {selected.clientName || 'Anonymous'}</p>
                <p className="text-sm whitespace-pre-wrap">{selected.message}</p>
              </div>
              {selected.response && (
                <div className="glass rounded-xl p-4 border-l-2 border-blue-500/50">
                  <p className="text-xs text-blue-400 mb-1">Response</p>
                  <p className="text-sm whitespace-pre-wrap">{selected.response}</p>
                </div>
              )}
              <div>
                <Label>Response</Label>
                <textarea className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground resize-none h-24" value={response} onChange={e => setResponse(e.target.value)} placeholder="Type your response..." />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="border-green-500/30 text-green-400 hover:bg-green-500/10" onClick={() => resolveMutation.mutate(selected.id)} disabled={selected.status === 'RESOLVED'}>
                  <CheckCircle className="h-4 w-4 mr-2" /> Mark Resolved
                </Button>
                <Button className="ml-auto bg-gradient-to-r from-blue-600 to-purple-600 border-0" onClick={() => respondMutation.mutate({ id: selected.id, resp: response })} disabled={respondMutation.isPending}>
                  <MessageSquare className="h-4 w-4 mr-2" /> Send Response
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
