// Scénarios de prix du marché, communs à la page Estimation (résumé de la
// plus-value à 10 ans) et au simulateur de plus-value : les deux pages
// annoncent ainsi le même scénario central pour un même bien.
//   eco    : médianes annuelles du prix au m² du secteur
//   annees : année de chaque médiane (une année sans vente est absente)
export function scenariosMarche(eco, annees) {
  const n = eco.length - 1
  const tendance = Math.pow(eco[n] / eco[0], 1 / (annees[n] - annees[0])) - 1
  const derniere = Math.pow(eco[n] / eco[n - 1], 1 / (annees[n] - annees[n - 1])) - 1
  return [
    { nom: 'Tendance 2021-2025', taux: tendance },
    { nom: 'Rythme de la dernière année', taux: derniere },
    { nom: 'Stabilité des prix', taux: 0 },
  ].sort((a, b) => a.taux - b.taux)   // [bas, central, haut]
}
