import { cx } from '../../lib/cx'
import { IconChevronDown } from './icons'

// Style commun à tous les champs de saisie.
export const controlClass = cx(
  'w-full rounded-control border border-line-strong bg-surface text-ink text-[15px] sm:text-sm',
  'placeholder:text-ink-muted/70 transition-[border-color,box-shadow] duration-150',
  'hover:border-ink-muted focus:outline-none focus:border-ink focus:ring-3 focus:ring-accent/20',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15',
  'disabled:opacity-60 disabled:cursor-not-allowed',
)

/** Champ texte / nombre. `prefix` et `suffix` affichent une unité (€, m²…). */
export function Input({ className, prefix, suffix, size = 'md', ...rest }) {
  const height = size === 'lg' ? 'h-12' : size === 'sm' ? 'h-8' : 'h-10'
  if (!prefix && !suffix) {
    return <input className={cx(controlClass, height, 'px-3', className)} {...rest} />
  }
  return (
    <div className={cx('relative flex items-center', className)}>
      {prefix && (
        <span className="pointer-events-none absolute left-3 text-ink-muted text-sm">{prefix}</span>
      )}
      <input
        className={cx(controlClass, height, prefix ? 'pl-8' : 'pl-3', suffix ? 'pr-12' : 'pr-3', 'ds-num')}
        {...rest}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 text-ink-muted text-sm">{suffix}</span>
      )}
    </div>
  )
}

/** Liste déroulante native, stylée. */
export function Select({ className, size = 'md', children, ...rest }) {
  const height = size === 'lg' ? 'h-12' : size === 'sm' ? 'h-8' : 'h-10'
  return (
    <div className={cx('relative', className)}>
      <select className={cx(controlClass, height, 'appearance-none pl-3 pr-9')} {...rest}>
        {children}
      </select>
      <IconChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
    </div>
  )
}

/** Zone de texte multiligne. */
export function Textarea({ className, rows = 3, ...rest }) {
  return <textarea rows={rows} className={cx(controlClass, 'px-3 py-2.5 resize-y', className)} {...rest} />
}
