// Page "Estimation" — reprise quasi verbatim de l'artefact Claude Design
// (https://claude.ai/artifact/A9YV2PZHfG1rWQh1GTccSo), rebranchée sur le
// vrai backend FastAPI (estimation ML, communes, santé de l'API).
import { heroEstimation, heroTour, heroVilla, heroInterieur, heroBois } from './illustrations-vanilla.js'

export const html = `
<div class="fond-page" id="rsai-fond-page" aria-hidden="true"></div>
<section class="heros" id="haut">
  <div class="illus" id="illus-heros"></div>
  <div class="etat-api" id="etat-api"><i></i><span>Vérification…</span></div>
  <div class="accroche">
    <h1>La vraie valeur<em>de votre bien</em></h1>
    <p>Estimée par un modèle entraîné sur chaque vente notariée d'Île-de-France,
       à la maille de l'arrondissement.</p>
  </div>
  <form class="recherche" id="formulaire">
    <div class="rangee">
      <div class="critere">
        <div class="pic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.4"/></svg></div>
        <div style="min-width:0;flex:1"><label for="rsai-adresse">Adresse du bien</label>
          <input id="rsai-adresse" type="text" placeholder="12 rue de la Paix, 75002 Paris" autocomplete="off"></div>
      </div>
      <div class="critere">
        <div class="pic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 21V9l8-6 8 6v12"/><path d="M9 21v-6h6v6"/></svg></div>
        <div style="min-width:0;flex:1"><label for="rsai-secteur">ou secteur</label><select id="rsai-secteur"></select></div>
      </div>
      <div class="critere">
        <div class="pic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/></svg></div>
        <div style="flex:1"><label for="rsai-type">Type de bien</label>
          <select id="rsai-type"><option value="apartment">Appartement</option><option value="house">Maison</option></select></div>
      </div>
      <div class="critere">
        <div class="pic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 21h18M6 21V8l6-4 6 4v13"/></svg></div>
        <div style="flex:1"><label for="rsai-surface">Surface · pièces</label>
          <div style="display:flex;gap:4px;align-items:baseline">
            <input id="rsai-surface" type="number" value="58" min="9" max="400" style="width:42px"><span style="font-size:12px;color:var(--gris)">m²</span>
            <input id="rsai-pieces" type="number" value="3" min="1" max="12" style="width:26px;margin-left:8px"><span style="font-size:12px;color:var(--gris)">p.</span>
          </div></div>
      </div>
      <button type="submit" class="estimer" id="rsai-bouton">Estimer</button>
    </div>
  </form>
</section>

<section class="manifeste">
  <div class="etiq">Notre approche</div>
  <div>
    <h2>Un modèle entraîné sur <em>toutes</em> les ventes notariées d'Île-de-France,
      et dont nous publions <em>l'erreur réelle</em>, quartier par quartier.</h2>
    <div class="stats">
      <div class="stat"><b>721 675</b><span>Transactions analysées</span></div>
      <div class="stat"><b>28</b><span>Variables du modèle</span></div>
      <div class="stat"><b>0,82</b><span>Coefficient de détermination</span></div>
      <div class="stat"><b>3,5 M</b><span>Diagnostics énergie</span></div>
    </div>
  </div>
</section>

<h2 class="titre-section" id="rsai-resultat">Votre <em>estimation</em></h2>
<section>
  <div class="clair clair-grid">
    <div class="bloc bloc-resume">
      <div class="lib" id="rsai-lib-secteur">Estimation</div>
      <div class="valeur" id="rsai-valeur">—</div>
      <div class="fourchette" id="rsai-fourchette"></div>
      <div class="jauge-ci"><i id="rsai-curseur-ci" style="left:50%"></i></div>
      <div class="bornes-ci"><span id="rsai-ci-bas"></span><span id="rsai-ci-haut"></span></div>
      <div class="mesures">
        <div class="mesure"><b id="rsai-m2">—</b><span>€ par m²</span></div>
        <div class="mesure"><b id="rsai-med">—</b><span>Médiane du secteur</span></div>
        <div class="mesure"><b id="rsai-ecart">—</b><span>Écart au marché</span></div>
      </div>
    </div>
    <div class="bloc">
      <div class="bloc-tete"><h3>Fiabilité <em>de l'estimation</em></h3><span id="rsai-src-modele"></span></div>
      <div class="fiab">
        <div id="rsai-anneau"></div>
        <div class="fiab-txt" id="rsai-fiab-txt"></div>
      </div>
    </div>
    <div class="bloc">
      <div class="bloc-tete"><h3>Position <em>dans le secteur</em></h3><span id="rsai-volume"></span></div>
      <div class="reglette"><i id="rsai-curseur" style="left:50%"></i></div>
      <div class="bornes"><span id="rsai-bas"></span><span id="rsai-haut-d"></span></div>
    </div>
    <div class="bloc">
      <div class="bloc-tete"><h3>Évolution <em>depuis 2021</em></h3><span id="rsai-tendance"></span></div>
      <div id="rsai-courbe"></div>
    </div>
    <div class="bloc">
      <div class="bloc-tete"><h3>Détail <em>du calcul</em></h3></div>
      <div class="detail-grille">
        <table><tbody id="rsai-detail"></tbody></table>
        <table><tbody id="rsai-detail-tech"></tbody></table>
      </div>
    </div>
    <div class="bloc">
      <div class="bloc-tete"><h3>Plus-value <em>projetée</em></h3><span>scénario central · 10 ans</span></div>
      <p class="fiab-txt" id="rsai-pv-resume"></p>
      <div class="boutons-action">
        <button type="button" class="bouton-accent" id="rsai-pv-voir">Simuler la plus-value →</button>
        <button type="button" class="bouton-accent" id="rsai-fin-voir">Simuler le financement →</button>
        <button type="button" class="bouton-neutre" id="rsai-pdf">Exporter PDF</button>
        <button type="button" class="bouton-neutre" id="rsai-partager">Partager</button>
      </div>
    </div>
  </div>
</section>

<h2 class="titre-section" id="rsai-marche">Le marché <em>par secteur</em></h2>
<section class="marche" id="rsai-grille-marche"></section>
<button class="charger" id="rsai-charger">Voir plus de secteurs</button>

<div class="bas">
  <span>Données : DVF — DGFiP / Etalab · DPE — ADEME · Modèle LightGBM, 28 variables</span>
  <span>Estimation indicative, ne constitue pas une expertise immobilière.</span>
</div>
`

