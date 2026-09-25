export default function Header({ datasetStatus, user, onOpenAuth, onLogout }) {
  return (
    <header className="border-b border-stone-100">
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
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                datasetStatus === 'ready'
                  ? 'bg-emerald-500'
                  : datasetStatus === 'error'
                  ? 'bg-red-400'
                  : 'bg-stone-300 animate-pulse'
              }`}
            />
            <span className="text-[var(--color-ink-muted)]">
              {datasetStatus === 'ready' && 'Données DVF chargées'}
              {datasetStatus === 'error' && 'Backend indisponible'}
              {datasetStatus === 'loading' && 'Chargement des données…'}
            </span>
          </div>

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
