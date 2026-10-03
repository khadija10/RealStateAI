import { useMemo } from 'react'
import { getCommunes, getMarketMap, getMarketTrends } from '../api/client'
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

/** Statistiques par commune (GET /api/market/map) + index de recherche. */
export function useCommuneStats() {
  const res = useApi(() => cached('map', () => getMarketMap()), [])
  const index = useMemo(() => (Array.isArray(res.data) ? indexCommuneStats(res.data) : null), [res.data])
  return { ...res, rows: Array.isArray(res.data) ? res.data : [], index }
}

/** Série mensuelle du prix médian d'un département (GET /api/market/trends). */
export function useDepartmentTrend(dep) {
  const res = useApi(
    () => cached(`trends:${dep}`, () => getMarketTrends(dep)),
    [dep],
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
export function useAllTrends() {
  const res = useApi(() => cached('trends:all', () => getMarketTrends()), [])
  const parDep = useMemo(() => {
    const m = {}
    for (const r of Array.isArray(res.data) ? res.data : []) (m[r.code_departement] ??= []).push(r)
    for (const k of Object.keys(m)) m[k].sort((a, b) => a.mois_index - b.mois_index)
    return m
  }, [res.data])
  return { ...res, parDep }
}
