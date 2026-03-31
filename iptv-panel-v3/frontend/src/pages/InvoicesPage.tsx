import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, FileText } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import type { Invoice, PaginatedResponse } from '@/types';

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery<PaginatedResponse<Invoice>>({
    queryKey: ['invoices', page, status],
    queryFn: () => api.get('/invoices', { params: { page, limit: 25, status: status || undefined } }).then(r => r.data),
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => api.put(`/invoices/${id}/status`, { status: 'PAID' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast({ title: 'Invoice marked as paid' }); },
  });

  const downloadPDF = (id: string) => window.open(`/api/invoices/${id}/pdf`, '_blank');

  const statusVariant = (s: string): 'paid' | 'pending' | 'overdue' => ({ PAID: 'paid', PENDING: 'pending', OVERDUE: 'overdue' }[s] as 'paid' | 'pending' | 'overdue') || 'pending';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold">Invoices</h2><p className="text-sm text-muted-foreground mt-1">{data?.total ?? 0} total invoices</p></div>
      </div>

      <div className="flex gap-2">
        {['', 'PAID', 'PENDING', 'OVERDUE'].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${status === s ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'border border-border text-muted-foreground hover:text-foreground'}`}>
            {s || 'ALL'}
          </button>
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Invoice #', 'Client', 'Amount', 'Status', 'Due Date', 'Actions'].map(h => (
                  <th key={h} className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 6 }).map((_, j) => <td key={j} className="p-4"><Skeleton className="h-4 w-full" /></td>)}
                </tr>
              )) : data?.data.map(inv => (
                <tr key={inv.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4"><span className="font-mono text-sm font-medium">{inv.invoiceNumber}</span></td>
                  <td className="p-4 text-sm">{inv.client?.username || '—'}</td>
                  <td className="p-4"><span className="font-semibold">${inv.amount.toFixed(2)}</span></td>
                  <td className="p-4"><Badge variant={statusVariant(inv.status)}>{inv.status}</Badge></td>
                  <td className="p-4 text-sm text-muted-foreground">{format(new Date(inv.dueDate), 'MMM d, yyyy')}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      {inv.status !== 'PAID' && <Button size="sm" variant="ghost" onClick={() => markPaidMutation.mutate(inv.id)}>Mark Paid</Button>}
                      <Button size="icon-sm" variant="ghost" onClick={() => downloadPDF(inv.id)} title="Download PDF"><Download className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <span className="text-sm text-muted-foreground">Page {page} of {data.pages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
