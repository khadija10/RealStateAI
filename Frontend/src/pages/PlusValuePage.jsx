import { useEffect, useMemo, useState } from 'react'
import { getFinancingDossier } from '../api/client'
import { PageContainer } from '../components/layout/PageHeader'
import RequireAuth from '../components/layout/RequireAuth'
import { LoyerCard, SeuilCard } from '../components/plusvalue/PvExtras'
import PlusValueForm from '../components/plusvalue/PlusValueForm'
import PvSummary from '../components/plusvalue/PvSummary'
import { AbattementsCard, FanChart, ImpositionCard, ResilienceCard, ScenarioCards } from '../components/plusvalue/PvVisuels'
import SimulationShell, { ShellPill } from '../components/simulation/SimulationShell'
import { Card, Skeleton } from '../components/ui'
import { useAction } from '../hooks/useApi'
import { useAllTrends, useIndiceInsee, useSecteurs } from '../hooks/useMarketData'
import { usePageTitle } from '../hooks/usePageTitle'
import { usePrefill } from '../hooks/usePrefill'
import { useSimulationHistorique } from '../hooks/useSimulationHistorique'
import { heroPlusValue } from '../illustrations'
import { HYPOTHESES_ACHAT_LOCATION } from '../lib/acheterLouer'
import { calculerImpotPlusValue, REGLES_PLUS_VALUE } from '../lib/fiscalitePlusValue'
import { pct } from '../lib/format'
import { DEPARTEMENTS, nomDepartement } from '../lib/geo'
import { prixRevente, scenarios as calculerScenarios, seuilRentabilite } from '../lib/plusValue'
import { syntheseAnnuelle } from '../lib/tendance'

const ANNEE_COURANTE = new Date().getFullYear()
const PV_DEFAUT = {
  type: 'apartment',
  departement: '75',
  secteur: null,
  prix: 420000,
  achat: null,
  horizon: 10,
  usage: 'rp',
  travaux: 0,
  agence: true,
}
const NB_SECTEURS_RESILIENCE = 16

/** Valeurs reprises du bien estimé : prix exact, type, secteur et département, achat cette année. */
function depuisBien(bien) {
  const dep = bien.departement ?? bien.secteur?.slice(0, 2)
  return {
    prix: Math.round(bien.prix),
    type: bien.type === 'house' ? 'house' : 'apartment',
    departement: dep in DEPARTEMENTS ? dep : PV_DEFAUT.departement,
    secteur: bien.secteur ?? null,
    achat: ANNEE_COURANTE,
  }
}

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

const parVolume = (a, b) => (b.n ?? 0) - (a.n ?? 0)
const variation = (serie) => serie[serie.length - 1].prix / serie[0].prix - 1

/** Plus-value : réservée aux utilisateurs connectés, comme le financement. */
export default function PlusValuePage() {
  usePageTitle('Plus-value')
  return (
    <RequireAuth
      title="Connectez-vous pour simuler votre plus-value"
      reason="La simulation de plus-value est réservée aux comptes : elle peut être rattachée au bien estimé dans votre historique."
    >
      <PlusValue />
    </RequireAuth>
  )
}

