import { useId, useState, useRef, useEffect } from 'react'

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Appartement' },
  { value: 'house', label: 'Maison' },
  { value: 'other', label: 'Autre' },
]

function AddressAutocomplete({ value, onChange, onSelect, formId }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef(null)
  const wrapperRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
        setActiveIdx(-1)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleChange(e) {
    const val = e.target.value
    onChange(val)
    setActiveIdx(-1)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (val.trim().length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(val)}&limit=6&autocomplete=1`
        )
        const data = await res.json()
        const items = (data.features || []).map((f) => ({
          label: f.properties.label,
          name: f.properties.name,
          postcode: f.properties.postcode ?? '',
          city: f.properties.city ?? '',
        }))
        setSuggestions(items)
        setOpen(items.length > 0)
      } catch {
        setSuggestions([])
        setOpen(false)
      }
    }, 300)
  }

  function handleKeyDown(e) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      pick(suggestions[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIdx(-1)
    }
  }

  function pick(s) {
    onSelect(s)
    setSuggestions([])
    setOpen(false)
    setActiveIdx(-1)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        id={`${formId}-address`}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="ex. 21 rue de Rivoli"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        className="w-full rounded-lg border border-stone-100 bg-stone-50/50 px-3 py-2.5 text-sm text-ink focus:border-seine focus:bg-white outline-none transition-colors"
      />
      {open && (
        <ul
          role="listbox"
          className="absolute z-30 w-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden"
        >
          {suggestions.map((s, i) => (
            <li
              key={i}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={() => pick(s)}
              onMouseEnter={() => setActiveIdx(i)}
              className={`px-3 py-2.5 cursor-pointer flex flex-col gap-0.5 transition-colors ${
                i === activeIdx ? 'bg-stone-50' : 'hover:bg-stone-50/60'
              } ${i > 0 ? 'border-t border-stone-100' : ''}`}
            >
              <span className="text-sm text-ink font-medium leading-snug">{s.name}</span>
              <span className="text-xs text-ink-muted">{s.postcode} {s.city}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function EstimationForm({ values, onChange, onSubmit, communes, loading, communesLoading }) {
  const formId = useId()

  function set(field) {
    return (e) => onChange({ ...values, [field]: e.target.value })
  }

  const hasAddress = values.address && values.address.trim().length > 0

  function handleSubmit(e) {
    e.preventDefault()
    if (!values.property_type) {
      document.getElementById(`${formId}-type-required`)?.reportValidity()
      return
    }
    onSubmit()
  }

  function handleAddressSelect(s) {
    onChange({
      ...values,
      address: s.name,
      postal_code: s.postcode,
      commune: s.city,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-stone-100 shadow-[var(--shadow-card)] p-6 sm:p-8 space-y-5">
      <div>
        <h2 className="font-[var(--font-display)] text-[1.6rem] text-ink leading-tight">Le bien</h2>
        <p className="text-sm text-ink-muted mt-1">
          Les champs marqués <span className="text-seine font-semibold">*</span> sont obligatoires.
        </p>
      </div>

      {/* Surface + Pièces */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${formId}-area`} className="block text-xs font-medium text-ink-muted mb-1.5">
            Surface (m²) <span className="text-seine font-semibold">*</span>
          </label>
          <input
            id={`${formId}-area`}
            type="number"
            min="6"
            max="2000"
            required
            value={values.area_m2}
            onChange={set('area_m2')}
            placeholder="ex. 65"
            className="w-full rounded-lg border border-stone-100 bg-stone-50/50 px-3 py-2.5 text-sm text-ink focus:border-seine focus:bg-white outline-none transition-colors"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-rooms`} className="block text-xs font-medium text-ink-muted mb-1.5">
            Pièces <span className="text-seine font-semibold">*</span>
          </label>
          <input
            id={`${formId}-rooms`}
            type="number"
            min="1"
            max="30"
            required
            value={values.rooms}
            onChange={set('rooms')}
            placeholder="ex. 3"
            className="w-full rounded-lg border border-stone-100 bg-stone-50/50 px-3 py-2.5 text-sm text-ink focus:border-seine focus:bg-white outline-none transition-colors"
          />
        </div>
      </div>

      {/* Type de bien */}
      <div>
        <label className="block text-xs font-medium text-ink-muted mb-1.5">
          Type de bien <span className="text-seine font-semibold">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {PROPERTY_TYPES.map((t) => (
            <button
              type="button"
              key={t.value}
              onClick={() => onChange({
                ...values,
                property_type: values.property_type === t.value ? '' : t.value,
              })}
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
        <input
          id={`${formId}-type-required`}
          type="text"
          required
          value={values.property_type}
          onChange={() => {}}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          style={{ position: 'absolute', opacity: 0, height: 0 }}
        />
        {!values.property_type && (
          <p className="text-[11px] text-stone-400 mt-1.5">Sélectionnez un type de bien.</p>
        )}
      </div>

      {/* Localisation */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-stone-100" />
          <p className="text-[11px] uppercase tracking-[0.12em] text-ink-muted">Localisation</p>
          <div className="h-px flex-1 bg-stone-100" />
        </div>

        <div>
          <label htmlFor={`${formId}-address`} className="block text-xs font-medium text-ink-muted mb-1.5">
            Adresse{' '}
            <span className="text-seine font-medium text-[10px] uppercase tracking-wide ml-1">
              ↑ active le modèle ML
            </span>
          </label>
          <AddressAutocomplete
            value={values.address}
            onChange={(val) => onChange({ ...values, address: val })}
            onSelect={handleAddressSelect}
            formId={formId}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${formId}-postal`} className="block text-xs font-medium text-ink-muted mb-1.5">
              Code postal
            </label>
            <input
              id={`${formId}-postal`}
              type="text"
              maxLength={5}
              value={values.postal_code}
              onChange={set('postal_code')}
              placeholder="ex. 75004"
              className="w-full rounded-lg border border-stone-100 bg-stone-50/50 px-3 py-2.5 text-sm text-ink focus:border-seine focus:bg-white outline-none transition-colors"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-commune`} className="block text-xs font-medium text-ink-muted mb-1.5">
              Commune{' '}
              {hasAddress
                ? <span className="text-ink-muted/50 font-normal">optionnel</span>
                : <span className="text-seine font-semibold">*</span>}
            </label>
            <input
              id={`${formId}-commune`}
              list={`${formId}-communes-list`}
              required={!hasAddress}
              value={values.commune}
              onChange={set('commune')}
              placeholder={communesLoading ? 'Chargement…' : 'ex. PARIS 04'}
              className="w-full rounded-lg border border-stone-100 bg-stone-50/50 px-3 py-2.5 text-sm text-ink focus:border-seine focus:bg-white outline-none transition-colors"
            />
            <datalist id={`${formId}-communes-list`}>
              {communes.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>

        <p className="text-[11px] text-ink-muted">
          {hasAddress
            ? 'Adresse détectée — géolocalisation BAN activée.'
            : <><span className="text-seine font-medium">*</span> Commune requise sans adresse.</>}
        </p>
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
