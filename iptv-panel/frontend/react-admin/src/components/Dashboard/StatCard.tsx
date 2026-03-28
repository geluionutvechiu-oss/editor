import { ReactNode } from 'react';
import clsx from 'clsx';

interface StatCardProps {
  title: string;
  value: number | string;
  sub?: string;
  icon: ReactNode;
  trend?: number;
  color: 'indigo' | 'emerald' | 'blue' | 'purple' | 'yellow' | 'red' | 'orange';
  live?: boolean;
  alert?: boolean;
}

const colorMap = {
  indigo: 'bg-indigo-50 dark:bg-indigo-900/20',
  emerald: 'bg-emerald-50 dark:bg-emerald-900/20',
  blue: 'bg-blue-50 dark:bg-blue-900/20',
  purple: 'bg-purple-50 dark:bg-purple-900/20',
  yellow: 'bg-yellow-50 dark:bg-yellow-900/20',
  red: 'bg-red-50 dark:bg-red-900/20',
  orange: 'bg-orange-50 dark:bg-orange-900/20',
};

export function StatCard({ title, value, sub, icon, trend, color, live, alert }: StatCardProps) {
  return (
    <div className={clsx(
      'bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6 transition-all duration-200',
      alert
        ? 'border-red-300 dark:border-red-700'
        : 'border-gray-200 dark:border-gray-700',
      'hover:shadow-md'
    )}>
      <div className="flex items-start justify-between">
        <div className={clsx('p-2 rounded-lg', colorMap[color])}>
          {icon}
        </div>
        {live && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            LIVE
          </span>
        )}
        {trend !== undefined && !live && (
          <span className={clsx(
            'text-xs font-medium',
            trend >= 0 ? 'text-emerald-600' : 'text-red-600'
          )}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mt-0.5">{title}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
