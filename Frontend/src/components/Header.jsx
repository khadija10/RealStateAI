// En-tête sur une seule ligne : logo, onglets, état et compte (les onglets passent
// à la ligne sur un écran étroit). Collé en haut de l'écran au défilement.
export default function Header({ datasetStatus, user, activeTab, onNavigate, onOpenAuth, onLogout, darkMode, onToggleDark, navigation }) {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-100 bg-[var(--color-surface)]/95 backdrop-blur">
      <div className="h-[3px] w-full bg-[linear-gradient(90deg,var(--color-seine)_0%,var(--color-ambre)_50%,var(--color-vert)_100%)]" />
      <div className="w-full px-4 sm:px-6 lg:px-10 py-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3 shrink-0">
          <div>
            <p className="text-xl leading-none tracking-tight text-ink font-medium">
              RealState<span className="font-display text-[1.15em] text-[var(--color-ambre)]">AI</span>
            </p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted mt-1 hidden sm:block xl:hidden 2xl:block">
              Estimation immobilière · Île-de-France
            </p>
          </div>
        </div>

        {/* Onglets des outils : au centre sur grand écran, sur une seconde ligne sinon */}
        <div className="order-3 w-full xl:order-none xl:w-auto xl:flex-1 min-w-0">{navigation}</div>

        <div className="flex items-center gap-4 ml-auto">
          {datasetStatus !== 'loading' && (
            <div className="hidden 2xl:flex items-center gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    datasetStatus === 'ready' ? 'bg-emerald-500' : 'bg-red-400'
                  }`}
                />
                <span className="text-[var(--color-ink-muted)]">
                  {datasetStatus === 'ready' && 'Ventes notariées 2021–2025'}
                  {datasetStatus === 'error' && 'Service indisponible'}
                </span>
              </div>

            </div>
          )}

          {/* Toggle dark mode */}
          <button
            onClick={onToggleDark}
            className="text-ink-muted hover:text-ink transition-colors p-1"
            title={darkMode ? 'Mode clair' : 'Mode sombre'}
            aria-label={darkMode ? 'Activer le mode clair' : 'Activer le mode sombre'}
          >
            {darkMode ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M11.89 4.11l1.06-1.06M3.05 12.95l1.06-1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M13.5 9.5A6 6 0 016.5 2.5a6 6 0 100 11 6 6 0 007-4z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              {/* Espace du compte : l'historique et le profil appartiennent à l'utilisateur,
                  pas aux outils ; ils quittent la barre d'onglets. */}
              {[['historique', 'Mon historique'], ['profil', 'Mon profil']].map(([id, libelle]) => (
                <button
                  key={id}
                  onClick={() => onNavigate?.(id)}
                  aria-current={activeTab === id ? 'page' : undefined}
                  className={`text-xs rounded-full px-3 py-1.5 transition-colors ${activeTab === id ? 'bg-[var(--color-seine)] text-white' : 'text-ink hover:bg-stone-100'}`}
                >
                  {libelle}
                </button>
              ))}
              <span className="text-xs text-ink-muted hidden 2xl:block max-w-[140px] truncate" title={user.email}>{user.email}</span>
              <button
                onClick={onLogout}
                className="text-xs text-ink-muted border border-stone-200 rounded-full px-3.5 py-1.5 hover:border-stone-400 hover:text-ink transition-colors"
              >
                Déconnexion
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="text-xs font-medium text-white rounded-full px-4 py-1.5 bg-[linear-gradient(100deg,var(--color-seine),var(--color-ambre))] hover:opacity-90 transition-opacity"
            >
              Connexion
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
