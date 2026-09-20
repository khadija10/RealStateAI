import ConfidenceGauge, { formatEUR } from './ConfidenceGauge'

const MODEL_CONFIG = {
  ml: {
    label: 'LightGBM · Modèle ML',
    color: 'text-seine bg-seine/8 border-seine/20',
    dot: 'bg-seine',
    description: 'Prédiction géolocalisée via l\'API BAN.',
    mape: 'Erreur médiane : 19.2 %',
    reliabilityLabel: 'Précision du modèle',
  },
  dvf: {
    label: 'Données DVF',
    color: 'text-limestone bg-limestone/8 border-limestone/20',
    dot: 'bg-limestone',
    description: 'Médiane calculée sur transactions comparables.',
    mape: null,
    reliabilityLabel: 'Représentativité des données',
  },
  mock: {
    label: 'Estimation indicative',
    color: 'text-ink-muted bg-stone-100 border-stone-200',
    dot: 'bg-stone-400',
    description: 'Backend hors ligne — données non représentatives.',
    mape: null,
    reliabilityLabel: 'Fiabilité',
  },
}

function ReliabilityBar({ value }) {
  const pct = Math.round((value ?? 0) * 100)
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-ink tabular-nums w-8 text-right">{pct} %</span>
    </div>
  )
}

function MetaRow({ label, value }) {
  if (value === null || value === undefined) return null
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className="text-xs font-medium text-ink text-right">{value}</span>
    </div>
  )
}

export default function ResultPanel({ status, error, result, query }) {
  const cfg = result?.model ? MODEL_CONFIG[result.model] ?? MODEL_CONFIG.dvf : null
  const meta = result?.meta ?? null

  const scopeLabel = meta?.scope === 'commune'
    ? `Commune · ${meta.scope_value ?? ''}`
    : meta?.scope === 'department'
    ? `Département · ${meta.scope_value ?? ''}`
    : meta?.scope === 'ml'
    ? 'Modèle géolocalisé'
    : null

  const nTransactions = meta?.n_transactions > 0 ? meta.n_transactions : null

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-[var(--shadow-card)] p-6 sm:p-8 flex flex-col">
      <h2 className="font-[var(--font-display)] text-[1.6rem] text-ink leading-tight">Résultat</h2>

      {status === 'idle' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-14">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true" className="opacity-30">
            <path d="M8 40 L16 12 L32 12 L40 40 Z" stroke="var(--color-ink-muted)" strokeWidth="1.4" />
            <line x1="19.5" y1="12" x2="16.5" y2="40" stroke="var(--color-ink-muted)" strokeWidth="1" />
            <line x1="28.5" y1="12" x2="31.5" y2="40" stroke="var(--color-ink-muted)" strokeWidth="1" />
          </svg>
          <p className="text-sm text-ink-muted max-w-[220px]">
            Complétez le formulaire pour voir l&apos;estimation.
          </p>
        </div>
      )}

      {status === 'loading' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-14">
          <div className="h-6 w-6 rounded-full border-2 border-stone-100 border-t-seine animate-spin" />
          <p className="text-sm text-ink-muted">Calcul en cours…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-14">
          <p className="text-sm text-red-500 font-medium">Estimation impossible</p>
          <p className="text-sm text-ink-muted max-w-[280px]">{error}</p>
        </div>
      )}

      {status === 'success' && result && (
        <div className="flex-1 flex flex-col gap-6 animate-[fadeIn_0.4s_ease-out]">

          {/* Prix principal */}
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted mt-1">
              {query.address
                ? `${query.address}${query.postal_code ? ' ' + query.postal_code : ''}`
                : query.commune}
            </p>
            <p className="font-[var(--font-display)] text-5xl text-ink mt-2 tabular-nums">
              {formatEUR(result.price)}
            </p>
            <p className="text-sm text-ink-muted mt-1">
              soit {formatEUR(result.pricePerM2)} / m²
            </p>

            {/* Badge modèle */}
            {cfg && (
              <div className="flex items-center gap-2 mt-3">
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${cfg.color}`}>
                  {cfg.label}
                </span>
              </div>
            )}

            {result.adresseNormalisee && (
              <p className="text-[11px] text-ink-muted mt-2">
                Adresse BAN : {result.adresseNormalisee}
              </p>
            )}
          </div>

          {/* Fourchette */}
          <div>
            <p className="text-xs font-medium text-ink-muted mb-2">
              Fourchette {result.confidenceLabel}
            </p>
            <ConfidenceGauge low={result.low} estimate={result.price} high={result.high} />
          </div>

          {/* Confiance du modèle */}
          <div className="border-t border-stone-100 pt-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">
              Confiance du modèle
            </p>

            {result.reliability !== null && (
              <div className="space-y-1.5">
                <p className="text-xs text-ink-muted">{cfg?.reliabilityLabel}</p>
                <ReliabilityBar value={result.reliability} />
              </div>
            )}

            <div className="space-y-2">
              {cfg?.description && <MetaRow label="Méthode" value={cfg.description} />}
              {cfg?.mape && <MetaRow label="Précision (test 2025)" value={cfg.mape} />}
              {scopeLabel && <MetaRow label="Périmètre" value={scopeLabel} />}
              {nTransactions && (
                <MetaRow
                  label="Transactions utilisées"
                  value={`${nTransactions.toLocaleString('fr-FR')} ventes`}
                />
              )}
              {meta?.dispersion > 0 && (
                <MetaRow
                  label="Dispersion des prix"
                  value={`${Math.round(meta.dispersion * 100)} %`}
                />
              )}
              {result.model === 'ml' && (
                <MetaRow label="Entraîné sur" value="700 000 transactions DVF 2021-2024" />
              )}
            </div>

            {/* Notes */}
            {meta?.notes?.length > 0 && result.model !== 'ml' && (
              <div className="bg-stone-50 rounded-lg px-3 py-2">
                {meta.notes.map((n, i) => (
                  <p key={i} className="text-[11px] text-ink-muted">{n}</p>
                ))}
              </div>
            )}

            {/* Avertissement mock */}
            {result.model === 'mock' && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <p className="text-[11px] text-amber-700">
                  Le backend est hors ligne. Ces chiffres sont générés localement et n&apos;ont aucune valeur de marché.
                </p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
