import { useMemo } from 'react'

/**
 * Bandeau illustré plein format, repris de la structure des artefacts
 * (immeuble/toits en arrière-plan, dégradé sombre, titre serif italique en
 * surimpression). Réutilisable pour chaque page qui dispose de sa propre
 * illustration (`illustrations.js`).
 */
export default function HeroBanner({ illustration, title, titleEm, subtitle, className = '' }) {
  const svg = useMemo(() => illustration(), [illustration])

  return (
    <div className={`relative rounded-[28px] overflow-hidden isolate min-h-[400px] sm:min-h-[480px] mb-8 ${className}`}>
      <div
        className="absolute inset-0 [&>svg]:block [&>svg]:w-full [&>svg]:h-full"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/0 to-black/40" />
      <div className="relative px-6 sm:px-11 pt-14 sm:pt-24 max-w-xl text-white">
        <h1 className="text-[2.3rem] sm:text-6xl leading-[0.98] tracking-tight font-medium">
          {title}
          <br />
          <span className="font-display text-white">{titleEm}</span>
        </h1>
        <p className="mt-5 text-sm sm:text-[15px] text-white/85 max-w-sm font-light leading-relaxed">
          {subtitle}
        </p>
      </div>
    </div>
  )
}
