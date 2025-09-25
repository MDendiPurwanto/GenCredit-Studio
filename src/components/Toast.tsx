import { useEffect } from 'react'

export type ToastItem = {
  id: string
  type?: 'info' | 'success' | 'error'
  message: string
  timeoutMs?: number
}

export function Toasts({ items, onClose }: { items: ToastItem[]; onClose: (id: string) => void }) {
  useEffect(() => {
    const timers = items.map((t) =>
      setTimeout(() => onClose(t.id), t.timeoutMs ?? (t.type === 'error' ? 6000 : 4000)),
    )
    return () => {
      for (const tm of timers) clearTimeout(tm)
    }
  }, [items, onClose])

  if (!items.length) return null
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.type ?? 'info'}`}>
          <div className="toast-content">{t.message}</div>
          <button className="toast-close" onClick={() => onClose(t.id)} aria-label="Close">
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

