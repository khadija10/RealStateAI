import { useEffect, useState } from 'react'

/**
 * Anime un nombre de sa valeur précédente vers `target` (≈ 600 ms).
 * Désactivé si l'utilisateur a demandé à réduire les animations.
 */
export function useCountUp(target, duration = 600) {
  const [value, setValue] = useState(target)

  useEffect(() => {
    if (typeof target !== 'number' || !Number.isFinite(target)) {
      setValue(target)
      return
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setValue(target)
      return
    }
    let raf
    const start = performance.now()
    const from = target * 0.92
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(from + (target - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}
