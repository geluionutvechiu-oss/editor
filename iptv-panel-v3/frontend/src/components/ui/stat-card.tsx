import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  subLabel?: string;
  iconColor?: string;
  loading?: boolean;
}

export function StatCard({ title, value, icon, trend, subLabel, iconColor = 'text-blue-400', loading }: StatCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-slate-900/70 p-6 animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="h-4 w-24 bg-slate-800 rounded" />
          <div className="h-10 w-10 bg-slate-800 rounded-xl" />
        </div>
        <div className="h-8 w-20 bg-slate-800 rounded mb-2" />
        <div className="h-3 w-32 bg-slate-800 rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-slate-900/70 backdrop-blur-sm p-6 hover:border-white/[0.1] transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center bg-slate-800/80', iconColor)}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold tracking-tight mb-1">{value}</div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {trend && (
          <span className={cn('flex items-center gap-0.5 font-medium', trend.value >= 0 ? 'text-green-400' : 'text-red-400')}>
            {trend.value >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(trend.value)}%
          </span>
        )}
        {subLabel && <span>{subLabel}</span>}
      </div>
    </div>
  );
}
