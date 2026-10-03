import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { METHODES } from '../../api/normalize'
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
  IconCheck,
  IconChevronDown,
  IconHistory,
  IconMap,
  IconTrend,
  IconWallet,
  useToast,
} from '../ui'
import { DetailRow } from './visuals'

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
  const { user, openAuth } = useAuth()
  const toast = useToast()
  const { health } = useHealth()
  const tendance = useDepartmentTrend(dep)
  // Ce que les simulateurs actuels savent reprendre : le prix et, pour la
  // plus-value, le code de la commune (arrondissements parisiens).
  const bien = { prix: r.price, secteur: r.codeCommune, departement: r.codeDepartement, lieu }

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
          onClick={() => navigate('/financement', { state: { prefill: bien } })}
        />
        <StepCard
          icon={IconTrend}
          title="Anticiper la revente"
          description="Scénarios de plus-value et fiscalité selon la durée de détention."
          cta="Simuler la plus-value"
          onClick={() => navigate('/plus-value', { state: { prefill: bien } })}
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

/** Détail du calcul : réponse du serveur et métriques du modèle (/api/health). */
export function TechnicalDetails({ r, values }) {
  const [open, setOpen] = useState(false)
  const { health } = useHealth()
  const m = health?.model

  const calcul = [
    ['Méthode', `${METHODES[r.method].label} — ${METHODES[r.method].detail}`],
    r.address && ['Adresse normalisée (BAN)', r.address],
    r.codeCommune && ['Code commune (INSEE)', r.codeCommune],
    ['Surface retenue', `${values.surface} m²`],
    r.pricePerM2 != null && ['Prix au m² estimé', euroM2(r.pricePerM2)],
    r.low != null && ['Fourchette', `${euro(r.low)} – ${euro(r.high)}`],
    r.meta.nTransactions && ['Ventes comparables', nb(r.meta.nTransactions)],
    r.meta.dispersion != null && r.method === 'dvf' && ['Dispersion des prix', pct(r.meta.dispersion)],
    r.dpeClasse && ['Classe DPE transmise', r.dpeClasse],
    r.anneeConstruction && ['Année de construction transmise', String(r.anneeConstruction)],
    r.dpeZonePct != null && ['Logements F/G dans le code postal', pctPoints(r.dpeZonePct)],
  ].filter(Boolean)

  const modele = m?.loaded
    ? [
        m.mape != null && ['Erreur moyenne (MAPE)', pctPoints(m.mape)],
        m.r2 != null && ['R² (jeu de test)', m.r2.toLocaleString('fr-FR', { maximumFractionDigits: 3 })],
        m.nFeatures != null && ['Variables', String(m.nFeatures)],
        m.nTrain != null && ['Ventes d’entraînement', nb(m.nTrain)],
        m.nTest != null && ['Ventes de test', nb(m.nTest)],
        m.trainedAt && ['Entraîné le', dateLongue(m.trainedAt)],
      ].filter(Boolean)
    : []

  return (
    <Card padding="none">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="detail-calcul"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span>
          <span className="block font-medium text-ink">Détail du calcul</span>
          <span className="block text-sm text-ink-muted">Données renvoyées par le serveur et performances du modèle</span>
        </span>
        <IconChevronDown size={18} className={cx('shrink-0 text-ink-muted transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <div id="detail-calcul" hidden={!open} className="border-t border-line px-6 pb-6 pt-2">
        <div className="grid gap-x-10 md:grid-cols-2">
          <div>
            <p className="ds-eyebrow mb-1 mt-4">Cette estimation</p>
            <dl className="divide-y divide-line">
              {calcul.map(([k, v]) => <DetailRow key={k} label={k}>{v}</DetailRow>)}
            </dl>
          </div>
          {modele.length > 0 && (
            <div>
              <p className="ds-eyebrow mb-1 mt-4">Modèle de prédiction</p>
              <dl className="divide-y divide-line">
                {modele.map(([k, v]) => <DetailRow key={k} label={k}>{v}</DetailRow>)}
              </dl>
            </div>
          )}
        </div>
        {r.meta.notes.length > 0 && (
          <div className="mt-5">
            <p className="ds-eyebrow mb-2">Remarques du serveur</p>
            <ul className="flex flex-col gap-1.5 text-sm text-ink-soft">
              {r.meta.notes.map((n) => (
                <li key={n} className="flex gap-2"><IconCheck size={15} className="mt-0.5 shrink-0 text-ink-muted" />{n}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  )
}
