import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import MobileNav from './MobileNav'
import SiteFooter from './SiteFooter'
import TopNav from './TopNav'

/**
 * Coquille commune à toutes les pages : barre supérieure, contenu, pied de
 * page et barre d'onglets mobile. À chaque changement de page, on remonte en
 * haut et on place le focus sur le contenu (lecteurs d'écran, clavier).
 */
export default function AppShell() {
  const { theme, toggle } = useTheme()
  const { pathname } = useLocation()
  const mainRef = useRef(null)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    window.scrollTo({ top: 0, behavior: 'instant' })
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  // Clé d'animation : la section (premier segment), pour ne pas rejouer le
  // fondu entre deux sous-onglets d'une même page (Marché › Carte / Tendances).
  const section = pathname.split('/')[1] || 'accueil'

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-control focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:text-on-brand"
      >
        Aller au contenu
      </a>
      <TopNav theme={theme} onToggleTheme={toggle} />
      <main
        id="contenu"
        ref={mainRef}
        tabIndex={-1}
        className="flex-1 outline-none"
      >
        <div key={section} className="animate-fade-in">
          <Outlet />
        </div>
      </main>
      {/* Marge basse mobile : la barre d'onglets ne masque jamais le pied de page. */}
      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <SiteFooter />
      </div>
      <MobileNav />
    </div>
  )
}
