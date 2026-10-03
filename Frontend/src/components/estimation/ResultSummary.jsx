import { METHODES } from '../../api/normalize'
import { useHealth } from '../../context/HealthContext'
import { useCountUp } from '../../hooks/useCountUp'
import { vignetteInterieur } from '../../illustrations'
import { cx } from '../../lib/cx'
import { dateHeure, dateLongue, euro, nb, pct, pctPoints } from '../../lib/format'
import { Badge, Card, IconAlert, IconMap, Illustration } from '../ui'
import { CLASSES_FIABILITE, descriptionBien, DPE_COULEURS, libelleFourchette, libelleLieu, niveauFiabilite } from '../../lib/estimation'
import { RangeBar, ReliabilityRing } from './visuals'

const METHOD_DOT = { ml: 'bg-[#6FD39C]', dvf: 'bg-[#8FAACB]', mock: 'bg-[#E0A650]' }

/** Tuile translucide du bloc sombre (valeur + libellé). */
function Mesure({ value, label }) {
  return (
    <div className="rounded-[14px] border border-white/15 bg-white/10 px-3.5 py-3 backdrop-blur-sm">
      <p className="ds-num whitespace-nowrap text-[19px] font-semibold leading-none tracking-[-0.02em] text-white sm:text-[22px]">{value}</p>
      <p className="mt-1.5 text-[11px] leading-snug text-white/80">{label}</p>
    </div>
  )
}

/**
 * Bloc principal, sur l'illustration de la marque : prix estimé, fourchette,
 * prix au m² et, quand /api/market/map couvre la commune, médiane et écart.
 */
export function ResultSummary({ r, values, at, stats }) {
  const animated = useCountUp(r.price)
  // Médiane du secteur renvoyée avec l'estimation (même type de bien, ancien) ; à défaut, celle de la commune.
  const mediane = r.secteur?.med ?? stats?.prix_m2_median ?? null
  const libelleMediane = r.secteur ? 'Médiane du secteur (€/m²)' : 'Médiane de la commune (€/m²)'
  const ecart = !r.isDemo && r.pricePerM2 != null && mediane ? r.pricePerM2 / mediane - 1 : null
  const mesures = [
    r.pricePerM2 != null && { value: nb(r.pricePerM2), label: '€ par m²' },
    mediane != null && { value: nb(mediane), label: libelleMediane },
    ecart != null && { value: pct(ecart, { digits: 0, signed: true }), label: 'Écart à la médiane' },
  ].filter(Boolean)

  return (
    <div className="@container relative isolate flex h-full flex-col justify-between gap-6 overflow-hidden rounded-[22px] bg-[#3A2B21] p-6 text-white sm:p-7">
      <Illustration draw={vignetteInterieur} className="absolute inset-0 -z-20 opacity-90" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(40,28,20,.30)_0%,rgba(40,28,20,.86)_62%)]" />

      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="flex min-w-0 items-start gap-2 text-[13px] text-white/80">
            <IconMap size={15} className="mt-0.5 shrink-0" />
            <span className="min-w-0 break-words">
              <span className="text-[15px] font-semibold text-white">{libelleLieu(r, values)}</span>
              <span className="mt-0.5 block text-white/80">{descriptionBien(values)}</span>
                {r.dpeClasse && (r.dpeSource === 'adresse' || r.dpeSource === 'numero') && (
                  <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2 py-0.5 text-[11.5px] text-white/85 ring-1 ring-inset ring-white/15">
                    <span
                      className="rounded-[4px] px-1 text-[10.5px] font-semibold"
                      style={{ background: DPE_COULEURS[r.dpeClasse]?.fond, color: DPE_COULEURS[r.dpeClasse]?.texte }}
                    >
                      DPE {r.dpeClasse}
                    </span>
                    {r.dpeSource === 'adresse' ? 'retrouvé à l’adresse' : 'retrouvé par son numéro'} · ADEME
                    {r.dpeDate ? ` · ${dateLongue(r.dpeDate)}` : ''}
                  </span>
                )}
            </span>
          </p>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11.5px] font-medium text-white backdrop-blur-sm">
            <span className={cx('h-1.5 w-1.5 rounded-full', METHOD_DOT[r.method])} />
            {METHODES[r.method].label}
          </span>
        </div>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Valeur estimée</p>
        {/* Taille relative à la largeur du bloc : montant et « € » toujours sur une ligne. */}
        <p className="ds-num mt-1.5 whitespace-nowrap text-[clamp(2.25rem,14cqi,4.75rem)] font-semibold leading-none tracking-[-0.04em] text-white [text-shadow:0_2px_24px_rgba(0,0,0,.25)]">
          {euro(animated)}
        </p>

        {r.low != null && r.high != null && r.price != null && (
          <div className="mt-5 max-w-md">
            <p className="mb-2.5 text-[13px] font-medium text-white/85">{libelleFourchette(r)}</p>
            <RangeBar low={r.low} high={r.high} value={r.price} format={euro} tone="dark" />
          </div>
        )}
      </div>

      <div>
        {mesures.length > 0 && (
          <div className={cx('grid gap-2', mesures.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
            {mesures.map((m) => <Mesure key={m.label} {...m} />)}
          </div>
        )}
        {r.geocodingWarning && (
          <p className="mt-3 flex gap-1.5 text-[12px] leading-snug text-[#F3C98B]">
            <IconAlert size={14} className="mt-px shrink-0" />
            {r.geocodingWarning}
          </p>
        )}
        <p className="mt-3 text-[11.5px] text-white/60">
          Calculée le {dateHeure(at)} · résultat indicatif, sans valeur d’expertise.
        </p>
      </div>
    </div>
  )
}

