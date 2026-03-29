import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Save, Settings, Shield, Tv, Mail, Users, DollarSign, Globe } from 'lucide-react';

const SECTIONS = [
  {
    id: 'general', label: 'General', icon: Settings,
    keys: [
      { key: 'panel_name',       label: 'Nume Panel',            desc: 'Numele afisat pe interfata' },
      { key: 'panel_url',        label: 'URL Panel',             desc: 'URL-ul complet al panoului' },
      { key: 'server_timezone',  label: 'Timezone',              desc: 'ex: Europe/Bucharest' },
      { key: 'maintenance_mode', label: 'Mod Mentenanta',        desc: 'Blocheaza accesul utilizatorilor', bool: true },
    ]
  },
  {
    id: 'reseller', label: 'Reseller & Permisiuni', icon: Users,
    keys: [
      { key: 'reseller_credit_cost',         label: 'Cost 1 Credit (USD)',            desc: 'Pretul unui credit reseller' },
      { key: 'reseller_default_credits',     label: 'Credite Default Reseller',       desc: 'Credite la crearea unui reseller nou' },
      { key: 'reseller_default_max_clients', label: 'Max Clienti Default',            desc: 'Numar maxim clienti pentru reseller nou' },
      { key: 'reseller_can_create_reseller', label: 'Pot crea Sub-Reselleri',         desc: 'Resellerii pot crea alti reselleri', bool: true },
      { key: 'reseller_can_delete_users',    label: 'Pot Sterge Useri',               desc: 'Resellerii pot sterge clientii proprii', bool: true },
      { key: 'reseller_can_set_bouquet',     label: 'Pot Seta Bouquet',               desc: 'Resellerii pot alege pachetul clientilor', bool: true },
      { key: 'reseller_can_set_expiry',      label: 'Pot Seta Expirare',              desc: 'Resellerii pot seta data expirarii', bool: true },
      { key: 'trial_days',                   label: 'Zile Trial Gratuit',             desc: 'Durata perioadei de test' },
    ]
  },
  {
    id: 'security', label: 'Securitate', icon: Shield,
    keys: [
      { key: 'max_login_attempts',  label: 'Max Incercari Login',      desc: 'IP-ul se blocheaza dupa N esecuri' },
      { key: 'session_timeout',     label: 'Timeout Sesiune (sec)',     desc: '86400 = 24 ore' },
      { key: 'registration_enabled',label: 'Inregistrare Publica',     desc: 'Permite inregistrarea libera', bool: true },
      { key: 'block_vpn',           label: 'Blocare VPN/Proxy',        desc: 'Blocheaza conexiunile VPN/proxy', bool: true },
      { key: 'force_https',         label: 'Forteaza HTTPS',           desc: 'Redirecteaza HTTP catre HTTPS', bool: true },
    ]
  },
  {
    id: 'streaming', label: 'Streaming', icon: Tv,
    keys: [
      { key: 'bandwidth_limit_mbps',    label: 'Limita Banda (Mbps)',        desc: '0 = nelimitat per user' },
      { key: 'connection_cleanup_mins', label: 'Cleanup Conexiuni (min)',    desc: 'Sterge conexiunile inactive' },
      { key: 'max_connections_global',  label: 'Max Conexiuni Globale',      desc: '0 = nelimitat' },
      { key: 'allow_m3u_download',      label: 'Permite Download M3U',       desc: 'Userii pot descarca playlist', bool: true },
      { key: 'stream_retry_attempts',   label: 'Reincercari Stream',         desc: 'Reincercari la stream cazut' },
    ]
  },
  {
    id: 'epg', label: 'EPG', icon: Globe,
    keys: [
      { key: 'epg_auto_update',  label: 'Update Automat EPG',    desc: 'Actualizeaza EPG automat', bool: true },
      { key: 'epg_update_hours', label: 'Interval Update (ore)', desc: 'La cate ore se actualizeaza EPG' },
    ]
  },
  {
    id: 'billing', label: 'Facturare', icon: DollarSign,
    keys: [
      { key: 'currency',             label: 'Moneda',               desc: 'USD, EUR, RON etc.' },
      { key: 'price_per_connection', label: 'Pret/Conexiune',       desc: 'Pretul implicit al unei linii IPTV' },
      { key: 'invoice_prefix',       label: 'Prefix Factura',       desc: 'ex: INV- → INV-0001' },
    ]
  },
  {
    id: 'smtp', label: 'Email (SMTP)', icon: Mail,
    keys: [
      { key: 'smtp_host', label: 'SMTP Host',   desc: 'ex: smtp.gmail.com' },
      { key: 'smtp_port', label: 'SMTP Port',   desc: 'ex: 587 sau 465' },
      { key: 'smtp_user', label: 'SMTP User',   desc: 'Adresa email' },
      { key: 'smtp_pass', label: 'SMTP Parola', desc: 'Parola SMTP', secret: true },
      { key: 'smtp_from', label: 'From Email',  desc: 'Expeditor mesaje' },
    ]
  },
  {
    id: 'api', label: 'API Keys', icon: Settings,
    keys: [
      { key: 'tmdb_api_key', label: 'TMDB API Key', desc: 'themoviedb.org — metadata filme/seriale', secret: true },
    ]
  },
] as const;

