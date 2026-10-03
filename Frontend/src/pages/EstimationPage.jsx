import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { estimatePrice } from '../api/client'
import { normalizeEstimate } from '../api/normalize'
import EstimationSearchBar from '../components/estimation/EstimationSearchBar'
import { construirePayload, descriptionBien, FORM_VIDE, libelleLieu, validerFormulaire } from '../lib/estimation'
import { DepartmentTrendCard, MarketContextCard } from '../components/estimation/MarketCards'
import MarketExplorer from '../components/estimation/MarketExplorer'
import { NextSteps, TechnicalDetails } from '../components/estimation/ResultActions'
import { ReliabilityCard, ResultSummary } from '../components/estimation/ResultSummary'
import { PageContainer } from '../components/layout/PageHeader'
import { Button, Card, ErrorState, IconEstimate, IconMap, IconTrend, Illustration, Skeleton } from '../components/ui'
import { useHealth } from '../context/HealthContext'
import { useAction } from '../hooks/useApi'
import { useCommuneStats, useCommuneSuggestions } from '../hooks/useMarketData'
import { usePageTitle } from '../hooks/usePageTitle'
import { heroEstimation, vignetteBois } from '../illustrations'
import { euro, nb, pctPoints } from '../lib/format'
import { extraireCodePostal, findCommuneStats, localisationDepuisCodePostal } from '../lib/geo'
import { memoriserLocalement, valeursDepuisUrl } from '../lib/estimationExport'

// Dernière estimation de la session : conservée quand l'utilisateur part vers
// Financement / Plus-value puis revient (réponse du serveur, telle quelle).
const SESSION_KEY = 'rsai_derniere_estimation'
function lireSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}
function ecrireSession(v) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(v)) } catch { /* navigation privée */ }
}

