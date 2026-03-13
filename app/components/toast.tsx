"use client"

import { createContext, useCallback, useContext, useState } from 'react'

type ToastState = {
  id: number
  message: string
  tone: 'success' | 'error' | 'info'
}

type ToastContextValue = {
  showToast: (message: string, tone?: ToastState['tone']) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((message: string, tone: ToastState['tone'] = 'info') => {
    setToast({ id: Date.now(), message, tone })
    // Auto hide after 3 seconds
    setTimeout(() => {
      setToast((current) => (current && current.message === message ? null : current))
    }, 3000)
  }, [])

  const bg =
    toast?.tone === 'success'
      ? 'bg-emerald-600 text-white'
      : toast?.tone === 'error'
      ? 'bg-rose-600 text-white'
      : 'bg-slate-800 text-white'

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 flex justify-center px-4 sm:bottom-6">
          <div
            className={`pointer-events-auto inline-flex max-w-md items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm shadow-lg ${bg}`}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              className="rounded-full bg-white/10 px-2 py-1 text-xs font-semibold hover:bg-white/20"
              onClick={() => setToast(null)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}

