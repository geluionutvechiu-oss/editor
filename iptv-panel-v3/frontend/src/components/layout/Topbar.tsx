import { Menu, Bell, ChevronDown, User, Settings, LogOut } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clients': 'Clients',
  '/plans': 'Plans',
  '/servers': 'Servers',
  '/streams': 'Streams',
  '/resellers': 'Resellers',
  '/invoices': 'Invoices',
  '/security': 'Security',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
  '/audit-logs': 'Audit Logs',
};

export default function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const title = titles[location.pathname] || 'IPTV Panel';

  const { data: notifData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => api.get('/notifications?unread=true&limit=1').then(r => r.data),
    refetchInterval: 30000,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="h-16 border-b border-white/[0.06] bg-slate-900/80 backdrop-blur-sm flex items-center px-6 gap-4 flex-shrink-0">
      <button onClick={onMenuClick} className="text-muted-foreground hover:text-foreground transition-colors md:hidden">
        <Menu className="h-5 w-5" />
      </button>

      <h1 className="text-lg font-semibold flex-1">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative h-9 w-9 rounded-lg border border-border bg-slate-800/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-white/20 transition-all"
        >
          <Bell className="h-4 w-4" />
          {notifData?.unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 rounded-full text-[9px] font-bold bg-blue-500 text-white flex items-center justify-center">
              {notifData.unreadCount > 9 ? '9+' : notifData.unreadCount}
            </span>
          )}
        </button>

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-slate-800/50 hover:border-white/20 transition-all"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <span className="text-sm font-medium hidden sm:block">{user?.username}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-11 w-48 rounded-xl border border-border bg-slate-900 shadow-2xl z-50 py-1">
              <div className="px-3 py-2 border-b border-border">
                <div className="text-sm font-medium">{user?.username}</div>
                <div className="text-xs text-muted-foreground">{user?.email}</div>
              </div>
              <button onClick={() => { navigate('/settings'); setDropdownOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-white/[0.04] transition-colors">
                <User className="h-4 w-4 text-muted-foreground" /> Profile
              </button>
              <button onClick={() => { navigate('/settings'); setDropdownOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-white/[0.04] transition-colors">
                <Settings className="h-4 w-4 text-muted-foreground" /> Settings
              </button>
              <div className="border-t border-border mt-1 pt-1">
                <button onClick={() => { logout(); navigate('/login'); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
