import { useId, useState } from 'react'
import { cx } from '../../lib/cx'

/**
 * Info-bulle légère, au survol et au focus clavier. Le contenu est relié au
 * déclencheur par `aria-describedby` (le déclencheur doit être focalisable).
 */
export default function Tooltip({ content, children, side = 'bottom', align = 'center', className }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  if (!content) return children(undefined)
  return (
    <span
      className={cx('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
    >
      {children({ 'aria-describedby': id })}
      <span
        id={id}
        role="tooltip"
        className={cx(
          'pointer-events-none absolute z-40 w-max max-w-72 rounded-control border border-line bg-surface px-3 py-2',
          'text-left text-xs leading-relaxed text-ink-soft shadow-overlay transition-opacity duration-150',
          side === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2',
          align === 'end' ? 'right-0' : align === 'start' ? 'left-0' : 'left-1/2 -translate-x-1/2',
          open ? 'opacity-100' : 'opacity-0 invisible',
        )}
      >
        {content}
      </span>
    </span>
  )
}
