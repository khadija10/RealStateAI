import { useId } from 'react'
import { cx } from '../../lib/cx'

/**
 * Curseur avec libellé et valeur formatée, rempli jusqu'à la position courante.
 * `format` met en forme la valeur affichée (ex. euro).
 */
export default function Slider({ label, value, min, max, step = 1, onChange, format = String, hint, className }) {
  const id = useId()
  const pctPos = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-ink-soft">{label}</label>
        <output htmlFor={id} className="ds-num text-sm font-semibold text-ink">{format(value)}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={format(value)}
        className="w-full"
        style={{
          background: `linear-gradient(to right, var(--color-ink) ${pctPos}%, var(--color-line) ${pctPos}%)`,
        }}
      />
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  )
}
