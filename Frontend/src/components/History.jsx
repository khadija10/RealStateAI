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

export default function History() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getSearchHistory(20)
      .then(setItems)
      .catch(() => setError("Impossible de charger l'historique."))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="h-5 w-5 rounded-full border-2 border-stone-100 border-t-seine animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-4 text-sm text-red-600">{error}</div>
    )
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
    <div className="space-y-3">
      <p className="text-xs text-ink-muted">{items.length} estimation{items.length > 1 ? 's' : ''} enregistrée{items.length > 1 ? 's' : ''}</p>
      <div className="divide-y divide-stone-100 bg-white rounded-2xl border border-stone-100 shadow-[var(--shadow-card)] overflow-hidden">
        {items.map((item, i) => (
          <div key={item.id ?? i} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-stone-50 transition-colors">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink truncate">
                {item.commune || item.query || '—'}
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
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
