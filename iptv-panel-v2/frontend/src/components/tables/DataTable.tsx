'use client'

import { useState } from 'react'
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Loader2,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface Column<T> {
  key: keyof T | string
  header: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  width?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  isLoading?: boolean
  total?: number
  page?: number
  perPage?: number
  onPageChange?: (page: number) => void
  onSearch?: (query: string) => void
  onSort?: (key: string, dir: 'asc' | 'desc') => void
  searchPlaceholder?: string
  title?: string
  actions?: React.ReactNode
  selectedIds?: number[]
  onSelectAll?: (selected: boolean) => void
  onSelectRow?: (id: number, selected: boolean) => void
  rowKey?: (row: T) => number | string
  bulkActions?: React.ReactNode
  emptyMessage?: string
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  total = 0,
  page = 1,
  perPage = 15,
  onPageChange,
  onSearch,
  onSort,
  searchPlaceholder = 'Search...',
  title,
  actions,
  selectedIds = [],
  onSelectAll,
  onSelectRow,
  rowKey,
  bulkActions,
  emptyMessage = 'No data found',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string>('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSearch = (value: string) => {
    setSearch(value)
    onSearch?.(value)
  }

  const handleSort = (key: string) => {
    if (!onSort) return
    const newDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc'
    setSortKey(key)
    setSortDir(newDir)
    onSort(key, newDir)
  }

  const totalPages = Math.ceil(total / perPage)
  const allSelected = data.length > 0 && data.every((row) => {
    const id = rowKey ? rowKey(row) : (row as { id: number }).id
    return selectedIds.includes(Number(id))
  })

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      {(title || actions || onSearch || bulkActions) && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3 flex-1">
            {title && <h3 className="font-medium text-foreground text-sm">{title}</h3>}
            {selectedIds.length > 0 && bulkActions && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{selectedIds.length} selected</span>
                {bulkActions}
              </div>
            )}
            {onSearch && (
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-9 pr-3 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {onSelectRow && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => onSelectAll?.(e.target.checked)}
                    className="rounded border-border bg-input w-4 h-4 accent-primary cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn(
                    'text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap',
                    col.sortable && 'cursor-pointer hover:text-foreground select-none',
                    col.width
                  )}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                  style={{ width: col.width }}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === String(col.key) && (
                      sortDir === 'asc'
                        ? <ChevronUp className="w-3 h-3" />
                        : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length + (onSelectRow ? 1 : 0)} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-sm">Loading...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (onSelectRow ? 1 : 0)} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Inbox className="w-8 h-8" />
                    <span className="text-sm">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const id = rowKey ? rowKey(row) : (row as { id: number }).id
                const isSelected = selectedIds.includes(Number(id))
                return (
                  <tr
                    key={String(id ?? idx)}
                    className={cn(
                      'hover:bg-muted/20 transition-colors',
                      isSelected && 'bg-primary/5'
                    )}
                  >
                    {onSelectRow && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => onSelectRow(Number(id), e.target.checked)}
                          className="rounded border-border bg-input w-4 h-4 accent-primary cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={String(col.key)} className="px-4 py-3 text-foreground">
                        {col.render
                          ? col.render(row)
                          : String((row as Record<string, unknown>)[String(col.key)] ?? '—')}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = i + 1
              return (
                <button
                  key={p}
                  onClick={() => onPageChange?.(p)}
                  className={cn(
                    'w-8 h-8 text-xs rounded-md transition-colors',
                    p === page
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  {p}
                </button>
              )
            })}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
