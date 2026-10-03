import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { METHODES } from '../../api/normalize'
import { CLASSES_FIABILITE } from '../../lib/estimation'
import { useAuth } from '../../context/AuthContext'
import { useHealth } from '../../context/HealthContext'
import { cx } from '../../lib/cx'
import { dateLongue, euro, euroM2, nb, pct, pctPoints } from '../../lib/format'
import { lienPartage } from '../../lib/estimationExport'
import { exporterRapport } from '../../lib/rapportPdf'
import { useDepartmentTrend } from '../../hooks/useMarketData'
import {
  Button,
  Card,
  IconArrowRight,
  IconHistory,
  IconMap,
  IconMinus,
  IconPlus,
  IconTrend,
  IconWallet,
  useToast,
} from '../ui'

function StepCard({ icon: Icon, title, description, onClick, to, cta }) {
  const Comp = to ? Link : 'button'
  return (
    <Comp
      to={to}
      type={to ? undefined : 'button'}
      onClick={onClick}
      className={cx(
        'group flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-5 text-left shadow-xs',
        'transition-[border-color,box-shadow,transform] duration-200 ease-soft hover:-translate-y-px hover:border-line-strong hover:shadow-sm',
      )}
    >
      <span className="grid h-10 w-10 place-items-center rounded-control bg-accent-soft text-accent-ink">
        <Icon size={20} />
      </span>
      <span className="font-medium text-ink">{title}</span>
      <span className="text-sm text-ink-muted">{description}</span>
      <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-ink">
        {cta}
        <IconArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
      </span>
    </Comp>
  )
}

/** Suite du parcours : financer, anticiper la revente, situer, retrouver. */
export function NextSteps({ r, values, lieu, description, at, stats, dep }) {
  const navigate = useNavigate()
  const { user, openAuth, requireAuth } = useAuth()
  const toast = useToast()
  const { health } = useHealth()
  const tendance = useDepartmentTrend(dep)
  // Bien repris par les simulateurs : prix, département (renvoyé par le
  // serveur ou déduit du code postal), libellés. Une estimation de
  // démonstration n'est jamais reprise comme prix.
  const bien = {
    prix: r.price,
    departement: r.codeDepartement ?? dep ?? null,
    lieu,
    description,
    at,
    demo: r.isDemo,
    type: values.type,
    surface: Number(values.surface) || null,
    secteur: r.secteur?.code ?? r.codeCommune ?? null,
    historiqueId: r.historiqueId,
  }

  async function copierLien() {
    try {
      await navigator.clipboard.writeText(lienPartage(values))
      toast.success('Lien copié : il relance cette estimation à l’ouverture.')
    } catch {
      toast.error('Impossible de copier le lien depuis ce navigateur.')
    }
  }

  function pdf() {
    const ok = exporterRapport({
      r,
      values,
      lieu,
      description,
      at,
      stats,
      dep,
      trendRows: tendance.rows,
      health,
    })
    if (!ok) toast.error('Autorisez les fenêtres pop-up pour exporter le rapport en PDF.')
  }

  return (
    <section aria-labelledby="titre-suite">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h2 id="titre-suite" className="ds-h2">Et <em>maintenant</em> ?</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={pdf} disabled={Boolean(dep) && tendance.loading}>Exporter le rapport PDF</Button>
          <Button variant="secondary" size="sm" onClick={copierLien}>Copier le lien</Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StepCard
          icon={IconWallet}
          title="Financer ce bien"
          description="Capacité d’emprunt, mensualités et frais, selon les normes HCSF."
          cta="Simuler le financement"
          onClick={() => requireAuth(() => navigate('/financement', { state: { prefill: bien } }))}
        />
        <StepCard
          icon={IconTrend}
          title="Anticiper la revente"
          description="Scénarios de plus-value et fiscalité selon la durée de détention."
          cta="Simuler la plus-value"
          onClick={() => requireAuth(() => navigate('/plus-value', { state: { prefill: bien } }))}
        />
        <StepCard
          icon={IconMap}
          title="Situer sur la carte"
          description="Comparez les prix au m² des communes voisines."
          cta="Voir la carte des prix"
          to="/marche/carte"
        />
        {user ? (
          <StepCard
            icon={IconHistory}
            title="Retrouver cette estimation"
            description="Elle est enregistrée dans votre historique pour la comparer à d’autres biens."
            cta="Ouvrir l’historique"
            to="/historique"
          />
        ) : (
          <StepCard
            icon={IconHistory}
            title="Conserver vos estimations"
            description="Connectez-vous pour les enregistrer et les comparer sur tous vos appareils."
            cta="Se connecter"
            onClick={openAuth}
          />
        )}
      </div>
    </section>
  )
}

