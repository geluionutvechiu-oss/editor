'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vodSeriesApi } from '@/lib/api'
import { DataTable, Column } from '@/components/tables/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Star, Tv2 } from 'lucide-react'
import type { VodSeries, PaginatedResponse } from '@/types'
import { formatDate, getStatusBadgeClass } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'

export default function VodSeriesPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['vod-series', page, search],
    queryFn: () => vodSeriesApi.list({ page, search, per_page: 25 }),
  })

  const paginatedData = data?.data as PaginatedResponse<VodSeries> | undefined
  const series = paginatedData?.data ?? []
  const meta = paginatedData?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => vodSeriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vod-series'] })
      toast('Series deleted', 'success')
    },
  })

  const columns: Column<VodSeries>[] = [
    {
      key: 'name',
      header: 'Title',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.cover ? (
            <img src={row.cover} alt={row.name} className="w-8 h-10 rounded object-cover" />
          ) : (
            <div className="w-8 h-10 rounded bg-muted flex items-center justify-center">
              <Tv2 className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="font-medium">{row.name}</p>
            {row.release_year && <p className="text-xs text-muted-foreground">{row.release_year}</p>}
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (row) => <Badge variant="secondary">{row.category?.name ?? '—'}</Badge> },
    {
      key: 'episodes_count',
      header: 'Episodes',
      render: (row) => <span className="text-sm">{row.episodes_count ?? 0}</span>,
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (row) => row.rating ? (
        <div className="flex items-center gap-1">
          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
          <span className="text-sm">{row.rating}</span>
        </div>
      ) : <span className="text-muted-foreground">—</span>,
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
    { key: 'created_at', header: 'Added', render: (row) => <span className="text-sm text-muted-foreground">{formatDate(row.created_at)}</span> },
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
          <h2 className="text-xl font-semibold text-foreground">VOD Series</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{meta?.total ?? 0} series</p>
        </div>
        <Button><Plus className="w-4 h-4" />Add Series</Button>
      </div>

      <DataTable
        columns={columns}
        data={series}
        isLoading={isLoading}
        total={meta?.total ?? 0}
        page={page}
        perPage={25}
        onPageChange={setPage}
        onSearch={setSearch}
        searchPlaceholder="Search series..."
        emptyMessage="No series found"
      />
    </div>
  )
}
