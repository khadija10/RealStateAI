import { vignetteInterieur } from '../../illustrations'
import { tonVerdict } from '../../lib/financement'
import { euro, nb, pct } from '../../lib/format'
import DarkPanel, { Mesure, VerdictPill } from '../simulation/DarkPanel'
import { Button, IconAlert, IconRefresh, Skeleton, Spinner } from '../ui'

const majuscule = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/**
 * Synthèse du dossier calculé par le backend : verdict HCSF, mensualité,
 * montant emprunté, endettement, score. En cas d'erreur, aucun montant.
 */
export default function DossierSummary({ dossier, loading, error, onRetry }) {
  if (error) {
    return (
      <DarkPanel draw={vignetteInterieur} className="justify-center gap-4" role="alert">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white/15">
          <IconAlert size={22} />
        </span>
        <div>
          <p className="text-[18px] font-semibold">Le moteur de financement est indisponible</p>
          <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-white/80">
            {error.message} Aucun résultat n’est affiché tant que le serveur n’a pas calculé votre dossier.
          </p>
        </div>
        <div>
          <Button variant="secondary" size="sm" onClick={onRetry} iconLeft={<IconRefresh size={15} />}>Réessayer</Button>
        </div>
      </DarkPanel>
    )
  }

  if (!dossier) {
    return (
      <DarkPanel draw={vignetteInterieur} className="justify-between gap-6" aria-busy="true">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-56 !bg-white/15" rounded="rounded-full" />
          <Skeleton className="mt-4 h-3 w-32 !bg-white/15" />
          <Skeleton className="h-16 w-64 !bg-white/15" />
          <Skeleton className="h-3 w-72 !bg-white/15" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[68px] !bg-white/10" rounded="rounded-[14px]" />)}
        </div>
        <p className="sr-only" role="status">Calcul du dossier en cours…</p>
      </DarkPanel>
    )
  }

  const c = dossier.credit ?? {}
  const plan = dossier.plan_financement ?? {}
  const endett = dossier.conformite_hcsf?.criteres?.taux_endettement
  const score = dossier.score_dossier
  const ton = tonVerdict(dossier)

  return (
    <DarkPanel draw={vignetteInterieur} className="justify-between gap-6" aria-busy={loading || undefined}>
      <div>
        <div className="flex items-start justify-between gap-3">
          <VerdictPill tone={ton}>{majuscule(dossier.synthese?.decision_indicative) ?? (ton === 'success' ? 'Conforme HCSF' : 'Hors normes HCSF')}</VerdictPill>
          {loading && (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-white/70" role="status">
              <Spinner size={13} /> Mise à jour…
            </span>
          )}
        </div>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Mensualité totale</p>
        <p className="ds-num mt-1.5 whitespace-nowrap text-[clamp(2.25rem,13cqi,4rem)] font-semibold leading-none tracking-[-0.04em] [text-shadow:0_2px_24px_rgba(0,0,0,.25)]">
          {euro(c.mensualite_totale)}
          <span className="ml-1.5 text-[0.36em] font-medium tracking-normal text-white/75">/ mois</span>
        </p>
        <p className="mt-2.5 text-[13px] text-white/80">
          {c.duree_annees} ans · taux nominal {pct(c.taux_nominal_retenu, { digits: 2 })} · dont assurance{' '}
          {euro(c.mensualite_assurance)} / mois
        </p>
      </div>

      <div>
        <div className="grid grid-cols-3 gap-2 @max-sm:grid-cols-1">
          <Mesure value={euro(plan.montant_emprunte)} label="Montant emprunté" />
          <Mesure
            value={pct(endett?.valeur)}
            label={`Taux d’endettement (max ${pct(endett?.plafond, { digits: 0 })})`}
            tone={endett?.conforme === false ? 'neg' : 'pos'}
          />
          <Mesure value={`${nb(score?.score_sur_100)} / 100`} label={majuscule(score?.appreciation) ?? 'Score du dossier'} />
        </div>
        <p className="mt-3 text-[11.5px] text-white/65">
          Coût du crédit {euro(c.cout_total_credit)} · total remboursé {euro(c.montant_total_rembourse)}
        </p>
      </div>
    </DarkPanel>
  )
}
