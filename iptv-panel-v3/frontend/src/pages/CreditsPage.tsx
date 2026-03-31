import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus, Minus, TrendingUp, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import api from '@/lib/api';

interface CreditLog { id: string; userId: string; amount: number; type: string; description?: string; balanceBefore: number; balanceAfter: number; createdAt: string; }

export default function CreditsPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ userId: '', amount: '', description: '' });

  const { data, isLoading } = useQuery<{ data: CreditLog[]; total: number }>({
    queryKey: ['credit-logs'],
    queryFn: () => api.get('/credits/logs?limit=50').then(r => r.data),
  });

  const addMutation = useMutation({
    mutationFn: (d: any) => api.post('/credits/add', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['credit-logs'] }); setModalOpen(false); toast({ title: 'Credits updated' }); },
  });

  const totalAdded = data?.data.filter(l => l.amount > 0).reduce((a, l) => a + l.amount, 0) || 0;
  const totalDeducted = data?.data.filter(l => l.amount < 0).reduce((a, l) => a + l.amount, 0) || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Credits</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Credit transaction history and management</p>
        </div>
        <Button onClick={() => { setForm({ userId: '', amount: '', description: '' }); setModalOpen(true); }}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0">
          <CreditCard className="h-4 w-4 mr-2" /> Add Credits
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="glass-card stat-glow-blue"><CardContent className="p-4"><p className="text-muted-foreground text-xs mb-1">Transactions</p><p className="text-2xl font-bold text-blue-400">{data?.total ?? '—'}</p></CardContent></Card>
        <Card className="glass-card stat-glow-green">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Added</p>
            <p className="text-2xl font-bold text-green-400">+{totalAdded.toFixed(0)}</p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-glow-orange">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Deducted</p>
            <p className="text-2xl font-bold text-orange-400">{totalDeducted.toFixed(0)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-3"><CardTitle className="text-sm text-muted-foreground">Transaction History</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="space-y-2">{Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-12" />)}</div> : data?.total === 0 ? (
            <div className="text-center py-10 text-muted-foreground"><CreditCard className="h-10 w-10 mx-auto mb-2 opacity-20" /><p>No transactions</p></div>
          ) : (
            <div className="space-y-1">
              {data?.data.map(log => (
                <div key={log.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors border border-transparent hover:border-white/[0.05]">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${log.amount > 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {log.amount > 0 ? <Plus className="h-4 w-4 text-green-400" /> : <Minus className="h-4 w-4 text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{log.description || log.type}</p>
                    <p className="text-xs text-muted-foreground font-mono">User: {log.userId.slice(0, 8)}… · {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${log.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {log.amount > 0 ? '+' : ''}{log.amount}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">{log.balanceBefore} → {log.balanceAfter}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="glass-card border-white/10 max-w-md">
          <DialogHeader><DialogTitle>Add / Deduct Credits</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>User ID *</Label><Input className="mt-1 bg-white/5 border-white/10 font-mono" placeholder="User UUID" value={form.userId} onChange={e => setForm(p => ({ ...p, userId: e.target.value }))} /></div>
            <div>
              <Label>Amount *</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Use negative value to deduct (e.g. -50)</p>
              <Input className="mt-1 bg-white/5 border-white/10" type="number" placeholder="100 or -50" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div><Label>Description</Label><Input className="mt-1 bg-white/5 border-white/10" placeholder="Monthly top-up, penalty, etc." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 border-0"
                onClick={() => addMutation.mutate({ ...form, amount: parseFloat(form.amount) })}
                disabled={addMutation.isPending}>
                {addMutation.isPending ? 'Processing...' : 'Apply Credits'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
