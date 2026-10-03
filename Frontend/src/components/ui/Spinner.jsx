import { cx } from '../../lib/cx'

/** Indicateur d'activité. `label` le rend annonçable par les lecteurs d'écran. */
export default function Spinner({ size = 16, label, className }) {
  return (
    <span
      role={label ? 'status' : undefined}
      className={cx('inline-flex items-center gap-2', className)}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="animate-spin shrink-0"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </span>
  )
}
