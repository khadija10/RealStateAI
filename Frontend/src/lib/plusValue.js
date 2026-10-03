// Projection du prix de revente à partir du marché observé.
// Les séries viennent de GET /api/market/trends (médianes mensuelles par
// département), résumées par année avec lib/tendance.js. Aucune série de
// prix n'est écrite dans le code.

/**
 * Trois trajectoires tirées de la série annuelle observée, triées de la plus
 * basse à la plus haute : tendance moyenne de la période, rythme de la
 * dernière année, stabilité des prix.
 * `serie` : [{ annee, prix }] trié par année (au moins deux années).
 */
export function scenarios(serie) {
  const premier = serie[0]
  const dernier = serie[serie.length - 1]
  const avant = serie[serie.length - 2]
  const nbAnnees = dernier.annee - premier.annee
  const tendance = nbAnnees > 0 ? (dernier.prix / premier.prix) ** (1 / nbAnnees) - 1 : 0
  return [
    { id: 'tendance', nom: `Tendance ${premier.annee}–${dernier.annee}`, taux: tendance },
    { id: 'derniere', nom: `Rythme de ${dernier.annee}`, taux: dernier.prix / avant.prix - 1 },
    { id: 'stable', nom: 'Stabilité des prix', taux: 0 },
  ].sort((a, b) => a.taux - b.taux)
}

/** Niveau de prix d'une année : observé si connu, projeté au taux du scénario au-delà. */
export function indice(serie, annee, taux) {
  const premier = serie[0]
  const dernier = serie[serie.length - 1]
  if (annee <= premier.annee) return premier.prix
  if (annee <= dernier.annee) return serie.find((s) => s.annee === annee)?.prix ?? dernier.prix
  return dernier.prix * (1 + taux) ** (annee - dernier.annee)
}

/** Prix de revente projeté d'un bien acheté `prix` l'année `achat`. */
export function prixRevente(serie, prix, achat, vente, taux) {
  return (prix * indice(serie, vente, taux)) / indice(serie, achat, taux)
}

export const NOMS_SCENARIOS = ['Scénario bas', 'Scénario central', 'Scénario haut']
