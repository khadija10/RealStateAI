import { useCallback, useEffect, useRef, useState } from 'react'
import { isAbortError } from '../api/client'

/**
 * Charge une ressource de l'API et expose ses états.
 *
 *   const { data, error, loading, reload } = useApi((signal) => getMarketMap({ signal }), [])
 *
 * - l'appel précédent est annulé si les dépendances changent ou si le
 *   composant est démonté (pas de mise à jour d'état après coup) ;
 * - `enabled: false` diffère l'appel.
 */
export function useApi(fetcher, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled })
  const [nonce, setNonce] = useState(0)
  const fetcherRef = useRef(fetcher)
  useEffect(() => { fetcherRef.current = fetcher })

  useEffect(() => {
    if (!enabled) {
      setState((s) => ({ ...s, loading: false }))
      return
    }
    const controller = new AbortController()
    setState((s) => ({ data: s.data, error: null, loading: true }))
    fetcherRef.current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false })
      })
      .catch((error) => {
        if (controller.signal.aborted || isAbortError(error)) return
        setState({ data: null, error, loading: false })
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, reload }
}

/**
 * Action déclenchée par l'utilisateur (soumission de formulaire…).
 * Un nouvel appel annule le précédent : seule la dernière réponse s'affiche.
 *
 *   const { run, data, error, loading } = useAction((payload, signal) => estimatePrice(payload, { signal }))
 */
export function useAction(action) {
  const [state, setState] = useState({ data: null, error: null, loading: false })
  const controllerRef = useRef(null)
  const actionRef = useRef(action)
  useEffect(() => { actionRef.current = action })
  useEffect(() => () => controllerRef.current?.abort(), [])

  const run = useCallback(async (...args) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setState((s) => ({ data: s.data, error: null, loading: true }))
    try {
      const data = await actionRef.current(...args, controller.signal)
      if (controller.signal.aborted) return undefined
      setState({ data, error: null, loading: false })
      return data
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return undefined
      setState({ data: null, error, loading: false })
      return undefined
    }
  }, [])

  const reset = useCallback(() => {
    controllerRef.current?.abort()
    setState({ data: null, error: null, loading: false })
  }, [])

  return { ...state, run, reset }
}
