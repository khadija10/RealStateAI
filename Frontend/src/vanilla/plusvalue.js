// Page "Plus-value" — reprise quasi verbatim de l'artefact Claude Design
// (https://claude.ai/artifact/7Bg8Rm7mx5EzW76FTn4AtD). Calculateur
// local (projections de marché + fiscalité CGI) ; les séries de prix des
// secteurs viennent du backend (GET /api/market/secteurs), jamais du code.
import { heroPlusValue } from '../illustrations.js'
import { enregistreurSimulation } from './historique.js'
import { scenariosMarche } from './scenarios.js'

export const html = `
<section class="heros heros-simple">
  <div class="illus" id="pv-illus-heros"></div>
  <div class="accroche">
    <h1>Anticiper<em>votre plus-value</em></h1>
    <p>Trois scénarios tirés du marché réellement observé, et la fiscalité 2026
       appliquée à la durée de détention.</p>
  </div>
</section>

<h2 class="titre-section">Votre <em>acquisition</em></h2>
<p class="sous">Un secteur, un prix, une date d'achat et un horizon de revente.
  Tout le reste est calculé.</p>

<section class="simu">
  <div class="clair">
    <div class="choix"><label for="pv-secteur">Secteur</label><select id="pv-secteur"></select></div>
    <div class="reglage"><div class="haut"><label for="pv-prix">Prix d'achat</label><output id="pv-o-prix"></output></div>
      <input type="range" id="pv-prix" min="80000" max="2000000" step="5000" value="420000"></div>
    <div class="choix"><label for="pv-annee">Année d'achat</label>
      <select id="pv-annee"><option>2021</option><option>2022</option><option selected>2023</option><option>2024</option><option>2025</option><option>2026</option></select></div>
    <div class="reglage"><div class="haut"><label for="pv-horizon">Revente dans</label><output id="pv-o-horizon"></output></div>
      <input type="range" id="pv-horizon" min="1" max="30" step="1" value="10"></div>
    <div class="choix"><label>Usage du bien</label>
      <div class="bascules">
        <button type="button" class="bascule" data-u="rp" aria-pressed="true">Résidence principale</button>
        <button type="button" class="bascule" data-u="inv" aria-pressed="false">Investissement</button>
      </div></div>
    <button type="button" class="bouton-accent" id="pv-simuler">Simuler la plus-value</button>
    <p class="aide" id="pv-etat"></p>
  </div>

  <div class="sombre">
    <div class="illus" id="pv-illus-carte"></div>
    <div>
      <div class="lib" id="pv-lib-scen"></div>
      <div class="grand" id="pv-pv"></div>
      <div class="precision" id="pv-precision"></div>
    </div>
    <div class="mesures" data-resultat hidden>
      <div class="mesure"><b id="pv-revente">—</b><span>Prix de revente</span></div>
      <div class="mesure"><b id="pv-impot">—</b><span>Impôt sur la plus-value</span></div>
      <div class="mesure"><b id="pv-net">—</b><span>Gain net après frais</span></div>
    </div>
  </div>
</section>

<section class="scen" id="pv-scen" data-resultat hidden></section>

<section class="graphe" data-resultat hidden>
  <div class="graphe-tete">
    <h3>Trajectoire <em>du prix au m²</em></h3>
    <div class="legende-graphe">
      <span><i style="background:var(--encre)"></i>Observé</span>
      <span><i style="background:var(--rouge)"></i>Bas</span>
      <span><i style="background:var(--taupe)"></i>Central</span>
      <span><i style="background:var(--vert)"></i>Haut</span>
    </div>
  </div>
  <div id="pv-eventail"></div>
</section>

<div data-resultat hidden>
<h2 class="titre-section">La <em>fiscalité</em></h2>
<p class="sous">Barème 2026 : 19 % d'impôt sur le revenu et 17,2 % de prélèvements sociaux,
  allégés par la durée de détention.</p>
<section class="deux">
  <div class="clair">
    <h3>Votre <em>imposition</em></h3>
    <p class="aide" id="pv-aide-impot"></p>
    <div id="pv-detail-impot"></div>
  </div>
  <div class="clair">
    <h3>L'effet <em>du temps</em></h3>
    <p class="aide">Abattement selon la durée de détention</p>
    <div id="pv-abattements"></div>
  </div>
</section>

</div>
<h2 class="titre-section">La résilience <em>des secteurs</em></h2>
<p class="sous">Variation du prix au m² entre 2021 et 2025. La baisse n'a pas frappé tous les
  quartiers de la même façon — c'est ce qui rend l'emplacement décisif.</p>
<section class="graphe" style="margin-top:0"><div id="pv-resilience"></div></section>

<section class="methode">
  <div>
    <h3>Pourquoi des <em>scénarios</em>,<br>et pas une prédiction</h3>
    <p>Le jeu de données couvre cinq années, dont une crise immobilière. C'est trop court
       pour prévoir un marché : un modèle entraîné sur cette période extrapolerait
       simplement la baisse.</p>
    <p>On projette donc <b>trois trajectoires tirées du marché observé</b> du secteur.
       L'écart entre elles est l'information utile : il mesure l'incertitude.</p>
  </div>
  <div>
    <h3>Ce que la simulation <em>ignore</em></h3>
    <p>Les frais d'agence à la revente, l'inflation, les travaux réellement engagés et les
       cas d'exonération particuliers.</p>
    <p>Les frais d'acquisition sont retenus <b>au forfait de 7,5 %</b>, et les travaux au
       forfait de 15 % au-delà de cinq ans de détention, comme le prévoit le Code général
       des impôts.</p>
  </div>
</section>

<div class="bas">
  <span>Données : DVF — DGFiP / Etalab · Fiscalité : CGI art. 150 U, 150 VC, 200 B, 1609 nonies G</span>
  <span>Simulation indicative : ni conseil fiscal, ni conseil en investissement.</span>
  <span>RealStateAI — v${__APP_VERSION__}</span>
</div>
`

