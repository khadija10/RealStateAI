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
            <input id="rsai-surface" type="number" placeholder="58" min="9" max="400" style="width:42px"><span style="font-size:12px;color:var(--gris)">m²</span>
            <input id="rsai-pieces" type="number" placeholder="3" min="1" max="12" style="width:26px;margin-left:8px"><span style="font-size:12px;color:var(--gris)">p.</span>
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
      <div class="stat"><b id="rsai-stat-ventes">—</b><span>Transactions analysées</span></div>
      <div class="stat"><b id="rsai-stat-variables">—</b><span>Variables du modèle</span></div>
      <div class="stat"><b id="rsai-stat-mape">—</b><span id="rsai-stat-mape-lib">Erreur moyenne mesurée</span></div>
      <div class="stat"><b id="rsai-stat-20">—</b><span>Estimations à moins de 20 % du prix réel</span></div>
    </div>
  </div>
</section>

<h2 class="titre-section" id="rsai-resultat">Votre <em>estimation</em></h2>
<p class="sous" id="rsai-attente">Renseignez l'adresse du bien (ou son secteur), sa surface et son nombre
  de pièces, puis cliquez sur « Estimer ».</p>
<section id="rsai-bloc-resultat" hidden>
  <div class="clair clair-grid">
    <div class="bloc bloc-resume">
      <div class="lib" id="rsai-lib-secteur">Estimation</div>
      <div class="valeur" id="rsai-valeur">—</div>
      <div class="fourchette" id="rsai-fourchette"></div>
      <div class="jauge-ci"><i id="rsai-curseur-ci" style="left:50%"></i></div>
      <div class="bornes-ci"><span id="rsai-ci-bas"></span><span id="rsai-ci-haut"></span></div>
      <div class="mesures">
        <div class="mesure"><b id="rsai-m2">—</b><span>€ par m²</span></div>
        <div class="mesure" data-secteur><b id="rsai-med">—</b><span>Médiane du secteur</span></div>
        <div class="mesure" data-secteur><b id="rsai-ecart">—</b><span>Écart au marché</span></div>
      </div>
    </div>
    <div class="bloc">
      <div class="bloc-tete"><h3>Fiabilité <em>de l'estimation</em></h3><span id="rsai-src-modele"></span></div>
      <div class="fiab">
        <div id="rsai-anneau"></div>
        <div class="fiab-txt" id="rsai-fiab-txt"></div>
      </div>
    </div>
    <div class="bloc" data-secteur>
      <div class="bloc-tete"><h3>Position <em>dans le secteur</em></h3><span id="rsai-volume"></span></div>
      <div class="reglette"><i id="rsai-curseur" style="left:50%"></i></div>
      <div class="bornes"><span id="rsai-bas"></span><span id="rsai-haut-d"></span></div>
    </div>
    <div class="bloc" data-secteur>
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
<p class="sous" id="rsai-marche-etat">Chargement des secteurs…</p>
<section class="marche" id="rsai-grille-marche"></section>
<button class="charger" id="rsai-charger" hidden>Voir plus de secteurs</button>

<div class="bas">
  <span>Données : DVF — DGFiP / Etalab · DPE — ADEME · IRIS — INSEE · BDNB — CSTB · Modèle LightGBM<span id="rsai-pied-variables"></span></span>
  <span>Estimation indicative, ne constitue pas une expertise immobilière.</span>
