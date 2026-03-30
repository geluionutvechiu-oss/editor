'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { subscriptionLinesApi } from '@/lib/api'
import { DataTable, Column } from '@/components/tables/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { Plus, Play, Pause, RefreshCw, Trash2, Eye } from 'lucide-react'
import type { SubscriptionLine, PaginatedResponse } from '@/types'
import { formatDate, getStatusBadgeClass } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'

export default function SubscriptionLinesPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['subscription-lines', page, search, sortBy, sortDir],
    queryFn: () => subscriptionLinesApi.list({ page, search, per_page: 15, sort_by: sortBy, sort_dir: sortDir }),
  })

  const paginatedData = data?.data as PaginatedResponse<SubscriptionLine> | undefined
  const lines = paginatedData?.data ?? []
  const meta = paginatedData?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => subscriptionLinesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-lines'] })
      toast('Line deleted', 'success')
    },
  })

  const suspendMutation = useMutation({
    mutationFn: (id: number) => subscriptionLinesApi.suspend(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-lines'] })
      toast('Line suspended', 'success')
    },
  })

  const activateMutation = useMutation({
    mutationFn: (id: number) => subscriptionLinesApi.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-lines'] })
      toast('Line activated', 'success')
    },
  })

  const getLineStatus = (line: SubscriptionLine) => {
    if (!line.is_active) return 'suspended'
    if (line.expires_at && new Date(line.expires_at) < new Date()) return 'expired'
    if (line.is_trial) return 'trial'
    return 'active'
  }

  const columns: Column<SubscriptionLine>[] = [
    {
      key: 'username',
      header: 'Username',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.username}</p>
          <p className="text-xs text-muted-foreground">{row.package?.name ?? 'No package'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const status = getLineStatus(row)
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${getStatusBadgeClass(status)}`}>
            {status}
          </span>
        )
      },
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (row) => <span className="text-sm">{row.owner?.name ?? '—'}</span>,
    },
    {
      key: 'max_connections',
      header: 'Connections',
      render: (row) => (
        <span className="text-sm text-center">{row.max_connections}</span>
      ),
    },
    {
      key: 'expires_at',
      header: 'Expires',
      sortable: true,
      render: (row) => {
        const expired = row.expires_at && new Date(row.expires_at) < new Date()
        return (
          <span className={`text-sm ${expired ? 'text-red-400' : 'text-foreground'}`}>
            {formatDate(row.expires_at)}
          </span>
        )
      },
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (row) => <span className="text-sm text-muted-foreground">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          {row.is_active ? (
            <Button variant="ghost" size="icon" onClick={() => suspendMutation.mutate(row.id)} title="Suspend">
              <Pause className="w-3.5 h-3.5 text-yellow-400" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => activateMutation.mutate(row.id)} title="Activate">
              <Play className="w-3.5 h-3.5 text-green-400" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteMutation.mutate(row.id)}
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Subscription Lines</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{meta?.total ?? 0} total lines</p>
        </div>
        <Link href="/subscriptions/lines/create">
          <Button>
            <Plus className="w-4 h-4" />
            New Line
          </Button>
        </Link>
      </div>

      <DataTable
        columns={columns}
        data={lines}
        isLoading={isLoading}
        total={meta?.total ?? 0}
        page={page}
        perPage={15}
        onPageChange={setPage}
        onSearch={setSearch}
        onSort={(key, dir) => { setSortBy(key); setSortDir(dir) }}
        searchPlaceholder="Search lines..."
        selectedIds={selectedIds}
        onSelectRow={(id, selected) =>
          setSelectedIds((prev) => selected ? [...prev, id] : prev.filter((x) => x !== id))
        }
        onSelectAll={(selected) =>
          setSelectedIds(selected ? lines.map((l) => l.id) : [])
        }
        emptyMessage="No subscription lines found"
      />
    </div>
  )
}
