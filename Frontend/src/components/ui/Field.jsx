import { useId } from 'react'
import { cx } from '../../lib/cx'
import { IconAlert } from './icons'

/**
 * Enveloppe d'un champ : libellé, aide et message d'erreur reliés au champ
 * par `aria-describedby`. Le champ est fourni en render prop :
 *
 *   <Field label="Surface" hint="En m²" error={err}>
 *     {(props) => <Input type="number" {...props} />}
 *   </Field>
 */
export default function Field({ label, hint, error, optional = false, className, children, id: idProp }) {
  const autoId = useId()
  const id = idProp ?? autoId
  const hintId = hint ? `${id}-aide` : undefined
  const errorId = error ? `${id}-erreur` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-ink-soft">
          {label}
          {optional && <span className="ml-1 font-normal text-ink-muted">(facultatif)</span>}
        </label>
      )}
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-xs text-danger">
          <IconAlert size={14} className="mt-px shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
