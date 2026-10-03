import { DEPARTEMENTS } from '../../lib/geo'
import RangeInput from '../simulation/RangeInput'
import PrefillBanner from '../simulation/PrefillBanner'
import SelectField from '../simulation/SelectField'
import { SegmentedControl } from '../ui'

/** Acquisition et revente : chaque réglage recalcule les scénarios. */
export default function PlusValueForm({ values, onChange, annees, departementsDisponibles, prefill, prefillActif, onTogglePrefill }) {
  const set = (k) => (v) => onChange({ ...values, [k]: v })
  const vente = values.achat + values.horizon

  return (
    <form
      aria-label="Votre acquisition et votre horizon de revente"
      onSubmit={(e) => e.preventDefault()}
      className="flex flex-col gap-4 rounded-[22px] bg-surface p-4 shadow-overlay sm:p-5"
    >
      <PrefillBanner bien={prefill} actif={prefillActif} onToggle={onTogglePrefill} />

      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Département"
          value={values.departement}
          onChange={set('departement')}
          options={departementsDisponibles.map((c) => ({ value: c, label: `${c} · ${DEPARTEMENTS[c] ?? c}` }))}
        />
        <SelectField label="Année d’achat" value={values.achat} onChange={(v) => set('achat')(Number(v))} options={annees.map((a2) => ({ value: a2, label: String(a2) }))} />
      </div>

      <RangeInput label="Prix d’achat" min={50000} max={3000000} step={5000} value={values.prix} onChange={set('prix')} />
      <RangeInput label="Revente dans" suffix={`ans · ${vente}`} min={1} max={30} step={1} value={values.horizon} onChange={set('horizon')} />

      <div className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-ink-soft">Usage du bien</span>
        <SegmentedControl
          label="Usage du bien"
          fullWidth
          value={values.usage}
          onChange={set('usage')}
          options={[{ value: 'rp', label: 'Résidence principale' }, { value: 'inv', label: 'Investissement' }]}
        />
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
