// Montants saisissables : chaque slider de montant reçoit un champ éditable
// (on tape « 220 000 » au lieu de chercher la valeur au slider) et ses bornes.
// Le champ et le slider restent synchronisés ; une saisie hors bornes est ramenée
// dans l'intervalle, au pas du slider.
const fmt = (x) => Number(x).toLocaleString('fr-FR') + ' €'

export function champsMontants(root, paires) {
  for (const [idCurseur, idSortie] of paires) {
    const curseur = root.querySelector('#' + idCurseur)
    const sortie = root.querySelector('#' + idSortie)
    if (!curseur || !sortie) continue
    const champ = document.createElement('input')
    champ.id = idSortie
    champ.className = 'montant'
    champ.type = 'text'
    champ.inputMode = 'numeric'
    champ.autocomplete = 'off'
    champ.setAttribute('aria-label', root.querySelector(`label[for="${idCurseur}"]`)?.textContent || 'Montant')
    sortie.replaceWith(champ)

    const bornes = document.createElement('div')
    bornes.className = 'bornes-reglage'
    bornes.innerHTML = `<span>${fmt(curseur.min)}</span><span>${fmt(curseur.max)}</span>`
    curseur.after(bornes)

    const valider = () => {
      const brut = Number(champ.value.replace(/[^\d]/g, ''))
      if (!champ.value.trim() || Number.isNaN(brut)) { champ.value = fmt(curseur.value); return }
      const pas = Number(curseur.step) || 1
      const v = Math.min(Number(curseur.max), Math.max(Number(curseur.min), Math.round(brut / pas) * pas))
      curseur.value = v
      champ.value = fmt(v)
      curseur.dispatchEvent(new Event('input', { bubbles: true }))
    }
    champ.addEventListener('change', valider)
    champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); champ.blur() } })
    champ.addEventListener('focus', () => champ.select())
  }
}

// Affiche une valeur dans une sortie (champ ou texte), sans écraser une saisie en cours.
export function afficherMontant(el, texte) {
  if (!el) return
  if (el.tagName === 'INPUT') { if (document.activeElement !== el) el.value = texte }
  else el.textContent = texte
}
