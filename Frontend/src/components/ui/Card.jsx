import { cx } from '../../lib/cx'

const PADDING = { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' }

/**
 * Carte du design system : surface blanche, bordure fine, ombre très légère.
 * - `tone="inset"` : zone en retrait (fond légèrement teinté, sans ombre).
 * - `interactive` : survol discret, pour une carte cliquable.
 */
export function Card({ as: Component = 'div', tone = 'default', padding = 'md', interactive = false, className, children, ...rest }) {
  return (
    <Component
      className={cx(
        'rounded-card border',
        tone === 'inset' ? 'bg-surface-2 border-line' : 'bg-surface border-line shadow-xs',
        PADDING[padding],
        interactive &&
          'transition-[border-color,box-shadow,transform] duration-200 ease-soft hover:border-line-strong hover:shadow-sm hover:-translate-y-px',
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  )
}

/** En-tête de carte : surtitre, titre, description et action à droite. */
export function CardHeader({ eyebrow, title, description, action, className }) {
  return (
    <div className={cx('mb-5 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="ds-eyebrow mb-1.5">{eyebrow}</p>}
        {title && <h3 className="ds-h3">{title}</h3>}
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
