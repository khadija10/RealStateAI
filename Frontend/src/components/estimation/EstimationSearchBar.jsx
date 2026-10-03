import { useId, useState } from 'react'
import { ANNEE_MAX, construirePayload, DPE, DPE_COULEURS, validerFormulaire } from '../../lib/estimation'
import { cx } from '../../lib/cx'
import { Button, IconArrowRight, IconChart, IconChevronDown, IconEstimate, IconMap, IconPlus, IconSearch } from '../ui'

const champ =
  'min-w-0 bg-transparent p-0 text-[14px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-muted/80'
const sansFleches =
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

/** Un critère de la barre : pastille d'icône, libellé, champ, erreur éventuelle. */
function Critere({ icon: Icon, label, htmlFor, error, errorId, inactive, separe, className, children }) {
  return (
    <div
      className={cx(
        'relative flex items-center gap-3 rounded-[16px] px-3 py-2.5 transition-colors duration-150',
        'hover:bg-surface-2 focus-within:bg-surface-2',
        error && 'bg-danger-soft/60 hover:bg-danger-soft/60',
        separe && 'lg:before:absolute lg:before:-left-px lg:before:top-3 lg:before:bottom-3 lg:before:w-px lg:before:bg-line',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors duration-150',
          inactive ? 'bg-surface-2 text-ink-muted ring-1 ring-line' : 'bg-brand text-on-brand',
        )}
      >
        <Icon size={16} />
      </span>
      <div className={cx('min-w-0 flex-1', inactive && 'opacity-60')}>
        <label htmlFor={htmlFor} className="block text-[11px] leading-tight text-ink-muted">{label}</label>
        {children}
        {error && <p id={errorId} className="mt-0.5 text-[11.5px] leading-snug text-danger">{error}</p>}
      </div>
    </div>
  )
}

/**
 * Formulaire d'estimation en « barre de recherche » (héros de la page).
 * Adresse OU commune : le dernier champ saisi détermine le mode envoyé au
 * serveur. Validation et corps de requête : voir lib/estimation.js.
 */
