import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCheck, Trash2, Bell, AlertTriangle, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import type { Notification } from '@/types';
import { getSocket } from '@/lib/socket';

const typeIcon = (t: string) => {
  const map: Record<string, React.ReactNode> = {
    INFO: <Info className="h-4 w-4 text-blue-400" />,
    WARNING: <AlertTriangle className="h-4 w-4 text-yellow-400" />,
    ERROR: <AlertCircle className="h-4 w-4 text-red-400" />,
    SUCCESS: <CheckCircle className="h-4 w-4 text-green-400" />,
  };
  return map[t] || <Bell className="h-4 w-4 text-muted-foreground" />;
};

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ data: Notification[]; total: number; unreadCount: number }>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications?limit=50').then(r => r.data),
  });

  const markReadMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/notifications/mark-read', { ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.post('/notifications/mark-all-read'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); toast({ title: 'All marked as read' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Real-time notifications via socket
  useEffect(() => {
    getSocket().on('notification', (notif: Notification) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast({ title: notif.title, description: notif.message });
    });
    return () => { getSocket().off('notification'); };
  }, [qc]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Notifications</h2>
          {data && <p className="text-sm text-muted-foreground mt-1">{data.unreadCount} unread</p>}
        </div>
        {(data?.unreadCount ?? 0) > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllMutation.mutate()} loading={markAllMutation.isPending}>
            <CheckCheck className="h-4 w-4 mr-2" />Mark All Read
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 p-4 border-b border-border/50">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /></div>
              </div>
            ))
          ) : data?.data.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No notifications yet</p>
            </div>
          ) : (
            data?.data.map(n => (
              <div key={n.id} className={`flex items-start gap-4 p-4 border-b border-border/50 hover:bg-white/[0.02] transition-colors ${!n.read ? 'bg-blue-500/[0.03]' : ''}`}>
                <div className="h-9 w-9 rounded-full border border-border bg-slate-800/50 flex items-center justify-center flex-shrink-0">
                  {typeIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{n.title}</span>
                    {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                  <span className="text-xs text-muted-foreground mt-1 block">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {!n.read && (
                    <Button size="icon-sm" variant="ghost" onClick={() => markReadMutation.mutate([n.id])} title="Mark read">
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-red-400" onClick={() => deleteMutation.mutate(n.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
