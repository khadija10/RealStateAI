import { useEffect, useState } from 'react'
import { getMarketTrends } from '../api/client'

const DEPS = [
  { code: '75', label: 'Paris' },
  { code: '92', label: 'Hauts-de-Seine' },
  { code: '93', label: 'Seine-St-Denis' },
  { code: '94', label: 'Val-de-Marne' },
  { code: '77', label: 'Seine-et-Marne' },
  { code: '78', label: 'Yvelines' },
  { code: '91', label: 'Essonne' },
  { code: '95', label: "Val-d'Oise" },
]

const DEP_COLORS = {
  '75': '#2E86C1',  // seine
  '92': '#B08D57',  // limestone
  '93': '#e67e22',
  '94': '#8e44ad',
  '77': '#27ae60',
  '78': '#e74c3c',
  '91': '#16a085',
  '95': '#7f8c8d',
}

const MOIS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function formatK(v) {
  return v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v))
}

function SparkLine({ data, color, width = 600, height = 140 }) {
  if (!data || data.length < 2) return null

  const prices = data.map((d) => d.prix_m2_median)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const range = maxP - minP || 1

  const padX = 8
  const padY = 12
  const usableW = width - padX * 2
  const usableH = height - padY * 2

  const points = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * usableW
    const y = padY + (1 - (d.prix_m2_median - minP) / range) * usableH
    return [x, y]
  })

  const pathD = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaD = `${pathD} L${points.at(-1)[0].toFixed(1)},${(padY + usableH).toFixed(1)} L${padX},${(padY + usableH).toFixed(1)} Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" aria-hidden="true">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#grad-${color.replace('#', '')})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dernier point */}
      <circle cx={points.at(-1)[0]} cy={points.at(-1)[1]} r="3.5" fill={color} />
    </svg>
  )
}

export default function MarketTrends() {
  const [allData, setAllData] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeDeps, setActiveDeps] = useState(['75', '92', '93'])

  useEffect(() => {
    getMarketTrends()
      .then(setAllData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function toggleDep(code) {
    setActiveDeps((prev) =>
      prev.includes(code) ? (prev.length > 1 ? prev.filter((d) => d !== code) : prev) : [...prev, code]
    )
  }

  // Construire un tableau de points par département sélectionné
  const byDep = activeDeps.map((code) => {
    const rows = allData
      .filter((r) => String(r.code_departement) === code)
      .sort((a, b) => a.mois_index - b.mois_index)
    return { code, label: DEPS.find((d) => d.code === code)?.label ?? code, rows, color: DEP_COLORS[code] }
  })

  // Axe X : labels mois communs (on prend les labels du premier dept)
  const xLabels = byDep[0]?.rows.map((r) => {
    const m = Number(r.mois)
    return m === 1 ? String(r.annee) : MOIS_LABELS[m - 1]
  }) ?? []

  // Valeur courante (dernier point)
  const currentPrices = byDep.map((d) => ({
    ...d,
    current: d.rows.at(-1)?.prix_m2_median ?? 0,
    prev: d.rows.at(-13)?.prix_m2_median ?? null, // même mois an dernier
  }))

  return (
    <section className="mb-16">
      {/* Prix actuels */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {currentPrices.map(({ code, label, current, prev, color }) => {
          const delta = prev ? ((current - prev) / prev) * 100 : null
          return (
            <div key={code} className="bg-white rounded-xl border border-stone-100 shadow-[var(--shadow-card)] p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <p className="text-xs font-medium text-ink-muted truncate">{label}</p>
              </div>
              <p className="font-[var(--font-display)] text-2xl text-ink tabular-nums">
                {new Intl.NumberFormat('fr-FR').format(Math.round(current))} €
              </p>
              <p className="text-[11px] text-ink-muted">/ m²</p>
              {delta !== null && (
                <p className={`text-xs font-medium mt-1 ${delta >= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(1)}% sur 1 an
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Sélecteur départements */}
      <div className="flex flex-wrap gap-2 mb-4">
        {DEPS.map(({ code, label }) => (
          <button
            key={code}
            onClick={() => toggleDep(code)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              activeDeps.includes(code)
                ? 'border-transparent text-white'
                : 'border-stone-100 text-ink-muted hover:border-stone-600/40'
            }`}
            style={activeDeps.includes(code) ? { backgroundColor: DEP_COLORS[code] } : {}}
          >
            {code} · {label}
          </button>
        ))}
      </div>

      {/* Graphique */}
      <div className="bg-white rounded-2xl border border-stone-100 shadow-[var(--shadow-card)] p-6">
        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="h-5 w-5 rounded-full border-2 border-stone-100 border-t-seine animate-spin" />
          </div>
        ) : (
          <div className="relative">
            {byDep.map(({ code, rows, color }) => (
              <div key={code} className="absolute inset-0" style={{ pointerEvents: 'none' }}>
                <SparkLine data={rows} color={color} />
              </div>
            ))}
            {/* Même hauteur pour les sparklines superposés */}
            <div style={{ height: 140 }} />

            {/* Axe X — années */}
            <div className="flex justify-between mt-1 px-2">
              {xLabels
                .map((l, i) => ({ l, i }))
                .filter(({ l }) => /^\d{4}$/.test(l))
                .map(({ l, i }) => (
                  <span key={i} className="text-[10px] text-ink-muted">{l}</span>
                ))}
            </div>
          </div>
        )}

        {/* Légende inline */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-stone-100">
          {byDep.map(({ code, label, color }) => (
            <div key={code} className="flex items-center gap-1.5">
              <div className="h-0.5 w-6 rounded" style={{ backgroundColor: color }} />
              <span className="text-xs text-ink-muted">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
