'use client'

import { useQuery } from '@tanstack/react-query'
import { statisticsApi } from '@/lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts'
import { Users, Tv2, Radio, Activity } from 'lucide-react'

const COLORS = ['hsl(199,89%,48%)', '#22d3ee', '#a78bfa', '#f59e0b', '#34d399']

export default function StatisticsPage() {
  const { data: overviewData } = useQuery({
    queryKey: ['statistics-overview'],
    queryFn: () => statisticsApi.overview(),
  })

  const { data: usersData } = useQuery({
    queryKey: ['statistics-users'],
    queryFn: () => statisticsApi.users({ days: 30 }),
  })

  const { data: bandwidthData } = useQuery({
    queryKey: ['statistics-bandwidth'],
    queryFn: () => statisticsApi.bandwidth({ days: 7 }),
  })

  const { data: streamsData } = useQuery({
    queryKey: ['statistics-streams'],
    queryFn: () => statisticsApi.streams(),
  })

  const overview = overviewData?.data?.data
  const users = usersData?.data?.data
  const bandwidth = bandwidthData?.data?.data ?? []
  const topStreams = streamsData?.data?.data ?? []
  const roleData = users?.by_role ? Object.entries(users.by_role).map(([name, value]) => ({ name, value })) : []
  const dailySignups = users?.daily_signups ?? []

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Lines', value: overview?.total_lines ?? 0, icon: Tv2, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
          { label: 'Active Lines', value: overview?.active_lines ?? 0, icon: Activity, color: 'text-green-400', bg: 'bg-green-400/10' },
          { label: 'Total Users', value: overview?.total_users ?? 0, icon: Users, color: 'text-purple-400', bg: 'bg-purple-400/10' },
          { label: 'Live Connections', value: overview?.live_connections ?? 0, icon: Radio, color: 'text-orange-400', bg: 'bg-orange-400/10' },
        ].map((card) => (
          <div key={card.label} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-bold mt-1">{Number(card.value).toLocaleString()}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.bg}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Daily signups */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Daily Signups (30 days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailySignups.slice(-14)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 22%)" />
              <XAxis dataKey="date" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'hsl(215 20% 65%)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(222 47% 14%)', border: '1px solid hsl(217 32% 22%)', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="count" fill="hsl(199,89%,48%)" radius={[4, 4, 0, 0]} name="New Users" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Bandwidth */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Bandwidth Usage (7 days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={bandwidth} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 22%)" />
              <XAxis dataKey="date" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'hsl(215 20% 65%)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(222 47% 14%)', border: '1px solid hsl(217 32% 22%)', borderRadius: '8px', fontSize: '12px' }} />
              <Line type="monotone" dataKey="outbound_gbps" stroke="hsl(199,89%,48%)" strokeWidth={2} dot={false} name="Outbound (Gbps)" />
              <Line type="monotone" dataKey="inbound_gbps" stroke="#22d3ee" strokeWidth={2} dot={false} name="Inbound (Gbps)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* User roles */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Users by Role</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={roleData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" nameKey="name">
                {roleData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'hsl(222 47% 14%)', border: '1px solid hsl(217 32% 22%)', borderRadius: '8px', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px', color: 'hsl(215 20% 65%)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top streams */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Top Streams by Viewers</h3>
          <div className="space-y-3">
            {(topStreams as Array<{ id: number; name: string; current_viewers: number; live_connections_count: number }>).slice(0, 8).map((stream, i) => (
              <div key={stream.id} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{stream.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(100, (stream.current_viewers / Math.max(...(topStreams as Array<{current_viewers: number}>).map((s) => s.current_viewers), 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">{stream.current_viewers} viewers</span>
                  </div>
                </div>
              </div>
            ))}
            {topStreams.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No stream data</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
