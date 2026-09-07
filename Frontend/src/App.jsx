import { useEffect, useState } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import EstimationForm from './components/EstimationForm'
import ResultPanel from './components/ResultPanel'
import PriceMap from './components/PriceMap'
import MarketTrends from './components/MarketTrends'
import { getHealth, getCommunes, estimatePrice, ApiError } from './api/client'

const EMPTY_FORM = {
  area_m2: '',
  rooms: '',
  property_type: 'apartment',
  commune: '',
  address: '',
  postal_code: '',
}

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
  }
}

export default function App() {
  const [backendStatus, setBackendStatus] = useState('loading')
  const [communes, setCommunes] = useState([])
  const [communesLoading, setCommunesLoading] = useState(true)

  const [form, setForm] = useState(EMPTY_FORM)
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState(EMPTY_FORM)

  useEffect(() => {
    getHealth()
      .then((h) => setBackendStatus(h.dvf_loaded ? 'ready' : 'error'))
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
        rooms: form.rooms ? Number(form.rooms) : undefined,
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
      <Header datasetStatus={backendStatus} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12">
        {/* Hero */}
        <div className="max-w-xl mb-10">
          <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl text-ink leading-[1.05]">
            Estimez la valeur de votre bien en quelques secondes
          </h1>
          <p className="text-ink-muted mt-4 leading-relaxed">
            Modèle LightGBM entraîné sur 700 000 transactions DVF en Île-de-France. Géolocalisation via l&apos;API BAN.
          </p>
        </div>

        {/* Estimateur */}
        <div className="grid md:grid-cols-2 gap-6 items-start">
          <EstimationForm
            values={form}
            onChange={setForm}
            onSubmit={handleSubmit}
            communes={communes}
            communesLoading={communesLoading}
            loading={status === 'loading'}
          />
          <ResultPanel status={status} error={error} result={result} query={submittedQuery} />
        </div>

        {/* Carte des prix */}
        <PriceMap />

        {/* Référence du marché */}
        <MarketTrends />
      </main>

      <Footer />
    </div>
  )
}
