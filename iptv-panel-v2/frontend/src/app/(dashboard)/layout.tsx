'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { useAuth } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/live-connections': 'Live Connections',
  '/subscriptions/lines': 'Subscription Lines',
  '/subscriptions/lines/create': 'Create Line',
  '/subscriptions/mag-devices': 'MAG Devices',
  '/subscriptions/enigma2': 'Enigma2 Devices',
  '/streams': 'Streams',
  '/vods/movies': 'VOD Movies',
  '/vods/series': 'VOD Series',
  '/bouquets': 'Bouquets',
  '/packages': 'Packages',
  '/users': 'Users',
  '/resellers': 'Resellers',
  '/servers': 'Servers',
  '/epg': 'EPG Sources',
  '/statistics': 'Statistics',
  '/security': 'Security',
  '/notifications': 'Notifications',
  '/tickets': 'Support Tickets',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const title = pageTitles[pathname] ?? 'IPTV Panel'

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-64">
        <Topbar title={title} />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
