import { useRef } from 'react'
import { cx } from '../../lib/cx'

/**
 * Choix exclusif entre quelques options (2 à 5), au clavier comme à la souris.
 * Implémente le motif ARIA « radiogroup » : flèches pour changer d'option.
 *
 *   <SegmentedControl label="Rechercher par" value={mode} onChange={setMode}
 *     options={[{ value: 'adresse', label: 'Adresse' }, { value: 'commune', label: 'Commune' }]} />
 */
export default function SegmentedControl({ label, options, value, onChange, size = 'md', fullWidth = false, className }) {
  const refs = useRef([])
  const index = Math.max(0, options.findIndex((o) => o.value === value))

  function onKeyDown(e) {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (index + delta + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cx(
        'inline-flex rounded-control border border-line bg-surface-2 p-1 gap-1',
        fullWidth && 'flex w-full',
        className,
      )}
    >
      {options.map((o, i) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cx(
              'inline-flex items-center justify-center gap-1.5 rounded-[7px] font-medium whitespace-nowrap',
              'transition-[background-color,color,box-shadow] duration-150',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3.5 text-[13px]',
              fullWidth && 'flex-1',
              selected ? 'bg-surface text-ink shadow-xs ring-1 ring-line' : 'text-ink-muted hover:text-ink',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
