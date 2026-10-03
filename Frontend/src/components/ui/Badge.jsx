import { cx } from '../../lib/cx'

const TONES = {
  neutral: 'bg-surface-2 text-ink-soft ring-line',
  brand: 'bg-brand text-on-brand ring-transparent',
  accent: 'bg-accent-soft text-accent-ink ring-accent/25',
  success: 'bg-success-soft text-success ring-success/25',
  warning: 'bg-warning-soft text-warning ring-warning/25',
  danger: 'bg-danger-soft text-danger ring-danger/25',
  info: 'bg-info-soft text-info ring-info/25',
}

const DOTS = {
  neutral: 'bg-ink-muted',
  brand: 'bg-on-brand',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
}

/** Étiquette courte (statut, méthode, catégorie). `dot` ajoute une pastille. */
export default function Badge({ tone = 'neutral', dot = false, size = 'md', className, children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full ring-1 ring-inset font-medium whitespace-nowrap',
        size === 'sm' ? 'h-5 px-2 text-[11px]' : 'h-6 px-2.5 text-xs',
        TONES[tone],
        className,
      )}
    >
      {dot && <span aria-hidden="true" className={cx('h-1.5 w-1.5 rounded-full', DOTS[tone])} />}
      {children}
    </span>
  )
}