/** Fiabilité : indice du serveur + erreur mesurée du modèle. */
export function ReliabilityCard({ r, embedded = false }) {
  const { health } = useHealth()
  const classe = CLASSES_FIABILITE[r.classeFiabilite]
  const lvl = classe ? { label: classe.titre, tone: classe.ton } : niveauFiabilite(r.reliability)
  const validation = health?.model?.validation
  const mapeGlobale = validation?.mape ?? health?.model?.mape

  let explication
  if (r.isDemo) {
    explication = 'Aucune donnée réelle n’a été utilisée : cet indice est volontairement minimal.'
  } else if (r.method === 'ml' && r.localMape != null) {
    explication = (
      <>
        Sur cette commune, l’erreur médiane du modèle est de <b className="text-ink">{pctPoints(r.localMape)}</b>
        {r.localMapeN ? <>, mesurée sur <b className="text-ink">{nb(r.localMapeN)}</b> ventes de contrôle</> : null}.
      </>
    )
  } else if (r.method === 'ml' && mapeGlobale != null) {
    explication = (
      <>
        Pas de mesure locale pour cette commune. En Île-de-France, l’erreur moyenne du modèle est
        de <b className="text-ink">{pctPoints(mapeGlobale)}</b>
        {validation?.dans20 != null && <> ; {pctPoints(validation.dans20, 0)} des estimations tombent à moins de 20 % du prix</>}.
      </>
    )
  } else if (r.method === 'dvf' && r.meta.nTransactions) {
    explication = (
      <>
        Calculée sur <b className="text-ink">{nb(r.meta.nTransactions)}</b> ventes comparables
        {r.meta.scopeValue ? <> ({r.meta.scopeValue})</> : null}. Plus elles sont nombreuses et homogènes, plus
        l’indice est élevé.
      </>
    )
  }

  const contenu = (
    <>
      <div className="flex items-center justify-between gap-3">
        <h3 className="ds-h3">Fiabilité <em>de l’estimation</em></h3>
        {lvl && <Badge tone={lvl.tone}>{lvl.label}</Badge>}
      </div>
      <div className="flex items-center gap-5">
        <ReliabilityRing value={r.reliability} size={embedded ? 104 : 120} />
        <div className="text-sm leading-relaxed text-ink-muted">
          <p>{classe ? <><b className="font-medium text-ink">{classe.titre}</b> : {classe.texte}</> : 'Indice de confiance fourni par le serveur pour cette estimation, de 0 à 100.'}</p>
          {embedded && explication && <p className="mt-2 text-ink-soft">{explication}</p>}
        </div>
      </div>
      {!embedded && explication && <p className="border-t border-line pt-4 text-sm leading-relaxed text-ink-soft">{explication}</p>}
    </>
  )
  if (embedded) return <div className="flex flex-col gap-3">{contenu}</div>
  return <Card padding="lg" className="flex h-full flex-col gap-5">{contenu}</Card>
}
