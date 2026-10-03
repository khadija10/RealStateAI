import { cx } from '../../lib/cx'
import { libelleCritereScore, libellePoste } from '../../lib/financement'
import { euro, nb, pct } from '../../lib/format'
import { Badge, Card, IconAlert, IconCheck, IconClose, IconTrend } from '../ui'

const majuscule = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

function Titre({ children, aide, action }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="ds-h3">{children}</h3>
        {aide && <p className="mt-0.5 text-[12.5px] text-ink-muted">{aide}</p>}
      </div>
      {action}
    </div>
  )
}

// ── Taux d'endettement et critères HCSF ─────────────────────────────────

function Jauge({ valeur, plafond }) {
  const max = Math.max(0.5, plafond * 1.45)
  const a = Math.min(valeur, max) / max
  const R = 84
  const cx0 = 110
  const cy0 = 104
  const pt = (t) => {
    const ang = Math.PI * (1 - t)
    return [cx0 + R * Math.cos(ang), cy0 - R * Math.sin(ang)]
  }
  const [x1, y1] = pt(0)
  const [x2, y2] = pt(a)
  const [xe, ye] = pt(1)
  const [sx, sy] = pt(plafond / max)
  const couleur = valeur <= plafond ? 'var(--color-success)' : valeur <= plafond + 0.05 ? 'var(--color-warning)' : 'var(--color-danger)'
  return (
    <svg viewBox="0 0 220 122" className="mx-auto block w-full max-w-[260px]" role="img" aria-label={`Taux d’endettement ${pct(valeur)} pour un plafond de ${pct(plafond, { digits: 0 })}`}>
      <path d={`M${x1} ${y1} A${R} ${R} 0 0 1 ${xe} ${ye}`} stroke="var(--color-line)" strokeWidth="13" fill="none" strokeLinecap="round" />
      <path d={`M${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2}`} stroke={couleur} strokeWidth="13" fill="none" strokeLinecap="round" />
      <line x1={sx} y1={sy - 11} x2={sx} y2={sy + 11} stroke="var(--color-ink)" strokeWidth="2" />
      <text x={sx} y={sy - 16} textAnchor="middle" fontSize="10" fill="var(--color-ink-muted)">{pct(plafond, { digits: 0 })}</text>
      <text x={cx0} y={cy0 - 8} textAnchor="middle" fontSize="34" fontWeight="600" letterSpacing="-1" fill="var(--color-ink)">{pct(valeur)}</text>
    </svg>
  )
}

function Critere({ conforme, libelle, detail }) {
  return (
    <li className="flex items-start gap-2.5 py-2">
      <span
        aria-hidden="true"
        className={cx('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full', conforme ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}
      >
        {conforme ? <IconCheck size={12} strokeWidth="2.4" /> : <IconClose size={12} strokeWidth="2.4" />}
      </span>
      <span className="min-w-0 text-[13px]">
        <span className="font-medium text-ink">{libelle}</span>
        <span className="sr-only">{conforme ? ' : conforme' : ' : non conforme'}</span>
        <span className="block text-[12px] text-ink-muted">{detail}</span>
      </span>
    </li>
  )
}

export function EndettementCard({ dossier }) {
  const c = dossier.conformite_hcsf ?? {}
  const t = c.criteres?.taux_endettement ?? {}
  const d = c.criteres?.duree ?? {}
  const rav = c.criteres?.reste_a_vivre ?? dossier.reste_a_vivre ?? {}
  return (
    <Card padding="lg" className="flex h-full flex-col rounded-[22px]">
      <Titre aide={`Normes du Haut Conseil de stabilité financière`}>Taux <em>d’endettement</em></Titre>
      <Jauge valeur={t.valeur ?? 0} plafond={t.plafond ?? dossier.meta?.base_reglementaire?.taux_endettement_max ?? 0.35} />
      <ul className="mt-2 divide-y divide-line border-t border-line">
        <Critere conforme={t.conforme} libelle="Endettement" detail={`${pct(t.valeur)} pour un plafond de ${pct(t.plafond, { digits: 0 })}, assurance comprise`} />
        <Critere conforme={d.conforme} libelle="Durée" detail={`${d.valeur} ans pour ${d.plafond} ans au plus${d.motif ? ` · ${d.motif}` : ''}`} />
        <Critere
          conforme={rav.conforme}
          libelle="Reste à vivre"
          detail={`${euro(rav.reste_a_vivre)} / mois pour un minimum d’usage de ${euro(rav.minimum_requis)}`}
        />
      </ul>
      {!c.conforme_hcsf && (
        <p className="mt-auto pt-3 text-[12px] leading-relaxed text-ink-muted">
          Dérogation possible : <b className="text-ink">{c.marge_derogation_possible ? 'oui' : 'non'}</b>
        </p>
      )}
    </Card>
  )
}

// ── Plan de financement ─────────────────────────────────────────────────

function Ligne({ label, children, fort, className }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-3 py-2', className)}>
      <dt className={cx('text-[13px]', fort ? 'font-semibold text-ink' : 'text-ink-muted')}>{label}</dt>
      <dd className={cx('ds-num whitespace-nowrap text-right text-[13.5px] font-semibold', fort ? 'text-ink' : 'text-ink-soft')}>{children}</dd>
    </div>
  )
}

