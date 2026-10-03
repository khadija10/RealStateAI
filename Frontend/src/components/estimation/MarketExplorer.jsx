import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { euroM2, nb } from '../../lib/format'
import { DEPARTEMENTS } from '../../lib/geo'
import { VIGNETTES } from '../../illustrations'
import { Badge, Button, Card, EmptyState, ErrorState, IconArrowRight, Illustration, Select, Skeleton } from '../ui'

const PAR_PAGE = 8

/**
 * « Explorer le marché » : communes les plus actives d'un département,
 * avec leur prix médian réel (GET /api/market/map). Un clic pré-remplit le
 * formulaire — l'estimation n'est jamais lancée sans action de l'utilisateur.
 */
export default function MarketExplorer({ statsState, onPick }) {
  const [dep, setDep] = useState('75')
  const [limite, setLimite] = useState(PAR_PAGE)

  const communes = useMemo(
    () =>
      statsState.rows
        .filter((r) => dep === 'all' || r.code_departement === dep)
        .sort((a, b) => (b.n_transactions ?? 0) - (a.n_transactions ?? 0)),
    [statsState.rows, dep],
  )

  return (
    <section aria-labelledby="titre-explorer">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <p className="ds-eyebrow mb-2">Explorer le marché</p>
          <h2 id="titre-explorer" className="ds-h2">Les prix <em>commune par commune</em></h2>
          <p className="mt-2 text-sm text-ink-muted">
            Prix médian au m² et volume de ventes notariées. Choisissez une commune pour y estimer un bien.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="explorer-dep" className="sr-only">Département</label>
          <Select id="explorer-dep" value={dep} onChange={(e) => { setDep(e.target.value); setLimite(PAR_PAGE) }} className="w-56">
            <option value="all">Toute l’Île-de-France</option>
            {Object.entries(DEPARTEMENTS).map(([code, nom]) => (
              <option key={code} value={code}>{code} · {nom}</option>
            ))}
          </Select>
        </div>
      </div>

      {statsState.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-64" rounded="rounded-[20px]" />)}
        </div>
      ) : statsState.error ? (
        <ErrorState title="Données de marché indisponibles" error={statsState.error} onRetry={statsState.reload} />
      ) : !communes.length ? (
        <Card><EmptyState title="Aucune commune pour ce département" /></Card>
      ) : (
        <>
          {/* Mobile : liste compacte (une ligne par commune). */}
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-xs sm:hidden">
            {communes.slice(0, limite).map((c) => (
              <li key={`m-${c.code_departement}-${c.nom_commune}`}>
                <button
                  type="button"
                  onClick={() => onPick(c.nom_commune)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{c.nom_commune}</span>
                    <span className="block text-xs text-ink-muted">{c.code_departement} · {nb(c.n_transactions)} ventes</span>
                  </span>
                  <span className="ds-num text-sm font-semibold text-ink">{euroM2(c.prix_m2_median)}</span>
                  <IconArrowRight size={15} className="shrink-0 text-ink-muted" />
                </button>
              </li>
            ))}
          </ul>
          <ul className="hidden gap-x-4 gap-y-8 sm:grid sm:grid-cols-2 lg:grid-cols-4">
            {communes.slice(0, limite).map((c, i) => (
              <li key={`${c.code_departement}-${c.nom_commune}`}>
                <button
                  type="button"
                  onClick={() => onPick(c.nom_commune)}
                  className="group flex h-full w-full flex-col text-left"
                >
                  <span className="relative block h-48 overflow-hidden rounded-[20px] bg-sable">
                    <Illustration
                      draw={VIGNETTES[i % VIGNETTES.length]}
                      className="absolute inset-0 transition-transform duration-500 ease-soft group-hover:scale-[1.03] motion-reduce:transition-none"
                    />
                    <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11.5px] font-medium text-[#141311] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                      Estimer ici <IconArrowRight size={13} />
                    </span>
                  </span>
                  <span className="mt-3 text-xs text-ink-muted">
                    <span className="ds-num font-medium text-ink-soft">{euroM2(c.prix_m2_median)}</span> · médiane
                  </span>
                  <span className="font-display mt-0.5 text-[23px] leading-tight text-ink">{c.nom_commune}</span>
                  <span className="mt-2.5 flex flex-wrap gap-1.5">
                    <Badge tone="brand">{nb(c.n_transactions)} ventes</Badge>
                    {c.prix_m2_q1 && c.prix_m2_q3 ? (
                      <Badge tone="neutral">{nb(c.prix_m2_q1)} – {nb(c.prix_m2_q3)} €/m²</Badge>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {limite < communes.length && (
              <Button variant="secondary" onClick={() => setLimite((l) => l + PAR_PAGE)}>
                Afficher plus de communes ({nb(communes.length - limite)} restantes)
              </Button>
            )}
            <Button as={Link} to="/marche/carte" variant="ghost" iconRight={<IconArrowRight size={16} />}>
              Voir la carte des prix
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
