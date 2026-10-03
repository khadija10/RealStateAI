import { NavLink } from 'react-router-dom'
import { cx } from '../../lib/cx'

/**
 * Onglets de navigation entre sous-pages (ex. Marché › Carte / Tendances).
 * Chaque onglet est un lien : l'URL reflète l'onglet actif.
 */
export function TabNav({ label, items, className }) {
  return (
    <nav aria-label={label} className={cx('border-b border-line', className)}>
      <ul className="-mb-px flex gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <li key={item.to} className="shrink-0">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'inline-flex h-11 items-center gap-2 border-b-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-ink text-ink'
                    : 'border-transparent text-ink-muted hover:text-ink hover:border-line-strong',
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
