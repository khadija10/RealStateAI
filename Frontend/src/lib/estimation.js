// Logique de présentation de l'estimation (sans composant React).

import { extraireCodePostal } from './geo'

export const FORM_VIDE = {
  mode: 'adresse',
  address: '',
  commune: '',
  type: 'apartment',
  surface: '',
  rooms: '',
  dpe: '',
  annee: '',
  numeroDpe: '',
  numeroLot: '',
}

export const ANNEE_MAX = new Date().getFullYear()

/** Contrôles alignés sur la validation du backend (EstimationRequest). */
export function validerFormulaire(v) {
  const e = {}
  if (v.mode === 'adresse' && v.address.trim().length < 3) e.address = 'Indiquez l’adresse du bien.'
  if (v.mode === 'commune' && !v.commune.trim()) e.commune = 'Choisissez une commune.'
  const s = Number(v.surface)
  if (v.surface === '') e.surface = 'Indiquez la surface habitable.'
  else if (!(s > 5) || s > 2000) e.surface = 'La surface doit être comprise entre 6 et 2 000 m².'
  if (v.rooms !== '') {
    const r = Number(v.rooms)
    if (!Number.isInteger(r) || r < 1 || r > 30) e.rooms = 'Entre 1 et 30 pièces.'
    else if (!e.surface && s / r < 5) e.rooms = 'Moins de 5 m² par pièce : vérifiez la surface ou le nombre de pièces.'
    else if (!e.surface && s / r > 200) e.rooms = 'Plus de 200 m² par pièce : vérifiez la surface ou le nombre de pièces.'
  }
  if (v.annee !== '') {
    const a = Number(v.annee)
    if (!Number.isInteger(a) || a < 1800 || a > ANNEE_MAX) e.annee = `Entre 1800 et ${ANNEE_MAX}.`
  }
  if (v.numeroDpe && !/^[0-9A-Za-z]{13}$/.test(v.numeroDpe.trim())) e.numeroDpe = '13 lettres ou chiffres, sans espace.'
  return e
}

/** Corps de POST /api/predictions/estimate : seuls les champs renseignés sont envoyés. */
export function construirePayload(v) {
  const p = { area_m2: Number(v.surface), property_type: v.type }
  if (v.rooms !== '') p.rooms = Number(v.rooms)
  if (v.mode === 'adresse') {
    p.address = v.address.trim()
    const cp = extraireCodePostal(v.address)
    if (cp) p.postal_code = cp
  } else {
    p.commune = v.commune.trim()
  }
  if (v.dpe) p.dpe_classe = v.dpe
  if (v.annee !== '') p.annee_construction = Number(v.annee)
  if (v.numeroDpe?.trim()) p.numero_dpe = v.numeroDpe.trim().toUpperCase()
  if (v.numeroLot?.trim()) p.numero_lot = v.numeroLot.trim()
  return p
}

export const DPE = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

/** Couleurs de l'étiquette énergie (échelle réglementaire, tons adoucis). */
export const DPE_COULEURS = {
  A: { fond: '#2F7D4F', texte: '#FFFFFF' },
  B: { fond: '#4E9A5B', texte: '#FFFFFF' },
  C: { fond: '#8DB255', texte: '#141311' },
  D: { fond: '#D6B84A', texte: '#141311' },
  E: { fond: '#D99A3E', texte: '#141311' },
  F: { fond: '#C9703A', texte: '#FFFFFF' },
  G: { fond: '#B5453A', texte: '#FFFFFF' },
}

const TYPES = { apartment: 'Appartement', house: 'Maison' }

/** Lieu affiché : adresse normalisée par la BAN, sinon la saisie. */
export function libelleLieu(r, values) {
  if (r.address) return r.address
  if (values.mode === 'commune') return r.commune ?? values.commune
  return values.address
}

export function descriptionBien(values) {
  const parts = [TYPES[values.type] ?? 'Bien', `${values.surface} m²`]
  if (values.rooms) parts.push(`${values.rooms} pièce${Number(values.rooms) > 1 ? 's' : ''}`)
  if (values.dpe) parts.push(`DPE ${values.dpe}`)
  if (values.annee) parts.push(`construit en ${values.annee}`)
  return parts.join(' · ')
}

/** Niveau qualitatif d'un indice de fiabilité 0..1. */
export function niveauFiabilite(r) {
  if (r == null) return null
  if (r >= 0.8) return { label: 'Élevée', tone: 'success' }
  if (r >= 0.6) return { label: 'Moyenne', tone: 'warning' }
  return { label: 'Faible', tone: 'danger' }
}

/** Libellé de la fourchette, fidèle au champ `price_range.basis` du backend. */
export function libelleFourchette(r) {
  if (r.rangeBasis === 'interquartile') return 'Fourchette interquartile des ventes comparables (50 % des prix observés)'
  if (r.rangeBasis === 'heuristique') return 'Fourchette indicative, sans fondement statistique'
  return r.confidenceLabel ? `Intervalle de confiance à ${r.confidenceLabel.replace('%', ' %')}` : 'Fourchette d’estimation'
}

/** Libellés des classes de fiabilité du protocole d'évaluation (docs/protocole_evaluation.md). */
export const CLASSES_FIABILITE = {
  fiable: { titre: 'Fiabilité élevée', texte: 'le prix peut appuyer une négociation.', ton: 'success' },
  indicative: { titre: 'Fiabilité correcte', texte: 'un bon point de départ, à confirmer par une visite.', ton: 'warning' },
  a_completer: { titre: 'Fiabilité limitée', texte: 'secteur difficile : l’avis d’un professionnel est indispensable.', ton: 'danger' },
  donnees_insuffisantes: { titre: 'Peu de références', texte: 'trop peu de ventes récentes pour mesurer l’écart ici.', ton: 'neutral' },
}
