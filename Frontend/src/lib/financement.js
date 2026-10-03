// Présentation du simulateur de financement (sans composant React).
// Aucun calcul financier ici : tous les montants viennent de
// POST /api/financing/dossier (moteur de règles déterministe du backend).

/** Valeurs de départ du formulaire (point de départ de la saisie, pas des résultats). */
export const FIN_DEFAUT = {
  revenus: 4200,
  apport: 45000,
  charges: 250,
  prix: 300000,
  loyer: 1100,
  duree: 25,
  situation: 'CDI',
  adultes: 2,
  enfants: 1,
  primo: true,
  neuf: false,
  departement: '75',
  autresRevenus: 0,
  travaux: 0,
  chargesLogement: 0,
  garantie: 'caution',
}

/** Situations professionnelles acceptées par le backend (BorrowerInput). */
export const SITUATIONS = [
  { value: 'CDI', label: 'CDI' },
  { value: 'fonctionnaire', label: 'Fonctionnaire' },
  { value: 'CDD', label: 'CDD' },
  { value: 'independant', label: 'Indépendant' },
  { value: 'interim', label: 'Intérim' },
  { value: 'chomage', label: 'Sans emploi' },
]

export const libelleSituation = (v) => SITUATIONS.find((s) => s.value === v)?.label ?? v

/** Corps de POST /api/financing/dossier. */
export function construirePayloadFinancement(v) {
  return {
    profil: {
      revenus_nets_mensuels: v.revenus,
      apport: v.apport,
      charges_credits_mensuelles: v.charges,
      autres_revenus_mensuels: v.autresRevenus,
      situation_professionnelle: v.situation,
      nb_adultes: v.adultes,
      nb_enfants: v.enfants,
      loyer_actuel: v.loyer,
      primo_accedant: v.primo,
    },
    projet: {
      prix_bien: v.prix,
      departement: v.departement,
      type_bien: v.neuf ? 'neuf' : 'ancien',
      montant_travaux: v.travaux,
      duree_souhaitee_annees: v.duree,
      type_garantie: v.garantie,
    },
    charges_logement_previsionnelles: v.chargesLogement,
  }
}

/** Libellés des postes du budget INSEE renvoyés par le backend. */
const POSTES = {
  alimentation: 'Alimentation',
  transports: 'Transports',
  loisirs_culture: 'Loisirs et culture',
  equipement_logement: 'Équipement du logement',
  sante: 'Santé',
  habillement: 'Habillement',
  communications: 'Communications',
  divers_assurances_services: 'Assurances, services et divers',
}

/** Libellés des critères du score du dossier. */
const CRITERES_SCORE = {
  taux_endettement: 'Taux d’endettement',
  apport: 'Apport personnel',
  reste_a_vivre: 'Reste à vivre',
  stabilite_professionnelle: 'Stabilité de l’emploi',
  saut_de_charge: 'Saut de charge',
}

/** « solder_les_credits_en_cours » → « Solder les crédits en cours » (libellé de repli). */
export function humaniser(cle) {
  const s = String(cle ?? '').replace(/_/g, ' ').trim()
  return s ? s[0].toUpperCase() + s.slice(1) : ''
}

export const libellePoste = (cle) => POSTES[cle] ?? humaniser(cle)
export const libelleCritereScore = (cle) => CRITERES_SCORE[cle] ?? humaniser(cle)

/** Ton du verdict à partir de la réponse : conforme, dérogation possible, refus. */
export function tonVerdict(d) {
  const c = d?.conformite_hcsf
  if (c?.conforme_hcsf) return 'success'
  if (c?.marge_derogation_possible) return 'warning'
  return 'danger'
}
