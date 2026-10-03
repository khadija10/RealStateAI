import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { cx } from '../../lib/cx'
import { Button, IconChevronDown, IconLogout, Spinner } from '../ui'
import { ACCOUNT_NAV } from './navigation'

/** Initiale de l'utilisateur dans une pastille. */
export function Avatar({ email, size = 'md' }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent-ink ring-1 ring-accent/25',
        size === 'lg' ? 'h-11 w-11 text-base' : 'h-7 w-7 text-xs',
      )}
    >
      {email?.[0]?.toUpperCase() ?? '?'}
    </span>
  )
}

/**
 * Menu du compte (desktop) : Historique, Profil, Déconnexion.
 * Sans session : bouton « Se connecter ».
 */
export default function UserMenu() {
  const { user, status, openAuth, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        setOpen(false)
        rootRef.current?.querySelector('button')?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    // Focus sur la première entrée à l'ouverture.
    rootRef.current?.querySelector('[role="menuitem"]')?.focus()
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function onMenuKeyDown(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...rootRef.current.querySelectorAll('[role="menuitem"]')]
    const i = items.indexOf(document.activeElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
    items[next]?.focus()
  }

  if (status === 'loading') {
    return <Spinner size={16} label="Vérification de la session" className="text-ink-muted" />
  }

  if (!user) {
    return (
      <Button size="sm" onClick={openAuth}>
        Se connecter
      </Button>
    )
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          'inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface pl-1 pr-2.5 text-sm text-ink-soft',
          'transition-colors hover:border-line-strong hover:text-ink',
          open && 'border-line-strong text-ink',
        )}
      >
        <Avatar email={user.email} />
        <span className="hidden max-w-36 truncate lg:block">{user.email}</span>
        <IconChevronDown size={15} className={cx('transition-transform duration-150', open && 'rotate-180')} />
        <span className="sr-only">Menu du compte</span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Compte"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-40 mt-2 w-64 origin-top-right rounded-card border border-line bg-surface p-1.5 shadow-overlay animate-pop-in"
        >
          <div className="px-3 pb-2.5 pt-2">
            <p className="text-xs text-ink-muted">Connecté en tant que</p>
            <p className="truncate text-sm font-medium text-ink">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          {ACCOUNT_NAV.map(({ to, label, description, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 rounded-[8px] px-3 py-2 text-sm text-ink outline-none hover:bg-surface-2 focus-visible:bg-surface-2"
            >
              <Icon size={17} className="mt-0.5 text-ink-muted" />
              <span>
                <span className="block font-medium">{label}</span>
                <span className="block text-xs text-ink-muted">{description}</span>
              </span>
            </Link>
          ))}
          <div className="my-1 h-px bg-line" />
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); logout() }}
            className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2 text-sm text-ink-soft outline-none hover:bg-surface-2 hover:text-ink focus-visible:bg-surface-2"
          >
            <IconLogout size={17} className="text-ink-muted" />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  )
}
