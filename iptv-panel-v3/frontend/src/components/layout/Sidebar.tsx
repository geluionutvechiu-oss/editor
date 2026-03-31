import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, Server, Network, Receipt, Shield,
  Bell, Settings, FileText, ChevronLeft, ChevronRight, Tv2, LogOut, List
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/plans', icon: Package, label: 'Plans' },
  { to: '/servers', icon: Server, label: 'Servers' },
  { to: '/streams', icon: List, label: 'Streams' },
  { to: '/resellers', icon: Network, label: 'Resellers' },
  { to: '/invoices', icon: Receipt, label: 'Invoices' },
  { to: '/security', icon: Shield, label: 'Security' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/audit-logs', icon: FileText, label: 'Audit Logs' },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const { data: notifData } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => api.get('/notifications?unread=true&limit=1').then(r => r.data),
    refetchInterval: 30000,
  });

  const unreadCount = notifData?.unreadCount || 0;

  return (
    <div className="h-full flex flex-col bg-slate-900/95 border-r border-white/[0.06]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <Tv2 className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm gradient-text truncate">IPTV Panel</div>
            <div className="text-[10px] text-muted-foreground truncate">Management System</div>
          </div>
        )}
        <button onClick={onToggle} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to || location.pathname.startsWith(to + '/');
          const isNotif = to === '/notifications';
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative',
                isActive
                  ? 'nav-active text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
              )}
            >
              <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-blue-400' : 'group-hover:text-blue-400 transition-colors')} />
              {!collapsed && <span className="truncate">{label}</span>}
              {isNotif && unreadCount > 0 && (
                <span className={cn(
                  'flex-shrink-0 h-5 min-w-5 px-1 rounded-full text-[10px] font-bold bg-blue-500 text-white flex items-center justify-center',
                  collapsed ? 'absolute -top-1 -right-1' : 'ml-auto'
                )}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-white/[0.06] p-3">
        <div className={cn('flex items-center gap-3 px-2 py-2 rounded-lg', !collapsed && 'mb-1')}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-sm font-bold text-white">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user?.username}</div>
              <div className="text-xs text-muted-foreground truncate capitalize">{user?.role?.toLowerCase()}</div>
            </div>
          )}
        </div>
        <button
          onClick={() => { logout(); window.location.href = '/login'; }}
          className={cn('flex items-center gap-3 w-full px-2 py-2 rounded-lg text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all', collapsed && 'justify-center')}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}
