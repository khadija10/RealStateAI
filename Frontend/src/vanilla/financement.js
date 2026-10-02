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

<h2 class="titre-section">Vos <em>leviers</em></h2>
<p class="sous">Chaque levier est recalculé par le moteur déterministe : c'est un
  chiffre, pas un conseil générique.</p>
<section class="leviers" id="fin-leviers"></section>

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

export function mount(root, { apiBase = '' } = {}) {
  const $ = (sel) => root.querySelector(sel)
  const $$ = (sel) => root.querySelectorAll(sel)
  const DOSSIER_URL = apiBase + '/api/financing/dossier'

  $('#fin-illus-heros').innerHTML = heroFinancement()
  $('#fin-illus-dossier').innerHTML = interieur()

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

  let seq = 0, timer = null
  function planifier() {
    majCurseurs()
    if (timer) clearTimeout(timer)
    timer = setTimeout(calculer, 220)
  }

  async function calculer() {
    const p = lire()
    const mySeq = ++seq
    try {
      const d = await appelDossier(p)
      if (mySeq !== seq) return
      afficherDossier(d, p)
    } catch {
      if (mySeq !== seq) return
      $('#fin-verdict').innerHTML = `<i></i><span>Backend de financement indisponible</span>`
      $('#fin-mensualite').textContent = '—'
    }
  }

  function afficherDossier(d, p) {
    const conf = d.conformite_hcsf || {}
    const endettement = conf.criteres?.taux_endettement?.valeur ?? 0
    const conforme = !!conf.conforme_hcsf
    const v = $('#fin-verdict')
    v.className = 'verdict' + (conforme ? '' : endettement <= 0.4 ? ' alerte' : ' refus')
    v.querySelector('span').textContent = conforme
      ? 'Conforme aux normes HCSF'
      : endettement <= 0.4 ? 'Hors normes — dérogation nécessaire' : 'Non finançable en l\'état'

    const credit = d.credit || {}
    $('#fin-mensualite').innerHTML = nb(credit.mensualite_totale || 0) + '<small>€ / mois</small>'
    $('#fin-precision').textContent =
      `sur ${p.duree} ans · taux indicatif ${pct(credit.taux_nominal_retenu || 0, 2)} · assurance ${nb(credit.mensualite_assurance || 0)} €/mois`

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

    const leviers = (d.synthese?.leviers || [])
    $('#fin-leviers').innerHTML = leviers.length
      ? leviers.map((l, i) => `
        <div class="levier"><div class="num">${i + 1}</div><h4>${l.description || l.levier}</h4>
          <div class="gain ${(l.gain_capacite_emprunt || 0) > 0 ? 'pos' : ''}">${(l.gain_capacite_emprunt || 0) > 0 ? '+' : ''}${nb((l.gain_capacite_emprunt || 0) / 1000)}k €</div>
          <p>de capacité d'emprunt${l.surcout_total_credit ? ` · ${euro(l.surcout_total_credit)} de surcoût total` : ''}</p>
          <p>${l.contrepartie || ''}</p></div>`).join('')
      : `<div class="levier"><h4>Aucun levier <em>nécessaire</em></h4><p>Votre dossier est déjà optimisé.</p></div>`

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

  return () => { if (timer) clearTimeout(timer) }
}
