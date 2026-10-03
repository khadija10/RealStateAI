import { cx } from '../../lib/cx'
import Spinner from './Spinner'

const VARIANTS = {
  primary: 'bg-brand text-on-brand hover:bg-brand-hover shadow-xs',
  secondary:
    'bg-surface text-ink border border-line-strong hover:border-ink-muted hover:bg-surface-2',
  ghost: 'text-ink-soft hover:text-ink hover:bg-surface-2',
  danger: 'bg-surface text-danger border border-danger/40 hover:bg-danger-soft hover:border-danger',
  link: 'text-accent-ink underline-offset-4 hover:underline !h-auto !px-0',
}

const SIZES = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2.5',
}

/**
 * Bouton du design system.
 * - `as` permet de rendre un lien (ex. `as={Link} to="/…"`) avec le même style.
 * - `loading` affiche un indicateur et bloque l'action.
 */
export default function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  className,
  children,
  type,
  ...rest
}) {
  const isButton = Component === 'button'
  const inactive = disabled || loading
  return (
    <Component
      type={isButton ? (type ?? 'button') : undefined}
      disabled={isButton ? inactive : undefined}
      aria-disabled={!isButton && inactive ? true : undefined}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center whitespace-nowrap rounded-control font-medium select-none',
        'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-soft',
        'active:translate-y-px disabled:opacity-50 disabled:pointer-events-none',
        !isButton && inactive && 'opacity-50 pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={size === 'lg' ? 18 : 16} /> : iconLeft}
      {children}
      {!loading && iconRight}
    </Component>
  )
}
