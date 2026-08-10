// Jauge de confiance — élément signature de l'interface.
// Représente l'estimation comme une mesure architecturale : une règle
// graduée entre la borne basse et la borne haute, avec un repère
// (le "trait de niveau") positionné sur le prix estimé.

function formatEUR(value) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function ConfidenceGauge({ low, estimate, high }) {
  const span = Math.max(high - low, 1)
  const ratio = Math.min(Math.max((estimate - low) / span, 0), 1)
  const markerX = 24 + ratio * 352 // largeur utile de la règle : 352px, offset 24px

  const ticks = Array.from({ length: 9 }, (_, i) => 24 + (i * 352) / 8)

  return (
    <div className="w-full">
      <svg viewBox="0 0 400 88" className="w-full h-auto" role="img" aria-label={`Fourchette de confiance entre ${formatEUR(low)} et ${formatEUR(high)}, estimation ${formatEUR(estimate)}`}>
        {/* Règle graduée */}
        <line x1="24" y1="52" x2="376" y2="52" stroke="var(--color-stone-100)" strokeWidth="2" />
        {ticks.map((x, i) => (
          <line
            key={i}
            x1={x}
            y1={i === 0 || i === 8 ? 40 : 46}
            x2={x}
            y2="52"
            stroke="var(--color-stone-600)"
            strokeWidth={i === 0 || i === 8 ? 1.5 : 1}
            opacity={i === 0 || i === 8 ? 0.9 : 0.4}
          />
        ))}

        {/* Segment de confiance */}
        <line x1="24" y1="52" x2="376" y2="52" stroke="var(--color-limestone)" strokeWidth="3" strokeLinecap="round" opacity="0.5" />

        {/* Repère de l'estimation (trait de niveau) */}
        <g className="transition-transform duration-700 ease-out" style={{ transform: `translateX(${markerX - 200}px)` }} transform="translate(200,0)">
          <line x1="0" y1="18" x2="0" y2="52" stroke="var(--color-seine)" strokeWidth="2.5" />
          <circle cx="0" cy="18" r="5" fill="var(--color-seine)" />
        </g>

        {/* Labels bas / haut */}
        <text x="24" y="76" fontFamily="var(--font-sans)" fontSize="11" fill="var(--color-ink-muted)">{formatEUR(low)}</text>
        <text x="376" y="76" textAnchor="end" fontFamily="var(--font-sans)" fontSize="11" fill="var(--color-ink-muted)">{formatEUR(high)}</text>
      </svg>
    </div>
  )
}

export { formatEUR }