/** Pastille d'état du serveur, posée sur l'illustration du héros. */
function HeroStatus() {
  const { status, health } = useHealth()
  let tone = 'bg-ink-muted animate-pulse'
  let label = 'Connexion au serveur…'
  if (status === 'offline') {
    tone = 'bg-danger'
    label = 'Serveur injoignable'
  } else if (status !== 'loading' && health.mode === 'ml') {
    tone = 'bg-success'
    label = `Modèle connecté${health.model.mape != null ? ` · erreur moyenne ${pctPoints(health.model.mape)}` : ''}`
  } else if (status !== 'loading' && health.mode === 'dvf') {
    tone = 'bg-success'
    label = 'Données DVF connectées'
  } else if (status !== 'loading') {
    tone = 'bg-warning'
    label = 'Mode démonstration'
  }
  return (
    <p className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-[11.5px] font-medium text-[#141311] backdrop-blur-sm">
      <span className={`h-1.5 w-1.5 rounded-full ${tone}`} aria-hidden="true" />
      {label}
    </p>
  )
}

/**
 * « Notre approche » : bandeau intégré sous le héros. Chiffres du modèle
 * lus dans /api/health (jamais écrits en dur).
 */
function Manifeste() {
  const { status, health } = useHealth()
  const m = health?.model
  const items = m?.loaded
    ? [
        m.nTransactions != null && { v: nb(m.nTransactions), l: 'Transactions analysées' },
        m.nFeatures != null && { v: nb(m.nFeatures), l: 'Variables du modèle' },
        m.mape != null && { v: pctPoints(m.mape), l: 'Erreur moyenne mesurée' },
        m.r2 != null && { v: m.r2.toLocaleString('fr-FR', { maximumFractionDigits: 2 }), l: 'Coefficient R²' },
      ].filter(Boolean)
    : health?.dvf?.loaded
      ? [
          health.dvf.nRows != null && { v: nb(health.dvf.nRows), l: 'Ventes DVF chargées' },
          health.dvf.nCommunes != null && { v: nb(health.dvf.nCommunes), l: 'Communes couvertes' },
        ].filter(Boolean)
      : []

  return (
    <div
      aria-labelledby="titre-approche"
      role="region"
      className="grid gap-5 px-6 py-5 text-white sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-center lg:gap-12"
    >
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">Notre approche</p>
        <h2 id="titre-approche" className="text-pretty text-[16px] font-normal leading-snug text-white [text-shadow:0_1px_10px_rgba(0,0,0,.25)] sm:text-[17px] [&_em]:font-display [&_em]:text-[1.12em]">
          Un modèle entraîné sur les ventes notariées d’Île-de-France, dont nous publions{' '}
          <em>l’erreur réelle</em>, commune par commune.
        </h2>
      </div>
      {status === 'loading' ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 !bg-white/20" />)}
        </div>
      ) : items.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-white/20">
          {items.map(({ v, l }) => (
            <div key={l} className="flex flex-col-reverse justify-end sm:px-5 sm:first:pl-0">
              <dt className="mt-1.5 text-xs leading-snug text-white/75">{l}</dt>
              <dd className="ds-num font-display text-[clamp(1.75rem,1.4rem+1vw,2.25rem)] leading-none text-white [text-shadow:0_1px_12px_rgba(0,0,0,.25)]">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}

/** État initial : explique ce qui va se passer, avec l'illustration de la marque. */
function HowItWorks() {
  const steps = [
    { icon: IconMap, t: 'Localisation', d: 'L’adresse est géolocalisée par la Base Adresse Nationale.' },
    { icon: IconEstimate, t: 'Estimation', d: 'Le modèle compare votre bien aux ventes notariées du secteur.' },
    { icon: IconTrend, t: 'Mise en contexte', d: 'Fourchette, fiabilité et position face au marché local.' },
  ]
  return (
    <Card padding="none" className="grid overflow-hidden md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Illustration draw={vignetteBois} className="relative min-h-52 bg-sable [&_svg]:absolute [&_svg]:inset-0" />
      <div className="p-6 sm:p-8">
        <p className="ds-eyebrow mb-2">Comment ça marche</p>
        <h2 className="ds-h3 mb-6">Votre estimation <em>apparaîtra ici</em></h2>
        <ol className="flex flex-col gap-5">
          {steps.map(({ icon: Icon, t, d }, i) => (
            <li key={t} className="flex gap-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
                <Icon size={18} />
              </span>
              <span>
                <span className="block text-sm font-medium text-ink">{i + 1}. {t}</span>
                <span className="block text-sm text-ink-muted">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  )
}

function ResultSkeleton() {
  return (
    <div className="grid gap-2 rounded-[28px] border border-line bg-surface p-2 shadow-xs lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Skeleton className="min-h-[400px]" rounded="rounded-[22px]" />
      <div className="flex flex-col gap-5 px-4 py-5 sm:px-6">
        <Skeleton className="h-6 w-1/2" />
        <div className="flex items-center gap-5">
          <Skeleton className="h-24 w-24 shrink-0" rounded="rounded-full" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="mt-4 h-6 w-1/2" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  )
}

/** Erreur d'estimation, avec un titre adapté à la cause renvoyée par le backend. */
function EstimationError({ error, onRetry, onEdit }) {
  const s = error?.status
  const title =
    error?.kind === 'network' || error?.kind === 'timeout'
      ? 'Le serveur d’estimation ne répond pas'
      : s === 422
        ? 'Vérifiez les informations du bien'
        : s === 404
          ? 'Aucune vente comparable trouvée'
          : s === 503
            ? 'Service momentanément indisponible'
            : 'L’estimation a échoué'
  const corrigeable = s === 422 || s === 404
  return (
    <div className="flex flex-col gap-3">
      <ErrorState title={title} error={error} onRetry={corrigeable ? undefined : onRetry} />
      {corrigeable && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={onEdit}>Modifier le bien</Button>
        </div>
      )}
    </div>
  )
}

export default function EstimationPage() {
  usePageTitle('Estimation')
  const location = useLocation()
  const navigate = useNavigate()
  const saved = useRef(lireSession())
  const [values, setValues] = useState(() => saved.current?.values ?? FORM_VIDE)
  const [resultat, setResultat] = useState(() =>
    saved.current?.raw ? { r: normalizeEstimate(saved.current.raw), values: saved.current.values, at: saved.current.at } : null,
  )
  const [annonce, setAnnonce] = useState('')
  const action = useAction((payload, signal) => estimatePrice(payload, { signal }))
  const statsState = useCommuneStats()
  const communes = useCommuneSuggestions()
  const resultRef = useRef(null)
  const formRef = useRef(null)
  const lastPayload = useRef(null)

  async function estimer(payload, formValues = values) {
    lastPayload.current = { payload, formValues }
    setAnnonce('Estimation en cours…')
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    const raw = await action.run(payload)
    if (!raw) {
      setAnnonce('L’estimation a échoué.')
      return
    }
    const r = normalizeEstimate(raw)
    const at = new Date().toISOString()
    setResultat({ r, values: formValues, at })
    ecrireSession({ raw, values: formValues, at })
    if (!r.isDemo) {
      memoriserLocalement({ query: libelleLieu(r, formValues), area_m2: Number(formValues.surface), prix: r.price })
    }
    setAnnonce(`Estimation terminée : ${euro(r.price)}${r.isDemo ? ', en mode démonstration' : ''}.`)
    requestAnimationFrame(() => resultRef.current?.focus({ preventScroll: true }))
  }

  // Lien de partage (/estimation?address=…&area_m2=…) : formulaire rempli,
  // estimation relancée une fois, puis l'URL est nettoyée.
  useEffect(() => {
    const v = valeursDepuisUrl(location.search, FORM_VIDE)
    if (!v) return
    setValues(v)
    navigate('/estimation', { replace: true, state: location.state })
    if (!Object.keys(validerFormulaire(v)).length) estimer(construirePayload(v), v)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function choisirCommune(nom) {
    setValues((v) => ({ ...v, mode: 'commune', commune: nom }))
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    requestAnimationFrame(() => document.getElementById(values.surface ? 'estim-commune' : 'estim-surface')?.focus({ preventScroll: true }))
  }

  function modifier() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    requestAnimationFrame(() => formRef.current?.querySelector('input')?.focus({ preventScroll: true }))
  }

  const r = resultat?.r
  const rv = resultat?.values
  const lieu = r ? libelleLieu(r, rv) : null
  // Localisation : celle renvoyée par le serveur en priorité ; à défaut, celle
  // déduite du code postal saisi (département, arrondissement parisien).
  const saisie = rv?.mode === 'adresse' ? localisationDepuisCodePostal(extraireCodePostal(rv.address)) : {}
  const localisation = r
    ? {
        codeCommune: r.codeCommune ?? saisie.codeCommune ?? null,
        commune: r.commune ?? (rv.mode === 'commune' ? rv.commune : null),
        codeDepartement: r.codeDepartement ?? saisie.codeDepartement ?? null,
      }
    : null
  const stats = r ? findCommuneStats(statsState.index, localisation) : null
  const dep = localisation?.codeDepartement ?? stats?.code_departement ?? null
  const communeConnue = Boolean(localisation?.codeCommune || localisation?.commune)

  return (
    <PageContainer className="pt-4 sm:pt-6">
      {/* ── Héros (illustration, promesse, barre d'estimation) + approche ── */}
      <section
        ref={formRef}
        id="formulaire"
        aria-labelledby="titre-page"
        className="relative isolate flex scroll-mt-24 flex-col overflow-hidden rounded-[28px] bg-[#8BA3C0] shadow-xs lg:min-h-[min(calc(100svh-6rem),860px)]"
      >
        <Illustration draw={heroEstimation} className="absolute inset-0 -z-20" />
        {/* Voiles : lisibilité du titre (haut, gauche) et de « Notre approche » (bas). */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(15,20,30,.40)_0%,rgba(15,20,30,.06)_30%,rgba(15,20,30,0)_45%,rgba(18,16,14,.45)_68%,rgba(18,16,14,.82)_100%),linear-gradient(90deg,rgba(15,20,30,.32),rgba(15,20,30,0)_60%)]"
        />
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col justify-between gap-6 p-2 pt-6 sm:p-3 sm:pt-8">
            <div className="flex flex-col-reverse items-start gap-4 px-4 sm:px-8 md:flex-row md:justify-between">
              <div className="max-w-xl text-white">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
                  Estimation immobilière · Île-de-France
                </p>
                <h1
                  id="titre-page"
                  className="text-balance font-[family-name:var(--font-display)] text-[clamp(2.2rem,1.4rem+2.7vw,3.6rem)] font-normal leading-[.98] tracking-[-0.02em] [&_em]:italic"
                >
                  La vraie valeur <em>de votre bien</em>
                </h1>
                <p className="mt-3 max-w-md text-pretty text-[14.5px] font-light leading-relaxed text-white/90">
                  Prix estimé, fourchette, fiabilité et position face au marché local.
                </p>
              </div>
              <HeroStatus />
            </div>

            <EstimationSearchBar
              values={values}
              onChange={setValues}
              onSubmit={(p) => estimer(p, values)}
              loading={action.loading}
              communes={communes}
            />
          </div>
        </div>
        <Manifeste />
      </section>

      {/* ── Résultat ──────────────────────────────────────────────────── */}
      <p className="sr-only" aria-live="polite">{annonce}</p>
      <section
        ref={resultRef}
        tabIndex={-1}
        aria-labelledby="titre-resultat"
        className="mt-14 scroll-mt-20 outline-none sm:mt-20"
      >
        <h2 id="titre-resultat" className={r || action.loading || action.error ? 'ds-h2 mb-3 px-1' : 'sr-only'}>
          Votre <em>estimation</em>
        </h2>

        {action.loading ? (
          <ResultSkeleton />
        ) : action.error ? (
          <EstimationError
            error={action.error}
            onRetry={() => lastPayload.current && estimer(lastPayload.current.payload, lastPayload.current.formValues)}
            onEdit={modifier}
          />
        ) : r ? (
          <div key={resultat.at} className="flex flex-col gap-4 animate-fade-in">
            <div className="grid gap-2 overflow-hidden rounded-[28px] border border-line bg-surface p-2 shadow-xs lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <ResultSummary r={r} values={rv} at={resultat.at} stats={stats} />
              <div className="flex flex-col justify-center gap-5 px-4 py-5 sm:px-6">
                <ReliabilityCard r={r} embedded />
                <div className="border-t border-line pt-5">
                  <MarketContextCard
                    embedded
                    stats={stats}
                    statsState={statsState}
                    pricePerM2={r.isDemo ? null : r.pricePerM2}
                    isDemo={r.isDemo}
                    lieu={lieu}
                    communeConnue={communeConnue}
                  />
                </div>
              </div>
            </div>
            <DepartmentTrendCard dep={dep} />
            <TechnicalDetails r={r} values={rv} />
            <div className="mt-8">
              <NextSteps r={r} values={rv} lieu={lieu} description={descriptionBien(rv)} at={resultat.at} stats={stats} dep={dep} />
            </div>
          </div>
        ) : (
          <HowItWorks />
        )}
      </section>

      {/* ── Exploration du marché ─────────────────────────────────────── */}
      <div className="mt-20 border-t border-line pt-16 sm:mt-24">
        <MarketExplorer statsState={statsState} onPick={choisirCommune} />
      </div>

      <p className="mt-16 text-center text-xs text-ink-muted">
        Estimation indicative fondée sur les ventes passées : elle ne constitue pas une expertise immobilière.
      </p>
    </PageContainer>
  )
}
