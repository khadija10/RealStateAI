// Page "Estimation" — reprise quasi verbatim de l'artefact Claude Design
// (https://claude.ai/artifact/A9YV2PZHfG1rWQh1GTccSo), rebranchée sur le
// vrai backend FastAPI (estimation ML, communes, santé de l'API).
import { heroEstimation } from './illustrations-vanilla.js'
import { scenariosMarche, tendanceSecteur, chargerCorrection } from './scenarios.js'
import { precisionDe } from './precision.js'

export const html = `
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
        <div style="min-width:0;flex:1;position:relative"><label for="rsai-adresse" title="Une adresse précise donne l'estimation la plus fine ; une commune seule donne la médiane des ventes comparables">Adresse ou commune</label>
          <input id="rsai-adresse" type="text" placeholder="12 rue de la Paix, Paris — ou une commune" autocomplete="off"
            role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="rsai-suggestions">
          <input id="rsai-cp" type="hidden">
          <input id="rsai-secteur" type="hidden">
          <ul class="suggestions" id="rsai-suggestions" role="listbox" hidden></ul></div>
      </div>
      <div class="critere">
        <div class="pic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/></svg></div>
        <div style="flex:1"><label for="rsai-type">Type de bien</label>
          <select id="rsai-type"><option value="apartment">Appartement</option><option value="house">Maison</option><option value="other">Autre</option></select></div>
      </div>
      <div class="critere">
        <div class="pic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 21h18M6 21V8l6-4 6 4v13"/></svg></div>
        <div style="flex:1"><span class="lib-champ">Surface et pièces</span>
          <div class="surface-pieces">
            <label class="unite"><input id="rsai-surface" type="number" inputmode="decimal" placeholder="58" min="9" max="400" aria-label="Surface en m²"><span>m²</span></label>
            <label class="unite"><input id="rsai-pieces" type="number" inputmode="numeric" placeholder="3" min="1" max="12" aria-label="Nombre de pièces"><span>pièces</span></label>
          </div></div>
      </div>
      <button type="submit" class="estimer" id="rsai-bouton">Estimer</button>
    </div>
  </form>
</section>

<details class="affiner" id="rsai-affiner">
  <summary class="affiner-tete"><h3 id="rsai-affiner-titre">Affiner <em>l'estimation</em></h3>
    <span>Facultatif · classe DPE, année de construction</span></summary>
  <div class="affiner-champs">
    <div class="champ"><span class="champ-lib">Classe DPE</span>
      <div class="dpe-choix" id="rsai-dpe" role="group" aria-label="Classe DPE">
        ${'ABCDEFG'.split('').map((c) => `<button type="button" class="dpe-${c}" data-dpe="${c}" aria-pressed="false">${c}</button>`).join('')}
      </div></div>
    <div class="champ"><label for="rsai-annee">Année de construction</label>
      <input id="rsai-annee" type="number" min="1800" max="2026" placeholder="ex. 1975"></div>
  </div>
  <p class="aide">Inutile si vous ne les connaissez pas : le diagnostic énergétique du logement est retrouvé
    automatiquement à son adresse dans la base de l'ADEME. Indiquez la classe seulement si elle diffère.</p>
  <button type="button" class="estimer secondaire" id="rsai-estimer-affine" hidden>Mettre à jour l'estimation</button>
</details>


<section class="manifeste" id="rsai-manifeste">
  <div class="etiq">Notre approche</div>
  <div>
    <h2>Un modèle entraîné sur <em>toutes</em> les ventes notariées d'Île-de-France,
      et dont nous publions <em>l'erreur réelle</em>, quartier par quartier.</h2>
    <div class="stats">
      <div class="stat"><b id="rsai-stat-ventes">—</b><span>Ventes notariées analysées</span></div>
      <div class="stat"><b>4</b><span>Sources publiques croisées : ventes, DPE, quartier, bâtiment</span></div>
      <div class="stat"><b id="rsai-stat-mape">—</b><span id="rsai-stat-mape-lib">Écart moyen avec le prix de vente réel</span></div>
      <div class="stat"><b id="rsai-stat-20">—</b><span>Estimations à moins de 20 % du prix réel</span></div>
    </div>
  </div>
</section>

<h2 class="titre-section" id="rsai-resultat">Votre <em>estimation</em></h2>
<p class="sous" id="rsai-attente">Renseignez l'adresse du bien (ou son secteur), sa surface et son nombre
  de pièces, puis cliquez sur « Estimer ».</p>
<section id="rsai-bloc-resultat" hidden>
  <div class="res-grille">
    <article class="res-carte res-prix bloc-resume">
      <p class="surtitre">Valeur estimée</p>
      <div class="lib" id="rsai-lib-secteur">Estimation</div>
      <div class="valeur" id="rsai-valeur">—</div>
      <div class="fourchette" id="rsai-fourchette"></div>
      <div id="rsai-alertes"></div>
      <div class="jauge-ci"><i id="rsai-curseur-ci" style="left:50%"></i></div>
      <div class="bornes-ci"><span id="rsai-ci-bas"></span><span id="rsai-ci-haut"></span></div>
      <div class="mesures">
        <div class="mesure"><b id="rsai-m2">—</b><span>€ par m²</span></div>
        <div class="mesure" data-secteur><b id="rsai-med">—</b><span>Prix médian de la commune</span></div>
        <div class="mesure" data-secteur><b id="rsai-ecart">—</b><span id="rsai-ecart-lib">par rapport à la médiane</span></div>
      </div>
      <p class="horodatage" id="rsai-calcule"></p>
    </article>
    <div class="res-colonne">
      <article class="res-carte">
        <div class="bloc-tete"><p class="surtitre">Fiabilité</p><span id="rsai-src-modele"></span></div>
        <div class="fiab">
          <div id="rsai-precision"></div>
          <div class="fiab-txt"><p class="classe-fiab" id="rsai-classe-fiab"></p><p id="rsai-fiab-txt"></p></div>
        </div>
      </article>
      <article class="res-carte" id="rsai-bloc-dpe" hidden>
        <div class="bloc-tete"><p class="surtitre">Performance énergétique</p><span id="rsai-dpe-source"></span></div>
        <div id="rsai-dpe-contenu"></div>
      </article>
    </div>
    <article class="res-carte res-large" id="rsai-bloc-comparables" hidden>
      <div class="bloc-tete"><p class="surtitre">Ventes dans l'immeuble</p><span>ventes notariées</span></div>
      <table class="comparables"><thead><tr><th>Date</th><th>Surface</th><th>Pièces</th><th>Prix</th><th>€/m² à la vente</th><th id="rsai-th-actuel">€/m² actualisé</th></tr></thead>
        <tbody id="rsai-comparables"></tbody></table>
      <p class="fiab-txt" id="rsai-immeuble-ref"></p>
    </article>
    <article class="res-carte res-large" id="rsai-bloc-proximite" hidden>
      <div class="bloc-tete"><p class="surtitre">Ventes similaires à proximité</p><span id="rsai-proximite-lib"></span></div>
      <table class="comparables"><thead><tr><th>Date</th><th>Adresse</th><th>Distance</th><th>Surface</th><th>Pièces</th><th>Prix</th><th id="rsai-th-prox">€/m² actualisé</th></tr></thead>
        <tbody id="rsai-proximite"></tbody></table>
      <p class="fiab-txt" id="rsai-proximite-ref"></p>
    </article>
    <article class="res-carte res-large" data-secteur>
      <div class="bloc-tete"><p class="surtitre">Valeur dans 10 ans</p><span>scénarios, pas des prévisions</span></div>
      <div class="dix-ans" id="rsai-dix-ans"></div>
      <p class="source" id="rsai-dix-ans-source"></p>
    </article>
    <article class="res-carte res-moitie" data-secteur>
      <div class="bloc-tete"><p class="surtitre">Position dans la commune</p><span id="rsai-volume"></span></div>
      <div class="reglette"><b class="repere-med" id="rsai-repere-med"></b><i id="rsai-curseur" style="left:50%"></i></div>
      <div class="bornes"><span id="rsai-bas"></span><span id="rsai-haut-d"></span></div>
      <p class="position-txt" id="rsai-position-txt"></p>
      <dl class="chiffres-secteur" id="rsai-chiffres-secteur"></dl>
    </article>
    <article class="res-carte res-moitie" data-secteur>
      <div class="bloc-tete"><p class="surtitre">Évolution depuis 2021</p><span id="rsai-tendance"></span></div>
      <div id="rsai-courbe"></div>
      <p class="fiab-txt" id="rsai-courbe-note"></p>
    </article>
    <article class="res-carte res-large">
      <div class="bloc-tete"><p class="surtitre">À vérifier lors de la visite</p><span>non décrit par les ventes notariées</span></div>
      <ul class="a-verifier">
        <li>Étage et ascenseur</li><li>Balcon, terrasse, jardin</li><li>Parking, box, cave</li>
        <li>État, travaux</li><li>Surface Carrez</li>
      </ul>
    </article>
    <article class="res-carte res-large">
      <details class="methodo">
        <summary><p class="surtitre">Méthodologie et détail du calcul</p></summary>
        <div class="methodo-grille" id="rsai-methodo"></div>
      </details>
    </article>
  </div>

  <div class="ensuite">
    <div class="ensuite-tete">
      <h3>Et <em>maintenant</em> ?</h3>
      <div class="ensuite-actions">
        <button type="button" class="bouton-neutre petit" id="rsai-pdf">Exporter l'estimation</button>
        <button type="button" class="bouton-neutre petit" id="rsai-partager">Copier le lien</button>
      </div>
    </div>
    <div class="ensuite-grille">
      <button type="button" class="ensuite-carte" id="rsai-fin-voir"><span class="ensuite-icone" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/></svg></span>
        <b>Financer ce bien</b><span>Mensualité, normes des banques, acheter ou louer.</span><em>Simuler le financement →</em></button>
      <button type="button" class="ensuite-carte" id="rsai-pv-voir"><span class="ensuite-icone" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/></svg></span>
        <b>Anticiper la revente</b><span>Trois scénarios de marché et la fiscalité 2026.</span><em>Simuler la plus-value →</em></button>
      <button type="button" class="ensuite-carte" id="rsai-carte-voir"><span class="ensuite-icone" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg></span>
        <b>Situer sur la carte</b><span>Comparer avec les prix des communes voisines.</span><em>Voir la carte des prix →</em></button>
      <button type="button" class="ensuite-carte" id="rsai-histo-voir"><span class="ensuite-icone" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg></span>
        <b>Retrouver vos estimations</b><span>Chaque bien, son évolution et ses simulations.</span><em>Ouvrir l'historique →</em></button>
    </div>
  </div>
</section>



`

