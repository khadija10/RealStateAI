import { useMemo, useState } from 'react'
import { useIndiceInsee } from '../../hooks/useMarketData'
import { cx } from '../../lib/cx'
import { euroM2, nb, pct } from '../../lib/format'
import { DEPARTEMENTS } from '../../lib/geo'
import { COULEURS_DEPARTEMENTS, DEPARTEMENTS_COURTS, lisser, trimestres } from '../../lib/marche'
import { MOIS_COURTS, syntheseAnnuelle, variationDouzeMois } from '../../lib/tendance'
import LineChart from '../charts/LineChart'
import { Card, ErrorState, Select, Skeleton } from '../ui'

const kEuros = (v, complet) => (complet ? euroM2(v) : `${(v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k€`)
const moisLib = (r) => `${MOIS_COURTS[r.mois - 1]} ${r.annee}`

/** Variation en pastille : vert en hausse, rouge en baisse. */
function Variation({ v, className }) {
  if (v == null) return null
  return (
    <span className={cx('ds-num inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[11.5px] font-semibold', v >= 0 ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger', className)}>
      <span aria-hidden="true">{v >= 0 ? '↗' : '↘'}</span>
      {pct(v, { signed: true })}
    </span>
  )
}

/** Choix des départements comparés (au moins un), chacun avec sa couleur. */
export function SelecteurDepartements({ actifs, onToggle }) {
  return (
    <div role="group" aria-label="Départements comparés" className="flex flex-wrap gap-2">
      {Object.entries(DEPARTEMENTS_COURTS).map(([code, nom]) => {
        const actif = actifs.includes(code)
        return (
          <button
            key={code}
            type="button"
            aria-pressed={actif}
            onClick={() => onToggle(code)}
            className={cx(
              'inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium ring-1 ring-inset transition-colors',
              actif ? 'bg-surface text-ink ring-line-strong shadow-xs' : 'text-ink-muted ring-line hover:text-ink',
            )}
          >
            <span aria-hidden="true" className={cx('h-2.5 w-2.5 rounded-full', !actif && 'opacity-35')} style={{ background: COULEURS_DEPARTEMENTS[code] }} />
            {code} · {nom}
          </button>
        )
      })}
    </div>
  )
}

/** Séries lissées par département, triées par mois. */
function useSeries(parDep, actifs) {
  return useMemo(
    () => [...actifs].sort().map((code) => {
      const bruts = parDep[code] ?? []
      return { code, nom: DEPARTEMENTS[code] ?? code, couleur: COULEURS_DEPARTEMENTS[code], bruts, lisses: lisser(bruts) }
    }),
    [parDep, actifs],
  )
}

/** Dernier prix (moyenne sur 3 mois), variation sur 12 mois et ventes des 12 derniers mois, par département. */
export function CartesDepartement({ parDep, actifs }) {
  const series = useSeries(parDep, actifs)
  return (
    <div className="grid grid-cols-2 gap-3 sm:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]" style={{ '--n': Math.min(4, series.length) }}>
      {series.map((s) => {
        const dernier = s.lisses.at(-1)
        const ventes = s.bruts.slice(-12).reduce((t, r) => t + (r.n_transactions || 0), 0)
        return (
          <Card key={s.code} padding="sm" className="rounded-[18px]">
            <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-soft">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: s.couleur }} />
              <span className="truncate">{s.nom}</span>
            </p>
            {dernier ? (
              <>
                <p className="ds-num mt-2 text-[24px] font-semibold leading-none tracking-[-0.02em] text-ink">{euroM2(dernier.prix_m2_median)}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-muted">
                  <Variation v={variationDouzeMois(s.lisses)} /> sur 12 mois
                </p>
                <p className="mt-1 text-[11.5px] text-ink-muted">
                  <b className="ds-num font-semibold text-ink-soft">{nb(ventes)}</b> ventes en 12 mois · {moisLib(dernier)}
                </p>
              </>
            ) : (
              <p className="mt-2 text-[13px] text-ink-muted">Pas assez de ventes pour ce marché.</p>
            )}
          </Card>
        )
      })}
    </div>
  )
}

/** Évolution mensuelle (moyenne glissante sur 3 mois) sur une échelle commune. */
export function GraphiqueTendances({ parDep, actifs }) {
  const series = useSeries(parDep, actifs)
  const donnees = useMemo(() => {
    const index = [...new Set(series.flatMap((s) => s.lisses.map((r) => r.mois_index)))].sort((a, b) => a - b)
    if (index.length < 2) return null
    const parIndex = new Map(series.flatMap((s) => s.lisses).map((r) => [r.mois_index, r]))
    const labels = index.map((i) => moisLib(parIndex.get(i)))
    const xTicks = index.map((i, k) => (parIndex.get(i).mois === 1 ? k : null)).filter((k) => k != null)
    return {
      labels,
      xTicks,
      annees: index.map((i) => parIndex.get(i).annee),
      series: series.map((s) => {
        const m = new Map(s.lisses.map((r) => [r.mois_index, r.prix_m2_median]))
        return { id: s.code, label: s.nom, color: s.couleur, values: index.map((i) => m.get(i) ?? NaN) }
      }),
    }
  }, [series])

  if (!donnees) return <p className="py-10 text-center text-sm text-ink-muted">Pas assez de mois de ventes pour tracer l’évolution.</p>
  return (
    <div>
      <LineChart
        labels={donnees.labels}
        xTicks={donnees.xTicks}
        xTickLabel={(i) => String(donnees.annees[i])}
        series={donnees.series}
        formatY={kEuros}
        height={230}
        strokeWidth={2.25}
        ariaLabel={`Prix médian au m², moyenne sur 3 mois, de ${donnees.labels[0]} à ${donnees.labels.at(-1)} : ${donnees.series.map((s) => s.label).join(', ')}.`}
      />
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-soft">
        {donnees.series.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-0.5 w-4 rounded" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Prix moyen par année (médianes mensuelles pondérées par les ventes), par département. */
export function SyntheseAnnuelle({ parDep, actifs }) {
  const lignes = [...actifs].sort().map((code) => ({ code, nom: DEPARTEMENTS[code] ?? code, annees: syntheseAnnuelle(parDep[code] ?? []) }))
  const annees = [...new Set(lignes.flatMap((l) => l.annees.map((a) => a.annee)))].sort((a, b) => a - b)
  const partielles = new Map(lignes.flatMap((l) => l.annees.filter((a) => a.partielle).map((a) => [a.annee, a.partielle])))
  if (!annees.length) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.08em] text-ink-muted">
            <th className="py-2 pr-3 font-semibold">Département</th>
            {annees.map((a) => (
              <th key={a} className="py-2 pr-3 text-right font-semibold">
                {a}
                {partielles.get(a) && <span className="block text-[10px] normal-case tracking-normal">{partielles.get(a)}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {lignes.map((l) => (
            <tr key={l.code}>
              <td className="py-2.5 pr-3">
                <span className="flex items-center gap-2 font-medium text-ink">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: COULEURS_DEPARTEMENTS[l.code] }} />
                  {l.nom}
                </span>
              </td>
              {annees.map((a) => {
                const x = l.annees.find((y) => y.annee === a)
                return (
                  <td key={a} className="py-2.5 pr-3 text-right">
                    {x ? (
                      <>
                        <span className="ds-num block font-semibold text-ink">{euroM2(x.prix)}</span>
                        {x.variation != null ? <Variation v={x.variation} className="mt-1" /> : <span className="mt-1 block text-[11px] text-ink-muted">référence</span>}
                      </>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Recul long terme : indice Notaires-INSEE des prix de l'ancien du département
 * (trimestriel, depuis 1992 ou 1996), servi par GET /api/market/indices.
 * Masqué proprement si le serveur ne le fournit pas.
 */
export function IndiceLongTerme({ actifs, typeBien }) {
  const [choix, setChoix] = useState(null)
  const dep = actifs.includes(choix) ? choix : actifs[0]
  const { data, loading, error, reload } = useIndiceInsee(dep, typeBien)

  const d = useMemo(() => {
    const valeurs = Array.isArray(data?.valeurs) ? data.valeurs.filter(Number.isFinite) : []
    if (!data?.debut || valeurs.length < 8) return null
    const labels = trimestres(data.debut, valeurs.length)
    const xTicks = labels.map((l, i) => (l.endsWith('T1') && Number(l.slice(0, 4)) % 4 === 0 ? i : null)).filter((i) => i != null)
    const dernier = valeurs.at(-1)
    return {
      labels,
      xTicks,
      valeurs,
      dernier,
      depuisDebut: dernier / valeurs[0] - 1,
      surDixAns: valeurs.length > 40 ? dernier / valeurs.at(-41) - 1 : null,
      plusHaut: Math.max(...valeurs),
      labelPlusHaut: labels[valeurs.indexOf(Math.max(...valeurs))],
    }
  }, [data])

  const indisponible = error && (error.status === 404 || error.status === 503)
  return (
    <Card padding="lg" className="rounded-[22px]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="ds-eyebrow mb-1.5">Recul long terme</p>
          <h3 className="ds-h3">Les prix <em>sur le temps long</em></h3>
          <p className="mt-1 text-[13px] text-ink-muted">
            Indice Notaires-INSEE des prix des logements anciens (base 100 en 2015) : de quoi situer les années récentes dans un cycle long.
          </p>
        </div>
        {actifs.length > 1 && (
          <Select value={dep} onChange={(e) => setChoix(e.target.value)} className="w-56" aria-label="Département de l’indice">
            {actifs.map((c) => <option key={c} value={c}>{c} · {DEPARTEMENTS[c]}</option>)}
          </Select>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : indisponible ? (
        <p className="rounded-[14px] bg-surface-2 px-4 py-3 text-sm text-ink-muted ring-1 ring-inset ring-line">
          L’indice de long terme n’est pas fourni par cette version du serveur.
        </p>
      ) : error ? (
        <ErrorState compact title="Indice indisponible" error={error} onRetry={reload} />
      ) : !d ? (
        <p className="text-sm text-ink-muted">Pas d’indice pour ce département.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <LineChart
            labels={d.labels}
            xTicks={d.xTicks}
            xTickLabel={(i) => d.labels[i].slice(0, 4)}
            series={[{ id: dep, label: `Indice ${DEPARTEMENTS[dep]}`, color: COULEURS_DEPARTEMENTS[dep] ?? 'var(--color-accent)', values: d.valeurs }]}
            formatY={(v) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
            height={260}
            area
            areaOpacity={0.22}
            ariaLabel={`Indice des prix de l’ancien, ${DEPARTEMENTS[dep]}, de ${d.labels[0]} à ${d.labels.at(-1)}.`}
          />
          <dl className="flex flex-col gap-2">
            <div className="rounded-[14px] bg-surface-2 px-4 py-3 ring-1 ring-inset ring-line">
              <dd className="ds-num text-[22px] font-semibold leading-none text-ink">{pct(d.depuisDebut, { digits: 0, signed: true })}</dd>
              <dt className="mt-1 text-[12px] text-ink-muted">depuis {d.labels[0].slice(0, 4)}</dt>
            </div>
            {d.surDixAns != null && (
              <div className="rounded-[14px] bg-surface-2 px-4 py-3 ring-1 ring-inset ring-line">
                <dd className={cx('ds-num text-[22px] font-semibold leading-none', d.surDixAns >= 0 ? 'text-success' : 'text-danger')}>{pct(d.surDixAns, { signed: true })}</dd>
                <dt className="mt-1 text-[12px] text-ink-muted">sur 10 ans</dt>
              </div>
            )}
            <div className="rounded-[14px] bg-surface-2 px-4 py-3 ring-1 ring-inset ring-line">
              <dd className="ds-num text-[22px] font-semibold leading-none text-ink">{pct(d.dernier / d.plusHaut - 1, { signed: true })}</dd>
              <dt className="mt-1 text-[12px] text-ink-muted">par rapport au plus haut ({d.labelPlusHaut})</dt>
            </div>
            <p className="text-[11.5px] leading-relaxed text-ink-muted">
              Dernier point : {d.labels.at(-1)}.
              {data?.type_reel && data.type_reel !== typeBien && typeBien === 'house' ? ' Pas d’indice des maisons pour ce département : indice des appartements.' : ''}
              {' '}Source : {data?.source ?? 'Notaires-INSEE'}.
            </p>
          </dl>
        </div>
      )}
    </Card>
  )
}
