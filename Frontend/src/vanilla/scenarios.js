// Scénarios de prix du marché, communs à la page Estimation (valeur dans 10 ans)
// et au simulateur de plus-value : les deux pages annoncent les mêmes chiffres.
//   eco    : médianes annuelles du prix au m² du secteur
//   annees : année de chaque médiane (une année sans vente est absente)
//
// Trois scénarios, comme les présenterait un conseiller :
//   - la tendance observée du secteur depuis 2021, prolongée (en Île-de-France,
//     surtout la correction liée à la remontée des taux en 2022-2024) ;
//   - la stabilité des prix ;
//   - une reprise modérée au rythme de l'inflation visée par la BCE (2 % par an).
// Une phase de correction n'est pas prolongée comme une tendance de fond : elle
// sert de borne, et la stabilité est le scénario central quand le secteur a baissé.
export const RYTHME_MAX = 0.04
export const REPRISE_MODEREE = 0.02

export function scenariosMarche(eco, annees) {
  const n = eco.length - 1
  const brut = Math.pow(eco[n] / eco[0], 1 / (annees[n] - annees[0])) - 1
  // Garde-fou : une médiane annuelle peut sauter quand peu de ventes la composent.
  // (Le cas de Bobigny, 7 453 €/m² en 2021, venait des ventes sur plan : les secteurs
  // sont désormais calculés sur l'ancien seul.) Le rythme projeté reste limité à ±4 %/an.
  const tendance = Math.max(-RYTHME_MAX, Math.min(RYTHME_MAX, brut))
  const limite = Math.abs(brut) > RYTHME_MAX
  return [
    { nom: `Tendance ${annees[0]}-${annees[n]} prolongée${limite ? ` (limitée à ${brut > 0 ? '+' : '−'}4 %/an)` : ''}`, taux: tendance },
    { nom: 'Stabilité des prix', taux: 0 },
    { nom: "Reprise modérée (rythme de l'inflation)", taux: REPRISE_MODEREE },
  ].sort((a, b) => a.taux - b.taux)   // [bas, central, haut]
}
