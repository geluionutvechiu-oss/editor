'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { packagesApi } from '@/lib/api'
import { DataTable, Column } from '@/components/tables/DataTable'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Package, DollarSign } from 'lucide-react'
import type { Package as PackageType, PaginatedResponse } from '@/types'
import { getStatusBadgeClass } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { useForm } from 'react-hook-form'

export default function PackagesPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['packages', page, search],
    queryFn: () => packagesApi.list({ page, search, per_page: 25 }),
  })

  const paginatedData = data?.data as PaginatedResponse<PackageType> | undefined
  const packages = paginatedData?.data ?? []
  const meta = paginatedData?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => packagesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] })
      toast('Package deleted', 'success')
    },
  })

  const { register, handleSubmit, reset } = useForm()

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => packagesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] })
      toast('Package created', 'success')
      setDialogOpen(false)
      reset()
    },
  })

  const columns: Column<PackageType>[] = [
    {
      key: 'name',
      header: 'Package Name',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          <div>
            <p className="font-medium">{row.name}</p>
            {row.is_trial && <span className="text-xs text-blue-400">Trial</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      render: (row) => (
        <div className="flex items-center gap-1 text-sm font-medium">
          <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
          {Number(row.price).toFixed(2)}
        </div>
      ),
    },
    { key: 'duration_days', header: 'Duration', render: (row) => <span className="text-sm">{row.duration_days} days</span> },
    { key: 'max_connections', header: 'Max Conn.', render: (row) => <span className="text-sm font-medium">{row.max_connections}</span> },
    { key: 'subscription_lines_count', header: 'Lines', render: (row) => <span className="text-sm">{row.subscription_lines_count ?? 0}</span> },
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
          <h2 className="text-xl font-semibold text-foreground">Packages</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{meta?.total ?? 0} packages</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4" />Create Package</Button>
      </div>

      <DataTable
        columns={columns}
        data={packages}
        isLoading={isLoading}
        total={meta?.total ?? 0}
        page={page}
        perPage={25}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search packages..."
        emptyMessage="No packages found"
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Create Package" maxWidth="md">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d as Record<string, unknown>))} className="space-y-4">
          <Input label="Package Name" placeholder="Premium Monthly" {...register('name', { required: true })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Price ($)" type="number" step="0.01" placeholder="9.99" {...register('price', { required: true })} />
            <Input label="Duration (days)" type="number" placeholder="30" {...register('duration_days', { required: true })} />
          </div>
          <Input label="Max Connections" type="number" min={1} max={10} defaultValue={1} {...register('max_connections', { required: true })} />
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
            <textarea className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows={2} {...register('description')} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" defaultChecked className="rounded border-border bg-input w-4 h-4 accent-primary" {...register('is_active')} />
            <span className="text-sm text-foreground">Active</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="submit" isLoading={createMutation.isPending}>Create Package</Button>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
