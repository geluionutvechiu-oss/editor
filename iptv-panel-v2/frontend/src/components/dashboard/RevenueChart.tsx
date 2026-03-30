'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'

interface RevenueChartProps {
  data?: { date: string; new_lines: number; revenue: number }[]
  isLoading?: boolean
}

export function RevenueChart({ data = [], isLoading }: RevenueChartProps) {
  const chartData = data.slice(-30).map((d) => ({
    ...d,
    date: format(new Date(d.date), 'MMM d'),
  }))

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground">New Subscriptions</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Last 30 days</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="text-muted-foreground">Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <span className="text-muted-foreground">New Lines</span>
          </div>
        </div>
      </div>
      {isLoading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="text-muted-foreground text-sm">Loading chart...</div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(199,89%,48%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(199,89%,48%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorLines" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 32% 22%)" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'hsl(215 20% 65%)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: 'hsl(215 20% 65%)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(222 47% 14%)',
                border: '1px solid hsl(217 32% 22%)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: 'hsl(210 40% 98%)' }}
              itemStyle={{ color: 'hsl(215 20% 65%)' }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="hsl(199,89%,48%)"
              strokeWidth={2}
              fill="url(#colorRevenue)"
              name="Revenue ($)"
            />
            <Area
              type="monotone"
              dataKey="new_lines"
              stroke="#22d3ee"
              strokeWidth={2}
              fill="url(#colorLines)"
              name="New Lines"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
