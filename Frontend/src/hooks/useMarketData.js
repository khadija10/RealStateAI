import { useMemo } from 'react'
import { getCommunes, getMarketIndices, getMarketMap, getMarketSecteurs, getMarketTrends } from '../api/client'
import { normalizeSecteur } from '../api/normalize'
import { indexCommuneStats } from '../lib/geo'
import { useApi } from './useApi'

// Données de marché statiques côté serveur : chargées une seule fois par
// session et partagées entre les pages (cache de promesses par clé).
const cache = new Map()

function cached(key, loader) {
  if (!cache.has(key)) {
    const p = loader().catch((e) => {
      cache.delete(key) // une erreur ne reste pas en cache : « Réessayer » relance l'appel
      throw e
    })
    cache.set(key, p)
  }
  return cache.get(key)
}

/** Le serveur sépare le marché par type de bien : appartements ou maisons. */
const typeMarche = (t) => (t === 'house' ? 'house' : 'apartment')

/** Segment de marché : tout, ancien, neuf (VEFA). */
const segment = (m) => (['ancien', 'neuf'].includes(m) ? m : 'tous')

/** Statistiques par commune (GET /api/market/map) + index de recherche, pour un type de bien et un marché. */
export function useCommuneStats(typeBien, marche = 'tous') {
  const t = typeMarche(typeBien)
  const m = segment(marche)
  const res = useApi(() => cached(`map:${t}:${m}`, () => getMarketMap(t, m)), [t, m])
  const index = useMemo(() => (Array.isArray(res.data) ? indexCommuneStats(res.data) : null), [res.data])
  return { ...res, rows: Array.isArray(res.data) ? res.data : [], index }
}

/** Série mensuelle du prix médian d'un département (GET /api/market/trends), pour un type de bien. */
export function useDepartmentTrend(dep, typeBien) {
  const t = typeMarche(typeBien)
  const res = useApi(
    () => cached(`trends:${dep}:${t}`, () => getMarketTrends(dep, t)),
    [dep, t],
    { enabled: !!dep },
  )
  const rows = useMemo(
    () => (Array.isArray(res.data) ? [...res.data].sort((a, b) => a.mois_index - b.mois_index) : []),
    [res.data],
  )
  return { ...res, rows }
}

/**
 * Communes proposées à la saisie. Source principale : /api/metadata/communes
 * (communes du jeu DVF chargé). Si le serveur n'a pas chargé DVF, cette liste
 * est vide : on se rabat sur les communes de /api/market/map.
 */
export function useCommuneSuggestions() {
  const meta = useApi(() => cached('communes', () => getCommunes()), [])
  const stats = useCommuneStats()
  return useMemo(() => {
    const fromMeta = Array.isArray(meta.data) ? meta.data.filter(Boolean) : []
    if (fromMeta.length) return fromMeta
    return [...new Set(stats.rows.map((r) => r.nom_commune))].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [meta.data, stats.rows])
}

/**
 * Tendances mensuelles de tous les départements (GET /api/market/trends),
 * regroupées par code département et triées chronologiquement.
 */
export function useAllTrends(typeBien, marche = 'tous') {
  const t = typeMarche(typeBien)
  const m = segment(marche)
  const res = useApi(() => cached(`trends:all:${t}:${m}`, () => getMarketTrends(undefined, t, m)), [t, m])
  const parDep = useMemo(() => {
    const m = {}
    for (const r of Array.isArray(res.data) ? res.data : []) (m[r.code_departement] ??= []).push(r)
    for (const k of Object.keys(m)) m[k].sort((a, b) => a.mois_index - b.mois_index)
    return m
  }, [res.data])
  return { ...res, parDep }
}

/**
 * Secteurs (communes, arrondissements) d'un type de bien, classés par prix,
 * avec leur série annuelle et le loyer de référence (GET /api/market/secteurs).
 * `disponible: false` si le serveur ne les fournit pas (ancienne version, données absentes).
 */
export function useSecteurs(typeBien) {
  const t = typeMarche(typeBien)
  const res = useApi(() => cached(`secteurs:${t}`, () => getMarketSecteurs(t)), [t])
  const secteurs = useMemo(
    () => (Array.isArray(res.data) ? res.data.map(normalizeSecteur).filter((s) => s?.code && s.serie.length >= 2) : []),
    [res.data],
  )
  return { ...res, secteurs, disponible: secteurs.length > 0 }
}

/** Indice Notaires-INSEE trimestriel d'un département (GET /api/market/indices). */
export function useIndiceInsee(dep, typeBien) {
  const t = typeMarche(typeBien)
  return useApi(() => cached(`indices:${dep}:${t}`, () => getMarketIndices(dep, t)), [dep, t], { enabled: !!dep })
}
