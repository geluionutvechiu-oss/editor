import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => adminApi.settings() as any
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      const map: Record<string, string> = {};
      ((data as any)?.data || []).forEach((s: any) => { map[s.key] = s.value || ''; });
      setValues(map);
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.updateSettings(values);
      toast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const settings = (data as any)?.data || [];

  const sections: Record<string, string[]> = {
    'General': ['panel_name', 'panel_url', 'server_timezone', 'maintenance_mode'],
    'Authentication': ['max_login_attempts', 'session_timeout', 'registration_enabled', 'trial_days'],
    'EPG': ['epg_auto_update', 'epg_update_hours'],
    'Connections': ['connection_cleanup_mins', 'bandwidth_limit_mbps'],
    'API Keys': ['tmdb_api_key'],
    'Email (SMTP)': ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from']
  };

  const getSettingMeta = (key: string) => settings.find((s: any) => s.key === key);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
        >
          <Save size={14} />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      ) : (
        Object.entries(sections).map(([section, keys]) => (
          <div key={section} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{section}</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {keys.filter(k => getSettingMeta(k)).map(key => {
                const meta = getSettingMeta(key);
                const isBoolean = meta?.type === 'boolean';
                const isPassword = key.includes('pass') || key.includes('key');

                return (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </label>
                    {meta?.description && (
                      <p className="text-xs text-gray-400 mb-1.5">{meta.description}</p>
                    )}
                    {isBoolean ? (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={values[key] === '1'}
                          onChange={(e) => setValues(v => ({ ...v, [key]: e.target.checked ? '1' : '0' }))}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {values[key] === '1' ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                    ) : (
                      <input
                        type={isPassword ? 'password' : 'text'}
                        value={values[key] || ''}
                        onChange={(e) => setValues(v => ({ ...v, [key]: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent dark:text-white focus:ring-2 focus:ring-indigo-500"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
