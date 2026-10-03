// Transformation des réponses du backend vers la forme utilisée par l'UI.
// Règle : on ne complète JAMAIS une valeur absente par une valeur inventée.
// Un champ manquant reste `null`, et l'interface décide de le masquer.

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v) => (typeof v === 'string' && v.trim() ? v : null)

/**
 * Méthode d'estimation, telle que renvoyée par `model` :
 * - 'ml'   : modèle LightGBM géolocalisé ;
 * - 'dvf'  : médiane de transactions comparables ;
 * - 'mock' : heuristique de démonstration, SANS valeur d'estimation.
 */
export const METHODES = {
  ml: { label: 'Modèle ML', detail: 'LightGBM géolocalisé (API BAN)' },
  dvf: { label: 'Comparables DVF', detail: 'Médiane des ventes comparables' },
  mock: { label: 'Démonstration', detail: 'Heuristique sans donnée réelle' },
}

/** Réponse de POST /api/predictions/estimate. */
export function normalizeEstimate(d) {
  if (!d || typeof d !== 'object') return null
  const ci = d.confidence_interval || {}
  const range = d.price_range || {}
  const meta = d.meta || {}
  const method = ['ml', 'dvf', 'mock'].includes(d.model) ? d.model : 'ml'

  return {
    method,
    isDemo: method === 'mock',
    price: num(d.estimated_price) ?? num(d.predicted_price),
    pricePerM2: num(d.price_per_m2),
    low: num(range.low) ?? num(ci.lower),
    high: num(range.high) ?? num(ci.upper),
    lowPerM2: num(range.low_per_m2),
    highPerM2: num(range.high_per_m2),
    rangeBasis: str(range.basis), // 'ml' | 'interquartile' | 'heuristique'
    confidenceLabel: str(ci.confidence),
    reliability: num(d.reliability), // 0..1
    localMape: num(d.local_mape), // en points (%)
    localMapeN: num(d.local_mape_n),

    // Localisation renvoyée par le géocodage BAN (estimation ML uniquement)
    address: str(d.adresse_normalisee),
    commune: str(d.commune),
    codeCommune: str(d.code_commune),
    codeDepartement: str(d.code_departement),
    geocodingWarning: str(d.geocoding_warning),

    // Enrichissement DPE
    dpeClasse: str(d.dpe_classe),
    anneeConstruction: num(d.annee_construction),
    dpeZonePct: num(d.dpe_zone_fg_pct),

    // Qualité de l'estimation (v1.5) : classe du protocole d'évaluation,
    // segments où le modèle se trompe plus que sa moyenne, alertes de saisie.
    classeFiabilite: str(d.classe_fiabilite),
    segmentsDifficiles: Array.isArray(d.segments_difficiles)
      ? d.segments_difficiles.filter((x) => x && typeof x === 'object' && num(x.mape) != null)
      : [],
    alerteType: str(d.alerte_type),
    adresseSansNumero: d.adresse_sans_numero === true,
    codePostal: str(d.code_postal),
    historiqueId: num(d.historique_id),

    // DPE retrouvé par le serveur (ADEME), à l'adresse ou par son numéro
    dpeTrouve: d.dpe_trouve === true,
    dpeSource: str(d.dpe_source), // 'adresse' | 'numero' | 'saisi'
    dpeDate: str(d.dpe_date),
    dpeAppariement: str(d.dpe_appariement), // 'exacte' | 'probable'

    // Marché du secteur (commune ou arrondissement, même type de bien, ancien seul)
    secteur: normalizeSecteur(d.secteur),
    // Ventes de l'immeuble et leur médiane ramenée au marché du secteur
    comparables: Array.isArray(d.comparables_immeuble)
      ? d.comparables_immeuble.filter((c) => c && num(c.prix) != null)
      : [],
    immeubleReference: d.immeuble_reference && num(d.immeuble_reference.prix_m2) != null ? d.immeuble_reference : null,

    // Détail de la méthode
    meta: {
      scope: str(meta.scope),
      scopeValue: str(meta.scope_value),
      propertyTypeUsed: str(meta.property_type_used),
      nTransactions: num(meta.n_transactions) || null,
      dispersion: num(meta.dispersion),
      fallbackLevel: num(meta.fallback_level),
      surfaceTolerance: num(meta.surface_tolerance),
      roomsTolerance: num(meta.rooms_tolerance),
      notes: Array.isArray(meta.notes) ? meta.notes.filter((n) => typeof n === 'string') : [],
    },
  }
}

/**
 * Secteur renvoyé par le serveur (estimation ou GET /api/market/secteurs) :
 * médiane et déciles de la dernière année, ventes, médianes annuelles.
 * `serie` : [{ annee, prix }] — une année sans vente est omise.
 */
export function normalizeSecteur(s) {
  if (!s || typeof s !== 'object' || num(s.med) == null) return null
  const eco = Array.isArray(s.eco) ? s.eco : []
  const derniere = num(s.annee)
  const serie = derniere == null
    ? []
    : eco.map((v, i) => ({ annee: derniere - (eco.length - 1 - i), prix: num(v) })).filter((x) => x.prix != null)
  return {
    code: str(s.code),
    nom: str(s.nom),
    annee: derniere,
    med: num(s.med),
    p10: num(s.p10),
    p90: num(s.p90),
    n: num(s.n),
    serie,
    loyer: s.loyer && num(s.loyer.m2) != null ? s.loyer : null,
  }
}

/**
 * Réponse de GET /api/health.
 * `mode` résume ce que le serveur peut réellement fournir :
 * 'ml' (module ML chargé), 'dvf' (statistiques DVF), 'demo' (aucune donnée).
 */
export function normalizeHealth(h) {
  if (!h || typeof h !== 'object') return null
  const mode = h.model_loaded ? 'ml' : h.dvf_loaded ? 'dvf' : 'demo'
  return {
    mode,
    healthy: h.status === 'healthy',
    model: {
      loaded: !!h.model_loaded,
      error: str(h.model_error),
      mape: num(h.model_mape), // en points (%)
      r2: num(h.model_r2),
      trainedAt: str(h.model_trained_at),
      nFeatures: num(h.model_n_features),
      nTransactions: num(h.model_n_transactions),
      nTrain: num(h.model_n_train),
      nTest: num(h.model_n_test),
      // Validation officielle (protocole fixé avant la mesure)
      validation: h.model_validation && typeof h.model_validation === 'object'
        ? {
            mape: num(h.model_validation.mape),
            dans10: num(h.model_validation.dans_10pct),
            dans20: num(h.model_validation.dans_20pct),
            nTest: num(h.model_validation.n_test),
            periode: Array.isArray(h.model_validation.periode_test) ? h.model_validation.periode_test : null,
            mesureLe: str(h.model_validation.mesure_le),
            couverture: num(h.model_validation.fourchette?.couverture),
            largeurMediane: num(h.model_validation.fourchette?.largeur_mediane),
          }
        : null,
    },
    dvf: {
      loaded: !!h.dvf_loaded,
      nRows: num(h.n_rows) || null,
      nCommunes: num(h.n_communes) || null,
      minYear: num(h.dvf_min_year),
      maxYear: num(h.dvf_max_year),
      error: str(h.error),
    },
    dpe: {
      loaded: !!h.dpe_loaded,
      coveragePct: num(h.dpe_coverage_pct),
      nZones: num(h.dpe_n_zones) || null,
    },
  }
}
