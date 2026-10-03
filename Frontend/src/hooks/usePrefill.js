import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { bienDepuisSession } from '../lib/estimationSession'

/**
 * Bien à pré-remplir dans un simulateur :
 * 1. celui transmis par le bouton « Simuler… » de la page Estimation ;
 * 2. à défaut, la dernière estimation de la session (menu, rechargement).
 * `demo: true` : estimation de démonstration, reprise seulement à la demande.
 * Renvoie null si aucune estimation n'a été faite.
 */
export function usePrefill() {
  const { state } = useLocation()
  return useMemo(() => {
    const nav = state?.prefill
    if (nav?.prix != null) return nav
    return bienDepuisSession()
  }, [state])
}
