// Présentation des données de marché (GET /api/market/map, /trends, /indices) :
// filtres, couleurs des départements, lissage. Aucun chiffre métier ici.

export const TYPES_BIEN = [
  { value: 'apartment', label: 'Appartements' },
  { value: 'house', label: 'Maisons' },
]

export const MARCHES = [
  { value: 'tous', label: 'Tout le marché' },
  { value: 'ancien', label: 'Ancien' },
  { value: 'neuf', label: 'Neuf (sur plan)' },
]

/**
 * Les filtres type / marché ne sont appliqués par le serveur que s'il a chargé
 * les ventes DVF ; sinon il renvoie des fichiers agrégés qui les ignorent.
 * On ne les propose donc que dans ce cas (pas de faux filtre).
 */
export const filtresDisponibles = (health) => health?.dvf?.loaded === true

/**
 * Couleur de chaque département sur les graphiques : teintes distinctes, de
 * luminosité moyenne, lisibles sur fond clair comme sur fond sombre.
 */
export const COULEURS_DEPARTEMENTS = {
  75: '#B5533F', // terre cuite
  92: '#C2893A', // ambre
  93: '#3E7A5B', // vert forêt
  94: '#4F6D8F', // bleu ardoise
  77: '#8C7A5B', // taupe olive
  78: '#A35C7A', // prune
  91: '#4E8C89', // bleu-vert
  95: '#7A6A58', // brun gris
}

/** Libellés courts des départements (pastilles de sélection). */
export const DEPARTEMENTS_COURTS = {
  75: 'Paris',
  77: 'Seine-et-Marne',
  78: 'Yvelines',
  91: 'Essonne',
  92: 'Hauts-de-Seine',
  93: 'Seine-St-Denis',
  94: 'Val-de-Marne',
  95: "Val-d'Oise",
}

/**
 * Moyenne glissante sur 3 mois de la médiane mensuelle : la médiane d'un seul
 * mois dépend de ce qui s'est vendu ce mois-là. `rows` triées par mois.
 */
export function lisser(rows) {
  return rows.slice(2).map((r, i) => ({
    ...r,
    prix_m2_median: (rows[i].prix_m2_median + rows[i + 1].prix_m2_median + r.prix_m2_median) / 3,
  }))
}

/** Trimestre de l'indice INSEE : « 1992-Q1 » + k → « 1992-T1 ». */
export function trimestres(debut, n) {
  const a0 = Number(debut.slice(0, 4))
  const t0 = Number(debut.slice(-1)) - 1
  return Array.from({ length: n }, (_, k) => `${a0 + Math.floor((t0 + k) / 4)}-T${((t0 + k) % 4) + 1}`)
}