function PlusValue() {
  const prefill = usePrefill()
  // Une estimation de démonstration n'est reprise que si l'utilisateur le demande.
  const [prefillActif, setPrefillActif] = useState(Boolean(prefill && !prefill.demo))
  const [values, setValues] = useState(() => ({ ...PV_DEFAUT, ...(prefill && !prefill.demo ? depuisBien(prefill) : {}) }))
  const [choix, setChoix] = useState(1)

  // ── Marché : secteurs (commune, arrondissement) quand le serveur les fournit, sinon départements
  const secteursState = useSecteurs(values.type)
  const tendances = useAllTrends(values.type)
  const modeSecteur = secteursState.disponible

  const seriesDep = useMemo(() => {
    const out = {}
    for (const [dep, rows] of Object.entries(tendances.parDep)) out[dep] = syntheseAnnuelle(rows).map((a) => ({ annee: a.annee, prix: a.prix }))
    return out
  }, [tendances.parDep])

  const departements = modeSecteur
    ? [...new Set(secteursState.secteurs.map((s) => s.code.slice(0, 2)))].sort()
    : Object.keys(seriesDep).filter((d) => seriesDep[d].length >= 2).sort()

  const secteursDep = useMemo(
    () =>
      secteursState.secteurs
        .filter((s) => s.code.startsWith(values.departement))
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true })),
    [secteursState.secteurs, values.departement],
  )
  const secteur = modeSecteur
    ? secteursDep.find((s) => s.code === values.secteur) ?? [...secteursDep].sort(parVolume)[0] ?? null
    : null
  const serie = modeSecteur ? secteur?.serie : seriesDep[values.departement]
  const nomLieu = modeSecteur ? secteur?.nom : nomDepartement(values.departement)
  const marche = modeSecteur ? secteursState : tendances
  const pret = Boolean(serie && serie.length >= 2)

  // Années d'achat proposées : celles observées, plus l'année en cours (achat aujourd'hui).
  const annees = useMemo(() => {
    if (!serie) return [ANNEE_COURANTE]
    const obs = serie.map((s) => s.annee)
    return obs.includes(ANNEE_COURANTE) || ANNEE_COURANTE < obs[0] ? obs : [...obs, ANNEE_COURANTE]
  }, [serie])
  const achat = values.achat != null && annees.includes(values.achat) ? values.achat : annees[Math.max(0, annees.length - 3)]
  const vente = achat + values.horizon
  const derniereAnnee = serie?.[serie.length - 1]?.annee
  const observe = derniereAnnee != null && vente <= derniereAnnee

  // ── Frais d'acquisition : moteur de financement du serveur
  const frais = useAction((payload, signal) => getFinancingDossier(payload, { signal, timeout: 30000 }))
  const { run } = frais
  useEffect(() => {
    const t = setTimeout(() => run(payloadFrais(values.prix, values.departement)), 300)
    return () => clearTimeout(t)
  }, [values.prix, values.departement, run])
  const fraisAcquisition = frais.data?.plan_financement?.frais_acquisition ?? null

  // ── Scénarios, fiscalité (règles locales isolées), gain net et seuil
  const fr = values.agence ? HYPOTHESES_ACHAT_LOCATION.fraisRevente : 0
  const scenarios = useMemo(() => (pret ? calculerScenarios(serie) : null), [pret, serie])
  const bilan = useMemo(
    () => (revente) => {
      const cession = revente * (1 - fr)
      const impot = calculerImpotPlusValue({
        prixAchat: values.prix,
        prixVente: cession,
        anneesDetention: values.horizon,
        residencePrincipale: values.usage === 'rp',
        travaux: values.usage === 'inv' ? values.travaux : 0,
      })
      return { cession, impot, net: fraisAcquisition != null ? cession - values.prix - fraisAcquisition - impot.total : null }
    },
    [fr, values.prix, values.horizon, values.usage, values.travaux, fraisAcquisition],
  )

  const resultats = useMemo(() => {
    if (!scenarios) return null
    return scenarios.map((s) => {
      const revente = prixRevente(serie, values.prix, achat, vente, s.taux)
      return { ...s, revente, prixAchat: values.prix, ...bilan(revente) }
    })
  }, [scenarios, serie, values.prix, achat, vente, bilan])

  const seuil = useMemo(() => {
    if (!pret || observe || fraisAcquisition == null) return null
    const taux = seuilRentabilite((t) => bilan(prixRevente(serie, values.prix, achat, vente, t)).net)
    const minimum = Number.isFinite(taux) ? Math.ceil(prixRevente(serie, values.prix, achat, vente, taux) / 1000) * 1000 : null
    return { taux, minimum }
  }, [pret, observe, fraisAcquisition, bilan, serie, values.prix, achat, vente])

  const indice = useIndiceInsee(values.departement, values.type)

  // ── Simulation rattachée à l'estimation dans l'historique
  const r = resultats?.[choix]
  useSimulationHistorique(
    prefillActif ? prefill?.historiqueId : null,
    'plusvalue',
    r
      ? {
          secteur: nomLieu,
          prix: values.prix,
          annee_achat: achat,
          horizon: values.horizon,
          annee_revente: vente,
          usage: values.usage === 'rp' ? 'résidence principale' : 'investissement',
          scenario: ['bas', 'central', 'haut'][choix],
          taux_annuel: r.taux,
          revente: Math.round(r.revente),
          plus_value: Math.round(r.revente - values.prix),
          impot: r.impot.exonere ? 0 : Math.round(r.impot.total),
          net: r.net != null ? Math.round(r.net) : null,
        }
      : null,
  )

  // ── Résilience : secteurs les plus actifs du département, sinon départements
  const resilience = useMemo(() => {
    if (modeSecteur) {
      const actifs = [...secteursDep].sort(parVolume).slice(0, NB_SECTEURS_RESILIENCE)
      if (secteur && !actifs.includes(secteur)) actifs.push(secteur)
      return {
        titre: <>La résilience <em>des secteurs</em></>,
        aide: `Variation de la médiane au m² entre ${serie?.[0]?.annee ?? ''} et ${derniereAnnee ?? ''} · ${nomDepartement(values.departement)}, secteurs les plus actifs. Cliquez pour simuler.`,
        items: actifs.map((s) => ({ cle: s.code, label: s.nom, v: variation(s.serie) })),
        selection: secteur?.code,
        onSelect: (code) => setValues((v) => ({ ...v, secteur: code })),
      }
    }
    return {
      titre: <>La résilience <em>des départements</em></>,
      aide: `Variation du prix moyen au m² entre ${serie?.[0]?.annee ?? ''} et ${derniereAnnee ?? ''}. Cliquez sur un département pour le simuler.`,
      items: departements.map((d) => ({ cle: d, label: DEPARTEMENTS[d] ?? d, v: variation(seriesDep[d]) })),
      selection: values.departement,
      onSelect: (dep) => setValues((v) => ({ ...v, departement: dep, secteur: null })),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeSecteur, secteursDep, secteur, serie, derniereAnnee, values.departement, seriesDep])

  function basculerPrefill() {
    if (prefillActif) {
      setValues((v) => ({ ...v, prix: PV_DEFAUT.prix, departement: PV_DEFAUT.departement, secteur: null, achat: null }))
      setPrefillActif(false)
    } else if (prefill) {
      setValues((v) => ({ ...v, ...depuisBien(prefill) }))
      setPrefillActif(true)
    }
  }

  const contexte = { prix: values.prix, achat, vente, nomDep: nomLieu, derniereAnnee, observe, fraisRevente: values.agence }
  const periode = serie ? `${serie[0].annee}–${derniereAnnee}` : ''

  return (
    <PageContainer className="pt-4 sm:pt-6">
      <SimulationShell
        draw={heroPlusValue}
        eyebrow="Plus-value · fiscalité 2026"
        title={<>Anticiper <em>votre plus-value</em></>}
        lead="Trois scénarios tirés du marché observé et la fiscalité selon la durée de détention."
        aside={
          marche.loading || (secteursState.loading && !pret) ? (
            <ShellPill tone="loading">Chargement du marché…</ShellPill>
          ) : !pret && marche.error ? (
            <ShellPill tone="danger">Marché indisponible</ShellPill>
          ) : (
            <ShellPill tone="success">
              {modeSecteur ? 'Médianes par secteur' : 'Prix observés par département'} · ventes DVF {periode}
            </ShellPill>
          )
        }
      >
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <PlusValueForm
            values={{ ...values, achat, secteur: secteur?.code ?? values.secteur }}
            onChange={(v) => setValues(v)}
            annees={annees}
            departementsDisponibles={departements.length ? departements : Object.keys(DEPARTEMENTS)}
            secteurs={modeSecteur ? secteursDep : []}
            prefill={prefill}
            prefillActif={prefillActif}
            onTogglePrefill={basculerPrefill}
          />
          <PvSummary
            resultat={r}
            scenarioIndex={choix}
            contexte={contexte}
            frais={{ data: fraisAcquisition, loading: frais.loading, error: frais.error }}
            marche={{ ...marche, error: pret ? null : marche.error }}
          />
        </div>
      </SimulationShell>

      {!pret ? (
        marche.error ? null : (
          <div className="mt-10 grid gap-4" aria-hidden="true">
            <Skeleton className="h-28" rounded="rounded-[18px]" />
            <Skeleton className="h-80" rounded="rounded-[22px]" />
          </div>
        )
      ) : (
        <>
          <section className="mt-12 sm:mt-16" aria-labelledby="titre-scenarios">
            <div className="mb-5 px-1">
              <h2 id="titre-scenarios" className="ds-h2">Trois <em>scénarios</em> de marché</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Tirés des prix observés à {nomLieu} ; l’écart entre eux mesure l’incertitude. Choisissez celui à détailler.
              </p>
            </div>
            <ScenarioCards resultats={resultats} prix={values.prix} choix={choix} onChoix={setChoix} />
            <div className="mt-4">
              <FanChart
                serie={serie}
                scenarios={scenarios}
                achat={achat}
                vente={vente}
                nomDep={nomLieu}
                source={modeSecteur ? 'médiane annuelle des ventes de l’ancien' : 'prix moyen annuel observé (ventes DVF)'}
              />
            </div>
          </section>

          <section className="mt-12 sm:mt-16" aria-labelledby="titre-seuil">
            <div className="mb-5 px-1">
              <h2 id="titre-seuil" className="ds-h2">Ce que dit <em>l’historique</em></h2>
              <p className="mt-1 text-sm text-ink-muted">
                Quelques années de ventes ne suffisent pas pour juger d’une revente lointaine : l’indice Notaires-INSEE remonte aux années 1990.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <SeuilCard
                seuil={seuil?.taux}
                minimum={seuil ? seuil.minimum ?? (seuil.taux === -Infinity ? 0 : null) : null}
                scenarios={scenarios}
                horizonProjete={vente - Math.max(achat, derniereAnnee ?? achat)}
                indice={indice}
                dep={values.departement}
                typeBien={values.type}
                observe={observe}
              />
              <LoyerCard
                secteur={secteur}
                prix={values.prix}
                surfaceConnue={prefillActif && prefill?.surface && prefill?.type === values.type ? prefill.surface : null}
                horizon={values.horizon}
                residencePrincipale={values.usage === 'rp'}
              />
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
              <ImpositionCard resultat={r} horizon={values.horizon} />
              <AbattementsCard horizon={values.horizon} />
            </div>
          </section>

          <section className="mt-12 sm:mt-16">
            <ResilienceCard {...resilience} />
          </section>
        </>
      )}

      <section className="mt-12 grid gap-4 sm:mt-16 lg:grid-cols-2">
        <Card padding="lg" className="rounded-[22px]">
          <h3 className="ds-h3 mb-2">Pourquoi des <em>scénarios</em>, et pas une prédiction</h3>
          <p className="text-[13.5px] leading-relaxed text-ink-soft">
            Les prix observés couvrent {periode ? `les années ${periode.replace('–', ' à ')}` : 'quelques années'}, dont une baisse marquée :
            c’est trop court pour prévoir un marché, un modèle entraîné sur cette période ne ferait qu’extrapoler la tendance.
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
            On projette donc <b className="text-ink">trois trajectoires tirées du marché observé</b> du {modeSecteur ? 'secteur' : 'département'} :
            la tendance de la période, le rythme de la dernière année et la stabilité des prix.
          </p>
        </Card>
        <Card padding="lg" className="rounded-[22px]">
          <h3 className="ds-h3 mb-2">Ce que la simulation <em>ignore</em></h3>
          <p className="text-[13.5px] leading-relaxed text-ink-soft">
            L’inflation et les cas d’exonération particuliers (première cession, retraités…). Les frais de revente sont retenus à{' '}
            {pct(HYPOTHESES_ACHAT_LOCATION.fraisRevente, { digits: 0 })} du prix quand l’option est cochée.
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
        <span>Données : DVF — DGFiP / Etalab · Indices Notaires-INSEE · Loyers ANIL · Fiscalité : {REGLES_PLUS_VALUE.articles}</span>
        <span>Simulation indicative : ni conseil fiscal, ni conseil en investissement.</span>
      </footer>
    </PageContainer>
  )
}
