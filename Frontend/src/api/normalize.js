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
