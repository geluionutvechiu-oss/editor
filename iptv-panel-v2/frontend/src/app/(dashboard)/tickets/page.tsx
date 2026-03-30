'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketsApi } from '@/lib/api'
import { DataTable, Column } from '@/components/tables/DataTable'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Plus, MessageCircle, CheckCircle, X, RotateCcw } from 'lucide-react'
import type { Ticket, PaginatedResponse } from '@/types'
import { formatDateTime, getStatusBadgeClass, timeAgo } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { useForm } from 'react-hook-form'

export default function TicketsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [replyDialog, setReplyDialog] = useState<{ open: boolean; ticket?: Ticket }>({ open: false })
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', page, search],
    queryFn: () => ticketsApi.list({ page, search, per_page: 15 }),
  })

  const paginatedData = data?.data as PaginatedResponse<Ticket> | undefined
  const tickets = paginatedData?.data ?? []
  const meta = paginatedData?.meta

  const closeMutation = useMutation({
    mutationFn: (id: number) => ticketsApi.close(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      toast('Ticket closed', 'success')
    },
  })

  const reopenMutation = useMutation({
    mutationFn: (id: number) => ticketsApi.reopen(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      toast('Ticket reopened', 'success')
    },
  })

  const { register: registerCreate, handleSubmit: handleCreate, reset: resetCreate } = useForm()
  const { register: registerReply, handleSubmit: handleReply, reset: resetReply } = useForm()

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => ticketsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      toast('Ticket created', 'success')
      setDialogOpen(false)
      resetCreate()
    },
  })

  const replyMutation = useMutation({
    mutationFn: ({ id, message }: { id: number; message: string }) => ticketsApi.reply(id, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      toast('Reply sent', 'success')
      setReplyDialog({ open: false })
      resetReply()
    },
  })

  const columns: Column<Ticket>[] = [
    {
      key: 'subject',
      header: 'Subject',
      render: (row) => (
        <div>
          <p className="font-medium">{row.subject}</p>
          <p className="text-xs text-muted-foreground">{row.user?.name} • {timeAgo(row.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${getStatusBadgeClass(row.status)}`}>
          {row.status.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${getStatusBadgeClass(row.priority)}`}>
          {row.priority}
        </span>
      ),
    },
    { key: 'replies_count', header: 'Replies', render: (row) => <span className="text-sm">{row.replies_count ?? 0}</span> },
    {
      key: 'assigned_to',
      header: 'Assigned To',
      render: (row) => <span className="text-sm">{row.assigned_to_user?.name ?? 'Unassigned'}</span>,
    },
    { key: 'updated_at', header: 'Last Update', render: (row) => <span className="text-sm text-muted-foreground">{timeAgo(row.updated_at)}</span> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => setReplyDialog({ open: true, ticket: row })} title="Reply">
            <MessageCircle className="w-3.5 h-3.5 text-blue-400" />
          </Button>
          {row.status !== 'closed' ? (
            <Button variant="ghost" size="icon" onClick={() => closeMutation.mutate(row.id)} title="Close">
              <CheckCircle className="w-3.5 h-3.5 text-green-400" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => reopenMutation.mutate(row.id)} title="Reopen">
              <RotateCcw className="w-3.5 h-3.5 text-yellow-400" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Support Tickets</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{meta?.total ?? 0} tickets</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4" />New Ticket</Button>
      </div>

      <DataTable
        columns={columns}
        data={tickets}
        isLoading={isLoading}
        total={meta?.total ?? 0}
        page={page}
        perPage={15}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search tickets..."
        emptyMessage="No tickets found"
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Create Ticket" maxWidth="md">
        <form onSubmit={handleCreate((d) => createMutation.mutate(d as Record<string, unknown>))} className="space-y-4">
          <Input label="Subject" placeholder="Issue description" {...registerCreate('subject', { required: true })} />
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Message</label>
            <textarea className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows={4} placeholder="Describe your issue..." {...registerCreate('message', { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Priority</label>
              <select className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" {...registerCreate('priority')}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <Input label="Category" placeholder="billing, technical..." {...registerCreate('category')} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" isLoading={createMutation.isPending}>Create Ticket</Button>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={replyDialog.open} onClose={() => setReplyDialog({ open: false })} title={`Reply to: ${replyDialog.ticket?.subject}`} maxWidth="md">
        <form onSubmit={handleReply((d) => {
          if (replyDialog.ticket) replyMutation.mutate({ id: replyDialog.ticket.id, message: d.message as string })
        })} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Reply</label>
            <textarea className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows={4} placeholder="Type your reply..." {...registerReply('message', { required: true })} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" isLoading={replyMutation.isPending}>Send Reply</Button>
            <Button type="button" variant="outline" onClick={() => setReplyDialog({ open: false })}>Cancel</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
