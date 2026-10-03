import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { cx } from '../../lib/cx'
import { Button, IconChevronRight, IconLogout, IconUser, Modal } from '../ui'
import { ACCOUNT_NAV, MAIN_NAV } from './navigation'
import { Avatar } from './UserMenu'

const itemClass = (active) =>
  cx(
    'flex h-full flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
    active ? 'text-ink' : 'text-ink-muted',
  )

/**
 * Barre d'onglets en bas d'écran (mobile et petite tablette) :
 * les 4 sections principales + « Compte » (feuille avec Historique, Profil…).
 */
export default function MobileNav() {
  const [sheet, setSheet] = useState(false)
  const { user, openAuth, logout } = useAuth()
  const { pathname } = useLocation()
  const accountActive = ACCOUNT_NAV.some((a) => pathname.startsWith(a.to))

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="mx-auto flex h-16 max-w-lg items-stretch">
          {MAIN_NAV.map(({ to, short, icon: Icon }) => (
            <li key={to} className="flex flex-1">
              <NavLink to={to} className={({ isActive }) => itemClass(isActive)}>
                {({ isActive }) => (
                  <>
                    <span
                      className={cx(
                        'grid h-7 w-12 place-items-center rounded-full transition-colors',
                        isActive && 'bg-accent-soft text-accent-ink',
                      )}
                    >
                      <Icon size={19} />
                    </span>
                    {short}
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li className="flex flex-1">
            <button
              type="button"
              onClick={() => setSheet(true)}
              aria-haspopup="dialog"
              className={itemClass(accountActive)}
            >
              <span
                className={cx(
                  'grid h-7 w-12 place-items-center rounded-full transition-colors',
                  accountActive && 'bg-accent-soft text-accent-ink',
                )}
              >
                <IconUser size={19} />
              </span>
              Compte
            </button>
          </li>
        </ul>
      </nav>

      <Modal open={sheet} onClose={() => setSheet(false)} placement="sheet" title="Mon compte" size="sm">
        {user ? (
          <div className="flex flex-col gap-1">
            <div className="mb-3 flex items-center gap-3">
              <Avatar email={user.email} size="lg" />
              <div className="min-w-0">
                <p className="text-xs text-ink-muted">Connecté en tant que</p>
                <p className="truncate text-sm font-medium text-ink">{user.email}</p>
              </div>
            </div>
            {ACCOUNT_NAV.map(({ to, label, description, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setSheet(false)}
                className="flex items-center gap-3 rounded-control px-3 py-3 hover:bg-surface-2"
              >
                <Icon size={19} className="text-ink-muted" />
                <span className="flex-1">
                  <span className="block text-sm font-medium text-ink">{label}</span>
                  <span className="block text-xs text-ink-muted">{description}</span>
                </span>
                <IconChevronRight size={16} className="text-ink-muted" />
              </Link>
            ))}
            <Button
              variant="secondary"
              className="mt-3"
              fullWidth
              iconLeft={<IconLogout size={17} />}
              onClick={() => { setSheet(false); logout() }}
            >
              Se déconnecter
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-muted">
              Connectez-vous pour retrouver l’historique de vos estimations sur tous vos appareils.
            </p>
            <Button fullWidth onClick={() => { setSheet(false); openAuth() }}>
              Se connecter ou créer un compte
            </Button>
          </div>
        )}
      </Modal>
    </>
  )
}
