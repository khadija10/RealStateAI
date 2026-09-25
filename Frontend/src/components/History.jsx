import { useEffect, useState } from 'react'
import { getSearchHistory } from '../api/client'

function formatEUR(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)
}

const TYPE_LABELS = {
  apartment: 'Appartement',
  house: 'Maison',
  studio: 'Studio',
  other: 'Autre',
}

function ComparisonSummary({ a, b, onClear }) {
  const ppmA = a.area_m2 ? a.estimated_price / a.area_m2 : null
  const ppmB = b.area_m2 ? b.estimated_price / b.area_m2 : null
  const diff = b.estimated_price - a.estimated_price
  const diffPct = ((diff / a.estimated_price) * 100).toFixed(1)
  const cheaper = diff < 0 ? 'B' : diff > 0 ? 'A' : null

  const rows = [
    { label: 'Adresse / Commune', a: a.query || a.commune || '—', b: b.query || b.commune || '—' },
    { label: 'Type', a: TYPE_LABELS[a.property_type] ?? '—', b: TYPE_LABELS[b.property_type] ?? '—' },
    { label: 'Surface', a: a.area_m2 ? `${a.area_m2} m²` : '—', b: b.area_m2 ? `${b.area_m2} m²` : '—' },
    { label: 'Prix estimé', a: formatEUR(a.estimated_price), b: formatEUR(b.estimated_price), highlight: true },
    ...(ppmA && ppmB ? [{ label: 'Prix / m²', a: formatEUR(Math.round(ppmA)), b: formatEUR(Math.round(ppmB)) }] : []),
  ]

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-[var(--shadow-card)] p-6 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">Comparaison</p>
        <button onClick={onClear} className="text-xs text-ink-muted hover:text-ink transition-colors">
          Effacer
        </button>
      </div>

      {/* Métriques clés */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-stone-50 rounded-xl p-4">
          <p className="text-[11px] text-ink-muted mb-1">Écart de prix</p>
          <p className={`text-xl font-semibold tabular-nums ${diff === 0 ? 'text-ink' : diff < 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {diff > 0 ? '+' : ''}{formatEUR(diff)}
          </p>
          <p className="text-xs text-ink-muted mt-0.5">{diff > 0 ? '+' : ''}{diffPct} %</p>
        </div>

        {ppmA && ppmB && (
          <div className="bg-stone-50 rounded-xl p-4">
            <p className="text-[11px] text-ink-muted mb-1">Écart prix / m²</p>
            <p className={`text-xl font-semibold tabular-nums ${ppmB === ppmA ? 'text-ink' : ppmB < ppmA ? 'text-emerald-600' : 'text-red-500'}`}>
              {ppmB - ppmA > 0 ? '+' : ''}{formatEUR(Math.round(ppmB - ppmA))}
            </p>
            <p className="text-xs text-ink-muted mt-0.5">par m²</p>
          </div>
        )}

        <div className="bg-stone-50 rounded-xl p-4">
          <p className="text-[11px] text-ink-muted mb-1">Prix le plus bas</p>
          {cheaper ? (
            <>
              <p className="text-xl font-semibold text-seine">Bien {cheaper}</p>
              <p className="text-xs text-ink-muted mt-0.5 truncate">
                {cheaper === 'A' ? (a.query || a.commune || '—') : (b.query || b.commune || '—')}
              </p>
            </>
          ) : (
            <p className="text-xl font-semibold text-ink">Identiques</p>
          )}
        </div>
      </div>

      {/* Tableau */}
      <div className="divide-y divide-stone-100">
        <div className="flex gap-4 pb-2">
          <span className="flex-1 text-[10px] text-ink-muted" />
          <span className="w-28 text-right">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-seine rounded-full px-2 py-0.5">A</span>
          </span>
          <span className="w-28 text-right">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-limestone rounded-full px-2 py-0.5">B</span>
          </span>
        </div>
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-4 py-2.5">
            <span className="flex-1 text-xs text-ink-muted">{row.label}</span>
            <span className={`w-28 text-right text-xs ${row.highlight ? 'font-semibold text-ink' : 'text-ink'}`}>{row.a}</span>
            <span className={`w-28 text-right text-xs ${row.highlight ? 'font-semibold text-ink' : 'text-ink'}`}>{row.b}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const PAGE_SIZE = 5

export default function History({ onReEstimate }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState([]) // max 2 ids
  const [page, setPage] = useState(0)

  useEffect(() => {
    getSearchHistory(20)
      .then(setItems)
      .catch(() => setError("Impossible de charger l'historique."))
      .finally(() => setLoading(false))
  }, [])

  function toggleSelect(item) {
    setSelected((prev) => {
      const isSelected = prev.find((s) => s.id === item.id)
      if (isSelected) return prev.filter((s) => s.id !== item.id)
      if (prev.length >= 2) return [prev[1], item]
      return [...prev, item]
    })
  }

  const totalPages = Math.ceil(items.length / PAGE_SIZE)
  const pageItems = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const selA = selected[0] ?? null
  const selB = selected[1] ?? null
  const canCompare = selA && selB && selA.estimated_price && selB.estimated_price

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="h-5 w-5 rounded-full border-2 border-stone-100 border-t-seine animate-spin" />
      </div>
    )
  }

  if (error) {
    return <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-4 text-sm text-red-600">{error}</div>
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true" className="opacity-25">
          <circle cx="22" cy="22" r="18" stroke="currentColor" strokeWidth="1.4" />
          <path d="M22 14v8l5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <p className="text-sm text-ink-muted">Aucune estimation réalisée pour l'instant.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-muted">
          {items.length} estimation{items.length > 1 ? 's' : ''} · page {page + 1}/{totalPages}
        </p>
        {items.length >= 2 && selected.length === 0 && (
          <p className="text-xs text-ink-muted">Sélectionne 2 biens pour les comparer</p>
        )}
        {selected.length > 0 && selected.length < 2 && (
          <p className="text-xs text-seine">Sélectionne un 2ème bien</p>
        )}
        {selected.length === 2 && (
          <button onClick={() => setSelected([])} className="text-xs text-ink-muted hover:text-ink transition-colors">
            Tout désélectionner
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 shadow-[var(--shadow-card)] overflow-hidden">
        <div className="divide-y divide-stone-100">
        {pageItems.map((item, i) => {
          const selIdx = selected.findIndex((s) => s.id === item.id)
          const isSelected = selIdx !== -1
          const badge = selIdx === 0 ? 'A' : selIdx === 1 ? 'B' : null

          return (
            <div
              key={item.id ?? i}
              data-testid="history-item"
              onClick={() => item.estimated_price && toggleSelect(item)}
              className={`flex items-center gap-4 px-5 py-4 transition-colors ${item.estimated_price ? 'cursor-pointer' : ''} ${isSelected ? 'bg-stone-50' : 'hover:bg-stone-50/60'}`}
            >
              {/* Badge sélection */}
              <div className="shrink-0 w-6 flex justify-center">
                {badge ? (
                  <span className={`h-6 w-6 rounded-full text-white text-xs font-semibold flex items-center justify-center ${badge === 'A' ? 'bg-seine' : 'bg-limestone'}`}>
                    {badge}
                  </span>
                ) : (
                  <span className={`h-4 w-4 rounded-full border-2 transition-colors ${isSelected ? 'border-seine bg-seine' : 'border-stone-300'}`} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink truncate">
                  {item.query || item.commune || '—'}
                </p>
                <p className="text-xs text-ink-muted mt-0.5">
                  {TYPE_LABELS[item.property_type] ?? item.property_type ?? '—'}
                  {item.area_m2 ? ` · ${item.area_m2} m²` : ''}
                  {' · '}{formatDate(item.created_at)}
                </p>
              </div>

              <div className="text-right shrink-0">
                {item.estimated_price ? (
                  <p className="text-sm font-semibold text-ink tabular-nums">{formatEUR(item.estimated_price)}</p>
                ) : (
                  <p className="text-xs text-ink-muted">—</p>
                )}
                {item.area_m2 && item.estimated_price && (
                  <p className="text-[11px] text-ink-muted tabular-nums mt-0.5">
                    {formatEUR(Math.round(item.estimated_price / item.area_m2))} / m²
                  </p>
                )}
                {onReEstimate && item.estimated_price && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onReEstimate(item) }}
                    className="text-[11px] font-medium text-seine hover:underline mt-1 block"
                  >
                    Ré-estimer
                  </button>
                )}
              </div>
            </div>
          )
        })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-stone-100">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1.5 text-xs text-ink-muted disabled:opacity-30 hover:text-ink transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Précédent
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`h-1.5 rounded-full transition-all ${i === page ? 'w-4 bg-seine' : 'w-1.5 bg-stone-300'}`}
              />
            ))}
          </div>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="flex items-center gap-1.5 text-xs text-ink-muted disabled:opacity-30 hover:text-ink transition-colors"
          >
            Suivant
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        )}
      </div>

      {canCompare && (
        <ComparisonSummary a={selA} b={selB} onClear={() => setSelected([])} />
      )}
    </div>
  )
}