/** Ligne « libellé — valeur » d'un panneau de méthodologie. */
function Ligne({ label, children }) {
  const [titre, precision] = Array.isArray(label) ? label : [label]
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="min-w-0 text-[12px] leading-snug text-ink-muted">
        {titre}
        {precision && <span className="block text-[11px] text-ink-muted/80">{precision}</span>}
      </dt>
      <dd className="ds-num shrink-0 whitespace-nowrap text-right text-[12.5px] font-semibold leading-snug text-ink">{children}</dd>
    </div>
  )
}

/** Panneau teinté : surtitre, lignes de détail, note. */
function Panneau({ titre, lignes, note }) {
  if (!lignes.length && !note) return null
  return (
    <section className="flex flex-col rounded-[16px] bg-accent-soft/45 p-3.5 ring-1 ring-inset ring-accent/15 xl:p-4">
      <h3 className="mb-1 text-[11.5px] font-bold uppercase tracking-[0.12em] text-ink">{titre}</h3>
      {lignes.length > 0 && (
        <dl className="divide-y divide-accent/15">
          {lignes.map(([k, v]) => <Ligne key={String(k)} label={k}>{v}</Ligne>)}
        </dl>
      )}
      {note && <p className="mt-2 border-t border-accent/15 pt-2 text-[11px] leading-relaxed text-ink-muted">{note}</p>}
    </section>
  )
}

/**
 * « Détails du calcul » : bandeau fermé par défaut, ouvert au clic, puis
 * quatre panneaux. Valeurs tirées de la
 * réponse d'estimation, de /api/market/map (commune) et de /api/health (modèle).
 */
