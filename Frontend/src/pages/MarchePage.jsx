import { useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import CarteCommunes from '../components/marche/CarteCommunes'
import { LegendePrix, PanneauCommune } from '../components/marche/PanneauCommune'
import { CartesDepartement, GraphiqueTendances, IndiceLongTerme, SelecteurDepartements, SyntheseAnnuelle } from '../components/marche/Tendances'
import { PageContainer } from '../components/layout/PageHeader'
import { MARKET_NAV } from '../components/layout/navigation'
import SimulationShell, { ShellPill } from '../components/simulation/SimulationShell'
import { Card, ErrorState, Notice, SegmentedControl, Skeleton } from '../components/ui'
import { useHealth } from '../context/HealthContext'
import { useApi } from '../hooks/useApi'
import { useAllTrends, useCommuneStats, useSecteurs } from '../hooks/useMarketData'
import { usePageTitle } from '../hooks/usePageTitle'
import { heroMarche } from '../illustrations'
import { chargerContours, fusionnerContours } from '../lib/carte'
import { cx } from '../lib/cx'
import { DEPARTEMENTS } from '../lib/geo'
import { filtresDisponibles, MARCHES, TYPES_BIEN } from '../lib/marche'

/** Les deux vues du marché, en capsule sur l'illustration du bandeau. */
function OngletsMarche() {
  return (
    <nav aria-label="Vues du marché">
      <ul className="inline-flex items-center gap-1 rounded-full bg-white/15 p-1.5 ring-1 ring-inset ring-white/25 backdrop-blur-md">
        {MARKET_NAV.map(({ to, label, icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                cx(
                  'inline-flex h-10 items-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-colors',
                  // Blanc explicite : le thème sombre redéfinit .bg-white (anciens composants)
                  isActive ? 'bg-[#FFFFFF] text-[#141311] shadow-sm' : 'text-white/85 hover:bg-white/10 hover:text-white',
                )
              }
            >
              {icon}
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * Pastille du bandeau : période des ventes (lue dans /api/health) ou, si le
 * serveur n'a pas chargé les ventes détaillées, statistiques agrégées.
 */
function PastilleMarche() {
  const { health, status } = useHealth()
  if (status === 'loading') return <ShellPill tone="loading">Connexion au serveur…</ShellPill>
  const { minYear, maxYear } = health?.dvf ?? {}
  const periode = minYear && maxYear ? `ventes DVF ${minYear}–${maxYear}` : 'ventes DVF'
  if (!filtresDisponibles(health)) {
    return (
      <span title="Ce serveur n’a pas chargé les ventes détaillées : les prix mélangent appartements et maisons, ancien et neuf, et les filtres par type de bien et par marché sont indisponibles.">
        <ShellPill tone="warning">Statistiques agrégées · {periode}</ShellPill>
      </span>
    )
  }
  return <ShellPill tone="success">Prix par commune · {periode}</ShellPill>
}

/** Section « Marché » : bandeau illustré (titre, onglets), puis la vue choisie. */
export default function MarchePage() {
  const { pathname } = useLocation()
  usePageTitle(pathname.endsWith('tendances') ? 'Tendances du marché' : 'Carte des prix')

  return (
    <PageContainer className="pt-4 sm:pt-6">
      <SimulationShell
        draw={heroMarche}
        eyebrow="Marché immobilier · Île-de-France"
        title={<>Le marché <em>d’Île-de-France</em></>}
        lead="Prix médians au m² des ventes notariées, commune par commune et mois après mois."
        aside={<PastilleMarche />}
        className="mb-6"
      >
        <div className="px-4 pb-4 sm:px-8 sm:pb-6">
          <OngletsMarche />
        </div>
      </SimulationShell>
      <Outlet />
    </PageContainer>
  )
}

/** Filtres type de bien / marché, proposés seulement si le serveur les applique. */
function useFiltres() {
  const { health } = useHealth()
  const [params, setParams] = useSearchParams()
  const dispo = filtresDisponibles(health)
  const type = dispo && params.get('type') === 'house' ? 'house' : 'apartment'
  const marche = dispo && ['ancien', 'neuf'].includes(params.get('marche')) ? params.get('marche') : 'tous'
  const maj = (cle, valeur, defaut) =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      if (valeur === defaut || valeur == null) n.delete(cle)
      else n.set(cle, valeur)
      return n
    }, { replace: true })
  return { dispo, type, marche, params, maj }
}

function Filtres({ f }) {
  if (!f.dispo) return null
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5">
      <SegmentedControl label="Type de bien" value={f.type} onChange={(v) => f.maj('type', v, 'apartment')} options={TYPES_BIEN} />
      <SegmentedControl label="Marché" value={f.marche} onChange={(v) => f.maj('marche', v, 'tous')} options={MARCHES} />
    </div>
  )
}

/** Raccourcis de cadrage : toute l'Île-de-France ou un département. */
function ChoixDepartement({ valeur, onChange }) {
  const choix = [['all', 'Île-de-France'], ...Object.entries(DEPARTEMENTS).map(([code, nom]) => [code, `${code} · ${nom}`])]
  return (
    <div role="group" aria-label="Département affiché" className="mb-4 flex flex-wrap gap-1.5">
      {choix.map(([code, libelle]) => {
        const actif = valeur === code
        return (
          <button
            key={code}
            type="button"
            aria-pressed={actif}
            onClick={() => onChange(actif && code !== 'all' ? 'all' : code)}
            className={cx(
              'inline-flex h-8 items-center rounded-full px-3 text-[12.5px] font-medium ring-1 ring-inset transition-colors',
              actif ? 'bg-brand text-on-brand ring-transparent shadow-xs' : 'text-ink-muted ring-line hover:text-ink hover:ring-line-strong',
            )}
          >
            {libelle}
          </button>
        )
      })}
    </div>
  )
}

export function CarteView() {
  const f = useFiltres()
  const dep = DEPARTEMENTS[f.params.get('dep')] ? f.params.get('dep') : 'all'
  const [selection, setSelection] = useState(null)
  const stats = useCommuneStats(f.type, f.marche)
  const contours = useApi(() => chargerContours(), [])
  const secteurs = useSecteurs(f.type)

  const features = useMemo(
    () => (contours.data && stats.index ? fusionnerContours(contours.data, stats.index) : []),
    [contours.data, stats.index],
  )
  const avecPrix = useMemo(() => features.filter((x) => x.properties.stats), [features])
  const couverture = features.length ? Math.round((avecPrix.length / features.length) * 100) : null

  const choisie = selection ? features.find((x) => x.properties.code === selection)?.properties : null
  const rangs = useMemo(() => {
    if (!choisie?.stats) return null
    const memeDep = avecPrix.filter((x) => x.properties.dep === choisie.dep).sort((a, b) => b.properties.stats.prix_m2_median - a.properties.stats.prix_m2_median)
    return { rang: memeDep.findIndex((x) => x.properties.code === choisie.code) + 1, n: memeDep.length }
  }, [choisie, avecPrix])
  const secteurChoisi = choisie ? secteurs.secteurs.find((s) => s.code === choisie.code) : null

  const chargement = contours.loading || stats.loading
  const erreur = stats.error ?? contours.error
  const fiche = choisie && (
    <PanneauCommune
      commune={choisie}
      rang={rangs?.rang ?? null}
      nbDep={rangs?.n ?? 0}
      secteur={secteurChoisi}
      typeBien={f.type}
      onFermer={() => setSelection(null)}
    />
  )
  return (
    <section aria-labelledby="titre-carte">
      <h2 id="titre-carte" className="sr-only">Carte des prix par commune</h2>
      <Filtres f={f} />
      <ChoixDepartement valeur={dep} onChange={(v) => { f.maj('dep', v, 'all'); setSelection(null) }} />

      <div className="relative isolate h-[520px] overflow-hidden rounded-[22px] border border-line bg-surface-2 shadow-xs">
        <CarteCommunes
          features={features}
          selection={selection}
          onSelect={setSelection}
          departement={dep}
          className="h-full w-full"
        />
        {chargement && (
          <div className="absolute inset-0 z-[500] grid place-items-center bg-surface-2/70 backdrop-blur-[1px]">
            <p role="status" className="rounded-full bg-surface px-4 py-2 text-sm text-ink-muted shadow-sm ring-1 ring-line">
              Chargement des prix et des contours…
            </p>
          </div>
        )}
        {!chargement && erreur && (
          <div className="absolute inset-0 z-[500] grid place-items-center bg-surface/90 p-6">
            <ErrorState
              title={stats.error ? 'Prix des communes indisponibles' : 'Contours des communes indisponibles'}
              error={erreur}
              onRetry={() => { stats.reload(); contours.reload() }}
            />
          </div>
        )}
        {!chargement && !erreur && features.length > 0 && !avecPrix.length && (
          <div className="absolute inset-x-6 top-6 z-[500]">
            <Notice tone="warning" title="Aucune commune avec assez de ventes">
              Aucune commune n’a au moins 5 ventes pour cette combinaison de filtres. Essayez un autre type de bien ou un autre marché.
            </Notice>
          </div>
        )}
        {/* Fiche de la commune cliquée, posée sur la carte (sous la carte sur mobile) */}
        {fiche && (
          <Card padding="md" className="absolute right-3 top-3 z-[500] hidden max-h-[calc(100%-24px)] w-[21rem] overflow-y-auto rounded-[20px] shadow-overlay sm:block">
            {fiche}
          </Card>
        )}
        <LegendePrix couverture={couverture} className="absolute bottom-3 left-3 z-[500] hidden sm:block" />
      </div>
      {fiche && <Card padding="md" className="mt-3 rounded-[20px] sm:hidden">{fiche}</Card>}
      <p className="mt-2.5 text-xs text-ink-muted">Cliquez sur une commune pour afficher sa fiche.</p>
      <div className="mt-3 sm:hidden">
        <LegendePrix couverture={couverture} />
      </div>
    </section>
  )
}

export function TendancesView() {
  const f = useFiltres()
  const depUrl = DEPARTEMENTS[f.params.get('dep')] ? f.params.get('dep') : null
  const [actifs, setActifs] = useState(() => (depUrl ? [depUrl, ...['75', '92', '93'].filter((d) => d !== depUrl)].slice(0, 3) : ['75', '92', '93']))
  const { parDep, loading, error, reload } = useAllTrends(f.type, f.marche)

  function basculer(code) {
    setActifs((a) => (a.includes(code) ? (a.length > 1 ? a.filter((d) => d !== code) : a) : [...a, code]))
  }

  return (
    <section aria-labelledby="titre-tendances" className="flex flex-col gap-4">
      <h2 id="titre-tendances" className="sr-only">Tendances par département</h2>
      <div>
        <Filtres f={f} />
        <SelecteurDepartements actifs={actifs} onToggle={basculer} />
      </div>

      {loading ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{actifs.map((d) => <Skeleton key={d} className="h-28" />)}</div>
          <Skeleton className="h-80 w-full" />
        </>
      ) : error ? (
        <ErrorState title="Tendances indisponibles" error={error} onRetry={reload} />
      ) : (
        <>
          <CartesDepartement parDep={parDep} actifs={actifs} />
          <Card padding="md" className="rounded-[22px]">
            <div className="mb-3">
              <h3 className="ds-h3">Évolution <em>mois par mois</em></h3>
              <p className="mt-0.5 text-[13px] text-ink-muted">Prix médian au m², moyenne glissante sur 3 mois, sur une échelle commune à tous les départements.</p>
            </div>
            <GraphiqueTendances parDep={parDep} actifs={actifs} />
          </Card>
          <Card padding="lg" className="rounded-[22px]">
            <div className="mb-3">
              <h3 className="ds-h3">Année <em>par année</em></h3>
              <p className="mt-0.5 text-[13px] text-ink-muted">Moyenne des médianes mensuelles, pondérée par le nombre de ventes de chaque mois, et variation sur un an.</p>
            </div>
            <SyntheseAnnuelle parDep={parDep} actifs={actifs} />
          </Card>
        </>
      )}
      <IndiceLongTerme actifs={actifs} typeBien={f.type} />
    </section>
  )
}
