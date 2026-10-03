import { cx } from '../../lib/cx'
import Button from './Button'
import Spinner from './Spinner'
import { IconAlert, IconInfo, IconRefresh } from './icons'

/**
 * États standard d'une zone de données. Chaque appel à l'API doit afficher
 * explicitement l'un d'eux : chargement, erreur, vide — jamais un faux résultat.
 */

export function LoadingState({ label = 'Chargement…', className }) {
  return (
    <div role="status" className={cx('flex flex-col items-center justify-center gap-3 py-16 text-ink-muted', className)}>
      <Spinner size={22} />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function EmptyState({ icon, title, description, action, className }) {
  return (
    <div className={cx('flex flex-col items-center justify-center gap-3 px-6 py-16 text-center', className)}>
      <div className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-ink-muted ring-1 ring-line">
        {icon ?? <IconInfo size={22} />}
      </div>
      <div className="max-w-sm">
        <p className="font-medium text-ink">{title}</p>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/**
 * Erreur bloquante d'une zone. `error` peut être une ApiError (son message
 * vient du champ `detail` du backend) ou une chaîne.
 */
export function ErrorState({ title = 'Une erreur est survenue', error, onRetry, compact = false, className }) {
  const message = typeof error === 'string' ? error : error?.message
  return (
    <div
      role="alert"
      className={cx(
        'flex gap-3 rounded-card border border-danger/30 bg-danger-soft text-left',
        compact ? 'items-start p-4' : 'flex-col items-center p-8 text-center',
        className,
      )}
    >
      <IconAlert size={compact ? 18 : 24} className="shrink-0 text-danger" />
      <div className={cx('min-w-0', !compact && 'max-w-md')}>
        <p className="font-medium text-ink">{title}</p>
        {message && <p className="mt-1 text-sm text-ink-soft">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} iconLeft={<IconRefresh size={15} />} className={compact ? 'ml-auto' : 'mt-1'}>
          Réessayer
        </Button>
      )}
    </div>
  )
}

/** Message en ligne (information, avertissement, succès, erreur). */
export function Notice({ tone = 'info', title, children, className }) {
  const tones = {
    info: 'border-info/25 bg-info-soft [&_svg]:text-info',
    warning: 'border-warning/30 bg-warning-soft [&_svg]:text-warning',
    success: 'border-success/30 bg-success-soft [&_svg]:text-success',
    danger: 'border-danger/30 bg-danger-soft [&_svg]:text-danger',
  }
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx('flex items-start gap-3 rounded-control border px-4 py-3 text-sm text-ink-soft', tones[tone], className)}
    >
      {tone === 'info' ? <IconInfo size={18} className="mt-px shrink-0" /> : <IconAlert size={18} className="mt-px shrink-0" />}
      <div className="min-w-0">
        {title && <p className="font-medium text-ink">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : undefined}>{children}</div>}
      </div>
    </div>
  )
}
