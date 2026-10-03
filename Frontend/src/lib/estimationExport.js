// Lien de partage et historique local d'une estimation.
// Le rapport PDF est généré par lib/rapportPdf.js.

/** Lien qui reconstitue le formulaire et relance l'estimation à l'ouverture. */
export function lienPartage(values) {
  return `${window.location.origin}${cheminEstimation(values)}`
}

/** Chemin interne qui relance l'estimation de ce bien (même format que le lien de partage). */
export function cheminEstimation(values) {
  const p = new URLSearchParams()
  if (values.mode === 'commune') p.set('commune', values.commune)
  else p.set('address', values.address)
  p.set('area_m2', values.surface)
  if (values.rooms) p.set('rooms', values.rooms)
  p.set('type', values.type)
  if (values.dpe) p.set('dpe', values.dpe)
  if (values.annee) p.set('annee', values.annee)
  return `/estimation?${p.toString()}`
}

/** Saisie du formulaire reconstituée depuis une ligne de GET /api/search-history. */
export function valeursDepuisHistorique(item, base) {
  const saisie = item?.resultat?.saisie ?? {}
  const address = item.address || saisie.address || ''
  return {
    ...base,
    mode: address ? 'adresse' : 'commune',
    address,
    commune: address ? '' : item.commune || item.query || saisie.commune || '',
    type: item.property_type || saisie.property_type || base.type,
    surface: String(item.area_m2 ?? saisie.surface ?? ''),
    rooms: item.rooms != null ? String(item.rooms) : '',
    dpe: item.dpe_classe || item.resultat?.dpe_classe || '',
    annee: item.annee_construction != null ? String(item.annee_construction) : '',
  }
}

/** Valeurs de formulaire lues dans l'URL (liens de partage, anciens compris). */
export function valeursDepuisUrl(search, base) {
  const p = new URLSearchParams(search)
  if (![...p.keys()].length) return null
  const v = { ...base }
  if (p.get('commune')) { v.mode = 'commune'; v.commune = p.get('commune') }
  if (p.get('address')) { v.mode = 'adresse'; v.address = p.get('address') }
  if (p.get('area_m2')) v.surface = p.get('area_m2')
  if (p.get('rooms')) v.rooms = p.get('rooms')
  if (['apartment', 'house'].includes(p.get('type'))) v.type = p.get('type')
  if (/^[A-G]$/.test(p.get('dpe') ?? '')) v.dpe = p.get('dpe')
  if (p.get('annee')) v.annee = p.get('annee')
  return v
}

// Historique « sur cet appareil » — même clé et même forme qu'auparavant,
// lues par components/LocalEstimationsHistory.jsx.
const CLE = 'rsai_historique'
export function memoriserLocalement({ query, area_m2, prix }) {
  try {
    const avant = JSON.parse(localStorage.getItem(CLE) || '[]')
    const h = [{ query, area_m2, prix, created_at: new Date().toISOString() }, ...avant].slice(0, 6)
    localStorage.setItem(CLE, JSON.stringify(h))
  } catch { /* navigation privée */ }
}
