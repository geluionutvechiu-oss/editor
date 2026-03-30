'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { resellersApi } from '@/lib/api'
import { DataTable, Column } from '@/components/tables/DataTable'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, UserCheck, DollarSign, PlusCircle } from 'lucide-react'
import type { User as UserType, PaginatedResponse } from '@/types'
import { formatDate, getStatusBadgeClass } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { useForm } from 'react-hook-form'

export default function ResellersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creditsDialog, setCreditsDialog] = useState<{ open: boolean; id?: number }>({ open: false })
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['resellers', page, search],
    queryFn: () => resellersApi.list({ page, search, per_page: 15 }),
  })

  const paginatedData = data?.data as PaginatedResponse<UserType> | undefined
  const resellers = paginatedData?.data ?? []
  const meta = paginatedData?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => resellersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resellers'] })
      toast('Reseller deleted', 'success')
    },
  })

  const { register: registerCreate, handleSubmit: handleCreate, reset: resetCreate } = useForm()
  const { register: registerCredits, handleSubmit: handleCredits, reset: resetCredits } = useForm()

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => resellersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resellers'] })
      toast('Reseller created', 'success')
      setDialogOpen(false)
      resetCreate()
    },
  })

  const creditsMutation = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) => resellersApi.addCredits(id, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resellers'] })
      toast('Credits added', 'success')
      setCreditsDialog({ open: false })
      resetCredits()
    },
  })

  const columns: Column<UserType>[] = [
    {
      key: 'name',
      header: 'Reseller',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-400/10 flex items-center justify-center">
            <UserCheck className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <p className="font-medium">{row.name}</p>
            <p className="text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'credits',
      header: 'Credits',
      render: (row) => (
        <div className="flex items-center gap-1 font-medium">
          <DollarSign className="w-3.5 h-3.5 text-yellow-400" />
          {Number(row.credits ?? 0).toFixed(2)}
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (row) => <span className="text-sm">{row.phone ?? '—'}</span> },
    { key: 'country', header: 'Country', render: (row) => <span className="text-sm">{row.country ?? '—'}</span> },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${getStatusBadgeClass(row.is_active ? 'active' : 'suspended')}`}>
          {row.is_active ? 'Active' : 'Suspended'}
        </span>
      ),
    },
    { key: 'created_at', header: 'Joined', render: (row) => <span className="text-sm text-muted-foreground">{formatDate(row.created_at)}</span> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => setCreditsDialog({ open: true, id: row.id })} title="Add credits">
            <PlusCircle className="w-3.5 h-3.5 text-yellow-400" />
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
          <h2 className="text-xl font-semibold text-foreground">Resellers</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{meta?.total ?? 0} resellers</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4" />Add Reseller</Button>
      </div>

      <DataTable
        columns={columns}
        data={resellers}
        isLoading={isLoading}
        total={meta?.total ?? 0}
        page={page}
        perPage={15}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search resellers..."
        emptyMessage="No resellers found"
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add Reseller" maxWidth="md">
        <form onSubmit={handleCreate((d) => createMutation.mutate(d as Record<string, unknown>))} className="space-y-4">
          <Input label="Name" placeholder="John's IPTV" {...registerCreate('name', { required: true })} />
          <Input label="Email" type="email" placeholder="john@example.com" {...registerCreate('email', { required: true })} />
          <Input label="Password" type="password" placeholder="••••••••" {...registerCreate('password', { required: true })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone" placeholder="+1234567890" {...registerCreate('phone')} />
            <Input label="Country" placeholder="US" {...registerCreate('country')} />
          </div>
          <Input label="Initial Credits" type="number" step="0.01" defaultValue="0" {...registerCreate('credits')} />
          <div className="flex gap-3 pt-2">
            <Button type="submit" isLoading={createMutation.isPending}>Create Reseller</Button>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={creditsDialog.open} onClose={() => setCreditsDialog({ open: false })} title="Add Credits" maxWidth="sm">
        <form onSubmit={handleCredits((d) => {
          if (creditsDialog.id) {
            creditsMutation.mutate({ id: creditsDialog.id, amount: Number(d.amount) })
          }
        })} className="space-y-4">
          <Input label="Amount ($)" type="number" step="0.01" placeholder="10.00" {...registerCredits('amount', { required: true })} />
          <div className="flex gap-3 pt-2">
            <Button type="submit" isLoading={creditsMutation.isPending}>Add Credits</Button>
            <Button type="button" variant="outline" onClick={() => setCreditsDialog({ open: false })}>Cancel</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
