import { cx } from '../../lib/cx'
import { Illustration } from '../ui'

/**
 * Carte de résultat sombre sur une vignette de la marque (même traitement
 * que la carte du prix sur la page Estimation).
 */
export default function DarkPanel({ draw, className, children, ...rest }) {
  return (
    <div
      className={cx('@container relative isolate flex flex-col overflow-hidden rounded-[22px] bg-[#3A2B21] p-5 text-white sm:p-6', className)}
      {...rest}
    >
      {draw && <Illustration draw={draw} className="absolute inset-0 -z-20 opacity-90" />}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(40,28,20,.40)_0%,rgba(40,28,20,.88)_58%)]" />
      {children}
    </div>
  )
}

/** Tuile translucide d'une carte sombre : valeur en gras, libellé. */
export function Mesure({ value, label, tone }) {
  return (
    <div className="@container min-w-0 rounded-[14px] border border-white/15 bg-white/10 px-3 py-3 backdrop-blur-sm">
      <p
        className={cx(
          // Taille relative à la largeur de la tuile : le montant tient toujours en entier.
          'ds-num whitespace-nowrap text-[clamp(13px,12.5cqi,21px)] font-semibold leading-none tracking-[-0.02em]',
          tone === 'pos' ? 'text-[#9FE0B9]' : tone === 'neg' ? 'text-[#F2A99A]' : 'text-white',
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-white/80">{label}</p>
    </div>
  )
}

/** Pastille de verdict sur fond sombre. */
export function VerdictPill({ tone = 'neutral', children }) {
  const dot = { success: 'bg-[#6FD39C]', warning: 'bg-[#E0A650]', danger: 'bg-[#F08A76]', neutral: 'bg-white/60 animate-pulse' }[tone]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-medium text-white backdrop-blur-sm">
      <span className={cx('h-1.5 w-1.5 rounded-full', dot)} aria-hidden="true" />
      {children}
    </span>
  )
}
