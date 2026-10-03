import { useHealth } from '../../context/HealthContext'
import { cx } from '../../lib/cx'
import { euro, euroM2, nb, pct, pctPoints } from '../../lib/format'
import { Badge, Card, IconAlert, IconInfo } from '../ui'

const moisAn = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' })
const dateCourte = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : moisAn.format(d)
}

function Alerte({ ton = 'warning', titre, children }) {
  const styles = {
    warning: 'bg-warning-soft ring-warning/25 text-warning',
    danger: 'bg-danger-soft ring-danger/25 text-danger',
    neutral: 'bg-surface-2 ring-line text-ink-muted',
  }[ton]
  return (
    <li className={cx('flex gap-2.5 rounded-[14px] px-3.5 py-2.5 ring-1 ring-inset', styles)}>
      {ton === 'neutral' ? <IconInfo size={16} className="mt-0.5 shrink-0" /> : <IconAlert size={16} className="mt-0.5 shrink-0" />}
      <p className="text-[13px] leading-relaxed text-ink-soft">
        {titre && <b className="font-semibold text-ink">{titre} </b>}
        {children}
      </p>
    </li>
  )
}

/**
 * Alertes renvoyées par le serveur sur cette estimation : type de bien
 * incohérent, adresse sans numéro, segments où le modèle se trompe plus,
 * passoire thermique. Rien n'est affiché s'il n'y a rien à signaler.
 */
export function ResultAlerts({ r }) {
  const { health } = useHealth()
  const moyenne = health?.model?.validation?.mape ?? health?.model?.mape
  const ml = r.method === 'ml'
  const dpe = r.dpeClasse
  const items = []

  if (r.alerteType) {
    items.push(<Alerte key="type" ton="danger" titre="Type de bien à vérifier.">{r.alerteType}</Alerte>)
  }
  if (ml && r.adresseSansNumero) {
    items.push(
      <Alerte key="numero" titre="Adresse sans numéro.">
        L’immeuble n’a pas pu être identifié : ni ses ventes, ni son DPE, ni ses caractéristiques ne sont pris en
        compte. Indiquez le numéro pour une estimation plus précise.
      </Alerte>,
    )
  }
  if (ml && r.segmentsDifficiles.length) {
    items.push(
      <Alerte key="segments" titre="Bien dans un segment plus difficile pour le modèle.">
        Erreur moyenne mesurée sur les ventes de test :{' '}
        {r.segmentsDifficiles.map((s, i) => (
          <span key={s.segment ?? i}>
            {i > 0 && ' ; '}
            {s.libelle}, <b className="text-ink">{pctPoints(s.mape)}</b>
          </span>
        ))}
        {moyenne != null && <>, contre {pctPoints(moyenne)} sur l’ensemble</>}. Appuyez le prix sur les ventes de
        l’immeuble et une visite.
      </Alerte>,
    )
  }
  if (dpe === 'F' || dpe === 'G') {
    items.push(
      <Alerte key="passoire" ton="danger" titre={`Passoire thermique (classe ${dpe}).`}>
        Depuis la loi Climat et Résilience, les logements F et G se vendent avec une décote et leur mise en location
        est interdite {dpe === 'G' ? 'depuis 2025' : 'à partir de 2028'}.
      </Alerte>,
    )
  }
  if (!items.length) return null
  return <ul className="flex flex-col gap-2" aria-label="Points d’attention sur cette estimation">{items}</ul>
}

/**
 * Ventes de l'immeuble (comparables renvoyés par le serveur), avec leur prix
 * ramené au marché de la dernière année, et la médiane appliquée au bien.
 */
export function ComparablesCard({ r }) {
  const ventes = r.comparables
  if (!ventes.length) return null
  const ref = r.immeubleReference
  const anneeRef = ref?.annee ?? ventes.find((v) => v.annee_reference)?.annee_reference
  const ecart = ref?.valeur && r.price ? r.price / ref.valeur - 1 : null
  return (
    <Card padding="lg" className="rounded-[22px]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="ds-eyebrow mb-1.5">Ventes dans l’immeuble</p>
          <h3 className="ds-h3">Ce qui s’est vendu <em>à cette adresse</em></h3>
          <p className="mt-1 text-sm text-ink-muted">Dernières ventes notariées (DVF) de l’immeuble, ramenées au marché {anneeRef ?? 'actuel'} du secteur.</p>
        </div>
        {ref && (
          <div className="rounded-[14px] bg-accent-soft/60 px-4 py-2.5 text-right ring-1 ring-inset ring-accent/20">
            <p className="text-[11.5px] text-ink-muted">Médiane de l’immeuble</p>
            <p className="ds-num text-[20px] font-semibold tracking-[-0.02em] text-ink">{euroM2(ref.prix_m2)}</p>
            <p className="text-[12px] text-ink-soft">soit ≈ <b className="ds-num">{euro(ref.valeur)}</b> pour ce bien</p>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.08em] text-ink-muted">
              <th className="py-2 pr-3 font-medium">Vente</th>
              <th className="py-2 pr-3 text-right font-medium">Surface</th>
              <th className="py-2 pr-3 text-right font-medium">Pièces</th>
              <th className="py-2 pr-3 text-right font-medium">Prix</th>
              <th className="py-2 pr-3 text-right font-medium">€/m²</th>
              <th className="py-2 text-right font-medium">€/m² au marché {anneeRef ?? ''}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ventes.map((v, i) => (
              <tr key={`${v.date}-${i}`} className={cx(v.vefa && 'text-ink-muted')}>
                <td className="py-2 pr-3">
                  {dateCourte(v.date)}
                  {v.vefa && (
                    <span className="ml-2" title="Vente sur plan (VEFA) : prix du neuf, écarté de la médiane"><Badge size="sm">neuf, sur plan</Badge></span>
                  )}
                </td>
                <td className="ds-num py-2 pr-3 text-right">{nb(v.surface_m2)} m²</td>
                <td className="ds-num py-2 pr-3 text-right">{v.nb_pieces ? nb(v.nb_pieces) : '—'}</td>
                <td className="ds-num py-2 pr-3 text-right">{euro(v.prix)}</td>
                <td className="ds-num py-2 pr-3 text-right">{euroM2(v.prix_m2)}</td>
                <td className="ds-num py-2 text-right font-semibold text-ink">{v.prix_m2_aujourdhui != null ? euroM2(v.prix_m2_aujourdhui) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ref && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
          Chaque vente est ramenée au marché {ref.annee} avec l’évolution des prix du secteur.
          {ref.n_vefa ? ' Les ventes sur plan (neuf) sont écartées : leur prix inclut la prime au neuf, qui disparaît à la revente.' : ''}{' '}
          {ecart != null &&
            (Math.abs(ecart) <= 0.05
              ? 'Notre estimation est au même niveau que cette médiane.'
              : `Notre estimation est ${pct(Math.abs(ecart), { digits: 0 })} ${ecart > 0 ? 'au-dessus' : 'en dessous'} : elle tient compte aussi du secteur, du DPE et de l’année de construction.`)}{' '}
          Une vente isolée peut s’écarter du marché (étage, état, travaux) : les données publiques ne le précisent pas.
        </p>
      )}
    </Card>
  )
}
