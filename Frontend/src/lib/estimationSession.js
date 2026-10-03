// Dernière estimation de la session (réponse brute du serveur + saisie),
// partagée entre la page Estimation et les simulateurs (pré-remplissage).

import { normalizeEstimate } from '../api/normalize'
import { descriptionBien, libelleLieu } from './estimation'
import { extraireCodePostal, localisationDepuisCodePostal } from './geo'

const SESSION_KEY = 'rsai_derniere_estimation'

export function lireSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}

export function ecrireSession(v) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(v)) } catch { /* navigation privée */ }
}

/**
 * Bien à reprendre dans un simulateur, construit depuis la dernière
 * estimation de la session. `demo: true` signale une estimation de
 * démonstration : son prix n'est pas repris sans l'accord de l'utilisateur.
 */
export function bienDepuisSession() {
  const s = lireSession()
  if (!s?.raw || !s?.values) return null
  const r = normalizeEstimate(s.raw)
  if (!r || r.price == null) return null
  const saisie = s.values.mode === 'adresse' ? localisationDepuisCodePostal(extraireCodePostal(s.values.address)) : {}
  return {
    prix: r.price,
    departement: r.codeDepartement ?? saisie.codeDepartement ?? null,
    lieu: libelleLieu(r, s.values),
    description: descriptionBien(s.values),
    at: s.at,
    demo: r.isDemo,
  }
}
