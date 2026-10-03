// ═══════════════════════════════════════════════════════════════════════════
// Acheter ou louer : au bout de combien d'années l'achat devient-il plus
// avantageux que la location, à budget égal ? (le « point mort »)
// ───────────────────────────────────────────────────────────────────────────
// Les montants du crédit (capital, taux, mensualités, assurance) viennent du
// moteur de financement du serveur. Les hypothèses de marché ci-dessous ne
// sont exposées par aucune API : elles sont regroupées ici et affichées à
// l'utilisateur à côté du résultat.
//
// Comparaison de patrimoine, mois par mois :
//   - l'acheteur paie sa mensualité (crédit et assurance) et ses charges de
//     propriétaire ; son patrimoine est la valeur du bien, moins les frais de
//     revente et le capital restant dû ;
//   - le locataire paie son loyer et place son apport ;
//   - chaque mois, celui qui dépense le moins place la différence.
// ═══════════════════════════════════════════════════════════════════════════

export const HYPOTHESES_ACHAT_LOCATION = {
  /** Revalorisation annuelle du loyer (ordre de grandeur de l'indice de référence des loyers). */
  hausseLoyer: 0.02,
  /** Rendement net annuel de l'épargne placée. */
  rendement: 0.025,
  /** Taxe foncière, entretien, copropriété non récupérable : part du prix par an. */
  chargesProprio: 0.015,
  /** Frais à la revente (agence, diagnostics) : part de la valeur. */
  fraisRevente: 0.05,
  /** Horizon de comparaison, en années. */
  horizonAns: 30,
}

/** Évolutions de prix comparées : baisse, stabilité, reprise. */
export const CAS_PRIX = [
  { evolution: -0.02, nom: 'Prix en baisse de 2 %/an' },
  { evolution: 0, nom: 'Prix stables' },
  { evolution: 0.02, nom: 'Reprise de 2 %/an' },
]

function capitalRestant(montant, tauxMensuel, nbMois, moisEcoules) {
  if (moisEcoules >= nbMois) return 0
  if (tauxMensuel === 0) return montant * (1 - moisEcoules / nbMois)
  const q = (1 + tauxMensuel) ** moisEcoules
  const n = (1 + tauxMensuel) ** nbMois
  return (montant * (n - q)) / (n - 1)
}

/**
 * Année du point mort (null au-delà de l'horizon) et écart de patrimoine
 * (acheteur − locataire) en fin de chaque année.
 */
export function pointMort(
  { prix, apport, montant, tauxAnnuel, dureeAns, mensualiteCredit, assuranceMensuelle, loyer },
  evolutionPrix,
  h = HYPOTHESES_ACHAT_LOCATION,
) {
  const nbMois = Math.round(dureeAns * 12)
  const tm = tauxAnnuel / 12
  const rm = h.rendement / 12
  let epargneAcheteur = 0
  let epargneLocataire = apport
  let annee = null
  const ecarts = []
  for (let m = 1; m <= h.horizonAns * 12; m++) {
    const sortieAcheteur = (m <= nbMois ? mensualiteCredit + assuranceMensuelle : 0) + (prix * h.chargesProprio) / 12
    const sortieLocataire = loyer * (1 + h.hausseLoyer) ** Math.floor((m - 1) / 12)
    epargneAcheteur = epargneAcheteur * (1 + rm) + Math.max(0, sortieLocataire - sortieAcheteur)
    epargneLocataire = epargneLocataire * (1 + rm) + Math.max(0, sortieAcheteur - sortieLocataire)
    if (m % 12 === 0) {
      const valeur = prix * (1 + evolutionPrix) ** (m / 12)
      const acheteur = valeur * (1 - h.fraisRevente) - capitalRestant(montant, tm, nbMois, m) + epargneAcheteur
      const ecart = acheteur - epargneLocataire
      ecarts.push(ecart)
      if (annee === null && ecart >= 0) annee = m / 12
    }
  }
  return { annee, ecarts }
}
