import { useEffect, useMemo, useState } from 'react'
import { getSearchHistory, deleteHistoryItem, clearHistory } from '../api/client'

function formatEUR(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function formatDate(iso, avecHeure = true) {
  if (!iso) return '—'
  const d = new Date(iso)
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', ...(avecHeure ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d)
}

function formatPct(x, decimales = 1) {
  return x.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }) + ' %'
}

const TYPE_LABELS = {
  apartment: 'Appartement',
  house: 'Maison',
  studio: 'Studio',
  other: 'Autre',
}

// Mêmes libellés que la page Estimation (classe mesurée par le protocole d'évaluation)
const CLASSES = {
  fiable: { titre: 'Fiabilité élevée', ton: 'bg-emerald-50 text-emerald-700' },
  indicative: { titre: 'Fiabilité correcte', ton: 'bg-amber-50 text-amber-800' },
  a_completer: { titre: 'Fiabilité limitée', ton: 'bg-red-50 text-red-700' },
  donnees_insuffisantes: { titre: 'Peu de références', ton: 'bg-stone-100 text-ink-muted' },
}

const TRIS = {
  recent: { label: 'Les plus récents', fn: (a, b) => new Date(b.derniere.created_at) - new Date(a.derniere.created_at) },
  prix_haut: { label: 'Prix décroissant', fn: (a, b) => (b.derniere.estimated_price || 0) - (a.derniere.estimated_price || 0) },
  prix_bas: { label: 'Prix croissant', fn: (a, b) => (a.derniere.estimated_price || 0) - (b.derniere.estimated_price || 0) },
}

function titre(item) {
  return item.adresse_normalisee || item.query || item.address || item.commune || '—'
}

// Un bien = même adresse (ou commune), même type, même surface, même nombre de pièces.
// Chaque estimation est gardée : le prix d'un même bien peut changer d'une
// estimation à l'autre (marché, DPE retrouvé, modèle réentraîné).
function cleBien(item) {
  const lieu = (item.adresse_normalisee || item.address || item.query || item.commune || '').trim().toLowerCase()
  return [lieu, item.property_type || '', item.area_m2 ?? '', item.rooms ?? ''].join('|')
}

function regrouper(items) {
  const groupes = new Map()
  for (const item of items) {
    const cle = cleBien(item)
    if (!groupes.has(cle)) groupes.set(cle, { cle, estimations: [] })
    groupes.get(cle).estimations.push(item)
  }
  return [...groupes.values()].map((g) => {
    const estimations = g.estimations.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    // Dernière simulation de chaque sorte, toutes estimations du bien confondues
    const simulations = {}
    for (const e of estimations) {
      for (const [type, sim] of Object.entries(e.simulations || {})) {
        if (!simulations[type] || new Date(sim.date) > new Date(simulations[type].date)) simulations[type] = sim
      }
    }
    const derniere = estimations[0]
    const premiere = estimations[estimations.length - 1]
    const evolution = estimations.length > 1 && premiere.estimated_price && derniere.estimated_price
      ? (100 * (derniere.estimated_price / premiere.estimated_price - 1)) : null
    return { ...g, estimations, derniere, premiere, simulations, evolution }
  })
}

function Pastille({ children, className = '' }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium ${className}`}>{children}</span>
}

function ResumePlusValue({ sim }) {
  return (
    <p className="text-[13px] text-ink">
      <span className="font-medium">Plus-value</span> · scénario {sim.scenario}, revente en {sim.annee_revente}
      {' '}: {formatEUR(sim.revente)}, plus-value{' '}
      <span className={`font-semibold tabular-nums ${sim.plus_value >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
        {sim.plus_value >= 0 ? '+' : '−'}{formatEUR(Math.abs(sim.plus_value))}
      </span>
      , gain net {sim.net < 0 ? '−' : ''}{formatEUR(Math.abs(sim.net))} <span className="text-ink-muted">({sim.usage})</span>
    </p>
  )
}

function ResumeFinancement({ sim }) {
  return (
    <p className="text-[13px] text-ink">
      <span className="font-medium">Financement</span> · <span className="font-semibold tabular-nums">{formatEUR(sim.mensualite)}/mois</span>
      {' '}sur {sim.duree} ans, {formatEUR(sim.montant_emprunte)} empruntés, endettement {formatPct(100 * (sim.taux_endettement || 0))}
      {' '}· <span className={sim.conforme_hcsf ? 'text-emerald-700' : 'text-red-600'}>{sim.verdict}</span>
      {sim.score ? <span className="text-ink-muted"> · score {sim.score}/100</span> : null}
    </p>
  )
}

