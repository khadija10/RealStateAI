import { useId, useState } from 'react'
import { ANNEE_MAX, construirePayload, DPE, validerFormulaire } from '../../lib/estimation'
import { cx } from '../../lib/cx'
import { Button, Field, IconArrowRight, IconChevronDown, Input, SegmentedControl, Select } from '../ui'

export default function EstimationForm({ values, onChange, onSubmit, loading, communes }) {
  const [errors, setErrors] = useState({})
  const [avance, setAvance] = useState(Boolean(values.dpe || values.annee))
  const listId = useId()
  const avanceId = useId()

  const set = (k) => (e) => {
    const val = e?.target ? e.target.value : e
    onChange({ ...values, [k]: val })
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }))
  }

  function submit(e) {
    e.preventDefault()
    const errs = validerFormulaire(values)
    setErrors(errs)
    const first = Object.keys(errs)[0]
    if (first) {
      if (first === 'dpe' || first === 'annee') setAvance(true)
      requestAnimationFrame(() => document.getElementById(`estim-${first}`)?.focus())
      return
    }
    onSubmit(construirePayload(values))
  }

  const nbAvance = (values.dpe ? 1 : 0) + (values.annee ? 1 : 0)

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5" aria-label="Décrire le bien à estimer">
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-ink-soft">Localisation du bien</span>
        <SegmentedControl
          label="Rechercher par"
          fullWidth
          value={values.mode}
          onChange={(m) => { onChange({ ...values, mode: m }); setErrors({}) }}
          options={[
            { value: 'adresse', label: 'Par adresse' },
            { value: 'commune', label: 'Par commune' },
          ]}
        />
      </div>

      {values.mode === 'adresse' ? (
        <Field id="estim-address" label="Adresse" hint="Numéro, rue et code postal : la localisation est plus précise." error={errors.address}>
          {(a) => (
            <Input
              {...a}
              size="lg"
              autoComplete="street-address"
              placeholder="12 rue de la Paix, 75002 Paris"
              value={values.address}
              onChange={set('address')}
            />
          )}
        </Field>
      ) : (
        <Field
          id="estim-commune"
          label="Commune ou arrondissement"
          hint={communes.length ? 'Commencez à saisir, puis choisissez dans la liste.' : undefined}
          error={errors.commune}
        >
          {(a) => (
            <>
              <Input
                {...a}
                size="lg"
                list={communes.length ? listId : undefined}
                autoComplete="off"
                placeholder="Paris 11e Arrondissement, Versailles…"
                value={values.commune}
                onChange={set('commune')}
              />
              {communes.length > 0 && (
                <datalist id={listId}>
                  {communes.map((c) => <option key={c} value={c} />)}
                </datalist>
              )}
            </>
          )}
        </Field>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-ink-soft">Type de bien</span>
        <SegmentedControl
          label="Type de bien"
          fullWidth
          value={values.type}
          onChange={set('type')}
          options={[
            { value: 'apartment', label: 'Appartement' },
            { value: 'house', label: 'Maison' },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field id="estim-surface" label="Surface habitable" error={errors.surface}>
          {(a) => (
            <Input {...a} type="number" inputMode="decimal" min="6" max="2000" step="any" suffix="m²" placeholder="58" value={values.surface} onChange={set('surface')} />
          )}
        </Field>
        <Field id="estim-rooms" label="Pièces" optional error={errors.rooms}>
          {(a) => (
            <Input {...a} type="number" inputMode="numeric" min="1" max="30" step="1" placeholder="3" value={values.rooms} onChange={set('rooms')} />
          )}
        </Field>
      </div>

      <div className="rounded-control border border-line">
        <button
          type="button"
          aria-expanded={avance}
          aria-controls={avanceId}
          onClick={() => setAvance((o) => !o)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm"
        >
          <span>
            <span className="font-medium text-ink">Affiner l’estimation</span>
            <span className="ml-2 text-ink-muted">
              {nbAvance ? `${nbAvance} critère${nbAvance > 1 ? 's' : ''} ajouté${nbAvance > 1 ? 's' : ''}` : 'DPE, année de construction'}
            </span>
          </span>
          <IconChevronDown size={16} className={cx('shrink-0 text-ink-muted transition-transform duration-200', avance && 'rotate-180')} />
        </button>
        <div id={avanceId} hidden={!avance} className="border-t border-line px-4 pb-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <Field id="estim-dpe" label="Classe DPE" optional>
              {(a) => (
                <Select {...a} value={values.dpe} onChange={set('dpe')}>
                  <option value="">Inconnue</option>
                  {DPE.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              )}
            </Field>
            <Field id="estim-annee" label="Construction" optional error={errors.annee}>
              {(a) => (
                <Input {...a} type="number" inputMode="numeric" min="1800" max={ANNEE_MAX} placeholder="1975" value={values.annee} onChange={set('annee')} />
              )}
            </Field>
          </div>
          <p className="mt-3 text-xs text-ink-muted">Ces critères sont utilisés par le modèle de prédiction.</p>
        </div>
      </div>

      <Button type="submit" size="lg" fullWidth loading={loading} iconRight={<IconArrowRight size={18} />}>
        {loading ? 'Estimation en cours…' : 'Estimer ce bien'}
      </Button>
    </form>
  )
}
