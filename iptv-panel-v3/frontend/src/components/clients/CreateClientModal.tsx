import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import type { Client, Plan, Server } from '@/types';

const schema = z.object({
  username: z.string().min(3).optional(),
  password: z.string().min(4).optional(),
  planId: z.string().optional(),
  serverId: z.string().optional(),
  expiresAt: z.string().min(1, 'Expiry date required'),
  maxConnections: z.number().int().min(1).max(100).default(1),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props { open: boolean; onClose: () => void; onCreated: (client: Client) => void; }

function randomPass() {
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

function defaultExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0] + 'T00:00:00.000Z';
}

export function CreateClientModal({ open, onClose, onCreated }: Props) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { maxConnections: 1, expiresAt: defaultExpiry() },
  });

  const { data: plans } = useQuery<Plan[]>({ queryKey: ['plans'], queryFn: () => api.get('/plans').then(r => r.data) });
  const { data: servers } = useQuery<Server[]>({ queryKey: ['servers'], queryFn: () => api.get('/servers').then(r => r.data) });

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/clients', data),
    onSuccess: (res) => {
      toast({ title: 'Client created', description: `${res.data.client.username} created successfully` });
      onCreated(res.data.client);
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create client';
      toast({ title: 'Error', description: typeof msg === 'string' ? msg : 'Validation error', variant: 'destructive' });
    },
  });

  const selectedPlan = plans?.find(p => p.id === watch('planId'));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Client</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Username <span className="text-muted-foreground text-xs">(optional, auto-generated)</span></Label>
              <Input {...register('username')} placeholder="Auto-generated" />
              {errors.username && <p className="text-xs text-red-400">{errors.username.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <div className="flex gap-2">
                <Input {...register('password')} placeholder="Auto-generated" className="flex-1" />
                <Button type="button" size="icon" variant="outline" onClick={() => setValue('password', randomPass())} title="Generate">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select onValueChange={(v) => { setValue('planId', v); const p = plans?.find(p => p.id === v); if (p) setValue('maxConnections', p.maxConnections); }}>
                <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                <SelectContent>
                  {plans?.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — ${p.price}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Server</Label>
              <Select onValueChange={(v) => setValue('serverId', v)}>
                <SelectTrigger><SelectValue placeholder="Select server" /></SelectTrigger>
                <SelectContent>
                  {servers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <Input type="date" {...register('expiresAt')} onChange={(e) => setValue('expiresAt', new Date(e.target.value).toISOString())} defaultValue={new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]} />
              {errors.expiresAt && <p className="text-xs text-red-400">{errors.expiresAt.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Max Connections</Label>
              <Input type="number" {...register('maxConnections', { valueAsNumber: true })} min={1} max={100} />
            </div>
          </div>

          {selectedPlan && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-400">
              Plan includes: {selectedPlan.bouquets.join(', ')}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input {...register('notes')} placeholder="Internal notes" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="gradient" loading={mutation.isPending}>Create Client</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
