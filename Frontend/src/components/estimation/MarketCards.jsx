import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useDepartmentTrend } from '../../hooks/useMarketData'
import { cx } from '../../lib/cx'
import { euroM2, nb, pct } from '../../lib/format'
import { nomDepartement } from '../../lib/geo'
import { syntheseAnnuelle, variationDouzeMois } from '../../lib/tendance'
import LineChart from '../charts/LineChart'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, IconArrowRight, Skeleton } from '../ui'
import { MarketPositionBar } from './visuals'

const moisCourt = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' })

/** Conteneur : carte autonome, ou simple bloc quand `embedded`. */
function Shell({ embedded, className, children }) {
  if (embedded) return <div className={className}>{children}</div>
  return <Card padding="lg" className={cx('h-full', className)}>{children}</Card>
}

/**
 * Le bien face au marché de sa commune (GET /api/market/map) :
 * médiane, quartiles, volume de ventes et écart du prix estimé.
 * `embedded` : bloc sans carte, placé dans la colonne d'analyse du résultat
 * (médiane et écart sont alors affichés dans le bloc principal).
 */
export function MarketContextCard({ stats, statsState, pricePerM2, isDemo = false, lieu, communeConnue = true, embedded = false }) {
  if (statsState.loading) {
    return (
      <Shell embedded={embedded} className="flex flex-col gap-4">
        <Skeleton className="h-6 w-1/2" />
        {!embedded && <Skeleton className="h-10 w-1/3" />}
        <Skeleton className="h-9 w-full" />
      </Shell>
    )
  }
  if (statsState.error) {
    return (
      <Shell embedded={embedded}>
        <ErrorState compact title="Contexte de marché indisponible" error={statsState.error} onRetry={statsState.reload} />
      </Shell>
    )
  }
  if (!stats) {
    return (
      <Shell embedded={embedded}>
        {communeConnue ? (
          <EmptyState
            className={embedded ? 'py-4' : 'py-8'}
            title="Pas de statistiques pour cette commune"
            description={`Les données de marché ne couvrent pas « ${lieu} ». L’estimation reste valable.`}
          />
        ) : (
          <EmptyState
            className={embedded ? 'py-4' : 'py-8'}
            title="Commune non identifiée"
            description="Le serveur n’a pas indiqué la commune de ce bien. Ajoutez le code postal à l’adresse pour afficher le marché local."
          />
        )}
      </Shell>
    )
  }

  const ecart = pricePerM2 != null && stats.prix_m2_median ? pricePerM2 / stats.prix_m2_median - 1 : null
  const barre = stats.prix_m2_q1 && stats.prix_m2_q3 && (
    <MarketPositionBar
      q1={stats.prix_m2_q1}
      median={stats.prix_m2_median}
      q3={stats.prix_m2_q3}
      value={pricePerM2}
      format={euroM2}
    />
  )
  const note = isDemo ? (
    <p className="text-[13px] text-ink-soft">
      Comparaison avec votre bien masquée : le montant renvoyé en mode démonstration n’est pas une estimation.
    </p>
  ) : null
  const legende = (
    <p className={cx('text-xs leading-relaxed text-ink-muted', !embedded && 'mt-auto pt-6')}>
      La bande colorée regroupe la moitié des ventes de la commune, entre le 1er et le 3e quartile du prix au m²
      {pricePerM2 != null ? ' ; le repère rond situe votre bien.' : '.'}
    </p>
  )

  if (embedded) {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="ds-h3">Position <em>dans la commune</em></h3>
          <Badge tone="neutral">{nb(stats.n_transactions)} ventes</Badge>
        </div>
        <p className="-mt-2 text-sm text-ink-muted">
          {stats.nom_commune} · {nomDepartement(stats.code_departement)}
        </p>
        {barre}
        {note}
        {legende}
      </div>
    )
  }

  return (
    <Card padding="lg" className="flex h-full flex-col">
      <CardHeader
        eyebrow="Marché local"
        title={stats.nom_commune}
        description={`${nb(stats.n_transactions)} ventes DVF · ${nomDepartement(stats.code_departement)}`}
      />
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-ink-muted">Prix médian</p>
          <p className="ds-num ds-figure mt-1.5 text-3xl text-ink">{euroM2(stats.prix_m2_median)}</p>
        </div>
        {ecart != null && (
          <div>
            <p className="text-xs text-ink-muted">Votre bien</p>
            <p className="mt-2">
              <Badge tone={Math.abs(ecart) < 0.05 ? 'neutral' : 'accent'}>
                {pct(ecart, { digits: 0, signed: true })} vs médiane
              </Badge>
            </p>
          </div>
        )}
      </div>
      {barre}
      {note}
      {legende}
    </Card>
  )
}

/** Variation en pastille colorée (hausse verte, baisse rouge), avec flèche. */
function Tendance({ v, inverse = false }) {
  const hausse = v >= 0
  return (
    <span
      className={cx(
        'ds-num inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[11.5px] font-semibold',
        inverse ? 'bg-on-brand/15 text-on-brand' : hausse ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
      )}
    >
      <span aria-hidden="true">{hausse ? '↗' : '↘'}</span>
      {pct(v, { signed: true })}
    </span>
  )
}

