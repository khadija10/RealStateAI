import { useEffect, useMemo, useState } from 'react'
import { getFinancingDossier, getFinancingRates } from '../api/client'
import AgentChat from '../components/financement/AgentChat'
import { AcheterLouerCard, AidesCard, ResumeDossier } from '../components/financement/FinancementExtras'
import RequireAuth from '../components/layout/RequireAuth'
import {
  BudgetCard,
  EndettementCard,
  FraisCard,
  PlanCard,
  SoliditeCard,
} from '../components/financement/DossierAnalyse'
import DossierSummary from '../components/financement/DossierSummary'
import FinancementForm from '../components/financement/FinancementForm'
import PiecesCard from '../components/financement/PiecesCard'
import { PageContainer } from '../components/layout/PageHeader'
import SimulationShell, { ShellPill } from '../components/simulation/SimulationShell'
import { Card, ErrorState, Skeleton } from '../components/ui'
import { useAction, useApi } from '../hooks/useApi'
import { usePageTitle } from '../hooks/usePageTitle'
import { usePrefill } from '../hooks/usePrefill'
import { useSimulationHistorique } from '../hooks/useSimulationHistorique'
import { heroFinancement } from '../illustrations'
import { construirePayloadFinancement, FIN_DEFAUT } from '../lib/financement'
import { dateLongue } from '../lib/format'
import { DEPARTEMENTS } from '../lib/geo'

/** Valeurs de départ, avec le bien de l'estimation quand il est disponible. */
function valeursInitiales(bien) {
  if (!bien) return FIN_DEFAUT
  return {
    ...FIN_DEFAUT,
    prix: Math.round(bien.prix),
    departement: bien.departement in DEPARTEMENTS ? bien.departement : FIN_DEFAUT.departement,
  }
}

function Section({ titre, aide, children }) {
  return (
    <section className="mt-12 sm:mt-16">
      <div className="mb-5 px-1">
        <h2 className="ds-h2">{titre}</h2>
        {aide && <p className="mt-1 text-sm text-ink-muted">{aide}</p>}
      </div>
      {children}
    </section>
  )
}

/** Financement : réservé aux utilisateurs connectés, comme le reste du parcours. */
export default function FinancementPage() {
  usePageTitle('Financement')
  return (
    <RequireAuth
      title="Connectez-vous pour simuler votre financement"
      reason="La simulation de financement est réservée aux comptes : elle peut être rattachée au bien estimé dans votre historique."
    >
      <Financement />
    </RequireAuth>
  )
}