const FISCAL = {
  ir: 0.19, ps: 0.172, forfaitAcquisition: 0.075, forfaitTravaux: 0.15,
  surtaxe: [[50000, 0.02], [100000, 0.03], [150000, 0.04], [200000, 0.05], [250000, 0.06]],
}
function abattementIR(annees) { if (annees < 6) return 0; if (annees <= 21) return 0.06 * (annees - 5); return 1 }
function abattementPS(annees) {
  if (annees < 6) return 0
  if (annees <= 21) return 0.0165 * (annees - 5)
  if (annees === 22) return 0.0165 * 16 + 0.016
  if (annees < 30) return 0.0165 * 16 + 0.016 + 0.09 * (annees - 22)
  return 1
}
function tauxSurtaxe(pv) { let t = 0; for (const [s, x] of FISCAL.surtaxe) if (pv > s) t = x; return t }
function impot(prixAchat, prixVente, annees, rp, travaux = 0) {
  if (rp) return { exonere: true, pvBrute: prixVente - prixAchat, ir: 0, ps: 0, surtaxe: 0, total: 0 }
  const travauxRetenus = annees > 5 ? Math.max(travaux, prixAchat * FISCAL.forfaitTravaux) : travaux
  const prixRevient = prixAchat * (1 + FISCAL.forfaitAcquisition) + travauxRetenus
  const pv = Math.max(0, prixVente - prixRevient)
  const baseIR = pv * (1 - abattementIR(annees)), basePS = pv * (1 - abattementPS(annees))
  const ir = baseIR * FISCAL.ir, ps = basePS * FISCAL.ps, surtaxe = baseIR * tauxSurtaxe(baseIR)
  return { exonere: false, pvBrute: pv, prixRevient, baseIR, basePS, ir, ps, surtaxe, total: ir + ps + surtaxe, abattIR: abattementIR(annees), abattPS: abattementPS(annees) }
}
function scenarios(serie) {
  return scenariosMarche(serie, [2021, 2022, 2023, 2024, 2025])
}
function indice(serie, annee, taux) {
  if (annee <= 2021) return serie[0]
  if (annee <= 2025) return serie[annee - 2021]
  return serie[4] * Math.pow(1 + taux, annee - 2025)
}

