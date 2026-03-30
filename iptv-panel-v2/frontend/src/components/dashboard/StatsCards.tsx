'use client'

import { Users, Tv2, Wifi, Server, TrendingUp, TrendingDown, Clock, AlertTriangle } from 'lucide-react'
import type { DashboardStats } from '@/types'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  trend?: { value: number; label: string }
  iconColor?: string
  iconBg?: string
}

function StatCard({ title, value, subtitle, icon: Icon, trend, iconColor = 'text-primary', iconBg = 'bg-primary/10' }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={cn('flex items-center justify-center w-10 h-10 rounded-lg', iconBg)}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-3">
          {trend.value >= 0 ? (
            <TrendingUp className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
          )}
          <span className={cn('text-xs font-medium', trend.value >= 0 ? 'text-green-400' : 'text-red-400')}>
            {trend.value >= 0 ? '+' : ''}{trend.value}
          </span>
          <span className="text-xs text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </div>
  )
}

interface StatsCardsProps {
  stats?: DashboardStats
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Active Lines"
        value={stats?.lines.active ?? 0}
        subtitle={`${stats?.lines.total ?? 0} total lines`}
        icon={Tv2}
        iconColor="text-cyan-400"
        iconBg="bg-cyan-400/10"
        trend={{ value: stats?.lines.new_today ?? 0, label: 'new today' }}
      />
      <StatCard
        title="Live Connections"
        value={stats?.connections.live ?? 0}
        subtitle="Currently streaming"
        icon={Wifi}
        iconColor="text-green-400"
        iconBg="bg-green-400/10"
      />
      <StatCard
        title="Total Users"
        value={stats?.users.total ?? 0}
        subtitle={`${stats?.users.resellers ?? 0} resellers`}
        icon={Users}
        iconColor="text-purple-400"
        iconBg="bg-purple-400/10"
      />
      <StatCard
        title="Active Streams"
        value={stats?.streams.active ?? 0}
        subtitle={`${stats?.streams.total ?? 0} total streams`}
        icon={Server}
        iconColor="text-orange-400"
        iconBg="bg-orange-400/10"
      />
      <StatCard
        title="Expiring Today"
        value={stats?.lines.expiring_today ?? 0}
        subtitle="Need renewal"
        icon={Clock}
        iconColor="text-yellow-400"
        iconBg="bg-yellow-400/10"
      />
      <StatCard
        title="Expired Lines"
        value={stats?.lines.expired ?? 0}
        subtitle="Need attention"
        icon={AlertTriangle}
        iconColor="text-red-400"
        iconBg="bg-red-400/10"
      />
      <StatCard
        title="Servers Online"
        value={stats?.servers.online ?? 0}
        subtitle="Active servers"
        icon={Server}
        iconColor="text-blue-400"
        iconBg="bg-blue-400/10"
      />
      <StatCard
        title="New This Week"
        value={stats?.lines.new_this_week ?? 0}
        subtitle="New subscriptions"
        icon={TrendingUp}
        iconColor="text-emerald-400"
        iconBg="bg-emerald-400/10"
      />
    </div>
  )
}
