import { useState } from 'react'
import { formatEUR } from './ConfidenceGauge'

// Taux de croissance annuels par département — tendances DVF IDF 2021-2025
// 3 scénarios : correction prolongée / stabilisation / retour tendance haussière
const GROWTH_RATES = {
  "75": { pessimiste: -0.025, neutre: 0.008, optimiste: 0.025 },  // Paris — correction récente forte
  "92": { pessimiste: -0.018, neutre: 0.010, optimiste: 0.027 },  // Hauts-de-Seine
  "93": { pessimiste: -0.008, neutre: 0.018, optimiste: 0.038 },  // Seine-Saint-Denis — potentiel haussier
  "94": { pessimiste: -0.012, neutre: 0.012, optimiste: 0.030 },  // Val-de-Marne
  "77": { pessimiste: -0.008, neutre: 0.015, optimiste: 0.030 },  // Seine-et-Marne
  "78": { pessimiste: -0.012, neutre: 0.010, optimiste: 0.025 },  // Yvelines
  "91": { pessimiste: -0.010, neutre: 0.013, optimiste: 0.028 },  // Essonne
  "95": { pessimiste: -0.010, neutre: 0.013, optimiste: 0.028 },  // Val-d'Oise
}
const DEFAULT_RATES = { pessimiste: -0.010, neutre: 0.012, optimiste: 0.028 }

const HORIZONS = [1, 2, 3, 5, 10]

const SCENARIOS = [
  { key: 'pessimiste', label: 'Pessimiste', colorVal: 'text-red-500', colorBg: 'bg-red-50', colorBorder: 'border-red-100' },
  { key: 'neutre',     label: 'Neutre',     colorVal: 'text-ink',     colorBg: 'bg-stone-50', colorBorder: 'border-stone-200' },
  { key: 'optimiste',  label: 'Optimiste',  colorVal: 'text-emerald-600', colorBg: 'bg-emerald-50', colorBorder: 'border-emerald-100' },
]

function fmtRate(r) {
  const sign = r >= 0 ? '+' : ''
  return `${sign}${(r * 100).toFixed(1)} %/an`
}

function fmtDelta(projected, base) {
  const pct = ((projected - base) / base) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)} %`
}

function depFromPostal(postal) {
  if (!postal) return null
  const s = String(postal).replace(/\s/g, '')
  if (s.startsWith('75') && s.length === 5) return '75'
  return s.slice(0, 2)
}

export default function ValuationProjection({ basePrice, query }) {
  const [open, setOpen] = useState(false)

  if (!basePrice || basePrice <= 0) return null

  const dep = depFromPostal(query?.postal_code)
  const rates = GROWTH_RATES[dep] ?? DEFAULT_RATES
  const depLabel = dep
    ? { "75": "Paris (75)", "92": "Hauts-de-Seine (92)", "93": "Seine-Saint-Denis (93)",
        "94": "Val-de-Marne (94)", "77": "Seine-et-Marne (77)", "78": "Yvelines (78)",
        "91": "Essonne (91)", "95": "Val-d'Oise (95)" }[dep] ?? `Dep. ${dep}`
    : "Île-de-France"

  // Projections par scénario et horizon
  const proj = {}
  for (const sc of SCENARIOS) {
    proj[sc.key] = HORIZONS.map(y => Math.round(basePrice * Math.pow(1 + rates[sc.key], y)))
  }

  return (
    <div className="border-t border-stone-100 pt-5">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between group"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted group-hover:text-ink transition-colors">
          Valorisation à terme
        </p>
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          className={`text-ink-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="mt-4 space-y-4 animate-[fadeIn_0.25s_ease-out]">
          <p className="text-[11px] text-ink-muted">
            Scénarios de projection — {depLabel}
          </p>

          {/* Légende scénarios */}
          <div className="grid grid-cols-3 gap-2">
            {SCENARIOS.map(sc => (
              <div key={sc.key} className={`rounded-lg border ${sc.colorBorder} ${sc.colorBg} px-2.5 py-2 text-center`}>
                <p className={`text-[11px] font-medium ${sc.colorVal}`}>{sc.label}</p>
                <p className="text-[10px] text-ink-muted mt-0.5 tabular-nums">{fmtRate(rates[sc.key])}</p>
              </div>
            ))}
          </div>

          {/* Tableau */}
          <div className="overflow-hidden rounded-xl border border-stone-100">
            {/* Header */}
            <div className="grid grid-cols-4 bg-stone-50 px-3 py-2 border-b border-stone-100">
              <span className="text-[10px] font-medium text-ink-muted uppercase tracking-wide">Horizon</span>
              {SCENARIOS.map(sc => (
                <span key={sc.key} className={`text-[10px] font-medium uppercase tracking-wide text-right ${sc.colorVal}`}>
                  {sc.label}
                </span>
              ))}
            </div>

            {/* Ligne aujourd'hui */}
            <div className="grid grid-cols-4 px-3 py-2.5 border-b border-stone-100 bg-white">
              <span className="text-xs text-ink-muted">Auj.</span>
              {SCENARIOS.map(sc => (
                <span key={sc.key} className="text-xs text-ink-muted text-right tabular-nums">
                  {formatEUR(basePrice)}
                </span>
              ))}
            </div>

            {/* Lignes par horizon */}
            {HORIZONS.map((y, i) => (
              <div
                key={y}
                className={`grid grid-cols-4 px-3 py-2.5 ${i < HORIZONS.length - 1 ? 'border-b border-stone-100' : ''} hover:bg-stone-50/60 transition-colors`}
              >
                <div>
                  <span className="text-xs font-medium text-ink">{y} an{y > 1 ? 's' : ''}</span>
                </div>
                {SCENARIOS.map(sc => {
                  const val = proj[sc.key][i]
                  const delta = fmtDelta(val, basePrice)
                  return (
                    <div key={sc.key} className="text-right">
                      <p className={`text-xs font-medium tabular-nums ${sc.colorVal}`}>
                        {formatEUR(val)}
                      </p>
                      <p className="text-[10px] text-ink-muted tabular-nums">{delta}</p>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          <p className="text-[10px] text-ink-muted leading-relaxed">
            Projection indicative basée sur les tendances historiques DVF IDF. Les prix immobiliers
            dépendent de facteurs imprévisibles (taux, politique, démographie). Hors valeur contractuelle.
          </p>
        </div>
      )}
    </div>
  )
}
