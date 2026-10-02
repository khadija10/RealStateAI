import { useEffect, useLayoutEffect, useState } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import PriceMap from './components/PriceMap'
import MarketTrends from './components/MarketTrends'
import History from './components/History'
import LocalEstimationsHistory from './components/LocalEstimationsHistory'
import ProfilePanel from './components/ProfilePanel'
import VanillaPage from './components/VanillaPage'
import * as estimationPage from './vanilla/estimation.js'
import * as financementPage from './vanilla/financement.js'
import * as plusvaluePage from './vanilla/plusvalue.js'
import { getHealth, getMe, getToken, clearToken } from './api/client'
import AuthModal from './components/AuthModal'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const TABS = [
  { id: 'estimation', label: 'Estimation' },
  { id: 'financement', label: 'Financement' },
  { id: 'plusvalue', label: 'Plus-value' },
  { id: 'carte', label: 'Carte des prix' },
  { id: 'marche', label: 'Référence du marché' },
  { id: 'historique', label: 'Historique', protected: true },
  { id: 'profil', label: 'Profil', protected: true },
]

export default function App() {
  const [backendStatus, setBackendStatus] = useState('loading')
  const [activeTab, setActiveTab] = useState('estimation')
  const [user, setUser] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [datasetInfo, setDatasetInfo] = useState(null)
  const [historyKey, setHistoryKey] = useState(0)
  const [plusValuePrefill, setPlusValuePrefill] = useState(null)
  const [dpeInfo, setDpeInfo] = useState(null)
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('reai_theme') === 'dark' } catch { return false }
  })

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    try { localStorage.setItem('reai_theme', darkMode ? 'dark' : 'light') } catch { /* ignore */ }
  }, [darkMode])

  useEffect(() => {
    const token = getToken()
    if (token) {
      getMe().then((u) => setUser(u)).catch(() => { clearToken(); setUser(null) })
    }
  }, [])

  function handleAuthSuccess(_token, userData) {
    setUser(userData)
    setShowAuthModal(false)
  }

  function handleLogout() {
    clearToken()
    setUser(null)
    setActiveTab((t) => (TABS.find((tab) => tab.id === t)?.protected ? 'estimation' : t))
  }

  useEffect(() => {
    getHealth()
      .then((h) => {
        setBackendStatus((h.dvf_loaded || h.model_loaded) ? 'ready' : 'error')
        setDatasetInfo({
          nCommunes: h.n_communes ?? null,
          minYear: h.dvf_min_year ?? null,
          maxYear: h.dvf_max_year ?? null,
          nRows: h.n_rows ?? null,
        })
        if (h.dpe_loaded) {
          setDpeInfo({ coveragePct: h.dpe_coverage_pct, nZones: h.dpe_n_zones })
        }
      })
      .catch(() => setBackendStatus('error'))
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        datasetStatus={backendStatus}
        dpeInfo={dpeInfo}
        user={user}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((d) => !d)}
      />
      {showAuthModal && (
        <AuthModal onSuccess={handleAuthSuccess} onClose={() => setShowAuthModal(false)} />
      )}

      {/* Barre de navigation onglets */}
      <nav className="border-b border-stone-100 bg-white sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] bg-[linear-gradient(100deg,var(--color-stone-50),var(--color-limestone-light))] rounded-full p-1 w-fit max-w-full">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.protected && !user) { setShowAuthModal(true); return }
                  setActiveTab(tab.id)
                  if (tab.id === 'historique') setHistoryKey((k) => k + 1)
                }}
                className={`px-3.5 sm:px-5 py-2 text-sm font-medium rounded-full shrink-0 transition-colors ${
                  activeTab === tab.id
                    ? 'text-white bg-[linear-gradient(100deg,var(--color-seine),var(--color-ambre))] shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full">
        {/* ONGLET ESTIMATION — reprise de l'artefact Claude Design, rebranchée sur le backend */}
        {activeTab === 'estimation' && (
          <div className="w-full px-4 sm:px-6 py-8">
            <VanillaPage
              page={estimationPage}
              apiBase={API_BASE}
              options={{ onPlusValue: (bien) => { setPlusValuePrefill(bien); setActiveTab('plusvalue') } }}
            />
          </div>
        )}

        {/* ONGLET FINANCEMENT — moteur réel /api/financing/dossier */}
        {activeTab === 'financement' && (
          <div className="w-full px-4 sm:px-6 py-8">
            <VanillaPage page={financementPage} apiBase={API_BASE} />
          </div>
        )}

        {/* ONGLET PLUS-VALUE — calculateur local (scénarios + fiscalité CGI) */}
        {activeTab === 'plusvalue' && (
          <div className="w-full px-4 sm:px-6 py-8">
            <VanillaPage page={plusvaluePage} apiBase={API_BASE} options={{ prefill: plusValuePrefill }} />
          </div>
        )}

        {/* ONGLET CARTE */}
        {activeTab === 'carte' && (
          <div className="max-w-5xl w-full mx-auto px-6 py-10">
            <div className="max-w-xl mb-8">
              <h1 className="font-display text-4xl sm:text-5xl text-ink leading-[1.05] whitespace-nowrap">
                Carte des prix par commune
              </h1>
              <p className="text-sm text-ink-muted mt-3 whitespace-nowrap">
                Prix médian au m² — {datasetInfo?.nCommunes?.toLocaleString('fr-FR') ?? '—'} communes d&apos;Île-de-France{datasetInfo?.minYear && datasetInfo?.maxYear ? ` · transactions ${datasetInfo.minYear}–${datasetInfo.maxYear}` : ''}
              </p>
            </div>
            <PriceMap />
          </div>
        )}

        {/* ONGLET RÉFÉRENCE */}
        {activeTab === 'marche' && (
          <div className="max-w-5xl w-full mx-auto px-6 py-10">
            <div className="max-w-xl mb-8">
              <h1 className="font-display text-4xl sm:text-5xl text-ink leading-[1.05] whitespace-nowrap">
                Référence du marché
              </h1>
              <p className="text-sm text-ink-muted mt-3 whitespace-nowrap">
                Évolution mensuelle du prix médian au m² par département{datasetInfo?.minYear && datasetInfo?.maxYear ? `, ${datasetInfo.minYear}–${datasetInfo.maxYear}` : ''}.
              </p>
            </div>
            <MarketTrends />
          </div>
        )}

        {/* ONGLET HISTORIQUE */}
        {activeTab === 'historique' && (
          <div className="max-w-5xl w-full mx-auto px-6 py-10">
            <div className="max-w-xl mb-8">
              <h1 className="font-display text-4xl sm:text-5xl text-ink leading-[1.05] whitespace-nowrap">
                Historique
              </h1>
              <p className="text-sm text-ink-muted mt-3 whitespace-nowrap">
                Vos 20 dernières estimations enregistrées.
              </p>
            </div>
            <div className="max-w-2xl">
              <LocalEstimationsHistory />
              <History key={historyKey} onReEstimate={() => setActiveTab('estimation')} />
            </div>
          </div>
        )}

        {/* ONGLET PROFIL */}
        {activeTab === 'profil' && (
          <div className="max-w-5xl w-full mx-auto px-6 py-10">
            <div className="max-w-xl mb-8">
              <h1 className="font-display text-4xl sm:text-5xl text-ink leading-[1.05] whitespace-nowrap">
                Mon profil
              </h1>
              <p className="text-sm text-ink-muted mt-3 whitespace-nowrap">
                Paramètres de votre compte.
              </p>
            </div>
            <ProfilePanel user={user} onLogout={handleLogout} />
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
