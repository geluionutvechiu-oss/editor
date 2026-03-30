'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { enigma2Api } from '@/lib/api'
import { DataTable, Column } from '@/components/tables/DataTable'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'
import type { Enigma2Device, PaginatedResponse } from '@/types'
import { formatDate, getStatusBadgeClass } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { useForm } from 'react-hook-form'

export default function Enigma2Page() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['enigma2', page, search],
    queryFn: () => enigma2Api.list({ page, search, per_page: 15 }),
  })

  const paginatedData = data?.data as PaginatedResponse<Enigma2Device> | undefined
  const devices = paginatedData?.data ?? []
  const meta = paginatedData?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => enigma2Api.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enigma2'] })
      toast('Device deleted', 'success')
    },
  })

  const { register, handleSubmit, reset } = useForm()

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => enigma2Api.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enigma2'] })
      toast('Enigma2 device added', 'success')
      setDialogOpen(false)
      reset()
    },
  })

  const columns: Column<Enigma2Device>[] = [
    {
      key: 'mac_address',
      header: 'MAC Address',
      render: (row) => <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{row.mac_address}</code>,
    },
    { key: 'owner', header: 'Owner', render: (row) => <span>{row.owner?.name ?? '—'}</span> },
    { key: 'device_model', header: 'Model', render: (row) => <span>{row.device_model ?? '—'}</span> },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${getStatusBadgeClass(row.is_active ? 'active' : 'suspended')}`}>
          {row.is_active ? 'Active' : 'Suspended'}
        </span>
      ),
    },
    { key: 'expires_at', header: 'Expires', render: (row) => <span>{formatDate(row.expires_at)}</span> },
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
          <h2 className="text-xl font-semibold text-foreground">Enigma2 Devices</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{meta?.total ?? 0} devices</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Add Device
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={devices}
        isLoading={isLoading}
        total={meta?.total ?? 0}
        page={page}
        perPage={15}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search by MAC..."
        emptyMessage="No Enigma2 devices found"
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add Enigma2 Device">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d as Record<string, unknown>))} className="space-y-4">
          <Input label="MAC Address" placeholder="00:1A:2B:3C:4D:5E" {...register('mac_address', { required: true })} />
          <Input label="Device Model" placeholder="VU+ Duo4K" {...register('device_model')} />
          <Input label="Expires At" type="datetime-local" {...register('expires_at')} />
          <div className="flex gap-3 pt-2">
            <Button type="submit" isLoading={createMutation.isPending}>Add Device</Button>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
