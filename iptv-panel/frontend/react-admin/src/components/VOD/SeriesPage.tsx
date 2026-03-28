import { useQuery } from '@tanstack/react-query';
import { seriesApi } from '../../services/api';
import { useState } from 'react';
import { Search, Tv2, Star } from 'lucide-react';

export function SeriesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['series', page, search],
    queryFn: () => seriesApi.list({ page, limit: 50, search }) as any,
    placeholderData: (prev) => prev
  });

  const series = (data as any)?.data || [];
  const pagination = (data as any)?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">TV Series</h1>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search series..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {isLoading ? (
          Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))
        ) : series.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <Tv2 size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No series found</p>
          </div>
        ) : (
          series.map((s: any) => (
            <div key={s.id} className="group">
              <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                {s.cover ? (
                  <img src={s.cover} alt={s.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e: any) => { e.target.style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Tv2 size={24} className="text-gray-400" />
                  </div>
                )}
              </div>
              <div className="mt-1.5 px-0.5">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{s.name}</p>
                <div className="flex items-center justify-between mt-0.5">
                  {s.rating && (
                    <div className="flex items-center gap-0.5">
                      <Star size={9} className="text-yellow-400 fill-yellow-400" />
                      <span className="text-[10px] text-gray-500">{Number(s.rating).toFixed(1)}</span>
                    </div>
                  )}
                  <span className="text-[10px] text-gray-400">{s.num_seasons || 0}S · {s.num_episodes || 0}E</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50">Previous</button>
          <span className="text-sm text-gray-600">{page} / {pagination.pages}</span>
          <button disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
