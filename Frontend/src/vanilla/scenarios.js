// Scénarios de prix du marché, communs à toutes les pages qui projettent un prix :
// Estimation (valeur dans 10 ans), Plus-value et Financement (acheter ou louer).
// Une seule définition, pour que les trois pages annoncent les mêmes chiffres.
//
// Trois scénarios, chacun avec sa source :
//   - baisse : la dernière correction se reproduit, à son rythme mesuré sur
//     l'indice Notaires-INSEE des prix de l'ancien du département et du type de
//     bien (du point haut de 2021-2022 au point bas suivant, calculé par le
//     backend : /api/market/indices, champ correction_recente) ;
//   - stabilité des prix, scénario central ;
//   - reprise au rythme de l'inflation visée par la Banque centrale européenne (2 %).
// La tendance observée du secteur depuis 2021 n'est pas un scénario : sur une
// commune à faible volume, elle dépend de quelques ventes. Elle est affichée à part.
export const CIBLE_INFLATION_BCE = 0.02

const TRIMESTRES = ['1er', '2e', '3e', '4e']
// « 2022-T3 » → « 3e trimestre 2022 »
export const trimestre = (t) => `${TRIMESTRES[+t.slice(-1) - 1]} trimestre ${t.slice(0, 4)}`
const pctAn = (x) => `${x > 0 ? '+' : '−'}${Math.abs(100 * x).toFixed(1).replace('.', ',')} %/an`

// [bas, central, haut], ou null tant que la correction de l'indice n'est pas connue
export function scenariosMarche(correction) {
  if (!correction || correction.taux == null) return null
  return [
    { cle: 'baisse', taux: correction.taux, court: `Baisse de ${pctAn(correction.taux).slice(1)}`,
      nom: `Retour de la dernière baisse (${pctAn(correction.taux)})`,
      source: `comme entre ${correction.de.slice(0, 4)} et ${correction.a.slice(0, 4)} (indice Notaires-INSEE)`,
      detail: `Rythme de la baisse de l'indice Notaires-INSEE du ${trimestre(correction.de)} au ${trimestre(correction.a)}` },
    { cle: 'stable', taux: 0, court: 'Prix stables', nom: 'Stabilité des prix' },
    { cle: 'reprise', taux: CIBLE_INFLATION_BCE, court: 'Reprise de 2 %/an', nom: "Reprise de 2 %/an (inflation visée par la BCE)",
      source: "cible d'inflation de la Banque centrale européenne" },
  ]
}

// Correction récente de l'indice du département et du type de bien, gardée en mémoire
const cache = new Map()
export function chargerCorrection(apiBase, dep, type) {
  const cle = `${dep}|${type === 'house' ? 'house' : 'apartment'}`
  if (!dep) return Promise.resolve(null)
  if (!cache.has(cle)) {
    const [d, t] = cle.split('|')
    cache.set(cle, fetch(`${apiBase}/api/market/indices?dep=${d}&property_type=${t}`, { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.correction_recente ? { ...j.correction_recente, type_reel: j.type_reel } : null))
      .catch(() => { cache.delete(cle); return null }))
  }
  return cache.get(cle)
}

// Rythme annuel observé du secteur entre la première et la dernière médiane.
//   eco    : médianes annuelles du prix au m² du secteur
//   annees : année de chaque médiane (une année sans vente est absente)
export function tendanceSecteur(eco, annees) {
  const n = eco.length - 1
  if (n < 1 || !eco[0]) return null
  return Math.pow(eco[n] / eco[0], 1 / (annees[n] - annees[0])) - 1
}
