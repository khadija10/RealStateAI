import { useState } from 'react'
import ConfidenceGauge, { formatEUR } from './ConfidenceGauge'
import ValuationProjection from './ValuationProjection'

function exportPDF(result, query, modelInfo) {
  const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())
  const lieu = query?.address
    ? `${query.address}${query.postal_code ? ' ' + query.postal_code : ''}`
    : query?.commune ?? '—'
  const typeLabel = { apartment: 'Appartement', house: 'Maison', studio: 'Studio', other: 'Autre' }
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Estimation RealEstateAI</title>
<style>
  body { font-family: Georgia, serif; max-width: 680px; margin: 40px auto; color: #1F1F1F; padding: 0 20px; }
  h1 { font-size: 2rem; margin-bottom: 4px; }
  .sub { color: #6B6558; font-size: 0.9rem; margin-bottom: 32px; }
  .price { font-size: 3rem; font-weight: 600; color: #1F1F1F; margin: 16px 0 4px; }
  .per-m2 { color: #6B6558; font-size: 0.95rem; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  td { padding: 10px 0; border-bottom: 1px solid #E6E1DA; font-size: 0.9rem; }
  td:last-child { text-align: right; font-weight: 500; }
  .range { display: flex; gap: 24px; margin: 16px 0; }
  .range-item { flex: 1; background: #F2EFEA; padding: 12px 16px; border-radius: 8px; }
  .range-label { font-size: 0.75rem; color: #6B6558; text-transform: uppercase; letter-spacing: 0.08em; }
  .range-val { font-size: 1.1rem; font-weight: 600; margin-top: 4px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #E6E1DA; font-size: 0.75rem; color: #8A8171; }
</style></head><body>
<h1>Fiche d'estimation</h1>
<p class="sub">RealEstateAI · ${date}</p>
<table>
  <tr><td>Bien</td><td>${lieu}</td></tr>
  <tr><td>Type</td><td>${typeLabel[query?.property_type] ?? '—'}</td></tr>
  <tr><td>Surface</td><td>${query?.area_m2 ? query.area_m2 + ' m²' : '—'}</td></tr>
  <tr><td>Méthode</td><td>${result.model === 'ml' ? 'LightGBM (géolocalisé)' : 'Médiane DVF'}</td></tr>
</table>
<p class="price">${formatEUR(result.price)}</p>
<p class="per-m2">soit ${formatEUR(result.pricePerM2)} / m²</p>
<div class="range">
  <div class="range-item"><p class="range-label">Fourchette basse</p><p class="range-val">${formatEUR(result.low)}</p></div>
  <div class="range-item"><p class="range-label">Fourchette haute</p><p class="range-val">${formatEUR(result.high)}</p></div>
</div>
<p class="footer">Estimation fournie à titre indicatif, sans valeur contractuelle. Modèle entraîné sur ${modelInfo?.nTransactions?.toLocaleString('fr-FR') ?? '700 000'} transactions DVF Île-de-France 2021–2024. Erreur médiane${result.localMape != null ? ' locale' : ''} : ${result.localMape ?? modelInfo?.mape ?? '—'} %.</p>
</body></html>`
  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 400)
}

const MODEL_CONFIG = {
  ml: {
    label: 'LightGBM · Modèle ML',
    color: 'text-seine bg-seine/8 border-seine/20',
    dot: 'bg-seine',
    description: 'Prédiction géolocalisée via l\'API BAN.',
    reliabilityLabel: 'Précision du modèle',
  },
  dvf: {
    label: 'Données DVF',
    color: 'text-limestone bg-limestone/8 border-limestone/20',
    dot: 'bg-limestone',
    description: 'Médiane calculée sur transactions comparables.',
    reliabilityLabel: 'Représentativité des données',
  },
  mock: {
    label: 'Estimation indicative',
    color: 'text-ink-muted bg-stone-100 border-stone-200',
    dot: 'bg-stone-400',
    description: 'Backend hors ligne — données non représentatives.',
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

export default function ResultPanel({ status, error, result, query, modelInfo, onOpenFinancement }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
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
  const reliabilityPct = result?.reliability != null ? Math.round(result.reliability * 100) : null

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-[var(--shadow-card)] p-6 sm:p-8 flex flex-col">
      <h2 className="font-[var(--font-display)] text-[1.6rem] text-ink leading-tight">Résultat</h2>

      {status === 'idle' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 py-10">
          <svg width="44" height="44" viewBox="0 0 48 48" fill="none" aria-hidden="true" className="opacity-25">
            <path d="M8 40 L16 12 L32 12 L40 40 Z" stroke="currentColor" strokeWidth="1.4" />
            <line x1="19.5" y1="12" x2="16.5" y2="40" stroke="currentColor" strokeWidth="1" />
            <line x1="28.5" y1="12" x2="31.5" y2="40" stroke="currentColor" strokeWidth="1" />
          </svg>
          <p className="text-sm text-ink-muted max-w-[200px]">
            Renseignez le formulaire pour obtenir votre estimation.
          </p>
          <ul className="text-left space-y-2.5 max-w-[210px]">
            {[
              'Prix estimé et fourchette de confiance',
              'Modèle LightGBM géolocalisé',
              'Projection de plus-value à 5 ans',
              'Export PDF de la fiche',
            ].map((feat) => (
              <li key={feat} className="flex items-start gap-2 text-xs text-ink-muted">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-seine shrink-0" />
                {feat}
              </li>
            ))}
          </ul>
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
        <div className="flex-1 flex flex-col gap-5 animate-[fadeIn_0.4s_ease-out]">

          {/* ── ESSENTIEL ── */}

          {/* Localisation */}
          <p className="text-xs uppercase tracking-[0.12em] text-ink-muted mt-1">
            {query.address
              ? `${query.address}${query.postal_code ? ' ' + query.postal_code : ''}`
              : query.commune}
          </p>

          {/* Prix */}
          <div>
            <p className="font-[var(--font-display)] text-5xl text-ink tabular-nums leading-none">
              {formatEUR(result.price)}
            </p>
            <p className="text-sm text-ink-muted mt-1.5">
              soit {formatEUR(result.pricePerM2)} / m²
            </p>
          </div>

          {/* Badge modèle + fiabilité */}
          <div className="flex items-center gap-3 flex-wrap">
            {cfg && (
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${cfg.color}`}>
                  {cfg.label}
                </span>
              </div>
            )}
            {reliabilityPct != null && (
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                reliabilityPct >= 80 ? 'bg-emerald-50 text-emerald-700' :
                reliabilityPct >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
              }`}>
                Fiabilité {reliabilityPct} %
              </span>
            )}
          </div>

          {/* Fourchette */}
          <div>
            <p className="text-xs font-medium text-ink-muted mb-2">
              Fourchette {result.confidenceLabel}
            </p>
            <ConfidenceGauge low={result.low} estimate={result.price} high={result.high} />
          </div>

          {/* Avertissement mock */}
          {result.model === 'mock' && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <p className="text-[11px] text-amber-700">
                Le backend est hors ligne. Ces chiffres sont générés localement et n&apos;ont aucune valeur de marché.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => exportPDF(result, query, modelInfo)}
              className="flex items-center gap-1.5 text-xs font-medium text-ink-muted border border-stone-200 rounded-lg px-3 py-1.5 hover:border-stone-400 hover:text-ink transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path d="M2 9v2h9V9M6.5 1v7M4 6l2.5 2.5L9 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Exporter PDF
            </button>
            {onOpenFinancement && (
              <button
                onClick={() => onOpenFinancement(result.price, query)}
                className="flex items-center gap-1.5 text-xs font-medium text-seine border border-seine/20 rounded-lg px-3 py-1.5 hover:bg-seine/5 transition-colors"
              >
                Simuler mon financement →
              </button>
            )}
          </div>

          {/* ── DÉTAILS TECHNIQUES (accordéon) ── */}
          <div className="border-t border-stone-100 pt-4">
            <button
              onClick={() => setDetailsOpen((o) => !o)}
              className="flex items-center justify-between w-full text-left group"
            >
              <span className="text-xs font-medium text-ink-muted group-hover:text-ink transition-colors">
                Détails du modèle
              </span>
              <svg
                width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
                className={`text-ink-muted transition-transform duration-200 ${detailsOpen ? 'rotate-180' : ''}`}
              >
                <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {detailsOpen && (
              <div className="mt-4 space-y-3">
                {result.reliability !== null && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-ink-muted">{cfg?.reliabilityLabel}</p>
                    <ReliabilityBar value={result.reliability} />
                  </div>
                )}
                <div className="space-y-2">
                  {cfg?.description && <MetaRow label="Méthode" value={cfg.description} />}
                  {result.adresseNormalisee && <MetaRow label="Adresse BAN" value={result.adresseNormalisee} />}
                  {result.model === 'ml' && result.localMape != null && (
                    <MetaRow
                      label={`Erreur médiane locale${result.localMapeN != null ? ` (${result.localMapeN} ventes)` : ''}`}
                      value={`${result.localMape} %`}
                    />
                  )}
                  {result.model === 'ml' && result.localMape == null && modelInfo?.mape != null && (
                    <MetaRow label="Erreur médiane (modèle global)" value={`${modelInfo.mape} %`} />
                  )}
                  {result.model === 'ml' && (
                    <MetaRow label="Fourchette" value="Modèle quantile (q7.5–q92.5)" />
                  )}
                  {result.model === 'ml' && modelInfo?.r2 != null && (
                    <MetaRow label="R² (test 2025)" value={modelInfo.r2.toFixed(4)} />
                  )}
                  {result.model === 'ml' && modelInfo?.nFeatures != null && (
                    <MetaRow label="Features" value={`${modelInfo.nFeatures} variables`} />
                  )}
                  {result.model === 'ml' && modelInfo?.trainedAt && (
                    <MetaRow label="Entraîné le" value={new Date(modelInfo.trainedAt).toLocaleDateString('fr-FR')} />
                  )}
                  {scopeLabel && <MetaRow label="Périmètre" value={scopeLabel} />}
                  {nTransactions && (
                    <MetaRow label="Transactions utilisées" value={`${nTransactions.toLocaleString('fr-FR')} ventes`} />
                  )}
                  {meta?.dispersion > 0 && (
                    <MetaRow label="Dispersion des prix" value={`${Math.round(meta.dispersion * 100)} %`} />
                  )}
                  {result.model === 'ml' && modelInfo?.nTransactions != null && (
                    <MetaRow label="Entraîné sur" value={`${modelInfo.nTransactions.toLocaleString('fr-FR')} transactions DVF 2021–2024`} />
                  )}
                </div>
                {meta?.notes?.length > 0 && result.model !== 'ml' && (
                  <div className="bg-stone-50 rounded-lg px-3 py-2">
                    {meta.notes.map((n, i) => (
                      <p key={i} className="text-[11px] text-ink-muted">{n}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── VALORISATION À TERME ── */}
          {result.model !== 'mock' && (
            <ValuationProjection basePrice={result.price} query={query} />
          )}

        </div>
      )}
    </div>
  )
}
