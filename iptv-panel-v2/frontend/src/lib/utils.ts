import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return format(new Date(date), 'MMM d, yyyy')
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return format(new Date(date), 'MMM d, yyyy HH:mm')
}

export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    online: 'text-green-400',
    offline: 'text-red-400',
    error: 'text-orange-400',
    restarting: 'text-yellow-400',
    active: 'text-green-400',
    suspended: 'text-red-400',
    expired: 'text-orange-400',
    trial: 'text-blue-400',
    open: 'text-blue-400',
    closed: 'text-gray-400',
    in_progress: 'text-yellow-400',
    resolved: 'text-green-400',
  }
  return map[status] ?? 'text-gray-400'
}

export function getStatusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    online: 'bg-green-500/20 text-green-400 border-green-500/30',
    offline: 'bg-red-500/20 text-red-400 border-red-500/30',
    error: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    suspended: 'bg-red-500/20 text-red-400 border-red-500/30',
    expired: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    open: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    critical: 'bg-red-600/20 text-red-300 border-red-600/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }
  return map[status] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
}
