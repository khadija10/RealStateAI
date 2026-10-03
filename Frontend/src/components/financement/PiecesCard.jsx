import { useState } from 'react'
import { cx } from '../../lib/cx'
import { libelleSituation } from '../../lib/financement'
import { Card, IconCheck } from '../ui'

/**
 * Pièces justificatives demandées pour ce profil (liste du backend), à cocher
 * au fur et à mesure. Les coches sont conservées tant que la page est ouverte.
 */
export default function PiecesCard({ dossier }) {
  const info = dossier.pieces_justificatives ?? {}
  const pieces = info.pieces ?? []
  const [coches, setCoches] = useState(() => new Set())
  const faites = pieces.filter((p) => coches.has(p)).length
  const part = pieces.length ? faites / pieces.length : 0

  function basculer(p) {
    setCoches((c) => {
      const n = new Set(c)
      if (n.has(p)) n.delete(p)
      else n.add(p)
      return n
    })
  }

  return (
    <Card padding="lg" className="flex h-full flex-col rounded-[22px]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="ds-h3">Pièces <em>justificatives</em></h3>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">Dossier {libelleSituation(info.situation)} · {pieces.length} pièces demandées</p>
        </div>
        <p className="ds-num shrink-0 text-[13px] font-semibold text-ink">{faites} / {pieces.length}</p>
      </div>
      <div className="mb-3 h-1.5 rounded-full bg-line" role="progressbar" aria-label="Pièces réunies" aria-valuemin={0} aria-valuemax={pieces.length} aria-valuenow={faites}>
        <span className="block h-full rounded-full bg-gradient-to-r from-sable to-accent transition-[width] duration-300" style={{ width: `${part * 100}%` }} />
      </div>
      <ul className="grid gap-1 sm:grid-cols-2 lg:max-h-[300px] lg:overflow-y-auto lg:grid-cols-1 xl:grid-cols-2">
        {pieces.map((p) => {
          const ok = coches.has(p)
          return (
            <li key={p}>
              <label className={cx('flex cursor-pointer items-start gap-2.5 rounded-[10px] px-2 py-1.5 text-[12.5px] transition-colors hover:bg-surface-2', ok ? 'text-ink-muted line-through decoration-ink-muted/40' : 'text-ink-soft')}>
                <input type="checkbox" className="peer sr-only" checked={ok} onChange={() => basculer(p)} />
                <span
                  aria-hidden="true"
                  className={cx(
                    'mt-px grid h-4 w-4 shrink-0 place-items-center rounded-[5px] ring-1 ring-inset transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-accent',
                    ok ? 'bg-success text-white ring-success' : 'bg-surface ring-line-strong',
                  )}
                >
                  {ok && <IconCheck size={11} strokeWidth="2.6" />}
                </span>
                {p}
              </label>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
