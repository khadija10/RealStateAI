// Scénarios de prix du marché, communs à la page Estimation (résumé de la
// plus-value à 10 ans) et au simulateur de plus-value : les deux pages
// annoncent ainsi le même scénario central pour un même bien.
//   eco    : médianes annuelles du prix au m² du secteur
//   annees : année de chaque médiane (une année sans vente est absente)
//
// Trois rythmes tirés du marché observé : la tendance 2021-2025, le rythme de
// la dernière année, et une reprise au rythme de la meilleure année observée.
// Si aucune année n'a été en hausse, le scénario haut est la stabilité des
// prix : on ne projette pas une hausse que le secteur n'a jamais connue.
// Rythme annuel projeté limité à ±4 % : une médiane annuelle peut sauter quand
// peu de ventes la composent (programme neuf, ventes atypiques), et prolonger un
// tel saut sur 10 ans donnerait des valeurs absurdes (Bobigny : 7 453 €/m² en 2021,
// 4 141 € en 2022). Le scénario plafonné le dit dans son nom.
export const RYTHME_MAX = 0.04

export function scenariosMarche(eco, annees) {
  const n = eco.length - 1
  const rythme = (i, j) => Math.pow(eco[j] / eco[i], 1 / (annees[j] - annees[i])) - 1
  const tendance = rythme(0, n)
  const derniere = rythme(n - 1, n)
  const annuels = eco.slice(1).map((_, k) => rythme(k, k + 1))
  const meilleure = Math.max(...annuels)
  const anneeMeilleure = annees[annuels.indexOf(meilleure) + 1]

  const liste = [
    { nom: `Tendance ${annees[0]}-${annees[n]}`, taux: tendance },
    { nom: 'Rythme de la dernière année', taux: derniere },
  ]
  if (meilleure > 0 && Math.abs(meilleure - derniere) > 1e-9) {
    liste.push({ nom: `Reprise au rythme de ${anneeMeilleure}`, taux: meilleure })
  } else {
    liste.push({ nom: 'Stabilité des prix', taux: 0 })
  }
  return liste.map((s) => Math.abs(s.taux) > RYTHME_MAX
    ? { nom: `${s.nom} (limité à ${s.taux > 0 ? '+' : '−'}4 %/an)`, taux: Math.sign(s.taux) * RYTHME_MAX, brut: s.taux }
    : s).sort((a, b) => a.taux - b.taux)   // [bas, central, haut]
}
