// Page "Financement" — reprise quasi verbatim de l'artefact Claude Design
// (https://claude.ai/artifact/AhSBHGRipcTJvDuiurvHTY), rebranchée sur le
// vrai moteur de financement du backend (POST /api/financing/dossier),
// au lieu du calcul JS local de l'artefact.
import { heroFinancement } from '../illustrations.js'

export const html = `
<section class="heros heros-simple">
  <div class="illus" id="fin-illus-heros"></div>
  <div class="accroche">
    <h1>Financer<em>votre projet</em></h1>
    <p>Capacité d'emprunt, plan de financement et dossier de prêt, calculés par le
       moteur de règles déterministe — normes du Haut Conseil de stabilité financière.</p>
  </div>
</section>

<h2 class="titre-section">Votre <em>situation</em></h2>
<p class="sous">Ajustez les curseurs : chaque montant est recalculé par le backend,
  sans aucune approximation côté navigateur.</p>

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
          <option value="independant">Indépendant</option><option value="interim">Intérim</option></select></div>
    </div>
    <div class="ligne-choix">
      <div class="choix"><label for="fin-adultes">Adultes</label>
        <select id="fin-adultes"><option value="1">1</option><option value="2" selected>2</option></select></div>
      <div class="choix"><label for="fin-enfants">Enfants</label>
        <select id="fin-enfants"><option>0</option><option selected>1</option><option>2</option><option>3</option><option>4</option></select></div>
    </div>
    <div class="bascules">
      <button type="button" class="bascule" id="fin-primo" aria-pressed="true">Primo-accédant</button>
      <button type="button" class="bascule" id="fin-neuf" aria-pressed="false">Bien neuf · VEFA</button>
    </div>
  </div>

  <div class="sombre">
    <div class="illus" id="fin-illus-dossier"></div>
    <div>
      <span class="verdict" id="fin-verdict"><i></i><span>Calcul…</span></span>
      <div class="mensualite" id="fin-mensualite">—</div>
      <div class="precision" id="fin-precision"></div>
    </div>
    <div class="mesures">
      <div class="mesure"><b id="fin-emprunt">—</b><span>Montant emprunté</span></div>
      <div class="mesure"><b id="fin-endett">—</b><span>Taux d'endettement</span></div>
      <div class="mesure"><b id="fin-score">—</b><span>Score du dossier</span></div>
    </div>
  </div>
</section>

<section class="trois">
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

<h2 class="titre-section">Points <em>forts et vigilance</em></h2>
<p class="sous">Évalués automatiquement par le moteur déterministe à partir de votre dossier.</p>
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

<h2 class="titre-section">Posez <em>vos questions</em></h2>
<p class="sous">Agent connecté au même moteur déterministe : il appelle les calculs réels, il n'invente jamais de chiffre.</p>
<section class="clair" style="display:flex;flex-direction:column;gap:14px">
  <div id="fin-fil" style="display:flex;flex-direction:column;gap:10px;min-height:120px;max-height:360px;overflow-y:auto"></div>
  <form id="fin-chat-form" style="display:flex;gap:8px">
    <input type="text" id="fin-chat-input" placeholder="Ex : puis-je emprunter sur 20 ans avec mon profil ?"
      style="flex:1;padding:12px 16px;border-radius:999px;border:1px solid var(--ligne);background:var(--fond);font:500 13.5px var(--sans);color:var(--encre);outline:none">
    <button type="submit" class="bouton-accent" style="width:auto;padding:12px 26px;white-space:nowrap">Envoyer</button>
  </form>
</section>

<h2 class="titre-section">Vos <em>pièces</em> justificatives</h2>
<section class="pieces">
  <div class="pieces-tete"><h3 id="fin-titre-pieces">Dossier</h3><span id="fin-compte" style="font-size:12.5px;color:var(--gris)"></span></div>
  <div class="progression"><i id="fin-barre-pieces" style="width:0"></i></div>
  <div class="liste" id="fin-liste"></div>
</section>

<div class="bas">
  <span>Normes HCSF · Barèmes DMTO et émoluments 2026 · Moteur de règles RealStateAI</span>
  <span>Simulation indicative : ni conseil en financement, ni offre de prêt.</span>
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

  $('#fin-illus-heros').innerHTML = heroFinancement()
  $('#fin-illus-dossier').innerHTML = interieur()

  // Préremplissage depuis l'onglet Estimation : reprend le prix du bien
  // estimé comme point de départ de la simulation.
  if (prefill?.prix) {
    const prix = $('#fin-prix')
    prix.value = Math.min(+prix.max, Math.max(+prix.min, Math.round(prefill.prix / 5000) * 5000))
  }

  const val = (i) => +$('#' + i).value

  function lire() {
    return {
      revenus: val('fin-revenus'), apport: val('fin-apport'), charges: val('fin-charges'),
      prix: val('fin-prix'), loyer: val('fin-loyer'), duree: val('fin-duree'),
      situation: $('#fin-situation').value, adultes: val('fin-adultes'), enfants: val('fin-enfants'),
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
        prix_bien: p.prix, departement: '75', type_bien: p.neuf ? 'neuf' : 'ancien',
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

  // ---- Repli local : barème HCSF simplifié, utilisé uniquement quand le
  // backend de financement est injoignable. Remplit les mêmes champs que
  // la réponse réelle de /api/financing/dossier pour que afficherDossier()
  // n'ait pas à distinguer les deux sources.
  const BAREME = {
    taux: { 15: 0.0295, 20: 0.031, 25: 0.033 },
    assurance: 0.0034,
    dmto: { plein: 0.05, reduit: 0.045, communale: 0.012, assiette: 0.0237 },
    emoluments: { tva: 0.2, tranches: [[6500, 0.0387], [17000, 0.01596], [60000, 0.01064], [Infinity, 0.00799]] },
    csi: 0.001, debours: 1200,
    credit: { dossierTaux: 0.01, dossierMin: 500, dossierMax: 1500, caution: 0.012 },
    rav: { premier: 900, supplementaire: 400, enfant: 300 },
  }
  function tauxIndicatif(duree) {
    const cles = Object.keys(BAREME.taux).map(Number)
    const proche = cles.reduce((a, b) => (Math.abs(b - duree) < Math.abs(a - duree) ? b : a))
    return BAREME.taux[proche]
  }
  function mensualiteCredit(capital, taux, annees) {
    if (capital <= 0 || annees <= 0) return 0
    const n = annees * 12
    if (taux === 0) return capital / n
    const i = taux / 12
    return (capital * i) / (1 - Math.pow(1 + i, -n))
  }
  function emoluments(prix) {
    let total = 0, plancher = 0
    for (const [plafond, taux] of BAREME.emoluments.tranches) {
      const borne = Math.min(prix, plafond)
      if (borne > plancher) { total += (borne - plancher) * taux; plancher = borne }
      if (prix <= plafond) break
    }
    return total * (1 + BAREME.emoluments.tva)
  }
  function calculLocal(p) {
    const d = BAREME.dmto
    const depPrimo = p.primo ? d.reduit : d.plein
    const tauxDmto = depPrimo + d.communale + depPrimo * d.assiette
    const droits = p.prix * tauxDmto, emo = emoluments(p.prix), csi = p.prix * BAREME.csi
    const totalAcq = droits + emo + csi + BAREME.debours

    const besoin = p.prix + totalAcq
    const emprunt = Math.max(0, besoin - p.apport)
    const taux = tauxIndicatif(p.duree)
    const dossier = Math.min(Math.max(emprunt * BAREME.credit.dossierTaux, BAREME.credit.dossierMin), BAREME.credit.dossierMax)
    const garantie = emprunt * BAREME.credit.caution
    const empruntTotal = emprunt + dossier + garantie

    const mCredit = mensualiteCredit(empruntTotal, taux, p.duree)
    const mAssurance = (empruntTotal * BAREME.assurance) / 12
    const mensualite = mCredit + mAssurance
    const n = p.duree * 12
    const interets = mCredit * n - empruntTotal
    const coutTotalCredit = interets + mAssurance * n

    const revenus = p.revenus
    const endettement = revenus > 0 ? (mensualite + p.charges) / revenus : 1
    const ravMin = BAREME.rav.premier + BAREME.rav.supplementaire * Math.max(0, p.adultes - 1) + BAREME.rav.enfant * p.enfants
    const ravDispo = revenus - mensualite - p.charges
    const conforme = endettement <= 0.35 && p.duree <= 25 && ravDispo >= ravMin

    const nEndett = endettement <= 0.2 ? 1 : endettement >= 0.35 ? 0 : (0.35 - endettement) / 0.15
    const nApport = Math.min(1, (p.apport / besoin) / 0.2)
    const nRav = ravMin <= 0 ? 1 : ravDispo <= ravMin ? Math.max(0, (ravDispo / ravMin) * 0.5) : Math.min(1, 0.5 + 0.5 * ((ravDispo - ravMin) / ravMin))
    const nStab = { CDI: 1, fonctionnaire: 1, CDD: 0.45, independant: 0.6, interim: 0.3 }[p.situation] ?? 0.5
    const score = Math.round(nEndett * 30 + nApport * 25 + nRav * 20 + nStab * 15 + 0.5 * 10)

    const PIECES_COMMUNES = ["Pièce d'identité en cours de validité", 'Justificatif de domicile de moins de 3 mois',
      '3 derniers relevés de tous les comptes bancaires', "Dernier avis d'imposition", "Justificatif de l'apport personnel et de sa provenance", 'Compromis de vente signé']
    const PAR_SITUATION = {
      CDI: ['3 derniers bulletins de salaire', 'Contrat de travail', "Attestation employeur de non-période d'essai"],
      fonctionnaire: ['3 derniers bulletins de salaire', 'Arrêté de titularisation'],
      CDD: ['12 derniers bulletins de salaire', 'Contrat en cours'],
      independant: ['3 derniers bilans', "2 derniers avis d'imposition", 'Extrait Kbis'],
      interim: ['12 derniers bulletins de salaire', "Attestation de l'agence"],
    }
    const pieces = [...PIECES_COMMUNES, ...(PAR_SITUATION[p.situation] || []),
      p.neuf ? 'Contrat de réservation VEFA et plans' : 'Diagnostics techniques du bien (DPE, amiante, plomb)',
      ...(p.charges > 0 ? ["Tableaux d'amortissement des crédits en cours"] : []),
      ...(p.primo ? ["Attestation sur l'honneur de primo-accession"] : [])]

    const pointsForts = []
    const pointsVigilance = []
    if (p.situation === 'CDI' || p.situation === 'fonctionnaire') pointsForts.push('Situation professionnelle stable.')
    if (p.apport / besoin >= 0.2) pointsForts.push("Apport personnel supérieur au niveau généralement attendu.")
    if (ravDispo >= ravMin * 1.3) pointsForts.push(`Reste à vivre de ${euro(ravDispo)}, confortablement au-dessus du minimum d'usage.`)
    if (endettement > 0.35) pointsVigilance.push(`Taux d'endettement de ${Math.round(endettement * 100)} %, au-delà du plafond HCSF de 35 %.`)
    if (p.apport === 0) pointsVigilance.push("Aucun apport personnel renseigné.")
    if (ravDispo < ravMin) pointsVigilance.push("Reste à vivre en dessous du minimum d'usage recommandé.")

    return {
      demo: true,
      conformite_hcsf: { conforme_hcsf: conforme, criteres: { taux_endettement: { valeur: endettement, plafond: 0.35 } } },
      credit: { mensualite_totale: mensualite, mensualite_credit: mCredit, mensualite_assurance: mAssurance, taux_nominal_retenu: taux, cout_total_credit: coutTotalCredit },
      plan_financement: {
        prix_bien: p.prix, frais_acquisition: totalAcq, frais_credit: dossier + garantie, apport: p.apport, montant_emprunte: empruntTotal,
        detail_frais_acquisition: { droits_mutation: droits, taux_droits_mutation: tauxDmto, emoluments_notaire_ttc: emo, contribution_securite_immobiliere: csi, debours: BAREME.debours, total_frais_acquisition: totalAcq, part_du_prix: totalAcq / p.prix, part_revenant_au_notaire: emo / totalAcq },
      },
      score_dossier: { score_sur_100: score },
      reste_a_vivre: { reste_a_vivre: ravDispo, minimum_requis: ravMin, marge: ravDispo - ravMin },
      pieces_justificatives: { situation: p.situation, pieces },
      synthese: { points_forts: pointsForts, points_de_vigilance: pointsVigilance },
    }
  }

  let seq = 0, timer = null
  function planifier() {
    majCurseurs()
    if (timer) clearTimeout(timer)
    timer = setTimeout(calculer, 220)
  }

  async function calculer() {
    const p = lire()
    const mySeq = ++seq
    let d, demo = false
    try {
      d = await appelDossier(p)
    } catch {
      d = calculLocal(p); demo = true
    }
    if (mySeq !== seq) return
    afficherDossier(d, p, demo)
  }

  function afficherDossier(d, p, demo) {
    const conf = d.conformite_hcsf || {}
    const endettement = conf.criteres?.taux_endettement?.valeur ?? 0
    const conforme = !!conf.conforme_hcsf
    const v = $('#fin-verdict')
    v.className = 'verdict' + (conforme ? '' : endettement <= 0.4 ? ' alerte' : ' refus')
    v.querySelector('span').textContent = (conforme
      ? 'Conforme aux normes HCSF'
      : endettement <= 0.4 ? 'Hors normes — dérogation nécessaire' : 'Non finançable en l\'état')
      + (demo ? ' · démonstration' : '')

    const credit = d.credit || {}
    $('#fin-mensualite').innerHTML = nb(credit.mensualite_totale || 0) + '<small>€ / mois</small>'
    $('#fin-precision').textContent =
      `sur ${p.duree} ans · taux indicatif ${pct(credit.taux_nominal_retenu || 0, 2)} · assurance ${nb(credit.mensualite_assurance || 0)} €/mois`
      + (demo ? ' · backend de financement injoignable, calcul approché côté navigateur' : '')

    const plan = d.plan_financement || {}
    $('#fin-emprunt').textContent = nb((plan.montant_emprunte || 0) / 1000) + 'k €'
    $('#fin-endett').textContent = pct(endettement)
    $('#fin-score').textContent = Math.round(d.score_dossier?.score_sur_100 || 0) + '/100'

    $('#fin-jauge').innerHTML = jauge(endettement)
    const rav = d.reste_a_vivre || {}
    $('#fin-encart-endett').innerHTML = conforme
      ? `Marge disponible : <b>${euro(Math.max(0, rav.marge || 0))}</b> de reste à vivre au-delà du minimum d'usage.`
      : `Au-delà de 35 %, le dossier ne passe que par la <b>marge de dérogation</b> : 20 % des dossiers d'une banque par trimestre.`

    const acq = plan.detail_frais_acquisition || {}
    $('#fin-plan').innerHTML = `
      <tr><td>Prix du bien</td><td class="n">${euro(plan.prix_bien || p.prix)}</td></tr>
      <tr><td>Frais d'acquisition</td><td class="n">${euro(plan.frais_acquisition || 0)}</td></tr>
      <tr><td>Frais de dossier et garantie</td><td class="n">${euro(plan.frais_credit || 0)}</td></tr>
      <tr><td>Apport</td><td class="n">− ${euro(plan.apport ?? p.apport)}</td></tr>
      <tr class="total"><td>À emprunter</td><td class="n">${euro(plan.montant_emprunte || 0)}</td></tr>
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

  calculer()

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
    fetch(apiBase + '/api/financing/agent/' + sessionId, { method: 'DELETE' }).catch(() => {})
  }
}
