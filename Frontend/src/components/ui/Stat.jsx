import { cx } from '../../lib/cx'

/**
 * Indicateur chiffré : libellé, valeur, précision.
 * La valeur utilise des chiffres tabulaires pour rester alignée.
 */
export default function Stat({ label, value, hint, size = 'md', align = 'left', className }) {
  const valueSize = size === 'lg' ? 'text-3xl sm:text-4xl' : size === 'sm' ? 'text-lg' : 'text-2xl'
  return (
    <div className={cx('flex flex-col gap-1', align === 'center' && 'items-center text-center', className)}>
      <span className="text-xs text-ink-muted">{label}</span>
      <span className={cx('ds-num ds-figure text-ink', valueSize)}>{value}</span>
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </div>
  )
}
