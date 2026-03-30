'use client'

import { Bell, Search, LogOut, User, ChevronDown, Menu } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'

interface TopbarProps {
  title: string
  onMenuClick?: () => void
}

export function Topbar({ title, onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 bg-card border-b border-border px-6">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page title */}
      <h1 className="text-lg font-semibold text-foreground flex-1">{title}</h1>

      {/* Search */}
      <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-input border border-border rounded-lg text-sm text-muted-foreground w-64">
        <Search className="w-4 h-4 shrink-0" />
        <span>Search...</span>
        <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded border border-border">⌘K</kbd>
      </div>

      {/* Notifications */}
      <Link
        href="/notifications"
        className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-accent transition-colors"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
          3
        </span>
      </Link>

      {/* User menu */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium text-foreground leading-none">{user?.name ?? 'Admin'}</p>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{user?.role ?? 'admin'}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground hidden md:block" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-medium text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <div className="p-1">
              <button
                onClick={() => { setDropdownOpen(false); logout() }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
