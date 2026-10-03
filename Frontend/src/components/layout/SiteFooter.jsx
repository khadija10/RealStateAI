import { Link } from 'react-router-dom'
import { MAIN_NAV } from './navigation'

/** Pied de page : sources des données (attribution légale), liens, version. */
export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto grid max-w-page gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <p className="text-[15px] font-semibold tracking-tight text-ink">
            RealState<span className="ds-figure italic text-accent-ink">AI</span>
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            Estimation immobilière en Île-de-France à partir des ventes notariées. Résultats indicatifs,
            sans valeur d’expertise.
          </p>
        </div>
        <div>
          <p className="ds-eyebrow mb-3">Outils</p>
          <ul className="flex flex-col gap-2 text-sm">
            {MAIN_NAV.map(({ to, label }) => (
              <li key={to}>
                <Link to={to} className="text-ink-soft transition-colors hover:text-ink">{label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="ds-eyebrow mb-3">Sources</p>
          <ul className="flex flex-col gap-2 text-sm text-ink-soft">
            <li>DVF — DGFiP / Etalab</li>
            <li>Base Adresse Nationale</li>
            <li>DPE — ADEME</li>
            <li>Découpage — geo.api.gouv.fr</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-page flex-col gap-1 px-4 py-4 text-xs text-ink-muted sm:flex-row sm:justify-between sm:px-6">
          <p>RealStateAI · Estimation immobilière en Île-de-France</p>
          <p>Version {__APP_VERSION__}</p>
        </div>
      </div>
    </footer>
  )
}
