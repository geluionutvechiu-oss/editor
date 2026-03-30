'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '@/lib/api'
import { DataTable, Column } from '@/components/tables/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, User, ToggleLeft } from 'lucide-react'
import type { User as UserType, PaginatedResponse } from '@/types'
import { formatDate, getStatusBadgeClass, timeAgo } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { useForm } from 'react-hook-form'

export default function UsersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => usersApi.list({ page, search, per_page: 15 }),
  })

  const paginatedData = data?.data as PaginatedResponse<UserType> | undefined
  const users = paginatedData?.data ?? []
  const meta = paginatedData?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast('User deleted', 'success')
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (id: number) => usersApi.toggleStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast('Status updated', 'success')
    },
  })

  const { register, handleSubmit, reset } = useForm()

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast('User created', 'success')
      setDialogOpen(false)
      reset()
    },
  })

  const columns: Column<UserType>[] = [
    {
      key: 'name',
      header: 'User',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-medium">{row.name}</p>
            <p className="text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <Badge variant={row.role === 'admin' ? 'default' : row.role === 'reseller' ? 'secondary' : 'outline'} className="capitalize">
          {row.role}
        </Badge>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${getStatusBadgeClass(row.is_active ? 'active' : 'suspended')}`}>
          {row.is_active ? 'Active' : 'Suspended'}
        </span>
      ),
    },
    { key: 'country', header: 'Country', render: (row) => <span className="text-sm">{row.country ?? '—'}</span> },
    {
      key: 'last_login_at',
      header: 'Last Login',
      render: (row) => <span className="text-sm text-muted-foreground">{row.last_login_at ? timeAgo(row.last_login_at) : 'Never'}</span>,
    },
    { key: 'created_at', header: 'Joined', render: (row) => <span className="text-sm text-muted-foreground">{formatDate(row.created_at)}</span> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => toggleMutation.mutate(row.id)} title="Toggle status">
            <ToggleLeft className="w-3.5 h-3.5 text-yellow-400" />
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
          <h2 className="text-xl font-semibold text-foreground">Users</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{meta?.total ?? 0} users</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4" />Add User</Button>
      </div>

      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        total={meta?.total ?? 0}
        page={page}
        perPage={15}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search users..."
        emptyMessage="No users found"
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add User" maxWidth="md">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d as Record<string, unknown>))} className="space-y-4">
          <Input label="Name" placeholder="John Doe" {...register('name', { required: true })} />
          <Input label="Email" type="email" placeholder="john@example.com" {...register('email', { required: true })} />
          <Input label="Password" type="password" placeholder="••••••••" {...register('password', { required: true })} />
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Role</label>
            <select className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" {...register('role', { required: true })}>
              <option value="user">User</option>
              <option value="reseller">Reseller</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" isLoading={createMutation.isPending}>Create User</Button>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
