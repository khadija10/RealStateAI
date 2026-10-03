import { Link } from 'react-router-dom'
import { euro } from '../../lib/format'
import { IconEstimate } from '../ui'

/**
 * Rappel du bien repris de l'estimation, avec la possibilité de repartir
 * de zéro. Affiché sur fond blanc, en tête du formulaire du simulateur.
 */
export default function PrefillBanner({ bien, actif, onToggle }) {
  if (!bien) {
    return (
      <p className="flex items-center gap-2 rounded-[14px] bg-surface-2 px-3 py-1.5 text-[12.5px] text-ink-muted ring-1 ring-inset ring-line">
        <IconEstimate size={15} className="shrink-0" />
        <span>
          <Link to="/estimation" className="font-medium text-ink underline-offset-2 hover:underline">Estimez un bien</Link>{' '}
          pour pré-remplir ce simulateur avec son prix.
        </span>
      </p>
    )
  }
  if (bien.demo && !actif) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[14px] bg-warning-soft px-3 py-1.5 ring-1 ring-inset ring-warning/25">
        <p className="min-w-0 flex-1 truncate text-[12.5px] text-ink-soft" title="Le prix d’une estimation de démonstration n’est pas une estimation : il n’est pas repris automatiquement.">
          Dernière estimation en <b className="font-semibold text-ink">mode démonstration</b> ({bien.lieu} · <span className="ds-num">{euro(bien.prix)}</span>) : prix non repris
        </p>
        <button type="button" onClick={onToggle} className="shrink-0 text-[12px] font-medium text-accent-ink underline-offset-2 hover:underline">
          Le reprendre quand même
        </button>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-[14px] bg-accent-soft/60 px-3 py-1.5 ring-1 ring-inset ring-accent/20">
      <p className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px] text-ink-soft">
        <IconEstimate size={15} className="shrink-0 text-accent-ink" />
        <span className="min-w-0 truncate">
          {actif ? (bien.demo ? 'Prix de démonstration repris' : 'Repris de l’estimation') : 'Estimation disponible'} :{' '}
          <b className="font-semibold text-ink">{bien.lieu}</b> · <span className="ds-num">{euro(bien.prix)}</span>
        </span>
      </p>
      <button type="button" onClick={onToggle} className="shrink-0 text-[12px] font-medium text-accent-ink underline-offset-2 hover:underline">
        {actif ? 'Repartir de zéro' : 'Reprendre ce bien'}
      </button>
    </div>
  )
}