export function PlanCard({ dossier }) {
  const p = dossier.plan_financement ?? {}
  const c = dossier.credit ?? {}
  return (
    <Card padding="lg" className="flex h-full flex-col rounded-[22px]">
      <Titre aide="Besoins et ressources de l’opération">Plan de <em>financement</em></Titre>
      <dl className="divide-y divide-line">
        <Ligne label="Prix du bien">{euro(p.prix_bien)}</Ligne>
        {p.montant_travaux > 0 && <Ligne label="Travaux">{euro(p.montant_travaux)}</Ligne>}
        <Ligne label="Frais d’acquisition">{euro(p.frais_acquisition)}</Ligne>
        <Ligne label="Frais de dossier et garantie">{euro(p.frais_credit)}</Ligne>
        <Ligne label="Coût total de l’opération">{euro(p.cout_total_operation)}</Ligne>
        <Ligne label="Apport personnel">− {euro(p.apport)}</Ligne>
        <Ligne label="À emprunter" fort className="!border-t-ink/20">{euro(p.montant_emprunte)}</Ligne>
      </dl>
      <dl className="mt-3 rounded-[14px] bg-surface-2 px-3.5 py-1 ring-1 ring-inset ring-line">
        <Ligne label="Intérêts">{euro(c.total_interets)}</Ligne>
        <Ligne label="Assurance emprunteur" className="border-t border-line">{euro(c.total_assurance)}</Ligne>
        <Ligne label="Montant total remboursé" fort className="border-t border-line">{euro(c.montant_total_rembourse)}</Ligne>
      </dl>
    </Card>
  )
}

// ── Frais d'acquisition ─────────────────────────────────────────────────

function Donut({ parts, total }) {
  const R = 54
  const C = 2 * Math.PI * R
  const longueurs = parts.map((p) => (total > 0 ? (C * p.v) / total : 0))
  const debuts = longueurs.map((_, i) => longueurs.slice(0, i).reduce((a, b) => a + b, 0))
  return (
    <svg viewBox="0 0 150 150" className="h-[132px] w-[132px] shrink-0" role="img" aria-label={`Frais d’acquisition : ${euro(total)}`}>
      {parts.map((p, i) => (
        <circle key={p.l} cx="75" cy="75" r={R} fill="none" stroke={p.c} strokeWidth="20" strokeDasharray={`${longueurs[i]} ${C - longueurs[i]}`} strokeDashoffset={-debuts[i]} transform="rotate(-90 75 75)" />
      ))}
      <text x="75" y="74" textAnchor="middle" fontSize="19" fontWeight="600" fill="var(--color-ink)">{nb(total / 1000)} k€</text>
      <text x="75" y="91" textAnchor="middle" fontSize="9.5" fill="var(--color-ink-muted)">frais d’acquisition</text>
    </svg>
  )
}

