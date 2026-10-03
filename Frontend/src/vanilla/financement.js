// Page "Financement" — reprise quasi verbatim de l'artefact Claude Design
// (https://claude.ai/artifact/AhSBHGRipcTJvDuiurvHTY), rebranchée sur le
// vrai moteur de financement du backend (POST /api/financing/dossier),
// au lieu du calcul JS local de l'artefact.
import { heroFinancement } from '../illustrations.js'
import { enregistreurSimulation } from './historique.js'

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
<p class="sous">Renseignez votre situation, puis lancez le calcul. Les montants suivent les
  règles des banques et les barèmes de frais de notaire 2026.</p>

<section class="simu">
  <div class="clair">
    <div class="reglage"><div class="haut"><label for="fin-revenus">Revenus nets du foyer</label><output id="fin-o-revenus"></output></div>
      <input type="range" id="fin-revenus" min="1500" max="15000" step="100" value="4200"></div>
    <div class="reglage"><div class="haut"><label for="fin-apport">Apport personnel</label><output id="fin-o-apport"></output></div>
      <input type="range" id="fin-apport" min="0" max="300000" step="1000" value="45000"></div>
    <div class="reglage"><div class="haut"><label for="fin-charges">Crédits en cours, par mois</label><output id="fin-o-charges"></output></div>
      <input type="range" id="fin-charges" min="0" max="2000" step="10" value="250"></div>
    <div class="reglage"><div class="haut"><label for="fin-prix">Prix du bien</label><output id="fin-o-prix"></output></div>
      <input type="range" id="fin-prix" min="80000" max="1500000" step="5000" value="250000"></div>
    <div class="reglage"><div class="haut"><label for="fin-loyer">Loyer actuel</label><output id="fin-o-loyer"></output></div>
      <input type="range" id="fin-loyer" min="0" max="4000" step="50" value="1100"></div>

    <div class="ligne-choix">
      <div class="choix"><label for="fin-duree">Durée</label>
        <select id="fin-duree"><option value="15">15 ans</option><option value="20">20 ans</option><option value="25" selected>25 ans</option></select></div>
      <div class="choix"><label for="fin-situation">Situation</label>
        <select id="fin-situation"><option value="CDI">CDI</option><option value="fonctionnaire">Fonctionnaire</option><option value="CDD">CDD</option>
          <option value="independant">Indépendant</option><option value="interim">Intérim</option><option value="chomage">Sans emploi</option></select></div>
    </div>
    <div class="ligne-choix">
      <div class="choix"><label for="fin-adultes">Adultes</label>
        <select id="fin-adultes"><option value="1">1</option><option value="2" selected>2</option></select></div>
      <div class="choix"><label for="fin-enfants">Enfants</label>
        <select id="fin-enfants"><option>0</option><option selected>1</option><option>2</option><option>3</option><option>4</option></select></div>
    </div>
    <div class="ligne-choix">
      <div class="choix"><label for="fin-departement">Département du bien</label>
        <select id="fin-departement"><option value="">— choisir —</option><option value="75">Paris (75)</option>
          <option value="92">Hauts-de-Seine (92)</option><option value="93">Seine-Saint-Denis (93)</option>
          <option value="94">Val-de-Marne (94)</option><option value="77">Seine-et-Marne (77)</option>
          <option value="78">Yvelines (78)</option><option value="91">Essonne (91)</option>
          <option value="95">Val-d'Oise (95)</option></select></div>
    </div>
    <div class="bascules">
      <button type="button" class="bascule" id="fin-primo" aria-pressed="true">Primo-accédant</button>
      <button type="button" class="bascule" id="fin-neuf" aria-pressed="false">Bien neuf · VEFA</button>
    </div>
    <button type="button" class="bouton-accent" id="fin-calculer">Calculer mon financement</button>
  </div>

  <div class="sombre">
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
      <div class="mesure"><b id="fin-score">—</b><span id="fin-score-lib">Score du dossier</span></div>
    </div>
  </div>
</section>

<section class="trois" data-resultat hidden>
  <div class="clair analyse">
    <h3>Taux <em>d'endettement</em></h3>
    <p class="aide">Plafond HCSF : 35 %, assurance comprise</p>
    <div id="fin-jauge"></div>
    <div class="encart" id="fin-encart-endett"></div>
  </div>
  <div class="clair analyse">
    <h3>Plan de <em>financement</em></h3>
    <p class="aide">Besoins et ressources de l'opération</p>
    <table><tbody id="fin-plan"></tbody></table>
  </div>
  <div class="clair analyse">
    <h3>Frais <em>d'acquisition</em></h3>
    <p class="aide" id="fin-aide-frais"></p>
    <div id="fin-donut"></div>
    <div class="legende-donut" id="fin-legende"></div>
  </div>
</section>

<div data-resultat hidden>
<h2 class="titre-section">Points <em>forts et vigilance</em></h2>
<p class="sous">Évalués à partir de votre situation, selon les critères des banques.</p>
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

