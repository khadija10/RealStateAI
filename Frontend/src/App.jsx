import { useEffect, useState } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import EstimationForm from './components/EstimationForm'
import ResultPanel from './components/ResultPanel'
import PriceMap from './components/PriceMap'
import MarketTrends from './components/MarketTrends'
import History from './components/History'
import FinancingPanel from './components/FinancingPanel'
import { getHealth, getCommunes, estimatePrice, getMe, getToken, saveToken, clearToken, ApiError } from './api/client'
import AuthModal from './components/AuthModal'

const EMPTY_FORM = {
  area_m2: '',
  rooms: '',
  property_type: 'apartment',
  commune: '',
  address: '',
  postal_code: '',
}

const TABS = [
  { id: 'estimation', label: 'Estimation' },
  { id: 'financement', label: 'Financement' },
  { id: 'carte', label: 'Carte des prix' },
  { id: 'marche', label: 'Référence du marché' },
  { id: 'historique', label: 'Historique' },
]

function normalizeCommunes(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((c) => (typeof c === 'string' ? c : c.commune || c.name || c.label || '')).filter(Boolean)
}

function normalizeResult(raw) {
  const price = raw.estimated_price ?? raw.price ?? raw.prediction ?? raw.predicted_price
  const pricePerM2 = raw.price_per_m2 ?? raw.pricePerM2 ?? (price && raw.area_m2 ? price / raw.area_m2 : undefined)
  const range = raw.confidence_range ?? raw.price_range ?? raw.confidence_interval
  const low = raw.price_low ?? raw.low ?? range?.min ?? range?.low ?? (Array.isArray(range) ? range[0] : undefined)
  const high = raw.price_high ?? raw.high ?? range?.max ?? range?.high ?? (Array.isArray(range) ? range[1] : undefined)

  return {
    price: price ?? 0,
    pricePerM2: pricePerM2 ?? 0,
    low: low ?? price * 0.9,
    high: high ?? price * 1.1,
    model: raw.model ?? 'dvf',
    adresseNormalisee: raw.adresse_normalisee ?? raw.adresseNormalisee ?? null,
    reliability: raw.reliability ?? null,
    meta: raw.meta ?? null,
    confidenceLabel: raw.confidence_interval?.confidence ?? '85%',
    localMape: raw.local_mape ?? null,
    localMapeN: raw.local_mape_n ?? null,
  }
}

