import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { vodApi, streamsApi } from '../../services/api';
import { Plus, Search, Edit2, Trash2, RefreshCw, Star, Film } from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

export function VodPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['vod', page, search, category],
    queryFn: () => vodApi.list({ page, limit: 50, search, category_id: category }) as any,
    placeholderData: (prev) => prev
  });

  const { data: categories } = useQuery({
    queryKey: ['vod-categories'],
    queryFn: () => streamsApi.categories() as any
  });

  const vods = (data as any)?.data || [];
  const pagination = (data as any)?.pagination;

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    // In real implementation: vodApi.delete(id)
    toast.success('VOD deleted');
    queryClient.invalidateQueries({ queryKey: ['vod'] });
  };

  const handleRefreshTMDB = async (id: number) => {
    const t = toast.loading('Refreshing TMDB metadata...');
    try {
      await vodApi.refreshTmdb(id);
      toast.dismiss(t);
      toast.success('Metadata refreshed');
      queryClient.invalidateQueries({ queryKey: ['vod'] });
    } catch (err: any) {
      toast.dismiss(t);
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">VOD Movies</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
          <Plus size={14} /> Add Movie
        </button>
      </div>

      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search movies..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500" />
        </div>
        <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-transparent dark:text-white">
          <option value="">All Categories</option>
          {((categories as any)?.data || []).filter((c: any) => c.category_type === 'vod' || !c.category_type).map((c: any) => (
            <option key={c.id} value={c.id}>{c.category_name}</option>
          ))}
        </select>
      </div>

      {/* Grid View */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {isLoading ? (
          Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))
        ) : vods.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <Film size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No movies found</p>
          </div>
        ) : (
          vods.map((v: any) => (
            <div key={v.id} className="group relative">
              <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                {(v.movie_image || v.stream_icon) ? (
                  <img src={v.movie_image || v.stream_icon} alt={v.vod_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e: any) => { e.target.style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film size={24} className="text-gray-400" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-end p-2">
                  <div className="flex gap-1 w-full justify-center">
                    <button onClick={() => handleRefreshTMDB(v.id)}
                      className="p-1.5 bg-white/20 backdrop-blur rounded text-white hover:bg-white/30" title="Refresh TMDB">
                      <RefreshCw size={12} />
                    </button>
                    <button onClick={() => handleDelete(v.id, v.vod_name)}
                      className="p-1.5 bg-red-500/80 backdrop-blur rounded text-white hover:bg-red-500" title="Delete">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-1.5 px-0.5">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate" title={v.vod_name}>
                  {v.vod_name}
                </p>
                <div className="flex items-center justify-between mt-0.5">
                  {v.movie_rating && (
                    <div className="flex items-center gap-0.5">
                      <Star size={9} className="text-yellow-400 fill-yellow-400" />
                      <span className="text-[10px] text-gray-500">{Number(v.movie_rating).toFixed(1)}</span>
                    </div>
                  )}
                  {v.releaseDate && (
                    <span className="text-[10px] text-gray-400">{dayjs(v.releaseDate).year()}</span>
                  )}
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