export function FraisCard({ dossier }) {
  const a = dossier.plan_financement?.detail_frais_acquisition ?? {}
  const fc = dossier.plan_financement?.detail_frais_credit ?? {}
  const parts = [
    { l: 'Droits de mutation', v: a.droits_mutation ?? 0, c: 'var(--color-chart-1)' },
    { l: 'Émoluments du notaire', v: a.emoluments_notaire_ttc ?? 0, c: 'var(--color-accent)' },
    { l: 'Contribution et débours', v: (a.contribution_securite_immobiliere ?? 0) + (a.debours ?? 0), c: 'var(--color-sable)' },
  ]
  return (
    <Card padding="lg" className="flex h-full flex-col rounded-[22px]">
      <Titre aide={`${pct(a.part_du_prix)} du prix · droits de mutation à ${pct(a.taux_droits_mutation, { digits: 2 })}`}>
        Frais <em>d’acquisition</em>
      </Titre>
      <div className="flex items-center gap-4">
        <Donut parts={parts} total={a.total_frais_acquisition ?? 0} />
        <dl className="min-w-0 flex-1 text-[12.5px]">
          {parts.map((p) => (
            <div key={p.l} className="flex items-baseline justify-between gap-2 py-1.5">
              <dt className="flex min-w-0 items-center gap-2 text-ink-muted">
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.c }} />
                {p.l}
              </dt>
              <dd className="ds-num whitespace-nowrap font-semibold text-ink">{euro(p.v)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-3 rounded-[12px] bg-accent-soft/60 px-3 py-2 text-[12px] leading-relaxed text-ink-soft">
        Le notaire ne perçoit que <b className="text-ink">{pct(a.part_revenant_au_notaire, { digits: 0 })}</b> de ces frais : l’essentiel est constitué de taxes.
      </p>
      <dl className="mt-auto border-t border-line pt-2 text-[12.5px]">
        <div className="flex justify-between gap-2 py-1"><dt className="text-ink-muted">Frais de dossier bancaire</dt><dd className="ds-num font-semibold text-ink">{euro(fc.frais_dossier)}</dd></div>
        <div className="flex justify-between gap-2 py-1"><dt className="text-ink-muted">Garantie ({fc.type_garantie === 'hypotheque' ? 'hypothèque' : 'caution'})</dt><dd className="ds-num font-semibold text-ink">{euro(fc.frais_garantie)}</dd></div>
      </dl>
    </Card>
  )
}

// ── Solidité du dossier : score, leviers, points forts et vigilance ─────

function SousTitre({ children }) {
  return <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{children}</h4>
}

/** Score, leviers chiffrés et points relevés, réunis dans un seul bloc compact. */
export function SoliditeCard({ dossier }) {
  const s = dossier.score_dossier ?? {}
  const criteres = Object.entries(s.detail_points ?? {})
  const aAmeliorer = new Set(s.points_a_ameliorer ?? [])
  const ton = s.score_sur_100 >= 70 ? 'success' : s.score_sur_100 >= 50 ? 'warning' : 'danger'
  const leviers = dossier.synthese?.leviers ?? []
  const forts = dossier.synthese?.points_forts ?? []
  const vigilance = dossier.synthese?.points_de_vigilance ?? []

  return (
    <Card padding="none" className="overflow-hidden rounded-[22px]">
      {/* Score et critères */}
      <div className="grid gap-5 border-b border-line bg-surface-2/60 px-5 py-4 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-center lg:gap-8">
        <div className="flex items-end justify-between gap-3 lg:block">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft" title="Indice propre à RealStateAI : les banques n’utilisent pas de score public, et ce n’est pas un accord de prêt.">
              Score du dossier · indicatif
            </p>
            <p className="ds-num mt-1 text-[40px] font-semibold leading-none tracking-[-0.04em] text-ink">
              {nb(s.score_sur_100)}<span className="text-[16px] font-medium text-ink-muted"> / 100</span>
            </p>
          </div>
          {s.appreciation && <Badge tone={ton} className="lg:mt-2">{majuscule(s.appreciation)}</Badge>}
        </div>
        <ul className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 xl:grid-cols-5">
          {criteres.map(([cle, points]) => {
            const note = s.notes_brutes?.[cle]
            const faible = aAmeliorer.has(cle)
            return (
              <li key={cle} className="min-w-0">
                <div className="flex items-baseline justify-between gap-2 text-[12px]">
                  <span className={cx('truncate', faible ? 'font-medium text-ink' : 'text-ink-soft')} title={libelleCritereScore(cle)}>{libelleCritereScore(cle)}</span>
                  <span className="ds-num shrink-0 font-semibold text-ink">{nb(points)} pts</span>
                </div>
                {note != null && (
                  <div className="mt-1.5 h-1.5 rounded-full bg-line" aria-hidden="true">
                    <span
                      className={cx('block h-full rounded-full', faible ? 'bg-gradient-to-r from-danger/50 to-danger' : 'bg-gradient-to-r from-sable to-accent')}
                      style={{ width: `${Math.max(3, Math.min(1, note) * 100)}%` }}
                    />
                  </div>
                )}
                {faible && <span className="mt-1 block text-[10.5px] font-medium text-danger">à améliorer</span>}
              </li>
            )
          })}
        </ul>
      </div>

      {/* Leviers, points forts, vigilance */}
      <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,1.45fr)] lg:gap-8">
        <div>
          <SousTitre>Leviers d’amélioration</SousTitre>
          {leviers.length ? (
            <ul className="flex flex-col gap-2">
              {leviers.map((l) => (
                <li key={l.levier} className="rounded-[14px] bg-accent-soft/50 p-3 ring-1 ring-inset ring-accent/15">
                  <p className="flex items-start gap-2 text-[12.5px] font-medium text-ink">
                    <IconTrend size={15} className="mt-0.5 shrink-0 text-accent-ink" />
                    {l.description}
                  </p>
                  {l.gain_capacite_emprunt != null && (
                    <p className="mt-1 pl-[23px] text-[12px] text-ink-soft">
                      <b className="ds-num text-success">+{euro(l.gain_capacite_emprunt)}</b> de capacité d’emprunt
                    </p>
                  )}
                  {l.contrepartie && <p className="pl-[23px] text-[11.5px] text-ink-muted">{l.contrepartie}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-ink-muted">Aucun levier particulier identifié par le moteur.</p>
          )}
        </div>
        <div>
          <SousTitre>Points forts</SousTitre>
          {forts.length ? (
            <ul className="flex flex-col gap-1.5">
              {forts.map((p) => (
                <li key={p} className="flex gap-2 text-[12.5px] leading-snug text-ink-soft"><IconCheck size={14} className="mt-0.5 shrink-0 text-success" />{p}</li>
              ))}
            </ul>
          ) : <p className="text-[12.5px] text-ink-muted">Aucun point fort particulier identifié.</p>}
        </div>
        <div>
          <SousTitre>Points de vigilance</SousTitre>
          {vigilance.length ? (
            <ul className="flex flex-col gap-1.5">
              {vigilance.map((p) => (
                <li key={p} className="flex gap-2 text-[12.5px] leading-snug text-ink-soft"><IconAlert size={14} className="mt-0.5 shrink-0 text-warning" />{p}</li>
              ))}
            </ul>
          ) : <p className="text-[12.5px] text-ink-muted">Aucune vigilance particulière.</p>}
        </div>
      </div>
    </Card>
  )
}

// ── Budget prévisionnel ─────────────────────────────────────────────────

export function BudgetCard({ dossier }) {
  const b = dossier.budget_previsionnel
  if (!b) return null
  const postes = [...(b.repartition_indicative ?? [])].sort((x, y) => y.montant_indicatif - x.montant_indicatif)
  const max = Math.max(...postes.map((p) => p.montant_indicatif), 1)
  return (
    <Card padding="lg" className="rounded-[22px]">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10">
        <div className="flex flex-col">
          <Titre aide="Ce qu’il reste chaque mois une fois le crédit et les charges payés">Budget <em>prévisionnel</em></Titre>
          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-[14px] bg-accent-soft/55 p-3 ring-1 ring-inset ring-accent/15">
              <dt className="text-[11.5px] text-ink-muted">Disponible par mois</dt>
              <dd className={cx('ds-num mt-1 text-[22px] font-semibold tracking-[-0.02em]', b.disponible_apres_engagements < 0 ? 'text-danger' : 'text-ink')}>
                {euro(b.disponible_apres_engagements)}
              </dd>
            </div>
            <div className="rounded-[14px] bg-surface-2 p-3 ring-1 ring-inset ring-line">
              <dt className="text-[11.5px] text-ink-muted">Épargne de précaution conseillée</dt>
              <dd className="ds-num mt-1 text-[22px] font-semibold tracking-[-0.02em] text-ink">{euro(b.epargne_precaution_recommandee)}</dd>
            </div>
          </dl>
          <dl className="mt-3 divide-y divide-line text-[12.5px]">
            <div className="flex justify-between gap-2 py-1.5"><dt className="text-ink-muted">Revenus mensuels</dt><dd className="ds-num font-semibold">{euro(b.revenus_mensuels)}</dd></div>
            <div className="flex justify-between gap-2 py-1.5"><dt className="text-ink-muted">Mensualité du crédit</dt><dd className="ds-num font-semibold">− {euro(b.mensualite_credit)}</dd></div>
            <div className="flex justify-between gap-2 py-1.5"><dt className="text-ink-muted">Autres crédits</dt><dd className="ds-num font-semibold">− {euro(b.charges_credits_mensuelles)}</dd></div>
            <div className="flex justify-between gap-2 py-1.5"><dt className="text-ink-muted">Charges du logement</dt><dd className="ds-num font-semibold">− {euro(b.charges_logement_previsionnelles)}</dd></div>
            <div className="flex justify-between gap-2 py-1.5"><dt className="text-ink-muted">Foyer</dt><dd className="ds-num font-semibold">{b.unites_consommation?.toLocaleString('fr-FR')} unités de consommation</dd></div>
          </dl>
          {(b.alertes ?? []).length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {b.alertes.map((a) => (
                <li key={a} className="flex gap-2 text-[12.5px] text-ink-soft"><IconAlert size={14} className="mt-0.5 shrink-0 text-warning" />{a}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2.5 text-[13px] font-medium text-ink-soft">Répartition indicative du disponible</p>
          <ul className="flex flex-col gap-2">
            {postes.map((p) => (
              <li key={p.poste} className="grid grid-cols-[minmax(0,12.5rem)_minmax(0,1fr)_auto] items-center gap-3 text-[12.5px]">
                <span className="truncate text-ink-soft">{libellePoste(p.poste)}</span>
                <span className="h-2 rounded-full bg-line" aria-hidden="true">
                  <span className="block h-full rounded-full bg-gradient-to-r from-sable to-accent" style={{ width: `${(100 * Math.max(0, p.montant_indicatif)) / max}%` }} />
                </span>
                <span className="ds-num whitespace-nowrap text-right font-semibold text-ink">
                  {euro(p.montant_indicatif)} <span className="font-normal text-ink-muted">· {pct(p.part_du_disponible, { digits: 0 })}</span>
                </span>
              </li>
            ))}
          </ul>
          {b.avertissement_methodologique && (
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink-muted">{b.avertissement_methodologique}</p>
          )}
        </div>
      </div>
    </Card>
  )
}
