'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Radio,
  Film,
  Tv2,
  List,
  Package,
  Users,
  UserCheck,
  Server,
  Shield,
  BarChart3,
  Rss,
  Bell,
  Ticket,
  Wifi,
  ChevronDown,
  ChevronRight,
  Tv,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface NavItem {
  href?: string
  label: string
  icon: React.ElementType
  children?: NavItem[]
  badge?: string | number
}

const navigation: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/live-connections', label: 'Live Connections', icon: Wifi },
  {
    label: 'Subscriptions',
    icon: Tv2,
    children: [
      { href: '/subscriptions/lines', label: 'Lines', icon: List },
      { href: '/subscriptions/mag-devices', label: 'MAG Devices', icon: Tv },
      { href: '/subscriptions/enigma2', label: 'Enigma2', icon: Radio },
    ],
  },
  { href: '/streams', label: 'Streams', icon: Radio },
  {
    label: 'VOD',
    icon: Film,
    children: [
      { href: '/vods/movies', label: 'Movies', icon: Film },
      { href: '/vods/series', label: 'Series', icon: Tv2 },
    ],
  },
  { href: '/bouquets', label: 'Bouquets', icon: List },
  { href: '/packages', label: 'Packages', icon: Package },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/resellers', label: 'Resellers', icon: UserCheck },
  { href: '/servers', label: 'Servers', icon: Server },
  { href: '/epg', label: 'EPG', icon: Rss },
  { href: '/statistics', label: 'Statistics', icon: BarChart3 },
  { href: '/security', label: 'Security', icon: Shield },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/tickets', label: 'Tickets', icon: Ticket },
]

function NavItemComponent({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(() => {
    if (!item.children) return false
    return item.children.some((child) => child.href === pathname || pathname.startsWith(child.href ?? ''))
  })

  if (item.children) {
    const isActive = item.children.some(
      (child) => child.href === pathname || pathname.startsWith(child.href ?? '')
    )
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'sidebar-item w-full text-left',
            isActive ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          <item.icon className="w-4 h-4 shrink-0" />
          <span className="flex-1">{item.label}</span>
          {isOpen ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        {isOpen && (
          <div className="ml-4 mt-1 space-y-0.5 border-l border-border pl-3">
            {item.children.map((child) => (
              <NavItemComponent key={child.href} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href ?? ''))

  return (
    <Link
      href={item.href!}
      className={cn(
        'sidebar-item',
        isActive
          ? 'active text-primary'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <item.icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span className="ml-auto flex items-center justify-center w-5 h-5 text-xs bg-primary text-primary-foreground rounded-full">
          {item.badge}
        </span>
      )}
    </Link>
  )
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-card border-r border-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
          <Tv className="w-4 h-4 text-primary" />
        </div>
        <div>
          <span className="font-bold text-sm text-foreground">IPTV Panel</span>
          <p className="text-xs text-muted-foreground">v2.0.0</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navigation.map((item) => (
          <NavItemComponent key={item.href ?? item.label} item={item} />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-muted-foreground">System Online</span>
        </div>
      </div>
    </aside>
  )
}
