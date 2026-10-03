import { useEffect, useRef, useState } from 'react'
import { chargerLeaflet, couleurPrix, MOTIF_SANS_DONNEES, VUE_IDF, VUES_DEPARTEMENTS } from '../../lib/carte'
import { euroM2, nb } from '../../lib/format'
import { ErrorState } from '../ui'

// Couleurs fixes : Leaflet les écrit en attributs SVG, qui ignorent les variables CSS.
const CONTOUR_CHOISI = '#C2893A' // ambre, visible en clair comme en sombre
const CONTOUR_SURVOL = '#54402F'

/** Style d'une commune : couleur du prix (hachures sans prix), contour si choisie. */
function styleCommune(f, selection) {
  const prix = f.properties.stats?.prix_m2_median
  const choisi = f.properties.code === selection
  return {
    fillColor: prix ? couleurPrix(prix) : `url(#${MOTIF_SANS_DONNEES})`,
    fillOpacity: prix ? 0.8 : 0.9,
    color: choisi ? CONTOUR_CHOISI : '#ffffff',
    weight: choisi ? 3 : 0.8,
    opacity: 1,
  }
}

const echapper = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/** Info-bulle de survol : nom, prix médian, ventes (ou absence de prix fiable). */
function infoBulle({ nom, stats }) {
  if (!stats) return `<b>${echapper(nom)}</b><br><span class="rsai-carte-muet">Moins de 5 ventes : pas de prix médian fiable</span>`
  return `<b>${echapper(nom)}</b><br><span class="rsai-carte-prix">${euroM2(stats.prix_m2_median)}</span>
    <span class="rsai-carte-muet">· ${nb(stats.n_transactions)} ventes</span>`
}

/**
 * Carte des prix par commune (Leaflet, fond OpenStreetMap atténué).
 * - `features` : contours enrichis de leurs statistiques (lib/carte.fusionnerContours) ;
 * - `selection` : code INSEE de la commune choisie ; `onSelect(code)` au clic ;
 * - `departement` : vue à cadrer ('all' = toute l'Île-de-France).
 */
export default function CarteCommunes({ features, selection, onSelect, departement, className }) {
  const conteneur = useRef(null)
  const carte = useRef(null)
  const calque = useRef(null)
  const couches = useRef(new Map())
  const onSelectRef = useRef(onSelect)
  const selectionRef = useRef(selection)
  const [erreur, setErreur] = useState(null)
  const [prete, setPrete] = useState(false)
  const [essai, setEssai] = useState(0)
  useEffect(() => { onSelectRef.current = onSelect })

  // Création de la carte (une fois)
  useEffect(() => {
    let annule = false
    chargerLeaflet()
      .then((L) => {
        if (annule || !conteneur.current || carte.current) return
        const map = L.map(conteneur.current, { center: VUE_IDF.centre, zoom: VUE_IDF.zoom, zoomControl: true, attributionControl: true })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© contributeurs OpenStreetMap',
          maxZoom: 18,
          opacity: 0.35,
        }).addTo(map)
        carte.current = map
        setPrete(true)
      })
      .catch((e) => !annule && setErreur(e))
    return () => {
      annule = true
      carte.current?.remove()
      carte.current = null
      calque.current = null
      couches.current = new Map()
      setPrete(false)
    }
  }, [essai])

  // Contours colorés : recréés quand les données changent (type de bien, marché)
  useEffect(() => {
    const L = window.L
    const map = carte.current
    if (!prete || !L || !map) return
    calque.current?.remove()
    couches.current = new Map()
    const style = (f) => styleCommune(f, selectionRef.current)
    const calqueGeo = L.geoJSON({ type: 'FeatureCollection', features }, {
      style,
      onEachFeature: (f, layer) => {
        couches.current.set(f.properties.code, layer)
        layer.bindTooltip(infoBulle(f.properties), { sticky: true, direction: 'top', className: 'rsai-carte-bulle', offset: [0, -8] })
        layer.on({
          mouseover: () => {
            if (f.properties.code !== selectionRef.current) layer.setStyle({ weight: 2, color: CONTOUR_SURVOL })
            layer.bringToFront()
          },
          mouseout: () => calqueGeo.resetStyle(layer),
          click: () => onSelectRef.current?.(f.properties.code),
        })
      },
    }).addTo(map)
    calque.current = calqueGeo

    // Motif de hachures dans le SVG de Leaflet (fillColor = url(#…)) ; couleurs du
    // thème via « style », qui accepte les variables CSS
    const svg = map.getPanes().overlayPane.querySelector('svg')
    if (svg && !svg.querySelector(`#${MOTIF_SANS_DONNEES}`)) {
      const ns = 'http://www.w3.org/2000/svg'
      const defs = document.createElementNS(ns, 'defs')
      defs.innerHTML = `<pattern id="${MOTIF_SANS_DONNEES}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" style="fill: var(--color-surface)"/><line x1="0" y1="0" x2="0" y2="6" stroke-width="1.5" style="stroke: var(--color-ink-muted)"/></pattern>`
      svg.prepend(defs)
    }
  }, [features, prete])

  // Mise en évidence de la commune choisie
  useEffect(() => {
    selectionRef.current = selection
    calque.current?.setStyle((f) => styleCommune(f, selection))
    couches.current.get(selection)?.bringToFront()
  }, [selection, features])

  // Cadrage sur le département choisi
  useEffect(() => {
    const map = carte.current
    if (!prete || !map) return
    const vue = VUES_DEPARTEMENTS[departement] ?? VUE_IDF
    map.setView(vue.centre, vue.zoom, { animate: true })
  }, [departement, prete])

  if (erreur) {
    return (
      <div className={className}>
        <ErrorState title="Carte indisponible" error={erreur} onRetry={() => { setErreur(null); setEssai((n) => n + 1) }} />
      </div>
    )
  }
  return <div ref={conteneur} className={className} role="region" aria-label="Carte des prix médians au m² par commune" />
}
