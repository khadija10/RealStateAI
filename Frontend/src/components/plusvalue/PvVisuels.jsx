import { cx } from '../../lib/cx'
import { abattementIR, abattementPS, REGLES_PLUS_VALUE } from '../../lib/fiscalitePlusValue'
import { euro, pct } from '../../lib/format'
import { indice, NOMS_SCENARIOS } from '../../lib/plusValue'
import { Card, IconCheck } from '../ui'

const COULEURS_SCENARIOS = ['var(--color-danger)', 'var(--color-accent)', 'var(--color-success)']
const k = (v) => `${(v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k€`

// ── Cartes de scénarios ─────────────────────────────────────────────────

export function ScenarioCards({ resultats, prix, choix, onChoix }) {
  return (
    <div role="radiogroup" aria-label="Scénario de marché" className="grid gap-3 sm:grid-cols-3">
      {resultats.map((r, i) => {
        const actif = i === choix
        return (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={actif}
            onClick={() => onChoix(i)}
            className={cx(
              'flex flex-col gap-1.5 rounded-[18px] p-4 text-left transition-[box-shadow,background-color,transform] duration-150',
              actif ? 'bg-surface shadow-sm ring-2 ring-ink' : 'bg-surface/70 ring-1 ring-inset ring-line hover:-translate-y-px hover:bg-surface',
            )}
          >
            <span className="flex items-center gap-2 text-[12px] font-medium text-ink-soft">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: COULEURS_SCENARIOS[i] }} />
              {NOMS_SCENARIOS[i]} · {r.nom}
            </span>
            <span className="ds-num text-[22px] font-semibold tracking-[-0.02em] text-ink">
              {pct(r.taux, { digits: 2, signed: true })} <span className="text-[13px] font-medium text-ink-muted">/ an</span>
            </span>
            <span className="text-[12.5px] text-ink-muted">
              Revente <b className="ds-num text-ink">{euro(r.revente)}</b> · {pct(r.revente / prix - 1, { signed: true })}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Éventail des trajectoires ───────────────────────────────────────────

export function FanChart({ serie, scenarios, achat, vente, nomDep, source = 'prix moyen annuel observé (ventes DVF)' }) {
  const L = 900
  const H = 300
  const mg = 52
  const md = 16
  const mb = 34
  const mh = 24
  const debut = serie[0].annee
  const fin = Math.max(vente, serie[serie.length - 1].annee + 1)
  const derniere = serie[serie.length - 1].annee
  const vals = []
  for (let a = debut; a <= fin; a++) scenarios.forEach((s) => vals.push(indice(serie, a, s.taux)))
  const min = Math.min(...vals) * 0.97
  const max = Math.max(...vals) * 1.03
  const x = (a) => mg + ((a - debut) * (L - mg - md)) / (fin - debut)
  const y = (v) => mh + (H - mh - mb) * (1 - (v - min) / (max - min || 1))
  const trace = (t) => {
    let d = ''
    for (let a = derniere; a <= fin; a++) d += `${a === derniere ? 'M' : 'L'}${x(a).toFixed(1)} ${y(indice(serie, a, t)).toFixed(1)} `
    return d
  }
  let zone = `M${x(derniere)} ${y(serie[serie.length - 1].prix)}`
  for (let a = derniere; a <= fin; a++) zone += ` L${x(a).toFixed(1)} ${y(indice(serie, a, scenarios[2].taux)).toFixed(1)}`
  for (let a = fin; a >= derniere; a--) zone += ` L${x(a).toFixed(1)} ${y(indice(serie, a, scenarios[0].taux)).toFixed(1)}`
  const observe = serie.map((s, i) => `${i ? 'L' : 'M'}${x(s.annee)} ${y(s.prix)}`).join(' ')
  const pas = fin - debut > 16 ? 5 : fin - debut > 8 ? 2 : 1
  const graduations = []
  for (let a = debut; a <= fin; a += pas) graduations.push(a)
  const grilles = [0, 1, 2, 3, 4].map((i) => min + ((max - min) * i) / 4)

  return (
    <Card padding="lg" className="rounded-[22px]">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="ds-h3">Trajectoire <em>du prix au m²</em></h3>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">{nomDep} · {source}, puis trois projections</p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-soft">
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-4 rounded bg-ink" />Observé</li>
          {NOMS_SCENARIOS.map((n, i) => (
            <li key={n} className="flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-4 rounded" style={{ background: COULEURS_SCENARIOS[i] }} />{n.replace('Scénario ', '')}</li>
          ))}
        </ul>
      </div>
      <svg viewBox={`0 0 ${L} ${H}`} className="block h-auto w-full" role="img" aria-label={`Prix moyen au m² observé en ${nomDep} de ${debut} à ${derniere}, puis projeté jusqu’en ${fin} selon trois scénarios`}>
        <rect x={x(derniere)} y={mh} width={x(fin) - x(derniere)} height={H - mh - mb} fill="var(--color-accent-soft)" opacity="0.45" />
        {grilles.map((v) => (
          <g key={v}>
            <line x1={mg} x2={L - md} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeDasharray="2 4" />
            <text x={mg - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-muted)">{k(v)}</text>
          </g>
        ))}
        <path d={`${zone} Z`} fill="var(--color-accent)" opacity="0.16" />
        {scenarios.map((s, i) => (
          <path key={s.id} d={trace(s.taux)} fill="none" stroke={COULEURS_SCENARIOS[i]} strokeWidth={i === 1 ? 2.6 : 1.8} strokeDasharray={i === 1 ? undefined : '6 5'} strokeLinecap="round" />
        ))}
        <path d={observe} fill="none" stroke="var(--color-ink)" strokeWidth="2.6" strokeLinejoin="round" />
        {serie.map((s) => <circle key={s.annee} cx={x(s.annee)} cy={y(s.prix)} r="3.8" fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth="2" />)}
        {achat >= debut && achat <= fin && (
          <g>
            <line x1={x(achat)} x2={x(achat)} y1={mh} y2={H - mb} stroke="var(--color-ink)" strokeDasharray="3 4" opacity="0.55" />
            <text x={x(achat) + 6} y={mh + 12} fontSize="11.5" fill="var(--color-ink-muted)">achat</text>
          </g>
        )}
        <line x1={x(vente)} x2={x(vente)} y1={mh} y2={H - mb} stroke="var(--color-accent-ink)" strokeWidth="1.6" />
        <text x={x(vente) - 6} y={mh + 12} textAnchor="end" fontSize="11.5" fontWeight="600" fill="var(--color-accent-ink)">revente</text>
        {graduations.map((a) => <text key={a} x={x(a)} y={H - 12} textAnchor="middle" fontSize="11" fill="var(--color-ink-muted)">{a}</text>)}
      </svg>
    </Card>
  )
}

// ── Fiscalité ───────────────────────────────────────────────────────────

function Ligne({ label, children, fort }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className={cx('text-[13px]', fort ? 'font-semibold text-ink' : 'text-ink-muted')}>{label}</dt>
      <dd className="ds-num whitespace-nowrap text-right text-[13.5px] font-semibold text-ink">{children}</dd>
    </div>
  )
}

export function ImpositionCard({ resultat, horizon }) {
  const i = resultat.impot
  const R = REGLES_PLUS_VALUE
  return (
    <Card padding="lg" className="flex h-full flex-col rounded-[22px]">
      <h3 className="ds-h3">Votre <em>imposition</em></h3>
      <p className="mb-3 mt-0.5 text-[12.5px] text-ink-muted">
        {i.exonere ? 'Résidence principale' : `Détention de ${horizon} an${horizon > 1 ? 's' : ''} · scénario sélectionné`}
      </p>
      {i.exonere ? (
        <div className="flex flex-1 flex-col justify-center gap-2 rounded-[16px] bg-success-soft p-5">
          <p className="flex items-center gap-2 text-[17px] font-semibold text-success"><IconCheck size={18} strokeWidth="2.4" />Exonérée</p>
          <p className="text-[13px] leading-relaxed text-ink-soft">
            La plus-value réalisée sur la résidence principale n’est pas imposée, quelle que soit la durée de détention (CGI art. 150 U).
          </p>
        </div>
      ) : (
        <dl className="divide-y divide-line">
          <Ligne label={resultat.cession < resultat.revente ? 'Prix de cession (après frais de revente)' : 'Prix de revente'}>{euro(resultat.cession ?? resultat.revente)}</Ligne>
          <Ligne label={`Prix d’achat + forfait frais ${pct(R.forfaitFraisAcquisition, { digits: 1 })}`}>− {euro(resultat.prixAchat + i.fraisAcquisition)}</Ligne>
          {i.travauxRetenus > 0 && <Ligne label="Travaux retenus">− {euro(i.travauxRetenus)}</Ligne>}
          <Ligne label="Plus-value imposable" fort>{euro(i.pvImposable)}</Ligne>
          <Ligne label={`Impôt sur le revenu ${pct(R.tauxIR, { digits: 0 })} · abattement ${pct(i.abattementIR, { digits: 0 })}`}>{euro(i.ir)}</Ligne>
          <Ligne label={`Prélèvements sociaux ${pct(R.tauxPS, { digits: 1 })} · abattement ${pct(i.abattementPS, { digits: 0 })}`}>{euro(i.ps)}</Ligne>
          {i.surtaxe > 0 && <Ligne label="Taxe sur les plus-values élevées">{euro(i.surtaxe)}</Ligne>}
          <Ligne label="Impôt total" fort>{euro(i.total)}</Ligne>
        </dl>
      )}
    </Card>
  )
}

export function AbattementsCard({ horizon }) {
  const L = 460
  const H = 220
  const mg = 38
  const mb = 30
  const mh = 16
  const x = (a) => mg + (a * (L - mg - 12)) / 30
  const y = (v) => mh + (H - mh - mb) * (1 - v)
  let ir = ''
  let ps = ''
  for (let a = 0; a <= 30; a++) {
    ir += `${a ? 'L' : 'M'}${x(a)} ${y(abattementIR(a))} `
    ps += `${a ? 'L' : 'M'}${x(a)} ${y(abattementPS(a))} `
  }
  const h = Math.min(30, horizon)
  return (
    <Card padding="lg" className="flex h-full flex-col rounded-[22px]">
      <h3 className="ds-h3">L’effet <em>du temps</em></h3>
      <p className="mb-3 mt-0.5 text-[12.5px] text-ink-muted">
        Abattement selon la durée de détention · à {horizon} an{horizon > 1 ? 's' : ''} :{' '}
        <b className="text-ink">{pct(abattementIR(horizon), { digits: 0 })}</b> sur l’impôt,{' '}
        <b className="text-ink">{pct(abattementPS(horizon), { digits: 0 })}</b> sur les prélèvements
      </p>
      <svg viewBox={`0 0 ${L} ${H}`} className="block h-auto w-full" role="img" aria-label="Abattements pour durée de détention : exonération d’impôt sur le revenu après 22 ans et de prélèvements sociaux après 30 ans">
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={mg} x2={L - 12} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeDasharray={v ? '2 4' : undefined} />
            <text x={mg - 6} y={y(v) + 4} textAnchor="end" fontSize="10.5" fill="var(--color-ink-muted)">{v * 100} %</text>
          </g>
        ))}
        <path d={ir} fill="none" stroke="var(--color-chart-1)" strokeWidth="2.5" />
        <path d={ps} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" />
        <line x1={x(h)} x2={x(h)} y1={mh} y2={H - mb} stroke="var(--color-ink)" strokeDasharray="3 4" opacity="0.6" />
        <circle cx={x(h)} cy={y(abattementIR(h))} r="4.5" fill="var(--color-surface)" stroke="var(--color-chart-1)" strokeWidth="2.5" />
        <circle cx={x(h)} cy={y(abattementPS(h))} r="4.5" fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth="2.5" />
        {[0, 5, 10, 15, 22, 30].map((a) => <text key={a} x={x(a)} y={H - 10} textAnchor="middle" fontSize="10.5" fill="var(--color-ink-muted)">{a} ans</text>)}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-soft">
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-4 rounded bg-chart-1" />Impôt sur le revenu (exonéré après 22 ans)</li>
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-4 rounded bg-accent" />Prélèvements sociaux (après 30 ans)</li>
      </ul>
    </Card>
  )
}