export function TechnicalDetails({ r, values, stats }) {
  const [open, setOpen] = useState(false)
  const carteRef = useRef(null)

  function basculer() {
    const ouvrir = !open
    setOpen(ouvrir)
    if (ouvrir) requestAnimationFrame(() => carteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }
  const { health } = useHealth()
  const m = health?.model?.loaded ? health.model : null
  const dvf = r.method === 'dvf'

  const calcul = [
    r.pricePerM2 != null && ['Prix au m² estimé', euroM2(r.pricePerM2)],
    ['Surface retenue', `${values.surface} m²`],
    values.rooms && ['Pièces', values.rooms],
    stats?.prix_m2_median != null && [['Médiane de la commune', stats.nom_commune], euroM2(stats.prix_m2_median)],
    r.price != null && ['Valeur estimée', euro(r.price)],
  ].filter(Boolean)

  const modele = [
    ['Méthode', r.method === 'ml' ? 'LightGBM' : METHODES[r.method].label],
    m?.nFeatures != null && ['Variables', nb(m.nFeatures)],
    m?.trainedAt && ['Entraîné le', dateLongue(m.trainedAt)],
    m?.nTrain != null && ['Ventes d’entraînement', nb(m.nTrain)],
    m?.nTransactions != null && ['Ventes analysées', nb(m.nTransactions)],
  ].filter(Boolean)

  const v = m?.validation
  const erreur = [
    r.localMape != null && [['Dans cette commune', r.localMapeN ? `${nb(r.localMapeN)} ventes de contrôle` : null], pctPoints(r.localMape)],
    (v?.mape ?? m?.mape) != null && ['En Île-de-France', pctPoints(v?.mape ?? m.mape)],
    v?.dans10 != null && ['À moins de 10 % du prix', pctPoints(v.dans10, 0)],
    v?.dans20 != null && ['À moins de 20 % du prix', pctPoints(v.dans20, 0)],
    m?.r2 != null && ['R² (jeu de test)', m.r2.toLocaleString('fr-FR', { maximumFractionDigits: 3 })],
    (v?.nTest ?? m?.nTest) != null && [['Ventes de contrôle', v?.periode ? `${v.periode[0]} → ${v.periode[v.periode.length - 1]}` : null], nb(v?.nTest ?? m.nTest)],
    v?.couverture != null && ['Couverture de la fourchette', pctPoints(v.couverture)],
    r.confidenceLabel && r.rangeBasis !== 'heuristique' && ['Fourchette', `à ${r.confidenceLabel.replace('%', ' %')}`],
    r.reliability != null && ['Indice de fiabilité', `${Math.round(r.reliability * 100)} / 100`],
  ].filter(Boolean)

  const donnees = [
    ['Méthode retenue', METHODES[r.method].label],
    r.classeFiabilite && ['Classe de fiabilité', CLASSES_FIABILITE[r.classeFiabilite]?.titre ?? r.classeFiabilite],
    dvf && r.meta.scope && ['Périmètre', r.meta.scopeValue ? `${r.meta.scope} · ${r.meta.scopeValue}` : r.meta.scope],
    dvf && r.meta.nTransactions && ['Ventes comparables', nb(r.meta.nTransactions)],
    dvf && r.meta.dispersion != null && ['Dispersion des prix', pct(r.meta.dispersion)],
    dvf && r.meta.surfaceTolerance != null && ['Tolérance de surface', `± ${pct(r.meta.surfaceTolerance, { digits: 0 })}`],
    r.address && [['Adresse normalisée', r.address], 'BAN'],
    r.codeCommune && ['Code commune', r.codeCommune],
    (r.dpeClasse || values.dpe) && [
      r.dpeSource === 'adresse' || r.dpeSource === 'numero'
        ? ['Classe DPE', r.dpeSource === 'adresse' ? `retrouvée à l’adresse${r.dpeAppariement === 'probable' ? ' (appariement probable)' : ''}` : 'retrouvée par son numéro']
        : 'Classe DPE transmise',
      r.dpeClasse ?? values.dpe,
    ],
    r.dpeDate && ['Date du diagnostic', dateLongue(r.dpeDate)],
    r.codePostal && ['Code postal', r.codePostal],
    r.comparables.length > 0 && ['Ventes dans l’immeuble', nb(r.comparables.length)],
    (r.anneeConstruction || values.annee) && ['Année transmise', String(r.anneeConstruction ?? values.annee)],
    r.dpeZonePct != null && ['Logements F/G (code postal)', pctPoints(r.dpeZonePct)],
  ].filter(Boolean)

  return (
    <Card ref={carteRef} padding="none" className="scroll-my-4 overflow-hidden rounded-[22px]">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="detail-calcul"
          onClick={basculer}
          className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-2/70 sm:px-6"
        >
          <span className="min-w-0">
            <span className="block text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink">Détails du calcul</span>
            <span className="mt-0.5 block text-[13px] text-ink-muted">
              {open ? 'Calcul, modèle, mesure de l’erreur et données utilisées' : 'Cliquez pour voir le calcul, le modèle et la mesure de l’erreur'}
            </span>
          </span>
          <span
            aria-hidden="true"
            className={cx(
              'grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1 ring-inset transition-colors',
              open ? 'text-ink-muted ring-line group-hover:text-ink' : 'bg-brand text-on-brand ring-transparent',
            )}
          >
            {open ? <IconMinus size={14} strokeWidth="2" /> : <IconPlus size={14} strokeWidth="2" />}
          </span>
        </button>
      </h2>
      <div id="detail-calcul" hidden={!open} className="grid gap-2.5 px-4 pb-4 animate-fade-in sm:grid-cols-2 sm:px-5 sm:pb-5 lg:grid-cols-4">
        <Panneau
          titre="Le calcul"
          lignes={calcul}
          note={r.low != null && r.high != null ? `Fourchette : ${euro(r.low)} – ${euro(r.high)}.` : null}
        />
        <Panneau
          titre="Le modèle"
          lignes={modele}
          note={
            r.method === 'ml'
              ? 'Gradient boosting entraîné sur les ventes notariées DVF d’Île-de-France ; l’adresse est géolocalisée par la Base Adresse Nationale.'
              : r.method === 'dvf'
                ? 'Médiane des ventes DVF comparables ; le modèle ML n’a pas été utilisé pour ce bien.'
                : 'Aucune donnée exploitable : heuristique de démonstration, sans valeur d’estimation.'
          }
        />
        <Panneau
          titre="La mesure de l’erreur"
          lignes={erreur}
          note={m ? 'Mesurée sur des ventes que le modèle n’a jamais vues pendant son entraînement.' : null}
        />
        <Panneau
          titre="Données de l’estimation"
          lignes={donnees}
          note={r.meta.notes.length ? `Serveur : ${r.meta.notes.join(' · ')}` : null}
        />
      </div>
    </Card>
  )
}
