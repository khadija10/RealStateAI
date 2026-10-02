// Rattache la dernière simulation (plus-value ou financement) au bien estimé,
// dans l'historique du compte. Les pages recalculent à chaque réglage de curseur :
// l'envoi attend une pause de 1,5 s pour ne garder que le réglage final.
export function enregistreurSimulation(apiBase, historiqueId, type) {
  let minuterie = null
  return {
    planifier(donnees) {
      if (!historiqueId) return
      clearTimeout(minuterie)
      minuterie = setTimeout(() => {
        let jeton = null
        try { jeton = localStorage.getItem('reai_token') } catch { /* ignore */ }
        fetch(`${apiBase}/api/history/${historiqueId}/simulation`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
          body: JSON.stringify({ type, donnees }),
        }).catch(() => { /* l'historique ne doit pas gêner la simulation */ })
      }, 1500)
    },
    annuler() { clearTimeout(minuterie) },
  }
}
