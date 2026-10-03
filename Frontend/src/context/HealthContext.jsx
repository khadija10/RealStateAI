import { createContext, useContext, useMemo } from 'react'
import { getHealth } from '../api/client'
import { normalizeHealth } from '../api/normalize'
import { useApi } from '../hooks/useApi'

const HealthContext = createContext(null)

/**
 * État du backend, interrogé UNE fois pour toute l'application
 * (GET /api/health) et partagé : statut, métriques du modèle, couverture
 * DVF et DPE.
 *
 * status : 'loading' | 'online' | 'offline'
 */
export function HealthProvider({ children }) {
  const { data, error, loading, reload } = useApi((signal) => getHealth({ signal }), [])

  const value = useMemo(() => {
    const health = normalizeHealth(data)
    return {
      status: loading && !health ? 'loading' : health ? 'online' : error ? 'offline' : 'loading',
      health,
      error,
      refresh: reload,
    }
  }, [data, error, loading, reload])

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>
}

export function useHealth() {
  const ctx = useContext(HealthContext)
  if (!ctx) throw new Error('useHealth doit être utilisé dans <HealthProvider>')
  return ctx
}
