// Pied de page commun à tous les onglets, en colonnes : présentation, outils, sources.
const OUTILS = [
  ['estimation', 'Estimation'], ['financement', 'Financement'], ['plusvalue', 'Plus-value'],
  ['carte', 'Carte des prix'], ['marche', 'Référence du marché'],
]
const SOURCES = [
  ['Ventes notariées DVF — DGFiP, Etalab', 'https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres/'],
  ['Diagnostics DPE — ADEME', 'https://data.ademe.fr/'],
  ['Quartiers IRIS — INSEE', 'https://www.insee.fr/fr/information/2017499'],
  ['Bâtiments BDNB — CSTB', 'https://bdnb.io/'],
  ['Base Adresse Nationale', 'https://adresse.data.gouv.fr/'],
]

export default function Footer({ onNavigate }) {
  const titre = 'text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-muted mb-3'
  const lien = 'text-[13px] text-ink hover:text-[var(--color-ambre)] transition-colors text-left'
  return (
    <footer className="border-t border-stone-100 mt-16 bg-[var(--color-surface)]">
      <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.3fr]">
        <div>
          <p className="text-lg leading-none tracking-tight text-ink font-medium">
            RealState<span className="font-display text-[1.15em] text-[var(--color-ambre)]">AI</span>
          </p>
          <p className="text-[13px] text-ink-muted mt-3 max-w-xs leading-relaxed">
            Estimation immobilière en Île-de-France à partir des ventes notariées.
            Résultats indicatifs, sans valeur d&apos;expertise.
          </p>
        </div>
        <div>
          <p className={titre}>Outils</p>
          <ul className="space-y-2">
            {OUTILS.map(([id, libelle]) => (
              <li key={id}><button onClick={() => onNavigate?.(id)} className={lien}>{libelle}</button></li>
            ))}
          </ul>
        </div>
        <div>
          <p className={titre}>Sources</p>
          <ul className="space-y-2">
            {SOURCES.map(([libelle, url]) => (
              <li key={url}><a href={url} target="_blank" rel="noopener noreferrer" className={lien}>{libelle}</a></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 pb-8 flex flex-col sm:flex-row justify-between gap-2 text-[12px] text-ink-muted">
        <p>Estimation indicative fondée sur les ventes passées : elle ne constitue pas une expertise immobilière.</p>
        <p>RealStateAI · version {__APP_VERSION__}</p>
      </div>
    </footer>
  )
}
