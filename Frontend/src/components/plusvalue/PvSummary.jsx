import { vignetteVilla } from '../../illustrations'
import { euro, pct } from '../../lib/format'
import { NOMS_SCENARIOS } from '../../lib/plusValue'
import DarkPanel, { Mesure } from '../simulation/DarkPanel'
import { Button, IconAlert, IconRefresh, Skeleton } from '../ui'

const signe = (n) => `${n >= 0 ? '+' : '−'} ${euro(Math.abs(n))}`

/**
 * Résultat du scénario sélectionné : plus-value brute, prix de revente,
 * impôt et gain net. Le gain net n'est affiché que si les frais
 * d'acquisition ont été calculés par le serveur.
 */
export default function PvSummary({ resultat, scenarioIndex, contexte, frais, marche }) {
  if (marche.error) {
    return (
      <DarkPanel draw={vignetteVilla} className="justify-center gap-4" role="alert">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white/15"><IconAlert size={22} /></span>
        <div>
          <p className="text-[18px] font-semibold">Données de marché indisponibles</p>
          <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-white/80">
            {marche.error.message} Les scénarios reposent sur les prix observés : aucune projection n’est affichée sans eux.
          </p>
        </div>
        <div><Button variant="secondary" size="sm" onClick={marche.reload} iconLeft={<IconRefresh size={15} />}>Réessayer</Button></div>
      </DarkPanel>
    )
  }
  if (!resultat) {
    return (
      <DarkPanel draw={vignetteVilla} className="justify-between gap-6" aria-busy="true">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-40 !bg-white/15" />
          <Skeleton className="h-16 w-64 !bg-white/15" />
          <Skeleton className="h-3 w-72 !bg-white/15" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[68px] !bg-white/10" rounded="rounded-[14px]" />)}
        </div>
      </DarkPanel>
    )
  }

  const r = resultat
  const pv = r.revente - contexte.prix
  const net = r.net

  return (
    <DarkPanel draw={vignetteVilla} className="justify-between gap-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
          Plus-value brute · {contexte.observe ? 'observée sur les ventes réelles' : NOMS_SCENARIOS[scenarioIndex].toLowerCase()}
        </p>
        <p
          className={`ds-num mt-1.5 whitespace-nowrap text-[clamp(2.25rem,13cqi,4rem)] font-semibold leading-none tracking-[-0.04em] [text-shadow:0_2px_24px_rgba(0,0,0,.25)] ${pv >= 0 ? 'text-[#BDF0D1]' : 'text-[#F8C2B6]'}`}
        >
          {signe(pv)}
        </p>
        <p className="mt-2.5 text-[13px] text-white/80">
          {contexte.nomDep} · achat {contexte.achat}, revente {contexte.vente} ·{' '}
          {contexte.observe ? 'médianes observées, aucune projection' : `${pct(r.taux, { digits: 2, signed: true })} par an au-delà de ${contexte.derniereAnnee}`}
        </p>
      </div>
      <div>
        <div className="grid grid-cols-3 gap-2 @max-sm:grid-cols-1">
          <Mesure value={euro(r.revente)} label="Prix de revente" />
          <Mesure value={r.impot.exonere ? 'Exonéré' : euro(r.impot.total)} label="Impôt sur la plus-value" />
          <Mesure
            value={net != null ? signe(net) : frais.loading ? '…' : 'Indisponible'}
            label="Gain net après frais et impôt"
            tone={net == null ? undefined : net >= 0 ? 'pos' : 'neg'}
          />
        </div>
        <p className="mt-3 text-[11.5px] text-white/65">
          {frais.data != null
            ? `Frais d’acquisition de ${euro(frais.data)}, calculés par le moteur de financement${contexte.fraisRevente ? ` ; frais de revente de ${euro(r.revente - r.cession)}` : ''}.`
            : frais.error
              ? 'Frais d’acquisition indisponibles : le gain net ne peut pas être calculé.'
              : 'Calcul des frais d’acquisition…'}
        </p>
      </div>
    </DarkPanel>
  )
}
