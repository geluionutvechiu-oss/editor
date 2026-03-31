import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Server, Network, Receipt, Shield,
  Bell, Settings, FileText, ChevronLeft, ChevronRight, Tv2, LogOut,
  List, Film, Tv, Radio, Rss, Cpu, Smartphone, LifeBuoy, CreditCard,
  Activity, Folder, Tag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const sections = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/connections', icon: Activity, label: 'Live Connections' },
    ],
  },
  {
    label: 'Subscribers',
    items: [
      { to: '/clients', icon: Users, label: 'Clients' },
      { to: '/plans', icon: Tag, label: 'Plans' },
      { to: '/resellers', icon: Network, label: 'Resellers' },
      { to: '/invoices', icon: Receipt, label: 'Invoices' },
      { to: '/credits', icon: CreditCard, label: 'Credits' },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/streams', icon: List, label: 'Live TV' },
      { to: '/movies', icon: Film, label: 'Movies / VOD' },
      { to: '/series', icon: Tv, label: 'Series' },
      { to: '/radio', icon: Radio, label: 'Radio' },
      { to: '/categories', icon: Folder, label: 'Categories' },
      { to: '/epg', icon: Rss, label: 'EPG Sources' },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { to: '/servers', icon: Server, label: 'Servers' },
      { to: '/transcoding', icon: Cpu, label: 'Transcoding' },
    ],
  },
  {
    label: 'Devices',
    items: [
      { to: '/devices/mag', icon: Tv2, label: 'MAG Devices' },
      { to: '/devices/enigma2', icon: Smartphone, label: 'Enigma2' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/security', icon: Shield, label: 'Security' },
      { to: '/tickets', icon: LifeBuoy, label: 'Support Tickets', ticketBadge: true },
      { to: '/notifications', icon: Bell, label: 'Notifications', badge: true },
      { to: '/audit-logs', icon: FileText, label: 'Audit Logs' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const { data: notifData } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => api.get('/notifications?unread=true&limit=1').then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: ticketData } = useQuery({
    queryKey: ['tickets-open'],
    queryFn: () => api.get('/tickets?status=OPEN').then(r => r.data),
    refetchInterval: 60000,
    enabled: user?.role === 'ADMIN',
  });

  const unreadCount = notifData?.unreadCount || 0;
  const openTickets = ticketData?.total || 0;

  return (
    <div className="h-full flex flex-col" style={{ background: 'rgba(9,14,28,0.97)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
      {/* Logo */}
      <div className={cn('flex items-center h-16 border-b px-4', 'border-white/[0.05]')} style={{ gap: collapsed ? 0 : 12 }}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}
        >
          <Tv2 className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm gradient-text">IPTV Panel</div>
            <div className="text-[10px] text-muted-foreground/70">Pro Management</div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="ml-auto flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {sections.map(section => (
          <div key={section.label}>
            {!collapsed && <div className="section-header">{section.label}</div>}
            {collapsed && <div className="my-2 mx-3 h-px bg-white/[0.05]" />}
            <div className="space-y-0.5">
              {section.items.map(({ to, icon: Icon, label, badge, ticketBadge }: any) => {
                const isActive = location.pathname === to || location.pathname.startsWith(to + '/');
                const count = badge ? unreadCount : (ticketBadge ? openTickets : 0);
                return (
                  <NavLink
                    key={to}
                    to={to}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 group relative',
                      isActive
                        ? 'nav-active text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 flex-shrink-0 transition-colors',
                        isActive ? 'text-blue-400' : 'group-hover:text-blue-400'
                      )}
                    />
                    {!collapsed && <span className="truncate flex-1">{label}</span>}
                    {count > 0 && (
                      <span
                        className={cn(
                          'flex-shrink-0 h-4 min-w-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center',
                          badge ? 'bg-blue-500' : 'bg-orange-500',
                          collapsed ? 'absolute -top-0.5 -right-0.5' : ''
                        )}
                      >
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-white/[0.05] p-2.5">
        <div className={cn('flex items-center gap-2.5 px-2 py-2 rounded-lg mb-1', !collapsed && 'glass rounded-lg')}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
          >
            {user?.username?.[0]?.toUpperCase()}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate">{user?.username}</div>
              <div className="text-[10px] text-muted-foreground truncate capitalize flex items-center gap-1">
                <span
                  className={cn(
                    'inline-block w-1.5 h-1.5 rounded-full',
                    user?.role === 'ADMIN' ? 'bg-blue-400' : 'bg-green-400'
                  )}
                />
                {user?.role?.toLowerCase()}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => { logout(); window.location.href = '/login'; }}
          className={cn(
            'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all',
            collapsed && 'justify-center'
          )}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}