const ANNEES = [2021, 2022, 2023, 2024, 2025]
const euro = (n) => Math.round(n).toLocaleString('fr-FR') + ' €'
const nb = (n) => Math.round(n).toLocaleString('fr-FR')

const TYPE_LABEL = { apartment: 'Appartement', house: 'Maison', other: 'Autre' }

// Montants arrondis au millier : afficher un prix à l'euro près, avec une
// fourchette de plusieurs dizaines de milliers d'euros, suggère une fausse précision.
const rond = (x) => Math.round(x / 1000) * 1000
// Erreurs et écarts : toujours arrondis à l'unité, partout (carte, méthodologie,
// alertes, fiche exportée), pour qu'un même secteur n'affiche qu'un seul chiffre.
const pctRond = (x) => `${Math.round(x)} %`

// Segments où le modèle se trompe plus que sa moyenne (test officiel), en clair
const PHRASES_SEGMENT = {
  sans_vente_immeuble: 'Aucune vente récente dans cet immeuble',
  dpe_inconnu: 'Diagnostic énergétique introuvable à cette adresse',
  petite_surface: 'Petite surface (moins de 30 m²)',
  grande_surface: 'Grande surface (100 m² ou plus)',
  maison: 'Maison',
  paris: 'Bien à Paris',
}

// Médiane annuelle calculée sur peu de ventes : signalée comme fragile
const VENTES_MIN_ANNEE = 30

