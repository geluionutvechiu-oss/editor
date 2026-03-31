import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Activity, ShoppingCart, Users, Tv, Package,
  BarChart2, FileText, Bell, LifeBuoy, LogOut, ChevronLeft,
  ChevronRight, ChevronDown, Tv2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

// ── types ────────────────────────────────────────────────────────────────────

interface SubItem {
  to: string;
  label: string;
}

interface SubGroup {
  groupLabel: string;
  items: SubItem[];
}

interface ExpandableSection {
  id: string;
  label: string;
  Icon: React.ElementType;
  /** Routes that, when active, should auto-open this section */
  matchPrefixes: string[];
  subGroups?: SubGroup[];
  /** flat items (no group header) */
  items?: SubItem[];
}

interface DirectLink {
  to: string;
  label: string;
  Icon: React.ElementType;
  badge?: 'notifications' | 'tickets';
}

type NavEntry = { type: 'direct'; data: DirectLink } | { type: 'expandable'; data: ExpandableSection };

// ── nav structure ─────────────────────────────────────────────────────────────

const navStructure: NavEntry[] = [
  {
    type: 'direct',
    data: { to: '/dashboard', label: 'Tablou de Bord', Icon: LayoutDashboard },
  },
  {
    type: 'direct',
    data: { to: '/connections', label: 'Conexiuni Live', Icon: Activity },
  },
  {
    type: 'expandable',
    data: {
      id: 'abonamente',
      label: 'Abonamente',
      Icon: ShoppingCart,
      matchPrefixes: ['/clients', '/devices/mag', '/devices/enigma2', '/devices/events', '/subscription-messages'],
      subGroups: [
        {
          groupLabel: 'Utilizatori',
          items: [
            { to: '/clients/add', label: 'Adaugă Linie (cu Pachet)' },
            { to: '/clients/bulk', label: 'Editare în Masă a Linilor' },
            { to: '/clients', label: 'Gestionare Linii' },
          ],
        },
        {
          groupLabel: 'Dispozitiv MAG',
          items: [
            { to: '/devices/mag/add', label: 'Adaugă Dispozitiv MAG (cu Pachet)' },
            { to: '/devices/mag/bulk', label: 'Editare în Masă a Dispozitivelor MAG' },
            { to: '/devices/mag', label: 'Gestionare Dispozitive MAG' },
          ],
        },
        {
          groupLabel: 'Enigma2',
          items: [
            { to: '/devices/enigma2/add', label: 'Adaugă Dispozitiv Enigma2' },
            { to: '/devices/enigma2', label: 'Gestionare Dispozitive Enigma2' },
          ],
        },
        {
          groupLabel: 'Evenimente Dispozitiv',
          items: [
            { to: '/devices/events', label: 'Gestionare Evenimente Dispozitive' },
          ],
        },
        {
          groupLabel: 'Mesaje de Abonare Automată',
          items: [
            { to: '/subscription-messages', label: 'Gestionare Mesaje de Abonare' },
          ],
        },
      ],
    },
  },
  {
    type: 'direct',
    data: { to: '/streams', label: 'Content', Icon: Tv },
  },
  {
    type: 'expandable',
    data: {
      id: 'subdistribuitori',
      label: 'Subdistribuitori',
      Icon: Users,
      matchPrefixes: ['/resellers'],
      items: [
        { to: '/resellers/add', label: 'Adaugă Subdistribuitor' },
        { to: '/resellers', label: 'Gestionare Subdistribuitori' },
      ],
    },
  },
  {
    type: 'expandable',
    data: {
      id: 'pachete',
      label: 'Pachete',
      Icon: Package,
      matchPrefixes: ['/plans'],
      items: [
        { to: '/plans', label: 'Gestionare Pachete' },
      ],
    },
  },
  {
    type: 'expandable',
    data: {
      id: 'statistici',
      label: 'Statistici',
      Icon: BarChart2,
      matchPrefixes: ['/stats'],
      subGroups: [
        {
          groupLabel: 'Hartă Utilizator',
          items: [
            { to: '/stats/map', label: 'Hartă Utilizator Live' },
          ],
        },
        {
          groupLabel: 'Credite',
          items: [
            { to: '/stats/credits', label: 'Istoricul Creditelor' },
          ],
        },
      ],
    },
  },
  {
    type: 'expandable',
    data: {
      id: 'jurnale',
      label: 'Jurnale',
      Icon: FileText,
      matchPrefixes: ['/audit-logs'],
      items: [
        { to: '/audit-logs/credits', label: 'Jurnal Istoricul Credite' },
      ],
    },
  },
  {
    type: 'direct',
    data: { to: '/notifications', label: 'Notificări', Icon: Bell, badge: 'notifications' },
  },
  {
    type: 'direct',
    data: { to: '/tickets', label: 'Tichete', Icon: LifeBuoy, badge: 'tickets' },
  },
];