// ── Résilience des secteurs ou des départements ─────────────────────────

/** Variation du prix entre la première et la dernière année observées ; clic = simuler ce lieu. */
export function ResilienceCard({ items, selection, onSelect, titre, aide }) {
  const lignes = [...items].sort((a, b) => b.v - a.v)
  const min = Math.min(0, ...lignes.map((l) => l.v))
  const max = Math.max(0, ...lignes.map((l) => l.v))
  const pos = (v) => ((v - min) / (max - min || 1)) * 100
  const zero = pos(0)
  return (
    <Card padding="lg" className="rounded-[22px]">
      <h3 className="ds-h3">{titre}</h3>
      <p className="mb-4 mt-0.5 text-[12.5px] text-ink-muted">{aide}</p>
      <ul className="grid gap-x-8 gap-y-1 lg:grid-cols-2">
        {lignes.map((l) => {
          const actif = l.cle === selection
          return (
            <li key={l.cle}>
              <button
                type="button"
                aria-pressed={actif}
                onClick={() => onSelect(l.cle)}
                className={cx('grid w-full grid-cols-[minmax(0,10rem)_minmax(0,1fr)_4.5rem] items-center gap-3 rounded-[10px] px-2 py-1.5 text-left text-[12.5px] transition-colors hover:bg-surface-2', actif && 'bg-accent-soft/60')}
              >
                <span className={cx('truncate', actif ? 'font-semibold text-ink' : 'text-ink-soft')} title={l.label}>{l.label}</span>
                <span className="relative h-3" aria-hidden="true">
                  <span className="absolute inset-y-0 w-px bg-ink/40" style={{ left: `${zero}%` }} />
                  <span
                    className={cx('absolute inset-y-0 rounded-[3px]', actif ? 'bg-ink' : l.v < 0 ? 'bg-danger/60' : 'bg-success/60')}
                    style={{ left: `${Math.min(zero, pos(l.v))}%`, width: `${Math.abs(pos(l.v) - zero)}%` }}
                  />
                </span>
                <span className={cx('ds-num text-right font-semibold', l.v < 0 ? 'text-danger' : 'text-success')}>{pct(l.v, { signed: true })}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
