// Synthèses calculées à partir de GET /api/market/trends (médianes mensuelles
// du prix au m² par département). Partagées par la page et le rapport PDF.

export const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/**
 * Prix par année : moyenne des médianes mensuelles, pondérée par le nombre
 * de ventes de chaque mois (l'API ne fournit pas de médiane annuelle).
 * `rows` doit être trié chronologiquement.
 */
export function syntheseAnnuelle(rows) {
  const parAnnee = new Map()
  for (const r of rows) {
    const a = parAnnee.get(r.annee) ?? { annee: r.annee, somme: 0, ventes: 0, mois: [] }
    const poids = r.n_transactions || 1
    a.somme += r.prix_m2_median * poids
    a.ventes += r.n_transactions || 0
    a.poids = (a.poids ?? 0) + poids
    a.mois.push(r.mois)
    parAnnee.set(r.annee, a)
  }
  const annees = [...parAnnee.values()].map((a) => ({
    annee: a.annee,
    prix: a.somme / a.poids,
    ventes: a.ventes,
    nbMois: a.mois.length,
    partielle: a.mois.length < 12 ? `${MOIS_COURTS[Math.min(...a.mois) - 1]}–${MOIS_COURTS[Math.max(...a.mois) - 1]}` : null,
  }))
  return annees.map((a, k) => ({ ...a, variation: k > 0 ? a.prix / annees[k - 1].prix - 1 : null }))
}

/** Variation sur 12 mois du dernier mois disponible (null si historique trop court). */
export function variationDouzeMois(rows) {
  if (rows.length <= 12) return null
  const last = rows[rows.length - 1]
  const prev = rows[rows.length - 13]
  return last.prix_m2_median / prev.prix_m2_median - 1
}
