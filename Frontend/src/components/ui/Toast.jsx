import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../../lib/cx'
import { IconAlert, IconCheck, IconClose, IconInfo } from './icons'

const ToastContext = createContext(null)

const ICONS = {
  success: <IconCheck size={16} className="text-success" />,
  danger: <IconAlert size={16} className="text-danger" />,
  info: <IconInfo size={16} className="text-info" />,
}

/**
 * Notifications non bloquantes (succès d'une action, échec secondaire).
 * Usage : const toast = useToast(); toast.success('Estimation supprimée.')
 */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const seq = useRef(0)

  const dismiss = useCallback((id) => setItems((list) => list.filter((t) => t.id !== id)), [])

  const push = useCallback(
    (tone, message, { duration = 4000 } = {}) => {
      const id = ++seq.current
      setItems((list) => [...list.slice(-2), { id, tone, message }])
      if (duration) setTimeout(() => dismiss(id), duration)
      return id
    },
    [dismiss],
  )

  const api = useMemo(
    () => ({
      success: (m, o) => push('success', m, o),
      error: (m, o) => push('danger', m, o),
      info: (m, o) => push('info', m, o),
      dismiss,
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          aria-relevant="additions"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6"
        >
          {items.map((t) => (
            <div
              key={t.id}
              role={t.tone === 'danger' ? 'alert' : 'status'}
              className={cx(
                'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-control border border-line bg-surface px-4 py-3',
                'text-sm text-ink shadow-overlay animate-pop-in',
              )}
            >
              <span className="mt-0.5 shrink-0">{ICONS[t.tone]}</span>
              <p className="min-w-0 flex-1">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Fermer la notification"
                className="-mr-1 shrink-0 rounded p-0.5 text-ink-muted hover:text-ink"
              >
                <IconClose size={14} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast doit être utilisé dans <ToastProvider>')
  return ctx
}
