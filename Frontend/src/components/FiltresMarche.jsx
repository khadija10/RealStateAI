// Filtres communs à la carte des prix et à la référence du marché : type de
// bien (une médiane qui mélange maisons et appartements dépend de ce qui s'est
// vendu) et marché (tout, ancien seul, neuf vendu sur plan).
const TYPES = [['apartment', 'Appartements'], ['house', 'Maisons']]
const MARCHES = [['tous', 'Tout le marché'], ['ancien', 'Ancien'], ['neuf', 'Neuf (sur plan)']]

function Groupe({ options, valeur, onChange, libelle }) {
  return (
    <div role="radiogroup" aria-label={libelle} className="inline-flex rounded-full border border-stone-200 bg-white p-1">
      {options.map(([v, l]) => (
        <button
          key={v}
          role="radio"
          aria-checked={valeur === v}
          onClick={() => onChange(v)}
          className={`px-3.5 py-1.5 text-[13px] rounded-full transition-colors ${
            valeur === v ? 'bg-[var(--color-seine)] text-white' : 'text-ink-muted hover:text-ink'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

export default function FiltresMarche({ typeBien, marche, onType, onMarche }) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <Groupe libelle="Type de bien" options={TYPES} valeur={typeBien} onChange={onType} />
      <Groupe libelle="Marché" options={MARCHES} valeur={marche} onChange={onMarche} />
    </div>
  )
}
