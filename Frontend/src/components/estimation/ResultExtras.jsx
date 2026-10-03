import { useHealth } from '../../context/HealthContext'
import { cx } from '../../lib/cx'
import { euro, euroM2, nb, pct, pctPoints } from '../../lib/format'
import { Badge, Card, IconAlert, IconInfo } from '../ui'
import GraphiqueImmeuble from './GraphiqueImmeuble'
import { MarketPositionBar } from './visuals'

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
 * L'immeuble a été identifié et ses ventes cherchées, sans résultat : on le
 * dit plutôt que de masquer le bloc. Rien n'est affiché si la recherche n'a
 * pas eu lieu (adresse sans numéro, mode démonstration, ancienne version).
 */
function AucuneVenteImmeuble({ r, values }) {
  if (!r.comparablesRecherches || r.method !== 'ml' || r.isDemo || r.adresseSansNumero) return null
  const type = values?.type === 'house' ? 'de maison' : 'd’appartement'
  return (
    <Card className="flex items-start gap-3 rounded-[22px]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-muted ring-1 ring-inset ring-line">
        <IconInfo size={17} />
      </span>
      <div className="min-w-0">
        <p className="ds-eyebrow mb-1">Ventes dans l’immeuble</p>
        <p className="text-sm text-ink-soft">
          Aucune vente {type} retrouvée dans cet immeuble parmi les ventes notariées (DVF). L’estimation s’appuie
          alors sur les ventes du secteur.
        </p>
      </div>
    </Card>
  )
}

/**
 * Ventes de l'immeuble (comparables renvoyés par le serveur), avec leur prix
 * ramené au marché de la dernière année, et la médiane appliquée au bien.
 */
export function ComparablesCard({ r, values }) {
  const ventes = r.comparables
  if (!ventes.length) return <AucuneVenteImmeuble r={r} values={values} />
  const ref = r.immeubleReference
  const anneeRef = ref?.annee ?? ventes.find((v) => v.annee_reference)?.annee_reference
  const ecart = ref?.valeur && r.price ? r.price / ref.valeur - 1 : null

  // Synthèse, uniquement à partir des ventes renvoyées par le serveur.
  const annees = ventes.map((v) => new Date(v.date).getFullYear()).filter(Number.isFinite)
  const debut = Math.min(...annees)
  const fin = Math.max(...annees)
  const reventes = ventes.filter((v) => !v.vefa && v.prix_m2_aujourdhui != null).map((v) => v.prix_m2_aujourdhui)
  const bas = reventes.length ? Math.min(...reventes) : null
  const haut = reventes.length ? Math.max(...reventes) : null
  // Immeuble face au secteur : deux médianes de la même année, même type de bien, hors neuf.
  const secteur = r.secteur
  const ecartQuartier = ref && secteur?.med && ref.annee === secteur.annee ? ref.prix_m2 / secteur.med - 1 : null
  const valeurBien = r.isDemo ? null : r.pricePerM2
  const sousLeBien = valeurBien != null ? reventes.filter((v) => v < valeurBien).length : null

  const syntheses = [
    {
      v: `${nb(ventes.length)} vente${ventes.length > 1 ? 's' : ''}`,
      l: debut === fin ? `en ${debut}` : `de ${debut} à ${fin}${ventes.some((v) => v.vefa) ? ', neuf compris' : ''}`,
    },
    bas != null && {
      v: bas === haut ? euroM2(bas) : `${nb(bas)} – ${euroM2(haut)}`,
      l: `prix au m² actualisé ${anneeRef ?? ''}, hors neuf`,
    },
    ecartQuartier != null && {
      v: pct(ecartQuartier, { digits: 0, signed: true }),
      l: `médiane de l’immeuble face à ${secteur.nom ?? 'son secteur'} (${secteur.annee})`,
    },
  ].filter(Boolean)

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

      {/* Synthèse en chiffres */}
      <dl className={cx('mb-5 grid gap-2', syntheses.length === 3 ? 'sm:grid-cols-3' : syntheses.length === 2 ? 'sm:grid-cols-2' : '')}>
        {syntheses.map((s) => (
          <div key={s.l} className="flex flex-col-reverse justify-end rounded-[14px] bg-surface-2 px-4 py-3 ring-1 ring-inset ring-line">
            <dt className="mt-1 text-[12px] leading-snug text-ink-muted">{s.l}</dt>
            <dd className="ds-num text-[20px] font-semibold leading-none tracking-[-0.02em] text-ink">{s.v}</dd>
          </div>
        ))}
      </dl>

      {/* Les ventes dans le temps, et le bien parmi elles */}
      <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0">
          <p className="mb-2 text-[13px] font-medium text-ink-soft">L’immeuble face à son quartier</p>
          <GraphiqueImmeuble ventes={ventes} serie={secteur?.serie ?? []} nomSecteur={secteur?.nom} />
        </div>
        {ref && reventes.length >= 2 && valeurBien != null && (
          <div className="min-w-0 rounded-[16px] bg-accent-soft/40 p-4 ring-1 ring-inset ring-accent/15">
            <p className="mb-1 text-[13px] font-medium text-ink-soft">Votre bien parmi ces ventes</p>
            <MarketPositionBar
              q1={bas}
              median={ref.prix_m2}
              q3={haut}
              value={valeurBien}
              format={euroM2}
              labels={['La moins chère', 'Médiane', 'La plus chère']}
            />
            <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
              À <b className="ds-num text-ink">{euroM2(valeurBien)}</b>, notre estimation est{' '}
              {sousLeBien === 0 ? (
                <>en dessous des <b className="text-ink">{reventes.length}</b> reventes</>
              ) : sousLeBien === reventes.length ? (
                <>au-dessus des <b className="text-ink">{reventes.length}</b> reventes</>
              ) : (
                <>
                  au-dessus de <b className="text-ink">{sousLeBien}</b> revente{sousLeBien > 1 ? 's' : ''} sur{' '}
                  <b className="text-ink">{reventes.length}</b>
                </>
              )}{' '}
              de l’immeuble (prix actualisés {anneeRef}).
            </p>
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
