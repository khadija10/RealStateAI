import { Link } from 'react-router-dom'
import { APERCU_HACHURES, couleurPrix, PALIERS_PRIX } from '../../lib/carte'
import { cx } from '../../lib/cx'
import { euroM2, nb } from '../../lib/format'
import { nomDepartement } from '../../lib/geo'
import { MarketPositionBar } from '../estimation/visuals'
import { Button, IconClose, IconEstimate, IconTrend } from '../ui'

const ECART_LOYER = (l) => `${l.bas.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} – ${l.haut.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} €`

/**
 * Commune choisie sur la carte : prix médian, dispersion, volume, rang dans
 * son département, loyer de référence (ANIL) si le serveur le fournit.
 */
export function PanneauCommune({ commune, rang, nbDep, secteur, typeBien, onFermer }) {
  const s = commune.stats
  const loyer = secteur?.loyer
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="ds-eyebrow mb-1">{nomDepartement(commune.dep)} · {commune.dep}</p>
          <h3 className="ds-h3 break-words">{commune.nom}</h3>
        </div>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer la fiche de la commune"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-muted ring-1 ring-inset ring-line transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <IconClose size={15} />
        </button>
      </div>

      {s ? (
        <>
          <div>
            <p className="text-xs text-ink-muted">Prix médian {s.periode ? `· ${s.periode.replace('-', '–')}` : ''}</p>
            <p className="ds-num mt-1 flex items-center gap-2.5 text-[32px] font-semibold leading-none tracking-[-0.02em] text-ink">
              <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-[5px] ring-1 ring-line" style={{ background: couleurPrix(s.prix_m2_median) }} />
              {euroM2(s.prix_m2_median)}
            </p>
          </div>
          {s.prix_m2_q1 != null && s.prix_m2_q3 != null && (
            <div>
              <MarketPositionBar q1={s.prix_m2_q1} median={s.prix_m2_median} q3={s.prix_m2_q3} format={euroM2} />
              <p className="mt-1.5 text-xs text-ink-muted">La moitié des ventes entre le 1er et le 3e quartile.</p>
            </div>
          )}
          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-[14px] bg-surface-2 px-3.5 py-3 ring-1 ring-inset ring-line">
              <dd className="ds-num text-[19px] font-semibold leading-none text-ink">{nb(s.n_transactions)}</dd>
              <dt className="mt-1 text-[11.5px] text-ink-muted">ventes analysées</dt>
            </div>
            {rang != null && (
              <div className="rounded-[14px] bg-surface-2 px-3.5 py-3 ring-1 ring-inset ring-line">
                <dd className="ds-num text-[19px] font-semibold leading-none text-ink">
                  {rang}<sup className="text-[11px]">{rang === 1 ? 're' : 'e'}</sup> <span className="text-[13px] font-normal text-ink-muted">sur {nb(nbDep)}</span>
                </dd>
                <dt className="mt-1 text-[11.5px] text-ink-muted">plus chère du département</dt>
              </div>
            )}
          </dl>
          {loyer && (
            <div className="rounded-[14px] bg-accent-soft/50 px-3.5 py-3 ring-1 ring-inset ring-accent/15">
              <p className="text-[11.5px] text-ink-muted">Loyer de référence ({typeBien === 'house' ? 'maison' : 'appartement'})</p>
              <p className="ds-num mt-0.5 text-[17px] font-semibold text-ink">
                {loyer.m2.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} €/m² <span className="text-[13px] font-normal text-ink-muted">par mois</span>
              </p>
              <p className="mt-0.5 text-[11.5px] text-ink-muted">De {ECART_LOYER(loyer)} · carte des loyers ANIL, charges comprises</p>
            </div>
          )}
        </>
      ) : (
        <p className="rounded-[14px] bg-surface-2 px-3.5 py-3 text-sm text-ink-soft ring-1 ring-inset ring-line">
          Moins de 5 ventes de ce type : pas de prix médian fiable pour cette commune.
        </p>
      )}

      <div className="mt-1 flex flex-col gap-2">
        <Button
          as={Link}
          to={`/estimation?commune=${encodeURIComponent(s?.nom_commune ?? commune.nom)}&type=${typeBien}`}
          iconLeft={<IconEstimate size={16} />}
        >
          Estimer un bien ici
        </Button>
        <Button as={Link} to={`/marche/tendances?dep=${commune.dep}`} variant="secondary" iconLeft={<IconTrend size={16} />}>
          Tendance du département
        </Button>
      </div>
    </div>
  )
}

/** Légende des classes de prix, posée sur la carte. */
export function LegendePrix({ couverture, className }) {
  return (
    <div className={cx('rounded-[14px] bg-surface/92 px-3 py-2.5 shadow-sm ring-1 ring-line backdrop-blur-sm', className)}>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-soft">Prix médian au m²</p>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11.5px] text-ink-soft">
        {PALIERS_PRIX.map((p) => (
          <li key={p.libelle} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 w-3 rounded-[3px] ring-1 ring-line" style={{ background: p.couleur }} />
            {p.libelle}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-3 rounded-[3px] ring-1 ring-line" style={{ background: APERCU_HACHURES }} />
          Moins de 5 ventes
        </li>
      </ul>
      {couverture != null && <p className="mt-1.5 text-[11px] text-ink-muted">{couverture} % des communes ont un prix</p>}
    </div>
  )
}

