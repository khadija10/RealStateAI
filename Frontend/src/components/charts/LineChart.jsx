import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { cx } from '../../lib/cx'

/** Graduations « rondes » couvrant [min, max]. */
function niceTicks(min, max, count = 4) {
  if (!(max > min)) return [min]
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const start = Math.floor(min / step) * step
  const ticks = []
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return ticks
}

/**
 * Courbe(s) sur une échelle Y COMMUNE, avec axes gradués et info-bulle
 * (souris, toucher, clavier ← →).
 *
 * - `labels`  : libellés de l'axe X, un par point (ex. « janv. 2024 »).
 * - `xTicks`  : indices des points à graduer (ex. chaque janvier).
 * - `series`  : [{ id, label, color, values: number[] }], même longueur que labels.
 * - `area`    : remplit sous la première série (`areaOpacity` : intensité).
 * - `bands`   : [{ from, to }] indices de points à surligner (ex. une année sur deux).
 */
export default function LineChart({
  labels,
  series,
  xTicks,
  xTickLabel = (i) => labels[i],
  formatY = String,
  height = 240,
  area = false,
  areaOpacity = 0.16,
  bands = [],
  strokeWidth = 2,
  ariaLabel,
  className,
}) {
  const wrapRef = useRef(null)
  const [width, setWidth] = useState(640)
  const [active, setActive] = useState(null)
  const gradId = useId().replace(/:/g, '')

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = labels.length
  const all = series.flatMap((s) => s.values.filter((v) => Number.isFinite(v)))
  const { ticks, yMin, yMax } = useMemo(() => {
    if (!all.length) return { ticks: [0], yMin: 0, yMax: 1 }
    const lo = Math.min(...all)
    const hi = Math.max(...all)
    const pad = (hi - lo) * 0.08 || hi * 0.05 || 1
    const t = niceTicks(lo - pad, hi + pad)
    return { ticks: t, yMin: t[0], yMax: t[t.length - 1] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all.join(',')])

  const compact = width < 480
  const m = { top: 12, right: 12, bottom: 28, left: compact ? 48 : 52 }
  const iw = width - m.left - m.right
  const ih = height - m.top - m.bottom
  const x = (i) => m.left + (n > 1 ? (i * iw) / (n - 1) : iw / 2)
  const y = (v) => m.top + ih * (1 - (v - yMin) / (yMax - yMin || 1))

  const paths = series.map((s) => {
    let d = ''
    s.values.forEach((v, i) => {
      if (!Number.isFinite(v)) return
      d += `${d ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `
    })
    return d
  })

  const shownTicks = (xTicks ?? labels.map((_, i) => i)).filter((_, k, arr) =>
    compact && arr.length > 4 ? k % 2 === 0 : true,
  )

  function indexFromEvent(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * width
    return Math.max(0, Math.min(n - 1, Math.round(((px - m.left) / iw) * (n - 1))))
  }

  function onKeyDown(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    setActive((a) => {
      const cur = a ?? n - 1
      return Math.max(0, Math.min(n - 1, cur + (e.key === 'ArrowRight' ? 1 : -1)))
    })
  }

  const tipLeft = active != null ? (x(active) / width) * 100 : 0

  return (
    <div ref={wrapRef} className={cx('relative w-full select-none', className)}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerMove={(e) => setActive(indexFromEvent(e))}
        onPointerDown={(e) => setActive(indexFromEvent(e))}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActive(null) }}
        onBlur={() => setActive(null)}
        className="block touch-pan-y rounded-control focus-visible:outline-2 focus-visible:outline-accent"
      >
        {area && (
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={series[0]?.color} stopOpacity={areaOpacity} />
              <stop offset="1" stopColor={series[0]?.color} stopOpacity="0" />
            </linearGradient>
          </defs>
        )}

        {bands.map((b) => (
          <rect
            key={`${b.from}-${b.to}`}
            x={x(b.from)}
            y={m.top}
            width={Math.max(0, x(b.to) - x(b.from))}
            height={ih}
            fill="var(--color-accent-soft)"
            opacity="0.55"
          />
        ))}

        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray={t === yMin ? undefined : '2 4'} />
            <text x={m.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-muted)" className="ds-num">
              {formatY(t)}
            </text>
          </g>
        ))}

        {shownTicks.map((i) => (
          <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--color-ink-muted)">
            {xTickLabel(i)}
          </text>
        ))}

        {area && paths[0] && (
          <path
            d={`${paths[0]} L${x(n - 1)} ${m.top + ih} L${x(0)} ${m.top + ih} Z`}
            fill={`url(#${gradId})`}
          />
        )}

        {series.map((s, k) => (
          <path key={s.id} d={paths[k]} fill="none" stroke={s.color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {/* Dernier point de chaque série */}
        {active == null &&
          series.map((s) => {
            const i = s.values.length - 1
            return Number.isFinite(s.values[i]) ? (
              <g key={s.id}>
                <circle cx={x(i)} cy={y(s.values[i])} r="7" fill={s.color} opacity="0.18" />
                <circle cx={x(i)} cy={y(s.values[i])} r="3.5" fill={s.color} />
              </g>
            ) : null
          })}

        {active != null && (
          <g>
            <line x1={x(active)} x2={x(active)} y1={m.top} y2={m.top + ih} stroke="var(--color-ink-muted)" strokeDasharray="3 3" />
            {series.map((s) =>
              Number.isFinite(s.values[active]) ? (
                <circle key={s.id} cx={x(active)} cy={y(s.values[active])} r="4.5" fill="var(--color-surface)" stroke={s.color} strokeWidth="2" />
              ) : null,
            )}
          </g>
        )}
      </svg>

      {active != null && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-control border border-line bg-surface px-3 py-2 text-xs shadow-overlay"
          style={{
            left: `${tipLeft}%`,
            transform: `translateX(${tipLeft > 65 ? 'calc(-100% - 12px)' : '12px'})`,
          }}
        >
          <p className="mb-1 font-medium text-ink">{labels[active]}</p>
          {series.map((s) => (
            <p key={s.id} className="flex items-center justify-between gap-4 text-ink-soft">
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="ds-num font-medium text-ink">
                {Number.isFinite(s.values[active]) ? formatY(s.values[active], true) : '—'}
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
