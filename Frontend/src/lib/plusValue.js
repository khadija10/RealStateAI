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

/**
 * Hausse annuelle des prix (au-delà des données observées) à partir de
 * laquelle la revente couvre prix d'achat, frais et impôt. `net(taux)` est
 * croissant avec le taux : une dichotomie suffit.
 * Renvoie Infinity si même +50 %/an ne suffit pas, -Infinity si tout taux convient.
 */
export function seuilRentabilite(net) {
  let bas = -0.5
  let haut = 0.5
  if (net(haut) < 0) return Infinity
  if (net(bas) >= 0) return -Infinity
  for (let i = 0; i < 60; i++) {
    const m = (bas + haut) / 2
    if (net(m) < 0) bas = m
    else haut = m
  }
  return haut
}

/**
 * Croissance annuelle des prix sur chaque période passée de `ans` années,
 * trimestre par trimestre, d'après un indice trimestriel du serveur
 * ({ debut: 'AAAA-Qn', valeurs: [...] }). Fréquence observée, pas une probabilité.
 */
export function periodesHistoriques(indiceInsee, ans) {
  const v = indiceInsee?.valeurs ?? []
  const [a0, t0] = String(indiceInsee?.debut ?? '').split('-Q').map(Number)
  if (!v.length || !a0 || !t0) return []
  const q = 4 * ans
  const out = []
  for (let i = 0; i + q < v.length; i++) {
    out.push({ debut: a0 + (t0 - 1 + i) / 4, taux: (v[i + q] / v[i]) ** (1 / ans) - 1 })
  }
  return out
}