// ── component ─────────────────────────────────────────────────────────────────

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  // determine which expandable sections should start open (route-based)
  const initialOpen = () => {
    const open: Record<string, boolean> = {};
    navStructure.forEach(entry => {
      if (entry.type === 'expandable') {
        const { id, matchPrefixes } = entry.data as ExpandableSection;
        if (matchPrefixes.some(prefix => location.pathname.startsWith(prefix))) {
          open[id] = true;
        }
      }
    });
    return open;
  };

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(initialOpen);

  const toggleSection = (id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isSubItemActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(to + '/');

  // badges
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

  const unreadCount: number = notifData?.unreadCount || 0;
  const openTickets: number = ticketData?.total || 0;

  const getBadgeCount = (badge?: 'notifications' | 'tickets') => {
    if (badge === 'notifications') return unreadCount;
    if (badge === 'tickets') return openTickets;
    return 0;
  };

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: '#1a2332', borderRight: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* ── Logo ── */}
      <div
        className={cn(
          'flex items-center h-16 border-b border-white/[0.05] px-4',
          collapsed ? 'justify-center' : 'gap-3'
        )}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
          }}
        >
          <Tv2 className="h-5 w-5 text-white" />
        </div>

        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm gradient-text">1 STREAM</div>
            <div className="text-[10px] text-muted-foreground/70">IPTV Panel</div>
          </div>
        )}

        <button
          onClick={onToggle}
          className={cn(
            'flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all',
            collapsed ? 'ml-0' : 'ml-auto'
          )}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navStructure.map((entry, idx) => {
          if (entry.type === 'direct') {
            const { to, label, Icon, badge } = entry.data as DirectLink;
            const isActive = location.pathname === to || location.pathname.startsWith(to + '/');
            const count = getBadgeCount(badge);

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
                      'flex-shrink-0 h-4 min-w-[1rem] px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center',
                      badge === 'notifications' ? 'bg-blue-500' : 'bg-orange-500',
                      collapsed ? 'absolute -top-0.5 -right-0.5' : ''
                    )}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </NavLink>
            );
          }

          // expandable
          const section = entry.data as ExpandableSection;
          const { id, label, Icon, matchPrefixes, subGroups, items } = section;
          const isSectionActive = matchPrefixes.some(p => location.pathname.startsWith(p));
          const isOpen = !!openSections[id];

          // collect all sub-items for sub-item rendering
          const allGroups: SubGroup[] = subGroups
            ? subGroups
            : items
            ? [{ groupLabel: '', items }]
            : [];

          return (
            <div key={id}>
              {/* Section header / trigger */}
              <button
                onClick={() => !collapsed && toggleSection(id)}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 group',
                  isSectionActive
                    ? 'nav-active text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
                  collapsed && 'justify-center'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 flex-shrink-0 transition-colors',
                    isSectionActive ? 'text-blue-400' : 'group-hover:text-blue-400'
                  )}
                />
                {!collapsed && (
                  <>
                    <span className="truncate flex-1 text-left">{label}</span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 text-muted-foreground/60',
                        isOpen && 'rotate-180'
                      )}
                    />
                  </>
                )}
              </button>

              {/* Sub-items (only when expanded and not collapsed) */}
              {isOpen && !collapsed && (
                <div className="mt-0.5 mb-1 ml-2 space-y-0.5">
                  {allGroups.map((group, gIdx) => (
                    <div key={gIdx}>
                      {group.groupLabel && (
                        <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-orange-400">
                          {group.groupLabel}
                        </div>
                      )}
                      {group.items.map(subItem => {
                        const active = isSubItemActive(subItem.to);
                        return (
                          <NavLink
                            key={subItem.to}
                            to={subItem.to}
                            className={cn(
                              'flex items-center pl-4 pr-3 py-1.5 rounded-r-lg text-[12px] transition-all duration-150 border-l-2',
                              active
                                ? 'border-orange-500 text-foreground bg-orange-500/10'
                                : 'border-orange-500/30 text-muted-foreground hover:text-foreground hover:bg-white/[0.03] hover:border-orange-500/60'
                            )}
                          >
                            <span className="truncate">{subItem.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── User + Logout ── */}
      <div className="border-t border-white/[0.05] p-2.5">
        <div
          className={cn(
            'flex items-center gap-2.5 px-2 py-2 rounded-lg mb-1',
            !collapsed && 'glass rounded-lg'
          )}
        >
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
          {!collapsed && <span>Deconectare</span>}
        </button>

        {!collapsed && (
          <div className="text-center text-[10px] text-muted-foreground/40 mt-2 pb-1">
            v3.0.0
          </div>
        )}
      </div>
    </div>
  );
}
