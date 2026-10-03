import { cx } from '../../lib/cx'

/**
 * En-tête commun à toutes les pages : surtitre, titre (serif, emphase en
 * italique via <em>), phrase d'explication et actions éventuelles.
 */
export default function PageHeader({ eyebrow, title, description, actions, className, children }) {
  return (
    <header className={cx('mb-8 flex flex-col gap-5 sm:mb-10 md:flex-row md:items-end md:justify-between', className)}>
      <div className="min-w-0 max-w-prose">
        {eyebrow && <p className="ds-eyebrow mb-3">{eyebrow}</p>}
        <h1 className="ds-title text-balance">{title}</h1>
        {description && <p className="ds-lead mt-3 text-pretty">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

/** Conteneur standard des pages (largeur max, marges latérales, rythme vertical). */
export function PageContainer({ className, children, width = 'page' }) {
  return (
    <div
      className={cx(
        'mx-auto w-full px-4 py-8 sm:px-6 sm:py-12',
        width === 'page' ? 'max-w-page' : 'max-w-3xl',
        className,
      )}
    >
      {children}
    </div>
  )
}
