import { useId } from 'react'

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Appartement' },
  { value: 'house', label: 'Maison' },
  { value: 'other', label: 'Autre' },
]

export default function EstimationForm({ values, onChange, onSubmit, communes, loading, communesLoading }) {
  const formId = useId()

  function set(field) {
    return (e) => onChange({ ...values, [field]: e.target.value })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="bg-white rounded-2xl border border-stone-100 shadow-[var(--shadow-card)] p-6 sm:p-8 space-y-5"
    >
      <div>
        <h2 className="font-[var(--font-display)] text-[1.6rem] text-ink leading-tight">Le bien</h2>
        <p className="text-sm text-ink-muted mt-1">Renseignez ses caractéristiques pour obtenir une estimation.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${formId}-area`} className="block text-xs font-medium text-ink-muted mb-1.5">
            Surface (m²)
          </label>
          <input
            id={`${formId}-area`}
            type="number"
            min="1"
            required
            value={values.area_m2}
            onChange={set('area_m2')}
            placeholder="65"
            className="w-full rounded-lg border border-stone-100 bg-stone-50/50 px-3 py-2.5 text-sm text-ink focus:border-seine focus:bg-white outline-none transition-colors"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-rooms`} className="block text-xs font-medium text-ink-muted mb-1.5">
            Nombre de pièces
          </label>
          <input
            id={`${formId}-rooms`}
            type="number"
            min="1"
            required
            value={values.rooms}
            onChange={set('rooms')}
            placeholder="3"
            className="w-full rounded-lg border border-stone-100 bg-stone-50/50 px-3 py-2.5 text-sm text-ink focus:border-seine focus:bg-white outline-none transition-colors"
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${formId}-type`} className="block text-xs font-medium text-ink-muted mb-1.5">
          Type de bien
        </label>
        <div className="grid grid-cols-3 gap-2">
          {PROPERTY_TYPES.map((t) => (
            <button
              type="button"
              key={t.value}
              onClick={() => onChange({ ...values, property_type: t.value })}
              className={`rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                values.property_type === t.value
                  ? 'border-seine bg-seine/5 text-seine font-medium'
                  : 'border-stone-100 text-ink-muted hover:border-stone-600/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor={`${formId}-commune`} className="block text-xs font-medium text-ink-muted mb-1.5">
          Commune
        </label>
        <input
          id={`${formId}-commune`}
          list={`${formId}-communes-list`}
          required
          value={values.commune}
          onChange={set('commune')}
          placeholder={communesLoading ? 'Chargement des communes…' : 'PARIS 01'}
          className="w-full rounded-lg border border-stone-100 bg-stone-50/50 px-3 py-2.5 text-sm text-ink focus:border-seine focus:bg-white outline-none transition-colors"
        />
        <datalist id={`${formId}-communes-list`}>
          {communes.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <p className="text-[11px] text-ink-muted mt-1.5">Choisissez une commune de la liste pour garantir une estimation.</p>
      </div>

      <div>
        <label htmlFor={`${formId}-address`} className="block text-xs font-medium text-ink-muted mb-1.5">
          Adresse <span className="text-ink-muted/70">(optionnel)</span>
        </label>
        <input
          id={`${formId}-address`}
          type="text"
          value={values.address}
          onChange={set('address')}
          placeholder="10 Rue de Rivoli, 75001 Paris"
          className="w-full rounded-lg border border-stone-100 bg-stone-50/50 px-3 py-2.5 text-sm text-ink focus:border-seine focus:bg-white outline-none transition-colors"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-ink text-white py-3 text-sm font-medium tracking-wide hover:bg-seine-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Estimation en cours…' : 'Estimer le prix'}
      </button>
    </form>
  )
}
