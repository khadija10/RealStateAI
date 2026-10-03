import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../../lib/cx'
import { IconClose } from './icons'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Fenêtre modale accessible :
 * - focus piégé dans la fenêtre, rendu à l'élément d'origine à la fermeture ;
 * - fermeture par Échap, par le bouton ou par clic sur le fond ;
 * - défilement de la page bloqué tant qu'elle est ouverte.
 *
 * `placement="sheet"` : panneau ancré en bas sur mobile (centré au-delà de sm).
 */
export default function Modal({ open, onClose, title, description, size = 'md', placement = 'center', children, footer }) {
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus sur le premier champ, sinon sur le panneau lui-même.
    const panel = panelRef.current
    const first = panel?.querySelector('input, select, textarea') ?? panel
    first?.focus({ preventScroll: true })

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current?.()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault()
        lastItem.focus()
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault()
        firstItem.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      if (previous instanceof HTMLElement) previous.focus({ preventScroll: true })
    }
  }, [open])

  if (!open) return null

  const sheet = placement === 'sheet'
  return createPortal(
    <div
      className={cx(
        'fixed inset-0 z-50 flex justify-center bg-[#141311]/40 backdrop-blur-[2px] animate-fade-in',
        sheet ? 'items-end sm:items-center sm:p-4' : 'items-center p-4',
      )}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          'relative w-full bg-surface text-ink shadow-overlay border border-line focus:outline-none',
          'max-h-[calc(100dvh-2rem)] overflow-y-auto',
          size === 'sm' ? 'sm:max-w-sm' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md',
          sheet
            ? 'rounded-t-panel sm:rounded-panel animate-sheet-in sm:animate-pop-in pb-[env(safe-area-inset-bottom)]'
            : 'rounded-panel animate-pop-in',
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div className="min-w-0">
            {title && <h2 id={titleId} className="ds-h3">{title}</h2>}
            {description && <p id={descId} className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-2 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-control text-ink-muted hover:bg-surface-2 hover:text-ink transition-colors"
          >
            <IconClose size={18} />
          </button>
        </div>
        <div className="px-6 pb-6 pt-5">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