function Financement() {
  const prefill = usePrefill()
  // Une estimation de démonstration n'est reprise que si l'utilisateur le demande.
  const [prefillActif, setPrefillActif] = useState(Boolean(prefill && !prefill.demo))
  const [values, setValues] = useState(() => valeursInitiales(prefill && !prefill.demo ? prefill : null))

  const rates = useApi((signal) => getFinancingRates({ signal }), [])
  const dossier = useAction((payload, signal) => getFinancingDossier(payload, { signal, timeout: 30000 }))
  const durees = useMemo(() => {
    const cles = Object.keys(rates.data?.taux_par_duree ?? {}).map(Number).filter(Number.isFinite).sort((a, b) => a - b)
    return cles.length ? cles : [15, 20, 25]
  }, [rates.data])

  // Chaque réglage relance le calcul serveur (léger délai pour ne pas appeler
  // l'API à chaque pixel de curseur). La réponse précédente est annulée.
  const payload = useMemo(() => construirePayloadFinancement(values), [values])
  const cle = JSON.stringify(payload)
  const { run } = dossier
  useEffect(() => {
    const t = setTimeout(() => run(JSON.parse(cle)), 280)
    return () => clearTimeout(t)
  }, [cle, run])

  function basculerPrefill() {
    if (prefillActif) {
      setValues((v) => ({ ...v, prix: FIN_DEFAUT.prix, departement: FIN_DEFAUT.departement }))
      setPrefillActif(false)
    } else {
      setValues((v) => ({ ...v, ...valeursInitiales(prefill), ...pick(v) }))
      setPrefillActif(true)
    }
  }

  const d = dossier.data

  // Simulation rattachée à l'estimation du bien dans l'historique (si elle vient d'une estimation).
  useSimulationHistorique(
    prefillActif ? prefill?.historiqueId : null,
    'financement',
    d
      ? {
          prix: values.prix,
          apport: values.apport,
          revenus: values.revenus,
          duree: d.credit?.duree_annees ?? values.duree,
          departement: values.departement,
          verdict: d.synthese?.decision_indicative ?? null,
          conforme_hcsf: Boolean(d.conformite_hcsf?.conforme_hcsf),
          taux_endettement: d.conformite_hcsf?.criteres?.taux_endettement?.valeur ?? null,
          mensualite: Math.round(d.credit?.mensualite_totale ?? 0),
          taux: d.credit?.taux_nominal_retenu ?? null,
          montant_emprunte: Math.round(d.plan_financement?.montant_emprunte ?? 0),
          score: Math.round(d.score_dossier?.score_sur_100 ?? 0),
        }
      : null,
  )
  const millesime = rates.data?.millesime ?? d?.meta?.base_reglementaire?.millesime_baremes

  return (
    <PageContainer className="pt-4 sm:pt-6">
      <SimulationShell
        draw={heroFinancement}
        eyebrow="Financement · normes HCSF"
        title={<>Financer <em>votre projet</em></>}
        lead="Mensualité, plan de financement et dossier de prêt, calculés par le moteur du serveur."
        aside={
          rates.loading ? (
            <ShellPill tone="loading">Chargement du barème…</ShellPill>
          ) : rates.error ? (
            <ShellPill tone="danger">Barème indisponible</ShellPill>
          ) : (
            <ShellPill tone="success">
              Barème {millesime}
              {rates.data?.derniere_verification ? ` · taux vérifiés le ${dateLongue(rates.data.derniere_verification)}` : ''}
            </ShellPill>
          )
        }
      >
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <FinancementForm
            values={values}
            onChange={setValues}
            durees={durees}
            prefill={prefill}
            prefillActif={prefillActif}
            onTogglePrefill={basculerPrefill}
          />
          <DossierSummary dossier={d} loading={dossier.loading} error={dossier.error} onRetry={() => run(payload)} />
        </div>
      </SimulationShell>

      {dossier.error ? (
        <div className="mt-10">
          <ErrorState
            title="Analyse du dossier indisponible"
            error="Le détail (critères HCSF, plan de financement, frais, score, budget, pièces) s’affichera dès que le serveur aura calculé votre dossier."
            onRetry={() => run(payload)}
          />
        </div>
      ) : !d ? (
        <div className="mt-12 grid gap-4 lg:grid-cols-3" aria-hidden="true">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-72" rounded="rounded-[22px]" />)}
        </div>
      ) : (
        <>
          <Section titre={<>Analyse <em>du dossier</em></>} aide="Critères réglementaires, plan de financement et frais, tels que calculés par le moteur.">
            <div className="grid gap-4 lg:grid-cols-3">
              <EndettementCard dossier={d} />
              <PlanCard dossier={d} />
              <FraisCard dossier={d} />
            </div>
          </Section>

          <Section titre={<>Solidité <em>du dossier</em></>} aide="Score, leviers chiffrés et points relevés automatiquement.">
            <SoliditeCard dossier={d} />
          </Section>

          <div className="mt-4">
            <BudgetCard dossier={d} />
          </div>

          <Section titre={<>Acheter <em>ou louer</em> ?</>} aide="Comparaison à budget égal, avec les montants du crédit calculés par le serveur.">
            <div className={values.primo ? 'grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]' : ''}>
              <AcheterLouerCard dossier={d} values={values} />
              <AidesCard values={values} />
            </div>
          </Section>
        </>
      )}

      <Section titre={<>Préparer <em>le dossier de prêt</em></>}>
        <div className="grid gap-4 lg:grid-cols-2">
          <AgentChat />
          {d ? (
            <div className="flex flex-col">
              <PiecesCard key={d.pieces_justificatives?.situation} dossier={d} />
              <ResumeDossier payload={payload} />
            </div>
          ) : (
            <Card padding="lg" className="rounded-[22px]">
              <p className="text-sm text-ink-muted">La liste des pièces justificatives dépend de votre profil : elle s’affiche une fois le dossier calculé.</p>
            </Card>
          )}
        </div>
      </Section>

      <footer className="mt-12 border-t border-line pt-6 text-xs leading-relaxed text-ink-muted">
        {d?.meta?.avertissement ?? 'Simulation indicative : ni conseil en financement, ni offre de prêt.'}
        {d?.meta?.base_reglementaire && (
          <span className="mt-1 block">
            Base réglementaire : endettement maximal {Math.round(d.meta.base_reglementaire.taux_endettement_max * 100)} %, durée maximale{' '}
            {d.meta.base_reglementaire.duree_max_annees} ans · barèmes {d.meta.base_reglementaire.millesime_baremes}.
          </span>
        )}
      </footer>
    </PageContainer>
  )
}

/** Champs du profil conservés quand on reprend le bien de l'estimation. */
function pick(v) {
  const { prix: _p, departement: _d, ...reste } = v
  return reste
}
