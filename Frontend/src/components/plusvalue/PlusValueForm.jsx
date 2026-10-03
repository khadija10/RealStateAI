import { HYPOTHESES_ACHAT_LOCATION } from '../../lib/acheterLouer'
import { cx } from '../../lib/cx'
import { pct } from '../../lib/format'
import { DEPARTEMENTS } from '../../lib/geo'
import RangeInput from '../simulation/RangeInput'
import PrefillBanner from '../simulation/PrefillBanner'
import SelectField from '../simulation/SelectField'
import { SegmentedControl } from '../ui'

function Bascule({ actif, onClick, children, title }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      title={title}
      className={cx(
        'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-medium transition-colors',
        actif ? 'bg-brand text-on-brand' : 'bg-surface text-ink-soft ring-1 ring-inset ring-line hover:ring-line-strong',
      )}
    >
      <span aria-hidden="true" className={cx('h-1.5 w-1.5 rounded-full', actif ? 'bg-accent' : 'bg-line-strong')} />
      {children}
    </button>
  )
}

/**
 * Acquisition et revente : chaque réglage recalcule les scénarios.
 * `secteurs` : secteurs du département renvoyés par le serveur (vide si
 * l'API ne les fournit pas : la simulation se fait alors au département).
 */
export default function PlusValueForm({ values, onChange, annees, departementsDisponibles, secteurs, prefill, prefillActif, onTogglePrefill }) {
  const set = (k) => (v) => onChange({ ...values, [k]: v })
  const vente = values.achat + values.horizon

  return (
    <form
      aria-label="Votre acquisition et votre horizon de revente"
      onSubmit={(e) => e.preventDefault()}
      className="flex flex-col gap-3 rounded-[22px] bg-surface p-4 shadow-overlay sm:px-5 sm:py-4"
    >
      <PrefillBanner bien={prefill} actif={prefillActif} onToggle={onTogglePrefill} />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-ink-soft">Type de bien</span>
          <SegmentedControl
            label="Type de bien"
            fullWidth
            value={values.type}
            onChange={set('type')}
            options={[{ value: 'apartment', label: 'Appartement' }, { value: 'house', label: 'Maison' }]}
          />
        </div>
        <SelectField label="Année d’achat" value={values.achat} onChange={(v) => set('achat')(Number(v))} options={annees.map((a) => ({ value: a, label: String(a) }))} />
      </div>

      <div className={cx('grid gap-3', secteurs.length ? 'grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]' : 'grid-cols-1')}>
        <SelectField
          label="Département"
          value={values.departement}
          onChange={(dep) => onChange({ ...values, departement: dep, secteur: null })}
          options={departementsDisponibles.map((c) => ({ value: c, label: `${c} · ${DEPARTEMENTS[c] ?? c}` }))}
        />
        {secteurs.length > 0 && (
          <SelectField
            label="Commune ou arrondissement"
            value={values.secteur ?? ''}
            onChange={set('secteur')}
            options={secteurs.map((s) => ({ value: s.code, label: s.nom }))}
          />
        )}
      </div>

      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <RangeInput label="Prix d’achat" min={50000} max={3000000} step={5000} value={values.prix} onChange={set('prix')} />
        <RangeInput label="Revente dans" suffix={`ans · ${vente}`} min={1} max={30} step={1} value={values.horizon} onChange={set('horizon')} />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-[15rem] flex-1 flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-ink-soft">Usage du bien</span>
          <SegmentedControl
            label="Usage du bien"
            fullWidth
            value={values.usage}
            onChange={set('usage')}
            options={[{ value: 'rp', label: 'Résidence principale' }, { value: 'inv', label: 'Investissement' }]}
          />
        </div>
        <Bascule
          actif={values.agence}
          onClick={() => set('agence')(!values.agence)}
          title="Frais d’agence et de diagnostics à la revente, déduits du prix de cession"
        >
          Frais de revente ({pct(HYPOTHESES_ACHAT_LOCATION.fraisRevente, { digits: 0 })})
        </Bascule>
      </div>

      {values.usage === 'inv' && (
        <RangeInput
          className="animate-fade-in"
          label="Travaux réalisés"
          min={0}
          max={500000}
          step={1000}
          value={values.travaux}
          onChange={set('travaux')}
          hint="Au-delà de 5 ans de détention, le forfait de 15 % s’applique s’il est plus favorable."
        />
      )}
    </form>
  )
}
