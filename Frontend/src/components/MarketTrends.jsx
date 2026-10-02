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
  '75': '#2A1F17',  // encre/brun — Paris
  '92': '#A38C77',  // taupe
  '93': '#C2893A',  // ambre
  '94': '#54402F',  // brun-2
  '77': '#3E7A5B',  // vert
  '78': '#B5533F',  // rouge
  '91': '#6B7C73',  // vert sourdine
  '95': '#8A8171',  // gris chaud
}

const fmtFr = new Intl.NumberFormat('fr-FR')

/**
 * Évolution mensuelle de plusieurs départements sur UNE échelle commune :
 * avec une échelle par courbe, Paris (~10 000 €/m²) et la Seine-Saint-Denis
 * (~4 000 €/m²) se superposaient comme s'ils valaient le même prix.
 */
function GraphiqueTendances({ series, width = 900, height = 300 }) {
  const valeurs = series.flatMap((s) => s.rows.map((r) => r.prix_m2_median))
  if (valeurs.length < 2) return null
  const pas = 2000
  const min = Math.floor(Math.min(...valeurs) / pas) * pas
  const max = Math.ceil(Math.max(...valeurs) / pas) * pas
  const reperes = []
  for (let v = min; v <= max; v += pas) reperes.push(v)

  const mg = 64, md = 16, mh = 14, mb = 30
  const tous = series.flatMap((s) => s.rows.map((r) => r.mois_index))
  const i0 = Math.min(...tous), i1 = Math.max(...tous)
  const x = (i) => mg + ((i - i0) / (i1 - i0 || 1)) * (width - mg - md)
  const y = (v) => mh + (1 - (v - min) / (max - min || 1)) * (height - mh - mb)
  const janviers = [...new Map(series.flatMap((s) => s.rows)
    .filter((r) => Number(r.mois) === 1).map((r) => [r.annee, r.mois_index])).entries()]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img"
      aria-label="Évolution mensuelle du prix médian au m² par département">
      {reperes.map((v) => (
        <g key={v}>
          <line x1={mg} x2={width - md} y1={y(v)} y2={y(v)} stroke="var(--color-stone-100)" />
          <text x={mg - 10} y={y(v) + 4} textAnchor="end" fontSize="12" fill="var(--color-ink-muted)">
            {fmtFr.format(v)} €
          </text>
        </g>
      ))}
      {janviers.map(([annee, i]) => (
        <g key={annee}>
          <line x1={x(i)} x2={x(i)} y1={mh} y2={height - mb} stroke="var(--color-stone-100)" strokeDasharray="3 4" />
          <text x={x(i)} y={height - 8} textAnchor="middle" fontSize="12" fill="var(--color-ink-muted)">{annee}</text>
        </g>
      ))}
      {series.map(({ code, rows, color }) => rows.length > 1 && (
        <g key={code}>
          <path d={rows.map((r, k) => `${k ? 'L' : 'M'}${x(r.mois_index).toFixed(1)},${y(r.prix_m2_median).toFixed(1)}`).join(' ')}
            fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(rows.at(-1).mois_index)} cy={y(rows.at(-1).prix_m2_median)} r="4" fill={color} />
        </g>
      ))}
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
              <p className="font-display text-2xl text-ink tabular-nums">
                {new Intl.NumberFormat('fr-FR').format(Math.round(current))} €
              </p>
              <p className="text-xs text-ink-muted">/ m²</p>
              {delta !== null && (
                <p className="text-xs font-medium mt-1 text-ink-muted">
                  {delta >= 0 ? '▲ +' : '▼ '}{delta.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} % sur 1 an
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
          <GraphiqueTendances series={byDep} />
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
