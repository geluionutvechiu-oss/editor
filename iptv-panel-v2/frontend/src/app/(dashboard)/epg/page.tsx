'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { epgApi } from '@/lib/api'
import { DataTable, Column } from '@/components/tables/DataTable'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, RefreshCw, Rss } from 'lucide-react'
import type { EpgSource, PaginatedResponse } from '@/types'
import { formatDateTime, getStatusBadgeClass, timeAgo } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { useForm } from 'react-hook-form'

export default function EpgPage() {
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['epg-sources', page],
    queryFn: () => epgApi.list({ page, per_page: 25 }),
  })

  const paginatedData = data?.data as PaginatedResponse<EpgSource> | undefined
  const sources = paginatedData?.data ?? []
  const meta = paginatedData?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => epgApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epg-sources'] })
      toast('EPG source deleted', 'success')
    },
  })

  const syncMutation = useMutation({
    mutationFn: (id: number) => epgApi.sync(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epg-sources'] })
      toast('EPG sync initiated', 'success')
    },
  })

  const { register, handleSubmit, reset } = useForm()

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => epgApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epg-sources'] })
      toast('EPG source added', 'success')
      setDialogOpen(false)
      reset()
    },
  })

  const columns: Column<EpgSource>[] = [
    {
      key: 'name',
      header: 'Source Name',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Rss className="w-4 h-4 text-orange-400" />
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'url',
      header: 'URL',
      render: (row) => (
        <a href={row.url} target="_blank" rel="noreferrer" className="text-primary text-sm hover:underline truncate max-w-xs block">
          {row.url}
        </a>
      ),
    },
    { key: 'channel_count', header: 'Channels', render: (row) => <span className="text-sm font-medium">{row.channel_count}</span> },
    { key: 'sync_interval_hours', header: 'Sync Interval', render: (row) => <span className="text-sm">{row.sync_interval_hours}h</span> },
    {
      key: 'last_synced_at',
      header: 'Last Synced',
      render: (row) => <span className="text-sm text-muted-foreground">{row.last_synced_at ? timeAgo(row.last_synced_at) : 'Never'}</span>,
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${getStatusBadgeClass(row.is_active ? 'active' : 'suspended')}`}>
          {row.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => syncMutation.mutate(row.id)} title="Sync now">
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
          <h2 className="text-xl font-semibold text-foreground">EPG Sources</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{meta?.total ?? 0} sources</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4" />Add Source</Button>
      </div>

      <DataTable
        columns={columns}
        data={sources}
        isLoading={isLoading}
        total={meta?.total ?? 0}
        page={page}
        perPage={25}
        onPageChange={setPage}
        emptyMessage="No EPG sources found"
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add EPG Source" maxWidth="md">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d as Record<string, unknown>))} className="space-y-4">
          <Input label="Source Name" placeholder="XMLTV Guide" {...register('name', { required: true })} />
          <Input label="URL" type="url" placeholder="https://..." {...register('url', { required: true })} />
          <Input label="Sync Interval (hours)" type="number" defaultValue={24} min={1} max={168} {...register('sync_interval_hours')} />
          <div className="flex gap-3 pt-2">
            <Button type="submit" isLoading={createMutation.isPending}>Add Source</Button>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
