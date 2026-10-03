import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import PriceMap from './components/PriceMap'
import MarketTrends from './components/MarketTrends'
import History from './components/History'
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
  { id: 'financement', label: 'Financement', protected: true },
  { id: 'plusvalue', label: 'Plus-value' },
  { id: 'carte', label: 'Carte des prix' },
  { id: 'marche', label: 'Référence du marché' },
]
// Historique et Profil : accessibles depuis l'espace du compte, dans l'en-tête
const ONGLETS_COMPTE = ['historique', 'profil']

export default function App() {
  const [backendStatus, setBackendStatus] = useState('loading')
  const [activeTab, setActiveTab] = useState('estimation')
  const [user, setUser] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [datasetInfo, setDatasetInfo] = useState(null)
  const [historyKey, setHistoryKey] = useState(0)
  const [plusValuePrefill, setPlusValuePrefill] = useState(null)
  const [financementPrefill, setFinancementPrefill] = useState(null)
  const [estimationFaite, setEstimationFaite] = useState(false)
  // « Ré-estimer » depuis l'historique : le bien à réestimer, transmis à la page Estimation
  const [relance, setRelance] = useState(null)
  // Pages Estimation, Financement et Plus-value déjà ouvertes : elles restent montées
  // (simplement masquées) quand on change d'onglet, comme le résultat de la v1.4 qui
  // vivait dans App. Le formulaire, l'estimation et les simulations sont ainsi conservés.
  const [ouvertes, setOuvertes] = useState(() => new Set(['estimation']))
  // Action mise en attente de connexion (estimation lancée sans être connecté)
  const actionApresConnexion = useRef(null)
  // Incrémentée à la déconnexion : remonte les pages pour effacer les résultats
  const [pageCle, setPageCle] = useState(0)
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
    // date d'inscription (affichée dans le profil) : servie par /api/auth/me
    getMe().then((u) => setUser(u)).catch(() => {})
    setShowAuthModal(false)
    const action = actionApresConnexion.current
    actionApresConnexion.current = null
    action?.()
  }

  function ouvrirOnglet(id) {
    setOuvertes((s) => (s.has(id) ? s : new Set(s).add(id)))
    setActiveTab(id)
  }

  function handleLogout() {
    clearToken()
    setUser(null)
    // Le résultat d'un compte ne doit pas rester visible pour le suivant
    setOuvertes(new Set(['estimation']))
    setEstimationFaite(false)
    setRelance(null)
    setFinancementPrefill(null)
    setPlusValuePrefill(null)
    setPageCle((k) => k + 1)
    setActiveTab((t) => (TABS.find((tab) => tab.id === t)?.protected || ONGLETS_COMPTE.includes(t) ? 'estimation' : t))
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
      })
      .catch(() => setBackendStatus('error'))
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        datasetStatus={backendStatus}
        activeTab={activeTab}
        onNavigate={(id) => {
          if (!user) { setShowAuthModal(true); return }
          ouvrirOnglet(id)
          if (id === 'historique') setHistoryKey((k) => k + 1)
        }}
        user={user}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((d) => !d)}
      />
      {showAuthModal && (
        <AuthModal onSuccess={handleAuthSuccess} onClose={() => { setShowAuthModal(false); actionApresConnexion.current = null }} />
      )}

      {/* Barre de navigation onglets */}
      <nav className="border-b border-stone-100 bg-white sticky top-0 z-20">
        <div className="w-full px-4 sm:px-6 lg:px-10 py-3">
          <div className="flex gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] bg-[linear-gradient(100deg,var(--color-stone-50),var(--color-limestone-light))] rounded-full p-1 w-fit max-w-full">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.protected && !user) { setShowAuthModal(true); return }
                  ouvrirOnglet(tab.id)
                  if (tab.id === 'historique') setHistoryKey((k) => k + 1)
                }}
                className={`px-3.5 sm:px-5 py-2 text-sm font-medium rounded-full shrink-0 transition-colors ${
                  activeTab === tab.id
                    ? 'text-white bg-[linear-gradient(100deg,var(--color-seine),var(--color-ambre))] shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {tab.label}
                {tab.id === 'estimation' && estimationFaite && (
                  <span className="ml-2 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block align-middle" role="img" aria-label="votre dernière estimation est disponible" title="Votre dernière estimation est disponible" />
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full">
        {/* ONGLET ESTIMATION — reprise de l'artefact Claude Design, rebranchée sur le backend */}
        <div className="w-full pb-8" hidden={activeTab !== 'estimation'}>
            <VanillaPage
              key={`estimation-${pageCle}`}
              page={estimationPage}
              apiBase={API_BASE}
              options={{
                onPlusValue: (bien) => { setPlusValuePrefill(bien); ouvrirOnglet('plusvalue') },
                onFinancement: (bien) => {
                  setFinancementPrefill(bien)
                  if (!getToken()) { actionApresConnexion.current = () => ouvrirOnglet('financement'); setShowAuthModal(true); return }
                  ouvrirOnglet('financement')
                },
                onEstime: () => setEstimationFaite(true),
                // Connexion demandée avant d'estimer, comme dans l'ancien frontend
                demanderConnexion: (reprendre) => { actionApresConnexion.current = reprendre; setShowAuthModal(true) },
                relance,
              }}
            />
        </div>

        {/* ONGLET FINANCEMENT — moteur réel /api/financing/dossier */}
        {user && ouvertes.has('financement') && (
          <div className="w-full pb-8" hidden={activeTab !== 'financement'}>
            <VanillaPage key={`financement-${pageCle}`} page={financementPage} apiBase={API_BASE} options={{ prefill: financementPrefill }} />
          </div>
        )}

        {/* ONGLET PLUS-VALUE — calculateur local (scénarios + fiscalité CGI) */}
        {ouvertes.has('plusvalue') && (
          <div className="w-full pb-8" hidden={activeTab !== 'plusvalue'}>
            <VanillaPage key={`plusvalue-${pageCle}`} page={plusvaluePage} apiBase={API_BASE} options={{ prefill: plusValuePrefill }} />
          </div>
        )}

        {/* ONGLET CARTE */}
        {activeTab === 'carte' && (
          <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
            <div className="max-w-3xl mb-8">
              <h1 className="titre-page">
                Carte <em>des prix</em>
              </h1>
              <p className="text-sm text-ink-muted mt-3">
                Prix médian au m² — {datasetInfo?.nCommunes?.toLocaleString('fr-FR') ?? '—'} communes d&apos;Île-de-France{datasetInfo?.minYear && datasetInfo?.maxYear ? ` · transactions ${datasetInfo.minYear}–${datasetInfo.maxYear}` : ''}
              </p>
            </div>
            <PriceMap />
          </div>
        )}

        {/* ONGLET RÉFÉRENCE */}
        {activeTab === 'marche' && (
          <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
            <div className="max-w-3xl mb-8">
              <h1 className="titre-page">
                Référence <em>du marché</em>
              </h1>
              <p className="text-sm text-ink-muted mt-3">
                Prix médian au m² par département, en moyenne glissante sur 3 mois{datasetInfo?.minYear && datasetInfo?.maxYear ? `, ${datasetInfo.minYear}–${datasetInfo.maxYear}` : ''}. Toutes ventes confondues (appartements et maisons, neuf et ancien).
              </p>
            </div>
            <MarketTrends />
          </div>
        )}

        {/* ONGLET HISTORIQUE */}
        {activeTab === 'historique' && (
          <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
            <div className="max-w-3xl mb-8">
              <h1 className="titre-page">
                Votre <em>historique</em>
              </h1>
              <p className="text-sm text-ink-muted mt-3">
                Vos biens estimés, avec leur évolution et leurs simulations.
              </p>
            </div>
            <div>
              <History
                key={historyKey}
                onReEstimate={(item) => { setRelance({ ...item, _demande: Date.now() }); ouvrirOnglet('estimation') }}
                onVoir={(item) => { setRelance({ ...item, _mode: 'voir', _demande: Date.now() }); ouvrirOnglet('estimation') }}
              />
            </div>
          </div>
        )}

        {/* ONGLET PROFIL */}
        {activeTab === 'profil' && (
          <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
            <div className="max-w-3xl mb-8">
              <h1 className="titre-page">
                Votre <em>profil</em>
              </h1>
              <p className="text-sm text-ink-muted mt-3">
                Paramètres de votre compte.
              </p>
            </div>
            <ProfilePanel user={user} onLogout={handleLogout} />
          </div>
        )}
      </main>

      {/* Les pages Estimation, Financement et Plus-value ont leur propre pied de
          page (sources, références légales) : pas de second pied de page. */}
      {!['estimation', 'financement', 'plusvalue'].includes(activeTab) && <Footer />}
    </div>
  )
}