function fraisReels(prix) {
  const droits = prix * (0.05 + 0.012 + 0.05 * 0.0237)
  let emo = 0, pl = 0
  for (const [p, t] of [[6500, 0.0387], [17000, 0.01596], [60000, 0.01064], [Infinity, 0.00799]]) {
    const b = Math.min(prix, p)
    if (b > pl) { emo += (b - pl) * t; pl = b }
    if (prix <= p) break
  }
  return droits + emo * 1.2 + prix * 0.001 + 1200
}

let uid = 0
const id = (p) => p + (++uid)
function tourCarte() {
  const c = id('c')
  let s = `<svg viewBox="0 0 400 520" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5A4658"/><stop offset="1" stop-color="#E4B48E"/></linearGradient></defs>
    <rect width="400" height="520" fill="url(#${c})"/><rect x="110" y="70" width="190" height="460" fill="#EFE7DC"/>`
  for (let j = 0; j < 14; j++) for (let i = 0; i < 4; i++) s += `<rect x="${124 + i * 44}" y="${90 + j * 30}" width="30" height="18" fill="#3F3440" opacity="${0.55 + ((i + j) % 3) * 0.13}"/>`
  return s + `</svg>`
}

const euro = (n) => Math.round(n).toLocaleString('fr-FR') + ' €'
const k = (n) => (n / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + 'k €'
const pct = (x, d = 1) => (x > 0 ? '+' : '') + (100 * x).toFixed(d).replace('.', ',') + ' %'
const COULEURS = ['var(--rouge)', 'var(--taupe)', 'var(--vert)']

export function mount(root, { apiBase = '', prefill } = {}) {
  const $ = (sel) => root.querySelector(sel)
  let usage = 'rp', choixScen = 1, simule = false
  let SECTEURS = {}
  let actif = true   // réponses ignorées après démontage (double montage React en développement)
  const historique = enregistreurSimulation(apiBase, prefill?.historique_id, 'plusvalue')

  $('#pv-illus-heros').innerHTML = heroPlusValue()
  $('#pv-illus-carte').innerHTML = tourCarte()

  // Secteurs et médianes annuelles 2021-2025 servis par le backend. Seuls
  // ceux qui ont une médiane chaque année se prêtent à une projection.
  const sel = $('#pv-secteur')
  sel.innerHTML = '<option value="">Chargement…</option>'
  async function chargerSecteurs() {
    const type = prefill?.type === 'house' ? 'house' : 'apartment'
    try {
      const r = await fetch(`${apiBase}/api/market/secteurs?property_type=${type}`, { signal: AbortSignal.timeout(8000) })
      const liste = r.ok ? await r.json() : []
      if (!actif) return
      SECTEURS = Object.fromEntries(liste.filter((s) => (s.eco || []).length === 5 && s.eco.every((v) => v != null))
        .map((s) => [s.code, s]))
      const tries = Object.values(SECTEURS).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
      if (!tries.length) throw new Error('vide')
      sel.innerHTML = '<option value="">— choisir un secteur —</option>' +
        tries.map((s) => `<option value="${s.code}">${s.nom}</option>`).join('')
      if (prefill?.secteur && SECTEURS[prefill.secteur]) sel.value = prefill.secteur
    } catch {
      sel.innerHTML = '<option value="">Indisponible</option>'
      $('#pv-etat').textContent = 'Les statistiques de marché sont indisponibles pour le moment.'
    }
  }

  // Préremplissage depuis l'onglet Estimation : « simuler la plus-value de
  // CE bien », prix et secteur réels, achat supposé cette année.
  if (prefill?.prix) {
    const prix = $('#pv-prix')
    prix.value = Math.min(+prix.max, Math.max(+prix.min, Math.round(prefill.prix / 5000) * 5000))
    const anneeSel = $('#pv-annee')
    const anneeActuelle = String(new Date().getFullYear())
    if ([...anneeSel.options].some((o) => o.value === anneeActuelle)) anneeSel.value = anneeActuelle
  }

  function simuler() {
    if (!SECTEURS[sel.value]) { $('#pv-etat').textContent = 'Choisissez un secteur pour lancer la simulation.'; return }
    $('#pv-etat').textContent = ''
    simule = true
    root.querySelectorAll('[data-resultat]').forEach((el) => { el.hidden = false })
    calculer()
  }

  function curseurs() {
    root.querySelectorAll('input[type=range]').forEach((r) => r.style.setProperty('--p', (100 * (r.value - r.min)) / (r.max - r.min) + '%'))
    const horizon = +$('#pv-horizon').value
    $('#pv-o-prix').textContent = euro(+$('#pv-prix').value)
    $('#pv-o-horizon').textContent = horizon + (horizon > 1 ? ' ans' : ' an') + ' · ' + (+$('#pv-annee').value + horizon)
  }

  function calculer() {
    curseurs()
    const s = SECTEURS[sel.value]
    if (!simule || !s) return
    const prix = +$('#pv-prix').value, annee = +$('#pv-annee').value
    const horizon = +$('#pv-horizon').value, vente = annee + horizon

    const sc = scenarios(s.eco), frais = fraisReels(prix)
    const res = sc.map((x) => {
      const revente = (prix * indice(s.eco, vente, x.taux)) / indice(s.eco, annee, x.taux)
      const imp = impot(prix, revente, horizon, usage === 'rp')
      return { ...x, revente, imp, net: revente - prix - frais - imp.total }
    })

    $('#pv-scen').innerHTML = res.map((r, i) => `
      <button type="button" class="carte-scen" data-i="${i}" aria-pressed="${i === choixScen}">
        <div class="t"><i style="background:${COULEURS[i]}"></i>${['Scénario bas', 'Scénario central', 'Scénario haut'][i]} · ${r.nom}</div>
        <div class="r">${pct(r.taux, 2)} / an</div>
        <div class="v">Revente <b>${euro(r.revente)}</b> · plus-value <b>${pct(r.revente / prix - 1)}</b></div>
      </button>`).join('')

    const r = res[choixScen], pv = r.revente - prix
    $('#pv-lib-scen').textContent = `Plus-value brute · ${['scénario bas', 'scénario central', 'scénario haut'][choixScen]}`
    const g = $('#pv-pv')
    g.textContent = (pv >= 0 ? '+' : '−') + ' ' + euro(Math.abs(pv))
    g.className = 'grand ' + (pv >= 0 ? 'pos' : 'neg')
    $('#pv-precision').textContent = `${s.nom} · achat ${annee}, revente ${vente} · ${pct(r.taux, 2)} par an au-delà de 2025`
    $('#pv-revente').textContent = k(r.revente)
    $('#pv-impot').textContent = r.imp.exonere ? 'Exonéré' : k(r.imp.total)
    $('#pv-net').textContent = (r.net < 0 ? '−' : '') + k(Math.abs(r.net))

    eventail(s, annee, vente, sc)
    fiscalite(r, prix, horizon)
    historique.planifier({
      secteur: s.nom, prix, annee_achat: annee, horizon, annee_revente: vente,
      usage: usage === 'rp' ? 'résidence principale' : 'investissement',
      scenario: ['bas', 'central', 'haut'][choixScen], taux_annuel: r.taux,
      revente: Math.round(r.revente), plus_value: Math.round(pv),
      impot: r.imp.exonere ? 0 : Math.round(r.imp.total), net: Math.round(r.net),
    })
    $('#pv-abattements').innerHTML = courbeAbattements(horizon)
  }

  function eventail(s, annee, vente, sc) {
    const fin = Math.max(2026, vente), L = 900, H = 300, mg = 46, mb = 34, mh = 22
    const valArr = []
    for (let a = 2021; a <= fin; a++) sc.forEach((x) => valArr.push(indice(s.eco, a, x.taux)))
    const min = Math.min(...valArr) * 0.96, max = Math.max(...valArr) * 1.04
    const x = (a) => mg + ((a - 2021) * (L - mg - 14)) / (fin - 2021)
    const y = (v) => mh + (H - mh - mb) * (1 - (v - min) / (max - min))
    const ligne = (t) => { let d = ''; for (let a = 2025; a <= fin; a++) d += (a === 2025 ? 'M' : 'L') + x(a).toFixed(1) + ' ' + y(indice(s.eco, a, t)).toFixed(1) + ' '; return d }
    let zone = 'M' + x(2025) + ' ' + y(s.eco[4])
    for (let a = 2025; a <= fin; a++) zone += ' L' + x(a).toFixed(1) + ' ' + y(indice(s.eco, a, sc[2].taux)).toFixed(1)
    for (let a = fin; a >= 2025; a--) zone += ' L' + x(a).toFixed(1) + ' ' + y(indice(s.eco, a, sc[0].taux)).toFixed(1)
    const obs = s.eco.map((v, i) => (i ? 'L' : 'M') + x(2021 + i) + ' ' + y(v)).join(' ')
    const pas = fin - 2021 > 16 ? 5 : fin - 2021 > 8 ? 2 : 1, graduations = []
    for (let a = 2021; a <= fin; a += pas) graduations.push(a)
    const nbGrilles = 4, grilles = []
    for (let i = 0; i <= nbGrilles; i++) grilles.push(min + ((max - min) * i) / nbGrilles)

    $('#pv-eventail').innerHTML = `<svg viewBox="0 0 ${L} ${H}" style="width:100%;height:auto" role="img" aria-label="Projection du prix au m² selon trois scénarios">
      ${grilles.map((v) => `<line x1="${mg}" x2="${L - 14}" y1="${y(v)}" y2="${y(v)}" stroke="var(--ligne)"/>
        <text x="${mg - 8}" y="${y(v) + 4}" text-anchor="end" font-size="10.5" font-family="Inter" fill="var(--gris)">${(v / 1000).toFixed(1).replace('.', ',')}k</text>`).join('')}
      <path d="${zone} Z" fill="var(--sable)" opacity=".38"/>
      ${sc.map((t, i) => `<path d="${ligne(t.taux)}" fill="none" stroke="${COULEURS[i]}" stroke-width="${i === 1 ? 2.5 : 1.8}" stroke-dasharray="${i === 1 ? '' : '6 5'}"/>`).join('')}
      <path d="${obs}" fill="none" stroke="var(--encre)" stroke-width="2.5"/>
      ${s.eco.map((v, i) => `<circle cx="${x(2021 + i)}" cy="${y(v)}" r="3.5" fill="var(--blanc)" stroke="var(--encre)" stroke-width="2"/>`).join('')}
      <line x1="${x(annee)}" x2="${x(annee)}" y1="${mh}" y2="${H - mb}" stroke="var(--encre)" stroke-dasharray="3 4" opacity=".5"/>
      <text x="${x(annee) + 6}" y="${mh + 12}" font-size="11" font-family="Inter" fill="var(--gris)">achat</text>
      <line x1="${x(vente)}" x2="${x(vente)}" y1="${mh}" y2="${H - mb}" stroke="var(--brun)" stroke-width="1.5"/>
      <text x="${x(vente) - 6}" y="${mh + 12}" text-anchor="end" font-size="11" font-family="Inter" fill="var(--brun)">revente</text>
      ${graduations.map((a) => `<text x="${x(a)}" y="${H - 12}" text-anchor="middle" font-size="10.5" font-family="Inter" fill="var(--gris)">${a}</text>`).join('')}
    </svg>`
  }

  function fiscalite(r, prix, horizon) {
    const aide = $('#pv-aide-impot'), cible = $('#pv-detail-impot')
    if (r.imp.exonere) {
      aide.textContent = 'Résidence principale'
      cible.innerHTML = `<div class="exonere"><b>Exonérée</b>La plus-value sur la résidence principale n'est pas imposée, quelle que soit la durée de détention.</div>`
      return
    }
    const i = r.imp
    aide.textContent = `Détention de ${horizon} an${horizon > 1 ? 's' : ''} · scénario sélectionné`
    cible.innerHTML = `<table><tbody>
      <tr><td>Prix de revente</td><td class="n">${euro(r.revente)}</td></tr>
      <tr><td>Prix d'acquisition majoré des forfaits</td><td class="n">− ${euro(i.prixRevient || prix)}</td></tr>
      <tr><td>Plus-value brute imposable</td><td class="n">${euro(i.pvBrute)}</td></tr>
      <tr><td>Impôt sur le revenu, 19 % · abattement ${Math.round(100 * i.abattIR)} %</td><td class="n">${euro(i.ir)}</td></tr>
      <tr><td>Prélèvements sociaux, 17,2 % · abattement ${Math.round(100 * i.abattPS)} %</td><td class="n">${euro(i.ps)}</td></tr>
      ${i.surtaxe > 0 ? `<tr><td>Surtaxe sur plus-value élevée</td><td class="n">${euro(i.surtaxe)}</td></tr>` : ''}
      <tr class="total"><td>Impôt total</td><td class="n">${euro(i.total)}</td></tr>
    </tbody></table>`
  }

  function courbeAbattements(h) {
    const L = 460, H = 220, mg = 34, mb = 30, mh = 16
    const x = (a) => mg + (a * (L - mg - 12)) / 30, y = (v) => mh + (H - mh - mb) * (1 - v)
    let ir = '', ps = ''
    for (let a = 0; a <= 30; a++) { ir += (a ? 'L' : 'M') + x(a) + ' ' + y(abattementIR(a)) + ' '; ps += (a ? 'L' : 'M') + x(a) + ' ' + y(abattementPS(a)) + ' ' }
    return `<svg viewBox="0 0 ${L} ${H}" style="width:100%;height:auto" role="img" aria-label="Abattements selon la durée de détention">
      ${[0, 0.5, 1].map((v) => `<line x1="${mg}" x2="${L - 12}" y1="${y(v)}" y2="${y(v)}" stroke="var(--ligne)"/>
        <text x="${mg - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" font-family="Inter" fill="var(--gris)">${v * 100}%</text>`).join('')}
      <path d="${ir}" fill="none" stroke="var(--brun)" stroke-width="2.5"/>
      <path d="${ps}" fill="none" stroke="var(--ambre)" stroke-width="2.5"/>
      <line x1="${x(h)}" x2="${x(h)}" y1="${mh}" y2="${H - mb}" stroke="var(--encre)" stroke-dasharray="3 4"/>
      <circle cx="${x(h)}" cy="${y(abattementIR(h))}" r="4.5" fill="var(--blanc)" stroke="var(--brun)" stroke-width="2.5"/>
      <circle cx="${x(h)}" cy="${y(abattementPS(h))}" r="4.5" fill="var(--blanc)" stroke="var(--ambre)" stroke-width="2.5"/>
      ${[0, 5, 10, 15, 22, 30].map((a) => `<text x="${x(a)}" y="${H - 10}" text-anchor="middle" font-size="10" font-family="Inter" fill="var(--gris)">${a} ans</text>`).join('')}
      <text x="${x(22) + 4}" y="${y(1) - 4}" font-size="10.5" font-family="Inter" fill="var(--brun)">Impôt sur le revenu</text>
      <text x="${x(11)}" y="${y(0.3) - 6}" font-size="10.5" font-family="Inter" fill="var(--ambre)">Prélèvements sociaux</text>
    </svg>`
  }

  function resilience() {
    // Les 25 secteurs aux plus gros volumes de ventes, plus le secteur choisi.
    const tous = Object.values(SECTEURS)
    if (!tous.length) return
    const retenus = tous.sort((a, b) => b.n - a.n).slice(0, 25)
    if (SECTEURS[sel.value] && !retenus.includes(SECTEURS[sel.value])) retenus.push(SECTEURS[sel.value])
    const lignes = retenus.map((s) => ({ c: s.code, nom: s.nom, v: s.eco[4] / s.eco[0] - 1 })).sort((a, b) => b.v - a.v)
    const L = 900, hLigne = 24, mg = 230, H = lignes.length * hLigne + 30
    const min = Math.min(...lignes.map((l) => l.v)), max = Math.max(0, ...lignes.map((l) => l.v))
    const x = (v) => mg + ((L - mg - 60) * (v - min)) / (max - min || 1), zero = x(0)
    $('#pv-resilience').innerHTML = `<svg viewBox="0 0 ${L} ${H}" style="width:100%;height:auto" role="img" aria-label="Variation du prix au m² entre 2021 et 2025 par secteur">
      <line x1="${zero}" x2="${zero}" y1="0" y2="${H - 20}" stroke="var(--encre)"/>
      ${lignes.map((l, i) => {
        const yy = i * hLigne + 6, act = l.c === sel.value
        return `<text x="${mg - 10}" y="${yy + 13}" text-anchor="end" font-size="12" font-family="Inter" fill="${act ? 'var(--encre)' : 'var(--gris)'}" font-weight="${act ? 600 : 400}">${l.nom}</text>
        <rect x="${Math.min(zero, x(l.v))}" y="${yy + 3}" width="${Math.abs(x(l.v) - zero)}" height="14" rx="4" fill="${act ? 'var(--brun)' : l.v < -0.1 ? 'var(--rouge)' : 'var(--taupe)'}" opacity="${act ? 1 : 0.55}"/>
        ${Math.abs(x(l.v) - zero) > 64
          ? `<text x="${Math.min(zero, x(l.v)) + 8}" y="${yy + 14}" text-anchor="start" font-size="12" font-weight="600" font-family="Inter" fill="${act ? '#fff' : 'var(--encre)'}">${pct(l.v)}</text>`
          : `<text x="${x(l.v) - 6}" y="${yy + 14}" text-anchor="end" font-size="12" font-family="Inter" fill="var(--encre)">${pct(l.v)}</text>`}`
      }).join('')}
    </svg>`
  }

  // Après une première simulation, les réglages la mettent à jour en direct.
  root.querySelectorAll('input[type=range],select').forEach((e) => e.addEventListener('input', calculer))
  sel.addEventListener('input', resilience)
  $('#pv-simuler').addEventListener('click', simuler)
  $('#pv-scen').addEventListener('click', (e) => {
    const b = e.target.closest('.carte-scen'); if (!b) return
    choixScen = +b.dataset.i; calculer()
  })
  root.querySelectorAll('[data-u]').forEach((b) => b.addEventListener('click', () => {
    usage = b.dataset.u
    root.querySelectorAll('[data-u]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
    calculer()
  }))

  // Rien n'est simulé à l'ouverture. Venir de l'onglet Estimation via
  // « Simuler la plus-value » est une demande explicite : on simule ce bien.
  curseurs()
  $('#pv-precision').textContent = 'Choisissez un secteur, un prix et un horizon, puis cliquez sur « Simuler la plus-value ».'
  chargerSecteurs().then(() => { if (!actif) return; resilience(); if (prefill?.prix) simuler() })

  return () => { actif = false; historique.annuler() }
}
