import { useId } from 'react'
import { cx } from '../../lib/cx'
import { IconChevronDown } from '../ui'

/** Liste déroulante compacte des simulateurs : libellé, valeur, chevron. */
export default function SelectField({ label, value, onChange, options, className }) {
  const id = useId()
  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[12.5px] font-medium text-ink-soft">{label}</label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full cursor-pointer appearance-none rounded-[9px] bg-surface pl-3 pr-8 text-[13px] font-medium text-ink outline-none ring-1 ring-inset ring-line transition-shadow hover:ring-line-strong focus:ring-2 focus:ring-ink-muted"
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <IconChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted" />
      </div>
    </div>
  )
}
