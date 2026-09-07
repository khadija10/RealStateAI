import { useEffect, useRef, useState } from 'react'
import { getMarketMap } from '../api/client'

const PRICE_SCALE = [
  { max: 3000, color: '#4ade80' },   // vert — moins de 3k €/m²
  { max: 5000, color: '#a3e635' },
  { max: 7000, color: '#facc15' },   // jaune
  { max: 9000, color: '#fb923c' },   // orange
  { max: 12000, color: '#f87171' },  // rouge clair
  { max: Infinity, color: '#dc2626' }, // rouge foncé — Paris centre
]

function priceColor(prix) {
  return (PRICE_SCALE.find((s) => prix <= s.max) ?? PRICE_SCALE.at(-1)).color
}

const DEP_NAMES = {
  '75': 'Paris',
  '77': 'Seine-et-Marne',
  '78': 'Yvelines',
  '91': 'Essonne',
  '92': 'Hauts-de-Seine',
  '93': 'Seine-Saint-Denis',
  '94': 'Val-de-Marne',
  '95': "Val-d'Oise",
}

export default function PriceMap() {
  const mapRef = useRef(null)
  const leafletRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeDep, setActiveDep] = useState('all')
  const [allData, setAllData] = useState([])
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    let map = null

    async function init() {
      // Charger Leaflet depuis le CDN
      if (!window.L) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
          s.onload = resolve
          s.onerror = reject
          document.head.appendChild(s)
        })
      }
      const L = window.L

      let data
      try {
        data = await getMarketMap()
        setAllData(data)
      } catch (e) {
        setError('Impossible de charger les données cartographiques.')
        setLoading(false)
        return
      }

      if (!mapRef.current) return

      map = L.map(mapRef.current, {
        center: [48.82, 2.35],
        zoom: 10,
        zoomControl: true,
      })
      leafletRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map)

      data.forEach((row) => {
        const color = priceColor(row.prix_m2_median)
        const radius = Math.sqrt(row.n_transactions) * 0.8 + 4

        const circle = L.circleMarker([row.lat, row.lon], {
          radius: Math.min(radius, 22),
          fillColor: color,
          color: '#ffffff',
          weight: 1,
          opacity: 0.9,
          fillOpacity: 0.75,
        })

        circle.bindPopup(`
          <div style="font-family: Inter, sans-serif; min-width: 160px">
            <p style="font-weight:600; margin:0 0 4px">${row.nom_commune}</p>
            <p style="margin:0; color:#6B6558; font-size:12px">Dept. ${row.code_departement} · ${row.n_transactions} ventes</p>
            <p style="margin:6px 0 0; font-size:15px; font-weight:700; color:#1F1F1F">
              ${new Intl.NumberFormat('fr-FR').format(row.prix_m2_median)} €/m²
            </p>
            <p style="margin:2px 0 0; font-size:11px; color:#8A8171">
              Fourchette : ${new Intl.NumberFormat('fr-FR').format(row.prix_m2_q1)} – ${new Intl.NumberFormat('fr-FR').format(row.prix_m2_q3)} €/m²
            </p>
          </div>
        `)

        circle.addTo(map)
      })

      setLoading(false)
    }

    init()

    return () => {
      if (leafletRef.current) {
        leafletRef.current.remove()
        leafletRef.current = null
      }
    }
  }, [])

  // Filtre par département : re-centre la carte
  useEffect(() => {
    const map = leafletRef.current
    if (!map || allData.length === 0) return
    if (activeDep === 'all') {
      map.setView([48.82, 2.35], 10)
    } else {
      const pts = allData.filter((r) => r.code_departement === activeDep)
      if (pts.length === 0) return
      const avgLat = pts.reduce((s, r) => s + r.lat, 0) / pts.length
      const avgLon = pts.reduce((s, r) => s + r.lon, 0) / pts.length
      map.setView([avgLat, avgLon], 12)
    }
  }, [activeDep, allData])

  return (
    <section className="mt-16">
      <div className="mb-6">
        <h2 className="font-[var(--font-display)] text-3xl text-ink">Carte des prix par commune</h2>
        <p className="text-sm text-ink-muted mt-1">Prix médian au m² — transactions 2022-2024, Île-de-France.</p>
      </div>

      {/* Filtre département */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setActiveDep('all')}
          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
            activeDep === 'all'
              ? 'bg-ink text-white border-ink'
              : 'border-stone-100 text-ink-muted hover:border-stone-600/40'
          }`}
        >
          Île-de-France
        </button>
        {Object.entries(DEP_NAMES).map(([code, name]) => (
          <button
            key={code}
            onClick={() => setActiveDep(activeDep === code ? 'all' : code)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              activeDep === code
                ? 'bg-ink text-white border-ink'
                : 'border-stone-100 text-ink-muted hover:border-stone-600/40'
            }`}
          >
            {code} · {name}
          </button>
        ))}
      </div>

      {/* Carte */}
      <div className="relative rounded-2xl overflow-hidden border border-stone-100 shadow-[var(--shadow-card)]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-stone-50/80">
            <div className="flex flex-col items-center gap-2">
              <div className="h-6 w-6 rounded-full border-2 border-stone-100 border-t-seine animate-spin" />
              <p className="text-sm text-ink-muted">Chargement de la carte…</p>
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-80 text-sm text-ink-muted">{error}</div>
        )}
        <div ref={mapRef} style={{ height: '480px', width: '100%' }} />
      </div>

      {/* Légende */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 items-center">
        <p className="text-xs text-ink-muted font-medium">Prix/m² :</p>
        {[
          { label: '< 3 000 €', color: '#4ade80' },
          { label: '3–5 000 €', color: '#a3e635' },
          { label: '5–7 000 €', color: '#facc15' },
          { label: '7–9 000 €', color: '#fb923c' },
          { label: '9–12 000 €', color: '#f87171' },
          { label: '> 12 000 €', color: '#dc2626' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full border border-white/80" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-ink-muted">{item.label}</span>
          </div>
        ))}
        <p className="text-xs text-ink-muted ml-auto">Cliquez sur un cercle pour les détails</p>
      </div>
    </section>
  )
}
