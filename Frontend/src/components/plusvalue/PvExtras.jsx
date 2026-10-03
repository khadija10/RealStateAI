import { cx } from '../../lib/cx'
import { HYPOTHESES_ACHAT_LOCATION } from '../../lib/acheterLouer'
import { euro, nb, pct } from '../../lib/format'
import { nomDepartement } from '../../lib/geo'
import { NOMS_SCENARIOS, periodesHistoriques } from '../../lib/plusValue'
import { Card, Skeleton } from '../ui'

const DEPUIS_RECENT = 2010

/**
 * Prix de revente minimum pour couvrir prix d'achat, frais et impôt, et
 * fréquence à laquelle le passé a dépassé ce rythme (indice Notaires-INSEE).
 */
export function SeuilCard({ seuil, minimum, scenarios, horizonProjete, indice, dep, typeBien, observe }) {
  const atteints = Number.isFinite(seuil) ? scenarios.map((s, i) => (s.taux >= seuil - 1e-9 ? i : -1)).filter((i) => i >= 0) : []
  const periodes = indice.data && horizonProjete >= 1 && Number.isFinite(seuil) ? periodesHistoriques(indice.data, horizonProjete) : []
  const part = periodes.length ? periodes.filter((p) => p.taux >= seuil).length / periodes.length : null
  const recentes = periodes.filter((p) => p.debut >= DEPUIS_RECENT)
  const partRecente = recentes.length >= 12 ? recentes.filter((p) => p.taux >= seuil).length / recentes.length : null
  const tri = [...periodes].sort((a, b) => a.taux - b.taux)

  return (
    <Card padding="lg" className="flex h-full flex-col rounded-[22px]">
      <h3 className="ds-h3">Le seuil, <em>face au passé</em></h3>
      <p className="mb-3 mt-0.5 text-[12.5px] text-ink-muted">Prix de revente minimum pour ne pas perdre d’argent : prix d’achat, frais et impôt couverts.</p>

      {observe ? (
        <p className="text-[13px] text-ink-muted">Revente dans la période déjà observée : le résultat est connu, il n’y a rien à projeter.</p>
      ) : minimum == null ? (
        <p className="text-[13px] text-ink-muted">Seuil indisponible : il nécessite les frais d’acquisition calculés par le serveur.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
            <p className="ds-num text-[30px] font-semibold leading-none tracking-[-0.03em] text-ink">
              {Number.isFinite(seuil) ? euro(minimum) : seuil > 0 ? 'Hors de portée' : 'Déjà couvert'}
            </p>
            {Number.isFinite(seuil) && (
              <p className="pb-0.5 text-[13px] text-ink-soft">
                soit <b className="ds-num text-ink">{pct(seuil, { signed: true })}</b> par an
              </p>
            )}
          </div>
          <p className="mt-2 text-[13px] text-ink-soft">
            {atteints.length === 3
              ? 'Atteint dans les trois scénarios de marché.'
              : atteints.length === 0
                ? 'Atteint dans aucun des trois scénarios de marché.'
                : `Atteint seulement dans le ${atteints.map((i) => NOMS_SCENARIOS[i].toLowerCase()).join(' et le ')}.`}
          </p>

          <div className="mt-4 border-t border-line pt-4">
            {indice.loading ? (
              <Skeleton className="h-32 w-full" />
            ) : indice.error || !indice.data ? (
              <p className="text-[12.5px] text-ink-muted">Indice historique indisponible pour ce département.</p>
            ) : !periodes.length ? (
              <p className="text-[12.5px] text-ink-muted">L’indice ne remonte pas assez loin pour observer des périodes de {horizonProjete} ans.</p>
            ) : (
              <HistoireIndice
                periodes={periodes}
                seuil={seuil}
                part={part}
                partRecente={partRecente}
                ans={horizonProjete}
                pire={tri[0]}
                meilleure={tri[tri.length - 1]}
                source={`Indice Notaires-INSEE · ${nomDepartement(dep)}, ${indice.data.type_reel === 'house' ? 'maisons' : 'appartements'}${dep === '75' && typeBien === 'house' ? ' (pas d’indice maisons à Paris)' : ''}`}
              />
            )}
          </div>
        </>
      )}
    </Card>
  )
}