const SECTEURS = {
  "75106": { nom: "Paris 6ᵉ", med: 14783, p10: 10761, p90: 21034, n: 3635, eco: [15101, 15000, 15000, 14501, 14146] },
  "75107": { nom: "Paris 7ᵉ", med: 14486, p10: 10584, p90: 21163, n: 4273, eco: [14722, 15000, 14529, 13803, 14045] },
  "75104": { nom: "Paris 4ᵉ", med: 13000, p10: 9416, p90: 17620, n: 2459, eco: [13086, 13143, 13152, 12603, 12842] },
  "75101": { nom: "Paris 1ᵉʳ", med: 12857, p10: 9165, p90: 18290, n: 1418, eco: [13346, 13043, 12967, 12500, 12111] },
  "75108": { nom: "Paris 8ᵉ", med: 12587, p10: 9261, p90: 18249, n: 3025, eco: [12886, 12923, 12756, 12222, 12060] },
  "75105": { nom: "Paris 5ᵉ", med: 12327, p10: 9063, p90: 15973, n: 4159, eco: [12832, 12857, 12419, 11782, 11800] },
  "75103": { nom: "Paris 3ᵉ", med: 12269, p10: 8929, p90: 16326, n: 3221, eco: [12653, 12533, 12269, 11719, 12000] },
  "75102": { nom: "Paris 2ᵉ", med: 11711, p10: 8326, p90: 15353, n: 2056, eco: [12034, 12000, 11660, 11250, 11179] },
  "75116": { nom: "Paris 16ᵉ", med: 11419, p10: 8421, p90: 15620, n: 11957, eco: [11728, 11881, 11453, 10845, 11000] },
  "75109": { nom: "Paris 9ᵉ", med: 11333, p10: 8260, p90: 14531, n: 5556, eco: [11827, 11782, 11364, 10585, 10882] },
  "75117": { nom: "Paris 17ᵉ", med: 10789, p10: 7877, p90: 13725, n: 12602, eco: [11350, 11333, 10762, 10056, 10147] },
  "75111": { nom: "Paris 11ᵉ", med: 10471, p10: 7847, p90: 12917, n: 12100, eco: [11063, 10889, 10308, 9817, 10000] },
  "75115": { nom: "Paris 15ᵉ", med: 10102, p10: 7692, p90: 12754, n: 15469, eco: [10752, 10556, 10000, 9461, 9506] },
  "75110": { nom: "Paris 10ᵉ", med: 10000, p10: 7308, p90: 12833, n: 7562, eco: [10677, 10525, 10000, 9240, 9352] },
  "75114": { nom: "Paris 14ᵉ", med: 10000, p10: 7505, p90: 12920, n: 7590, eco: [10706, 10483, 10000, 9305, 9488] },
  "75112": { nom: "Paris 12ᵉ", med: 9651, p10: 7391, p90: 12037, n: 8199, eco: [10320, 10119, 9513, 8881, 9058] },
  "75118": { nom: "Paris 18ᵉ", med: 9495, p10: 6667, p90: 12700, n: 15148, eco: [10244, 10000, 9322, 8661, 8881] },
  "75113": { nom: "Paris 13ᵉ", med: 9204, p10: 6667, p90: 11750, n: 7260, eco: [9827, 9725, 9091, 8667, 8686] },
  "75120": { nom: "Paris 20ᵉ", med: 8901, p10: 6667, p90: 11177, n: 9835, eco: [9646, 9375, 8829, 8241, 8379] },
  "75119": { nom: "Paris 19ᵉ", med: 8667, p10: 6202, p90: 11099, n: 7933, eco: [9370, 9138, 8696, 7857, 8115] },
  "92000": { nom: "Hauts-de-Seine", med: 6846, p10: 4478, p90: 10075, n: 90255, eco: [7150, 7290, 7020, 6640, 6720] },
  "94000": { nom: "Val-de-Marne", med: 5000, p10: 3014, p90: 8298, n: 59968, eco: [5240, 5310, 5090, 4830, 4900] },
  "93000": { nom: "Seine-Saint-Denis", med: 4231, p10: 2410, p90: 7143, n: 53450, eco: [4430, 4490, 4290, 4070, 4130] },
  "78000": { nom: "Yvelines", med: 4116, p10: 2449, p90: 6863, n: 48612, eco: [4260, 4330, 4180, 3990, 4050] },
  "77000": { nom: "Seine-et-Marne", med: 3547, p10: 2084, p90: 4958, n: 39959, eco: [3640, 3720, 3600, 3450, 3500] },
  "95000": { nom: "Val-d'Oise", med: 3426, p10: 2202, p90: 4972, n: 36523, eco: [3540, 3610, 3480, 3330, 3380] },
  "91000": { nom: "Essonne", med: 3116, p10: 1986, p90: 4692, n: 38465, eco: [3220, 3280, 3170, 3030, 3080] },
}
const ANNEES = [2021, 2022, 2023, 2024, 2025]
const MAPE_MODELE = 0.164
const euro = (n) => Math.round(n).toLocaleString('fr-FR') + ' €'
const nb = (n) => Math.round(n).toLocaleString('fr-FR')

