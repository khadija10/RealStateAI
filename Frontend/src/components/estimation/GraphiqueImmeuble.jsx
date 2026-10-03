import { useEffect, useRef, useState } from 'react'
import { euroM2 } from '../../lib/format'

const moisAn = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' })
const kEuros = (v) => `${(v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k€`

/** Année décimale d'une date ISO (2024-07-01 → 2024,5), null si invalide. */
function anneeDecimale(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const debut = new Date(d.getFullYear(), 0, 1)
  return d.getFullYear() + (d - debut) / (365.25 * 24 * 3600 * 1000)
}

/**
 * Ventes de l'immeuble dans le temps : chaque vente est un point (prix au m²
 * le jour de la vente), la médiane annuelle du secteur une ligne pointillée.
 * Montre si l'immeuble se vend au-dessus ou au-dessous de son quartier.
 * Données : comparables_immeuble et secteur.eco renvoyés par le serveur.
 */
export default function GraphiqueImmeuble({ ventes, serie = [], nomSecteur }) {
  const ref = useRef(null)
  const [largeur, setLargeur] = useState(560)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setLargeur(Math.max(260, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const points = ventes
    .map((v) => ({ ...v, x: anneeDecimale(v.date) }))
    .filter((v) => v.x != null && v.prix_m2 != null)
  if (!points.length) return null

  const H = 190
  const m = { g: 50, d: 12, h: 12, b: 26 }
  const annees = [...points.map((p) => Math.floor(p.x)), ...serie.map((s) => s.annee)]
  const x0 = Math.min(...annees)
  const x1 = Math.max(...annees) + 1
  const valeurs = [...points.map((p) => p.prix_m2), ...serie.map((s) => s.prix)]
  const marge = (Math.max(...valeurs) - Math.min(...valeurs)) * 0.15 || Math.max(...valeurs) * 0.08
  const pas = 500
  const y0 = Math.floor((Math.min(...valeurs) - marge) / pas) * pas
  const y1 = Math.ceil((Math.max(...valeurs) + marge) / pas) * pas
  const reperes = []
  const pasY = Math.max(pas, Math.ceil((y1 - y0) / 4 / pas) * pas)
  for (let v = y0; v <= y1; v += pasY) reperes.push(v)

  const X = (a) => m.g + ((a - x0) / (x1 - x0)) * (largeur - m.g - m.d)
  const Y = (v) => m.h + (1 - (v - y0) / (y1 - y0)) * (H - m.h - m.b)
  const serieTriee = [...serie].sort((a, b) => a.annee - b.annee)
  const ligne = serieTriee.map((s, i) => `${i ? 'L' : 'M'}${X(s.annee + 0.5).toFixed(1)},${Y(s.prix).toFixed(1)}`).join(' ')
  const resume = points.map((p) => `${moisAn.format(new Date(p.date))} : ${euroM2(p.prix_m2)}${p.vefa ? ' (neuf)' : ''}`).join(', ')

  return (
    <figure ref={ref} className="m-0">
      <svg className="block" width={largeur} height={H} viewBox={`0 0 ${largeur} ${H}`} role="img" aria-label={`Prix au m² des ventes de l’immeuble : ${resume}.`}>
        {reperes.map((v) => (
          <g key={v}>
            <line x1={m.g} x2={largeur - m.d} y1={Y(v)} y2={Y(v)} stroke="var(--color-line)" />
            <text x={m.g - 8} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-muted)">{kEuros(v)}</text>
          </g>
        ))}
        {Array.from({ length: x1 - x0 }, (_, i) => x0 + i).map((a) => (
          <g key={a}>
            {a > x0 && <line x1={X(a)} x2={X(a)} y1={m.h} y2={H - m.b} stroke="var(--color-line)" strokeDasharray="2 4" />}
            <text x={X(a + 0.5)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-ink-muted)">{a}</text>
          </g>
        ))}
        {serieTriee.length > 1 && (
          <path d={ligne} fill="none" stroke="var(--color-ink-muted)" strokeWidth="1.75" strokeDasharray="5 4" strokeLinejoin="round" />
        )}
        {serieTriee.map((s) => (
          <circle key={s.annee} cx={X(s.annee + 0.5)} cy={Y(s.prix)} r="2.5" fill="var(--color-ink-muted)" />
        ))}
        {points.map((p, i) => (
          <circle
            key={`${p.date}-${i}`}
            cx={X(p.x)}
            cy={Y(p.prix_m2)}
            r="6"
            fill={p.vefa ? 'var(--color-surface)' : 'var(--color-accent)'}
            stroke={p.vefa ? 'var(--color-accent)' : 'var(--color-surface)'}
            strokeWidth="2"
          >
            <title>{`${moisAn.format(new Date(p.date))} · ${euroM2(p.prix_m2)}${p.vefa ? ' · neuf, sur plan' : ''}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true" />
          Ventes de l’immeuble (€/m² le jour de la vente)
        </span>
        {points.some((p) => p.vefa) && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-accent bg-surface" aria-hidden="true" />
            Neuf, sur plan
          </span>
        )}
        {serieTriee.length > 1 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-ink-muted" aria-hidden="true" />
            Médiane annuelle {nomSecteur ? `de ${nomSecteur}` : 'du secteur'}
          </span>
        )}
      </figcaption>
    </figure>
  )
}
