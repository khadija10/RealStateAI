// Étiquette de précision d'une estimation, commune à la page Estimation et à
// l'historique : la même estimation porte la même étiquette partout.
//
// Précision de CETTE estimation : la demi-largeur de sa fourchette à 85 %, qui
// dépend du bien (modèles quantiles) et pas seulement de la commune. Elle est
// située parmi les fourchettes que l'application a produites sur les ventes de
// la période de validation : tiers le plus étroit, tiers du milieu, tiers le
// plus large. Les deux seuils sont mesurés (ml/exporter_largeurs.py, servi par
// /api/health dans model_largeurs) : aucun n'est écrit ici.
//   r        : { valeur, basse, haute }
//   largeurs : model_largeurs.demi_largeur_pct = { tiers_1, mediane, tiers_2 }
const NIVEAUX = [
  { titre: 'Marge réduite', texte: 'parmi le tiers le plus étroit de nos estimations : à confirmer par une visite.', ton: 'vert' },
  { titre: 'Marge normale', texte: 'dans la moyenne de nos estimations : un point de départ, à confirmer par une visite.', ton: 'ambre' },
  { titre: 'Marge large', texte: "parmi le tiers le plus large de nos estimations : fiez-vous d'abord aux ventes voisines et à l'avis d'un professionnel.", ton: 'rouge' },
]

export const demiLargeur = (r) => (r.valeur > 0 ? (100 * (r.haute - r.basse)) / 2 / r.valeur : null)

export function precisionDe(r, largeurs) {
  const demi = demiLargeur(r)
  if (demi == null) return null
  if (!largeurs?.tiers_1 || !largeurs?.tiers_2) return { demi }   // seuils non mesurés : pas d'étiquette
  const niveau = demi <= largeurs.tiers_1 ? NIVEAUX[0] : demi <= largeurs.tiers_2 ? NIVEAUX[1] : NIVEAUX[2]
  return { demi, ...niveau }
}
