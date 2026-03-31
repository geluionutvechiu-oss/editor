import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CreditCard, Users } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import type { User } from '@/types';

const createSchema = z.object({ email: z.string().email(), username: z.string().min(3), password: z.string().min(6), credits: z.number().default(0) });
const creditSchema = z.object({ amount: z.number().positive(), type: z.enum(['add', 'subtract']) });

export default function ResellersPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [creditReseller, setCreditReseller] = useState<User | null>(null);

  const { data: resellers, isLoading } = useQuery<User[]>({ queryKey: ['resellers'], queryFn: () => api.get('/resellers').then(r => r.data) });

  const createForm = useForm<z.infer<typeof createSchema>>({ resolver: zodResolver(createSchema) });
  const creditForm = useForm<z.infer<typeof creditSchema>>({ resolver: zodResolver(creditSchema), defaultValues: { type: 'add' } });

  const createMutation = useMutation({
    mutationFn: (d: z.infer<typeof createSchema>) => api.post('/resellers', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['resellers'] }); toast({ title: 'Reseller created' }); setCreateOpen(false); createForm.reset(); },
  });

  const creditMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: z.infer<typeof creditSchema> }) => api.post(`/resellers/${id}/credits`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['resellers'] }); toast({ title: 'Credits updated' }); setCreditReseller(null); creditForm.reset(); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold">Resellers</h2><p className="text-sm text-muted-foreground mt-1">{resellers?.length ?? 0} resellers</p></div>
        <Button variant="gradient" size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />New Reseller</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Username', 'Email', 'Status', 'Credits', 'Clients', 'Actions'].map(h => (
                  <th key={h} className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 6 }).map((_, j) => <td key={j} className="p-4"><Skeleton className="h-4 w-full" /></td>)}
                </tr>
              )) : resellers?.map(r => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-medium text-sm">{r.username}</td>
                  <td className="p-4 text-sm text-muted-foreground">{r.email}</td>
                  <td className="p-4"><Badge variant={r.status === 'ACTIVE' ? 'active' : 'suspended'}>{r.status}</Badge></td>
                  <td className="p-4"><span className="font-semibold gradient-text">{r.credits}</span></td>
                  <td className="p-4 text-sm">{(r._count as { iptvClients: number })?.iptvClients ?? 0}</td>
                  <td className="p-4">
                    <Button size="sm" variant="outline" onClick={() => setCreditReseller(r)}><CreditCard className="h-3.5 w-3.5 mr-1" />Credits</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Modal */}
      <Dialog open={createOpen} onOpenChange={() => setCreateOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Reseller</DialogTitle></DialogHeader>
          <form onSubmit={createForm.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Email</Label><Input {...createForm.register('email')} type="email" /></div>
              <div className="space-y-1.5"><Label>Username</Label><Input {...createForm.register('username')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Password</Label><Input {...createForm.register('password')} type="password" /></div>
              <div className="space-y-1.5"><Label>Initial Credits</Label><Input type="number" {...createForm.register('credits', { valueAsNumber: true })} defaultValue={0} /></div>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gradient" loading={createMutation.isPending}>Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Credits Modal */}
      <Dialog open={!!creditReseller} onOpenChange={() => setCreditReseller(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage Credits — {creditReseller?.username}</DialogTitle></DialogHeader>
          <form onSubmit={creditForm.handleSubmit(d => creditMutation.mutate({ id: creditReseller!.id, data: d }))} className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-800/50 border border-border text-center">
              <div className="text-sm text-muted-foreground">Current Balance</div>
              <div className="text-3xl font-bold gradient-text mt-1">{creditReseller?.credits ?? 0}</div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => creditForm.setValue('type', 'add')} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${creditForm.watch('type') === 'add' ? 'border-green-500/30 bg-green-500/15 text-green-400' : 'border-border text-muted-foreground'}`}>Add</button>
              <button type="button" onClick={() => creditForm.setValue('type', 'subtract')} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${creditForm.watch('type') === 'subtract' ? 'border-red-500/30 bg-red-500/15 text-red-400' : 'border-border text-muted-foreground'}`}>Subtract</button>
            </div>
            <div className="space-y-1.5"><Label>Amount</Label><Input type="number" step="0.01" {...creditForm.register('amount', { valueAsNumber: true })} /></div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setCreditReseller(null)}>Cancel</Button>
              <Button type="submit" variant="gradient" loading={creditMutation.isPending}>Apply</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