</div>
`

const ANNEES = [2021, 2022, 2023, 2024, 2025]
const euro = (n) => Math.round(n).toLocaleString('fr-FR') + ' €'
const nb = (n) => Math.round(n).toLocaleString('fr-FR')

const TYPE_LABEL = { apartment: 'Appartement', house: 'Maison', other: 'Autre' }

/** Fiche imprimable — même principe que l'ancien frontend (fenêtre + print()). */
function exporterPDF(bien) {
  if (!bien) return
  const { r, s, adresse, surface, pieces } = bien
  const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())
  const lieu = adresse || r.adresse || s?.nom || ''
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
  <tr><td>Méthode</td><td>${r.modele === 'ml' ? 'Modèle ML (LightGBM)' : 'Médiane DVF communale'}</td></tr>
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
  if (bien.commune) p.set('commune', bien.commune)
  return `${window.location.origin}${window.location.pathname}?${p.toString()}`
}

export function mount(root, { apiBase = '', onPlusValue, onFinancement } = {}) {
  const API = {
    BASE: apiBase,
    COMMUNES: '/api/metadata/communes',
    ESTIMER: '/api/predictions/estimate',
    SANTE: '/api/health',
    SECTEURS: '/api/market/secteurs',
  }
  const $ = (sel) => root.querySelector(sel)
  const $$ = (sel) => root.querySelectorAll(sel)

  let dernierBien = null
  let modelInfo = null
  // Une réponse arrivée après le démontage de la page (React monte deux fois
  // en développement) ne doit rien écrire : sinon la grille se remplit en double.
  let actif = true
  $('#illus-heros').innerHTML = heroEstimation()
  $('#rsai-fond-page').innerHTML = heroEstimation()

  // Liste des communes servie par le backend ; aucune présélection.
  const selecteur = $('#rsai-secteur')
  selecteur.innerHTML = '<option value="">Chargement…</option>'
  let communeDemandee = null   // commune d'un lien partagé, appliquée au chargement de la liste

  async function verifierApi() {
    const badge = $('#etat-api')
    try {
      const r = await fetch(API.BASE + API.SANTE, { signal: AbortSignal.timeout(5000) })
      const d = await r.json()
      if (!actif) return
      if (d.model_loaded || d.dvf_loaded) {
        badge.className = 'etat-api direct'
        const mape = d.model_mape != null ? ` · MAPE ${String(d.model_mape).replace('.', ',')} %` : ''
        badge.innerHTML = `<i></i><span>Modèle connecté${mape}</span>`
        chargerCommunes()
      } else {
        badge.innerHTML = `<i></i><span>Modèle indisponible</span>`
      }
      modelInfo = {
        mape: d.model_mape, r2: d.model_r2, nFeatures: d.model_n_features,
        trainedAt: d.model_trained_at, nTrain: d.model_n_train,
        nVentes: d.n_rows, validation: d.model_validation,
      }
      afficherStats()
      if (dernierBien) afficher(dernierBien.r, dernierBien.s, dernierBien.adresse, dernierBien.surface, dernierBien.pieces, dernierBien.type)
    } catch {
      badge.innerHTML = `<i></i><span>Backend injoignable</span>`
      selecteur.innerHTML = '<option value="">Indisponible</option>'
    }
  }

  // Chiffres de la section « Notre approche » : servis par le backend, jamais
  // écrits en dur — l'erreur affichée est celle de la validation officielle
  // (docs/protocole_evaluation.md), mesurée une fois sur un test jamais vu.
  function afficherStats() {
    const mi = modelInfo || {}, v = mi.validation
    const pct = (x) => String(x).replace('.', ',') + ' %'
    if (mi.nVentes) $('#rsai-stat-ventes').textContent = nb(mi.nVentes)
    if (mi.nFeatures) {
      $('#rsai-stat-variables').textContent = mi.nFeatures
      $('#rsai-pied-variables').textContent = `, ${mi.nFeatures} variables`
    }
    if (v) {
      $('#rsai-stat-mape').textContent = pct(v.mape)
      $('#rsai-stat-mape-lib').textContent = `Erreur moyenne, test ${periode(v.periode_test)}`
      $('#rsai-stat-20').textContent = pct(v.dans_20pct)
    }
  }
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  function periode(p) {
    if (!p) return ''
    const [a, b] = p.map((x) => x.split('-'))
    return `${MOIS[+a[1] - 1]}–${MOIS[+b[1] - 1]} ${b[0]}`
  }

  async function chargerCommunes() {
    try {
      const r = await fetch(API.BASE + API.COMMUNES)
      const d = await r.json()
      const communes = Array.isArray(d) ? d.filter(Boolean) : Array.isArray(d?.communes) ? d.communes.filter(Boolean) : []
      if (!actif || !communes.length) return
      selecteur.innerHTML = '<option value="">— choisir —</option>' +
        communes.map((c) => `<option value="${c}">${c}</option>`).join('')
      if (communeDemandee && communes.includes(communeDemandee)) selecteur.value = communeDemandee
    } catch {
      selecteur.innerHTML = '<option value="">Indisponible</option>'
    }
  }

  function message(texte) {
    const m = $('#rsai-attente')
    m.textContent = texte; m.hidden = false
    $('#rsai-bloc-resultat').hidden = true
  }

  async function estimer(defiler) {
    const surface = +$('#rsai-surface').value
    const pieces = +$('#rsai-pieces').value
    const type = $('#rsai-type').value
    const adresse = $('#rsai-adresse').value.trim()
    const commune = selecteur.value
    if (!adresse && !commune) return message("Indiquez l'adresse du bien ou choisissez son secteur.")
    if (!surface || surface < 9) return message('Indiquez la surface du bien (9 m² minimum).')
    if (!pieces) return message('Indiquez le nombre de pièces.')

    const bouton = $('#rsai-bouton')
    bouton.disabled = true; bouton.textContent = 'Calcul…'
    let r = null, erreur = null
    try {
      // Jeton de connexion transmis si présent, pour que le backend
      // rattache cette estimation à l'historique du compte (clé partagée
      // avec src/api/client.js) plutôt qu'à une session anonyme.
      let token = null
      try { token = localStorage.getItem('reai_token') } catch { /* ignore */ }
      const rep = await fetch(API.BASE + API.ESTIMER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          area_m2: surface, rooms: pieces, property_type: type,
          commune: commune || undefined,
          address: adresse || undefined,
        }),
      })
      const d = await rep.json().catch(() => ({}))
      if (rep.ok) r = normaliser(d)
      else erreur = typeof d.detail === 'string' ? d.detail : "L'estimation n'a pas abouti."
    } catch {
      erreur = 'Le service d\'estimation est injoignable. Réessayez dans un instant.'
    }
    bouton.disabled = false; bouton.textContent = 'Estimer'
    if (!actif) return
    if (!r) return message(erreur)

    afficher(r, r.secteur, adresse, surface, pieces, type)
    memoriser({ query: adresse || commune, area_m2: surface, prix: r.valeur })
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
      secteur: d.secteur ? avecAnnees(d.secteur) : null,
    }
  }

  // Médianes annuelles du backend : on garde l'année de chaque point, une
  // année sans vente ne devant pas décaler la courbe.
  function avecAnnees(s) {
    const points = (s.eco || []).map((v, i) => [ANNEES[i], v]).filter(([, v]) => v != null)
    return { ...s, eco: points.map(([, v]) => v), annees: points.map(([a]) => a) }
  }

  function afficher(r, s, adresse, surface, pieces, type) {
    $('#rsai-attente').hidden = true
    $('#rsai-bloc-resultat').hidden = false
    const avecSecteur = !!(s && s.eco?.length >= 2)
    $$('[data-secteur]').forEach((el) => { el.hidden = !avecSecteur })
    $('#rsai-pv-resume').hidden = !avecSecteur
    $('#rsai-lib-secteur').textContent = (r.adresse || adresse || s?.nom || '') + ' · ' + surface + ' m² · ' + pieces + (pieces > 1 ? ' pièces' : ' pièce')
    $('#rsai-valeur').textContent = euro(r.valeur)
    $('#rsai-fourchette').textContent = `Fourchette ${r.confiance || '85 %'} : ${euro(r.basse)} — ${euro(r.haute)}`
    const place = Math.min(96, Math.max(4, (100 * (r.valeur - r.basse)) / (r.haute - r.basse)))
    $('#rsai-curseur-ci').style.left = place + '%'
    $('#rsai-ci-bas').textContent = euro(r.basse)
    $('#rsai-ci-haut').textContent = euro(r.haute)

    $('#rsai-m2').textContent = nb(r.prix_m2)
    if (avecSecteur) {
      $('#rsai-med').textContent = nb(s.med)
      const e = Math.round(100 * (r.prix_m2 / s.med - 1))
      $('#rsai-ecart').textContent = (e > 0 ? '+' : '') + e + ' %'
    }

    $('#rsai-anneau').innerHTML = anneau(r.fiabilite)
    $('#rsai-src-modele').innerHTML = `<span class="puce">${r.modele === 'ml' ? 'Modèle ML' : 'Médiane DVF communale'}</span>`
    const val = modelInfo?.validation
    $('#rsai-fiab-txt').innerHTML =
      (r.mape != null
        ? `Sur ce secteur, le modèle se trompe en moyenne de <b>${String(r.mape).replace('.', ',')} %</b>${r.mape_n ? `, mesuré sur <b>${nb(r.mape_n)}</b> ventes de contrôle` : ''}.`
        : val
          ? `Erreur moyenne du modèle, mesurée sur ${nb(val.n_test)} ventes jamais vues (${periode(val.periode_test)}) : <b>${String(val.mape).replace('.', ',')} %</b>. ${String(val.dans_10pct).replace('.', ',')} % des estimations tombent à moins de 10 % du prix réel, ${String(val.dans_20pct).replace('.', ',')} % à moins de 20 %.`
          : '') +
      (r.meta?.n_transactions ? `<br>Secteur documenté par <b>${nb(r.meta.n_transactions)}</b> transactions.` : '')

    if (avecSecteur) afficherSecteur(r, s)

    $('#rsai-detail').innerHTML = `<tr><td>Prix au m² estimé</td><td class="n">${nb(r.prix_m2)} €</td></tr>
       ${avecSecteur ? `<tr><td>Médiane du secteur, ${s.annee}</td><td class="n">${nb(s.med)} €/m²</td></tr>` : ''}
       <tr><td>Surface retenue</td><td class="n">${surface} m²</td></tr>
       <tr><td>Modèle</td><td class="n">${r.modele === 'ml' ? `LightGBM${modelInfo?.nFeatures ? ` · ${modelInfo.nFeatures} variables` : ''}` : 'Médiane des ventes comparables'}</td></tr>
       <tr><td><em style="font-size:17px">Valeur estimée</em></td><td class="n"><b>${euro(r.valeur)}</b></td></tr>`
    afficherTechnique(r)
    dernierBien = { commune: s?.nom || selecteur.value || null, code_commune: s?.code || null,
                    departement: s?.code ? s.code.slice(0, 2) : null, secteur: s?.code || null,
                    prix: Math.round(r.valeur), r, s, adresse, surface, pieces, type }
  }

  function afficherSecteur(r, s) {
    $('#rsai-volume').innerHTML = `<span class="puce claire">${nb(s.n)} ventes</span>`
    const pos = Math.min(100, Math.max(0, (100 * (r.prix_m2 - s.p10)) / (s.p90 - s.p10)))
    $('#rsai-curseur').style.left = pos + '%'
    $('#rsai-bas').textContent = '1ᵉʳ décile · ' + nb(s.p10) + ' €/m²'
    $('#rsai-haut-d').textContent = '9ᵉ décile · ' + nb(s.p90) + ' €/m²'

    const dernier = s.eco.length - 1
    const v = 100 * (s.eco[dernier] / s.eco[0] - 1)
    $('#rsai-tendance').innerHTML = `<span class="puce">${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')} %</span>`
    $('#rsai-courbe').innerHTML = courbe(s.eco, s.annees)

    // Projection de plus-value à 10 ans, scénario central (tendance observée
    // du secteur), pour amorcer le lien vers le simulateur dédié.
    const tendance = Math.pow(s.eco[dernier] / s.eco[0], 1 / (s.annees[dernier] - s.annees[0])) - 1
    const revente10 = r.valeur * Math.pow(1 + tendance, 10)
    const pv10 = revente10 - r.valeur
    $('#rsai-pv-resume').innerHTML =
      `Au rythme observé sur ce secteur depuis ${s.annees[0]} (<b>${tendance >= 0 ? '+' : ''}${(100 * tendance).toFixed(1).replace('.', ',')} %/an</b>), ` +
      `ce bien pourrait valoir <b>${euro(revente10)}</b> dans 10 ans, soit ${pv10 >= 0 ? 'une plus-value brute de' : 'une moins-value de'} <b>${euro(Math.abs(pv10))}</b> avant fiscalité.`

  }

  function afficherTechnique(r) {
    // Détails techniques — repris de l'ancien frontend (ResultPanel.jsx).
    // Uniquement des valeurs servies par le backend : une ligne sans donnée
    // est omise plutôt que remplie par un chiffre écrit en dur.
    const mi = modelInfo || {}

    const tech = []
    tech.push(['Méthode', r.modele === 'ml' ? 'LightGBM géolocalisé · API BAN' : 'Médiane DVF communale'])
    if (r.adresse) tech.push(['Adresse normalisée (BAN)', r.adresse])
    if (r.mape != null) tech.push([`Erreur moyenne locale${r.mape_n ? ` (${nb(r.mape_n)} ventes)` : ''}`, `${String(r.mape).replace('.', ',')} %`])
    if (mi.validation) tech.push([`Erreur moyenne validée (${periode(mi.validation.periode_test)})`, `${String(mi.validation.mape).replace('.', ',')} %`])
    tech.push(['Fourchette', r.modele === 'ml' ? `Intervalle à ${r.confiance || '85 %'}, calibré sur des ventes de contrôle`
      : 'Dispersion des ventes comparables de la commune'])
    if (mi.nFeatures) tech.push(['Variables', String(mi.nFeatures)])
    if (mi.trainedAt) tech.push(['Entraîné le', new Date(mi.trainedAt).toLocaleDateString('fr-FR')])
    if (mi.nTrain) tech.push(["Données d'entraînement", `${nb(mi.nTrain)} transactions DVF 2021–2025`])
    if (mi.validation) tech.push(['Données de test', `${nb(mi.validation.n_test)} ventes jamais vues, ${periode(mi.validation.periode_test)}`])
    if (r.modele !== 'ml' && r.meta?.n_transactions) tech.push(['Transactions comparables', `${nb(r.meta.n_transactions)} ventes`])
    $('#rsai-detail-tech').innerHTML = tech.map(([l, v]) => `<tr><td>${l}</td><td class="n">${v}</td></tr>`).join('')

  }

  function anneau(f) {
    if (f == null) return ''
    const R = 44, C = 2 * Math.PI * R, part = C * Math.min(1, Math.max(0, f))
    const couleur = f >= 0.8 ? 'var(--vert)' : f >= 0.6 ? 'var(--ambre)' : 'var(--rouge)'
    return `<svg viewBox="0 0 110 110" style="width:110px;display:block" role="img" aria-label="Fiabilité de l'estimation">
      <circle cx="55" cy="55" r="${R}" fill="none" stroke="var(--fond)" stroke-width="11"/>
      <circle cx="55" cy="55" r="${R}" fill="none" stroke="${couleur}" stroke-width="11" stroke-linecap="round"
        stroke-dasharray="${part} ${C - part}" transform="rotate(-90 55 55)"/>
      <text x="55" y="58" text-anchor="middle" font-size="26" font-style="italic" font-family="Instrument Serif,serif" fill="var(--encre)">${Math.round(f * 100)}</text>
      <text x="55" y="73" text-anchor="middle" font-size="9" font-family="Inter,sans-serif" fill="var(--gris)">FIABILITÉ</text></svg>`
  }

  function courbe(val, annees) {
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
        <text x="${x(i)}" y="${H - 2}" text-anchor="middle" font-size="10.5" font-family="Inter,sans-serif" fill="var(--gris)">${annees[i]}</text>`).join('')}</svg>`
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

  let ordre = []
  const vignettes = [heroTour, heroVilla, heroBois, heroInterieur]
  let affiches = 0
  async function chargerSecteursApi() {
    try {
      const r = await fetch(API.BASE + API.SECTEURS, { signal: AbortSignal.timeout(8000) })
      const liste = r.ok ? await r.json() : []
      if (!actif) return
      if (!Array.isArray(liste) || !liste.length) throw new Error('vide')
      ordre = liste.map((s) => [s.code, avecAnnees(s)]).filter(([, s]) => s.eco.length >= 2)
      $('#rsai-marche-etat').hidden = true
      $('#rsai-charger').hidden = false
      chargerSecteurs()
    } catch {
      $('#rsai-marche-etat').textContent = 'Statistiques de marché indisponibles pour le moment.'
    }
  }
  function chargerSecteurs() {
    const grille = $('#rsai-grille-marche')
    ordre.slice(affiches, affiches + 8).forEach(([code, s], i) => {
      const v = 100 * (s.eco[s.eco.length - 1] / s.eco[0] - 1)
      const b = document.createElement('button'); b.className = 'bien'; b.type = 'button'
      b.innerHTML = `<div class="carte-img"><div class="illus">${vignettes[(affiches + i) % 4]()}</div></div>
        <div class="prix">${nb(s.med)} €/m² · médiane</div><h4>${s.nom}</h4>
        <div class="puces"><span class="puce">${nb(s.n)} ventes</span>
          <span class="puce">${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')} % depuis ${s.annees[0]}</span></div>`
      b.addEventListener('click', () => {
        if ([...selecteur.options].some((o) => o.value === s.nom)) selecteur.value = s.nom
        $('#rsai-adresse').value = ''; estimer(true)
      })
      grille.appendChild(b)
    })
    affiches += 8
    if (affiches >= ordre.length) $('#rsai-charger').hidden = true
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
  // Estimation uniquement sur demande (bouton « Estimer » ou carte de secteur) :
  // modifier un champ ne relance rien, et rien n'est estimé à l'ouverture.

  // Préremplissage depuis un lien partagé.
  const params = new URLSearchParams(window.location.search)
  if (params.get('area_m2')) $('#rsai-surface').value = params.get('area_m2')
  if (params.get('rooms')) $('#rsai-pieces').value = params.get('rooms')
  if (params.get('type')) $('#rsai-type').value = params.get('type')
  if (params.get('address')) $('#rsai-adresse').value = params.get('address')
  if (params.get('commune')) communeDemandee = params.get('commune')
  if ([...params.keys()].length) window.history.replaceState({}, '', window.location.pathname)

  verifierApi(); chargerSecteursApi()

  return () => { actif = false }
}
