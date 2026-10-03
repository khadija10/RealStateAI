import { useState } from 'react'
import { cx } from '../../lib/cx'
import { DEPARTEMENTS } from '../../lib/geo'
import { SITUATIONS } from '../../lib/financement'
import RangeInput from '../simulation/RangeInput'
import PrefillBanner from '../simulation/PrefillBanner'
import SelectField from '../simulation/SelectField'
import { IconPlus, SegmentedControl } from '../ui'

function Bascule({ actif, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
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
 * Situation de l'emprunteur et projet. Chaque réglage relance le calcul du
 * dossier côté serveur (aucun montant n'est calculé ici).
 */
export default function FinancementForm({ values, onChange, durees, prefill, prefillActif, onTogglePrefill }) {
  const [plus, setPlus] = useState(Boolean(values.autresRevenus || values.travaux || values.chargesLogement || values.garantie !== 'caution'))
  const set = (k) => (v) => onChange({ ...values, [k]: v })
  const nbPlus = [values.autresRevenus > 0, values.travaux > 0, values.chargesLogement > 0, values.garantie !== 'caution'].filter(Boolean).length

  return (
    <form
      aria-label="Votre situation et votre projet"
      onSubmit={(e) => e.preventDefault()}
      className="flex flex-col gap-3 rounded-[22px] bg-surface p-4 shadow-overlay sm:px-5 sm:py-4"
    >
      <PrefillBanner bien={prefill} actif={prefillActif} onToggle={onTogglePrefill} />

      <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
        <RangeInput label="Prix du bien" min={50000} max={3000000} step={5000} value={values.prix} onChange={set('prix')} />
        <RangeInput label="Apport personnel" min={0} max={Math.max(400000, Math.round(values.prix * 0.6))} step={1000} value={values.apport} onChange={set('apport')} />
        <RangeInput label="Revenus nets du foyer" suffix="€ / mois" min={1000} max={20000} step={100} value={values.revenus} onChange={set('revenus')} />
        <RangeInput label="Crédits en cours" suffix="€ / mois" min={0} max={3000} step={10} value={values.charges} onChange={set('charges')} />
        <RangeInput label="Loyer actuel" suffix="€ / mois" min={0} max={5000} step={50} value={values.loyer} onChange={set('loyer')} />
        <SelectField label="Durée du prêt" value={values.duree} onChange={(v) => set('duree')(Number(v))} options={durees.map((d) => ({ value: d, label: `${d} ans` }))} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1.35fr_0.7fr_0.7fr]">
        <SelectField label="Situation" value={values.situation} onChange={set('situation')} options={SITUATIONS} />
        <SelectField
          label="Département"
          value={values.departement}
          onChange={set('departement')}
          options={Object.entries(DEPARTEMENTS).map(([c, n]) => ({ value: c, label: `${c} · ${n}` }))}
        />
        <SelectField label="Adultes" value={values.adultes} onChange={(v) => set('adultes')(Number(v))} options={[1, 2].map((n) => ({ value: n, label: String(n) }))} />
        <SelectField
          label="Enfants"
          value={values.enfants}
          onChange={(v) => set('enfants')(Number(v))}
          options={[0, 1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))}
        />
      </div>

      <div className="border-t border-line pt-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Bascule actif={values.primo} onClick={() => set('primo')(!values.primo)}>Primo-accédant</Bascule>
          <Bascule actif={values.neuf} onClick={() => set('neuf')(!values.neuf)}>Bien neuf · VEFA</Bascule>
        </div>
        <button
          type="button"
          aria-expanded={plus}
          aria-controls="fin-plus"
          onClick={() => setPlus((o) => !o)}
          title="Autres revenus, travaux, charges du logement, garantie" className="inline-flex h-9 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[12.5px] hover:bg-surface-2"
        >
          <span aria-hidden="true" className={cx('grid h-6 w-6 place-items-center rounded-full transition-transform', plus ? 'rotate-45 bg-surface-2 ring-1 ring-line' : 'bg-brand text-on-brand')}>
            <IconPlus size={13} strokeWidth="2" />
          </span>
          <span className="font-medium text-ink">{plus ? 'Masquer' : 'Plus de critères'}</span>
          {!plus && nbPlus > 0 && <span className="text-ink-muted">{nbPlus} renseigné{nbPlus > 1 ? 's' : ''}</span>}
        </button>
        </div>
        <div id="fin-plus" hidden={!plus} className="mt-3 grid gap-x-6 gap-y-3.5 animate-fade-in sm:grid-cols-2">
          <RangeInput label="Autres revenus" suffix="€ / mois" min={0} max={5000} step={50} value={values.autresRevenus} onChange={set('autresRevenus')} />
          <RangeInput label="Montant des travaux" min={0} max={300000} step={1000} value={values.travaux} onChange={set('travaux')} />
          <RangeInput
            label="Charges du futur logement"
            suffix="€ / mois"
            min={0}
            max={1500}
            step={10}
            value={values.chargesLogement}
            onChange={set('chargesLogement')}
            hint="Copropriété, taxe foncière, énergie, assurance."
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-ink-soft">Garantie du prêt</span>
            <SegmentedControl label="Garantie du prêt" fullWidth value={values.garantie} onChange={set('garantie')} options={[{ value: 'caution', label: 'Caution' }, { value: 'hypotheque', label: 'Hypothèque' }]} />
          </div>
        </div>
      </div>
    </form>
  )
}
