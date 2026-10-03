import { useId, useState } from 'react'
import { cx } from '../../lib/cx'

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

/**
 * Curseur + saisie exacte : la valeur se règle au curseur ou se tape au
 * clavier (bornée à [min, max]). `suffix` : unité affichée (€, € / mois, ans…).
 */
export default function RangeInput({ label, value, min, max, step = 1, onChange, suffix = '€', hint, className }) {
  const id = useId()
  // Texte en cours de saisie (null hors édition : la valeur formatée s'affiche).
  const [texte, setTexte] = useState(null)

  function valider() {
    const n = Number(String(texte ?? '').replace(/[^\d,.-]/g, '').replace(',', '.'))
    if (texte != null && texte.trim() !== '' && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))))
    setTexte(null)
  }

  const pos = max > min ? ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100 : 0

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={`${id}-r`} className="text-[12.5px] font-medium text-ink-soft">{label}</label>
        <span className="flex items-baseline gap-1">
          <input
            id={`${id}-n`}
            aria-label={`${label} (saisie exacte)`}
            inputMode="numeric"
            value={texte ?? nf.format(value)}
            onFocus={(e) => { setTexte(nf.format(value)); requestAnimationFrame(() => e.target.select()) }}
            onChange={(e) => setTexte(e.target.value)}
            onBlur={valider}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            className="ds-num w-[5.5rem] rounded-[7px] bg-transparent px-1 py-0.5 text-right text-[13.5px] font-semibold text-ink outline-none transition-colors hover:bg-surface-2 focus:bg-surface-2 focus:ring-1 focus:ring-line-strong"
          />
          <span className="text-[12px] text-ink-muted">{suffix}</span>
        </span>
      </div>
      <input
        id={`${id}-r`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={`${nf.format(value)} ${suffix}`}
        className="w-full"
        style={{ background: `linear-gradient(to right, var(--color-ink) ${pos}%, var(--color-line) ${pos}%)` }}
      />
      {hint && <p className="text-[11.5px] text-ink-muted">{hint}</p>}
    </div>
  )
}
