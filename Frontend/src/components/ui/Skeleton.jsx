import { cx } from '../../lib/cx'

/** Bloc de chargement à la forme du contenu attendu. */
export default function Skeleton({ className, rounded = 'rounded-control' }) {
  return <span aria-hidden="true" className={cx('block animate-pulse bg-line/70', rounded, className)} />
}

/** Plusieurs lignes de texte en attente. */
export function SkeletonText({ lines = 3, className }) {
  return (
    <span aria-hidden="true" className={cx('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cx('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </span>
  )
}
