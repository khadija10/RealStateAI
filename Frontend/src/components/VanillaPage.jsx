import { useEffect, useRef } from 'react'

/**
 * Monte une page "vanilla" (HTML + logique JS autonome, directement reprise
 * d'un artefact Claude Design) à l'intérieur de React. Le CSS associé
 * (src/vanilla/vanilla.css) est scopé sous `.rsai-vanilla` et importé une
 * fois globalement — il ne dépend pas de ce composant.
 */
export default function VanillaPage({ page, apiBase }) {
  const rootRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    root.innerHTML = page.html
    const cleanup = page.mount(root, { apiBase })
    return () => {
      cleanup?.()
      root.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  return <div className="rsai-vanilla" ref={rootRef} />
}