export default function App() {
  const [backendStatus, setBackendStatus] = useState('loading')
  const [communes, setCommunes] = useState([])
  const [communesLoading, setCommunesLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('estimation')
  const [user, setUser] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)

  const [form, setForm] = useState(EMPTY_FORM)
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState(EMPTY_FORM)
  const [financingDefaultPrix, setFinancingDefaultPrix] = useState(null)
  const [financingDefaultDep, setFinancingDefaultDep] = useState(null)
  const [modelInfo, setModelInfo] = useState(null)
  const [datasetInfo, setDatasetInfo] = useState(null)

  useEffect(() => {
    const token = getToken()
    if (token) {
      getMe().then((u) => setUser(u)).catch(() => { clearToken(); setUser(null) })
    }
  }, [])

  function handleAuthSuccess(token, userData) {
    saveToken(token)
    setUser(userData)
    setShowAuthModal(false)
  }

  function handleLogout() {
    clearToken()
    setUser(null)
  }

  useEffect(() => {
    getHealth()
      .then((h) => {
        setBackendStatus((h.dvf_loaded || h.model_loaded) ? 'ready' : 'error')
        if (h.model_mape != null) {
          setModelInfo({
            mape: h.model_mape,
            r2: h.model_r2,
            trainedAt: h.model_trained_at,
            nFeatures: h.model_n_features,
            nTransactions: h.model_n_transactions,
          })
        }
        setDatasetInfo({
          nCommunes: h.n_communes ?? null,
          minYear: h.dvf_min_year ?? null,
          maxYear: h.dvf_max_year ?? null,
          nRows: h.n_rows ?? null,
        })
      })
      .catch(() => setBackendStatus('error'))

    getCommunes()
      .then((c) => setCommunes(normalizeCommunes(c)))
      .catch(() => setCommunes([]))
      .finally(() => setCommunesLoading(false))
  }, [])

  async function handleSubmit() {
    setStatus('loading')
    setError('')
    try {
      const payload = {
        area_m2: Number(form.area_m2),
        rooms: Number(form.rooms),
        property_type: form.property_type,
        ...(form.commune ? { commune: form.commune } : {}),
        ...(form.address ? { address: form.address } : {}),
        ...(form.postal_code ? { postal_code: form.postal_code } : {}),
      }
      const raw = await estimatePrice(payload)
      setResult(normalizeResult({ ...raw, area_m2: payload.area_m2 }))
      setSubmittedQuery(form)
      setStatus('success')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Une erreur inattendue est survenue.")
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        datasetStatus={backendStatus}
        user={user}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
      />
      {showAuthModal && (
        <AuthModal onSuccess={handleAuthSuccess} onClose={() => setShowAuthModal(false)} />
      )}

      {/* Barre de navigation onglets */}
      <nav className="border-b border-stone-100 bg-white sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex gap-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-seine text-seine'
                    : 'border-transparent text-ink-muted hover:text-ink hover:border-stone-100'
                }`}
              >
                {tab.label}
                {tab.id === 'estimation' && status === 'success' && (
                  <span className="ml-2 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block align-middle" />
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10">

        {/* ONGLET ESTIMATION */}
        {activeTab === 'estimation' && (
          <>
            <div className="max-w-xl mb-10">
              <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl text-ink leading-[1.05]">
                Estimez la valeur de votre bien
              </h1>
              <p className="text-ink-muted mt-4 leading-relaxed">
                Modèle LightGBM entraîné sur {modelInfo?.nTransactions?.toLocaleString('fr-FR') ?? '—'} transactions DVF · Île-de-France · Géolocalisation BAN
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 items-start">
              <EstimationForm
                values={form}
                onChange={setForm}
                onSubmit={handleSubmit}
                communes={communes}
                communesLoading={communesLoading}
                loading={status === 'loading'}
              />
              <ResultPanel
                status={status}
                error={error}
                result={result}
                query={submittedQuery}
                modelInfo={modelInfo}
                onOpenFinancement={(prix, query) => {
                  setFinancingDefaultPrix(Math.round(prix))
                  const dep = query?.postal_code ? query.postal_code.slice(0, 2) : null
                  setFinancingDefaultDep(dep)
                  setActiveTab('financement')
                }}
              />
            </div>
          </>
        )}

        {/* ONGLET FINANCEMENT */}
        {activeTab === 'financement' && (
          <>
            <div className="max-w-xl mb-10">
              <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl text-ink leading-[1.05]">
                Simulez votre financement
              </h1>
              <p className="text-ink-muted mt-4 leading-relaxed">
                Calcul basé sur les normes HCSF en vigueur · Taux d'effort, mensualité, score dossier.
              </p>
            </div>
            <FinancingPanel defaultPrix={financingDefaultPrix} defaultDep={financingDefaultDep} />
          </>
        )}

        {/* ONGLET CARTE */}
        {activeTab === 'carte' && (
          <>
            <div className="max-w-xl mb-8">
              <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl text-ink leading-[1.05]">
                Carte des prix par commune
              </h1>
              <p className="text-ink-muted mt-4 leading-relaxed">
                Prix médian au m² — {datasetInfo?.nCommunes?.toLocaleString('fr-FR') ?? '—'} communes d&apos;Île-de-France{datasetInfo?.minYear && datasetInfo?.maxYear ? ` · transactions ${datasetInfo.minYear}–${datasetInfo.maxYear}` : ''}
              </p>
            </div>
            <PriceMap />
          </>
        )}

        {/* ONGLET RÉFÉRENCE */}
        {activeTab === 'marche' && (
          <>
            <div className="max-w-xl mb-8">
              <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl text-ink leading-[1.05]">
                Référence du marché
              </h1>
              <p className="text-ink-muted mt-4 leading-relaxed">
                Évolution mensuelle du prix médian au m² par département{datasetInfo?.minYear && datasetInfo?.maxYear ? `, ${datasetInfo.minYear}–${datasetInfo.maxYear}` : ''}.
              </p>
            </div>
            <MarketTrends />
          </>
        )}

        {/* ONGLET HISTORIQUE */}
        {activeTab === 'historique' && (
          <>
            <div className="max-w-xl mb-8">
              <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl text-ink leading-[1.05]">
                Historique
              </h1>
              <p className="text-ink-muted mt-4 leading-relaxed">
                Vos 20 dernières estimations enregistrées.
              </p>
            </div>
            <div className="max-w-2xl">
              <History />
            </div>
          </>
        )}

      </main>

      <Footer />
    </div>
  )
}
