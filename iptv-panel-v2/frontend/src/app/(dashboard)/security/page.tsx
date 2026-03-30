'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { securityApi } from '@/lib/api'
import { DataTable, Column } from '@/components/tables/DataTable'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Shield, Trash2, Plus, AlertTriangle, List, Lock } from 'lucide-react'
import type { BlockedIp, PaginatedResponse } from '@/types'
import { formatDateTime, timeAgo } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { useForm } from 'react-hook-form'

type Tab = 'blocked-ips' | 'audit-log'

export default function SecurityPage() {
  const [tab, setTab] = useState<Tab>('blocked-ips')
  const [page, setPage] = useState(1)
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: blockedData, isLoading: blockedLoading } = useQuery({
    queryKey: ['blocked-ips', page],
    queryFn: () => securityApi.blockedIps({ page, per_page: 25 }),
    enabled: tab === 'blocked-ips',
  })

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-log', page],
    queryFn: () => securityApi.auditLog({ page, per_page: 25 }),
    enabled: tab === 'audit-log',
  })

  const paginatedBlocked = blockedData?.data as PaginatedResponse<BlockedIp> | undefined
  const blockedIps = paginatedBlocked?.data ?? []
  const blockedMeta = paginatedBlocked?.meta

  const auditLogs = (auditData?.data as { data: unknown[]; meta: Record<string, unknown> } | undefined)?.data ?? []
  const auditMeta = (auditData?.data as { data: unknown[]; meta: { total?: number; current_page?: number; last_page?: number } } | undefined)?.meta

  const unblockMutation = useMutation({
    mutationFn: (id: number) => securityApi.unblockIp(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-ips'] })
      toast('IP unblocked', 'success')
    },
  })

  const { register, handleSubmit, reset } = useForm()

  const blockMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => securityApi.blockIp(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-ips'] })
      toast('IP blocked', 'success')
      setBlockDialogOpen(false)
      reset()
    },
  })

  const ipColumns: Column<BlockedIp>[] = [
    {
      key: 'ip_address',
      header: 'IP Address',
      render: (row) => <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{row.ip_address}</code>,
    },
    { key: 'reason', header: 'Reason', render: (row) => <span className="text-sm">{row.reason ?? '—'}</span> },
    {
      key: 'is_permanent',
      header: 'Type',
      render: (row) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${row.is_permanent ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>
          {row.is_permanent ? 'Permanent' : 'Temporary'}
        </span>
      ),
    },
    {
      key: 'expires_at',
      header: 'Expires',
      render: (row) => <span className="text-sm text-muted-foreground">{row.expires_at ? formatDateTime(row.expires_at) : row.is_permanent ? '∞ Never' : '—'}</span>,
    },
    {
      key: 'blocked_by_user',
      header: 'Blocked By',
      render: (row) => <span className="text-sm">{row.blocked_by_user?.name ?? '—'}</span>,
    },
    { key: 'created_at', header: 'Blocked At', render: (row) => <span className="text-sm text-muted-foreground">{timeAgo(row.created_at)}</span> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button variant="ghost" size="icon" onClick={() => unblockMutation.mutate(row.id)} title="Unblock">
          <Trash2 className="w-3.5 h-3.5 text-green-400" />
        </Button>
      ),
    },
  ]

  const tabs = [
    { id: 'blocked-ips' as Tab, label: 'Blocked IPs', icon: Lock },
    { id: 'audit-log' as Tab, label: 'Audit Log', icon: List },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Security</h2>
          <p className="text-sm text-muted-foreground mt-0.5">IP blocking and audit logs</p>
        </div>
        {tab === 'blocked-ips' && (
          <Button onClick={() => setBlockDialogOpen(true)}>
            <Plus className="w-4 h-4" /> Block IP
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setPage(1) }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'blocked-ips' && (
        <DataTable
          columns={ipColumns}
          data={blockedIps}
          isLoading={blockedLoading}
          total={blockedMeta?.total ?? 0}
          page={page}
          perPage={25}
          onPageChange={setPage}
          emptyMessage="No blocked IPs"
        />
      )}

      {tab === 'audit-log' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Action</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Model</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">IP</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {auditLoading ? (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
              ) : auditLogs.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No audit logs</td></tr>
              ) : (
                (auditLogs as Array<{ id: number; user_name?: string; action: string; model_type?: string; ip_address?: string; created_at: string }>).map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">{log.user_name ?? '—'}</td>
                    <td className="px-4 py-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{log.action}</code></td>
                    <td className="px-4 py-3 text-muted-foreground">{log.model_type ?? '—'}</td>
                    <td className="px-4 py-3"><code className="text-xs">{log.ip_address ?? '—'}</code></td>
                    <td className="px-4 py-3 text-muted-foreground">{timeAgo(log.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={blockDialogOpen} onClose={() => setBlockDialogOpen(false)} title="Block IP Address" maxWidth="sm">
        <form onSubmit={handleSubmit((d) => blockMutation.mutate(d as Record<string, unknown>))} className="space-y-4">
          <Input label="IP Address" placeholder="192.168.1.1" {...register('ip_address', { required: true })} />
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Reason</label>
            <textarea className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" rows={2} {...register('reason')} />
          </div>
          <Input label="Expires At (optional)" type="datetime-local" {...register('expires_at')} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded border-border bg-input w-4 h-4 accent-primary" {...register('is_permanent')} />
            <span className="text-sm text-foreground">Permanent block</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="destructive" isLoading={blockMutation.isPending}>Block IP</Button>
            <Button type="button" variant="outline" onClick={() => setBlockDialogOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
