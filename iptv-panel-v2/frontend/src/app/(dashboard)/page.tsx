'use client'

import { useQuery } from '@tanstack/react-query'
import { dashboardApi, liveConnectionsApi } from '@/lib/api'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { LiveConnectionsWidget } from '@/components/dashboard/LiveConnectionsWidget'
import type { DashboardStats, LiveConnection, PaginatedResponse } from '@/types'

export default function DashboardPage() {
  const { data: statsData } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.stats(),
    refetchInterval: 30000,
  })

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['dashboard-revenue'],
    queryFn: () => dashboardApi.revenue(30),
  })

  const { data: connectionsData, isLoading: connectionsLoading } = useQuery({
    queryKey: ['live-connections-widget'],
    queryFn: () => liveConnectionsApi.list({ per_page: 8 }),
    refetchInterval: 10000,
  })

  const stats = statsData?.data?.data as DashboardStats | undefined
  const revenue = revenueData?.data?.data ?? []
  const connections = (connectionsData?.data as PaginatedResponse<LiveConnection>)?.data ?? []

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <StatsCards stats={stats} />

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <RevenueChart data={revenue} isLoading={revenueLoading} />
        </div>
        <LiveConnectionsWidget connections={connections} isLoading={connectionsLoading} />
      </div>
    </div>
  )
}
