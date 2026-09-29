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
  ${result.dpeClasse ? `<tr><td>Classe DPE</td><td>${result.dpeClasse}</td></tr>` : ''}
  ${result.anneeConstruction ? `<tr><td>Année de construction</td><td>${result.anneeConstruction}</td></tr>` : ''}
  <tr><td>Méthode</td><td>${result.model === 'ml' ? 'LightGBM (géolocalisé)' : 'Médiane DVF'}</td></tr>
</table>
<p class="price">${formatEUR(result.price)}</p>
<p class="per-m2">soit ${formatEUR(result.pricePerM2)} / m²</p>
<div class="range">
  <div class="range-item"><p class="range-label">Fourchette basse</p><p class="range-val">${formatEUR(result.low)}</p></div>
  <div class="range-item"><p class="range-label">Fourchette haute</p><p class="range-val">${formatEUR(result.high)}</p></div>
</div>
<p class="footer">Estimation fournie à titre indicatif, sans valeur contractuelle. Modèle entraîné sur ${modelInfo?.nTrain?.toLocaleString('fr-FR') ?? '571 000'} transactions DVF Île-de-France 2021–2025, évalué sur ${modelInfo?.nTest?.toLocaleString('fr-FR') ?? '128 000'} ventes 2025. Erreur médiane${result.localMape != null ? ' locale' : ''} : ${result.localMape ?? modelInfo?.mape ?? '—'} %.</p>
</body></html>`
  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 400)
}

const DPE_STYLE = {
  A: { bg: '#dcfce7', color: '#15803d' },
  B: { bg: '#bbf7d0', color: '#15803d' },
  C: { bg: '#ecfccb', color: '#65a30d' },
  D: { bg: '#fef9c3', color: '#a16207' },
  E: { bg: '#fef3c7', color: '#b45309' },
  F: { bg: '#ffedd5', color: '#c2410c' },
  G: { bg: '#fee2e2', color: '#b91c1c' },
}

function DpeBadge({ classe }) {
  if (!classe) return null
  const s = DPE_STYLE[classe] ?? {}
  return (
    <span
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}40` }}
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded"
    >
      DPE {classe}
    </span>
  )
}

