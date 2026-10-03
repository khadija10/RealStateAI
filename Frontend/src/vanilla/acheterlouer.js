// Acheter ou louer : au bout de combien d'années l'achat devient-il plus
// avantageux que la location ? (le « point mort » qu'attend un professionnel)
//
// Comparaison de patrimoine, mois par mois, à budget égal :
//   - l'acheteur paie sa mensualité (crédit et assurance) et ses charges de
//     propriétaire ; son patrimoine est la valeur du bien, moins les frais de
//     revente et le capital restant dû ;
//   - le locataire paie son loyer et place son apport ;
//   - chaque mois, celui qui dépense le moins place la différence.
// Les hypothèses sont affichées à l'utilisateur à côté du résultat.
export const HYPOTHESES = {
  hausseLoyer: 0.02,        // revalorisation annuelle du loyer (ordre de grandeur de l'IRL)
  rendement: 0.025,         // rendement net annuel de l'épargne placée
  chargesProprio: 0.015,    // taxe foncière, entretien, copropriété non récupérable : % du prix par an
  fraisRevente: 0.05,       // frais à la revente (agence, diagnostics) : % de la valeur
}

function capitalRestant(montant, tauxMensuel, nbMois, moisEcoules) {
  if (moisEcoules >= nbMois) return 0
  if (tauxMensuel === 0) return montant * (1 - moisEcoules / nbMois)
  const q = Math.pow(1 + tauxMensuel, moisEcoules), n = Math.pow(1 + tauxMensuel, nbMois)
  return montant * (n - q) / (n - 1)
}

// Renvoie l'année du point mort (ou null au-delà de l'horizon) et l'écart de
// patrimoine (acheteur − locataire) en fin de chaque année.
export function pointMort({ prix, apport, montant, tauxAnnuel, dureeAns, mensualiteCredit, assuranceMensuelle, loyer },
                          evolutionPrix, h = HYPOTHESES, horizonAns = 30) {
  const nbMois = Math.round(dureeAns * 12), tm = tauxAnnuel / 12, rm = h.rendement / 12
  let epargneAcheteur = 0, epargneLocataire = apport, annee = null
  const ecarts = []
  for (let m = 1; m <= horizonAns * 12; m++) {
    const sortieAcheteur = (m <= nbMois ? mensualiteCredit + assuranceMensuelle : 0) + (prix * h.chargesProprio) / 12
    const sortieLocataire = loyer * Math.pow(1 + h.hausseLoyer, Math.floor((m - 1) / 12))
    epargneAcheteur = epargneAcheteur * (1 + rm) + Math.max(0, sortieLocataire - sortieAcheteur)
    epargneLocataire = epargneLocataire * (1 + rm) + Math.max(0, sortieAcheteur - sortieLocataire)
    if (m % 12 === 0) {
      const valeur = prix * Math.pow(1 + evolutionPrix, m / 12)
      const acheteur = valeur * (1 - h.fraisRevente) - capitalRestant(montant, tm, nbMois, m) + epargneAcheteur
      const ecart = acheteur - epargneLocataire
      ecarts.push(ecart)
      if (annee === null && ecart >= 0) annee = m / 12
    }
  }
  return { annee, ecarts }
}
