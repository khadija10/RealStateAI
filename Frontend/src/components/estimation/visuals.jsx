import { cx } from '../../lib/cx'
import { niveauFiabilite } from '../../lib/estimation'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/**
 * Fourchette d'estimation : barre basse → haute, repère sur la valeur estimée.
 * Les bornes sont celles renvoyées par l'API (aucun calcul ici).
 */
export function RangeBar({ low, high, value, format, tone = 'light' }) {
  const pos = high > low ? clamp(((value - low) / (high - low)) * 100, 3, 97) : 50
  const dark = tone === 'dark'
  return (
    <div>
      <div className={cx('relative h-2 rounded-full', dark ? 'bg-white/20' : 'bg-line')}>
        <div className={cx('absolute inset-0 rounded-full', dark ? 'bg-white/10' : 'bg-accent/35')} />
        <span
          aria-hidden="true"
          className={cx(
            'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-500 ease-soft',
            dark ? 'h-4 w-[3px] rounded-sm bg-white' : 'h-5 w-5 rounded-full border-[3px] border-surface bg-ink shadow-sm',
          )}
          style={{ left: `${pos}%` }}
        />
      </div>
      <div className={cx('mt-2.5 flex justify-between text-xs', dark ? 'text-white/65' : 'text-ink-muted')}>
        <span>
          <span className="block">Basse</span>
          <span className={cx('ds-num font-medium', dark ? 'text-base font-semibold text-white' : 'text-sm text-ink')}>{format(low)}</span>
        </span>
        <span className="text-right">
          <span className="block">Haute</span>
          <span className={cx('ds-num font-medium', dark ? 'text-base font-semibold text-white' : 'text-sm text-ink')}>{format(high)}</span>
        </span>
      </div>
    </div>
  )
}

/**
 * Position d'un prix au m² dans la distribution d'une commune :
 * bande Q1–Q3 (50 % des ventes), trait sur la médiane, repère sur le bien.
 */
export function MarketPositionBar({ q1, median, q3, value, format, labels = ['1er quartile', 'Médiane', '3e quartile'] }) {
  const hasValue = value != null
  const lo = Math.min(q1, hasValue ? value : q1) * 0.85
  const hi = Math.max(q3, hasValue ? value : q3) * 1.1
  const p = (v) => clamp(((v - lo) / (hi - lo)) * 100, 0, 100)
  return (
    <div>
      <div className="relative h-9">
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-line" />
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-sable to-taupe"
          style={{ left: `${p(q1)}%`, width: `${p(q3) - p(q1)}%` }}
        />
        <span
          aria-hidden="true"
          className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-ink-soft"
          style={{ left: `${p(median)}%` }}
        />
        {hasValue && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[5px] border-ink bg-surface shadow-sm"
            style={{ left: `${p(value)}%` }}
          />
        )}
      </div>
      <dl className="mt-1 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-ink-muted">{labels[0]}</dt>
          <dd className="ds-num font-medium text-ink">{format(q1)}</dd>
        </div>
        <div className="text-center">
          <dt className="text-ink-muted">{labels[1]}</dt>
          <dd className="ds-num font-medium text-ink">{format(median)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-ink-muted">{labels[2]}</dt>
          <dd className="ds-num font-medium text-ink">{format(q3)}</dd>
        </div>
      </dl>
    </div>
  )
}

/** Anneau de fiabilité (0..1), coloré selon le niveau. */
export function ReliabilityRing({ value, size = 112 }) {
  const lvl = niveauFiabilite(value)
  const R = 44
  const C = 2 * Math.PI * R
  const part = C * clamp(value ?? 0, 0, 1)
  const color = { success: 'var(--color-success)', warning: 'var(--color-warning)', danger: 'var(--color-danger)' }[lvl?.tone] ?? 'var(--color-line-strong)'
  return (
    <svg width={size} height={size} viewBox="0 0 110 110" className="shrink-0" role="img" aria-label={value != null ? `Fiabilité ${Math.round(value * 100)} sur 100` : 'Fiabilité non disponible'}>
      <circle cx="55" cy="55" r={R} fill="none" stroke="var(--color-line)" strokeWidth="9" />
      <circle
        cx="55"
        cy="55"
        r={R}
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${part} ${C - part}`}
        transform="rotate(-90 55 55)"
        className="transition-[stroke-dasharray] duration-700 ease-soft"
      />
      <text x="55" y="61" textAnchor="middle" fontSize="30" fontWeight="600" letterSpacing="-0.5" fontFamily="var(--font-sans)" fill="var(--color-ink)">
        {value != null ? Math.round(value * 100) : '—'}
      </text>
      <text x="55" y="77" textAnchor="middle" fontSize="8.5" letterSpacing="1.2" fill="var(--color-ink-muted)">
        SUR 100
      </text>
    </svg>
  )
}

/** Petite ligne « libellé — valeur » pour les listes de détail. */
export function DetailRow({ label, children, className }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-4 py-2.5', className)}>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="ds-num text-right text-sm font-medium text-ink">{children}</dd>
    </div>
  )
}
