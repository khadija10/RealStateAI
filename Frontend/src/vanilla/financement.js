// Page "Financement" — reprise quasi verbatim de l'artefact Claude Design
// (https://claude.ai/artifact/AhSBHGRipcTJvDuiurvHTY), rebranchée sur le
// vrai moteur de financement du backend (POST /api/financing/dossier),
// au lieu du calcul JS local de l'artefact.
import { heroFinancement } from '../illustrations.js'
import { enregistreurSimulation } from './historique.js'
import { champsMontants, afficherMontant } from './montants.js'
import { pointMort, HYPOTHESES } from './acheterlouer.js'
import { scenariosMarche, chargerCorrection } from './scenarios.js'

export const html = `
<section class="heros heros-simple">
  <div class="illus" id="fin-illus-heros"></div>
  <div class="accroche">
    <h1>Financer<em>votre projet</em></h1>
    <p>Capacité d'emprunt, plan de financement et dossier de prêt, calculés selon les
       règles appliquées par les banques (normes du Haut Conseil de stabilité financière).</p>
  </div>
</section>

<h2 class="titre-section">Votre <em>situation</em></h2>
<p class="sous">Règles des banques (HCSF) et barèmes de frais de notaire 2026.</p>

<section class="simu">
  <div class="clair">
    <div class="reglages-grille">
    <div class="reglage reglage-large"><div class="haut"><label for="fin-prix">Prix du bien</label><output id="fin-o-prix"></output></div>
      <input type="range" id="fin-prix" min="80000" max="1500000" step="5000" value="250000"></div>
    <div class="reglage"><div class="haut"><label for="fin-revenus">Revenus nets / mois</label><output id="fin-o-revenus"></output></div>
      <input type="range" id="fin-revenus" min="1500" max="15000" step="100" value="4200"></div>
    <div class="reglage"><div class="haut"><label for="fin-apport">Apport</label><output id="fin-o-apport"></output></div>
      <input type="range" id="fin-apport" min="0" max="300000" step="1000" value="45000"></div>
    <div class="reglage"><div class="haut"><label for="fin-charges">Crédits en cours / mois</label><output id="fin-o-charges"></output></div>
      <input type="range" id="fin-charges" min="0" max="2000" step="10" value="250"></div>
    <div class="reglage"><div class="haut"><label for="fin-loyer">Loyer actuel</label><output id="fin-o-loyer"></output></div>
      <input type="range" id="fin-loyer" min="0" max="4000" step="50" value="1100"></div>
    </div>
    <div class="ligne-choix">
      <div class="choix"><label for="fin-duree">Durée du prêt</label>
        <select id="fin-duree"><option value="15">15 ans</option><option value="20">20 ans</option><option value="25" selected>25 ans</option></select></div>
      <div class="choix"><label for="fin-departement">Département du bien</label>
        <select id="fin-departement"><option value="">— choisir —</option><option value="75">Paris (75)</option>
          <option value="92">Hauts-de-Seine (92)</option><option value="93">Seine-Saint-Denis (93)</option>
          <option value="94">Val-de-Marne (94)</option><option value="77">Seine-et-Marne (77)</option>
          <option value="78">Yvelines (78)</option><option value="91">Essonne (91)</option>
          <option value="95">Val-d'Oise (95)</option></select></div>
    </div>
    <div class="bascules">
      <button type="button" class="bascule" id="fin-primo" role="checkbox" aria-checked="true" aria-pressed="true" title="Primo-accédant : pas propriétaire de sa résidence principale ces deux dernières années">Premier achat</button>
      <button type="button" class="bascule" id="fin-neuf" role="checkbox" aria-checked="false" aria-pressed="false" title="Vente en l'état futur d'achèvement">Neuf, sur plan (VEFA)</button>
    </div>
    <details class="preciser">
      <summary>Préciser <span>facultatif · situation, foyer, charges, taux</span></summary>
      <div class="ligne-choix">
        <div class="choix"><label for="fin-situation">Situation</label>
          <select id="fin-situation"><option value="CDI">CDI</option><option value="fonctionnaire">Fonctionnaire</option><option value="CDD">CDD</option>
            <option value="independant">Indépendant</option><option value="interim">Intérim</option><option value="chomage">Sans emploi</option></select></div>
        <div class="choix"><label for="fin-adultes">Adultes · enfants</label>
          <div class="deux-selects"><select id="fin-adultes" aria-label="Adultes"><option value="1">1 adulte</option><option value="2" selected>2 adultes</option></select>
          <select id="fin-enfants" aria-label="Enfants"><option value="0">0 enfant</option><option value="1" selected>1 enfant</option><option value="2">2 enfants</option><option value="3">3 enfants</option><option value="4">4 enfants</option></select></div></div>
      </div>
      <div class="reglage"><div class="haut"><label for="fin-chargeslog">Charges du futur logement, par mois</label><output id="fin-o-chargeslog"></output></div>
        <input type="range" id="fin-chargeslog" min="0" max="1500" step="10" value="0"></div>
      <div class="ligne-choix">
        <div class="choix"><label for="fin-taux" title="Vide : barème indicatif selon la durée">Taux du crédit (%)</label>
          <input type="number" id="fin-taux" min="0" max="15" step="0.05" inputmode="decimal" placeholder="barème"></div>
        <div class="choix"><label for="fin-assurance" title="Vide : barème indicatif">Assurance (% par an)</label>
          <input type="number" id="fin-assurance" min="0" max="2" step="0.01" inputmode="decimal" placeholder="barème"></div>
      </div>
    </details>
    <button type="button" class="bouton-accent" id="fin-calculer">Calculer mon financement</button>
  </div>

  <div class="sombre sombre-fin">
    <div class="illus" id="fin-illus-dossier"></div>
    <div>
      <span class="verdict" id="fin-verdict"><i></i><span>En attente de votre situation</span></span>
      <div class="mensualite" id="fin-mensualite"></div>
      <div class="precision" id="fin-precision"></div>
      <div class="precision" id="fin-decision"></div>
    </div>
    <div class="mesures" data-resultat hidden>
      <div class="mesure"><b id="fin-emprunt">—</b><span>Montant emprunté</span></div>
      <div class="mesure"><b id="fin-endett">—</b><span>Taux d'endettement</span></div>
      <div class="mesure"><b id="fin-score">—</b><span id="fin-score-lib">Solidité du dossier</span></div>
    </div>
    <dl class="sombre-resume" id="fin-resume" data-resultat hidden></dl>
    <ul class="sombre-attente" id="fin-attente-liste">
      <li>Votre mensualité, assurance comprise</li>
      <li>Le taux d'endettement, comparé au plafond de 35 % des banques</li>
      <li>Le plan de financement et les frais de notaire détaillés</li>
      <li>Le délai au bout duquel acheter devient plus avantageux que louer</li>
    </ul>
  </div>
</section>

<section class="trois" data-resultat hidden>
  <div class="clair analyse">
    <h3>Taux <em>d'endettement</em></h3>
    <p class="aide">Maximum des banques : 35 %, assurance comprise</p>
    <div id="fin-jauge"></div>
    <div class="encart" id="fin-encart-endett"></div>
  </div>
  <div class="clair analyse">
    <h3>Plan de <em>financement</em></h3>
    <p class="aide">Ce que coûte l'achat, ce que vous empruntez</p>
    <table><tbody id="fin-plan"></tbody></table>
  </div>
  <div class="clair analyse">
    <h3>Frais <em>de notaire</em></h3>
    <p class="aide" id="fin-aide-frais"></p>
    <div id="fin-donut"></div>
    <div class="legende-donut" id="fin-legende"></div>
  </div>
</section>

<div data-resultat hidden>
<h2 class="titre-section">Points <em>forts et vigilance</em></h2>
<section class="deux">
  <div class="clair">
    <h3 style="margin:0 0 14px;font-weight:400;font-size:22px">Points <em>forts</em></h3>
    <div id="fin-points-forts"></div>
  </div>
  <div class="clair">
    <h3 style="margin:0 0 14px;font-weight:400;font-size:22px">Points de <em>vigilance</em></h3>
    <div id="fin-points-vigilance"></div>
  </div>
</section>

<h2 class="titre-section">Acheter <em>ou louer</em> ?</h2>

<section class="clair" id="fin-achat-location"></section>

<div id="fin-bloc-aides" hidden>
<h2 class="titre-section">Les <em>aides</em> à vérifier</h2>
<p class="sous">Non comptées dans le calcul : elles dépendent de conditions à vérifier.</p>
<section class="clair" id="fin-aides"></section>
</div>

</div>
<!-- Assistant conversationnel mis de côté en v1.5.1 (limite de débit de l'offre gratuite
     Groq en démonstration). Pour le réactiver : retirer ce commentaire ; le code JS
     correspondant ne s'exécute que si #fin-assistant est présent.
<div id="fin-assistant" hidden>
<h2 class="titre-section">Posez <em>vos questions</em></h2>
<p class="sous">Les réponses viennent des mêmes calculs que la simulation. Information générale, pas un conseil en crédit
  (réservé aux banques et courtiers habilités, IOBSP).</p>
<section class="clair" style="display:flex;flex-direction:column;gap:14px">
  <div id="fin-fil" style="display:flex;flex-direction:column;gap:10px;min-height:120px;max-height:360px;overflow-y:auto"></div>
  <form id="fin-chat-form" style="display:flex;gap:8px">
    <input type="text" id="fin-chat-input" placeholder="Ex : puis-je emprunter sur 20 ans avec mon profil ?"
      style="flex:1;padding:12px 16px;border-radius:999px;border:1px solid var(--ligne);background:var(--fond);font:500 13.5px var(--sans);color:var(--encre);outline:none">
    <button type="submit" class="bouton-accent" style="width:auto;padding:12px 26px;white-space:nowrap">Envoyer</button>
  </form>
</section>
</div>
-->

<div data-resultat hidden>
<!-- « Préparer mon dossier de prêt » mis de côté en v1.5.1 (cases cochées non
     enregistrées). Pour le réactiver : retirer ce commentaire ; pieces() ne fait rien
     tant que #fin-liste est absent.
<details class="pieces-volet">
<summary><span>Préparer mon <em>dossier de prêt</em></span><span id="fin-nb-pieces"></span></summary>
<section class="pieces">
  <div class="pieces-tete"><h3 id="fin-titre-pieces">Dossier</h3><span id="fin-compte" style="font-size:12.5px;color:var(--gris)"></span></div>
  <div class="progression"><i id="fin-barre-pieces" style="width:0"></i></div>
  <div class="liste" id="fin-liste"></div>
</section>
</details>
-->

</div>
<p class="mention">Simulation indicative : ni conseil en financement, ni offre de prêt. Normes HCSF, barèmes des droits de mutation et des émoluments du notaire 2026.</p>
`

