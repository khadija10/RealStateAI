export default function Footer() {
  return (
    <footer className="border-t border-stone-100 mt-16">
      <div className="w-full px-4 sm:px-6 lg:px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[var(--color-ink-muted)]">
        <p>Données · DVF (Demandes de valeurs foncières), data.gouv.fr</p>
        <p>RealStateAI — v{__APP_VERSION__}</p>
      </div>
    </footer>
  )
}