// Reventes de l'immeuble (les ventes sur plan portent la prime du neuf)
const reventesImmeuble = (r) => (r.comparables || []).filter((c) => !c.vefa).length
const sansAccents = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[-']/g, ' ').trim()

// « notre estimation est 11 % en dessous » : même phrase que la page
function ecartRef(valeur, reference) {
  const e = Math.round(100 * (valeur / reference - 1))
  return Math.abs(e) <= 5 ? 'au niveau de notre estimation.' : `notre estimation est ${Math.abs(e)} % ${e > 0 ? 'au-dessus' : 'en dessous'}.`
}

/** Fiche imprimable — même principe que l'ancien frontend (fenêtre + print()). */
function exporterPDF(bien, modelInfo, correction, w) {
  if (!bien || !w) return
  const { r, s, adresse, surface, pieces, type } = bien
  const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const fr = (x, d = 1) => Number(x).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })
  const maintenant = new Date()
  const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(maintenant)
  const moisAn = (iso) => { const d = new Date(iso); return isNaN(d) ? esc(iso) : d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }
  const lieu = esc(r.adresse || adresse || s?.nom || '')
  const ref = `RSAI-${maintenant.getFullYear()}-${String(r.historiqueId || Math.floor(maintenant / 1000) % 100000).padStart(5, '0')}`
  const val = modelInfo?.validation
  const ml = r.modele === 'ml'
  const place = Math.min(96, Math.max(4, (100 * (r.valeur - r.basse)) / (r.haute - r.basse)))
  const prec = precisionDe(r, modelInfo?.largeurs)

  // Marché du secteur : médiane, position du bien entre 1er et 9e décile, évolution
  const avecSecteur = !!(s && s.med)
  const ecart = avecSecteur ? Math.round(100 * (r.prix_m2 / s.med - 1)) : null
  const posDecile = avecSecteur && s.p10 && s.p90 ? Math.min(98, Math.max(2, (100 * (r.prix_m2 - s.p10)) / (s.p90 - s.p10))) : null
  const evo = avecSecteur && s.eco?.length >= 2 ? 100 * (s.eco[s.eco.length - 1] / s.eco[0] - 1) : null
  // Même rang approximatif que la page (interpolation entre 1er et 9e décile)
  const rang = posDecile != null ? Math.round(Math.min(97, Math.max(3, 10 + (80 * (r.prix_m2 - s.p10)) / (s.p90 - s.p10)))) : null
  const signe = (x) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${fr(Math.abs(x))}`
  const marge = rond((r.haute - r.basse) / 2)
  const sc = scenariosMarche(correction)

  // Points d'attention : les mêmes que sur la page
  const attention = []
  if (r.sansNumero && ml) attention.push("Adresse sans numéro : l'immeuble n'est pas identifié, ses ventes et son DPE ne sont pas pris en compte.")
  if (r.alerteGeo) attention.push(esc(r.alerteGeo))
  if (r.segments?.length && ml) attention.push('Estimation moins précise pour ce type de bien : ' + r.segments.map((x) => `${esc(PHRASES_SEGMENT[x.segment] || x.libelle).toLowerCase()} (écart moyen ${pctRond(x.mape)})`).join(' ; ') + '.')
  if (['F', 'G'].includes(r.dpeClasse)) attention.push(`Passoire thermique (classe ${r.dpeClasse}) : décote à la vente et location ${r.dpeClasse === 'G' ? 'interdite depuis 2025' : 'interdite à partir de 2028'}.`)
  if (!ml) attention.push("Estimation sans adresse précise : médiane des ventes comparables de la commune, sans le modèle.")

  const dpe = r.dpeClasse
    ? `${r.dpeClasse}${r.dpeSource === 'adresse' ? ` · retrouvé à l'adresse (ADEME${r.dpeDate ? `, diagnostic du ${new Date(r.dpeDate).toLocaleDateString('fr-FR')}` : ''})` : r.dpeSource === 'saisi' || !r.dpeSource ? ' · déclaré' : ''}`
    : 'non trouvé'

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Estimation ${ref}</title>
<style>
  @page{size:A4;margin:0}
  html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  *{box-sizing:border-box}
  body{font:13px/1.45 "Helvetica Neue",Arial,sans-serif;color:#1b1916;margin:0 auto;max-width:760px;padding:28px 24px}
  .tete{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1b1916;padding-bottom:10px}
  .marque{font-size:20px;font-weight:700;letter-spacing:-.02em}.marque i{color:#9C6A26;font-weight:400}
  .tete small{display:block;color:#6b655d;font-size:11px;letter-spacing:.08em;text-transform:uppercase}
  .tete .ref{text-align:right;font-size:11.5px;color:#6b655d}
  h1{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#6b655d;margin:22px 0 2px;font-weight:600}
  .lieu{font-size:19px;font-weight:600;margin:0}
  .desc{color:#4a453f;margin:2px 0 0}
  .prix{display:grid;grid-template-columns:1.25fr 1fr;gap:18px;margin-top:16px;align-items:stretch}
  .carte{border:1px solid #e3ded6;border-radius:10px;padding:14px 16px}
  .valeur{font-size:38px;font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1.05}
  .m2{color:#4a453f;margin-top:2px}
  .barre{position:relative;height:6px;border-radius:3px;background:linear-gradient(90deg,#e8e1d6,#9C6A26,#e8e1d6);margin:16px 0 4px}
  .barre b{position:absolute;top:-5px;width:3px;height:16px;background:#1b1916;border-radius:2px}
  .bornes{display:flex;justify-content:space-between;font-variant-numeric:tabular-nums;font-weight:600}
  .note{font-size:11.5px;color:#6b655d;margin-top:6px}
  .fiab .classe{display:inline-block;padding:2px 10px;border-radius:999px;font-weight:600;font-size:12px;background:#f3ead9;color:#7a5113}
  .fiab .classe.vert{background:#e3f2e6;color:#1f6b35}.fiab .classe.rouge{background:#f8e3df;color:#9a3a26}
  .fiab p{margin:8px 0 0}
  h2{font-size:14px;margin:22px 0 8px;padding-bottom:5px;border-bottom:1px solid #e3ded6}
  table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
  td,th{padding:6px 0;border-bottom:1px solid #efeae3;text-align:left;vertical-align:top}
  th{font-size:11px;color:#6b655d;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
  td.n,th.n{text-align:right}
  .deux{display:grid;grid-template-columns:1fr 1fr;gap:22px}
  .reglette{position:relative;height:6px;border-radius:3px;background:linear-gradient(90deg,#e8e1d6,#5b4b3c);margin:12px 0 4px}
  .reglette b{position:absolute;top:-5px;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:#fff;border:3px solid #1b1916}
  .att{background:#faf3e7;border-left:3px solid #c2893a;padding:8px 12px;margin:0 0 6px;border-radius:0 6px 6px 0}
  .vide{color:#6b655d;font-style:italic}
  .fiab-chiffres{display:flex;gap:22px;margin:8px 0 6px}
  .fiab-chiffres .gros{display:block;font-size:22px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  .fiab-chiffres small{font-size:11px;color:#6b655d}
  .classe.ambre,.classe:not(.vert):not(.rouge){background:#f3ead9;color:#7a5113}
  .leger{font-weight:400;color:#6b655d;font-size:12px}
  .tuiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  .tuile{border:1px solid #e3ded6;border-radius:10px;padding:8px 12px;text-align:center}
  .tuile.central{border-color:#1b1916}
  .tuile b{display:block;font-size:18px;font-variant-numeric:tabular-nums}.tuile span{font-size:11.5px;color:#6b655d}
  .verif{margin:0;color:#4a453f}
  .pied{margin-top:22px;padding-top:10px;border-top:1px solid #e3ded6;font-size:10.5px;color:#6b655d}
  .imprimer{position:fixed;top:14px;right:14px;padding:8px 16px;border:0;border-radius:999px;background:#9C6A26;color:#fff;font:600 13px Arial;cursor:pointer}
  @media print{.imprimer{display:none}body{max-width:none;padding:8mm 13mm 6mm;font-size:11.5px;line-height:1.34}
    h1{margin-top:12px}.prix{margin-top:10px;gap:14px}.carte{padding:10px 14px}.valeur{font-size:32px}
    h2{margin:11px 0 4px;padding-bottom:3px}td,th{padding:3.5px 0}.note{margin-top:4px}
    .tuile{padding:5px 10px}.tuile b{font-size:16px}.fiab-chiffres{margin:4px 0}.fiab-chiffres .gros{font-size:19px}
    .fiab p{margin:5px 0 0}.pied{margin-top:12px}.reglette{margin:8px 0 3px}}
</style></head><body>
<button class="imprimer" onclick="window.print()">Enregistrer en PDF</button>
<div class="tete">
  <div><div class="marque">RealState<i>AI</i></div><small>Estimation immobilière · Île-de-France</small></div>
  <div class="ref">Estimation indicative<br>Réf. ${ref}<br>${date}</div>
</div>

<h1>Le bien</h1>
<p class="lieu">${lieu}</p>
<p class="desc">${TYPE_LABEL[type] || 'Bien'} · ${surface} m² · ${pieces} pièce${pieces > 1 ? 's' : ''}${r.annee ? ` · construit en ${r.annee}` : ''} · DPE ${dpe}</p>

<div class="prix">
  <div class="carte">
    <div class="valeur">environ ${euro(rond(r.valeur))}</div>
    <div class="m2">soit <b>${euro(r.prix_m2)} / m²</b>${ecart != null ? ` · ${ecart > 0 ? '+' : ''}${ecart} % par rapport au prix médian de la commune` : ''}</div>
    <div class="barre"><b style="left:${place}%"></b></div>
    <div class="bornes"><span>${euro(rond(r.basse))}</span><span>${euro(rond(r.haute))}</span></div>
    <div class="note">${ml && val?.fourchette ? `Le prix de vente réel tombe dans cette fourchette 85 fois sur 100 (vérifié sur ${fr(val.n_test, 0)} ventes récentes : ${fr(val.fourchette.couverture)} %).` : 'Fourchette des ventes comparables de la commune.'}</div>
  </div>
  <div class="carte fiab">
    <b>Fiabilité</b>
    <div class="fiab-chiffres">
      <div><span class="gros">± ${euro(marge)}</span><small>marge de prix (± ${Math.round(prec?.demi ?? 0)} %)</small></div>
      ${r.fiabilite != null ? `<div><span class="gros">${Math.round(r.fiabilite * 100)} %</span><small>fiabilité locale</small></div>` : ''}
    </div>
    ${prec?.titre ? `<span class="classe ${prec.ton}">${prec.titre}</span>` : ''}
    ${r.mape != null ? `<p>Écart moyen de <b>${pctRond(r.mape)}</b> avec le prix réel dans la commune${r.mape_n ? ` (${fr(r.mape_n, 0)} ventes vérifiées)` : ''}.</p>` : ''}
    ${val ? `<p>Île-de-France : écart moyen ${pctRond(val.mape)}, ${pctRond(val.dans_20pct)} des estimations à moins de 20 % du prix réel.</p>` : ''}
  </div>
</div>

${r.comparables?.length ? `<h2>Ventes dans l'immeuble</h2>
<table><tr><th>Date</th><th class="n">Surface</th><th class="n">Pièces</th><th class="n">Prix</th><th class="n">€/m² à la vente</th><th class="n">€/m² actualisé ${r.immeuble?.annee || ''}</th></tr>
${r.comparables.map((c) => `<tr><td>${moisAn(c.date)}${c.vefa ? ' <i>(neuf, sur plan)</i>' : ''}</td><td class="n">${c.surface_m2} m²</td><td class="n">${c.nb_pieces ?? '—'}</td><td class="n">${euro(c.prix)}</td><td class="n">${euro(c.prix_m2)}</td><td class="n"><b>${euro(c.prix_m2_aujourdhui)}</b></td></tr>`).join('')}</table>
${r.immeuble ? `<p class="note">Au prix ${r.immeuble.annee}, ces ventes donnent environ <b>${euro(r.immeuble.valeur)}</b> pour votre surface (médiane ${euro(r.immeuble.prix_m2)}/m²${r.immeuble.n_vefa ? ', hors neuf' : ''}) ; ${ecartRef(r.valeur, r.immeuble.valeur)}</p>` : ''}`
  : !(r.proximite?.ventes?.length) ? `<h2>Ventes dans l'immeuble</h2><p class="vide">Aucune vente récente enregistrée dans cet immeuble${r.sansNumero ? " (adresse sans numéro : immeuble non identifié)" : ''}.</p>` : ''}
${r.proximite?.ventes?.length && reventesImmeuble(r) < 3 ? `<h2>Ventes similaires à proximité${!r.comparables?.length ? ' <span class="leger">· aucune vente récente dans l\'immeuble</span>' : ''}</h2>
<table><tr><th>Date</th><th>Adresse</th><th class="n">Distance</th><th class="n">Surface</th><th class="n">Prix</th><th class="n">€/m² actualisé ${r.proximite.reference?.annee || ''}</th></tr>
${r.proximite.ventes.slice(0, 5).map((c) => `<tr><td>${moisAn(c.date)}</td><td>${esc(c.adresse || '—')}</td><td class="n">${c.distance_m} m</td><td class="n">${c.surface_m2} m²</td><td class="n">${euro(c.prix)}</td><td class="n"><b>${euro(c.prix_m2_aujourdhui)}</b></td></tr>`).join('')}</table>
<p class="note">${r.proximite.ventes.length > 5 ? `Les 5 plus proches sur ${r.proximite.ventes.length} reventes` : 'Reventes'} à moins de ${r.proximite.rayon_m < 1000 ? `${r.proximite.rayon_m} m` : '1 km'}, même type, surface à ±20 %, 24 derniers mois.${r.proximite.reference ? ` Au prix ${r.proximite.reference.annee}, elles donnent environ <b>${euro(r.proximite.reference.valeur)}</b> pour votre surface (médiane ${euro(r.proximite.reference.prix_m2)}/m²) ; ${ecartRef(r.valeur, r.proximite.reference.valeur)}` : ''}</p>` : ''}

