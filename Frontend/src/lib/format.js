// Formatage des nombres et des dates — une seule implémentation pour toute
// l'application (locale fr-FR, espace fine insécable comme séparateur).

const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

const isNum = (n) => typeof n === 'number' && Number.isFinite(n)

/** 458250 → « 458 250 € » ; valeur absente → « — » */
export function euro(n) {
  return isNum(n) ? `${nf0.format(Math.round(n))} €` : '—'
}

/** 7050 → « 7 050 €/m² » */
export function euroM2(n) {
  return isNum(n) ? `${nf0.format(Math.round(n))} €/m²` : '—'
}

/** 458250 → « 458 k€ » ; 1 250 000 → « 1,25 M€ » */
export function euroCompact(n) {
  if (!isNum(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M€`
  if (abs >= 1e3) return `${nf0.format(Math.round(n / 1e3))} k€`
  return euro(n)
}

/** Nombre entier formaté : 721675 → « 721 675 » */
export function nb(n) {
  return isNum(n) ? nf0.format(Math.round(n)) : '—'
}

/**
 * Pourcentage à partir d'une fraction : 0.164 → « 16,4 % ».
 * `signed` ajoute « + » devant les valeurs positives.
 */
export function pct(fraction, { digits = 1, signed = false } = {}) {
  if (!isNum(fraction)) return '—'
  const s = (100 * fraction).toLocaleString('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return `${signed && fraction > 0 ? '+' : ''}${s} %`
}

/** Pourcentage déjà exprimé en points : 16.37 → « 16,4 % » */
export function pctPoints(value, digits = 1) {
  return isNum(value) ? pct(value / 100, { digits }) : '—'
}

/** Date ISO → « 28 septembre 2026 » */
export function dateLongue(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(d)
}

/** Date ISO → « 28 sept. 2026, 16:25 » */
export function dateHeure(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

/** Pluriel simple : plural(3, 'pièce') → « 3 pièces » */
export function plural(n, mot, motPluriel = `${mot}s`) {
  return `${nb(n)} ${Math.abs(n) > 1 ? motPluriel : mot}`
}
