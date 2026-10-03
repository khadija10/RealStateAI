import { useEffect, useMemo, useState } from 'react'
import { getFinancingDossier } from '../api/client'
import { PageContainer } from '../components/layout/PageHeader'
import PlusValueForm from '../components/plusvalue/PlusValueForm'
import PvSummary from '../components/plusvalue/PvSummary'
import { AbattementsCard, FanChart, ImpositionCard, ResilienceCard, ScenarioCards } from '../components/plusvalue/PvVisuels'
import SimulationShell, { ShellPill } from '../components/simulation/SimulationShell'
import { Card, Skeleton } from '../components/ui'
import { useAction } from '../hooks/useApi'
import { useAllTrends } from '../hooks/useMarketData'
import { usePageTitle } from '../hooks/usePageTitle'
import { usePrefill } from '../hooks/usePrefill'
import { heroPlusValue } from '../illustrations'
import { calculerImpotPlusValue, REGLES_PLUS_VALUE } from '../lib/fiscalitePlusValue'
import { pct } from '../lib/format'
import { DEPARTEMENTS, nomDepartement } from '../lib/geo'
import { prixRevente, scenarios as calculerScenarios } from '../lib/plusValue'
import { syntheseAnnuelle } from '../lib/tendance'

const ANNEE_COURANTE = new Date().getFullYear()
const PV_DEFAUT = { departement: '75', prix: 420000, achat: null, horizon: 10, usage: 'rp', travaux: 0 }

/**
 * Frais d'acquisition réels (droits de mutation, émoluments, débours) :
 * calculés par le moteur de financement du serveur pour ce prix et ce
 * département. Le profil d'emprunteur transmis est neutre : il n'intervient
 * pas dans le calcul de ces frais (seul le statut de primo-accédant le
 * ferait ; il est désactivé, comme pour un achat d'investissement classique).
 */
function payloadFrais(prix, departement) {
  return {
    profil: { revenus_nets_mensuels: 1, apport: 0, primo_accedant: false },
    projet: { prix_bien: prix, departement, type_bien: 'ancien' },
  }
}

