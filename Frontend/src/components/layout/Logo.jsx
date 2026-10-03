import { Link } from 'react-router-dom'
import { cx } from '../../lib/cx'

/** Logotype RealStateAI : monogramme + nom, lien vers l'accueil. */
export default function Logo({ className, compact = false }) {
  return (
    <Link
      to="/estimation"
      aria-label="RealStateAI, retour à l'estimation"
      className={cx('group inline-flex items-center gap-2.5 rounded-control', className)}
    >
      <span
        aria-hidden="true"
        className="grid h-8 w-8 place-items-center rounded-[9px] bg-brand text-on-brand transition-transform duration-200 ease-soft group-hover:-rotate-3"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M4 19.5V10l8-5.5 8 5.5v9.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M8.5 19.5v-4.2a3.5 3.5 0 0 1 7 0v4.2" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </span>
      {!compact && (
        <span className="text-[17px] font-semibold tracking-tight text-ink">
          RealState<span className="ds-figure ml-px text-[1.18em] italic text-accent-ink">AI</span>
        </span>
      )}
    </Link>
  )
}
