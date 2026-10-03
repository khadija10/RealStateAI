import { NavLink } from 'react-router-dom'
import { cx } from '../../lib/cx'
import { IconMoon, IconSun } from '../ui'
import Logo from './Logo'
import { MAIN_NAV } from './navigation'
import StatusPill from './StatusPill'
import UserMenu from './UserMenu'

export function ThemeToggle({ theme, onToggle, className }) {
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      title={dark ? 'Mode clair' : 'Mode sombre'}
      className={cx(
        'grid h-9 w-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink',
        className,
      )}
    >
      {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
    </button>
  )
}

/**
 * Barre supérieure, fixe au défilement.
 * Desktop : logo · navigation principale · statut, thème, compte.
 * Mobile : logo · statut, thème (la navigation passe dans la barre du bas).
 */
export default function TopNav({ theme, onToggleTheme }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md supports-[backdrop-filter]:bg-surface/75">
      <div className="mx-auto flex h-16 max-w-page items-center gap-6 px-4 sm:px-6">
        <Logo />

        <nav aria-label="Navigation principale" className="hidden flex-1 md:block">
          <ul className="flex items-center gap-1">
            {MAIN_NAV.map(({ to, label }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    cx(
                      'inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-surface-2 text-ink ring-1 ring-line'
                        : 'text-ink-muted hover:text-ink',
                    )
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <span className="hidden lg:inline-flex"><StatusPill /></span>
          <span className="lg:hidden"><StatusPill compact /></span>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <span className="hidden md:inline-flex"><UserMenu /></span>
        </div>
      </div>
    </header>
  )
}
