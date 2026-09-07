import ConfidenceGauge, { formatEUR } from './ConfidenceGauge'

const MODEL_BADGE = {
  ml: { label: 'Modèle ML · LightGBM', color: 'text-seine bg-seine/8 border-seine/20' },
  dvf: { label: 'Données DVF', color: 'text-limestone bg-limestone/8 border-limestone/20' },
  mock: { label: 'Estimation indicative', color: 'text-ink-muted bg-stone-100 border-stone-100' },
}

export default function ResultPanel({ status, error, result, query }) {
  const badge = result?.model ? MODEL_BADGE[result.model] ?? MODEL_BADGE.dvf : null

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-[var(--shadow-card)] p-6 sm:p-8 min-h-[420px] flex flex-col">
      <h2 className="font-[var(--font-display)] text-[1.6rem] text-ink leading-tight">Estimation</h2>

      {status === 'idle' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-10">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true" className="opacity-30">
            <path d="M8 40 L16 12 L32 12 L40 40 Z" stroke="var(--color-ink-muted)" strokeWidth="1.4" />
            <line x1="19.5" y1="12" x2="16.5" y2="40" stroke="var(--color-ink-muted)" strokeWidth="1" />
            <line x1="28.5" y1="12" x2="31.5" y2="40" stroke="var(--color-ink-muted)" strokeWidth="1" />
          </svg>
          <p className="text-sm text-ink-muted max-w-[220px]">
            Complétez le formulaire pour voir apparaître l&apos;estimation ici.
          </p>
        </div>
      )}

      {status === 'loading' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10">
          <div className="h-6 w-6 rounded-full border-2 border-stone-100 border-t-seine animate-spin" />
          <p className="text-sm text-ink-muted">Calcul de l&apos;estimation…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-10">
          <p className="text-sm text-red-500 font-medium">Estimation impossible</p>
          <p className="text-sm text-ink-muted max-w-[280px]">{error}</p>
        </div>
      )}

      {status === 'success' && result && (
        <div className="flex-1 flex flex-col justify-between animate-[fadeIn_0.4s_ease-out]">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted mt-1">
              {query.commune}{query.address ? ` · ${query.address}` : ''}
              {query.postal_code ? ` ${query.postal_code}` : ''}
            </p>
            <p className="font-[var(--font-display)] text-5xl text-ink mt-3 tabular-nums">
              {formatEUR(result.price)}
            </p>
            <p className="text-sm text-ink-muted mt-1">
              soit {formatEUR(result.pricePerM2)} / m²
            </p>

            {badge && (
              <span className={`inline-flex items-center mt-3 text-[11px] font-medium px-2 py-0.5 rounded border ${badge.color}`}>
                {badge.label}
              </span>
            )}

            {result.adresseNormalisee && (
              <p className="text-[11px] text-ink-muted mt-2">
                Adresse géolocalisée : {result.adresseNormalisee}
              </p>
            )}
          </div>

          <div className="mt-8">
            <p className="text-xs font-medium text-ink-muted mb-3">Fourchette de confiance</p>
            <ConfidenceGauge low={result.low} estimate={result.price} high={result.high} />
          </div>
        </div>
      )}
    </div>
  )
}