function ComparisonSummary({ a, b, onClear }) {
  const ppmA = a.area_m2 ? a.estimated_price / a.area_m2 : null
  const ppmB = b.area_m2 ? b.estimated_price / b.area_m2 : null
  const diff = b.estimated_price - a.estimated_price
  const diffPct = formatPct((diff / a.estimated_price) * 100)
  const cheaper = diff < 0 ? 'B' : diff > 0 ? 'A' : null
  const NR = 'non renseigné'
  const fourchette = (x) => x.resultat?.price_range ? `${formatEUR(x.resultat.price_range.low)} – ${formatEUR(x.resultat.price_range.high)}` : NR
  const classe = (x) => CLASSES[x.resultat?.classe_fiabilite]?.titre ?? NR
  const dpe = (x) => x.resultat?.dpe_classe || x.dpe_classe || NR

  const rows = [
    { label: 'Adresse / Commune', a: titre(a), b: titre(b) },
    { label: 'Type', a: TYPE_LABELS[a.property_type] ?? NR, b: TYPE_LABELS[b.property_type] ?? NR },
    { label: 'Surface', a: a.area_m2 ? `${a.area_m2} m²` : NR, b: b.area_m2 ? `${b.area_m2} m²` : NR },
    { label: 'DPE', a: dpe(a), b: dpe(b) },
    { label: 'Prix estimé', a: formatEUR(a.estimated_price), b: formatEUR(b.estimated_price), highlight: true },
    { label: 'Fourchette', a: fourchette(a), b: fourchette(b) },
    ...(ppmA && ppmB ? [{ label: 'Prix / m²', a: formatEUR(Math.round(ppmA)), b: formatEUR(Math.round(ppmB)) }] : []),
    { label: 'Fiabilité', a: classe(a), b: classe(b) },
  ]

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-[var(--shadow-card)] p-6 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Comparaison</p>
        <button onClick={onClear} className="text-[13px] text-ink-muted hover:text-ink transition-colors">
          Effacer
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-stone-50 rounded-xl p-4">
          <p className="text-[13px] text-ink-muted mb-1">Prix de B par rapport à A</p>
          <p className="text-xl font-semibold tabular-nums text-ink">
            {diff === 0 ? 'identique' : `${formatEUR(Math.abs(diff))} ${diff < 0 ? 'de moins' : 'de plus'}`}
          </p>
          <p className="text-[13px] text-ink-muted mt-0.5">{diff > 0 ? '+' : ''}{diffPct}</p>
        </div>

        {ppmA && ppmB && (
          <div className="bg-stone-50 rounded-xl p-4">
            <p className="text-[13px] text-ink-muted mb-1">Prix au m² de B par rapport à A</p>
            <p className="text-xl font-semibold tabular-nums text-ink">
              {Math.round(ppmB - ppmA) === 0 ? 'identique' : `${formatEUR(Math.abs(Math.round(ppmB - ppmA)))} ${ppmB < ppmA ? 'de moins' : 'de plus'}`}
            </p>
            <p className="text-[13px] text-ink-muted mt-0.5">par m²</p>
          </div>
        )}

        <div className="bg-stone-50 rounded-xl p-4">
          <p className="text-[13px] text-ink-muted mb-1">Le moins cher</p>
          {cheaper ? (
            <>
              <p className="text-xl font-semibold text-seine">Bien {cheaper}</p>
              <p className="text-[13px] text-ink-muted mt-0.5 truncate">{titre(cheaper === 'A' ? a : b)}</p>
            </>
          ) : (
            <p className="text-xl font-semibold text-ink">Identiques</p>
          )}
        </div>
      </div>

      <div className="divide-y divide-stone-100">
        <div className="flex gap-4 pb-2">
          <span className="flex-1" />
          <span className="w-40 text-right">
            <span className="inline-flex items-center text-[12px] font-semibold text-white bg-seine rounded-full px-2 py-0.5">A</span>
          </span>
          <span className="w-40 text-right">
            <span className="inline-flex items-center text-[12px] font-semibold text-white bg-limestone rounded-full px-2 py-0.5">B</span>
          </span>
        </div>
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-4 py-2.5">
            <span className="flex-1 text-[13px] text-ink-muted">{row.label}</span>
            <span className={`w-40 text-right text-[13px] text-ink ${row.highlight ? 'font-semibold' : ''}`}>{row.a}</span>
            <span className={`w-40 text-right text-[13px] text-ink ${row.highlight ? 'font-semibold' : ''}`}>{row.b}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const PAGE_SIZE = 6

export default function History({ onReEstimate, onVoir }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState([]) // clés de 2 biens au plus
  const [ouverts, setOuverts] = useState(() => new Set())
  const [page, setPage] = useState(0)
  const [deleting, setDeleting] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null) // clé du bien à supprimer
  const [clearing, setClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [search, setSearch] = useState('')
  const [tri, setTri] = useState('recent')

  useEffect(() => {
    getSearchHistory(200)
      .then(setItems)
      .catch(() => setError("Impossible de charger l'historique."))
      .finally(() => setLoading(false))
  }, [])

  const groupes = useMemo(() => regrouper(items), [items])

  async function supprimer(ids, cle) {
    setDeleting(cle)
    try {
      await Promise.all(ids.map((id) => deleteHistoryItem(id)))
      setItems((prev) => prev.filter((i) => !ids.includes(i.id)))
      setSelected((prev) => prev.filter((k) => k !== cle || ids.length === 1))
    } catch {
      // l'estimation reste affichée si la suppression échoue
    } finally {
      setDeleting(null)
      setConfirmDelete(null)
    }
  }

  async function confirmClearAll() {
    setConfirmClear(false)
    setClearing(true)
    try {
      await clearHistory()
      setItems([])
      setSelected([])
      setPage(0)
    } catch {
      // l'historique reste affiché si l'effacement échoue
    } finally {
      setClearing(false)
    }
  }

  function toggleSelect(cle) {
    setSelected((prev) => {
      if (prev.includes(cle)) return prev.filter((k) => k !== cle)
      if (prev.length >= 2) return [prev[1], cle]
      return [...prev, cle]
    })
  }

  function toggleOuvert(cle) {
    setOuverts((prev) => {
      const s = new Set(prev)
      if (s.has(cle)) s.delete(cle)
      else s.add(cle)
      return s
    })
  }

  const q = search.trim().toLowerCase()
  const filtered = (q
    ? groupes.filter(({ derniere: item }) =>
        [item.query, item.commune, item.address, item.adresse_normalisee, TYPE_LABELS[item.property_type]]
          .some((v) => (v || '').toLowerCase().includes(q)))
    : groupes
  ).sort(TRIS[tri].fn)

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const selA = groupes.find((g) => g.cle === selected[0])?.derniere ?? null
  const selB = groupes.find((g) => g.cle === selected[1])?.derniere ?? null
  const canCompare = selA && selB && selA.estimated_price && selB.estimated_price

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="h-5 w-5 rounded-full border-2 border-stone-100 border-t-seine animate-spin" />
      </div>
    )
  }

  if (error) {
    return <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-4 text-sm text-red-600">{error}</div>
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true" className="opacity-25">
          <circle cx="22" cy="22" r="18" stroke="currentColor" strokeWidth="1.4" />
          <path d="M22 14v8l5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <p className="text-sm text-ink-muted">Vous n'avez encore fait aucune estimation.</p>
      </div>
    )
  }

  const nbEstimations = filtered.reduce((n, g) => n + g.estimations.length, 0)
  const bouton = 'text-[13px] font-medium border border-stone-200 rounded-full px-3 py-1 transition-colors'

  return (
    <>
    {confirmClear && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmClear(false)}>
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-base font-semibold text-ink mb-2">Vider l'historique ?</h2>
          <p className="text-sm text-ink-muted mb-5">Toutes vos estimations et simulations seront supprimées définitivement.</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setConfirmClear(false)}
              className="px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink border border-stone-200 rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={confirmClearAll}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors"
            >
              Vider tout
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="space-y-4">
      {/* Recherche, tri et effacement */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" aria-hidden="true">
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3" />
            <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder="Rechercher une adresse, une commune…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-stone-200 rounded-lg bg-white focus:outline-none focus:border-seine transition-colors"
          />
        </div>
        <select
          value={tri}
          onChange={(e) => { setTri(e.target.value); setPage(0) }}
          aria-label="Trier les biens"
          className="py-2 px-3 text-sm border border-stone-200 rounded-lg bg-white text-ink focus:outline-none focus:border-seine"
        >
          {Object.entries(TRIS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
        </select>
        <button
          onClick={() => setConfirmClear(true)}
          disabled={clearing}
          className="text-[13px] text-ink-muted hover:text-red-500 transition-colors shrink-0"
        >
          {clearing ? 'Effacement…' : 'Vider tout'}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-muted">
          {filtered.length} bien{filtered.length > 1 ? 's' : ''} · {nbEstimations} estimation{nbEstimations > 1 ? 's' : ''}
          {totalPages > 1 ? ` · page ${page + 1}/${totalPages}` : ''}
        </p>
        {filtered.length >= 2 && selected.length === 0 && (
          <p className="text-[13px] text-ink-muted">Sélectionnez 2 biens pour les comparer</p>
        )}
        {selected.length === 1 && <p className="text-[13px] text-seine">Sélectionnez un second bien</p>}
        {selected.length === 2 && (
          <button onClick={() => setSelected([])} className="text-[13px] text-ink-muted hover:text-ink transition-colors">
            Tout désélectionner
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
          <p className="text-sm text-ink-muted">Aucun bien ne correspond à <strong>« {search} »</strong>.</p>
          <button onClick={() => setSearch('')} className="text-[13px] text-seine hover:underline">Effacer la recherche</button>
        </div>
      ) : (
      <div className="bg-white rounded-2xl border border-stone-100 shadow-[var(--shadow-card)] overflow-hidden">
        <div className="divide-y divide-stone-100">
        {pageItems.map((g) => {
          const item = g.derniere
          const selIdx = selected.indexOf(g.cle)
          const badge = selIdx === 0 ? 'A' : selIdx === 1 ? 'B' : null
          const ouvert = ouverts.has(g.cle)
          const res = item.resultat
          const classe = CLASSES[res?.classe_fiabilite]
          const dpe = res?.dpe_classe || item.dpe_classe
          const nbSims = Object.keys(g.simulations).length
          const depliable = g.estimations.length > 1 || nbSims > 0

          return (
            <div key={g.cle} data-testid="history-item" className={badge ? 'bg-stone-50' : ''}>
              <div
                className={`flex items-start gap-4 px-5 py-4 ${item.estimated_price ? 'cursor-pointer' : ''}`}
                onClick={() => item.estimated_price && toggleSelect(g.cle)}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); if (item.estimated_price) toggleSelect(g.cle) }}
                  className="shrink-0 w-6 h-6 mt-0.5 flex items-center justify-center"
                  aria-label={badge ? `Bien ${badge} sélectionné pour la comparaison` : 'Sélectionner pour comparer'}
                  aria-pressed={!!badge}
                >
                  {badge ? (
                    <span className={`h-6 w-6 rounded-full text-white text-[13px] font-semibold flex items-center justify-center ${badge === 'A' ? 'bg-seine' : 'bg-limestone'}`}>
                      {badge}
                    </span>
                  ) : (
                    <span className="h-4 w-4 rounded-full border-2 border-stone-300 hover:border-seine transition-colors" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{titre(item)}</p>
                  <p className="text-[13px] text-ink-muted mt-0.5">
                    {TYPE_LABELS[item.property_type] ?? item.property_type ?? '—'}
                    {item.area_m2 ? ` · ${item.area_m2} m²` : ''}
                    {item.rooms ? ` · ${item.rooms} pièce${item.rooms > 1 ? 's' : ''}` : ''}
                    {' · '}{formatDate(item.created_at)}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {classe && <Pastille className={classe.ton}>{classe.titre}</Pastille>}
                    {dpe && <Pastille className="bg-stone-100 text-ink">DPE {dpe}</Pastille>}
                    {g.estimations.length > 1 && (
                      <Pastille className="bg-stone-100 text-ink-muted">{g.estimations.length} estimations</Pastille>
                    )}
                    {g.simulations.plusvalue && <Pastille className="bg-stone-100 text-ink-muted">Plus-value simulée</Pastille>}
                    {g.simulations.financement && <Pastille className="bg-stone-100 text-ink-muted">Financement simulé</Pastille>}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {item.estimated_price ? (
                    <p className="text-sm font-semibold text-ink tabular-nums">{formatEUR(item.estimated_price)}</p>
                  ) : (
                    <p className="text-[13px] text-ink-muted">—</p>
                  )}
                  {res?.price_range ? (
                    <p className="text-[13px] text-ink-muted tabular-nums mt-0.5">
                      {formatEUR(res.price_range.low)} – {formatEUR(res.price_range.high)}
                    </p>
                  ) : item.area_m2 && item.estimated_price ? (
                    <p className="text-[13px] text-ink-muted tabular-nums mt-0.5">
                      {formatEUR(Math.round(item.estimated_price / item.area_m2))} / m²
                    </p>
                  ) : null}
                  {g.evolution != null && (
                    <p className={`text-[13px] tabular-nums mt-0.5 ${Math.abs(g.evolution) < 0.05 ? 'text-ink-muted' : g.evolution > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {Math.abs(g.evolution) < 0.05
                        ? `prix inchangé depuis le ${formatDate(g.premiere.created_at, false)}`
                        : `${g.evolution > 0 ? '+' : ''}${formatPct(g.evolution)} depuis le ${formatDate(g.premiere.created_at, false)}`}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 px-5 pb-4 pl-[60px]">
                {onVoir && res && (
                  <button onClick={() => onVoir(item)} className={`${bouton} text-white bg-seine border-seine hover:opacity-90`}>
                    Voir le résultat
                  </button>
                )}
                {onReEstimate && item.estimated_price && (
                  <button onClick={() => onReEstimate(item)} className={`${bouton} text-seine hover:border-seine`}>
                    Ré-estimer
                  </button>
                )}
                {depliable && (
                  <button onClick={() => toggleOuvert(g.cle)} className={`${bouton} text-ink-muted hover:text-ink`} aria-expanded={ouvert}>
                    {ouvert ? 'Masquer le détail' : 'Détail'}
                  </button>
                )}
                <span className="flex-1" />
                {confirmDelete === g.cle ? (
                  <span className="flex items-center gap-3">
                    <span className="text-[13px] text-ink-muted">
                      Supprimer {g.estimations.length > 1 ? `les ${g.estimations.length} estimations de ce bien` : 'cette estimation'} ?
                    </span>
                    <button onClick={() => setConfirmDelete(null)} className="text-[13px] text-ink-muted hover:text-ink">Annuler</button>
                    <button
                      onClick={() => supprimer(g.estimations.map((e) => e.id), g.cle)}
                      disabled={deleting === g.cle}
                      className="text-[13px] font-medium text-red-500 hover:text-red-600"
                    >
                      Supprimer
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(g.cle)}
                    title="Supprimer"
                    className="text-[13px] text-ink-muted hover:text-red-500 transition-colors"
                    aria-label="Supprimer ce bien de l'historique"
                  >
                    Supprimer
                  </button>
                )}
              </div>

              {ouvert && (
                <div className="mx-5 mb-4 ml-[60px] rounded-xl bg-stone-50 p-4 space-y-3">
                  {(g.simulations.plusvalue || g.simulations.financement) && (
                    <div className="space-y-1.5">
                      {g.simulations.plusvalue && <ResumePlusValue sim={g.simulations.plusvalue} />}
                      {g.simulations.financement && <ResumeFinancement sim={g.simulations.financement} />}
                    </div>
                  )}
                  {g.estimations.length > 1 && (
                    <div>
                      <p className="text-[13px] font-medium text-ink mb-1">Estimations successives</p>
                      <div className="divide-y divide-stone-200">
                        {g.estimations.map((e) => (
                          <div key={e.id} className="flex items-center gap-3 py-1.5 text-[13px]">
                            <span className="text-ink-muted w-44 shrink-0">{formatDate(e.created_at)}</span>
                            <span className="font-semibold text-ink tabular-nums">{e.estimated_price ? formatEUR(e.estimated_price) : '—'}</span>
                            {e.resultat?.price_range && (
                              <span className="text-ink-muted tabular-nums hidden sm:inline">
                                {formatEUR(e.resultat.price_range.low)} – {formatEUR(e.resultat.price_range.high)}
                              </span>
                            )}
                            <span className="flex-1" />
                            {onVoir && e.resultat && e.id !== item.id && (
                              <button onClick={() => onVoir(e)} className="text-seine hover:underline">Voir</button>
                            )}
                            <button
                              onClick={() => supprimer([e.id], g.cle)}
                              disabled={deleting === g.cle}
                              className="text-ink-muted hover:text-red-500"
                              aria-label="Supprimer cette estimation"
                            >
                              Supprimer
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        </div>

        {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-stone-100">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-[13px] text-ink-muted disabled:opacity-30 hover:text-ink transition-colors"
          >
            ← Précédent
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                aria-label={`Page ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === page ? 'w-4 bg-seine' : 'w-1.5 bg-stone-300'}`}
              />
            ))}
          </div>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="text-[13px] text-ink-muted disabled:opacity-30 hover:text-ink transition-colors"
          >
            Suivant →
          </button>
        </div>
        )}
      </div>
      )}

      {canCompare && (
        <ComparisonSummary a={selA} b={selB} onClear={() => setSelected([])} />
      )}
    </div>
    </>
  )
}
