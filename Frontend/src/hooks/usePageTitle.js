import { useEffect } from 'react'

/** Titre de l'onglet du navigateur : « Estimation · RealStateAI ». */
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · RealStateAI` : 'RealStateAI — Estimation immobilière en Île-de-France'
  }, [title])
}
