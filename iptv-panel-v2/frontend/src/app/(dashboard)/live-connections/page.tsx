'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { liveConnectionsApi } from '@/lib/api'
import { DataTable, Column } from '@/components/tables/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Monitor, Wifi, Trash2, AlertTriangle } from 'lucide-react'
import type { LiveConnection, PaginatedResponse } from '@/types'
import { formatDateTime, timeAgo, formatBytes } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'

export default function LiveConnectionsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['live-connections', page, search],
    queryFn: () => liveConnectionsApi.list({ page, search, per_page: 25 }),
    refetchInterval: 10000,
  })

  const paginatedData = data?.data as PaginatedResponse<LiveConnection> | undefined
  const connections = paginatedData?.data ?? []
  const meta = paginatedData?.meta

  const kickMutation = useMutation({
    mutationFn: (id: number) => liveConnectionsApi.kick(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-connections'] })
      toast('Connection terminated', 'success')
    },
  })

  const kickAllMutation = useMutation({
    mutationFn: () => liveConnectionsApi.kickAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-connections'] })
      toast('All connections terminated', 'success')
    },
  })

  const columns: Column<LiveConnection>[] = [
    {
      key: 'subscription_line',
      header: 'Username',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-muted-foreground" />
          <span>{row.subscription_line?.username ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'stream',
      header: 'Stream',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Wifi className="w-3.5 h-3.5 text-green-400" />
          <span className="text-sm">{row.stream?.name ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'ip_address',
      header: 'IP Address',
      render: (row) => <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{row.ip_address}</code>,
    },
    {
      key: 'country_code',
      header: 'Country',
      render: (row) => <Badge variant="secondary">{row.country_code ?? '—'}</Badge>,
    },
    { key: 'isp', header: 'ISP', render: (row) => <span className="text-sm text-muted-foreground">{row.isp ?? '—'}</span> },
    {
      key: 'connected_at',
      header: 'Connected',
      render: (row) => <span className="text-sm text-muted-foreground">{timeAgo(row.connected_at)}</span>,
    },
    {
      key: 'bytes_transferred',
      header: 'Data',
      render: (row) => <span className="text-sm">{formatBytes(row.bytes_transferred)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => kickMutation.mutate(row.id)}
          isLoading={kickMutation.isPending}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Live Connections</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {meta?.total ?? 0} active connections — auto-refreshes every 10s
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => kickAllMutation.mutate()}
          isLoading={kickAllMutation.isPending}
        >
          <AlertTriangle className="w-4 h-4" />
          Kick All
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={connections}
        isLoading={isLoading}
        total={meta?.total ?? 0}
        page={page}
        perPage={25}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search by username or IP..."
        emptyMessage="No active connections"
      />
    </div>
  )
}