const euro = (n) => Math.round(n).toLocaleString('fr-FR') + ' €'
const nb = (n) => Math.round(n).toLocaleString('fr-FR')
const pct = (x, d = 1) => (100 * x).toFixed(d).replace('.', ',') + ' %'

let uid = 0
const id = (p) => p + (++uid)

function interieur() {
  const m = id('m'), f = id('f')
  return `<svg viewBox="0 0 400 480" preserveAspectRatio="xMidYMid slice"><defs>
    <linearGradient id="${m}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6B5140"/><stop offset="1" stop-color="#2E2119"/></linearGradient>
    <linearGradient id="${f}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8B884"/><stop offset="1" stop-color="#7D6A8A"/></linearGradient></defs>
    <rect width="400" height="480" fill="url(#${m})"/><rect x="150" y="60" width="210" height="270" fill="url(#${f})"/>
    <rect x="252" y="60" width="4" height="270" fill="#2E2119"/><rect x="150" y="190" width="210" height="4" fill="#2E2119"/>
    <rect y="380" width="400" height="100" fill="#241A13"/>
    <rect x="40" y="318" width="220" height="70" rx="16" fill="#C9B8A3"/><rect x="52" y="296" width="196" height="40" rx="14" fill="#DDCDB9"/></svg>`
}

