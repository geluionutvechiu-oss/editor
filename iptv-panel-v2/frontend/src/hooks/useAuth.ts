'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '@/lib/api'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
  setUser: (user: User) => void
}

// Simple hook without zustand for SSR compatibility
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const fetchMe = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('jwt_token') : null
      if (!token) {
        setIsLoading(false)
        return
      }
      const res = await authApi.me()
      setUser(res.data.data)
    } catch {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('jwt_token')
        localStorage.removeItem('user')
      }
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const res = await authApi.login(email, password)
      const { token, user: userData } = res.data.data
      if (typeof window !== 'undefined') {
        localStorage.setItem('jwt_token', token)
        localStorage.setItem('user', JSON.stringify(userData))
      }
      setUser(userData)
      router.push('/')
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem('jwt_token')
      localStorage.removeItem('user')
    }
    setUser(null)
    router.push('/login')
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    fetchMe,
    setUser,
  }
}
