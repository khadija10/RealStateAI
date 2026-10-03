import { useMemo } from 'react'
import { cx } from '../../lib/cx'

/**
 * Illustration SVG de la marque (voir src/illustrations.js), dessinée une
 * seule fois par montage. Décorative : masquée aux lecteurs d'écran.
 * Le SVG remplit son conteneur (`preserveAspectRatio … slice`).
 */
export default function Illustration({ draw, className }) {
  const html = useMemo(() => ({ __html: draw() }), [draw])
  return (
    <div
      aria-hidden="true"
      className={cx('pointer-events-none [&_svg]:block [&_svg]:h-full [&_svg]:w-full', className)}
      dangerouslySetInnerHTML={html}
    />
  )
}
