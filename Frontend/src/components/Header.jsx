export default function Header({ datasetStatus, user, onOpenAuth, onLogout, darkMode, onToggleDark }) {
  return (
    <header className="border-b border-stone-100 bg-white">
      <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Monogramme — clé de voûte stylisée */}
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
            <path d="M6 28 L11 8 L23 8 L28 28 Z" stroke="var(--color-ink)" strokeWidth="1.6" fill="none" />
            <line x1="14.3" y1="8" x2="11.6" y2="28" stroke="var(--color-limestone)" strokeWidth="1.4" />
            <line x1="19.7" y1="8" x2="22.4" y2="28" stroke="var(--color-limestone)" strokeWidth="1.4" />
          </svg>
          <div>
            <p className="font-[var(--font-display)] text-2xl leading-none tracking-tight text-[var(--color-ink)]">
              RealEstate<span className="text-[var(--color-seine)]">AI</span>
            </p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)] mt-1">
              Estimation immobilière · Île-de-France
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {datasetStatus !== 'loading' && (
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  datasetStatus === 'ready' ? 'bg-emerald-500' : 'bg-red-400'
                }`}
              />
              <span className="text-[var(--color-ink-muted)]">
                {datasetStatus === 'ready' && 'Données DVF chargées'}
                {datasetStatus === 'error' && 'Backend indisponible'}
              </span>
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
              <span className="text-xs text-ink-muted hidden sm:block max-w-[140px] truncate">{user.email}</span>
              <button
                onClick={onLogout}
                className="text-xs text-ink-muted border border-stone-200 rounded-lg px-3 py-1.5 hover:border-stone-400 hover:text-ink transition-colors"
              >
                Déconnexion
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="text-xs font-medium text-seine border border-seine/30 rounded-lg px-3 py-1.5 hover:bg-seine/5 transition-colors"
            >
              Connexion
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
