import { useEffect, useRef } from 'react'
import { saveHistorySimulation } from '../api/client'

/**
 * Rattache la simulation en cours à l'estimation enregistrée dans
 * l'historique (PUT /api/history/{id}/simulation), après un court délai pour
 * n'enregistrer que le dernier réglage. Sans `historiqueId`, rien n'est envoyé ;
 * un échec n'interrompt jamais la simulation.
 */
export function useSimulationHistorique(historiqueId, type, donnees) {
  const cle = donnees ? JSON.stringify(donnees) : null
  const derniere = useRef(null)
  useEffect(() => {
    if (!historiqueId || !cle || cle === derniere.current) return
    const t = setTimeout(() => {
      derniere.current = cle
      saveHistorySimulation(historiqueId, type, JSON.parse(cle)).catch(() => {})
    }, 1500)
    return () => clearTimeout(t)
  }, [historiqueId, type, cle])
}
