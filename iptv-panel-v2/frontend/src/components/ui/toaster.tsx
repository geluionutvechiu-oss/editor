'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

let globalSetToasts: React.Dispatch<React.SetStateAction<Toast[]>> | null = null

export function toast(message: string, type: Toast['type'] = 'info') {
  const id = Math.random().toString(36).slice(2)
  if (globalSetToasts) {
    globalSetToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      if (globalSetToasts) {
        globalSetToasts((prev) => prev.filter((t) => t.id !== id))
      }
    }, 4000)
  }
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    globalSetToasts = setToasts
    return () => { globalSetToasts = null }
  }, [])

  const icons = {
    success: <CheckCircle className="w-4 h-4 text-green-400" />,
    error: <AlertCircle className="w-4 h-4 text-red-400" />,
    info: <Info className="w-4 h-4 text-blue-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-start gap-3 p-4 bg-card border border-border rounded-xl shadow-lg"
        >
          {icons[t.type]}
          <p className="text-sm text-foreground flex-1">{t.message}</p>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
