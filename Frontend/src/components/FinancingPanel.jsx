import { useState } from 'react'
import { getFinancingDossier, ApiError } from '../api/client'

function formatEUR(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function formatPct(n) {
  return `${(n * 100).toFixed(1)} %`
}

const SITUATIONS = [
  { value: 'CDI', label: 'CDI' },
  { value: 'fonctionnaire', label: 'Fonctionnaire' },
  { value: 'CDD', label: 'CDD' },
  { value: 'independant', label: 'Indépendant / freelance' },
  { value: 'interim', label: 'Intérim' },
  { value: 'chomage', label: 'Sans emploi' },
]

const DEPS_IDF = ['75', '77', '78', '91', '92', '93', '94', '95']

const EMPTY = {
  prix_bien: '',
  departement: '75',
  type_bien: 'ancien',
  revenus_nets_mensuels: '',
  apport: '',
  charges_credits_mensuelles: '',
  situation_professionnelle: 'CDI',
  primo_accedant: false,
  duree_souhaitee_annees: '25',
}

function ScoreBar({ score }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-semibold text-ink tabular-nums w-12 text-right">{score} / 100</span>
    </div>
  )
}

function Row({ label, value, highlight }) {
  return (
    <div className="flex justify-between items-baseline gap-2 py-2 border-b border-stone-50 last:border-0">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className={`text-sm font-medium tabular-nums ${highlight ? 'text-seine' : 'text-ink'}`}>{value}</span>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-ink placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-seine/30 focus:border-seine transition-colors'

export default function FinancingPanel({ defaultPrix, defaultDep }) {
  const [form, setForm] = useState({
    ...EMPTY,
    prix_bien: defaultPrix ? String(Math.round(defaultPrix)) : '',
    departement: defaultDep && DEPS_IDF.includes(defaultDep) ? defaultDep : '75',
  })
  const [status, setStatus] = useState('idle')
  const [dossier, setDossier] = useState(null)
  const [error, setError] = useState('')

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('loading')
    setError('')
    try {
      const payload = {
        profil: {
          revenus_nets_mensuels: Number(form.revenus_nets_mensuels),
          apport: Number(form.apport) || 0,
          charges_credits_mensuelles: Number(form.charges_credits_mensuelles) || 0,
          situation_professionnelle: form.situation_professionnelle,
          primo_accedant: form.primo_accedant,
        },
        projet: {
          prix_bien: Number(form.prix_bien),
          departement: form.departement,
          type_bien: form.type_bien,
          duree_souhaitee_annees: Number(form.duree_souhaitee_annees),
        },
      }
      const result = await getFinancingDossier(payload)
      setDossier(result)
      setStatus('success')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors du calcul.")
      setStatus('error')
    }
  }

  const conforme = dossier?.conformite_hcsf?.conforme_hcsf
  const score = dossier?.score_dossier?.score_sur_100
  const credit = dossier?.credit
  const plan = dossier?.plan_financement
  const synthese = dossier?.synthese

  return (
    <div className="grid md:grid-cols-2 gap-6 items-start">

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-stone-100 shadow-[var(--shadow-card)] p-6 space-y-5">
        <h2 className="font-[var(--font-display)] text-2xl text-ink">Votre projet</h2>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Prix du bien (€)">
            <input className={inputCls} type="number" min="50000" step="1" placeholder="350 000" value={form.prix_bien}
              onChange={e => set('prix_bien', e.target.value)} required />
          </Field>
          <Field label="Département">
            <select className={inputCls} value={form.departement} onChange={e => set('departement', e.target.value)}>
              {DEPS_IDF.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Type de bien">
            <select className={inputCls} value={form.type_bien} onChange={e => set('type_bien', e.target.value)}>
              <option value="ancien">Ancien</option>
              <option value="neuf">Neuf</option>
            </select>
          </Field>
          <Field label="Durée souhaitée">
            <select className={inputCls} value={form.duree_souhaitee_annees} onChange={e => set('duree_souhaitee_annees', e.target.value)}>
              {[15, 20, 25].map(d => <option key={d} value={d}>{d} ans</option>)}
            </select>
          </Field>
        </div>

        <div className="border-t border-stone-100 pt-4 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Profil emprunteur</h3>

          <Field label="Revenus nets mensuels (€)">
            <input className={inputCls} type="number" min="1" placeholder="4 000" value={form.revenus_nets_mensuels}
              onChange={e => set('revenus_nets_mensuels', e.target.value)} required />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Apport (€)">
              <input className={inputCls} type="number" min="0" placeholder="50 000" value={form.apport}
                onChange={e => set('apport', e.target.value)} />
            </Field>
            <Field label="Charges crédit (€/mois)">
              <input className={inputCls} type="number" min="0" placeholder="300" value={form.charges_credits_mensuelles}
                onChange={e => set('charges_credits_mensuelles', e.target.value)} />
            </Field>
          </div>

          <Field label="Situation professionnelle">
            <select className={inputCls} value={form.situation_professionnelle}
              onChange={e => set('situation_professionnelle', e.target.value)}>
              {SITUATIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.primo_accedant}
              onChange={e => set('primo_accedant', e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-seine focus:ring-seine/30" />
            <span className="text-sm text-ink">Primo-accédant</span>
          </label>
        </div>

        <button type="submit" disabled={status === 'loading'}
          className="w-full py-3 rounded-xl bg-seine text-white text-sm font-medium hover:bg-seine-dark transition-colors disabled:opacity-50">
          {status === 'loading' ? 'Calcul en cours…' : 'Calculer mon financement'}
        </button>

        {status === 'error' && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}
      </form>

      {/* Résultat */}
      <div className="bg-white rounded-2xl border border-stone-100 shadow-[var(--shadow-card)] p-6 flex flex-col gap-6">
        <h2 className="font-[var(--font-display)] text-2xl text-ink">Résultat</h2>

        {status === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-14">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true" className="opacity-25">
              <rect x="8" y="12" width="28" height="22" rx="2" stroke="currentColor" strokeWidth="1.4" />
              <path d="M14 20h16M14 26h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <p className="text-sm text-ink-muted">Remplissez le formulaire pour simuler votre financement.</p>
          </div>
        )}

        {status === 'loading' && (
          <div className="flex-1 flex justify-center items-center py-14">
            <div className="h-5 w-5 rounded-full border-2 border-stone-100 border-t-seine animate-spin" />
          </div>
        )}

        {status === 'success' && dossier && (
          <div className="space-y-6 animate-[fadeIn_0.4s_ease-out]">

            {/* Conformité HCSF */}
            <div className={`rounded-xl px-4 py-3 border ${conforme ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
              <p className="text-sm font-medium">
                {conforme ? '✓ Dossier conforme HCSF' : '⚠ Hors normes HCSF — dérogation nécessaire'}
              </p>
              {conforme && synthese?.decision_indicative && (
                <p className="text-xs mt-1 opacity-80">{synthese.decision_indicative}</p>
              )}
            </div>

            {/* Score */}
            {score !== undefined && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Score du dossier</p>
                <ScoreBar score={score} />
                <p className="text-xs text-ink-muted capitalize">{dossier.score_dossier?.appreciation}</p>
              </div>
            )}

            {/* Chiffres clés */}
            {credit && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1">Crédit</p>
                <Row label="Mensualité totale (crédit + assurance)" value={formatEUR(credit.mensualite_totale)} highlight />
                <Row label="Dont mensualité crédit" value={formatEUR(credit.mensualite_credit)} />
                <Row label="Taux nominal retenu" value={formatPct(credit.taux_nominal_retenu)} />
                <Row label="Durée" value={`${credit.duree_annees} ans`} />
                <Row label="Taux d'endettement" value={formatPct(dossier.conformite_hcsf?.criteres?.taux_endettement?.valeur ?? 0)} />
              </div>
            )}

            {plan && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1">Plan de financement</p>
                <Row label="Montant emprunté" value={formatEUR(plan.montant_emprunte)} highlight />
                <Row label="Apport" value={formatEUR(plan.apport)} />
                <Row label="Frais d'acquisition" value={formatEUR(plan.frais_acquisition)} />
                <Row label="Coût total opération" value={formatEUR(plan.cout_total_operation)} />
              </div>
            )}

            {/* Points forts / vigilance */}
            {synthese && (
              <div className="space-y-3">
                {synthese.points_forts?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">Points forts</p>
                    {synthese.points_forts.map((p, i) => (
                      <p key={i} className="text-xs text-ink-muted flex gap-2"><span className="text-emerald-500 shrink-0">✓</span>{p}</p>
                    ))}
                  </div>
                )}
                {synthese.points_de_vigilance?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-1">Points de vigilance</p>
                    {synthese.points_de_vigilance.map((p, i) => (
                      <p key={i} className="text-xs text-ink-muted flex gap-2"><span className="text-amber-500 shrink-0">⚠</span>{p}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