function HistoireIndice({ periodes, seuil, part, partRecente, ans, pire, meilleure, source }) {
  const L = 460
  const H = 170
  const mg = 40
  const md = 8
  const mh = 10
  const mb = 24
  const valeurs = periodes.map((x) => x.taux).concat(seuil, 0)
  const min = Math.min(...valeurs)
  const max = Math.max(...valeurs)
  const ecart = max - min || 0.01
  const y = (v) => mh + (H - mh - mb) * (1 - (v - min) / ecart)
  const pasX = (L - mg - md) / periodes.length
  const a0 = Math.floor(periodes[0].debut)
  const a1 = Math.floor(periodes[periodes.length - 1].debut)
  const ticks = []
  for (let a = Math.ceil(a0 / 5) * 5; a <= a1; a += 5) ticks.push(a)
  const xA = (a) => mg + ((a - periodes[0].debut) * 4 + 0.5) * pasX
  const depuis = a0
  const libellePeriode = (x) => `${Math.floor(x.debut)}–${Math.floor(x.debut) + ans}`
  return (
    <div>
      <p className="text-[13px] text-ink-soft">
        <b className="text-[18px] font-semibold text-ink">{Math.round(100 * part)} %</b> des périodes de {ans} ans depuis {depuis} ont dépassé ce rythme
        {partRecente != null && <>, <b className="text-ink">{Math.round(100 * partRecente)} %</b> de celles commencées depuis {DEPUIS_RECENT}</>}.
      </p>
      <p className="mb-1 mt-0.5 text-[11.5px] text-ink-muted">{source} · {periodes.length} périodes</p>
      <svg viewBox={`0 0 ${L} ${H}`} className="block h-auto w-full" role="img" aria-label={`Croissance annuelle des prix sur chaque période de ${ans} ans depuis ${depuis}, comparée au seuil de ${pct(seuil)} par an`}>
        {[min, 0, max].filter((v, i, t) => t.indexOf(v) === i).map((v) => (
          <g key={v}>
            <line x1={mg} x2={L - md} y1={y(v)} y2={y(v)} stroke="var(--color-line)" />
            <text x={mg - 6} y={y(v) + 4} textAnchor="end" fontSize="10.5" fill="var(--color-ink-muted)">{pct(v, { digits: 0, signed: true })}</text>
          </g>
        ))}
        {periodes.map((x, i) => (
          <rect
            key={i}
            x={(mg + i * pasX).toFixed(1)}
            width={Math.max(1, pasX - 0.6).toFixed(1)}
            y={Math.min(y(x.taux), y(0)).toFixed(1)}
            height={Math.max(0.5, Math.abs(y(x.taux) - y(0))).toFixed(1)}
            fill={x.taux >= seuil ? 'var(--color-success)' : 'var(--color-taupe)'}
            opacity={x.taux >= seuil ? 0.85 : 0.55}
          />
        ))}
        <line x1={mg} x2={L - md} y1={y(seuil)} y2={y(seuil)} stroke="var(--color-accent-ink)" strokeWidth="1.8" strokeDasharray="6 4" />
        <text x={L - md} y={y(seuil) - 5} textAnchor="end" fontSize="10.5" fontWeight="600" fill="var(--color-accent-ink)">seuil {pct(seuil, { signed: true })}</text>
        {ticks.map((a) => <text key={a} x={xA(a)} y={H - 6} textAnchor="middle" fontSize="10.5" fill="var(--color-ink-muted)">{a}</text>)}
      </svg>
      <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">
        Chaque barre : achat au trimestre indiqué, revente {ans} ans plus tard. Pire période {libellePeriode(pire)} : {pct(pire.taux, { signed: true })}/an ;
        meilleure {libellePeriode(meilleure)} : {pct(meilleure.taux, { signed: true })}/an. Une fréquence passée, pas une probabilité.
      </p>
    </div>
  )
}

/** « Et si vous louiez ? » : loyer de référence d'un bien équivalent (carte des loyers ANIL, servie par le serveur). */
export function LoyerCard({ secteur, prix, surfaceConnue, horizon, residencePrincipale }) {
  const l = secteur?.loyer
  const H = HYPOTHESES_ACHAT_LOCATION
  if (!l) {
    return (
      <Card padding="lg" className="flex h-full flex-col rounded-[22px]">
        <h3 className="ds-h3">Et si vous <em>louiez</em> ?</h3>
        <p className="mt-2 text-[13px] text-ink-muted">Loyer de référence indisponible pour ce secteur.</p>
      </Card>
    )
  }
  const surface = surfaceConnue ?? prix / secteur.med
  const mois = surface * l.m2
  let cumul = 0
  for (let a = 0; a < horizon; a++) cumul += 12 * mois * (1 + H.hausseLoyer) ** a
  const arrondi = (n) => euro(Math.round(n / 10) * 10)
  return (
    <Card padding="lg" className="flex h-full flex-col rounded-[22px]">
      <h3 className="ds-h3">Et si vous <em>louiez</em> ?</h3>
      <p className="mb-3 mt-0.5 text-[12.5px] text-ink-muted">
        Carte des loyers (ANIL) · {l.niveau === 'commune' ? `${nb(l.annonces)} annonces de la commune` : 'estimé sur les communes voisines'}
      </p>
      <p className="text-[13px] text-ink-soft">
        <b className="ds-num text-[22px] font-semibold tracking-[-0.02em] text-ink">≈ {arrondi(mois)}</b> par mois, charges comprises,
        pour {surfaceConnue ? '' : 'environ '}{Math.round(surface)} m² ({arrondi(surface * l.bas)} à {arrondi(surface * l.haut)}).
      </p>
      <dl className="mt-3 divide-y divide-line text-[13px]">
        <div className="flex justify-between gap-3 py-2"><dt className="text-ink-muted">Loyer au m²</dt><dd className="ds-num font-semibold">{l.m2.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} € / mois</dd></div>
        <div className="flex justify-between gap-3 py-2"><dt className="text-ink-muted">Rendement locatif brut</dt><dd className="ds-num font-semibold">{pct((12 * mois) / prix)} / an</dd></div>
        <div className="flex justify-between gap-3 py-2"><dt className="text-ink-muted">Loyers sur {horizon} an{horizon > 1 ? 's' : ''} (+{pct(H.hausseLoyer, { digits: 0 })} par an)</dt><dd className="ds-num font-semibold">{euro(cumul)}</dd></div>
      </dl>
      <p className={cx('mt-auto pt-3 text-[12px] leading-relaxed text-ink-muted')}>
        {residencePrincipale
          ? 'C’est ce que coûterait la location d’un bien équivalent pendant la détention. L’achat évite ce loyer mais coûte les intérêts, la taxe foncière et l’entretien : le simulateur de financement calcule à partir de quand l’achat devient plus avantageux.'
          : 'Ce que le bien pourrait rapporter en loyers bruts, avant charges, vacance locative et impôts.'}
        {surfaceConnue ? '' : ' Surface déduite du prix et de la médiane du secteur.'}
      </p>
    </Card>
  )
}