${sc ? `<h2>Valeur dans 10 ans <span class="leger">· scénarios, pas des prévisions</span></h2>
<div class="tuiles">${sc.map((x, i) => `<div class="tuile${i === 1 ? ' central' : ''}"><b>${euro(rond(r.valeur * Math.pow(1 + x.taux, 10)))}</b><span>${x.court}</span></div>`).join('')}</div>
<p class="note">Baisse : ${esc(sc[0].detail.charAt(0).toLowerCase() + sc[0].detail.slice(1))}. Reprise : ${esc(sc[2].source)}.</p>` : ''}

${avecSecteur ? `<h2>La commune · ${esc(s.nom)}</h2>
<div class="deux">
  <div>
    <table>
      <tr><td>Prix médian ${s.annee || ''}</td><td class="n"><b>${euro(s.med)} / m²</b></td></tr>
      ${s.p10 && s.p90 ? `<tr><td>8 ventes sur 10 entre</td><td class="n">${euro(s.p10)} et ${euro(s.p90)} / m²</td></tr>` : ''}
      ${s.n ? `<tr><td>Ventes analysées</td><td class="n">${fr(s.n, 0)}</td></tr>` : ''}
      ${evo != null ? `<tr><td>Évolution ${s.annees?.[0] ?? 2021}–${s.annees?.[s.annees.length - 1] ?? 2025}</td><td class="n">${signe(evo)} %</td></tr>` : ''}
    </table>
  </div>
  <div>
    ${posDecile != null ? `<b>Position dans la commune</b>
    <p class="note" style="margin:4px 0 0">Plus cher qu'environ <b>${rang} %</b> des ventes de la commune en ${s.annee}.</p>
    <div class="reglette"><b style="left:${posDecile}%"></b></div>
    <div class="bornes" style="font-weight:400;font-size:11.5px;color:#6b655d"><span>moins cher</span><span>plus cher</span></div>` : ''}
  </div>
</div>` : ''}

<h2>À vérifier lors de la visite <span class="leger">· non décrit par les ventes notariées</span></h2>
<p class="verif">Étage et ascenseur · Balcon, terrasse, jardin · Parking, box, cave · État, travaux · Surface Carrez</p>

${attention.length ? `<h2>Points d'attention</h2>${attention.map((x) => `<p class="att">${x}</p>`).join('')}` : ''}

<h2>Méthode</h2>
<p style="margin:0">${ml
    ? `Modèle LightGBM${modelInfo?.nFeatures ? ` (${modelInfo.nFeatures} variables)` : ''} entraîné sur les ventes notariées DVF d'Île-de-France 2021–2025${modelInfo?.trainedAt ? `, le ${new Date(modelInfo.trainedAt).toLocaleDateString('fr-FR')}` : ''}. Erreur mesurée selon un protocole fixé avant le test, sur des ventes postérieures à l'entraînement.`
    : 'Médiane des ventes notariées DVF comparables de la commune (type, surface et pièces proches).'}</p>

