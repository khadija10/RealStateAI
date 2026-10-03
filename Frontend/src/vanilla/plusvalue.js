// Page "Plus-value" — reprise quasi verbatim de l'artefact Claude Design
// (https://claude.ai/artifact/7Bg8Rm7mx5EzW76FTn4AtD). Calculateur
// local (projections de marché + fiscalité CGI) ; les séries de prix des
// secteurs viennent du backend (GET /api/market/secteurs), jamais du code.
import { heroPlusValue } from '../illustrations.js'
import { enregistreurSimulation } from './historique.js'
import { scenariosMarche } from './scenarios.js'
import { champsMontants, afficherMontant } from './montants.js'
import { HYPOTHESES } from './acheterlouer.js'

export const html = `
<section class="heros heros-simple">
  <div class="illus" id="pv-illus-heros"></div>
  <div class="accroche">
    <h1>Anticiper<em>votre plus-value</em></h1>
    <p>Trois scénarios de marché (tendance observée, stabilité, reprise modérée) et la
       fiscalité 2026 appliquée à la durée de détention.</p>
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
        <button type="button" class="bascule" data-u="rp" role="radio" aria-checked="true" aria-pressed="true">Résidence principale</button>
        <button type="button" class="bascule" data-u="inv" role="radio" aria-checked="false" aria-pressed="false">Investissement</button>
      </div></div>
    <div class="choix"><label>Revente</label>
      <div class="bascules">
        <button type="button" class="bascule" data-r="agence" role="radio" aria-checked="true" aria-pressed="true">Par une agence (${Math.round(100 * HYPOTHESES.fraisRevente)} %)</button>
        <button type="button" class="bascule" data-r="particulier" role="radio" aria-checked="false" aria-pressed="false">Entre particuliers</button>
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
      <div class="mesure"><b id="pv-revente">—</b><span>Revente selon les scénarios</span></div>
      <div class="mesure"><b id="pv-impot">—</b><span id="pv-l-impot">Impôt sur la plus-value</span></div>
      <div class="mesure"><b id="pv-net">—</b><span id="pv-l-net">Gain net après frais</span></div>
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
<h2 class="titre-section">Ce que dit <em>l'historique</em></h2>
<p class="sous">Cinq ans de ventes ne suffisent pas pour juger d'une revente lointaine. Les indices
  Notaires-INSEE remontent à 1992 ou 1996 : on y compare le seuil à toutes les périodes passées de même durée.</p>
<section class="deux">
  <div class="clair">
    <h3>Le seuil, <em>face au passé</em></h3>
    <p class="aide" id="pv-histo-aide"></p>
    <div id="pv-histo"></div>
  </div>
  <div class="clair">
    <h3>Et si vous <em>louiez</em> ?</h3>
    <p class="aide" id="pv-loyer-aide"></p>
    <div id="pv-loyer"></div>
  </div>
</section>

<h2 class="titre-section">La <em>fiscalité</em></h2>
<p class="sous">Barème 2026 : 19 % d'impôt sur le revenu et 17,2 % de prélèvements sociaux,
  allégés par la durée de détention.</p>
<section class="deux" id="pv-fiscalite">
  <div class="clair">
    <h3>Votre <em>imposition</em></h3>
    <p class="aide" id="pv-aide-impot"></p>
    <div id="pv-detail-impot"></div>
  </div>
  <div class="clair" id="pv-carte-abattements">
    <h3>L'effet <em>du temps</em></h3>
    <p class="aide">Abattement selon la durée de détention</p>
    <div id="pv-abattements"></div>
  </div>
</section>

</div>
<h2 class="titre-section">La résilience <em>des secteurs</em></h2>
<p class="sous" id="pv-resilience-sous">Variation du prix au m² entre 2021 et 2025. La baisse n'a pas frappé tous les
  quartiers de la même façon — c'est ce qui rend l'emplacement décisif.</p>
<section class="graphe" style="margin-top:0"><div id="pv-resilience"></div></section>

<section class="methode">
  <div>
    <h3>Pourquoi des <em>scénarios</em>,<br>et pas une prédiction</h3>
    <p>Le jeu de données couvre cinq années, dont une crise immobilière. C'est trop court
       pour prévoir un marché : un modèle entraîné sur cette période extrapolerait
       simplement la baisse.</p>
    <p>On projette donc <b>trois trajectoires</b> : la tendance observée du secteur depuis 2021
       prolongée (limitée à ±4 % par an), la stabilité des prix, et une reprise modérée au rythme de
       l'inflation visée par la BCE (2 % par an). La baisse de 2022-2024 est surtout une correction liée à la
       remontée des taux : elle sert de borne basse, pas de tendance de fond. L'écart entre les trois
       trajectoires mesure l'incertitude.</p>
  </div>
  <div>
    <h3>Ce que la simulation <em>ignore</em></h3>
    <p>L'inflation, le coût du crédit, les travaux réellement engagés et les cas
       d'exonération particuliers. Les frais d'agence à la revente sont comptés à
       ${Math.round(100 * HYPOTHESES.fraisRevente)} % du prix, sauf vente entre particuliers.</p>
    <p>Les frais d'acquisition sont retenus <b>au forfait de 7,5 %</b>, et les travaux au
       forfait de 15 % au-delà de cinq ans de détention, comme le prévoit le Code général
       des impôts.</p>
  </div>
</section>

<p class="mention">Simulation indicative : ni conseil fiscal, ni conseil en investissement. Fiscalité : Code général des impôts, articles 150 U, 150 VC, 200 B et 1609 nonies G.</p>
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
// Montants projetés arrondis au millier : une projection à l'euro près
// suggérerait une précision qu'elle n'a pas.
const rond = (x) => Math.round(x / 1000) * 1000

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

// Hausse annuelle des prix (au-delà de 2025) à partir de laquelle la revente
// couvre le prix d'achat, les frais d'acquisition et l'impôt. Le gain net
// croît avec le taux : une dichotomie suffit.
function seuilRentabilite(net) {
  let bas = -0.5, haut = 0.5
  if (net(haut) < 0) return Infinity
  if (net(bas) >= 0) return -Infinity
  for (let i = 0; i < 60; i++) { const m = (bas + haut) / 2; if (net(m) < 0) bas = m; else haut = m }
  return haut
}

// Croissance annuelle des prix sur chaque période passée de `ans` années,
// trimestre par trimestre (périodes chevauchantes) : la distribution observée,
// pas une probabilité.
function periodesHistoriques(ind, ans) {
  const q = 4 * ans, v = ind.valeurs, out = []
  const [a0, t0] = ind.debut.split('-Q').map(Number)
  for (let i = 0; i + q < v.length; i++) {
    const debut = a0 + (t0 - 1 + i) / 4
    out.push({ debut, taux: Math.pow(v[i + q] / v[i], 1 / ans) - 1 })
  }
  return out
}
const NOMS_DEP = { 75: 'Paris', 77: 'Seine-et-Marne', 78: 'Yvelines', 91: 'Essonne', 92: 'Hauts-de-Seine',
                   93: 'Seine-Saint-Denis', 94: 'Val-de-Marne', 95: "Val-d'Oise" }
const DEPUIS_RECENT = 2010

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
  let usage = 'rp', choixScen = 1, simule = false, agence = true
  const INDICES = {}   // « 93|apartment » → série INSEE, null si indisponible
  let SECTEURS = {}
  let actif = true   // réponses ignorées après démontage (double montage React en développement)
  const historique = enregistreurSimulation(apiBase, prefill?.historique_id, 'plusvalue')
  champsMontants(root, [['pv-prix', 'pv-o-prix']])

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
    afficherMontant($('#pv-o-prix'), euro(+$('#pv-prix').value))
    $('#pv-o-horizon').textContent = horizon + (horizon > 1 ? ' ans' : ' an') + ' · ' + (+$('#pv-annee').value + horizon)
  }

  function calculer() {
    curseurs()
    const s = SECTEURS[sel.value]
    if (!simule || !s) return
    const prix = +$('#pv-prix').value, annee = +$('#pv-annee').value
    const horizon = +$('#pv-horizon').value, vente = annee + horizon

    const sc = scenarios(s.eco), frais = fraisReels(prix)
    // Les frais de revente (agence) réduisent le prix de cession, base de l'impôt.
    const fr = agence ? HYPOTHESES.fraisRevente : 0
    const bilan = (revente) => {
      const cession = revente * (1 - fr), imp = impot(prix, cession, horizon, usage === 'rp')
      return { cession, imp, net: cession - prix - frais - imp.total }
    }
    const res = sc.map((x) => {
      const revente = (prix * indice(s.eco, vente, x.taux)) / indice(s.eco, annee, x.taux)
      return { ...x, revente, ...bilan(revente) }
    })
    const dep = s.code.slice(0, 2), cle = dep + '|' + (prefill?.type === 'house' ? 'house' : 'apartment')
    if (!(cle in INDICES)) chargerIndice(cle)

    $('#pv-scen').innerHTML = res.map((r, i) => `
      <button type="button" class="carte-scen" data-i="${i}" aria-pressed="${i === choixScen}">
        <div class="t"><i style="background:${COULEURS[i]}"></i>${['Scénario bas', 'Scénario central', 'Scénario haut'][i]} · ${r.nom}</div>
        <div class="r">${pct(r.taux, 2)} / an</div>
        <div class="v">Revente <b>${euro(rond(r.revente))}</b> · plus-value <b>${pct(r.revente / prix - 1)}</b></div>
      </button>`).join('')

    const r = res[choixScen], pv = r.revente - prix
    const noms = ['scénario bas', 'scénario central', 'scénario haut']
    const g = $('#pv-pv')
    if (vente <= 2025) {
      // Revente avant la fin des données : le résultat est observé, pas projeté.
      $('#pv-lib-scen').textContent = 'Plus-value brute · observée sur les ventes réelles'
      const nul = Math.abs(pv) < 500
      g.textContent = nul ? euro(0) : (pv > 0 ? '+' : '−') + ' ' + euro(rond(Math.abs(pv)))
      g.className = 'grand ' + (nul ? '' : pv > 0 ? 'pos' : 'neg')
      $('#pv-precision').textContent = `${s.nom} · achat ${annee}, revente ${vente} · médianes DVF, aucune projection`
    } else {
      // Le résultat d'un seul scénario (souvent la stabilité, donc 0 €) ne dit
      // rien. On affiche la hausse nécessaire pour ne pas perdre d'argent, et
      // les scénarios qui l'atteignent.
      const seuil = seuilRentabilite((t) => bilan((prix * indice(s.eco, vente, t)) / indice(s.eco, annee, t)).net)
      // Affiché en euros : le prix de revente qui couvre tout, arrondi au millier
      // supérieur ; le rythme annuel correspondant passe dans la ligne de précision.
      const minimum = Math.ceil((prix * indice(s.eco, vente, seuil)) / indice(s.eco, annee, seuil) / 1000) * 1000
      $('#pv-lib-scen').textContent = 'Prix de revente minimum pour couvrir vos frais'
      g.textContent = isFinite(seuil) ? euro(minimum) : seuil > 0 ? 'Hors de portée' : '—'
      g.className = 'grand ' + (seuil <= 0 ? 'pos' : seuil > sc[2].taux ? 'neg' : '')
      const ok = res.map((x, i) => x.taux >= seuil - 1e-9 ? i : -1).filter((i) => i >= 0)
      const verdict = (isFinite(seuil) ? `Soit ${pct(seuil, 1)} par an, ` : '') + (ok.length === 3 ? 'atteint dans les trois scénarios'
        : ok.length === 0 ? 'atteint dans aucun des trois scénarios'
        : `atteint seulement dans le ${ok.map((i) => noms[i]).join(' et le ')}`)
      const h = histoire(cle, vente - Math.max(annee, 2025), seuil)
      $('#pv-precision').textContent = `${verdict}` +
        (h ? ` · dépassé dans ${Math.round(100 * h.part)} % des périodes de ${h.ans} ans depuis ${h.depuis}` : '') +
        ` · ${s.nom}, achat ${annee}, revente ${vente}` + (annee < 2025 ? ' · variation observée jusqu\'en 2025 incluse' : '')
      afficherHistoire(h, seuil, s)
    }
    if (vente <= 2025) afficherHistoire(null, null, s)
    loyer(s, prix, horizon)
    $('#pv-revente').textContent = `${k(res[0].revente)} – ${k(res[2].revente)}`
    $('#pv-impot').textContent = r.imp.exonere ? 'Exonéré' : r.imp.total < 500 ? 'Aucun' : k(r.imp.total)
    $('#pv-net').textContent = (r.net < 0 ? '−' : '') + k(Math.abs(r.net))
    $('#pv-l-impot').textContent = `Impôt · ${noms[choixScen]}`
    $('#pv-l-net').textContent = `Gain net après frais · ${noms[choixScen]}`

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
    // Résidence principale : exonérée quelle que soit la durée, la courbe des
    // abattements n'apporte rien et la carte d'imposition prend toute la largeur.
    $('#pv-carte-abattements').hidden = usage === 'rp'
    $('#pv-fiscalite').style.gridTemplateColumns = usage === 'rp' ? '1fr' : ''
  }

  async function chargerIndice(cle) {
    INDICES[cle] = null
    const [dep, type] = cle.split('|')
    try {
      const r = await fetch(`${apiBase}/api/market/indices?dep=${dep}&property_type=${type}`, { signal: AbortSignal.timeout(8000) })
      if (r.ok) INDICES[cle] = await r.json()
    } catch { /* l'historique est un complément : la page s'en passe */ }
    if (actif && INDICES[cle]) calculer()
  }

  // Part des périodes passées de même durée où les prix ont progressé au moins
  // au rythme du seuil, sur tout l'historique et depuis DEPUIS_RECENT.
  function histoire(cle, ans, seuil) {
    const ind = INDICES[cle]
    if (!ind || ans < 1 || !isFinite(seuil)) return null
    const p = periodesHistoriques(ind, ans)
    if (!p.length) return { ind, ans, periodes: p, trop: true }
    const part = (l) => l.filter((x) => x.taux >= seuil).length / l.length
    const recentes = p.filter((x) => x.debut >= DEPUIS_RECENT)
    const tri = [...p].sort((a, b) => a.taux - b.taux)
    return { ind, ans, periodes: p, part: part(p), depuis: Math.floor(p[0].debut),
             recent: recentes.length >= 12 ? part(recentes) : null, nRecent: recentes.length,
             pire: tri[0], meilleure: tri[tri.length - 1] }
  }

  function afficherHistoire(h, seuil, s) {
    const aide = $('#pv-histo-aide'), cible = $('#pv-histo')
    if (!h) {
      aide.textContent = ''
      cible.innerHTML = `<p class="aide">${seuil === null ? 'Revente avant fin 2025 : le résultat est déjà observé, il n\'y a rien à projeter.'
        : 'Indice historique indisponible pour ce département.'}</p>`
      return
    }
    const dep = h.ind.dep, nomDep = NOMS_DEP[dep] || dep
    const typ = h.ind.type_reel === 'house' ? 'maisons' : 'appartements'
    const periode = (x) => `${Math.floor(x.debut)}-${Math.floor(x.debut) + h.ans}`
    if (h.trop) {
      aide.textContent = `${nomDep}, ${typ}`
      cible.innerHTML = `<p class="aide">L'indice ne remonte pas assez loin pour observer des périodes de ${h.ans} ans.</p>`
      return
    }
    aide.textContent = `Indice Notaires-INSEE · ${nomDep}, ${typ}${dep === '75' && s && prefill?.type === 'house' ? ' (pas d\'indice maisons à Paris)' : ''} · ${h.periodes.length} périodes de ${h.ans} ans`
    // Une barre par trimestre de départ : la croissance annuelle obtenue en
    // revendant autant d'années plus tard. Vert : au-dessus du seuil.
    const L = 460, H = 200, mg = 40, md = 8, mh = 10, mb = 26
    const valeurs = h.periodes.map((x) => x.taux).concat(seuil, 0)
    const min = Math.min(...valeurs), max = Math.max(...valeurs), ecart = max - min || 0.01
    const y = (v) => mh + (H - mh - mb) * (1 - (v - min) / ecart)
    const pasX = (L - mg - md) / h.periodes.length
    const a0 = Math.floor(h.periodes[0].debut), a1 = Math.floor(h.periodes[h.periodes.length - 1].debut)
    const ticks = []
    for (let a = Math.ceil(a0 / 5) * 5; a <= a1; a += 5) ticks.push(a)
    const xA = (a) => mg + ((a - h.periodes[0].debut) * 4 + 0.5) * pasX
    const graduations = [min, 0, max].filter((v, i, t) => t.indexOf(v) === i)
    cible.innerHTML = `
      <div class="histo-chiffre"><b>${Math.round(100 * h.part)} %</b> des périodes de ${h.ans} ans depuis ${h.depuis}
        ont dépassé le seuil de ${pct(seuil, 1)} / an${h.recent !== null ? `, <b>${Math.round(100 * h.recent)} %</b> de celles commencées depuis ${DEPUIS_RECENT}` : ''}.</div>
      <svg viewBox="0 0 ${L} ${H}" style="width:100%;height:auto" role="img" aria-label="Croissance annuelle des prix sur chaque période de ${h.ans} ans depuis ${h.depuis}, comparée au seuil de ${pct(seuil, 1)} par an">
        ${graduations.map((v) => `<line x1="${mg}" x2="${L - md}" y1="${y(v)}" y2="${y(v)}" stroke="var(--ligne)"/>
          <text x="${mg - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" font-family="Inter" fill="var(--gris)">${pct(v, 0)}</text>`).join('')}
        ${h.periodes.map((x, i) => `<rect x="${(mg + i * pasX).toFixed(1)}" width="${Math.max(1, pasX - 0.6).toFixed(1)}"
          y="${Math.min(y(x.taux), y(0)).toFixed(1)}" height="${Math.max(0.5, Math.abs(y(x.taux) - y(0))).toFixed(1)}"
          fill="${x.taux >= seuil ? 'var(--vert)' : 'var(--taupe)'}" opacity="${x.taux >= seuil ? 0.85 : 0.6}"/>`).join('')}
        <line x1="${mg}" x2="${L - md}" y1="${y(seuil)}" y2="${y(seuil)}" stroke="var(--brun)" stroke-width="1.8" stroke-dasharray="6 4"/>
        <text x="${L - md}" y="${y(seuil) - 5}" text-anchor="end" font-size="11" font-family="Inter" fill="var(--brun)">seuil ${pct(seuil, 1)}</text>
        ${ticks.map((a) => `<text x="${xA(a)}" y="${H - 8}" text-anchor="middle" font-size="11" font-family="Inter" fill="var(--gris)">${a}</text>`).join('')}
      </svg>
      <p class="aide" style="margin:10px 0 0">Chaque barre : achat au trimestre indiqué, revente ${h.ans} ans plus tard.
        Pire période ${periode(h.pire)} : ${pct(h.pire.taux, 1)} / an ; meilleure ${periode(h.meilleure)} : ${pct(h.meilleure.taux, 1)} / an.
        L'historique comprend la forte hausse de 1998-2007 : c'est une fréquence passée, pas une probabilité.</p>`
  }

  // Loyer d'annonce d'un bien équivalent (Carte des loyers ANIL). La surface
  // est déduite du prix et de la médiane au m² du secteur.
  function loyer(s, prix, horizon) {
    const aide = $('#pv-loyer-aide'), cible = $('#pv-loyer'), l = s.loyer
    if (!l) { aide.textContent = ''; cible.innerHTML = '<p class="aide">Loyer d\'annonce indisponible pour ce secteur.</p>'; return }
    const surface = prix / s.med, mois = surface * l.m2
    const hl = HYPOTHESES.hausseLoyer
    let cumul = 0
    for (let a = 0; a < horizon; a++) cumul += 12 * mois * Math.pow(1 + hl, a)
    const arr = (n) => euro(Math.round(n / 10) * 10)
    aide.textContent = `Carte des loyers 2025 (ANIL) · ${l.niveau === 'commune' ? `${l.annonces.toLocaleString('fr-FR')} annonces de la commune` : 'estimé sur les communes voisines'}`
    cible.innerHTML = `
      <div class="histo-chiffre"><b>≈ ${arr(mois)}</b> par mois, charges comprises, pour environ ${Math.round(surface)} m²
        (${arr(surface * l.bas)} à ${arr(surface * l.haut)}).</div>
      <table><tbody>
        <tr><td>Loyer au m²</td><td class="n">${l.m2.toFixed(1).replace('.', ',')} € / mois</td></tr>
        <tr><td>Rendement locatif brut</td><td class="n">${pct((12 * mois) / prix, 1)} / an</td></tr>
        <tr><td>Loyers sur ${horizon} an${horizon > 1 ? 's' : ''} (+${Math.round(100 * hl)} % par an)</td><td class="n">${k(cumul)}</td></tr>
      </tbody></table>
      <p class="aide" style="margin:10px 0 0">${usage === 'rp'
        ? `C'est ce que coûterait la location d'un bien équivalent pendant la détention. L'achat évite ce loyer mais coûte les intérêts du crédit, la taxe foncière et l'entretien : l'onglet Financement calcule à partir de quand l'achat devient plus avantageux.`
        : `Ce que le bien pourrait rapporter en loyers bruts, avant charges, vacance locative et impôts. Le rendement total d'un investissement ajoute ces loyers nets au gain de revente ci-dessus.`}</p>`
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
      <tr><td>Prix de cession${r.cession < r.revente ? ' (net des frais d\'agence)' : ''}</td><td class="n">${euro(r.cession)}</td></tr>
      <tr><td>Prix d'acquisition majoré des forfaits</td><td class="n">− ${euro(i.prixRevient || prix)}</td></tr>
      <tr><td>Plus-value brute imposable</td><td class="n">${euro(i.pvBrute)}</td></tr>
      <tr><td>Impôt sur le revenu, 19 % · abattement ${Math.round(100 * i.abattIR)} %</td><td class="n">${euro(i.ir)}</td></tr>
      <tr><td>Prélèvements sociaux, 17,2 % · abattement ${Math.round(100 * i.abattPS)} %</td><td class="n">${euro(i.ps)}</td></tr>
      ${i.surtaxe > 0 ? `<tr><td>Surtaxe sur plus-value élevée</td><td class="n">${euro(i.surtaxe)}</td></tr>` : ''}
      <tr class="total"><td>Impôt total</td><td class="n">${euro(i.total)}</td></tr>
    </tbody></table>`
  }

  function courbeAbattements(h) {
    const L = 460, H = 210, mg = 44, md = 26, mb = 30, mh = 14
    const x = (a) => mg + (a * (L - mg - md)) / 30, y = (v) => mh + (H - mh - mb) * (1 - v)
    let ir = '', ps = ''
    for (let a = 0; a <= 30; a++) { ir += (a ? 'L' : 'M') + x(a) + ' ' + y(abattementIR(a)) + ' '; ps += (a ? 'L' : 'M') + x(a) + ' ' + y(abattementPS(a)) + ' ' }
    return `<svg viewBox="0 0 ${L} ${H}" style="width:100%;height:auto" role="img" aria-label="Abattements selon la durée de détention : exonération totale de l'impôt sur le revenu après 22 ans, des prélèvements sociaux après 30 ans">
      ${[0, 0.5, 1].map((v) => `<line x1="${mg}" x2="${L - md}" y1="${y(v)}" y2="${y(v)}" stroke="var(--ligne)"/>
        <text x="${mg - 8}" y="${y(v) + 4}" text-anchor="end" font-size="13" font-family="Inter" fill="var(--gris)">${v * 100} %</text>`).join('')}
      <path d="${ir}" fill="none" stroke="var(--brun)" stroke-width="2.5"/>
      <path d="${ps}" fill="none" stroke="var(--ambre)" stroke-width="2.5" stroke-dasharray="7 4"/>
      <line x1="${x(h)}" x2="${x(h)}" y1="${mh}" y2="${H - mb}" stroke="var(--encre)" stroke-dasharray="3 4"/>
      <circle cx="${x(h)}" cy="${y(abattementIR(h))}" r="4.5" fill="var(--blanc)" stroke="var(--brun)" stroke-width="2.5"/>
      <circle cx="${x(h)}" cy="${y(abattementPS(h))}" r="4.5" fill="var(--blanc)" stroke="var(--ambre)" stroke-width="2.5"/>
      ${[0, 5, 10, 15, 22, 30].map((a) => `<text x="${x(a)}" y="${H - 8}" text-anchor="${a === 30 ? 'end' : a === 0 ? 'start' : 'middle'}" font-size="13" font-family="Inter" fill="var(--gris)">${a} ans</text>`).join('')}
    </svg>
    <div class="legende-graphe" style="margin-top:8px"><span><i style="background:var(--brun)"></i>Impôt sur le revenu</span><span><i style="background:var(--ambre)"></i>Prélèvements sociaux (pointillés)</span></div>`
  }

  function resilience() {
    // Secteur choisi : comparé aux secteurs voisins de son département (les plus
    // gros volumes de ventes). Sans choix : les 25 plus gros secteurs de la région.
    const tous = Object.values(SECTEURS)
    if (!tous.length) return
    const choisi = SECTEURS[sel.value]
    const dep = choisi ? choisi.code.slice(0, 2) : null
    const retenus = (dep ? tous.filter((s) => s.code.startsWith(dep)) : tous).sort((a, b) => b.n - a.n).slice(0, dep ? 15 : 25)
    if (choisi && !retenus.includes(choisi)) retenus.push(choisi)
    $('#pv-resilience-sous').textContent = (dep
      ? `${choisi.nom} comparé aux principaux secteurs ${dep === '75' ? 'de Paris' : `du département (${NOMS_DEP[dep] || dep})`}`
      : 'Les principaux secteurs d\'Île-de-France') +
      " : variation du prix au m² entre 2021 et 2025. La baisse n'a pas frappé tous les quartiers de la même façon."
    const lignes = retenus.map((s) => ({ c: s.code, nom: s.nom, v: s.eco[4] / s.eco[0] - 1 })).sort((a, b) => b.v - a.v)
    // Barres qui partent juste après le libellé : l'œil relie directement la commune
    // à sa valeur. La longueur dit l'ampleur ; le signe est écrit, et la couleur
    // le double (hausse en vert, baisse en taupe), sans porter l'information seule.
    const L = 900, hLigne = 26, mg = 230, H = lignes.length * hLigne + 8
    const ampleur = Math.max(...lignes.map((l) => Math.abs(l.v)), 0.01)
    const larg = (v) => ((L - mg - 80) * Math.abs(v)) / ampleur
    $('#pv-resilience').innerHTML = `<svg viewBox="0 0 ${L} ${H}" style="width:100%;height:auto" role="img"
      aria-label="Variation du prix au m² entre 2021 et 2025 : ${lignes.map((l) => `${l.nom} ${pct(l.v)}`).join(', ')}">
      ${lignes.map((l, i) => {
        const yy = i * hLigne + 4, act = l.c === sel.value
        return `<text x="${mg - 12}" y="${yy + 14}" text-anchor="end" font-size="13" font-family="Inter" fill="${act ? 'var(--encre)' : 'var(--gris)'}" font-weight="${act ? 600 : 400}">${l.nom}</text>
        <rect x="${mg}" y="${yy + 2}" width="${Math.max(2, larg(l.v))}" height="16" rx="4" fill="${act ? 'var(--brun)' : l.v >= 0 ? 'var(--vert)' : 'var(--taupe)'}" opacity="${act ? 1 : 0.6}"/>
        <text x="${mg + Math.max(2, larg(l.v)) + 8}" y="${yy + 15}" font-size="13" font-weight="${act ? 700 : 500}" font-family="Inter" fill="var(--encre)">${pct(l.v)}</text>`
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
  root.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => {
    agence = b.dataset.r === 'agence'
    root.querySelectorAll('[data-r]').forEach((x) => { x.setAttribute('aria-pressed', String(x === b)); x.setAttribute('aria-checked', String(x === b)) })
    calculer()
  }))
  root.querySelectorAll('[data-u]').forEach((b) => b.addEventListener('click', () => {
    usage = b.dataset.u
    root.querySelectorAll('[data-u]').forEach((x) => { x.setAttribute('aria-pressed', String(x === b)); x.setAttribute('aria-checked', String(x === b)) })
    calculer()
  }))

  // Rien n'est simulé à l'ouverture. Venir de l'onglet Estimation via
  // « Simuler la plus-value » est une demande explicite : on simule ce bien.
  curseurs()
  $('#pv-precision').textContent = 'Choisissez un secteur, un prix et un horizon, puis cliquez sur « Simuler la plus-value ».'
  chargerSecteurs().then(() => { if (!actif) return; resilience(); if (prefill?.prix) simuler() })

  return () => { actif = false; historique.annuler() }
}
