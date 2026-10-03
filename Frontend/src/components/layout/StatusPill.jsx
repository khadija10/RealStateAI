import { useHealth } from '../../context/HealthContext'
import { cx } from '../../lib/cx'
import { dateLongue, nb, pctPoints } from '../../lib/format'
import { Tooltip } from '../ui'

/**
 * Statut du backend, lu dans /api/health. Discret, mais toujours visible :
 * l'utilisateur sait si les résultats viennent du modèle, des statistiques
 * DVF, ou si le serveur est en mode démonstration / injoignable.
 */
export default function StatusPill({ compact = false }) {
  const { status, health, refresh } = useHealth()

  let tone, label, details
  if (status === 'loading') {
    tone = 'neutral'
    label = 'Connexion…'
    details = 'Vérification de la disponibilité du serveur.'
  } else if (status === 'offline') {
    tone = 'danger'
    label = 'Serveur injoignable'
    details = 'Le service d’estimation ne répond pas. Cliquez pour réessayer.'
  } else if (health.mode === 'ml') {
    tone = 'success'
    label = 'Modèle ML actif'
    details = (
      <>
        <span className="block font-medium text-ink">Modèle de prédiction chargé</span>
        {health.model.mape != null && <>Erreur moyenne (MAPE) : {pctPoints(health.model.mape)}<br /></>}
        {health.model.nTransactions != null && <>{nb(health.model.nTransactions)} transactions DVF<br /></>}
        {health.model.trainedAt && <>Entraîné le {dateLongue(health.model.trainedAt)}<br /></>}
        {health.dpe.coveragePct != null && <>Couverture DPE : {pctPoints(health.dpe.coveragePct)}</>}
      </>
    )
  } else if (health.mode === 'dvf') {
    tone = 'success'
    label = 'Données DVF'
    details = 'Estimations par comparables DVF (modèle ML non chargé).'
  } else {
    tone = 'warning'
    label = 'Mode démonstration'
    details = 'Aucune donnée chargée côté serveur : les estimations ne sont pas fiables.'
  }

  const dot = {
    neutral: 'bg-ink-muted animate-pulse',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  }[tone]

  return (
    <Tooltip content={details} align="end">
      {(a11y) => (
        <button
          type="button"
          {...a11y}
          onClick={status === 'offline' ? refresh : undefined}
          aria-label={compact ? `Statut du serveur : ${label}` : undefined}
          className={cx(
            'inline-flex h-8 items-center gap-2 rounded-full border border-line bg-surface text-xs font-medium text-ink-soft',
            'transition-colors hover:border-line-strong',
            compact ? 'w-8 justify-center' : 'px-3',
            status !== 'offline' && 'cursor-default',
          )}
        >
          <span aria-hidden="true" className={cx('h-2 w-2 shrink-0 rounded-full', dot)} />
          {!compact && <span>{label}</span>}
        </button>
      )}
    </Tooltip>
  )
}
