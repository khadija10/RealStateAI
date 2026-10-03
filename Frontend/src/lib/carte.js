// Carte des prix : constantes de présentation et chargements externes
// (bibliothèque Leaflet, contours des communes). Aucune donnée métier ici :
// les prix viennent de GET /api/market/map.

import { normalizeName } from './geo'

/**
 * Classes de couleur du prix médian au m² (affichage seulement). Une seule
 * teinte, du sable au brun : lisible par les daltoniens, et sans jugement
 * vert / rouge (un prix élevé n'est pas « mauvais »). Paliers espacés
 * régulièrement en luminosité (reprise de la v1.5.1 des collègues).
 */
export const PALIERS_PRIX = [
  { max: 3000, couleur: '#F8EBD3', libelle: '< 3 000 €' },
  { max: 5000, couleur: '#E2B676', libelle: '3 – 5 000 €' },
  { max: 7000, couleur: '#C1843D', libelle: '5 – 7 000 €' },
  { max: 9000, couleur: '#935A22', libelle: '7 – 9 000 €' },
  { max: 12000, couleur: '#633612', libelle: '9 – 12 000 €' },
  { max: Infinity, couleur: '#341A06', libelle: '> 12 000 €' },
]

export const couleurPrix = (prix) => (PALIERS_PRIX.find((p) => prix <= p.max) ?? PALIERS_PRIX.at(-1)).couleur

/** Hachures des communes sans prix fiable (moins de 5 ventes du type choisi). */
export const MOTIF_SANS_DONNEES = 'rsai-sans-donnees'
export const APERCU_HACHURES = 'repeating-linear-gradient(45deg,#9a948c 0 1.5px,#fff 1.5px 5px)'

/** Vue d'ensemble et vues par département (évite un zoom trop large sur 77/78). */
export const VUE_IDF = { centre: [48.75, 2.45], zoom: 9 }
export const VUES_DEPARTEMENTS = {
  75: { centre: [48.858, 2.347], zoom: 12 },
  77: { centre: [48.62, 2.84], zoom: 10 },
  78: { centre: [48.77, 1.9], zoom: 10 },
  91: { centre: [48.53, 2.23], zoom: 10 },
  92: { centre: [48.87, 2.235], zoom: 12 },
  93: { centre: [48.916, 2.49], zoom: 12 },
  94: { centre: [48.79, 2.472], zoom: 12 },
  95: { centre: [49.05, 2.1], zoom: 11 },
}

const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
let leaflet = null

/** Charge Leaflet une seule fois (sa feuille de style est dans index.html). */
export function chargerLeaflet() {
  if (window.L) return Promise.resolve(window.L)
  leaflet ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = LEAFLET_JS
    s.onload = () => resolve(window.L)
    s.onerror = () => {
      leaflet = null
      reject(new Error('La bibliothèque de carte n’a pas pu être chargée.'))
    }
    document.head.appendChild(s)
  })
  return leaflet
}

const DEPARTEMENTS_IDF = ['75', '77', '78', '91', '92', '93', '94', '95']
let contours = null

/**
 * Contours des communes d'Île-de-France (geo.api.gouv.fr), téléchargés une
 * fois par session. Paris : arrondissements municipaux. Un département qui ne
 * répond pas fait échouer l'ensemble (pas de carte à trous silencieux).
 */
export function chargerContours() {
  contours ??= Promise.all(
    DEPARTEMENTS_IDF.map((dep) =>
      fetch(
        `https://geo.api.gouv.fr/communes?codeDepartement=${dep}&fields=code,nom&format=geojson&geometry=contour${dep === '75' ? '&type=arrondissement-municipal' : ''}`,
      ).then((r) => {
        if (!r.ok) throw new Error(`geo.api.gouv.fr : ${r.status}`)
        return r.json()
      }),
    ),
  )
    .then((collections) => collections.flatMap((c) => c.features ?? []))
    .catch((e) => {
      contours = null // « Réessayer » relance le téléchargement
      throw e
    })
  return contours
}

/**
 * Associe chaque contour à ses statistiques (/api/market/map ne renvoie pas de
 * code INSEE : rapprochement par département + nom normalisé).
 */
export function fusionnerContours(features, index) {
  return features.map((f) => {
    const code = f.properties.code
    const dep = code.slice(0, 2)
    const n = normalizeName(f.properties.nom)
    const stats = index?.byDepName.get(`${dep}|${n}`) ?? null
    return { ...f, properties: { code, nom: f.properties.nom, dep, stats } }
  })
}