const TYPE_LABEL = { apartment: 'Appartement', house: 'Maison', other: 'Autre' }

/** Fiche imprimable — même principe que l'ancien frontend (fenêtre + print()). */
function exporterPDF(bien) {
  if (!bien) return
  const { r, s, adresse, surface, pieces } = bien
  const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())
  const lieu = adresse || s.nom
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Estimation RealStateAI</title>
<style>
  body{font-family:Georgia,serif;max-width:680px;margin:40px auto;color:#141311;padding:0 20px}
  h1{font-size:2rem;margin-bottom:4px}
  .sub{color:#77716A;font-size:.9rem;margin-bottom:32px}
  .price{font-size:3rem;font-weight:600;margin:16px 0 4px}
  .per-m2{color:#77716A;font-size:.95rem;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;margin-top:24px}
  td{padding:10px 0;border-bottom:1px solid #E3DED6;font-size:.9rem}
  td:last-child{text-align:right;font-weight:500}
  .range{display:flex;gap:24px;margin:16px 0}
  .range-item{flex:1;background:#F3F1EC;padding:12px 16px;border-radius:8px}
  .range-label{font-size:.75rem;color:#77716A;text-transform:uppercase;letter-spacing:.08em}
  .range-val{font-size:1.1rem;font-weight:600;margin-top:4px}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #E3DED6;font-size:.75rem;color:#A38C77}
</style></head><body>
<h1>Fiche d'estimation</h1>
<p class="sub">RealStateAI · ${date}</p>
<table>
  <tr><td>Bien</td><td>${lieu}</td></tr>
  <tr><td>Surface</td><td>${surface} m²</td></tr>
  <tr><td>Pièces</td><td>${pieces}</td></tr>
  <tr><td>Méthode</td><td>${r.reel ? 'Modèle ' + (r.modele || 'ml') : 'Démonstration (médianes DVF)'}</td></tr>
</table>
<p class="price">${euro(r.valeur)}</p>
<p class="per-m2">soit ${euro(r.prix_m2)} / m²</p>
<div class="range">
  <div class="range-item"><p class="range-label">Fourchette basse</p><p class="range-val">${euro(r.basse)}</p></div>
  <div class="range-item"><p class="range-label">Fourchette haute</p><p class="range-val">${euro(r.haute)}</p></div>
</div>
<p class="footer">Estimation fournie à titre indicatif, sans valeur contractuelle. Modèle entraîné sur les ventes notariées DVF d'Île-de-France 2021–2025.${r.mape != null ? ` Erreur locale mesurée sur ce secteur : ${String(r.mape).replace('.', ',')} %.` : ''}</p>
</body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 400)
}

/** Lien partageable — reconstitue le formulaire via les paramètres d'URL. */
function construireLienPartage(bien) {
  const p = new URLSearchParams()
  if (bien.surface) p.set('area_m2', bien.surface)
  if (bien.pieces) p.set('rooms', bien.pieces)
  if (bien.type) p.set('type', bien.type)
  if (bien.adresse) p.set('address', bien.adresse)
  if (bien.secteur) p.set('secteur', bien.secteur)
  return `${window.location.origin}${window.location.pathname}?${p.toString()}`
}

export function mount(root, { apiBase = '', onPlusValue, onFinancement } = {}) {
  const API = {
    BASE: apiBase,
    COMMUNES: '/api/metadata/communes',
    ESTIMER: '/api/predictions/estimate',
    SANTE: '/api/health',
  }
  const $ = (sel) => root.querySelector(sel)
  const $$ = (sel) => root.querySelectorAll(sel)

  let secteurCourant = '75111'
  let dernierBien = null
  let modelInfo = null
  $('#illus-heros').innerHTML = heroEstimation()
  $('#rsai-fond-page').innerHTML = heroEstimation()

  const selecteur = $('#rsai-secteur')
  for (const [code, s] of Object.entries(SECTEURS)) {
    const o = document.createElement('option')
    o.value = code; o.textContent = s.nom
    if (code === secteurCourant) o.selected = true
    selecteur.appendChild(o)
  }

  async function verifierApi() {
    const badge = $('#etat-api')
    try {
      const r = await fetch(API.BASE + API.SANTE, { signal: AbortSignal.timeout(5000) })
      const d = await r.json()
      if (d.model_loaded || d.dvf_loaded) {
        badge.className = 'etat-api direct'
        const mape = d.model_mape != null ? ` · MAPE ${String(d.model_mape).replace('.', ',')} %` : ''
        badge.innerHTML = `<i></i><span>Modèle connecté${mape}</span>`
        chargerCommunes()
      } else {
        badge.innerHTML = `<i></i><span>Backend en mode démonstration</span>`
      }
      modelInfo = {
        mape: d.model_mape, r2: d.model_r2, nFeatures: d.model_n_features,
        trainedAt: d.model_trained_at, nTrain: d.model_n_train, nTest: d.model_n_test,
      }
      if (dernierBien) afficher(dernierBien.r, dernierBien.s, dernierBien.adresse, dernierBien.surface, dernierBien.pieces, dernierBien.type)
    } catch {
      badge.innerHTML = `<i></i><span>Backend injoignable — démonstration</span>`
    }
  }

  async function chargerCommunes() {
    try {
      const r = await fetch(API.BASE + API.COMMUNES)
      const d = await r.json()
      const communes = Array.isArray(d) ? d.filter(Boolean) : Array.isArray(d?.communes) ? d.communes.filter(Boolean) : []
      if (!communes.length) return
      selecteur.innerHTML = communes.map((c) => `<option value="${c}">${c}</option>`).join('')
    } catch { /* on conserve la liste de démonstration */ }
  }

  async function estimer(defiler) {
    const surface = Math.max(9, +$('#rsai-surface').value || 50)
    const pieces = +$('#rsai-pieces').value || 1
    const type = $('#rsai-type').value
    const adresse = $('#rsai-adresse').value.trim()
    const secteur = SECTEURS[selecteur.value] || SECTEURS[secteurCourant]
    if (SECTEURS[selecteur.value]) secteurCourant = selecteur.value

    const bouton = $('#rsai-bouton')
    bouton.disabled = true; bouton.textContent = 'Calcul…'

    let r = null
    try {
      const rep = await fetch(API.BASE + API.ESTIMER, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area_m2: surface, rooms: pieces, property_type: type,
          commune: selecteur.options[selecteur.selectedIndex]?.textContent || undefined,
          address: adresse || undefined,
        }),
      })
      if (rep.ok) r = normaliser(await rep.json())
    } catch { /* repli silencieux */ }
    if (!r) r = demonstration(secteur, surface, pieces, type)

    bouton.disabled = false; bouton.textContent = 'Estimer'
    afficher(r, secteur, adresse, surface, pieces, type)
    memoriser({ query: adresse || secteur.nom, area_m2: surface, prix: r.valeur })
    if (defiler) $('#rsai-resultat').scrollIntoView({ behavior: 'smooth' })
  }

  function normaliser(d) {
    const ci = d.confidence_interval || {}
    return {
      valeur: d.predicted_price ?? d.estimated_price,
      prix_m2: d.price_per_m2,
      basse: ci.lower ?? d.price_range?.low,
      haute: ci.upper ?? d.price_range?.high,
      confiance: ci.confidence ?? '85%',
      fiabilite: d.reliability,
      mape: d.local_mape, mape_n: d.local_mape_n,
      modele: d.model, adresse: d.meta?.adresse_normalisee,
      meta: d.meta, reel: true,
    }
  }

  function demonstration(s, surface, pieces, type) {
    const base = s.eco[4], f = []
    const fs = surface < 30 ? 1.12 : surface < 45 ? 1.05 : surface < 80 ? 1 : surface < 120 ? 0.96 : 0.92
    f.push(['Surface de ' + surface + ' m²', fs])
    const ft = type === 'house' ? 0.97 : 1
    if (ft !== 1) f.push(['Maison individuelle', ft])
    const dens = surface / pieces, fa = dens < 16 ? 0.97 : dens > 32 ? 1.02 : 1
    if (fa !== 1) f.push(['Agencement des pièces', fa])
    const m2 = base * fs * ft * fa, v = m2 * surface
    return { valeur: v, prix_m2: m2, basse: v * (1 - MAPE_MODELE), haute: v * (1 + MAPE_MODELE), confiance: '85%', fiabilite: null, facteurs: f, base, modele: 'demo', reel: false }
  }

  function afficher(r, s, adresse, surface, pieces, type) {
    $('#rsai-lib-secteur').textContent = (r.adresse || adresse || s.nom) + ' · ' + surface + ' m² · ' + pieces + (pieces > 1 ? ' pièces' : ' pièce')
    $('#rsai-valeur').textContent = euro(r.valeur)
    $('#rsai-fourchette').textContent = `Fourchette ${r.confiance || '85 %'} : ${euro(r.basse)} — ${euro(r.haute)}`
    const place = Math.min(96, Math.max(4, (100 * (r.valeur - r.basse)) / (r.haute - r.basse)))
    $('#rsai-curseur-ci').style.left = place + '%'
    $('#rsai-ci-bas').textContent = euro(r.basse)
    $('#rsai-ci-haut').textContent = euro(r.haute)

    $('#rsai-m2').textContent = nb(r.prix_m2)
    $('#rsai-med').textContent = nb(s.med)
    const e = Math.round(100 * (r.prix_m2 / s.med - 1))
    $('#rsai-ecart').textContent = (e > 0 ? '+' : '') + e + ' %'

    const fiab = r.fiabilite ?? (r.reel ? null : 1 - MAPE_MODELE)
    $('#rsai-anneau').innerHTML = anneau(fiab)
    $('#rsai-src-modele').innerHTML = `<span class="puce ${r.reel ? '' : 'claire'}">${r.reel ? 'Modèle ' + (r.modele || 'ml') : 'Démonstration'}</span>`
    $('#rsai-fiab-txt').innerHTML =
      (r.mape != null
        ? `Sur ce secteur, le modèle se trompe en moyenne de <b>${String(r.mape).replace('.', ',')} %</b>${r.mape_n ? `, mesuré sur <b>${nb(r.mape_n)}</b> ventes de contrôle` : ''}.`
        : `Erreur moyenne du modèle sur l'ensemble du jeu de test : <b>16,4 %</b>. 46 % des estimations tombent à moins de 10 % du prix réel, 74 % à moins de 20 %.`) +
      (r.meta?.n_transactions ? `<br>Secteur documenté par <b>${nb(r.meta.n_transactions)}</b> transactions.` : '') +
      (r.reel ? '' : `<br><span style="color:var(--ambre)">Backend non connecté : estimation calculée à partir des médianes du pipeline.</span>`)

    $('#rsai-volume').innerHTML = `<span class="puce claire">${nb(s.n)} ventes</span>`
    const pos = Math.min(100, Math.max(0, (100 * (r.prix_m2 - s.p10)) / (s.p90 - s.p10)))
    $('#rsai-curseur').style.left = pos + '%'
    $('#rsai-bas').textContent = '1ᵉʳ décile · ' + nb(s.p10) + ' €/m²'
    $('#rsai-haut-d').textContent = '9ᵉ décile · ' + nb(s.p90) + ' €/m²'

    const v = 100 * (s.eco[4] / s.eco[0] - 1)
    $('#rsai-tendance').innerHTML = `<span class="puce">${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')} %</span>`
    $('#rsai-courbe').innerHTML = courbe(s.eco)

    $('#rsai-detail').innerHTML = r.reel
      ? `<tr><td>Prix au m² estimé</td><td class="n">${nb(r.prix_m2)} €</td></tr>
         <tr><td>Médiane du secteur, 2025</td><td class="n">${nb(s.med)} €/m²</td></tr>
         <tr><td>Surface retenue</td><td class="n">${surface} m²</td></tr>
         <tr><td>Modèle</td><td class="n">LightGBM · 28 variables</td></tr>
         <tr><td><em style="font-size:17px">Valeur estimée</em></td><td class="n"><b>${euro(r.valeur)}</b></td></tr>`
      : `<tr><td>Médiane du secteur, 2025</td><td class="n">${nb(r.base)} €/m²</td></tr>` +
        (r.facteurs || []).map(([l, f]) => `<tr><td>${l}</td><td class="n">${f >= 1 ? '+' : ''}${Math.round((f - 1) * 100)} %</td></tr>`).join('') +
        `<tr><td><em style="font-size:17px">Prix au m² retenu</em></td><td class="n"><b>${nb(r.prix_m2)} €</b></td></tr>`

    // Détails techniques — repris de l'ancien frontend (ResultPanel.jsx).
    // Repli : quand le backend est totalement injoignable (modelInfo jamais
    // reçu), on affiche les chiffres publiés ailleurs sur la page (section
    // "Notre approche") plutôt qu'une colonne quasi vide.
    const repli = { mape: 16.4, r2: 0.82, nFeatures: 28, nTrain: 721675 }
    const mi = modelInfo || {}

    const tech = []
    tech.push(['Méthode', r.reel ? `${r.modele === 'ml' ? 'LightGBM géolocalisé · API BAN' : 'Médiane DVF communale'}` : 'Démonstration (médianes du pipeline)'])
    if (r.adresse) tech.push(['Adresse normalisée (BAN)', r.adresse])
    if (r.mape != null) tech.push([`Erreur médiane locale${r.mape_n ? ` (${nb(r.mape_n)} ventes)` : ''}`, `${String(r.mape).replace('.', ',')} %`])
    else tech.push(['Erreur médiane (modèle global)', `${String(mi.mape ?? repli.mape).replace('.', ',')} %`])
    tech.push(['Fourchette', r.reel ? `Intervalle de confiance ${r.confiance || '85 %'}` : 'Estimation ± 16,4 % (médianes du pipeline)'])
    tech.push(['R² (validation interne)', (mi.r2 ?? repli.r2).toFixed(4)])
    tech.push(['Variables', String(mi.nFeatures ?? repli.nFeatures)])
    if (mi.trainedAt) tech.push(['Entraîné le', new Date(mi.trainedAt).toLocaleDateString('fr-FR')])
    tech.push(["Données d'entraînement", `${nb(mi.nTrain ?? repli.nTrain)} transactions DVF 2021–2025`])
    if (mi.nTest != null) tech.push(['Données de test', `${nb(mi.nTest)} transactions DVF 2025`])
    if (!r.reel && r.meta?.n_transactions) tech.push(['Transactions comparables', `${nb(r.meta.n_transactions)} ventes`])
    $('#rsai-detail-tech').innerHTML = tech.map(([l, v]) => `<tr><td>${l}</td><td class="n">${v}</td></tr>`).join('')

    // Projection de plus-value à 10 ans, scénario central (tendance 2021-2025
    // du secteur), pour amorcer le lien vers le simulateur dédié.
    const tendance = Math.pow(s.eco[4] / s.eco[0], 1 / 4) - 1
    const revente10 = r.valeur * Math.pow(1 + tendance, 10)
    const pv10 = revente10 - r.valeur
    $('#rsai-pv-resume').innerHTML =
      `Au rythme observé sur ce secteur depuis 2021 (<b>${v >= 0 ? '+' : ''}${(100 * tendance).toFixed(1).replace('.', ',')} %/an</b>), ` +
      `ce bien pourrait valoir <b>${euro(revente10)}</b> dans 10 ans, soit ${pv10 >= 0 ? 'une plus-value brute de' : 'une moins-value de'} <b>${euro(Math.abs(pv10))}</b> avant fiscalité.`
    dernierBien = { secteur: secteurCourant, prix: Math.round(r.valeur), r, s, adresse, surface, pieces, type }
  }

  function anneau(f) {
    if (f == null) f = 1 - MAPE_MODELE
    const R = 44, C = 2 * Math.PI * R, part = C * Math.min(1, Math.max(0, f))
    const couleur = f >= 0.8 ? 'var(--vert)' : f >= 0.6 ? 'var(--ambre)' : 'var(--rouge)'
    return `<svg viewBox="0 0 110 110" style="width:110px;display:block" role="img" aria-label="Fiabilité de l'estimation">
      <circle cx="55" cy="55" r="${R}" fill="none" stroke="var(--fond)" stroke-width="11"/>
      <circle cx="55" cy="55" r="${R}" fill="none" stroke="${couleur}" stroke-width="11" stroke-linecap="round"
        stroke-dasharray="${part} ${C - part}" transform="rotate(-90 55 55)"/>
      <text x="55" y="58" text-anchor="middle" font-size="26" font-style="italic" font-family="Instrument Serif,serif" fill="var(--encre)">${Math.round(f * 100)}</text>
      <text x="55" y="73" text-anchor="middle" font-size="9" font-family="Inter,sans-serif" fill="var(--gris)">FIABILITÉ</text></svg>`
  }

  function courbe(val) {
    const L = 560, H = 160, mx = 16, my = 30
    const min = Math.min(...val) * 0.985, max = Math.max(...val) * 1.02
    const x = (i) => mx + (i * (L - 2 * mx)) / (val.length - 1)
    const y = (v) => my + (H - 2 * my - 16) * (1 - (v - min) / (max - min))
    const ligne = val.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ')
    const gid = 'rsai-grad-' + Math.random().toString(36).slice(2, 8)
    return `<svg viewBox="0 0 ${L} ${H}" style="width:100%;height:auto;overflow:visible" role="img" aria-label="Évolution du prix au m²">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--taupe)" stop-opacity=".45"/><stop offset="1" stop-color="var(--taupe)" stop-opacity="0"/></linearGradient></defs>
      <path d="${ligne} L${x(val.length - 1)} ${H - 18} L${x(0)} ${H - 18} Z" fill="url(#${gid})"/>
      <path d="${ligne}" fill="none" stroke="var(--encre)" stroke-width="2" stroke-linejoin="round"/>
      ${val.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4.5" fill="var(--blanc)" stroke="var(--encre)" stroke-width="2"/>
        <text x="${x(i)}" y="${y(v) - 13}" text-anchor="middle" font-size="17" font-style="italic" font-family="Instrument Serif,serif" fill="var(--encre)">${(v / 1000).toFixed(1).replace('.', ',')}k</text>
        <text x="${x(i)}" y="${H - 2}" text-anchor="middle" font-size="10.5" font-family="Inter,sans-serif" fill="var(--gris)">${ANNEES[i]}</text>`).join('')}</svg>`
  }

  // Historique local (clé lue par l'onglet "Historique" de l'application,
  // voir components/History.jsx) — plus affiché directement sur cette page.
  const CLE = 'rsai_historique'
  function lireHisto() { try { return JSON.parse(localStorage.getItem(CLE) || '[]') } catch { return [] } }
  function memoriser(x) {
    try {
      const h = [{ ...x, created_at: new Date().toISOString() }, ...lireHisto()].slice(0, 6)
      localStorage.setItem(CLE, JSON.stringify(h))
    } catch { /* navigation privée */ }
  }

  const ordre = Object.entries(SECTEURS).sort((a, b) => b[1].med - a[1].med)
  const vignettes = [heroTour, heroVilla, heroBois, heroInterieur]
  let affiches = 0
  function chargerSecteurs() {
    const grille = $('#rsai-grille-marche')
    ordre.slice(affiches, affiches + 8).forEach(([code, s], i) => {
      const v = 100 * (s.eco[4] / s.eco[0] - 1)
      const b = document.createElement('button'); b.className = 'bien'; b.type = 'button'
      b.innerHTML = `<div class="carte-img"><div class="illus">${vignettes[(affiches + i) % 4]()}</div></div>
        <div class="prix">${nb(s.med)} €/m² · médiane</div><h4>${s.nom}</h4>
        <div class="puces"><span class="puce">${nb(s.n)} ventes</span>
          <span class="puce">${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')} % depuis 2021</span></div>`
      b.addEventListener('click', () => {
        if ([...selecteur.options].some((o) => o.value === code)) selecteur.value = code
        secteurCourant = code; $('#rsai-adresse').value = ''; estimer(true)
      })
      grille.appendChild(b)
    })
    affiches += 8
    if (affiches >= ordre.length) $('#rsai-charger').style.display = 'none'
  }

  $('#rsai-charger').addEventListener('click', chargerSecteurs)
  $('#rsai-pv-voir').addEventListener('click', () => {
    if (dernierBien && onPlusValue) onPlusValue(dernierBien)
  })
  $('#rsai-fin-voir').addEventListener('click', () => {
    if (dernierBien && onFinancement) onFinancement(dernierBien)
  })
  $('#rsai-pdf').addEventListener('click', () => exporterPDF(dernierBien))
  $('#rsai-partager').addEventListener('click', () => {
    if (!dernierBien) return
    const bouton = $('#rsai-partager')
    navigator.clipboard?.writeText(construireLienPartage(dernierBien)).then(() => {
      const texte = bouton.textContent
      bouton.textContent = 'Lien copié !'
      setTimeout(() => { bouton.textContent = texte }, 2000)
    })
  })
  $('#formulaire').addEventListener('submit', (e) => { e.preventDefault(); estimer(true) })
  ;['rsai-type', 'rsai-secteur'].forEach((i) => $('#' + i).addEventListener('change', () => estimer(false)))
  ;['rsai-surface', 'rsai-pieces'].forEach((i) => $('#' + i).addEventListener('input', () => estimer(false)))

  // Préremplissage depuis un lien partagé.
  const params = new URLSearchParams(window.location.search)
  if (params.get('area_m2')) $('#rsai-surface').value = params.get('area_m2')
  if (params.get('rooms')) $('#rsai-pieces').value = params.get('rooms')
  if (params.get('type')) $('#rsai-type').value = params.get('type')
  if (params.get('address')) $('#rsai-adresse').value = params.get('address')
  if (params.get('secteur') && SECTEURS[params.get('secteur')]) selecteur.value = params.get('secteur')
  if ([...params.keys()].length) window.history.replaceState({}, '', window.location.pathname)

  chargerSecteurs(); estimer(false); verifierApi()

  return () => { /* rien à nettoyer : le démontage du conteneur suffit */ }
}