export default function PlusValuePage() {
  usePageTitle('Plus-value')
  const prefill = usePrefill()
  // Une estimation de démonstration n'est reprise que si l'utilisateur le demande.
  const [prefillActif, setPrefillActif] = useState(Boolean(prefill && !prefill.demo))
  const [values, setValues] = useState(() => ({
    ...PV_DEFAUT,
    ...(prefill && !prefill.demo
      ? {
          prix: Math.round(prefill.prix),
          departement: prefill.departement in DEPARTEMENTS ? prefill.departement : PV_DEFAUT.departement,
          achat: ANNEE_COURANTE,
        }
      : {}),
  }))
  const [choix, setChoix] = useState(1)

  const marche = useAllTrends()
  const series = useMemo(() => {
    const out = {}
    for (const [dep, rows] of Object.entries(marche.parDep)) out[dep] = syntheseAnnuelle(rows).map((a) => ({ annee: a.annee, prix: a.prix }))
    return out
  }, [marche.parDep])
  const departements = Object.keys(series).filter((d) => series[d].length >= 2).sort()
  const serie = series[values.departement]

  // Années d'achat proposées : celles observées, plus l'année en cours (achat aujourd'hui).
  const annees = useMemo(() => {
    if (!serie) return [ANNEE_COURANTE]
    const obs = serie.map((s) => s.annee)
    return obs.includes(ANNEE_COURANTE) || ANNEE_COURANTE < obs[0] ? obs : [...obs, ANNEE_COURANTE]
  }, [serie])
  const achat = values.achat != null && annees.includes(values.achat) ? values.achat : annees[Math.max(0, annees.length - 3)]
  const vente = achat + values.horizon

  const scenarios = useMemo(() => (serie && serie.length >= 2 ? calculerScenarios(serie) : null), [serie])
  const resultats = useMemo(() => {
    if (!scenarios) return null
    return scenarios.map((s) => {
      const revente = prixRevente(serie, values.prix, achat, vente, s.taux)
      const impot = calculerImpotPlusValue({
        prixAchat: values.prix,
        prixVente: revente,
        anneesDetention: values.horizon,
        residencePrincipale: values.usage === 'rp',
        travaux: values.usage === 'inv' ? values.travaux : 0,
      })
      return { ...s, revente, impot, prixAchat: values.prix }
    })
  }, [scenarios, serie, values, achat, vente])

  // Frais d'acquisition : moteur de financement du serveur (relancé si prix ou département changent).
  const frais = useAction((payload, signal) => getFinancingDossier(payload, { signal, timeout: 30000 }))
  const { run } = frais
  useEffect(() => {
    const t = setTimeout(() => run(payloadFrais(values.prix, values.departement)), 300)
    return () => clearTimeout(t)
  }, [values.prix, values.departement, run])
  const fraisAcquisition = frais.data?.plan_financement?.frais_acquisition ?? null

  const variations = departements.map((d) => {
    const s = series[d]
    return { dep: d, v: s[s.length - 1].prix / s[0].prix - 1 }
  })
  const periode = serie ? `${serie[0].annee} et ${serie[serie.length - 1].annee}` : ''

  function basculerPrefill() {
    if (prefillActif) {
      setValues((v) => ({ ...v, prix: PV_DEFAUT.prix, departement: PV_DEFAUT.departement, achat: null }))
      setPrefillActif(false)
    } else if (prefill) {
      setValues((v) => ({
        ...v,
        prix: Math.round(prefill.prix),
        departement: prefill.departement in DEPARTEMENTS ? prefill.departement : v.departement,
        achat: ANNEE_COURANTE,
      }))
      setPrefillActif(true)
    }
  }

  const contexte = {
    prix: values.prix,
    achat,
    vente,
    nomDep: nomDepartement(values.departement),
    derniereAnnee: serie?.[serie.length - 1]?.annee,
  }

  return (
    <PageContainer className="pt-4 sm:pt-6">
      <SimulationShell
        draw={heroPlusValue}
        eyebrow="Plus-value · fiscalité 2026"
        title={<>Anticiper <em>votre plus-value</em></>}
        lead="Trois scénarios tirés du marché observé et la fiscalité selon la durée de détention."
        aside={
          marche.loading ? (
            <ShellPill tone="loading">Chargement du marché…</ShellPill>
          ) : marche.error ? (
            <ShellPill tone="danger">Marché indisponible</ShellPill>
          ) : (
            <ShellPill tone="success">Prix observés · ventes DVF {periode.replace(' et ', '–')}</ShellPill>
          )
        }
      >
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <PlusValueForm
            values={{ ...values, achat }}
            onChange={(v) => setValues(v)}
            annees={annees}
            departementsDisponibles={departements.length ? departements : Object.keys(DEPARTEMENTS)}
            prefill={prefill}
            prefillActif={prefillActif}
            onTogglePrefill={basculerPrefill}
          />
          <PvSummary
            resultat={resultats?.[choix]}
            scenarioIndex={choix}
            contexte={contexte}
            frais={{ data: fraisAcquisition, loading: frais.loading, error: frais.error }}
            marche={marche}
          />
        </div>
      </SimulationShell>

      {marche.error ? null : !resultats ? (
        <div className="mt-10 grid gap-4" aria-hidden="true">
          <Skeleton className="h-28" rounded="rounded-[18px]" />
          <Skeleton className="h-80" rounded="rounded-[22px]" />
        </div>
      ) : (
        <>
          <section className="mt-12 sm:mt-16" aria-labelledby="titre-scenarios">
            <div className="mb-5 px-1">
              <h2 id="titre-scenarios" className="ds-h2">Trois <em>scénarios</em> de marché</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Tirés des prix observés en {contexte.nomDep} ; l’écart entre eux mesure l’incertitude. Choisissez celui à détailler.
              </p>
            </div>
            <ScenarioCards resultats={resultats} prix={values.prix} choix={choix} onChoix={setChoix} />
            <div className="mt-4">
              <FanChart serie={serie} scenarios={scenarios} achat={achat} vente={vente} nomDep={contexte.nomDep} />
            </div>
          </section>

          <section className="mt-12 sm:mt-16" aria-labelledby="titre-fiscalite">
            <div className="mb-5 px-1">
              <h2 id="titre-fiscalite" className="ds-h2">La <em>fiscalité</em></h2>
              <p className="mt-1 text-sm text-ink-muted">
                Barème {REGLES_PLUS_VALUE.millesime} : {pct(REGLES_PLUS_VALUE.tauxIR, { digits: 0 })} d’impôt sur le revenu et{' '}
                {pct(REGLES_PLUS_VALUE.tauxPS, { digits: 1 })} de prélèvements sociaux, allégés par la durée de détention.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <ImpositionCard resultat={resultats[choix]} horizon={values.horizon} />
              <AbattementsCard horizon={values.horizon} />
            </div>
          </section>

          <section className="mt-12 sm:mt-16">
            <ResilienceCard
              variations={variations}
              selection={values.departement}
              periode={periode}
              onSelect={(dep) => setValues((v) => ({ ...v, departement: dep }))}
            />
          </section>
        </>
      )}

      <section className="mt-12 grid gap-4 sm:mt-16 lg:grid-cols-2">
        <Card padding="lg" className="rounded-[22px]">
          <h3 className="ds-h3 mb-2">Pourquoi des <em>scénarios</em>, et pas une prédiction</h3>
          <p className="text-[13.5px] leading-relaxed text-ink-soft">
            Les prix observés couvrent {periode ? `les années ${periode.replace(' et ', ' à ')}` : 'quelques années'}, dont une baisse marquée :
            c’est trop court pour prévoir un marché, un modèle entraîné sur cette période ne ferait qu’extrapoler la tendance.
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
            On projette donc <b className="text-ink">trois trajectoires tirées du marché observé</b> du département : la tendance de la
            période, le rythme de la dernière année et la stabilité des prix.
          </p>
        </Card>
        <Card padding="lg" className="rounded-[22px]">
          <h3 className="ds-h3 mb-2">Ce que la simulation <em>ignore</em></h3>
          <p className="text-[13.5px] leading-relaxed text-ink-soft">
            Les frais d’agence à la revente, l’inflation, les écarts de prix entre communes d’un même département et les cas
            d’exonération particuliers (première cession, retraités…).
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
            Pour l’impôt, les frais d’acquisition sont retenus au <b className="text-ink">forfait de {pct(REGLES_PLUS_VALUE.forfaitFraisAcquisition, { digits: 1 })}</b>{' '}
            et les travaux au forfait de {pct(REGLES_PLUS_VALUE.forfaitTravaux, { digits: 0 })} au-delà de{' '}
            {REGLES_PLUS_VALUE.dureeMinimaleForfaitTravaux} ans de détention, comme le prévoit le Code général des impôts. Le gain net, lui,
            déduit les frais d’acquisition réels calculés par le serveur.
          </p>
        </Card>
      </section>

      <footer className="mt-12 flex flex-col gap-1 border-t border-line pt-6 text-xs text-ink-muted sm:flex-row sm:justify-between">
        <span>Données : DVF — DGFiP / Etalab · Fiscalité : {REGLES_PLUS_VALUE.articles}</span>
        <span>Simulation indicative : ni conseil fiscal, ni conseil en investissement.</span>
      </footer>
    </PageContainer>
  )
}
