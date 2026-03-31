import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { format } from 'date-fns';
import { Search, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import type { AuditLog } from '@/types';

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<{ data: AuditLog[]; total: number; pages: number }>({
    queryKey: ['audit-logs', page, search],
    queryFn: () => api.get('/dashboard/audit-logs', { params: { page, limit: 50, action: search || undefined } }).then(r => r.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold">Audit Logs</h2><p className="text-sm text-muted-foreground mt-1">{data?.total ?? 0} total events</p></div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search actions..." className="w-full pl-9 h-9 rounded-lg border border-border bg-slate-800/50 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Time', 'User', 'Action', 'Resource', 'IP', 'Details'].map(h => (
                  <th key={h} className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 6 }).map((_, j) => <td key={j} className="p-4"><Skeleton className="h-4 w-full" /></td>)}
                </tr>
              )) : data?.data.map(log => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">{format(new Date(log.createdAt), 'MMM d, HH:mm:ss')}</td>
                  <td className="p-4 text-sm">{log.user?.username || <span className="text-muted-foreground">System</span>}</td>
                  <td className="p-4"><span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded border border-border">{log.action}</span></td>
                  <td className="p-4 text-sm text-muted-foreground">{log.resource || '—'}</td>
                  <td className="p-4 font-mono text-xs text-muted-foreground">{log.ip || '—'}</td>
                  <td className="p-4 text-xs text-muted-foreground">{log.details ? JSON.stringify(log.details).slice(0, 60) : '—'}</td>
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
