// Référentiel géographique de présentation (constantes UI, pas des données
// métier) et rapprochement des communes entre les différentes réponses API.

/** Départements couverts — libellés d'affichage. */
export const DEPARTEMENTS = {
  75: 'Paris',
  77: 'Seine-et-Marne',
  78: 'Yvelines',
  91: 'Essonne',
  92: 'Hauts-de-Seine',
  93: 'Seine-Saint-Denis',
  94: 'Val-de-Marne',
  95: "Val-d'Oise",
}

export const nomDepartement = (code) => (code && DEPARTEMENTS[code]) || (code ? `Département ${code}` : null)

/** Forme canonique d'un nom de commune, pour comparer des libellés. */
export function normalizeName(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-'’\s]+/g, ' ')
    .trim()
}

/** « 75115 » → « Paris 15e Arrondissement » (libellé de /api/market/map). */
export function nomArrondissementParis(codeCommune) {
  if (!/^751(0[1-9]|1\d|20)$/.test(codeCommune ?? '')) return null
  const n = Number(codeCommune.slice(3))
  return `Paris ${n === 1 ? '1er' : `${n}e`} Arrondissement`
}

/**
 * Index des statistiques communales de /api/market/map.
 * Clé principale : département + nom normalisé ; secours : nom seul.
 */
export function indexCommuneStats(rows) {
  const byDepName = new Map()
  const byName = new Map()
  for (const r of rows ?? []) {
    const n = normalizeName(r.nom_commune)
    byDepName.set(`${r.code_departement}|${n}`, r)
    if (!byName.has(n)) byName.set(n, r)
  }
  return { byDepName, byName }
}

/**
 * Retrouve les statistiques de marché d'un bien estimé.
 * Pour Paris, le géocodage renvoie « Paris » + un code d'arrondissement : on
 * reconstruit le libellé d'arrondissement utilisé par /api/market/map.
 */
export function findCommuneStats(index, { codeCommune, commune, codeDepartement }) {
  if (!index) return null
  const arr = nomArrondissementParis(codeCommune)
  if (arr) return index.byDepName.get(`75|${normalizeName(arr)}`) ?? null
  const n = normalizeName(commune)
  if (!n) return null
  const dep = codeDepartement ?? codeCommune?.slice(0, 2)
  return (dep && index.byDepName.get(`${dep}|${n}`)) || index.byName.get(n) || null
}

/** Code postal d'Île-de-France présent dans une adresse saisie, sinon null. */
export function extraireCodePostal(adresse) {
  const m = String(adresse ?? '').match(/\b(75|77|78|91|92|93|94|95)\d{3}\b/)
  return m ? m[0] : null
}

/**
 * Localisation déduite du code postal SAISI par l'utilisateur (aucune donnée
 * inventée) : le département, et pour Paris l'arrondissement
 * (75011 → 75111 ; 75016 et 75116 → 75116).
 * Sert de repli quand le serveur ne renvoie pas la commune du bien.
 */
export function localisationDepuisCodePostal(cp) {
  if (!cp) return { codeDepartement: null, codeCommune: null }
  const m = cp.match(/^75[01](0[1-9]|1\d|20)$/)
  return {
    codeDepartement: cp.slice(0, 2),
    codeCommune: m ? `751${m[1]}` : null,
  }
}