<p class="pied">Estimation indicative, établie automatiquement à partir de données publiques, sans visite : ce n'est ni une expertise ni un avis de valeur d'agent, et elle n'a pas de valeur contractuelle. Sources : DVF (DGFiP, Etalab), DPE (ADEME), IRIS (INSEE), BDNB (CSTB).</p>
</body></html>`
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
  if (bien.codePostal) p.set('postal_code', bien.codePostal)
  if (bien.dpe) p.set('dpe', bien.dpe)
  if (bien.annee) p.set('year', bien.annee)
  return `${window.location.origin}${window.location.pathname}?${p.toString()}`
}

export function mount(root, { apiBase = '', onPlusValue, onFinancement, onEstime, demanderConnexion, relance, onCarte, onHistorique } = {}) {
  const API = {
    BASE: apiBase,
    COMMUNES: '/api/metadata/communes',
    ESTIMER: '/api/predictions/estimate',
    SANTE: '/api/health',
  }
  const $ = (sel) => root.querySelector(sel)
  const $$ = (sel) => root.querySelectorAll(sel)

  let dernierBien = null
  let modelInfo = null
  let courant = { dep: '', type: 'apartment' }   // département et type du bien affiché
  // Une réponse arrivée après le démontage de la page (React monte deux fois
  // en développement) ne doit rien écrire : sinon la grille se remplit en double.
  let actif = true
  $('#illus-heros').innerHTML = heroEstimation()

  // Communes servies par le backend, cherchables à la saisie (datalist) ; aucune présélection.
  const selecteur = $('#rsai-secteur')
  let communes = []
  let dpeChoisi = ''

  async function verifierApi() {
    const badge = $('#etat-api')
    try {
      const r = await fetch(API.BASE + API.SANTE, { signal: AbortSignal.timeout(5000) })
      const d = await r.json()
      if (!actif) return
      if (d.model_loaded || d.dvf_loaded) {
        // Service disponible : rien à signaler (le bandeau n'apparaît qu'en cas de problème)
        badge.hidden = true
        chargerCommunes()
      } else {
        badge.innerHTML = `<i></i><span>Estimation par adresse indisponible</span>`
      }
      modelInfo = {
        mape: d.model_mape, r2: d.model_r2, nFeatures: d.model_n_features,
        trainedAt: d.model_trained_at, nTrain: d.model_n_train,
        nVentes: d.n_rows, validation: d.model_validation, anneeMax: d.dvf_max_year,
        largeurs: d.model_largeurs?.demi_largeur_pct || null, largeursPeriode: d.model_largeurs?.periode || null,
      }
      afficherStats()
      if (dernierBien) afficher(dernierBien.r, dernierBien.s, dernierBien.adresse, dernierBien.surface, dernierBien.pieces, dernierBien.type)
    } catch {
      badge.innerHTML = `<i></i><span>Service momentanément indisponible</span>`
    }
  }

  // Chiffres de la section « Notre approche » : servis par le backend, jamais
  // écrits en dur — l'erreur affichée est celle de la validation officielle
  // (docs/protocole_evaluation.md), mesurée une fois sur un test jamais vu.
  function afficherStats() {
    const mi = modelInfo || {}, v = mi.validation
    if (mi.nVentes) $('#rsai-stat-ventes').textContent = nb(mi.nVentes)
    if (v) {
      $('#rsai-stat-mape').textContent = pctRond(v.mape)
      $('#rsai-stat-mape-lib').textContent = `Écart moyen avec le prix de vente réel, sur des ventes de ${periode(v.periode_test)}`
      $('#rsai-stat-20').textContent = pctRond(v.dans_20pct)
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
      const liste = Array.isArray(d) ? d.filter(Boolean) : Array.isArray(d?.communes) ? d.communes.filter(Boolean) : []
      if (!actif || !liste.length) return
      communes = liste
    } catch { /* recherche par adresse seule */ }
  }

  // Suggestions d'adresses pendant la saisie (API Adresse, comme l'ancien
  // formulaire) : choisir une suggestion fixe aussi le code postal.
  const champAdresse = $('#rsai-adresse'), liste = $('#rsai-suggestions')
  let suggestions = [], choix = -1, attente = null, requete = 0
  function fermerSuggestions() {
    clearTimeout(attente); requete += 1   // une réponse encore en route ne rouvrira pas la liste
    liste.hidden = true; champAdresse.setAttribute('aria-expanded', 'false'); choix = -1
  }
  function montrerSuggestions() {
    liste.innerHTML = suggestions.map((s, i) => `<li role="option" data-i="${i}" aria-selected="${i === choix}">
      <b>${s.name}</b><span>${s.commune ? 'Commune entière · médiane des ventes comparables' : `${s.postcode} ${s.city}`}</span></li>`).join('')
    liste.hidden = !suggestions.length
    champAdresse.setAttribute('aria-expanded', String(!!suggestions.length))
  }
  function choisir(s) {
    champAdresse.value = s.label
    $('#rsai-cp').value = s.postcode || ''
    selecteur.value = s.commune ? s.label : ''   // commune entière, ou adresse précise
    suggestions = []; fermerSuggestions()
  }
  // Communes du jeu de données dont le nom commence par la saisie
  function communesProches(q) {
    const n = sansAccents(q)
    if (/\d/.test(q) || n.length < 2) return []
    return communes.filter((c) => sansAccents(c).startsWith(n)).slice(0, 3)
      .map((c) => ({ label: c, name: c, commune: true }))
  }
  champAdresse.addEventListener('input', () => {
    $('#rsai-cp').value = ''   // adresse modifiée à la main : code postal à redéduire
    selecteur.value = ''
    clearTimeout(attente)
    const q = champAdresse.value.trim()
    if (q.length < 3) { suggestions = []; return fermerSuggestions() }
    attente = setTimeout(async () => {
      const numero = ++requete
      try {
        // La BAN cherche dans toute la France : on en demande plus et on ne garde
        // que l'Île-de-France, seul périmètre estimé par le modèle.
        const r = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=20&autocomplete=1`)
        const d = await r.json()
        if (!actif || numero !== requete || champAdresse.value.trim() !== q || document.activeElement !== champAdresse) return
        const proches = communesProches(q)
        // Une commune se choisit dans la liste des communes connues : on retire
        // les communes de la BAN, qui feraient doublon.
        const adresses = (d.features || []).filter((f) => /^(75|77|78|91|92|93|94|95)/.test(f.properties.postcode || '')
          && f.properties.type !== 'municipality')
          .slice(0, 6 - proches.length).map((f) => ({ label: f.properties.label, name: f.properties.name,
          postcode: f.properties.postcode || '', city: f.properties.city || '' }))
        suggestions = [...proches, ...adresses]
        choix = -1; montrerSuggestions()
      } catch {
        // BAN injoignable : les communes connues restent proposées
        suggestions = communesProches(q); choix = -1
        if (actif && numero === requete) montrerSuggestions()
      }
    }, 300)
  })
  champAdresse.addEventListener('keydown', (e) => {
    if (liste.hidden) return
    if (e.key === 'ArrowDown') { e.preventDefault(); choix = Math.min(choix + 1, suggestions.length - 1); montrerSuggestions() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); choix = Math.max(choix - 1, -1); montrerSuggestions() }
    else if (e.key === 'Enter' && choix >= 0) { e.preventDefault(); choisir(suggestions[choix]) }
    else if (e.key === 'Escape') fermerSuggestions()
  })
  liste.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li'); if (li) { e.preventDefault(); choisir(suggestions[+li.dataset.i]) }
  })
  champAdresse.addEventListener('blur', () => setTimeout(fermerSuggestions, 120))

  // Classe DPE : un bouton par classe, un second clic désélectionne
  function choisirDpe(c) {
    dpeChoisi = dpeChoisi === c ? '' : c
    root.querySelectorAll('[data-dpe]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.dpe === dpeChoisi)))
  }
  $('#rsai-dpe').addEventListener('click', (e) => { const b = e.target.closest('[data-dpe]'); if (b) choisirDpe(b.dataset.dpe) })

  function message(texte) {
    const m = $('#rsai-attente')
    m.textContent = texte; m.hidden = false
    $('#rsai-bloc-resultat').hidden = true
  }

  async function estimer(defiler) {
    fermerSuggestions()
    const surface = +$('#rsai-surface').value
    const pieces = +$('#rsai-pieces').value
    const type = $('#rsai-type').value
    const saisie = $('#rsai-adresse').value.trim()
    const communeSaisie = !/\d/.test(saisie) && communes.find((c) => sansAccents(c) === sansAccents(saisie))
    const commune = selecteur.value.trim() || communeSaisie || ''
    const adresse = commune ? '' : saisie
    const codePostal = $('#rsai-cp').value
    const annee = +$('#rsai-annee').value || null
    if (!adresse && !commune) return message("Indiquez l'adresse du bien, ou sa commune.")
    if (!surface || surface < 9) return message('Indiquez la surface du bien (9 m² minimum).')
    if (!pieces) return message('Indiquez le nombre de pièces.')
    if (annee && (annee < 1800 || annee > 2026)) return message("L'année de construction doit être comprise entre 1800 et 2026.")

    // Connexion demandée avant d'estimer, comme dans l'ancien frontend :
    // l'estimation reprend d'elle-même une fois connecté.
    let jeton = null
    try { jeton = localStorage.getItem('reai_token') } catch { /* ignore */ }
    if (!jeton && demanderConnexion) return demanderConnexion(() => estimer(true))

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
          postal_code: codePostal || undefined,
          dpe_classe: dpeChoisi || undefined,
          annee_construction: annee || undefined,
        }),
      })
      const d = await rep.json().catch(() => ({}))
      if (rep.ok) r = normaliser(d)
      else erreur = typeof d.detail === 'string' ? d.detail
        : Array.isArray(d.detail) ? d.detail.map((x) => x.msg).join(' ') : "L'estimation n'a pas abouti."
    } catch {
      erreur = 'Le service d\'estimation est injoignable. Réessayez dans un instant.'
    }
    bouton.disabled = false; bouton.textContent = 'Estimer'
    if (!actif) return
    if (!r) return message(erreur)

    afficher(r, r.secteur, adresse, surface, pieces, type)
    onEstime?.()
    if (defiler) $('#rsai-resultat').scrollIntoView({ behavior: 'smooth' })
  }

  function normaliser(d) {
    const ci = d.confidence_interval || {}
    return {
      valeur: d.predicted_price ?? d.estimated_price,
      prix_m2: d.price_per_m2,
      basse: ci.lower ?? d.price_range?.low,
      haute: ci.upper ?? d.price_range?.high,
      confiance: String(ci.confidence ?? '85%').replace(/\s?%/, ' %'),
      fiabilite: d.reliability,
      mape: d.local_mape, mape_n: d.local_mape_n,
      modele: d.model, adresse: d.meta?.adresse_normalisee,
      meta: d.meta, reel: true,
      secteur: d.secteur ? avecAnnees(d.secteur) : null,
      classe: d.classe_fiabilite || null,
      comparables: d.comparables_immeuble || [],
      dpeClasse: d.dpe_classe || null, annee: d.annee_construction || null,
      dpeTrouve: d.dpe_trouve, dpeSource: d.dpe_source || null, dpeDate: d.dpe_date || null,
      dpeAppariement: d.dpe_appariement || null, dpeZone: d.dpe_zone_fg_pct ?? null,
      alerteGeo: d.geocoding_warning || null, codePostal: d.code_postal || null,
      notes: d.meta?.notes || [],
      historiqueId: d.historique_id ?? null,
      segments: d.segments_difficiles || [],
      sansNumero: !!d.adresse_sans_numero,
      alerteType: d.alerte_type || null,
      immeuble: d.immeuble_reference || null,
      proximite: d.comparables_proximite || null,
      enregistreLe: null,
    }
  }

  // Médianes annuelles du backend : on garde l'année de chaque point, une
  // année sans vente ne devant pas décaler la courbe.
  function avecAnnees(s) {
    const points = (s.eco || []).map((v, i) => [ANNEES[i], v, s.n_an?.[i] ?? null]).filter(([, v]) => v != null)
    return { ...s, eco: points.map(([, v]) => v), annees: points.map(([a]) => a), nAn: points.map(([, , n]) => n) }
  }

  function afficher(r, s, adresse, surface, pieces, type) {
    $('#rsai-attente').hidden = true
    // la présentation laisse la place au résultat
    $('#rsai-manifeste').hidden = true
    $('#rsai-bloc-resultat').hidden = false
    const avecSecteur = !!(s && s.eco?.length >= 2)
    courant = { dep: s?.code || r.codePostal || $('#rsai-cp').value || '', type }
    $$('[data-secteur]').forEach((el) => { el.hidden = !avecSecteur })
    $('#rsai-lib-secteur').textContent = (r.adresse || adresse || s?.nom || '') + ' · ' + surface + ' m² · ' + pieces + (pieces > 1 ? ' pièces' : ' pièce')
    $('#rsai-valeur').textContent = euro(rond(r.valeur))
    $('#rsai-calcule').textContent = (r.enregistreLe ? 'Estimation enregistrée le ' : 'Calculée le ') +
      new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(r.enregistreLe ? new Date(r.enregistreLe) : new Date()) +
      (modelInfo?.anneeMax ? ` · ventes notariées jusqu'à fin ${modelInfo.anneeMax}` : '')
    $('#rsai-fourchette').innerHTML = `Entre <b>${euro(rond(r.basse))}</b> et <b>${euro(rond(r.haute))}</b>` +
      `<small>${r.modele === 'ml' ? `Le prix réel y tombe ${(r.confiance || '85 %').replace(' %', '')} fois sur 100.` : 'Fourchette des ventes comparables de la commune.'}</small>`
    const place = Math.min(96, Math.max(4, (100 * (r.valeur - r.basse)) / (r.haute - r.basse)))
    $('#rsai-curseur-ci').style.left = place + '%'
    $('#rsai-ci-bas').textContent = euro(rond(r.basse))
    $('#rsai-ci-haut').textContent = euro(rond(r.haute))

    $('#rsai-m2').textContent = nb(r.prix_m2)
    if (avecSecteur) {
      $('#rsai-med').textContent = nb(s.med)
      const e = Math.round(100 * (r.prix_m2 / s.med - 1))
      $('#rsai-ecart').textContent = (e > 0 ? '+' : '') + e + ' %'
      $('#rsai-ecart-lib').textContent = e > 0 ? 'plus cher que le prix médian de la commune' : e < 0 ? 'moins cher que le prix médian de la commune' : 'au prix médian de la commune'
    }

    afficherAlertes(r)
    afficherPrecision(r)
    afficherDpe(r)
    afficherComparables(r)
    afficherProximite(r)
    $('#rsai-estimer-affine').hidden = !!r.enregistreLe
    $('#rsai-src-modele').innerHTML = `<span class="puce claire">${r.modele === 'ml' ? 'Estimée pour ce logement' : 'Médiane des ventes de la commune'}</span>`
    $('#rsai-fiab-txt').innerHTML =
      // Fiabilité locale servie par le backend (reliability) : 100 − écart moyen
      // mesuré dans la commune pour une estimation à l'adresse ; volume et
      // homogénéité des ventes comparables pour une commune seule.
      (r.fiabilite != null ? `<span class="fiab-locale"><b>${Math.round(r.fiabilite * 100)} %</b> fiabilité locale</span>` : '') +
      (r.mape != null
        ? `<span class="source">Écart moyen de ${pctRond(r.mape)} avec le prix réel dans la commune${r.mape_n ? ` (${nb(r.mape_n)} ventes vérifiées)` : ''}.</span>`
        : r.meta?.n_transactions ? `<span class="source">Selon le nombre et l'homogénéité des ${nb(r.meta.n_transactions)} ventes comparables.</span>` : '')

    if (avecSecteur) afficherSecteur(r, s)

    afficherTechnique(r, [
      ['Prix au m² estimé', `${nb(r.prix_m2)} €`],
      ['Surface', `${surface} m²`],
      ...(avecSecteur ? [[`Prix médian de la commune ${s.annee}`, `${nb(s.med)} €/m²`]] : []),
    ])
    const cp = r.codePostal || $('#rsai-cp').value || null
    dernierBien = { commune: s?.nom || selecteur.value || null, code_commune: s?.code || null,
                    departement: s?.code ? s.code.slice(0, 2) : cp ? cp.slice(0, 2) : null, secteur: s?.code || null,
                    codePostal: cp, dpe: dpeChoisi || r.dpeClasse || null, annee: +$('#rsai-annee').value || null,
                    prix: rond(r.valeur), r, s, adresse, surface, pieces, type,
                    // ligne d'historique : les simulations faites sur ce bien y sont rattachées
                    historique_id: r.historiqueId }
  }

  // Alertes reprises de l'ancien frontend : adresse mal localisée, notes du
  // repli DVF (petite surface…), passoire thermique.
  function dateFr(iso) {
    const d = new Date(iso)
    return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  function afficherAlertes(r) {
    const a = []
    if (r.alerteGeo) a.push(['ambre', r.alerteGeo])
    if (r.alerteType) a.push(['rouge', `<b>Type de bien à vérifier.</b> ${r.alerteType}`])
    if (r.modele === 'ml' && r.sansNumero) a.push(['ambre', "<b>Adresse sans numéro</b> : immeuble non identifié. Ajoutez le numéro pour plus de précision."])
    if (r.modele !== 'ml') r.notes.filter((n) => !/estimation fournie/i.test(n)).forEach((n) => a.push(['gris', n]))
    if (r.modele !== 'ml' && r.modele) a.push(['gris', "Commune seule : médiane des ventes comparables. Indiquez l'adresse pour une estimation au bien."])
    // Segments où le modèle se trompe plus que sa moyenne, mesurés sur le test officiel.
    // Une adresse sans numéro a déjà son alerte : immeuble et DPE n'y sont pas répétés.
    const segs = r.modele === 'ml' ? (r.segments || []).filter((x) =>
      !(r.sansNumero && ['sans_vente_immeuble', 'dpe_inconnu'].includes(x.segment))) : []
    if (segs.length) {
      const moy = modelInfo?.validation?.mape
      const pire = Math.max(...segs.map((x) => x.mape))
      const voisins = r.proximite?.ventes?.length && reventesImmeuble(r) < 3
      a.push(['ambre', `<b>${segs.map((x) => PHRASES_SEGMENT[x.segment] || x.libelle).join(' · ')}</b> : estimation moins précise` +
        `${moy ? ` (écart moyen ${pctRond(pire)}, contre ${pctRond(moy)})` : ''}.` +
        (voisins ? ' Voir les ventes proches ci-dessous.' : '')])
    }
    if (r.modele === 'ml' && r.classe === 'a_completer') a.push(['rouge', `<b>Secteur difficile</b>` +
      `${r.mape != null ? ` (écart moyen ${pctRond(r.mape)})` : ''} : faites confirmer par un professionnel.`])
    if (r.enregistreLe) a.push(['gris', `<b>Estimation du ${dateFr(r.enregistreLe)}</b>, telle qu'enregistrée. « Estimer » pour le prix d'aujourd'hui.`])
    if (['F', 'G'].includes(r.dpeClasse)) a.push(['rouge', `<b>Passoire thermique (${r.dpeClasse})</b> : location interdite${r.dpeClasse === 'G' ? ' depuis 2025' : ' à partir de 2028'} (loi Climat et Résilience).`])
    $('#rsai-alertes').innerHTML = a.map(([ton, txt]) => `<p class="alerte alerte-${ton}">${txt}</p>`).join('')
  }

  // Précision : la largeur de la fourchette du bien, en clair. Pas de score sur
  // 100 : « 85/100 » se lisait « fiable à 85 % » à côté d'une fourchette de ±27 %.
  function afficherPrecision(r) {
    const p = precisionDe(r, modelInfo?.largeurs)
    const lg = modelInfo?.largeurs, per = modelInfo?.largeursPeriode
    const titre = lg && per ? `Comparée aux fourchettes de nos estimations sur les ventes de ${periode(per)} : un tiers est sous ±${Math.round(lg.tiers_1)} %, un tiers au-dessus de ±${Math.round(lg.tiers_2)} %.` : ''
    const marge = rond((r.haute - r.basse) / 2)
    $('#rsai-precision').innerHTML = p ? cercle(p, marge, `Soit ±${Math.round(p.demi)} % du prix estimé. ${titre}`) : ''
    $('#rsai-classe-fiab').innerHTML = p?.titre ? `<span class="puce puce-${p.ton}">${p.titre}</span>` : ''
  }

  // Cercle de précision : trois arcs, un par tiers mesuré des fourchettes. Plein
  // pour une fourchette parmi les plus étroites, un seul arc pour les plus larges.
  // Au centre, la marge de prix du bien en euros (demi-largeur de sa fourchette).
  function cercle(p, marge, titre) {
    const R = 54, C = 2 * Math.PI * R, ecart = 7, arc = C / 3 - ecart
    const pleins = { vert: 3, ambre: 2, rouge: 1 }[p.ton] ?? 0
    const couleur = { vert: 'var(--vert)', ambre: 'var(--ambre)', rouge: 'var(--rouge)' }[p.ton] || 'var(--gris)'
    const arcs = [0, 1, 2].map((k) => `<circle cx="65" cy="65" r="${R}" fill="none" stroke="${k < pleins ? couleur : 'var(--fond)'}" stroke-width="10"
        stroke-dasharray="${arc} ${C - arc}" stroke-dashoffset="${-(k * C) / 3}" transform="rotate(-90 65 65)"/>`).join('')
    return `<svg viewBox="0 0 130 130" style="width:130px;display:block" role="img" aria-label="Marge de prix : plus ou moins ${nb(marge)} euros">
      ${titre ? `<title>${titre}</title>` : ''}${arcs}
      <text x="65" y="66" text-anchor="middle" font-size="19" font-style="italic" font-family="Instrument Serif,serif" fill="var(--encre)">± ${nb(marge)} €</text>
      <text x="65" y="83" text-anchor="middle" font-size="8.5" letter-spacing=".6" font-family="Inter,sans-serif" fill="var(--gris)">MARGE DE PRIX</text></svg>`
  }

  function afficherDpe(r) {
    const bloc = $('#rsai-bloc-dpe')
    if (!r.dpeClasse) { bloc.hidden = true; return }
    bloc.hidden = false
    const date = r.dpeDate ? new Date(r.dpeDate).toLocaleDateString('fr-FR') : null
    $('#rsai-dpe-source').textContent = r.dpeSource === 'adresse' ? `ADEME${date ? ` · ${date}` : ''}`
      : r.dpeSource === 'numero' ? 'ADEME · par son numéro' : r.dpeClasse ? 'indiquée par vous' : ''
    $('#rsai-dpe-contenu').innerHTML =
      (r.dpeClasse ? `<p class="dpe-ligne"><span class="badge-dpe dpe-${r.dpeClasse}">DPE ${r.dpeClasse}</span>${r.annee ? ` construit en ${r.annee}` : ''}</p>` : '') +
      (r.dpeSource === 'adresse' && r.dpeAppariement === 'probable'
        ? `<p class="fiab-txt">DPE d'un logement de surface proche à cette adresse : vérifiez que c'est le vôtre, sinon corrigez-le dans « Affiner l'estimation ».</p>` : '')
  }

  function afficherComparables(r) {
    const bloc = $('#rsai-bloc-comparables')
    bloc.hidden = !r.comparables.length
    const date = (d) => new Date(d).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
    $('#rsai-comparables').innerHTML = r.comparables.map((c) => `<tr${c.vefa ? ' class="vefa"' : ''}><td>${date(c.date)}${c.vefa ? ' <span class="puce claire" title="Vente sur plan (VEFA) : prix du neuf, TVA et prime au neuf comprises">neuf, sur plan</span>' : ''}</td><td>${nb(c.surface_m2)} m²</td>
      <td>${c.nb_pieces ? nb(c.nb_pieces) : '—'}</td><td>${euro(c.prix)}</td><td>${nb(c.prix_m2)} €</td><td><b>${nb(c.prix_m2_aujourdhui)} €</b></td></tr>`).join('')
    const ref = r.immeuble
    if (ref?.annee) $('#rsai-th-actuel').textContent = `€/m² actualisé ${ref.annee}`
    if (!ref) { $('#rsai-immeuble-ref').innerHTML = ''; return }
    const ecart = Math.round(100 * (r.valeur / ref.valeur - 1))
    $('#rsai-immeuble-ref').innerHTML =
      `Au prix ${ref.annee}, ces ventes donnent environ <b>${euro(ref.valeur)}</b> pour votre surface (médiane ${nb(ref.prix_m2)} €/m²${ref.n_vefa ? ', hors neuf' : ''})` +
      (Math.abs(ecart) <= 5 ? ', comme notre estimation.' : ` ; notre estimation est ${Math.abs(ecart)} % ${ecart > 0 ? 'au-dessus' : 'en dessous'}.`)
  }

  // Ventes similaires autour du bien : montrées quand l'immeuble a moins de
  // trois reventes, c'est-à-dire quand le modèle est le moins sûr.
  function afficherProximite(r) {
    const bloc = $('#rsai-bloc-proximite'), p = r.proximite
    bloc.hidden = !(p?.ventes?.length && reventesImmeuble(r) < 3)
    if (bloc.hidden) return
    const date = (d) => new Date(d).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
    const ref = p.reference
    $('#rsai-proximite-lib').textContent = `${p.ventes.length} revente${p.ventes.length > 1 ? 's' : ''} à moins de ${p.rayon_m < 1000 ? `${p.rayon_m} m` : '1 km'} · 24 derniers mois`
    if (ref?.annee) $('#rsai-th-prox').textContent = `€/m² actualisé ${ref.annee}`
    $('#rsai-proximite').innerHTML = p.ventes.map((c) => `<tr><td>${date(c.date)}</td><td>${c.adresse || '—'}</td><td>${nb(c.distance_m)} m</td>
      <td>${nb(c.surface_m2)} m²</td><td>${c.nb_pieces ? nb(c.nb_pieces) : '—'}</td><td>${euro(c.prix)}</td><td><b>${c.prix_m2_aujourdhui ? nb(c.prix_m2_aujourdhui) + ' €' : '—'}</b></td></tr>`).join('')
    if (!ref) {
      $('#rsai-proximite-ref').innerHTML = 'Trop peu de ventes pour une médiane : repères isolés.'
      return
    }
    const ecart = Math.round(100 * (r.valeur / ref.valeur - 1))
    $('#rsai-proximite-ref').innerHTML =
      `Au prix ${ref.annee}, ces ventes donnent environ <b>${euro(ref.valeur)}</b> pour votre surface (médiane ${nb(ref.prix_m2)} €/m²)` +
      (Math.abs(ecart) <= 5 ? ', comme notre estimation.' : ` ; notre estimation est ${Math.abs(ecart)} % ${ecart > 0 ? 'au-dessus' : 'en dessous'}.`)
  }

  function afficherSecteur(r, s) {
    $('#rsai-volume').innerHTML = `<span class="puce claire">${nb(s.n)} ventes</span>`
    const pos = Math.min(100, Math.max(0, (100 * (r.prix_m2 - s.p10)) / (s.p90 - s.p10)))
    $('#rsai-curseur').style.left = pos + '%'
    $('#rsai-bas').textContent = '10 % des ventes sous ' + nb(s.p10) + ' €/m²'
    $('#rsai-haut-d').textContent = '10 % au-dessus de ' + nb(s.p90) + ' €/m²'
    // Rang approximatif entre le 1er et le 9e décile (interpolation linéaire)
    const rang = Math.round(Math.min(97, Math.max(3, 10 + (80 * (r.prix_m2 - s.p10)) / (s.p90 - s.p10))))
    $('#rsai-position-txt').innerHTML = `À <b>${nb(r.prix_m2)} €/m²</b>, ce bien est plus cher qu'environ <b>${rang} %</b> des ventes de la commune en ${s.annee}.`
    $('#rsai-repere-med').style.left = Math.min(100, Math.max(0, (100 * (s.med - s.p10)) / (s.p90 - s.p10))) + '%'
    $('#rsai-chiffres-secteur').innerHTML = [
      [`Prix médian ${s.annee}`, `${nb(s.med)} €/m²`],
      ['8 ventes sur 10 entre', `${nb(s.p10)} et ${nb(s.p90)} €/m²`],
      ['Ventes analysées depuis 2021', nb(s.n)],
    ].map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join('')

    const dernier = s.eco.length - 1
    const v = 100 * (s.eco[dernier] / s.eco[0] - 1)
    const signe = (x, d = 1) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(d).replace('.', ',')}`
    $('#rsai-tendance').innerHTML = `<span class="puce claire">${signe(v)} %</span>`
    $('#rsai-courbe').innerHTML = courbe(s.eco, s.annees, s.nAn)
    const fragiles = s.annees.filter((a, i) => s.nAn?.[i] != null && s.nAn[i] < VENTES_MIN_ANNEE)
    const rythme = tendanceSecteur(s.eco, s.annees)
    $('#rsai-courbe-note').innerHTML =
      (rythme != null ? `En moyenne depuis ${s.annees[0]} : <b>${signe(100 * rythme)} % par an</b>. ` : '') +
      (fragiles.length ? `Point creux : moins de ${VENTES_MIN_ANNEE} ventes cette année-là, chiffre moins sûr.` : '')

    afficherDixAns(r.valeur)
  }

  // Projection à 10 ans : les trois scénarios communs à toutes les pages
  // (vanilla/scenarios.js), appliqués à la valeur estimée.
  // Baisse : rythme de la dernière correction de l'indice Notaires-INSEE du
  // département et du type de bien ; chargé une fois, la réponse la plus récente gagne.
  let demandeDixAns = 0
  async function afficherDixAns(base) {
    const n = ++demandeDixAns, el = $('#rsai-dix-ans'), src = $('#rsai-dix-ans-source')
    const dep = (courant.dep || '').slice(0, 2)
    el.innerHTML = ''; src.textContent = 'Chargement de l\'indice des prix…'
    const correction = await chargerCorrection(API.BASE, dep, courant.type)
    if (!actif || n !== demandeDixAns) return
    const sc = scenariosMarche(correction)
    if (!sc) { src.textContent = 'Indice Notaires-INSEE indisponible pour ce département : scénarios non calculés.'; return }
    // Trois chiffres côte à côte ; le scénario central au milieu, mis en avant
    el.innerHTML = sc.map((x, i) => `<div class="dix-tuile${i === 1 ? ' central' : ''}">
      <b>${euro(rond(base * Math.pow(1 + x.taux, 10)))}</b><span>${x.court}</span></div>`).join('')
    src.textContent = `Baisse : ${sc[0].source}${correction.type_reel === 'apartment' && courant.type === 'house' ? ' (indice des appartements : pas d\'indice des maisons à Paris)' : ''}. ` +
      `Reprise : ${sc[2].source}. Mêmes scénarios pour le financement et la plus-value.`
    src.title = sc[0].detail
  }

  function afficherTechnique(r, calcul) {
    // Méthodologie en trois cartes : le calcul, le modèle, la mesure de l'erreur.
    // Uniquement des valeurs servies par le backend : une ligne sans donnée est omise.
    const mi = modelInfo || {}, val = mi.validation, ml = r.modele === 'ml'
    const modele = ml ? [
      ['Méthode', 'LightGBM'],
      ...(mi.nFeatures ? [['Variables', String(mi.nFeatures)]] : []),
      ...(mi.trainedAt ? [['Entraîné le', new Date(mi.trainedAt).toLocaleDateString('fr-FR')]] : []),
      ...(mi.nTrain ? [["Ventes d'entraînement", nb(mi.nTrain)]] : []),
      ...(mi.nVentes ? [['Ventes analysées', nb(mi.nVentes)]] : []),
    ] : [
      ['Méthode', 'Médiane des ventes'],
      ...(r.meta?.n_transactions ? [['Ventes comparables', nb(r.meta.n_transactions)]] : []),
    ]
    const erreur = [
      ...(r.mape != null ? [[`Dans ce secteur${r.mape_n ? ` (${nb(r.mape_n)} ventes)` : ''}`, pctRond(r.mape)]] : []),
      ...(val ? [['En Île-de-France', pctRond(val.mape)], ['Ventes de contrôle', `${nb(val.n_test)} · ${periode(val.periode_test)}`]] : []),
      ['Fourchette', ml ? `à ${r.confiance || '85 %'}, calibrée` : 'ventes de la commune'],
      ...(mi.largeurs ? [['Tiers des fourchettes', `± ${Math.round(mi.largeurs.tiers_1)} % et ± ${Math.round(mi.largeurs.tiers_2)} %`]] : []),
    ]
    const carte = (titre, lignes, note) => `<section class="methodo-carte"><h4>${titre}</h4>
      <dl>${lignes.map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join('')}</dl>${note ? `<p>${note}</p>` : ''}</section>`
    $('#rsai-methodo').innerHTML =
      carte('Le calcul', calcul, r.adresse ? `Adresse retenue : ${r.adresse}` : '') +
      carte('Le modèle', modele, ml ? "Ventes atypiques et incomplètes écartées. Limites des ventes notariées : surface bâtie (pas la surface Carrez), parking ou cave parfois compris dans le prix, ni étage, ni état, ni extérieur." : '') +
      carte("La mesure de l'erreur", erreur, val ? 'Mesurée sur des ventes que le modèle évalué n\'avait jamais vues.' : '') +
      // Paramètres fixés par nous, pas mesurés : annoncés comme des choix
      carte('Choix de méthode', [
        ['Ventes proches', '300 m, puis 600 m et 1 km'],
        ['Élargissement', 'si moins de 5 ventes'],
        ['Critères', 'même type, surface ±20 %, 24 mois'],
        ['Médiane des ventes proches', 'à partir de 3 ventes'],
        ['Médiane annuelle fragile', `moins de ${VENTES_MIN_ANNEE} ventes`],
      ], "Paramètres de recherche choisis par nous, comme le ferait un agent : ce ne sont pas des mesures. Les ventes sur plan en sont exclues (prime du neuf).")

  }

  // Évolution du prix au m² : même grammaire que les autres graphiques (grille,
  // axe gradué, libellés en sans-serif). L'échelle couvre au moins ±15 % autour
  // de la moyenne : une baisse de 10 % ne doit pas ressembler à un effondrement.
  function courbe(val, annees, nAn = []) {
    const L = 600, H = 296, mg = 52, md = 36, mh = 30, mb = 50
    const fragile = (i) => nAn[i] != null && nAn[i] < VENTES_MIN_ANNEE
    const centre = (Math.min(...val) + Math.max(...val)) / 2
    const demi = Math.max(((Math.max(...val) - Math.min(...val)) / 2) * 1.2, centre * 0.15)
    const min = centre - demi, max = centre + demi
    const x = (i) => mg + (i * (L - mg - md)) / (val.length - 1)
    const y = (v) => mh + (H - mh - mb) * (1 - (v - min) / (max - min))
    const k = (v) => (v / 1000).toFixed(1).replace('.', ',') + 'k'
    const grilles = [0, 1, 2, 3, 4].map((i) => min + ((max - min) * i) / 4)
    const ligne = val.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ')
    const resume = `Prix médian au m² : ${val.map((v, i) => `${annees[i]} ${nb(v)} €${nAn[i] != null ? ` (${nAn[i]} ventes)` : ''}`).join(', ')}`
    return `<svg viewBox="0 0 ${L} ${H}" style="width:100%;height:auto" role="img" aria-label="${resume}">
      ${grilles.map((g) => `<line x1="${mg}" x2="${L - md}" y1="${y(g)}" y2="${y(g)}" stroke="var(--ligne)"/>
        <text x="${mg - 8}" y="${y(g) + 4}" text-anchor="end" font-size="13" font-family="Inter,sans-serif" fill="var(--gris)">${k(g)}</text>`).join('')}
      <path d="${ligne}" fill="none" stroke="var(--encre)" stroke-width="2.5" stroke-linejoin="round"/>
      ${val.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4.5" fill="${fragile(i) ? 'var(--blanc)' : 'var(--encre)'}" stroke="var(--encre)" stroke-width="2"${fragile(i) ? ' stroke-dasharray="2 2"' : ''}/>
        <text x="${x(i) + (i === 0 ? 8 : i === val.length - 1 ? -8 : 0)}" y="${y(v) - 12}" text-anchor="${i === 0 ? 'start' : i === val.length - 1 ? 'end' : 'middle'}" font-size="13" font-weight="600" font-family="Inter,sans-serif" fill="var(--encre)">${nb(v)} €</text>
        <text x="${x(i)}" y="${H - 26}" text-anchor="middle" font-size="13" font-family="Inter,sans-serif" fill="var(--gris)">${annees[i]}</text>
        ${nAn[i] != null ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11.5" font-family="Inter,sans-serif" fill="${fragile(i) ? 'var(--ambre)' : 'var(--gris)'}">${nb(nAn[i])} ventes</text>` : ''}`).join('')}</svg>`
  }

  $('#rsai-pv-voir').addEventListener('click', () => {
    if (dernierBien && onPlusValue) onPlusValue(dernierBien)
  })
  $('#rsai-fin-voir').addEventListener('click', () => {
    if (dernierBien && onFinancement) onFinancement(dernierBien)
  })
  $('#rsai-pdf').addEventListener('click', async () => {
    if (!dernierBien) return
    // Fenêtre ouverte tout de suite (sinon bloquée), remplie une fois l'indice connu
    const w = window.open('', '_blank')
    if (!w) return
    const correction = await chargerCorrection(API.BASE, (courant.dep || '').slice(0, 2), courant.type)
    exporterPDF(dernierBien, modelInfo, correction, w)
  })
  $('#rsai-carte-voir').addEventListener('click', () => onCarte?.())
  $('#rsai-histo-voir').addEventListener('click', () => onHistorique?.())
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
  $('#rsai-estimer-affine').addEventListener('click', () => estimer(true))
  // Estimation uniquement sur demande (bouton « Estimer » ou carte de secteur) :
  // modifier un champ ne relance rien, et rien n'est estimé à l'ouverture.

  // Préremplissage depuis un lien partagé.
  const params = new URLSearchParams(window.location.search)
  // Préremplissage commun au lien partagé et à « Ré-estimer » depuis l'historique.
  function remplir(v) {
    if (v.area_m2) $('#rsai-surface').value = v.area_m2
    if (v.rooms) $('#rsai-pieces').value = v.rooms
    if (v.property_type || v.type) $('#rsai-type').value = v.property_type || v.type
    const adr = v.adresse_normalisee || v.address || ''
    $('#rsai-adresse').value = adr || v.commune || ''
    $('#rsai-cp').value = v.postal_code || ''
    selecteur.value = !adr ? (v.commune || '') : ''
    if (v.dpe_classe || v.dpe) choisirDpe(v.dpe_classe || v.dpe)
    if (v.annee_construction || v.year) $('#rsai-annee').value = v.annee_construction || v.year
    // précisions connues : le volet s'ouvre pour qu'on les voie
    if (v.dpe_classe || v.dpe || v.annee_construction || v.year) $('#rsai-affiner').open = true
  }
  remplir({ area_m2: params.get('area_m2'), rooms: params.get('rooms'), type: params.get('type'),
            address: params.get('address'), postal_code: params.get('postal_code'), commune: params.get('commune'),
            dpe: params.get('dpe'), year: params.get('year') })
  if ([...params.keys()].length) window.history.replaceState({}, '', window.location.pathname)

  verifierApi()
  // « Ré-estimer » depuis l'historique : demande explicite, on relance l'estimation du bien.
  // Lancée au tour suivant et annulée au démontage : React monte la page deux
  // fois en développement, ce qui envoyait deux estimations (doublons d'historique).
  // « Voir » depuis l'historique : le résultat enregistré est réaffiché tel quel, sans recalcul.
  function revoir(item) {
    remplir(item)
    const r = normaliser(item.resultat)
    r.historiqueId = item.id
    r.enregistreLe = item.created_at
    const saisie = item.resultat.saisie || {}
    afficher(r, r.secteur, item.address || saisie.address || '', item.area_m2 || saisie.surface,
             item.rooms || saisie.rooms, item.property_type || saisie.property_type)
    onEstime?.()
    $('#rsai-resultat').scrollIntoView({ behavior: 'smooth' })
  }
  const relanceDiff = relance ? setTimeout(() => {
    if (!actif) return
    if (relance._mode === 'voir' && relance.resultat) revoir(relance)
    else { remplir(relance); estimer(true) }
  }, 0) : null

  return () => { actif = false; clearTimeout(relanceDiff) }
}
