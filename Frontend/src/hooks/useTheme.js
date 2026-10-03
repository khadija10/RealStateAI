import { useCallback, useLayoutEffect, useState } from 'react'

const KEY = 'reai_theme'

function initialTheme() {
  // L'attribut est déjà posé avant le premier rendu par le script de index.html.
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'dark' || attr === 'light') return attr
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'dark' || saved === 'light') return saved
  } catch { /* navigation privée */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Thème clair / sombre. Par défaut, suit la préférence du système ; le choix
 * n'est mémorisé que lorsque l'utilisateur bascule explicitement.
 */
export function useTheme() {
  const [theme, setTheme] = useState(initialTheme)

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem(KEY, next) } catch { /* navigation privée */ }
      return next
    })
  }, [])

  return { theme, toggle }
}
