'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { serversApi } from '@/lib/api'
import { DataTable, Column } from '@/components/tables/DataTable'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Server, Activity, Wifi } from 'lucide-react'
import type { Server as ServerType, PaginatedResponse } from '@/types'
import { formatDateTime, getStatusBadgeClass } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { useForm } from 'react-hook-form'

export default function ServersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['servers', page, search],
    queryFn: () => serversApi.list({ page, search, per_page: 15 }),
  })

  const paginatedData = data?.data as PaginatedResponse<ServerType> | undefined
  const servers = paginatedData?.data ?? []
  const meta = paginatedData?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => serversApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] })
      toast('Server deleted', 'success')
    },
  })

  const testMutation = useMutation({
    mutationFn: (id: number) => serversApi.test(id),
    onSuccess: (res) => {
      toast(res.data.message, 'success')
      queryClient.invalidateQueries({ queryKey: ['servers'] })
    },
  })

  const { register, handleSubmit, reset } = useForm()

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => serversApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] })
      toast('Server added', 'success')
      setDialogOpen(false)
      reset()
    },
  })

  const columns: Column<ServerType>[] = [
    {
      key: 'name',
      header: 'Server',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${row.is_active ? 'bg-green-400/10' : 'bg-muted'}`}>
            <Server className={`w-4 h-4 ${row.is_active ? 'text-green-400' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <p className="font-medium">{row.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{row.ip_address}:{row.http_port}</p>
          </div>
        </div>
      ),
    },
    { key: 'server_type', header: 'Type', render: (row) => <span className="text-xs text-muted-foreground capitalize">{row.server_type.replace('_', ' ')}</span> },
    {
      key: 'cpu_usage',
      header: 'CPU',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${row.cpu_usage ?? 0}%` }} />
          </div>
          <span className="text-xs">{row.cpu_usage ?? 0}%</span>
        </div>
      ),
    },
    {
      key: 'ram_usage',
      header: 'RAM',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${row.ram_usage ?? 0}%` }} />
          </div>
          <span className="text-xs">{row.ram_usage ?? 0}%</span>
        </div>
      ),
    },
    { key: 'total_connections', header: 'Connections', render: (row) => <span className="text-sm font-medium">{row.total_connections}</span> },
    { key: 'streams_count', header: 'Streams', render: (row) => <span className="text-sm">{row.streams_count ?? 0}</span> },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border ${getStatusBadgeClass(row.is_active ? 'active' : 'suspended')}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${row.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
          {row.is_active ? 'Online' : 'Offline'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => testMutation.mutate(row.id)} title="Test connection">
            <Wifi className="w-3.5 h-3.5 text-blue-400" />
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
          <h2 className="text-xl font-semibold text-foreground">Servers</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{meta?.total ?? 0} servers</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4" />Add Server</Button>
      </div>

      <DataTable
        columns={columns}
        data={servers}
        isLoading={isLoading}
        total={meta?.total ?? 0}
        page={page}
        perPage={15}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search servers..."
        emptyMessage="No servers found"
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add Server" maxWidth="md">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d as Record<string, unknown>))} className="space-y-4">
          <Input label="Server Name" placeholder="Main Server US" {...register('name', { required: true })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="IP Address" placeholder="192.168.1.10" {...register('ip_address', { required: true })} />
            <Input label="HTTP Port" type="number" defaultValue={8080} {...register('http_port')} />
          </div>
          <Input label="Domain" placeholder="us1.youriptv.com" {...register('domain')} />
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Server Type</label>
            <select className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" {...register('server_type')}>
              <option value="main">Main</option>
              <option value="load_balancer">Load Balancer</option>
              <option value="edge">Edge</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" isLoading={createMutation.isPending}>Add Server</Button>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