export default function EstimationSearchBar({ values, onChange, onSubmit, loading, communes }) {
  const [errors, setErrors] = useState({})
  const [criteres, setCriteres] = useState(Boolean(values.dpe || values.annee || values.numeroDpe || values.numeroLot))
  const listId = useId()
  const criteresId = useId()

  function patch(next, cles) {
    onChange({ ...values, ...next })
    if (cles.some((k) => errors[k])) setErrors((x) => ({ ...x, ...Object.fromEntries(cles.map((k) => [k, undefined])) }))
  }
  const set = (k) => (e) => patch({ [k]: e.target.value }, [k])

  function submit(e) {
    e.preventDefault()
    const errs = validerFormulaire(values)
    setErrors(errs)
    const first = Object.keys(errs)[0]
    if (first) {
      if (first === 'annee' || first === 'numeroDpe') setCriteres(true)
      requestAnimationFrame(() => document.getElementById(`estim-${first}`)?.focus())
      return
    }
    onSubmit(construirePayload(values))
  }

  const err = (k) => (errors[k] ? { 'aria-invalid': true, 'aria-describedby': `estim-${k}-err` } : {})
  const surfaceErr = errors.surface || errors.rooms

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label="Décrire le bien à estimer"
      className="rounded-[24px] bg-surface p-2 shadow-overlay sm:p-2.5"
    >
      <div className="grid gap-1 sm:grid-cols-2 lg:flex lg:items-center lg:gap-0">
        <Critere
          icon={IconMap}
          label="Adresse du bien"
          htmlFor="estim-address"
          error={errors.address}
          errorId="estim-address-err"
          inactive={values.mode !== 'adresse'}
          className="lg:flex-[1.5]"
        >
          <input
            id="estim-address"
            className={cx(champ, 'w-full')}
            autoComplete="street-address"
            placeholder="12 rue de la Paix, 75002 Paris"
            value={values.address}
            onChange={(e) => patch({ address: e.target.value, mode: 'adresse' }, ['address', 'commune'])}
            {...err('address')}
          />
        </Critere>

        <Critere
          icon={IconSearch}
          label="ou commune"
          htmlFor="estim-commune"
          error={errors.commune}
          errorId="estim-commune-err"
          inactive={values.mode !== 'commune'}
          separe
          className="lg:flex-1"
        >
          <input
            id="estim-commune"
            className={cx(champ, 'w-full')}
            list={communes.length ? listId : undefined}
            autoComplete="off"
            placeholder="Ex. Versailles"
            value={values.commune}
            onChange={(e) => patch({ commune: e.target.value, mode: e.target.value ? 'commune' : values.address ? 'adresse' : values.mode }, ['address', 'commune'])}
            {...err('commune')}
          />
          {communes.length > 0 && (
            <datalist id={listId}>
              {communes.map((c) => <option key={c} value={c} />)}
            </datalist>
          )}
        </Critere>

        <Critere icon={IconEstimate} label="Type de bien" htmlFor="estim-type" separe className="lg:w-52 lg:flex-none">
          <div className="relative">
            <select
              id="estim-type"
              className={cx(champ, 'w-full cursor-pointer appearance-none pr-5')}
              value={values.type}
              onChange={set('type')}
            >
              <option value="apartment">Appartement</option>
              <option value="house">Maison</option>
            </select>
            <IconChevronDown size={14} className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-ink-muted" />
          </div>
        </Critere>

        <Critere
          icon={IconChart}
          label="Surface · pièces"
          htmlFor="estim-surface"
          error={surfaceErr}
          errorId={errors.surface ? 'estim-surface-err' : 'estim-rooms-err'}
          separe
          className="lg:w-48 lg:flex-none"
        >
          <div className="flex items-baseline gap-1">
            <input
              id="estim-surface"
              type="number"
              inputMode="decimal"
              min="6"
              max="2000"
              step="any"
              placeholder="58"
              className={cx(champ, sansFleches, 'w-12')}
              value={values.surface}
              onChange={set('surface')}
              {...err('surface')}
            />
            <span className="text-xs text-ink-muted">m²</span>
            <label htmlFor="estim-rooms" className="sr-only">Nombre de pièces (facultatif)</label>
            <input
              id="estim-rooms"
              type="number"
              inputMode="numeric"
              min="1"
              max="30"
              step="1"
              placeholder="3"
              className={cx(champ, sansFleches, 'ml-3 w-7')}
              value={values.rooms}
              onChange={set('rooms')}
              {...err('rooms')}
            />
            <span className="text-xs text-ink-muted">p.</span>
          </div>
        </Critere>

        <Button
          type="submit"
          size="lg"
          loading={loading}
          iconRight={loading ? undefined : <IconArrowRight size={17} />}
          className="mt-1 rounded-full sm:col-span-2 lg:mt-0 lg:ml-2 lg:px-7"
        >
          {loading ? 'Estimation…' : 'Estimer'}
        </Button>
      </div>

      {/* ── Critères facultatifs : repliables, sur une seule ligne ───────── */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-line px-1.5 pb-0.5 pt-2">
        <button
          type="button"
          aria-expanded={criteres}
          aria-controls={criteresId}
          onClick={() => setCriteres((o) => !o)}
          className="inline-flex h-9 items-center gap-2.5 rounded-full py-1 pl-1.5 pr-3 text-left text-[13px] transition-colors duration-150 hover:bg-surface-2"
        >
          <span
            aria-hidden="true"
            className={cx(
              'grid h-6 w-6 shrink-0 place-items-center rounded-full transition-[transform,background-color] duration-200',
              criteres ? 'rotate-45 bg-surface-2 text-ink ring-1 ring-inset ring-line' : 'bg-brand text-on-brand',
            )}
          >
            <IconPlus size={13} strokeWidth="2" />
          </span>
          <span className="font-medium text-ink">{criteres ? 'Masquer' : 'Plus de critères'}</span>
          {!criteres &&
            (values.dpe || values.annee || values.numeroDpe || values.numeroLot ? (
              <span className="flex items-center gap-1.5">
                {values.dpe && (
                  <span
                    className="inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold"
                    style={{ background: DPE_COULEURS[values.dpe].fond, color: DPE_COULEURS[values.dpe].texte }}
                  >
                    DPE {values.dpe}
                  </span>
                )}
                {values.annee && (
                  <span className="inline-flex h-5 items-center rounded-full bg-surface-2 px-2 text-[11px] font-medium text-ink-soft ring-1 ring-inset ring-line">
                    {values.annee}
                  </span>
                )}
                {values.numeroDpe && (
                  <span className="inline-flex h-5 items-center rounded-full bg-surface-2 px-2 text-[11px] font-medium text-ink-soft ring-1 ring-inset ring-line">
                    N° DPE
                  </span>
                )}
                {values.numeroLot && (
                  <span className="inline-flex h-5 items-center rounded-full bg-surface-2 px-2 text-[11px] font-medium text-ink-soft ring-1 ring-inset ring-line">
                    Lot {values.numeroLot}
                  </span>
                )}
              </span>
            ) : (
              <span className="hidden text-ink-muted sm:inline">DPE, année, n° de DPE ou de lot · facultatif</span>
            ))}
        </button>

        <div id={criteresId} hidden={!criteres} className="flex basis-full flex-wrap items-center gap-x-7 gap-y-3 px-1.5 pb-1.5 animate-fade-in lg:basis-auto lg:px-0 lg:pb-0">
          <fieldset className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
            <legend className="sr-only">Classe énergie (DPE), facultative : transmise au modèle si renseignée</legend>
            <span aria-hidden="true" className="text-[12px] text-ink-muted">Classe DPE</span>
            <div className="flex flex-wrap items-center gap-1">
              {DPE.map((c) => {
                const actif = values.dpe === c
                const { fond, texte } = DPE_COULEURS[c]
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={actif}
                    aria-label={actif ? `Classe ${c}, sélectionnée : cliquer pour la retirer` : `Classe ${c}`}
                    title={actif ? 'Cliquer pour retirer la classe' : undefined}
                    onClick={() => patch({ dpe: actif ? '' : c }, [])}
                    className={cx(
                      'relative h-8 w-8 overflow-hidden rounded-[9px] text-[12.5px] font-semibold transition-[transform,box-shadow,background-color] duration-150',
                      actif
                        ? 'shadow-sm ring-2 ring-ink/15 ring-offset-1 ring-offset-surface'
                        : 'bg-surface text-ink-soft ring-1 ring-inset ring-line hover:-translate-y-px hover:ring-line-strong',
                    )}
                    style={actif ? { background: fond, color: texte } : undefined}
                  >
                    {c}
                    {!actif && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: fond }} />}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <label htmlFor="estim-numeroDpe" className="text-[12px] text-ink-muted" title="Numéro ADEME à 13 caractères, sur le diagnostic : le serveur retrouve alors la classe et l’année du bien">
              N° de DPE
            </label>
            <input
              id="estim-numeroDpe"
              maxLength={13}
              autoComplete="off"
              spellCheck={false}
              placeholder="13 caractères"
              className={cx(
                'h-8 w-[8.5rem] rounded-[9px] bg-surface px-2.5 text-[13px] font-medium uppercase text-ink outline-none ring-1 ring-inset transition-shadow placeholder:font-normal placeholder:normal-case placeholder:text-ink-muted/80 focus:ring-2 focus:ring-ink-muted',
                errors.numeroDpe ? 'ring-danger' : 'ring-line hover:ring-line-strong',
              )}
              value={values.numeroDpe ?? ''}
              onChange={set('numeroDpe')}
              {...err('numeroDpe')}
            />
            {errors.numeroDpe && <p id="estim-numeroDpe-err" className="text-xs text-danger">{errors.numeroDpe}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <label htmlFor="estim-numeroLot" className="text-[12px] text-ink-muted" title="Numéro de lot de copropriété, sur le titre de propriété">N° de lot</label>
            <input
              id="estim-numeroLot"
              maxLength={20}
              autoComplete="off"
              placeholder="facultatif"
              className="h-8 w-24 rounded-[9px] bg-surface px-2.5 text-[13px] font-medium text-ink outline-none ring-1 ring-inset ring-line transition-shadow placeholder:font-normal placeholder:text-ink-muted/80 hover:ring-line-strong focus:ring-2 focus:ring-ink-muted"
              value={values.numeroLot ?? ''}
              onChange={set('numeroLot')}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <label htmlFor="estim-annee" className="text-[12px] text-ink-muted">Année de construction</label>
            <input
              id="estim-annee"
              type="number"
              inputMode="numeric"
              min="1800"
              max={ANNEE_MAX}
              placeholder="ex. 1975"
              className={cx(
                'h-8 w-24 rounded-[9px] bg-surface px-2.5 text-[13px] font-medium text-ink outline-none ring-1 ring-inset transition-shadow placeholder:font-normal placeholder:text-ink-muted/80 focus:ring-2 focus:ring-ink-muted',
                sansFleches,
                errors.annee ? 'ring-danger' : 'ring-line hover:ring-line-strong',
              )}
              value={values.annee}
              onChange={set('annee')}
              {...err('annee')}
            />
            {errors.annee && <p id="estim-annee-err" className="text-xs text-danger">{errors.annee}</p>}
          </div>
        </div>
      </div>
    </form>
  )
}
