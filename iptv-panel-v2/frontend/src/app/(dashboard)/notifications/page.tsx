'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Bell, Check, CheckCheck, Trash2, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import type { Notification, PaginatedResponse } from '@/types'
import { timeAgo } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'

const typeIcons = {
  info: <Info className="w-4 h-4 text-blue-400" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  success: <CheckCircle className="w-4 h-4 text-green-400" />,
  error: <XCircle className="w-4 h-4 text-red-400" />,
}

export default function NotificationsPage() {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', page],
    queryFn: () => notificationsApi.list({ page, per_page: 20 }),
  })

  const paginatedData = data?.data as PaginatedResponse<Notification> | undefined
  const notifications = paginatedData?.data ?? []
  const meta = paginatedData?.meta

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast('All notifications marked as read', 'success')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Notifications</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {meta?.unread_count ?? 0} unread of {meta?.total ?? 0} total
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => markAllReadMutation.mutate()}
          isLoading={markAllReadMutation.isPending}
        >
          <CheckCheck className="w-4 h-4" /> Mark All Read
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />
          ))
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-card border border-border rounded-xl">
            <Bell className="w-10 h-10 mb-3" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className={cn(
                'flex items-start gap-4 p-4 bg-card border rounded-xl transition-colors',
                notif.is_read ? 'border-border' : 'border-primary/30 bg-primary/5'
              )}
            >
              <div className={cn('flex items-center justify-center w-9 h-9 rounded-lg shrink-0', {
                'bg-blue-400/10': notif.type === 'info',
                'bg-yellow-400/10': notif.type === 'warning',
                'bg-green-400/10': notif.type === 'success',
                'bg-red-400/10': notif.type === 'error',
              })}>
                {typeIcons[notif.type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm text-foreground">{notif.title}</p>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgo(notif.created_at)}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!notif.is_read && (
                  <Button variant="ghost" size="icon" onClick={() => markReadMutation.mutate(notif.id)} title="Mark as read">
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(notif.id)} title="Delete">
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {meta && meta.last_page > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: meta.last_page }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={cn(
                'w-8 h-8 text-xs rounded-md transition-colors',
                p === page ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
