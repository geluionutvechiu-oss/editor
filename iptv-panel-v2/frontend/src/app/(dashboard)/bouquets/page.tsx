'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bouquetsApi } from '@/lib/api'
import { DataTable, Column } from '@/components/tables/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, List } from 'lucide-react'
import type { Bouquet, PaginatedResponse } from '@/types'
import { getStatusBadgeClass } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { useForm } from 'react-hook-form'

export default function BouquetsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['bouquets', page, search],
    queryFn: () => bouquetsApi.list({ page, search, per_page: 25 }),
  })

  const paginatedData = data?.data as PaginatedResponse<Bouquet> | undefined
  const bouquets = paginatedData?.data ?? []
  const meta = paginatedData?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => bouquetsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bouquets'] })
      toast('Bouquet deleted', 'success')
    },
  })

  const { register, handleSubmit, reset } = useForm()

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => bouquetsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bouquets'] })
      toast('Bouquet created', 'success')
      setDialogOpen(false)
      reset()
    },
  })

  const columns: Column<Bouquet>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div className="flex items-center gap-2">
          <List className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (row) => <Badge variant="secondary" className="capitalize">{row.type}</Badge> },
    { key: 'streams_count', header: 'Streams', render: (row) => <span className="text-sm font-medium">{row.streams_count ?? 0}</span> },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${getStatusBadgeClass(row.is_active ? 'active' : 'suspended')}`}>
          {row.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    { key: 'sort_order', header: 'Order', render: (row) => <span className="text-sm text-muted-foreground">{row.sort_order}</span> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(row.id)}>
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Bouquets</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{meta?.total ?? 0} bouquets</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4" />Create Bouquet</Button>
      </div>

      <DataTable
        columns={columns}
        data={bouquets}
        isLoading={isLoading}
        total={meta?.total ?? 0}
        page={page}
        perPage={25}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search bouquets..."
        emptyMessage="No bouquets found"
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Create Bouquet">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d as Record<string, unknown>))} className="space-y-4">
          <Input label="Name" placeholder="Sports Pack" {...register('name', { required: true })} />
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Type</label>
            <select className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" {...register('type')}>
              <option value="live">Live</option>
              <option value="movie">Movie</option>
              <option value="series">Series</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
            <textarea className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows={2} {...register('description')} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" isLoading={createMutation.isPending}>Create</Button>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