</div>
<h2 class="titre-section">Posez <em>vos questions</em></h2>
<p class="sous">L'assistant utilise les mêmes calculs que la simulation : il ne donne jamais un chiffre au hasard.</p>
<section class="clair" style="display:flex;flex-direction:column;gap:14px">
  <div id="fin-fil" style="display:flex;flex-direction:column;gap:10px;min-height:120px;max-height:360px;overflow-y:auto"></div>
  <form id="fin-chat-form" style="display:flex;gap:8px">
    <input type="text" id="fin-chat-input" placeholder="Ex : puis-je emprunter sur 20 ans avec mon profil ?"
      style="flex:1;padding:12px 16px;border-radius:999px;border:1px solid var(--ligne);background:var(--fond);font:500 13.5px var(--sans);color:var(--encre);outline:none">
    <button type="submit" class="bouton-accent" style="width:auto;padding:12px 26px;white-space:nowrap">Envoyer</button>
  </form>
</section>

<div data-resultat hidden>
<h2 class="titre-section">Vos <em>pièces</em> justificatives</h2>
<section class="pieces">
  <div class="pieces-tete"><h3 id="fin-titre-pieces">Dossier</h3><span id="fin-compte" style="font-size:12.5px;color:var(--gris)"></span></div>
  <div class="progression"><i id="fin-barre-pieces" style="width:0"></i></div>
  <div class="liste" id="fin-liste"></div>
</section>

</div>
<div class="bas">
  <span>Normes HCSF · Barèmes DMTO et émoluments 2026 · Moteur de règles RealStateAI</span>
  <span>Simulation indicative : ni conseil en financement, ni offre de prêt.</span>
  <span>RealStateAI — v${__APP_VERSION__}</span>