const DEFAULTS: Record<string, string> = {
  reseller_credit_cost: '1.00', reseller_default_credits: '10',
  reseller_default_max_clients: '50', reseller_can_create_reseller: '0',
  reseller_can_delete_users: '1', reseller_can_set_bouquet: '1',
  reseller_can_set_expiry: '1', block_vpn: '0', force_https: '0',
  max_connections_global: '0', allow_m3u_download: '1',
  stream_retry_attempts: '3', currency: 'USD',
  price_per_connection: '5.00', invoice_prefix: 'INV-',
};

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: () => adminApi.settings() as any,
    retry: 1,
  });

  const [values, setValues] = useState<Record<string, string>>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('general');

  useEffect(() => {
    if (data) {
      const map: Record<string, string> = { ...DEFAULTS };
      ((data as any)?.data || []).forEach((s: any) => { map[s.key] = s.value ?? ''; });
      setValues(map);
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.updateSettings(values);
      toast.success('Setarile au fost salvate!');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    } catch {
      toast.error('Eroare la salvare. Incearca din nou.');
    } finally {
      setSaving(false);
    }
  };

  const currentSection = SECTIONS.find(s => s.id === activeSection)!;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Setari Panel</h1>
        <button onClick={handleSave} disabled={saving || isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
          <Save size={14} />
          {saving ? 'Se salveaza...' : 'Salveaza Modificarile'}
        </button>
      </div>

      {isError && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-amber-700 dark:text-amber-400 text-sm">
          Nu s-au putut incarca setarile din baza de date. Se afiseaza valorile implicite.
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar */}
        <nav className="w-52 flex-shrink-0 space-y-0.5">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            return (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  activeSection === s.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}>
                <Icon size={15} />
                {s.label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              {currentSection.label}
            </h3>
          </div>

          {isLoading ? (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              {(currentSection.keys as readonly any[]).map((field: any) => {
                const val = values[field.key] ?? DEFAULTS[field.key] ?? '';
                return (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      {field.label}
                    </label>
                    {field.bool ? (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setValues(v => ({ ...v, [field.key]: val === '1' ? '0' : '1' }))}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                            val === '1' ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                          }`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            val === '1' ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                        <span className={`text-sm font-medium ${val === '1' ? 'text-indigo-600' : 'text-gray-400'}`}>
                          {val === '1' ? 'Activat' : 'Dezactivat'}
                        </span>
                      </div>
                    ) : (
                      <input
                        type={field.secret ? 'password' : 'text'}
                        value={val}
                        onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    )}
                    <p className="text-xs text-gray-400 mt-1">{field.desc}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
