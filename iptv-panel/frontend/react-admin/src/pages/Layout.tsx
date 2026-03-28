import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  LayoutDashboard, Users, Tv, Film, BookOpen, BarChart2,
  Settings, Server, Shield, LogOut, Menu, X, ChevronRight,
  Wifi, List, Radio
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { to: '/users', icon: <Users size={18} />, label: 'Users' },
  { to: '/streams', icon: <Radio size={18} />, label: 'Live Streams' },
  { to: '/vod', icon: <Film size={18} />, label: 'VOD' },
  { to: '/series', icon: <List size={18} />, label: 'Series' },
  { to: '/epg', icon: <BookOpen size={18} />, label: 'EPG' },
  { to: '/servers', icon: <Server size={18} />, label: 'Servers', adminOnly: true },
  { to: '/bouquets', icon: <Tv size={18} />, label: 'Bouquets', adminOnly: true },
  { to: '/ip-filter', icon: <Shield size={18} />, label: 'IP Filter', adminOnly: true },
  { to: '/reports', icon: <BarChart2 size={18} />, label: 'Reports' },
  { to: '/settings', icon: <Settings size={18} />, label: 'Settings', adminOnly: true },
];

export function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    toast.success('Logged out');
  };

  const filteredNav = navItems.filter(item => {
    if (item.adminOnly && user?.role !== 'admin') return false;
    return true;
  });

  const Sidebar = () => (
    <aside className={clsx(
      'fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-200',
      sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
    )}>
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-6 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Tv size={16} className="text-white" />
          </div>
          <span className="font-bold text-white text-lg">IPTV Panel</span>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
          <X size={20} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-0.5">
          {filteredNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* User */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-indigo-600/30 border border-indigo-500/30 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-indigo-400">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.username}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 lg:px-6 gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            <Menu size={20} />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <span className={clsx(
              'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
              user?.role === 'admin' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
              user?.role === 'reseller' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            )}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {user?.role}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
