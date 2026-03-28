import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { streamsApi } from '../../services/api';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1).max(255),
  stream_display_name: z.string().max(255).optional(),
  direct_source: z.string().url('Must be a valid URL'),
  stream_icon: z.string().url().optional().or(z.literal('')),
  epg_channel_id: z.string().max(255).optional(),
  category_id: z.coerce.number().optional(),
  num: z.coerce.number().int().optional(),
  tv_archive: z.boolean().default(false),
  tv_archive_duration: z.coerce.number().int().min(0).max(168).default(0),
  is_active: z.boolean().default(true)
});

type FormData = z.infer<typeof schema>;

interface Props {
  stream?: any;
  categories: any[];
  onClose: () => void;
  onSave: () => void;
}

export function StreamModal({ stream, categories, onClose, onSave }: Props) {
  const isEdit = !!stream;
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: stream ? {
      name: stream.name,
      stream_display_name: stream.stream_display_name || '',
      direct_source: stream.direct_source || '',
      stream_icon: stream.stream_icon || '',
      epg_channel_id: stream.epg_channel_id || '',
      category_id: stream.category_id,
      num: stream.num,
      tv_archive: stream.tv_archive,
      tv_archive_duration: stream.tv_archive_duration || 0,
      is_active: stream.is_active
    } : { tv_archive: false, tv_archive_duration: 0, is_active: true }
  });

  const tvArchive = watch('tv_archive');

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit) {
        await streamsApi.update(stream.id, data);
        toast.success('Stream updated');
      } else {
        await streamsApi.create(data);
        toast.success('Stream created');
      }
      onSave();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Stream' : 'Add Stream'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input {...register('name')} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stream URL *</label>
            <input {...register('direct_source')} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white font-mono focus:ring-2 focus:ring-indigo-500" placeholder="http://..." />
            {errors.direct_source && <p className="text-xs text-red-500 mt-1">{errors.direct_source.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <select {...register('category_id')} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500">
                <option value="">None</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.category_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Channel #</label>
              <input {...register('num')} type="number" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logo URL</label>
            <input {...register('stream_icon')} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500" placeholder="https://..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">EPG Channel ID (tvg-id)</label>
            <input {...register('epg_channel_id')} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white font-mono focus:ring-2 focus:ring-indigo-500" placeholder="channel.id.epg" />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input {...register('tv_archive')} type="checkbox" className="w-4 h-4 text-indigo-600 rounded" />
              Enable Catchup
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input {...register('is_active')} type="checkbox" className="w-4 h-4 text-indigo-600 rounded" />
              Active
            </label>
          </div>

          {tvArchive && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catchup Days</label>
              <input {...register('tv_archive_duration')} type="number" min={1} max={168} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500" />
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Stream'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
