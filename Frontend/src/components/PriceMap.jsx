import { useEffect, useRef, useState } from 'react'
import { getMarketMap } from '../api/client'

const DEPS = ['75', '77', '78', '91', '92', '93', '94', '95']

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

// Vues fixes par département — évite le zoom trop large sur 77/78
const DEP_VIEWS = {
  '75': { center: [48.858, 2.347], zoom: 12 },
  '77': { center: [48.620, 2.840], zoom: 10 },
  '78': { center: [48.770, 1.900], zoom: 10 },
  '91': { center: [48.530, 2.230], zoom: 10 },
  '92': { center: [48.870, 2.235], zoom: 12 },
  '93': { center: [48.916, 2.490], zoom: 12 },
  '94': { center: [48.790, 2.472], zoom: 12 },
  '95': { center: [49.050, 2.100], zoom: 11 },
}

const PRICE_SCALE = [
  { max: 3000, color: '#4ade80' },
  { max: 5000, color: '#a3e635' },
  { max: 7000, color: '#facc15' },
  { max: 9000, color: '#fb923c' },
  { max: 12000, color: '#f87171' },
  { max: Infinity, color: '#dc2626' },
]

function priceColor(prix) {
  return (PRICE_SCALE.find((s) => prix <= s.max) ?? PRICE_SCALE.at(-1)).color
}

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-'’\s]+/g, ' ')
    .trim()
}

const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n)

export default function PriceMap() {
  const mapRef = useRef(null)
  const leafletRef = useRef(null)
  const geoLayerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeDep, setActiveDep] = useState('all')
  const [hovered, setHovered] = useState(null)
  const [matchRate, setMatchRate] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
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

      const [priceData, ...geoResults] = await Promise.all([
        getMarketMap(),
        ...DEPS.map((dep) => {
          // Paris: l'API retourne 1 commune (75056); on demande les arrondissements séparément
          const type = dep === '75' ? '&type=arrondissement-municipal' : ''
          return fetch(
            `https://geo.api.gouv.fr/communes?codeDepartement=${dep}&fields=code,nom&format=geojson&geometry=contour${type}`
          )
            .then((r) => r.json())
            .catch(() => null)
        }),
      ])

      if (cancelled) return

      // Build price lookup by normalized name
      const priceByName = new Map()
      for (const row of priceData) {
        priceByName.set(normalize(row.nom_commune), row)
      }

      // Merge GeoJSON features with price data
      const features = []
      let total = 0
      let matched = 0
      for (const geo of geoResults) {
        if (!geo?.features) continue
        for (const feature of geo.features) {
          total++
          const key = normalize(feature.properties.nom)
          const price = priceByName.get(key)
          if (price) {
            matched++
            feature.properties = { ...feature.properties, ...price }
            features.push(feature)
          }
        }
      }
      setMatchRate(total > 0 ? Math.round((matched / total) * 100) : null)

      const geojson = { type: 'FeatureCollection', features }

      if (!mapRef.current || cancelled) return

      const map = L.map(mapRef.current, {
        center: [48.82, 2.35],
        zoom: 10,
        zoomControl: true,
      })
      leafletRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
        opacity: 0.35,
      }).addTo(map)

      function polyStyle(feature) {
        const prix = feature.properties.prix_m2_median
        return {
          fillColor: prix ? priceColor(prix) : '#d1d5db',
          weight: 0.8,
          opacity: 1,
          color: '#ffffff',
          fillOpacity: 0.78,
        }
      }

      const geoLayer = L.geoJSON(geojson, {
        style: polyStyle,
        onEachFeature: (feature, layer) => {
          const p = feature.properties
          layer.on({
            mouseover: () => {
              layer.setStyle({ weight: 2, color: '#111827', fillOpacity: 0.95 })
              layer.bringToFront()
              setHovered({
                nom: p.nom_commune,
                dep: p.code_departement,
                prix: p.prix_m2_median,
                q1: p.prix_m2_q1,
                q3: p.prix_m2_q3,
                n: p.n_transactions,
              })
            },
            mouseout: () => {
              geoLayer.resetStyle(layer)
              setHovered(null)
            },
            click: () => {
              map.fitBounds(layer.getBounds(), { padding: [60, 60], maxZoom: 14 })
            },
          })
        },
      }).addTo(map)

      geoLayerRef.current = geoLayer
      setLoading(false)
    }

    init().catch(() => {
      if (!cancelled) {
        setError('Impossible de charger les données cartographiques.')
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
      if (leafletRef.current) {
        leafletRef.current.remove()
        leafletRef.current = null
        geoLayerRef.current = null
      }
    }
  }, [])

  // Re-centre on department filter change
  useEffect(() => {
    const map = leafletRef.current
    if (!map) return

    if (activeDep === 'all') {
      map.setView([48.82, 2.35], 10)
      return
    }

    const view = DEP_VIEWS[activeDep]
    if (view) {
      map.setView(view.center, view.zoom, { animate: true })
    }
  }, [activeDep])

  return (
    <section>
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

      {/* Carte + tooltip dans un wrapper relatif sans overflow-hidden */}
      <div className="relative">
        {/* Tooltip hover — en dehors du overflow-hidden */}
        {hovered && (
          <div className="absolute top-3 left-3 z-[400] bg-white rounded-xl shadow-lg border border-stone-100 px-4 py-3 w-56 pointer-events-none" style={{ zIndex: 1000 }}>
            <p className="text-sm font-semibold text-ink leading-tight">{hovered.nom}</p>
            <p className="text-[11px] text-ink-muted mt-0.5">
              Dept. {hovered.dep}{hovered.n != null ? ` · ${hovered.n.toLocaleString('fr-FR')} ventes` : ''}
            </p>
            <p className="text-2xl font-bold text-ink tabular-nums mt-2 leading-none">
              {fmt(hovered.prix)} €/m²
            </p>
            {hovered.q1 && hovered.q3 && (
              <p className="text-[11px] text-ink-muted mt-1.5">
                Q1–Q3 : {fmt(hovered.q1)} – {fmt(hovered.q3)} €/m²
              </p>
            )}
          </div>
        )}

        <div className="relative rounded-2xl overflow-hidden border border-stone-100 shadow-[var(--shadow-card)]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-stone-50/80" style={{ zIndex: 999 }}>
              <div className="flex flex-col items-center gap-2">
                <div className="h-6 w-6 rounded-full border-2 border-stone-100 border-t-seine animate-spin" />
                <p className="text-sm text-ink-muted">Chargement des polygones…</p>
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-80 text-sm text-ink-muted">{error}</div>
          )}
          <div ref={mapRef} style={{ height: '520px', width: '100%' }} />
        </div>
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
            <div className="h-3 w-3 rounded border border-white/80" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-ink-muted">{item.label}</span>
          </div>
        ))}
        {matchRate != null && (
          <p className="text-xs text-ink-muted ml-auto">
            {matchRate} % des communes avec données · cliquer pour zoomer
          </p>
        )}
      </div>
    </section>
  )
}
