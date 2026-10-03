import { cx } from '../../lib/cx'
import { Illustration } from '../ui'

/**
 * Bloc d'ouverture d'un simulateur : illustration de la marque en fond,
 * titre, accroche, puis le formulaire et le résultat posés dessus — le même
 * principe que le héros de la page Estimation.
 */
export default function SimulationShell({ draw, eyebrow, title, lead, aside, children, className }) {
  return (
    <section
      aria-labelledby="titre-page"
      className={cx('relative isolate overflow-hidden rounded-[28px] bg-[#7F8FB8] shadow-xs', className)}
    >
      <Illustration draw={draw} className="absolute inset-0 -z-20" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(15,20,30,.42)_0%,rgba(15,20,30,.10)_30%,rgba(18,16,14,.22)_70%,rgba(18,16,14,.55)_100%),linear-gradient(90deg,rgba(15,20,30,.30),rgba(15,20,30,0)_60%)]"
      />
      {/* Marges, titre et accroche identiques au héros de la page Estimation */}
      <div className="flex flex-col gap-4 p-2 pt-6 sm:p-3 sm:pt-8">
        <div className="flex flex-col-reverse items-start gap-4 px-4 sm:px-8 md:flex-row md:justify-between">
          <div className="max-w-2xl text-white">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">{eyebrow}</p>
            <h1
              id="titre-page"
              className="text-balance font-[family-name:var(--font-display)] text-[clamp(2.2rem,1.4rem+2.7vw,3.6rem)] font-normal leading-[.98] tracking-[-0.02em] [&_em]:italic"
            >
              {title}
            </h1>
            {lead && <p className="mt-3 max-w-2xl text-pretty text-[14.5px] font-light leading-relaxed text-white/90">{lead}</p>}
          </div>
          {aside}
        </div>
        {children}
      </div>
    </section>
  )
}

/** Pastille claire posée sur l'illustration (statut, barème…). */
export function ShellPill({ tone = 'neutral', children }) {
  const dot = { neutral: 'bg-ink-muted', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', loading: 'bg-ink-muted animate-pulse' }[tone]
  return (
    <p className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-[11.5px] font-medium text-[#141311] backdrop-blur-sm">
      <span className={cx('h-1.5 w-1.5 rounded-full', dot)} aria-hidden="true" />
      {children}
    </p>
  )
}