export function mount(root, { apiBase = '', prefill } = {}) {
  const $ = (sel) => root.querySelector(sel)
  const $$ = (sel) => root.querySelectorAll(sel)
  const DOSSIER_URL = apiBase + '/api/financing/dossier'
  const historique = enregistreurSimulation(apiBase, prefill?.historique_id, 'financement')
  champsMontants(root, ['revenus', 'apport', 'charges', 'prix', 'loyer', 'chargeslog'].map((k) => [`fin-${k}`, `fin-o-${k}`]))

  $('#fin-illus-heros').innerHTML = heroFinancement()
  $('#fin-illus-dossier').innerHTML = interieur()

  // Préremplissage depuis l'onglet Estimation : reprend le prix du bien
  // estimé comme point de départ de la simulation.
  if (prefill?.prix) {
    const prix = $('#fin-prix')
    prix.value = Math.min(+prix.max, Math.max(+prix.min, Math.round(prefill.prix / 5000) * 5000))
  }
  if (prefill?.departement) $('#fin-departement').value = prefill.departement
  // Loyer d'un bien équivalent, transmis par la page Plus-value (carte des loyers ANIL)
  if (prefill?.loyer) {
    const loyer = $('#fin-loyer')
    loyer.value = Math.min(+loyer.max, Math.max(+loyer.min, prefill.loyer))
  }

  const val = (i) => +$('#' + i).value

  function lire() {
    return {
      revenus: val('fin-revenus'), apport: val('fin-apport'), charges: val('fin-charges'),
      prix: val('fin-prix'), loyer: val('fin-loyer'), duree: val('fin-duree'),
      chargesLogement: val('fin-chargeslog'),
      // Champs vides : barème. Saisis en pourcentage, envoyés en taux.
      taux: $('#fin-taux').value === '' ? null : +$('#fin-taux').value / 100,
      assurance: $('#fin-assurance').value === '' ? null : +$('#fin-assurance').value / 100,
      situation: $('#fin-situation').value, adultes: val('fin-adultes'), enfants: val('fin-enfants'),
      departement: $('#fin-departement').value,
      primo: $('#fin-primo').getAttribute('aria-pressed') === 'true',
      neuf: $('#fin-neuf').getAttribute('aria-pressed') === 'true',
    }
  }

  function majCurseurs() {
    $$('input[type=range]').forEach((r) => {
      r.style.setProperty('--p', (100 * (r.value - r.min)) / (r.max - r.min) + '%')
      const out = $('#fin-o-' + r.id.replace('fin-', ''))
      afficherMontant(out, euro(r.value))
    })
  }

  function jauge(e) {
    const max = 0.5, a = Math.min(e, max) / max, R = 90, cx = 110, cy = 108
    const pt = (t) => { const ang = Math.PI * (1 - t); return [cx + R * Math.cos(ang), cy - R * Math.sin(ang)] }
    const [x1, y1] = pt(0), [x2, y2] = pt(a), [sx, sy] = pt(0.35 / max)
    const couleur = e <= 0.35 ? 'var(--vert)' : e <= 0.4 ? 'var(--ambre)' : 'var(--rouge)'
    return `<svg viewBox="0 0 220 128" style="width:100%;max-width:300px;display:block;margin:0 auto" role="img" aria-label="Taux d'endettement">
      <path d="M${x1} ${y1} A${R} ${R} 0 0 1 ${pt(1)[0]} ${pt(1)[1]}" stroke="var(--ligne)" stroke-width="14" fill="none" stroke-linecap="round"/>
      <path d="M${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2}" stroke="${couleur}" stroke-width="14" fill="none" stroke-linecap="round"/>
      <line x1="${sx}" y1="${sy - 12}" x2="${sx}" y2="${sy + 12}" stroke="var(--encre)" stroke-width="2"/>
      <text x="${sx}" y="${sy - 18}" text-anchor="middle" font-size="10" font-family="Inter,sans-serif" fill="var(--gris)">35 %</text>
      <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="40" font-style="italic" font-family="Instrument Serif,serif" fill="var(--encre)">${pct(e)}</text>
    </svg>`
  }

  function donut(parts) {
    const total = parts.reduce((s, p) => s + p.v, 0), R = 58, C = 2 * Math.PI * R
    let decal = 0, arcs = ''
    parts.forEach((p) => {
      const l = (C * p.v) / total
      arcs += `<circle cx="80" cy="80" r="${R}" fill="none" stroke="${p.c}" stroke-width="22"
        stroke-dasharray="${l} ${C - l}" stroke-dashoffset="${-decal}" transform="rotate(-90 80 80)"/>`
      decal += l
    })
    return `<svg viewBox="0 0 160 160" style="width:160px;display:block;margin:0 auto" role="img" aria-label="Répartition des frais">${arcs}
      <text x="80" y="78" text-anchor="middle" font-size="24" font-style="italic" font-family="Instrument Serif,serif" fill="var(--encre)">${nb(total / 1000)}k €</text>
      <text x="80" y="96" text-anchor="middle" font-size="9.5" font-family="Inter,sans-serif" fill="var(--gris)">frais totaux</text></svg>`
  }

  async function appelDossier(p) {
    const body = {
      profil: {
        revenus_nets_mensuels: p.revenus, apport: p.apport,
        charges_credits_mensuelles: p.charges, autres_revenus_mensuels: 0,
        situation_professionnelle: p.situation, nb_adultes: p.adultes, nb_enfants: p.enfants,
        loyer_actuel: p.loyer, primo_accedant: p.primo,
      },
      projet: {
        prix_bien: p.prix, departement: p.departement, type_bien: p.neuf ? 'neuf' : 'ancien',
        montant_travaux: 0, duree_souhaitee_annees: p.duree, type_garantie: 'caution',
      },
      charges_logement_previsionnelles: p.chargesLogement,
      ...(p.taux != null ? { taux_nominal: p.taux } : {}),
      ...(p.assurance != null ? { taux_assurance: p.assurance } : {}),
    }
    const r = await fetch(DOSSIER_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) throw new Error('dossier indisponible')
    return r.json()
  }

  // Rien n'est calculé à l'ouverture : le premier calcul est lancé par le
  // bouton, les réglages suivants le mettent à jour en direct.
  let seq = 0, timer = null, calcule = false
  function planifier() {
    majCurseurs()
    if (!calcule) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(calculer, 220)
  }

  function enAttente(texte) {
    const v = $('#fin-verdict')
    v.className = 'verdict alerte'
    v.querySelector('span').textContent = texte
  }

  async function calculer() {
    const p = lire()
    if (!p.departement) return enAttente('Choisissez le département du bien')
    calcule = true
    const mySeq = ++seq
    let d
    try {
      d = await appelDossier(p)
    } catch {
      if (mySeq === seq) enAttente('Moteur de financement injoignable — réessayez dans un instant')
      return
    }
    // Scénario de baisse d'« acheter ou louer » : indice INSEE du département et du type de bien
    const correction = await chargerCorrection(apiBase, p.departement, prefill?.type)
    if (mySeq !== seq) return
    afficherDossier(d, p, correction)
  }

  function afficherAchatLocation(d, p, correction) {
    const el = $('#fin-achat-location')
    const c = d.credit || {}, plan = d.plan_financement || {}
    if (!p.loyer) {
      el.innerHTML = `<p class="fiab-txt">Indiquez votre loyer actuel pour comparer l'achat et la location.</p>`
      return
    }
    const donnees = {
      prix: p.prix, apport: p.apport, montant: plan.montant_emprunte || 0,
      tauxAnnuel: c.taux_nominal_retenu || 0, dureeAns: c.duree_annees || p.duree,
      mensualiteCredit: c.mensualite_credit || 0, assuranceMensuelle: c.mensualite_assurance || 0, loyer: p.loyer,
    }
    // Mêmes trois scénarios que l'Estimation et la Plus-value (vanilla/scenarios.js)
    const sc = scenariosMarche(correction)
    if (!sc) {
      el.innerHTML = `<p class="fiab-txt">Indice Notaires-INSEE indisponible pour ce département : la comparaison ne peut pas être calculée.</p>`
      return
    }
    const cas = sc.map((x) => ({ nom: x.court, ...pointMort(donnees, x.taux) }))
    const ans = (a) => a == null ? 'au-delà de 30 ans' : `${a} an${a > 1 ? 's' : ''}`
    const central = cas[1]
    const h = HYPOTHESES, pc = (x) => String(+(x * 100).toFixed(1)).replace('.', ',') + ' %'
    el.innerHTML = `
      <p class="ach-verdict">${central.annee == null
        ? `À prix stables, l'achat ne rattrape pas la location en 30 ans avec un loyer de ${euro(p.loyer)}.`
        : `À prix stables, acheter devient plus avantageux que louer au bout de <b>${ans(central.annee)}</b>.`}</p>
      <div class="ach-cas">${cas.map((x, i) => `<div class="ach-tuile${i === 1 ? ' central' : ''}"><b>${ans(x.annee)}</b><span>${x.nom}</span></div>`).join('')}</div>
      <details class="hypotheses"><summary>Hypothèses du calcul</summary>
        <p class="fiab-txt">Avant ce délai, revendre coûte plus cher que d'avoir loué (frais d'achat, intérêts et frais de revente
        pas encore amortis). Loyer de ${euro(p.loyer)} revalorisé de ${pc(h.hausseLoyer)} par an, épargne placée à ${pc(h.rendement)} net,
        charges de propriétaire de ${pc(h.chargesProprio)} du prix par an, frais de revente de ${pc(h.fraisRevente)}.
        <span class="source" title="${sc[0].detail}">Scénarios — baisse : ${sc[0].source} ; reprise : ${sc[2].source}.</span></p></details>`
  }

  // Aides aux primo-accédants : signalées, jamais chiffrées (conditions de
  // ressources, de zone et d'employeur inconnues de la simulation).
  function afficherAides(p) {
    const bloc = $('#fin-bloc-aides')
    bloc.hidden = !p.primo
    if (!p.primo) return
    $('#fin-aides').innerHTML = `<ul class="aides">
      <li><b>Prêt à taux zéro (PTZ)</b> : sous conditions de revenus et selon la zone de la commune${p.neuf ? '' : ' ; dans l\'ancien, seulement dans certains cas (travaux importants, zones précises)'}.
        <a href="https://www.service-public.gouv.fr/simulateur/calcul/zonage-abc" target="_blank" rel="noopener">Zone ${prefill?.commune ? `de ${prefill.commune}` : 'de votre commune'}</a> ·
        <a href="https://www.service-public.fr/particuliers/vosdroits/F10871" target="_blank" rel="noopener">conditions</a></li>
      <li><b>Prêt Action Logement</b> : jusqu'à 30 000 € à 1 %, pour les salariés d'une entreprise privée de 10 salariés ou plus.</li>
      <li><b>Taxes réduites</b> : premier achat, pas de hausse des droits de mutation de 2025 (déjà compté dans les frais de notaire).</li>
    </ul>`
  }

  function afficherDossier(d, p, correction) {
    $$('[data-resultat]').forEach((el) => { el.hidden = false })
    const conf = d.conformite_hcsf || {}
    const endettement = conf.criteres?.taux_endettement?.valeur ?? 0
    const conforme = !!conf.conforme_hcsf
    const v = $('#fin-verdict')
    v.className = 'verdict' + (conforme ? '' : endettement <= 0.4 ? ' alerte' : ' refus')
    v.querySelector('span').textContent = (conforme
      ? 'Finançable selon les règles des banques'
      : endettement <= 0.4 ? 'Au-delà de 35 % : dérogation nécessaire' : 'Non finançable en l\'état')

    const credit = d.credit || {}
    $('#fin-mensualite').innerHTML = nb(credit.mensualite_totale || 0) + '<small>€ / mois</small>'
    $('#fin-precision').textContent =
      `sur ${p.duree} ans · taux ${p.taux != null ? 'saisi' : 'indicatif'} ${pct(credit.taux_nominal_retenu || 0, 2)} · assurance ${nb(credit.mensualite_assurance || 0)} €/mois`

    const plan = d.plan_financement || {}
    $('#fin-emprunt').textContent = nb((plan.montant_emprunte || 0) / 1000) + 'k €'
    $('#fin-endett').textContent = pct(endettement)
    $('#fin-score').textContent = Math.round(d.score_dossier?.score_sur_100 || 0) + '/100'
    const appreciation = d.score_dossier?.appreciation
    $('#fin-score-lib').textContent = 'Solidité du dossier' + (appreciation ? ' · ' + appreciation : '')
    $('#fin-score-lib').title = `Indice propre à RealStateAI : les banques n'utilisent pas de score public, et ce n'est pas un accord de prêt.`
    // La décision n'est affichée que si elle précise le verdict (sinon elle le répète)
    const decision = d.synthese?.decision_indicative || ''
    const verdict = $('#fin-verdict').textContent.toLowerCase()
    // Hors normes, le verdict à trois niveaux (dérogation / non finançable) dit déjà la décision :
    // la décision binaire du moteur (« dérogation nécessaire ») le contredirait.
    // Le verdict dit déjà si le dossier passe : la décision du moteur (« conforme aux normes HCSF ») le répéterait
    $('#fin-decision').textContent = conforme && decision && !/conforme/i.test(decision) && !verdict.includes(decision.toLowerCase()) ? decision : ''

    $('#fin-attente-liste').hidden = true
    $('.sombre-fin').classList.add('avec-resultat')
    $('#fin-resume').innerHTML = [
      ['Frais de notaire', euro(plan.frais_acquisition || 0)],
      ['Coût total du crédit', euro(credit.cout_total_credit || 0)],
      ['Reste à vivre, par mois', euro((d.reste_a_vivre || {}).reste_a_vivre || 0)],
    ].map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join('')

    afficherAchatLocation(d, p, correction)
    afficherAides(p)
    historique.planifier({
      prix: p.prix, apport: p.apport, revenus: p.revenus, duree: credit.duree_annees || p.duree,
      departement: p.departement, verdict: $('#fin-verdict').textContent.trim(),
      conforme_hcsf: conforme, taux_endettement: endettement,
      mensualite: Math.round(credit.mensualite_totale || 0), taux: credit.taux_nominal_retenu || null,
      montant_emprunte: Math.round(plan.montant_emprunte || 0),
      score: Math.round(d.score_dossier?.score_sur_100 || 0),
    })
    $('#fin-jauge').innerHTML = jauge(endettement)
    const rav = d.reste_a_vivre || {}
    $('#fin-encart-endett').innerHTML = conforme
      ? `Reste à vivre : <b>${euro(rav.reste_a_vivre || 0)}</b> / mois (minimum demandé : ${euro(rav.minimum_requis || 0)}).`
      : `Au-delà de 35 %, seuls 20 % des dossiers d'une banque peuvent être acceptés par dérogation.`

    const acq = plan.detail_frais_acquisition || {}
    $('#fin-plan').innerHTML = `
      <tr><td>Prix du bien</td><td class="n">${euro(plan.prix_bien || p.prix)}</td></tr>
      <tr><td>Frais de notaire</td><td class="n">${euro(plan.frais_acquisition || 0)}</td></tr>
      <tr><td>Frais de banque et caution</td><td class="n">${euro(plan.frais_credit || 0)}</td></tr>
      <tr><td>Apport</td><td class="n">− ${euro(plan.apport ?? p.apport)}</td></tr>
      <tr class="total"><td>À emprunter</td><td class="n">${euro(plan.montant_emprunte || 0)}</td></tr>
      <tr><td>Intérêts et assurance, sur ${credit.duree_annees || p.duree} ans</td><td class="n">${euro(credit.cout_total_credit || 0)}</td></tr>`

    $('#fin-aide-frais').textContent = `${pct(acq.part_du_prix || 0)} du prix du bien`
    $('#fin-aide-frais').title = `Droits de mutation à ${pct(acq.taux_droits_mutation || 0, 3)}`
    const parts = [
      { l: 'Taxes (droits de mutation)', v: acq.droits_mutation || 0, c: 'var(--brun)' },
      { l: 'Rémunération du notaire', v: acq.emoluments_notaire_ttc || 0, c: 'var(--taupe)' },
      { l: 'Frais divers', v: (acq.contribution_securite_immobiliere || 0) + (acq.debours || 0), c: 'var(--sable)' },
    ]
    $('#fin-donut').innerHTML = donut(parts)
    $('#fin-legende').innerHTML = parts.map((x) => `<div><i style="background:${x.c}"></i>${x.l}<span>${euro(x.v)}</span></div>`).join('') +
      `<div class="encart">Le notaire en garde <b>${pct(acq.part_revenant_au_notaire || 0, 0)}</b> ; le reste, ce sont des taxes.</div>`

    const pointsForts = d.synthese?.points_forts || []
    const pointsVigilance = d.synthese?.points_de_vigilance || []
    $('#fin-points-forts').innerHTML = pointsForts.length
      ? pointsForts.map((p) => `<p style="display:flex;gap:8px;font-size:13px;color:var(--gris);margin:0 0 10px"><span style="color:var(--vert);flex:none">✓</span>${p}</p>`).join('')
      : `<p style="font-size:13px;color:var(--gris)">Aucun point fort particulier identifié.</p>`
    $('#fin-points-vigilance').innerHTML = pointsVigilance.length
      ? pointsVigilance.map((p) => `<p style="display:flex;gap:8px;font-size:13px;color:var(--gris);margin:0 0 10px"><span style="color:var(--ambre);flex:none">⚠</span>${p}</p>`).join('')
      : `<p style="font-size:13px;color:var(--gris)">Aucune vigilance particulière.</p>`

    pieces(d.pieces_justificatives)
  }

  const coches = new Set()
  function pieces(info) {
    if (!$('#fin-liste')) return   // bloc commenté dans le HTML
    const liste = info?.pieces || []
    const noms = { CDI: 'CDI', fonctionnaire: 'fonctionnaire', CDD: 'CDD', independant: 'indépendant', interim: 'intérim' }
    $('#fin-titre-pieces').innerHTML = `Dossier <em>${noms[info?.situation] || ''}</em>`
    $('#fin-liste').innerHTML = liste.map((x) =>
      `<label class="piece"><input type="checkbox" data-p="${x}" ${coches.has(x) ? 'checked' : ''}><span>${x}</span></label>`).join('')
    const faites = liste.filter((x) => coches.has(x)).length
    $('#fin-compte').textContent = liste.length ? `${faites} sur ${liste.length} réunies` : ''
    $('#fin-nb-pieces').textContent = liste.length ? `${liste.length} pièces · liste adaptée à votre situation` : ''
    $('#fin-barre-pieces').style.width = liste.length ? (100 * faites) / liste.length + '%' : '0'
  }
  $('#fin-liste')?.addEventListener('change', (e) => {
    const c = e.target.dataset.p
    if (!c) return
    e.target.checked ? coches.add(c) : coches.delete(c)
    const liste = [...$$('#fin-liste input')].map((i) => i.dataset.p)
    const faites = liste.filter((x) => coches.has(x)).length
    $('#fin-compte').textContent = `${faites} sur ${liste.length} réunies`
    $('#fin-barre-pieces').style.width = (100 * faites) / liste.length + '%'
  })

  $$('input[type=range],input[type=number],select').forEach((el) => el.addEventListener('input', planifier))
  ;['fin-primo', 'fin-neuf'].forEach((i) => $('#' + i).addEventListener('click', (e) => {
    const b = e.currentTarget
    const coche = String(b.getAttribute('aria-pressed') !== 'true')
    b.setAttribute('aria-pressed', coche)
    b.setAttribute('aria-checked', coche)
    planifier()
  }))

  $('#fin-calculer').addEventListener('click', calculer)
  $('#fin-precision').textContent = 'Renseignez votre situation, puis cliquez sur « Calculer mon financement ».'
  $('#fin-departement').addEventListener('input', planifier)
  majCurseurs()

  // ================= AGENT CONVERSATIONNEL =================
  // Branché sur le vrai moteur (POST /api/financing/agent/message) : chaque
  // réponse vient d'un appel d'outil déterministe, jamais d'une invention.
  // Ne s'exécute que si le bloc #fin-assistant est présent (commenté dans le HTML en v1.5.1)
  const assistantActif = !!$('#fin-assistant')
  const sessionId = 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  function ajouterBulle(role, texte) {
    const fil = $('#fin-fil')
    const b = document.createElement('div')
    b.className = 'bulle ' + (role === 'user' ? 'moi' : 'ia') + ' vue'
    // Texte échappé, puis seulement le gras et les retours à la ligne (réponses du modèle)
    const sur = String(texte).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
    b.innerHTML = sur.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')
    fil.appendChild(b)
    fil.scrollTop = fil.scrollHeight
  }
  if (assistantActif) ajouterBulle('ia', "Bonjour ! Posez-moi une question sur votre dossier — durée, apport, éligibilité…")
  // L'assistant n'apparaît que s'il est configuré (clé d'API du fournisseur de langage)
  if (assistantActif) fetch(apiBase + '/api/financing/agent/statut', { signal: AbortSignal.timeout(5000) })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { $('#fin-assistant').hidden = !d?.disponible })
    .catch(() => {})

  $('#fin-chat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const input = $('#fin-chat-input')
    const message = input.value.trim()
    if (!message) return
    ajouterBulle('user', message)
    input.value = ''
    input.disabled = true
    try {
      const rep = await fetch(apiBase + '/api/financing/agent/message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message }),
        signal: AbortSignal.timeout(20000),
      })
      if (!rep.ok) throw new Error()
      const d = await rep.json()
      ajouterBulle('ia', d.reply || "(réponse vide)")
    } catch {
      ajouterBulle('ia', "Désolé, l'agent conversationnel est momentanément indisponible.")
    } finally {
      input.disabled = false
      input.focus()
    }
  })

  return () => {
    if (timer) clearTimeout(timer)
    historique.annuler()
    if (assistantActif) fetch(apiBase + '/api/financing/agent/' + sessionId, { method: 'DELETE' }).catch(() => {})
  }
}