</div>
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

  $('#fin-illus-heros').innerHTML = heroFinancement()
  $('#fin-illus-dossier').innerHTML = interieur()

  // Préremplissage depuis l'onglet Estimation : reprend le prix du bien
  // estimé comme point de départ de la simulation.
  if (prefill?.prix) {
    const prix = $('#fin-prix')
    prix.value = Math.min(+prix.max, Math.max(+prix.min, Math.round(prefill.prix / 5000) * 5000))
  }
  if (prefill?.departement) $('#fin-departement').value = prefill.departement

  const val = (i) => +$('#' + i).value

  function lire() {
    return {
      revenus: val('fin-revenus'), apport: val('fin-apport'), charges: val('fin-charges'),
      prix: val('fin-prix'), loyer: val('fin-loyer'), duree: val('fin-duree'),
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
      if (out) out.textContent = euro(r.value)
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
    if (mySeq !== seq) return
    afficherDossier(d, p)
  }

  function afficherDossier(d, p) {
    $$('[data-resultat]').forEach((el) => { el.hidden = false })
    const conf = d.conformite_hcsf || {}
    const endettement = conf.criteres?.taux_endettement?.valeur ?? 0
    const conforme = !!conf.conforme_hcsf
    const v = $('#fin-verdict')
    v.className = 'verdict' + (conforme ? '' : endettement <= 0.4 ? ' alerte' : ' refus')
    v.querySelector('span').textContent = (conforme
      ? 'Conforme aux normes HCSF'
      : endettement <= 0.4 ? 'Hors normes — dérogation nécessaire' : 'Non finançable en l\'état')

    const credit = d.credit || {}
    $('#fin-mensualite').innerHTML = nb(credit.mensualite_totale || 0) + '<small>€ / mois</small>'
    $('#fin-precision').textContent =
      `sur ${p.duree} ans · taux indicatif ${pct(credit.taux_nominal_retenu || 0, 2)} · assurance ${nb(credit.mensualite_assurance || 0)} €/mois`

    const plan = d.plan_financement || {}
    $('#fin-emprunt').textContent = nb((plan.montant_emprunte || 0) / 1000) + 'k €'
    $('#fin-endett').textContent = pct(endettement)
    $('#fin-score').textContent = Math.round(d.score_dossier?.score_sur_100 || 0) + '/100'
    const appreciation = d.score_dossier?.appreciation
    $('#fin-score-lib').textContent = 'Score du dossier' + (appreciation ? ' · ' + appreciation : '')
    // La décision n'est affichée que si elle précise le verdict (sinon elle le répète)
    const decision = d.synthese?.decision_indicative || ''
    const verdict = $('#fin-verdict').textContent.toLowerCase()
    // Hors normes, le verdict à trois niveaux (dérogation / non finançable) dit déjà la décision :
    // la décision binaire du moteur (« dérogation nécessaire ») le contredirait.
    $('#fin-decision').textContent = conforme && decision && !verdict.includes(decision.toLowerCase()) ? decision : ''

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
      ? `Reste à vivre : <b>${euro(rav.reste_a_vivre || 0)}</b> par mois, soit <b>${euro(Math.max(0, rav.marge || 0))}</b> de plus que le minimum d'usage (${euro(rav.minimum_requis || 0)}).`
      : `Au-delà de 35 %, le dossier ne passe que par la <b>marge de dérogation</b> : 20 % des dossiers d'une banque par trimestre.`

    const acq = plan.detail_frais_acquisition || {}
    $('#fin-plan').innerHTML = `
      <tr><td>Prix du bien</td><td class="n">${euro(plan.prix_bien || p.prix)}</td></tr>
      <tr><td>Frais d'acquisition</td><td class="n">${euro(plan.frais_acquisition || 0)}</td></tr>
      <tr><td>Frais de dossier et garantie</td><td class="n">${euro(plan.frais_credit || 0)}</td></tr>
      <tr><td>Apport</td><td class="n">− ${euro(plan.apport ?? p.apport)}</td></tr>
      <tr class="total"><td>À emprunter</td><td class="n">${euro(plan.montant_emprunte || 0)}</td></tr>
      <tr><td>Mensualité hors assurance, sur ${credit.duree_annees || p.duree} ans</td><td class="n">${euro(credit.mensualite_credit || 0)}</td></tr>
      ${plan.cout_total_operation ? `<tr><td>Coût total de l'opération</td><td class="n">${euro(plan.cout_total_operation)}</td></tr>` : ''}
      <tr><td>Coût total du crédit</td><td class="n">${euro(credit.cout_total_credit || 0)}</td></tr>
      <tr><td>Reste à vivre</td><td class="n">${euro(rav.reste_a_vivre || 0)}</td></tr>`

    $('#fin-aide-frais').textContent = `${pct(acq.part_du_prix || 0)} du prix · droits de mutation à ${pct(acq.taux_droits_mutation || 0, 3)}`
    const parts = [
      { l: 'Droits de mutation', v: acq.droits_mutation || 0, c: 'var(--brun)' },
      { l: 'Émoluments du notaire', v: acq.emoluments_notaire_ttc || 0, c: 'var(--taupe)' },
      { l: 'Débours et contribution', v: (acq.contribution_securite_immobiliere || 0) + (acq.debours || 0), c: 'var(--sable)' },
    ]
    $('#fin-donut').innerHTML = donut(parts)
    $('#fin-legende').innerHTML = parts.map((x) => `<div><i style="background:${x.c}"></i>${x.l}<span>${euro(x.v)}</span></div>`).join('') +
      `<div class="encart">Le notaire ne perçoit que <b>${pct(acq.part_revenant_au_notaire || 0, 0)}</b> des frais : l'essentiel est constitué de taxes.</div>`

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
    const liste = info?.pieces || []
    const noms = { CDI: 'CDI', fonctionnaire: 'fonctionnaire', CDD: 'CDD', independant: 'indépendant', interim: 'intérim' }
    $('#fin-titre-pieces').innerHTML = `Dossier <em>${noms[info?.situation] || ''}</em>`
    $('#fin-liste').innerHTML = liste.map((x) =>
      `<label class="piece"><input type="checkbox" data-p="${x}" ${coches.has(x) ? 'checked' : ''}><span>${x}</span></label>`).join('')
    const faites = liste.filter((x) => coches.has(x)).length
    $('#fin-compte').textContent = liste.length ? `${faites} sur ${liste.length} réunies` : ''
    $('#fin-barre-pieces').style.width = liste.length ? (100 * faites) / liste.length + '%' : '0'
  }
  $('#fin-liste').addEventListener('change', (e) => {
    const c = e.target.dataset.p
    if (!c) return
    e.target.checked ? coches.add(c) : coches.delete(c)
    const liste = [...$$('#fin-liste input')].map((i) => i.dataset.p)
    const faites = liste.filter((x) => coches.has(x)).length
    $('#fin-compte').textContent = `${faites} sur ${liste.length} réunies`
    $('#fin-barre-pieces').style.width = (100 * faites) / liste.length + '%'
  })

  $$('input[type=range],select').forEach((el) => el.addEventListener('input', planifier))
  ;['fin-primo', 'fin-neuf'].forEach((i) => $('#' + i).addEventListener('click', (e) => {
    const b = e.currentTarget
    b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))
    planifier()
  }))

  $('#fin-calculer').addEventListener('click', calculer)
  $('#fin-precision').textContent = 'Renseignez votre situation, puis cliquez sur « Calculer mon financement ».'
  $('#fin-departement').addEventListener('input', planifier)
  majCurseurs()

  // ================= AGENT CONVERSATIONNEL =================
  // Branché sur le vrai moteur (POST /api/financing/agent/message) : chaque
  // réponse vient d'un appel d'outil déterministe, jamais d'une invention.
  const sessionId = 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  function ajouterBulle(role, texte) {
    const fil = $('#fin-fil')
    const b = document.createElement('div')
    b.className = 'bulle ' + (role === 'user' ? 'moi' : 'ia') + ' vue'
    b.textContent = texte
    fil.appendChild(b)
    fil.scrollTop = fil.scrollHeight
  }
  ajouterBulle('ia', "Bonjour ! Posez-moi une question sur votre dossier — durée, apport, éligibilité…")

  $('#fin-chat-form').addEventListener('submit', async (e) => {
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
    fetch(apiBase + '/api/financing/agent/' + sessionId, { method: 'DELETE' }).catch(() => {})
  }
}
