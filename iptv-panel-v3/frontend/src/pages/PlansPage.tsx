import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Package, Users, Clock } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import type { Plan } from '@/types';

const schema = z.object({
  name: z.string().min(1), description: z.string().optional(),
  durationDays: z.number().int().min(1), maxConnections: z.number().int().min(1),
  price: z.number().min(0), bouquets: z.string(),
  isActive: z.boolean().default(true),
});
type FormData = z.infer<typeof schema>;

export default function PlansPage() {
  const qc = useQueryClient();
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: plans, isLoading } = useQuery<Plan[]>({ queryKey: ['plans'], queryFn: () => api.get('/plans').then(r => r.data) });

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: (d: FormData) => api.post('/plans', { ...d, bouquets: d.bouquets.split(',').map(s => s.trim()).filter(Boolean) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plans'] }); toast({ title: 'Plan created' }); setModalOpen(false); reset(); },
    onError: () => toast({ title: 'Error creating plan', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) => api.put(`/plans/${id}`, { ...data, bouquets: data.bouquets.split(',').map(s => s.trim()).filter(Boolean) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plans'] }); toast({ title: 'Plan updated' }); setEditPlan(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/plans/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plans'] }); toast({ title: 'Plan deleted', variant: 'destructive' }); },
  });

  const openCreate = () => { reset({ maxConnections: 1, durationDays: 30, isActive: true }); setModalOpen(true); };
  const openEdit = (p: Plan) => { setEditPlan(p); setValue('name', p.name); setValue('description', p.description || ''); setValue('durationDays', p.durationDays); setValue('maxConnections', p.maxConnections); setValue('price', p.price); setValue('bouquets', p.bouquets.join(', ')); setValue('isActive', p.isActive); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold">Plans</h2><p className="text-sm text-muted-foreground mt-1">Subscription packages</p></div>
        <Button variant="gradient" size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Plan</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />) :
          plans?.map(plan => (
            <Card key={plan.id} className={`relative overflow-hidden ${!plan.isActive ? 'opacity-60' : ''}`}>
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-600" />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    {plan.description && <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>}
                  </div>
                  {!plan.isActive && <Badge variant="secondary">Inactive</Badge>}
                </div>
                <div className="text-3xl font-bold gradient-text">${plan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{plan.durationDays}d</span>
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{plan.maxConnections} conn</span>
                  <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" />{plan._count?.clients ?? 0} clients</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {plan.bouquets.slice(0, 4).map(b => <span key={b} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-border text-muted-foreground">{b}</span>)}
                  {plan.bouquets.length > 4 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-border text-muted-foreground">+{plan.bouquets.length - 4}</span>}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(plan)}><Edit2 className="h-3.5 w-3.5 mr-1" />Edit</Button>
                  <Button size="icon-sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => { if (confirm('Delete plan?')) deleteMutation.mutate(plan.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen || !!editPlan} onOpenChange={() => { setModalOpen(false); setEditPlan(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editPlan ? 'Edit Plan' : 'New Plan'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(d => editPlan ? updateMutation.mutate({ id: editPlan.id, data: d }) : createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Name</Label><Input {...register('name')} />{errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}</div>
              <div className="space-y-1.5"><Label>Price ($)</Label><Input type="number" step="0.01" {...register('price', { valueAsNumber: true })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Duration (days)</Label><Input type="number" {...register('durationDays', { valueAsNumber: true })} /></div>
              <div className="space-y-1.5"><Label>Max Connections</Label><Input type="number" {...register('maxConnections', { valueAsNumber: true })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Description</Label><Input {...register('description')} placeholder="Optional description" /></div>
            <div className="space-y-1.5"><Label>Bouquets <span className="text-muted-foreground text-xs">(comma-separated)</span></Label><Input {...register('bouquets')} placeholder="Sports, Movies, News" /></div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => { setModalOpen(false); setEditPlan(null); }}>Cancel</Button>
              <Button type="submit" variant="gradient" loading={createMutation.isPending || updateMutation.isPending}>{editPlan ? 'Save' : 'Create'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