/** Évolution mensuelle du prix médian du département (GET /api/market/trends). */
export function DepartmentTrendCard({ dep }) {
  const { rows, loading, error, reload } = useDepartmentTrend(dep)

  const data = useMemo(() => {
    if (!rows.length) return null
    const values = rows.map((r) => r.prix_m2_median)
    const labels = rows.map((r) => moisCourt.format(new Date(r.annee, r.mois - 1, 1)))
    const xTicks = rows.map((r, i) => (r.mois === 1 ? i : null)).filter((i) => i != null)
    const last = rows[rows.length - 1]
    const annees = syntheseAnnuelle(rows)
    // Une année sur deux légèrement teintée sur le graphique.
    const bandes = xTicks.filter((_, k2) => k2 % 2 === 1).map((from) => {
      const fin = rows.findIndex((r, j) => j > from && r.mois === 1)
      return { from, to: fin === -1 ? rows.length - 1 : fin }
    })
    const prixAn = annees.map((a) => a.prix)
    return {
      values,
      labels,
      xTicks,
      last,
      annees,
      bandes,
      minAn: Math.min(...prixAn),
      maxAn: Math.max(...prixAn),
      variation: variationDouzeMois(rows),
      first: rows[0],
    }
  }, [rows])

  const nom = nomDepartement(dep)

  return (
    <Card padding="lg" className="flex h-full flex-col">
      <CardHeader
        eyebrow="Tendance du département"
        title={nom ?? 'Département'}
        description="Prix médian au m², toutes ventes DVF, par mois"
        action={
          <Button as={Link} to="/marche/tendances" variant="ghost" size="sm" iconRight={<IconArrowRight size={15} />}>
            <span className="hidden sm:inline">Comparer</span>
          </Button>
        }
      />
      {!dep ? (
        <EmptyState className="py-8" title="Département inconnu" description="La localisation n’a pas permis d’identifier le département." />
      ) : loading ? (
        <Skeleton className="h-56 w-full" />
      ) : error ? (
        <ErrorState compact title="Tendance indisponible" error={error} onRetry={reload} />
      ) : !data ? (
        <EmptyState className="py-8" title="Aucune donnée pour ce département" />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-x-5 gap-y-2">
            <div>
              <p className="text-xs text-ink-muted">Dernier mois ({data.labels[data.labels.length - 1]})</p>
              <p className="ds-num ds-figure mt-1.5 text-3xl text-ink">{euroM2(data.last.prix_m2_median)}</p>
            </div>
            {data.variation != null && (
              <p className="flex items-center gap-2 pb-1 text-sm text-ink-muted">
                <Tendance v={data.variation} />
                sur 12 mois
              </p>
            )}
          </div>
          <LineChart
            labels={data.labels}
            xTicks={data.xTicks}
            xTickLabel={(i) => String(rows[i].annee)}
            series={[{ id: dep, label: nom, color: 'var(--color-accent)', values: data.values }]}
            formatY={(v, full) => (full ? euroM2(v) : `${(v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k€`)}
            height={220}
            area
            areaOpacity={0.32}
            strokeWidth={2.25}
            bands={data.bandes}
            ariaLabel={`Prix médian au m² en ${nom}, de ${data.labels[0]} à ${data.labels[data.labels.length - 1]} : de ${euroM2(data.first.prix_m2_median)} à ${euroM2(data.last.prix_m2_median)}.`}
          />
          <div className="mt-6 border-t border-line pt-5">
            <h4 className="mb-3 text-[13px] font-medium text-ink-soft">Prix au m² par année</h4>
            <dl
              className="grid gap-2.5"
              style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${data.annees.length > 4 ? 130 : 150}px, 1fr))` }}
            >
              {data.annees.map((a, i) => {
                const derniere = i === data.annees.length - 1
                // Jauge : position du prix de l'année entre le plus bas et le plus haut de la période.
                const part = data.maxAn > data.minAn ? 0.15 + (0.85 * (a.prix - data.minAn)) / (data.maxAn - data.minAn) : 1
                return (
                  <div
                    key={a.annee}
                    className={cx(
                      'flex flex-col rounded-[14px] px-3.5 py-3',
                      derniere ? 'bg-brand text-on-brand shadow-sm' : 'bg-accent-soft/55 ring-1 ring-inset ring-accent/15',
                    )}
                  >
                    <dt className={cx('flex items-baseline justify-between gap-2 text-xs', derniere ? 'text-on-brand/75' : 'text-ink-muted')}>
                      <span className={cx('font-semibold', derniere ? 'text-on-brand' : 'text-accent-ink')}>{a.annee}</span>
                      {a.partielle ? <span className="text-[10.5px]">{a.partielle}</span> : derniere ? <span className="text-[10.5px]">dernière année</span> : null}
                    </dt>
                    <dd className={cx('ds-num mt-1.5 text-[19px] font-semibold tracking-[-0.02em]', derniere ? 'text-on-brand' : 'text-ink')}>
                      {euroM2(a.prix)}
                    </dd>
                    <dd className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
                      {a.variation != null ? (
                        <Tendance v={a.variation} inverse={derniere} />
                      ) : (
                        <span className={derniere ? 'text-on-brand/70' : 'text-ink-muted'}>Référence</span>
                      )}
                      {a.ventes ? <span className={cx('ds-num', derniere ? 'text-on-brand/70' : 'text-ink-muted')}>{nb(a.ventes)} ventes</span> : null}
                    </dd>
                    <dd aria-hidden="true" className={cx('mt-2.5 h-1 rounded-full', derniere ? 'bg-on-brand/15' : 'bg-accent/15')}>
                      <span
                        className={cx('block h-full rounded-full', derniere ? 'bg-accent' : 'bg-gradient-to-r from-sable to-accent')}
                        style={{ width: `${part * 100}%` }}
                      />
                    </dd>
                  </div>
                )
              })}
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-ink-muted">
              Moyenne annuelle des prix médians mensuels, pondérée par le nombre de ventes de chaque mois. La jauge situe
              chaque année entre la plus basse et la plus haute de la période.
            </p>
          </div>
        </>
      )}
    </Card>
  )
}
