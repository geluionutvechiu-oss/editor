'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { streamsApi } from '@/lib/api'
import { DataTable, Column } from '@/components/tables/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, RefreshCw, Play, Pause } from 'lucide-react'
import type { Stream, PaginatedResponse } from '@/types'
import { getStatusBadgeClass } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { useForm } from 'react-hook-form'

export default function StreamsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['streams', page, search],
    queryFn: () => streamsApi.list({ page, search, per_page: 25 }),
  })

  const paginatedData = data?.data as PaginatedResponse<Stream> | undefined
  const streams = paginatedData?.data ?? []
  const meta = paginatedData?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => streamsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] })
      toast('Stream deleted', 'success')
    },
  })

  const restartMutation = useMutation({
    mutationFn: (id: number) => streamsApi.restart(id),
    onSuccess: () => toast('Stream restart initiated', 'success'),
  })

  const bulkMutation = useMutation({
    mutationFn: ({ ids, action }: { ids: number[]; action: string }) => streamsApi.bulkAction(ids, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] })
      setSelectedIds([])
      toast('Bulk action completed', 'success')
    },
  })

  const { register, handleSubmit, reset } = useForm()

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => streamsApi.create({
      ...data,
      stream_source: [(data.stream_url as string)],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] })
      toast('Stream created', 'success')
      setDialogOpen(false)
      reset()
    },
  })

  const columns: Column<Stream>[] = [
    {
      key: 'name',
      header: 'Stream Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.stream_icon ? (
            <img src={row.stream_icon} alt="" className="w-6 h-6 rounded object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          ) : (
            <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
              <Play className="w-3 h-3 text-muted-foreground" />
            </div>
          )}
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${getStatusBadgeClass(row.status)}`}>
          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${row.status === 'online' ? 'bg-green-400' : 'bg-red-400'}`} />
          {row.status}
        </span>
      ),
    },
    {
      key: 'current_viewers',
      header: 'Viewers',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1">
          <span className="font-medium">{row.current_viewers}</span>
          <span className="text-xs text-muted-foreground">watching</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => <Badge variant="secondary">{row.category?.name ?? '—'}</Badge>,
    },
    {
      key: 'stream_type',
      header: 'Type',
      render: (row) => <span className="text-xs text-muted-foreground capitalize">{row.stream_type}</span>,
    },
    {
      key: 'is_active',
      header: 'Active',
      render: (row) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${getStatusBadgeClass(row.is_active ? 'active' : 'suspended')}`}>
          {row.is_active ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => restartMutation.mutate(row.id)} title="Restart">
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(row.id)} title="Delete">
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
          <h2 className="text-xl font-semibold text-foreground">Streams</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{meta?.total ?? 0} streams</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Add Stream
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={streams}
        isLoading={isLoading}
        total={meta?.total ?? 0}
        page={page}
        perPage={25}
        onPageChange={setPage}
        onSearch={setSearch}
        onSort={(key, dir) => {}}
        searchPlaceholder="Search streams..."
        selectedIds={selectedIds}
        onSelectRow={(id, sel) => setSelectedIds((prev) => sel ? [...prev, id] : prev.filter((x) => x !== id))}
        onSelectAll={(sel) => setSelectedIds(sel ? streams.map((s) => s.id) : [])}
        bulkActions={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => bulkMutation.mutate({ ids: selectedIds, action: 'activate' })}>Activate</Button>
            <Button size="sm" variant="ghost" onClick={() => bulkMutation.mutate({ ids: selectedIds, action: 'deactivate' })}>Deactivate</Button>
            <Button size="sm" variant="destructive" onClick={() => bulkMutation.mutate({ ids: selectedIds, action: 'delete' })}>Delete</Button>
          </div>
        }
        emptyMessage="No streams found"
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add Stream" maxWidth="lg">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d as Record<string, unknown>))} className="space-y-4">
          <Input label="Stream Name" placeholder="CNN International" {...register('name', { required: true })} />
          <Input label="Stream URL" placeholder="http://..." {...register('stream_url', { required: true })} />
          <Input label="Stream Icon URL" placeholder="https://..." {...register('stream_icon')} />
          <Input label="EPG Channel ID" placeholder="CNN.us" {...register('epg_channel_id')} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" defaultChecked className="rounded border-border bg-input w-4 h-4 accent-primary" {...register('is_active')} />
            <span className="text-sm text-foreground">Active</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="submit" isLoading={createMutation.isPending}>Add Stream</Button>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
