import { IconChart, IconEstimate, IconHistory, IconMap, IconTrend, IconUser, IconWallet } from '../ui'

/**
 * Structure de navigation, source unique pour la barre du haut (desktop)
 * et la barre d'onglets (mobile). L'ordre suit le parcours principal :
 * estimer un bien → le financer → anticiper sa revente → situer le marché.
 */
export const MAIN_NAV = [
  { to: '/estimation', label: 'Estimation', short: 'Estimer', icon: IconEstimate },
  { to: '/financement', label: 'Financement', short: 'Financer', icon: IconWallet },
  { to: '/plus-value', label: 'Plus-value', short: 'Plus-value', icon: IconTrend },
  { to: '/marche', label: 'Marché', short: 'Marché', icon: IconMap },
]

/** Sous-pages de « Marché ». */
export const MARKET_NAV = [
  { to: '/marche/carte', label: 'Carte des prix', icon: <IconMap size={16} /> },
  { to: '/marche/tendances', label: 'Tendances', icon: <IconChart size={16} /> },
]

/** Espace personnel (utilisateur connecté). */
export const ACCOUNT_NAV = [
  { to: '/historique', label: 'Historique', description: 'Vos estimations enregistrées', icon: IconHistory },
  { to: '/profil', label: 'Profil', description: 'Compte et sécurité', icon: IconUser },
]
