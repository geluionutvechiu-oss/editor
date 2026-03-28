import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usersApi } from '../../services/api';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/api';

const schema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
  password: z.string().min(6).max(128).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  max_connections: z.coerce.number().int().min(1).max(100).default(1),
  max_mobile_connections: z.coerce.number().int().min(1).max(100).default(1),
  max_stb_connections: z.coerce.number().int().min(1).max(100).default(1),
  exp_date: z.string().optional().or(z.literal('')),
  is_active: z.boolean().default(true),
  is_banned: z.boolean().default(false),
  ban_reason: z.string().max(500).optional(),
  bouquet_id: z.coerce.number().optional(),
  notes: z.string().max(1000).optional()
});

type FormData = z.infer<typeof schema>;

interface Props {
  user?: any;
  onClose: () => void;
  onSave: () => void;
}

export function UserModal({ user, onClose, onSave }: Props) {
  const isEdit = !!user;
  const { data: bouquets } = useQuery({
    queryKey: ['bouquets'],
    queryFn: () => adminApi.bouquets() as any
  });

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: user ? {
      email: user.email || '',
      max_connections: user.max_connections || 1,
      max_mobile_connections: user.max_mobile_connections || 1,
      max_stb_connections: user.max_stb_connections || 1,
      exp_date: user.exp_date ? user.exp_date.substring(0, 10) : '',
      is_active: user.is_active,
      is_banned: user.is_banned,
      ban_reason: user.ban_reason || '',
      bouquet_id: user.bouquet_id || undefined,
      notes: user.notes || ''
    } : {
      max_connections: 1,
      max_mobile_connections: 1,
      max_stb_connections: 1,
      is_active: true,
      is_banned: false
    }
  });

  const is_banned = watch('is_banned');

  const onSubmit = async (data: FormData) => {
    try {
      const payload: Record<string, any> = { ...data };
      if (!payload.password) delete payload.password;
      if (!payload.exp_date) payload.exp_date = null;
      if (!payload.email) payload.email = null;
      if (!payload.bouquet_id) payload.bouquet_id = null;

      if (isEdit) {
        await usersApi.update(user.id, payload);
        toast.success('User updated');
      } else {
        await usersApi.create(payload);
        toast.success('User created');
      }
      onSave();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save user');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? `Edit User: ${user.username}` : 'Add New User'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Username *
              </label>
              <input
                {...register('username')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="username"
              />
              {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username.message}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password {isEdit && '(leave blank to keep current)'}
            </label>
            <input
              {...register('password')}
              type="password"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500"
              placeholder={isEdit ? '••••••••' : 'Min 6 characters'}
            />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              {...register('email')}
              type="email"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500"
              placeholder="user@email.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Conexiuni Desktop
              </label>
              <input
                {...register('max_connections')}
                type="number" min={1} max={100}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Conexiuni Mobile 📱
              </label>
              <input
                {...register('max_mobile_connections')}
                type="number" min={1} max={100}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Conexiuni Smart TV 📺
              </label>
              <input
                {...register('max_stb_connections')}
                type="number" min={1} max={100}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data expirare
              </label>
              <input
                {...register('exp_date')}
                type="date"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bouquet (Channel Package)
            </label>
            <select
              {...register('bouquet_id')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">No Bouquet (All Access)</option>
              {((bouquets as any)?.data || []).map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input {...register('is_active')} type="checkbox" className="w-4 h-4 text-indigo-600 rounded" />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input {...register('is_banned')} type="checkbox" className="w-4 h-4 text-red-600 rounded" />
              Banned
            </label>
          </div>

          {is_banned && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ban Reason
              </label>
              <input
                {...register('ban_reason')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500"
                placeholder="Reason for ban..."
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              {...register('notes')}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Internal notes..."
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
