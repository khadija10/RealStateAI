import { useMemo, useState } from 'react'
import { getFinancingResume } from '../../api/client'
import { CAS_PRIX, HYPOTHESES_ACHAT_LOCATION as H, pointMort } from '../../lib/acheterLouer'
import { cx } from '../../lib/cx'
import { euro, pct } from '../../lib/format'
import { Button, Card, IconCheck, Spinner, useToast } from '../ui'

const ans = (a) => (a == null ? `au-delà de ${H.horizonAns} ans` : `${a} an${a > 1 ? 's' : ''}`)

/** « Acheter ou louer ? » : point mort calculé avec les montants du dossier du serveur. */
export function AcheterLouerCard({ dossier, values }) {
  const c = dossier.credit ?? {}
  const plan = dossier.plan_financement ?? {}
  const cas = useMemo(() => {
    if (!values.loyer) return null
    const donnees = {
      prix: values.prix,
      apport: values.apport,
      montant: plan.montant_emprunte ?? 0,
      tauxAnnuel: c.taux_nominal_retenu ?? 0,
      dureeAns: c.duree_annees ?? values.duree,
      mensualiteCredit: c.mensualite_credit ?? 0,
      assuranceMensuelle: c.mensualite_assurance ?? 0,
      loyer: values.loyer,
    }
    return CAS_PRIX.map((x) => ({ ...x, ...pointMort(donnees, x.evolution) }))
  }, [values.loyer, values.prix, values.apport, values.duree, plan.montant_emprunte, c.taux_nominal_retenu, c.duree_annees, c.mensualite_credit, c.mensualite_assurance])

  return (
    <Card padding="lg" className="flex h-full flex-col rounded-[22px]">
      <h3 className="ds-h3">Acheter <em>ou louer</em> ?</h3>
      <p className="mb-4 mt-0.5 text-[12.5px] text-ink-muted">Au bout de combien d’années l’achat devient-il plus avantageux que la location, à budget égal ?</p>
      {!cas ? (
        <p className="text-[13px] text-ink-muted">Indiquez votre loyer actuel pour comparer l’achat et la location.</p>
      ) : (
        <>
          <p className="text-[14px] leading-relaxed text-ink">
            {cas[1].annee == null
              ? <>À prix stables, l’achat ne rattrape pas la location en {H.horizonAns} ans avec un loyer de <b>{euro(values.loyer)}</b>.</>
              : <>À prix stables, acheter devient plus avantageux que louer au bout de <b>{ans(cas[1].annee)}</b>.</>}
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {cas.map((x, i) => (
              <div key={x.nom} className={cx('rounded-[14px] px-3 py-2.5', i === 1 ? 'bg-brand text-on-brand' : 'bg-accent-soft/55 ring-1 ring-inset ring-accent/15')}>
                <dd className="ds-num text-[17px] font-semibold leading-tight">{ans(x.annee)}</dd>
                <dt className={cx('mt-1 text-[11.5px]', i === 1 ? 'text-on-brand/75' : 'text-ink-muted')}>{x.nom}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
            Avant ce délai, revendre coûte plus cher que d’avoir loué : frais d’acquisition, intérêts et frais de revente ne sont
            pas encore amortis. Hypothèses : loyer de {euro(values.loyer)} revalorisé de {pct(H.hausseLoyer, { digits: 0 })} par an,
            épargne placée à {pct(H.rendement)} net, charges de propriétaire de {pct(H.chargesProprio)} du prix par an, frais de
            revente de {pct(H.fraisRevente, { digits: 0 })}. Crédit : montants calculés par le serveur.
          </p>
        </>
      )}
    </Card>
  )
}

/** Aides aux primo-accédants : signalées, jamais chiffrées (conditions inconnues de la simulation). */
export function AidesCard({ values }) {
  if (!values.primo) return null
  return (
    <Card padding="lg" className="flex h-full flex-col rounded-[22px]">
      <h3 className="ds-h3">Les <em>aides</em> à vérifier</h3>
      <p className="mb-3 mt-0.5 text-[12.5px] text-ink-muted">Non intégrées au calcul : elles dépendent de conditions que la simulation ne connaît pas.</p>
      <ul className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-ink-soft">
        <li className="flex gap-2">
          <IconCheck size={15} className="mt-1 shrink-0 text-accent-ink" />
          <span>
            <b className="text-ink">Prêt à taux zéro (PTZ)</b> : pour une première accession, sous conditions de ressources, de zone
            et de type de logement{values.neuf ? ' ; un logement neuf y est éligible dans toutes les zones' : ' ; dans l’ancien, il est réservé à certains cas (travaux importants, zones précises)'}.
          </span>
        </li>
        <li className="flex gap-2">
          <IconCheck size={15} className="mt-1 shrink-0 text-accent-ink" />
          <span><b className="text-ink">Prêt Action Logement</b> : pour les salariés d’une entreprise privée de 10 salariés ou plus, sous conditions.</span>
        </li>
        <li className="flex gap-2">
          <IconCheck size={15} className="mt-1 shrink-0 text-accent-ink" />
          <span>
            <b className="text-ink">Droits de mutation</b> : en tant que primo-accédant, vous échappez à la hausse votée par les
            départements en 2025 ; c’est déjà pris en compte dans les frais d’acquisition calculés.
          </span>
        </li>
      </ul>
      <p className="mt-auto pt-3 text-[12px] text-ink-muted">
        Conditions à vérifier sur{' '}
        <a href="https://www.service-public.fr/particuliers/vosdroits/F10871" target="_blank" rel="noopener noreferrer" className="font-medium text-accent-ink underline-offset-2 hover:underline">
          service-public.fr
        </a>{' '}
        et auprès de votre banque.
      </p>
    </Card>
  )
}

/** Résumé texte du dossier, rédigé par le moteur du serveur (POST /api/financing/dossier/resume). */
export function ResumeDossier({ payload }) {
  const toast = useToast()
  const [etat, setEtat] = useState({ texte: null, chargement: false, erreur: null })

  async function generer() {
    setEtat({ texte: null, chargement: true, erreur: null })
    try {
      const d = await getFinancingResume(payload)
      setEtat({ texte: d?.resume ?? '', chargement: false, erreur: null })
    } catch (e) {
      setEtat({ texte: null, chargement: false, erreur: e })
    }
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(etat.texte)
      toast.success('Résumé copié.')
    } catch {
      toast.error('Impossible de copier depuis ce navigateur.')
    }
  }

  return (
    <div className="mt-3 rounded-[14px] bg-surface-2 p-3 ring-1 ring-inset ring-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-ink-soft">Résumé du dossier, rédigé par le moteur, à joindre à votre demande.</p>
        <div className="flex gap-2">
          {etat.texte && <Button size="sm" variant="secondary" onClick={copier}>Copier</Button>}
          <Button size="sm" variant="secondary" onClick={generer} disabled={etat.chargement}>
            {etat.chargement ? <><Spinner size={13} /> Rédaction…</> : etat.texte ? 'Actualiser' : 'Obtenir le résumé'}
          </Button>
        </div>
      </div>
      {etat.erreur && <p className="mt-2 text-[12.5px] text-danger">{etat.erreur.message}</p>}
      {etat.texte && <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-ink">{etat.texte}</pre>}
    </div>
  )
}
