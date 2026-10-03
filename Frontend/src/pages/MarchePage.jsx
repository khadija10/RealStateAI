import { Outlet, useLocation } from 'react-router-dom'
import MarketTrends from '../components/MarketTrends'
import PriceMap from '../components/PriceMap'
import PageHeader, { PageContainer } from '../components/layout/PageHeader'
import { MARKET_NAV } from '../components/layout/navigation'
import { TabNav } from '../components/ui'
import { useHealth } from '../context/HealthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { nb } from '../lib/format'

/** Période couverte, lue dans /api/health (jamais écrite en dur). */
function usePeriode() {
  const { health } = useHealth()
  const { minYear, maxYear } = health?.dvf ?? {}
  return minYear && maxYear ? `${minYear}–${maxYear}` : null
}

/** Section « Marché » : en-tête commun + sous-onglets Carte / Tendances. */
export default function MarchePage() {
  const { pathname } = useLocation()
  usePageTitle(pathname.endsWith('tendances') ? 'Tendances du marché' : 'Carte des prix')
  const periode = usePeriode()

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Marché immobilier"
        title={<>Le marché <em>d’Île-de-France</em></>}
        description={
          <>
            Prix médians au m² issus des ventes notariées (DVF)
            {periode ? <>, transactions {periode}</> : null}. Situez un bien avant de l’estimer.
          </>
        }
      />
      <TabNav label="Vues du marché" items={MARKET_NAV} className="mb-8" />
      <Outlet />
    </PageContainer>
  )
}

export function CarteView() {
  const { health } = useHealth()
  const nCommunes = health?.dvf?.nCommunes
  return (
    <section aria-labelledby="titre-carte">
      <h2 id="titre-carte" className="sr-only">Carte des prix par commune</h2>
      <p className="mb-5 text-sm text-ink-muted">
        Prix médian au m² par commune
        {nCommunes ? <> — {nb(nCommunes)} communes couvertes par le jeu de données</> : null}. Cliquez sur une
        commune pour zoomer.
      </p>
      <PriceMap />
    </section>
  )
}

export function TendancesView() {
  return (
    <section aria-labelledby="titre-tendances">
      <h2 id="titre-tendances" className="sr-only">Tendances par département</h2>
      <p className="mb-5 text-sm text-ink-muted">
        Évolution mensuelle du prix médian au m², par département.
      </p>
      {/* Largeur d'origine conservée : le graphique actuel déborde sur sa
          légende quand il s'élargit. Il est réécrit en phase 3. */}
      <div className="max-w-5xl">
        <MarketTrends />
      </div>
    </section>
  )
}
