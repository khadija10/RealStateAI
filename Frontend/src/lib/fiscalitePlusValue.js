// ═══════════════════════════════════════════════════════════════════════════
// Règles fiscales de la plus-value immobilière des particuliers — barème 2026
// ───────────────────────────────────────────────────────────────────────────
// Ces règles ne sont exposées par aucune API du backend : elles sont donc
// appliquées ici, côté navigateur, et regroupées dans ce seul module.
// Sources : Code général des impôts, art. 150 U (exonération de la résidence
// principale), 150 VB (forfaits d'acquisition et de travaux), 150 VC
// (abattements pour durée de détention), 200 B (taux d'impôt sur le revenu),
// 1609 nonies G (taxe sur les plus-values élevées), et CSS art. L136-7
// (prélèvements sociaux).
// Toute évolution législative se répercute en modifiant REGLES_PLUS_VALUE.
// ═══════════════════════════════════════════════════════════════════════════

export const REGLES_PLUS_VALUE = {
  millesime: 2026,
  /** Impôt sur le revenu (CGI art. 200 B). */
  tauxIR: 0.19,
  /** Prélèvements sociaux. */
  tauxPS: 0.172,
  /** Forfait des frais d'acquisition, en part du prix (CGI art. 150 VB II 4°). */
  forfaitFraisAcquisition: 0.075,
  /** Forfait des travaux au-delà de 5 ans de détention (CGI art. 150 VB II 4° bis). */
  forfaitTravaux: 0.15,
  dureeMinimaleForfaitTravaux: 5,
  /**
   * Taxe sur les plus-values élevées (CGI art. 1609 nonies G) :
   * [borne basse, borne haute, taux, coefficient de lissage]. Dans la zone de
   * lissage (10 000 € au-dessus de chaque seuil), la taxe vaut
   * taux × PV − (borne haute de la zone − PV) × coefficient.
   */
  surtaxe: [
    { de: 50000, lissageJusqua: 60000, jusqua: 100000, taux: 0.02, coef: 1 / 20 },
    { de: 100000, lissageJusqua: 110000, jusqua: 150000, taux: 0.03, coef: 1 / 10 },
    { de: 150000, lissageJusqua: 160000, jusqua: 200000, taux: 0.04, coef: 15 / 100 },
    { de: 200000, lissageJusqua: 210000, jusqua: 250000, taux: 0.05, coef: 20 / 100 },
    { de: 250000, lissageJusqua: 260000, jusqua: Infinity, taux: 0.06, coef: 25 / 100 },
  ],
  articles: 'CGI art. 150 U, 150 VB, 150 VC, 200 B, 1609 nonies G',
}

/**
 * Abattement pour durée de détention sur la base de l'impôt sur le revenu
 * (CGI art. 150 VC) : 6 % par an de la 6e à la 21e année, 4 % la 22e.
 * Exonération totale au-delà de 22 ans.
 */
export function abattementIR(annees) {
  if (annees < 6) return 0
  if (annees <= 21) return 0.06 * (annees - 5)
  return 1
}

/**
 * Abattement sur la base des prélèvements sociaux : 1,65 % par an de la 6e
 * à la 21e année, 1,60 % la 22e, 9 % par an de la 23e à la 30e.
 * Exonération totale au-delà de 30 ans.
 */
export function abattementPS(annees) {
  if (annees < 6) return 0
  if (annees <= 21) return 0.0165 * (annees - 5)
  if (annees === 22) return 0.0165 * 16 + 0.016
  if (annees < 30) return 0.0165 * 16 + 0.016 + 0.09 * (annees - 22)
  return 1
}

/** Taxe sur les plus-values élevées, calculée sur la plus-value imposable à l'IR. */
export function surtaxe(pvImposableIR) {
  const pv = pvImposableIR
  if (pv <= REGLES_PLUS_VALUE.surtaxe[0].de) return 0
  for (const t of REGLES_PLUS_VALUE.surtaxe) {
    if (pv > t.de && pv <= t.lissageJusqua) return Math.max(0, t.taux * pv - (t.lissageJusqua - pv) * t.coef)
    if (pv > t.lissageJusqua && pv <= t.jusqua) return t.taux * pv
  }
  return 0
}

/**
 * Impôt dû sur la plus-value d'une revente.
 * - `residencePrincipale` : exonération totale (CGI art. 150 U II 1°).
 * - `travaux` : montant des travaux réellement engagés (le forfait de 15 %
 *   s'applique s'il est plus favorable, au-delà de 5 ans de détention).
 */
export function calculerImpotPlusValue({ prixAchat, prixVente, anneesDetention, residencePrincipale, travaux = 0 }) {
  const R = REGLES_PLUS_VALUE
  const pvBrute = prixVente - prixAchat
  if (residencePrincipale) {
    return { exonere: true, pvBrute, pvImposable: 0, ir: 0, ps: 0, surtaxe: 0, total: 0 }
  }
  const travauxRetenus =
    anneesDetention > R.dureeMinimaleForfaitTravaux ? Math.max(travaux, prixAchat * R.forfaitTravaux) : travaux
  const fraisAcquisition = prixAchat * R.forfaitFraisAcquisition
  const prixRevient = prixAchat + fraisAcquisition + travauxRetenus
  const pvImposable = Math.max(0, prixVente - prixRevient)
  const aIR = abattementIR(anneesDetention)
  const aPS = abattementPS(anneesDetention)
  const baseIR = pvImposable * (1 - aIR)
  const basePS = pvImposable * (1 - aPS)
  const ir = baseIR * R.tauxIR
  const ps = basePS * R.tauxPS
  const st = surtaxe(baseIR)
  return {
    exonere: false,
    pvBrute,
    fraisAcquisition,
    travauxRetenus,
    prixRevient,
    pvImposable,
    abattementIR: aIR,
    abattementPS: aPS,
    baseIR,
    basePS,
    ir,
    ps,
    surtaxe: st,
    total: ir + ps + st,
  }
}