function ReliabilityRow({ value }) {
  const pct = Math.round((value ?? 0) * 100)
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'
  const label = pct >= 80 ? 'Bonne fiabilité' : pct >= 60 ? 'Fiabilité moyenne' : 'Fiabilité limitée'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-ink tabular-nums">{pct} %</span>
      <span className="text-xs text-ink-muted">{label}</span>
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

function buildShareUrl(query) {
  if (!query) return null
  const p = new URLSearchParams()
  if (query.area_m2) p.set('area_m2', query.area_m2)
  if (query.rooms) p.set('rooms', query.rooms)
  if (query.property_type) p.set('type', query.property_type)
  if (query.address) p.set('address', query.address)
  if (query.postal_code) p.set('postal_code', query.postal_code)
  if (query.commune) p.set('commune', query.commune)
  if (query.dpe_classe) p.set('dpe', query.dpe_classe)
  if (query.annee_construction) p.set('year', query.annee_construction)
  return `${window.location.origin}${window.location.pathname}?${p.toString()}`
}

export default function ResultPanel({ status, error, result, query, modelInfo, onOpenFinancement }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleCopyLink() {
    const url = buildShareUrl(query)
    if (!url) return
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

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

          {/* Avertissement géocodage incertain */}
          {result.geocodingWarning && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-amber-500 shrink-0 mt-0.5" aria-hidden="true">
                <path d="M7 1L13 12H1L7 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                <line x1="7" y1="5" x2="7" y2="8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <circle cx="7" cy="10.5" r="0.6" fill="currentColor"/>
              </svg>
              <p className="text-[11px] text-amber-700">{result.geocodingWarning}</p>
            </div>
          )}

          {/* Fiabilité — barre lisible par le client */}
          {result.reliability != null && (
            <div className="space-y-1">
              <p className="text-xs text-ink-muted">Fiabilité de l'estimation</p>
              <ReliabilityRow value={result.reliability} />
            </div>
          )}

          {/* DPE badge */}
          {result.dpeClasse && (
            <div className="flex items-center gap-2">
              <DpeBadge classe={result.dpeClasse} />
              {result.anneeConstruction && (
                <span className="text-xs text-ink-muted">construit en {result.anneeConstruction}</span>
              )}
            </div>
          )}

          {/* DPE zone + avertissement passoire */}
          {(result.dpeZoneFgPct != null || (result.dpeClasse && ['F', 'G'].includes(result.dpeClasse))) && (
            <div className="space-y-2">
              {result.dpeZoneFgPct != null && (
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                  <span>
                    <span className="font-medium text-ink">{result.dpeZoneFgPct} %</span> de passoires thermiques (F+G) dans ce secteur postal
                  </span>
                </div>
              )}
              {result.dpeClasse && ['F', 'G'].includes(result.dpeClasse) && (
                <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-orange-700">
                    <span className="font-semibold">Passoire thermique (classe {result.dpeClasse})</span> — les biens F et G se vendent en moyenne 2 à 5 % sous le prix du marché local depuis la loi Climat et Résilience. Ce bien sera interdit à la location d&apos;ici 2028.
                  </p>
                </div>
              )}
            </div>
          )}

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
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 text-xs font-medium text-ink-muted border border-stone-200 rounded-lg px-3 py-1.5 hover:border-stone-400 hover:text-ink transition-colors"
            >
              {copied ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                    <path d="M2 7l3 3 6-6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Copié !
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                    <path d="M5 2H2v9h9V8M7 2h4v4M7 6l4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Partager
                </>
              )}
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
                Détails techniques
              </span>
              <svg
                width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
                className={`text-ink-muted transition-transform duration-200 ${detailsOpen ? 'rotate-180' : ''}`}
              >
                <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {detailsOpen && (
              <div className="mt-4 space-y-2">
                <MetaRow
                  label="Méthode"
                  value={result.model === 'ml' ? 'LightGBM géolocalisé · API BAN' : 'Médiane DVF communale'}
                />
                {result.adresseNormalisee && (
                  <MetaRow label="Adresse normalisée (BAN)" value={result.adresseNormalisee} />
                )}
                {result.model === 'ml' && result.localMape != null && (
                  <MetaRow
                    label={`Erreur médiane locale${result.localMapeN != null ? ` (${result.localMapeN?.toLocaleString('fr-FR')} ventes)` : ''}`}
                    value={`${result.localMape} %`}
                  />
                )}
                {result.model === 'ml' && result.localMape == null && modelInfo?.mape != null && (
                  <MetaRow label="Erreur médiane (modèle global)" value={`${modelInfo.mape} %`} />
                )}
                {result.model === 'ml' && (
                  <MetaRow label="Fourchette" value="Modèle quantile (q7.5 – q92.5)" />
                )}
                {result.model === 'ml' && modelInfo?.r2 != null && (
                  <MetaRow label="R² (validation interne)" value={modelInfo.r2.toFixed(4)} />
                )}
                {result.model === 'ml' && modelInfo?.nFeatures != null && (
                  <MetaRow label="Variables" value={`${modelInfo.nFeatures}`} />
                )}
                {result.model === 'ml' && modelInfo?.trainedAt && (
                  <MetaRow label="Entraîné le" value={new Date(modelInfo.trainedAt).toLocaleDateString('fr-FR')} />
                )}
                {result.model === 'ml' && modelInfo?.nTrain != null && (
                  <MetaRow
                    label="Données d'entraînement"
                    value={`${modelInfo.nTrain.toLocaleString('fr-FR')} transactions DVF 2021–2025`}
                  />
                )}
                {result.model === 'ml' && modelInfo?.nTest != null && (
                  <MetaRow
                    label="Données de test"
                    value={`${modelInfo.nTest.toLocaleString('fr-FR')} transactions DVF 2025`}
                  />
                )}
                {result.model !== 'ml' && result.meta?.n_transactions > 0 && (
                  <MetaRow
                    label="Transactions comparables"
                    value={`${result.meta.n_transactions.toLocaleString('fr-FR')} ventes`}
                  />
                )}
                {result.meta?.notes?.length > 0 && result.model !== 'ml' && (
                  <div className="bg-stone-50 rounded-lg px-3 py-2 mt-2">
                    {result.meta.notes.map((n, i) => (
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
