import { useEffect, useState } from 'react'

const CLE = 'rsai_historique'

function lire() {
  try { return JSON.parse(localStorage.getItem(CLE) || '[]') } catch { return [] }
}

const euro = (n) => Math.round(n).toLocaleString('fr-FR') + ' €'

/**
 * Historique des estimations faites depuis la page "Estimation" (artefact),
 * conservé dans le navigateur (localStorage), propre à cet appareil —
 * distinct de l'historique authentifié ci-dessous, lié au compte.
 */
export default function LocalEstimationsHistory() {
  const [items, setItems] = useState([])

  useEffect(() => {
    setItems(lire())
  }, [])

  if (!items.length) return null

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-[var(--shadow-card)] p-6 mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted mb-4">
        Sur cet appareil
      </p>
      <div className="divide-y divide-stone-100">
        {items.map((x, i) => (
          <div key={i} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
            <span className="flex-1 min-w-0 text-sm truncate">{x.query}</span>
            <span className="text-xs text-ink-muted whitespace-nowrap">
              {x.area_m2} m² · {new Date(x.created_at).toLocaleDateString('fr-FR')}
            </span>
            <span className="font-display text-lg whitespace-nowrap">{euro(x.prix)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
