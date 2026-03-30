'use client'

import { Wifi, Globe, Monitor, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import type { LiveConnection } from '@/types'
import { timeAgo } from '@/lib/utils'

interface LiveConnectionsWidgetProps {
  connections?: LiveConnection[]
  isLoading?: boolean
}

export function LiveConnectionsWidget({ connections = [], isLoading }: LiveConnectionsWidgetProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground">Live Connections</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {connections.length} active right now
          </p>
        </div>
        <Link
          href="/live-connections"
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          View all <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-muted" />
              <div className="flex-1">
                <div className="h-3 bg-muted rounded w-32 mb-1" />
                <div className="h-2 bg-muted rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : connections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Wifi className="w-8 h-8 mb-2" />
          <p className="text-sm">No active connections</p>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.slice(0, 8).map((conn) => (
            <div key={conn.id} className="flex items-center gap-3 py-1.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-400/10">
                <Monitor className="w-4 h-4 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">
                    {conn.subscription_line?.username ?? conn.ip_address}
                  </p>
                  {conn.country_code && (
                    <span className="text-xs text-muted-foreground">{conn.country_code}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {conn.stream?.name ?? 'Unknown stream'} • {timeAgo(conn.connected_at)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
