// Page "Estimation" — reprise quasi verbatim de l'artefact Claude Design
// (https://claude.ai/artifact/A9YV2PZHfG1rWQh1GTccSo), rebranchée sur le
// vrai backend FastAPI (estimation ML, communes, santé de l'API).
import { heroEstimation } from './illustrations-vanilla.js'
import { scenariosMarche } from './scenarios.js'

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
        <div style="min-width:0;flex:1;position:relative"><label for="rsai-adresse" title="Une adresse précise active le modèle ML ; une commune seule donne la médiane des ventes comparables">Adresse du bien</label>
          <input id="rsai-adresse" type="text" placeholder="12 rue de la Paix, 75002 Paris" autocomplete="off"
            role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="rsai-suggestions">
          <input id="rsai-cp" type="hidden">
          <ul class="suggestions" id="rsai-suggestions" role="listbox" hidden></ul></div>
      </div>
      <div class="critere">
        <div class="pic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 21V9l8-6 8 6v12"/><path d="M9 21v-6h6v6"/></svg></div>
        <div style="min-width:0;flex:1"><label for="rsai-secteur">ou commune</label>
          <input id="rsai-secteur" type="text" list="rsai-communes" placeholder="Chargement…" autocomplete="off">
          <datalist id="rsai-communes"></datalist></div>
      </div>
      <div class="critere">
        <div class="pic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/></svg></div>
        <div style="flex:1"><label for="rsai-type">Type de bien</label>
          <select id="rsai-type"><option value="apartment">Appartement</option><option value="house">Maison</option><option value="other">Autre</option></select></div>
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
  <button type="button" class="estimer" id="rsai-estimer-affine">Estimer avec ces précisions</button>
</details>


<h2 class="titre-section" id="rsai-resultat">Votre <em>estimation</em></h2>
<p class="sous" id="rsai-attente">Renseignez l'adresse du bien (ou son secteur), sa surface et son nombre
  de pièces, puis cliquez sur « Estimer ».</p>
<section id="rsai-bloc-resultat" hidden>
  <div class="clair clair-grid">
    <div class="bloc bloc-resume">
      <div class="lib" id="rsai-lib-secteur">Estimation</div>
      <div class="valeur" id="rsai-valeur">—</div>
      <div class="fourchette" id="rsai-fourchette"></div>
      <div id="rsai-alertes"></div>
      <div class="jauge-ci"><i id="rsai-curseur-ci" style="left:50%"></i></div>
      <div class="bornes-ci"><span id="rsai-ci-bas"></span><span id="rsai-ci-haut"></span></div>
      <div class="mesures">
        <div class="mesure"><b id="rsai-m2">—</b><span>€ par m²</span></div>
        <div class="mesure" data-secteur><b id="rsai-med">—</b><span>Médiane du secteur</span></div>
        <div class="mesure" data-secteur><b id="rsai-ecart">—</b><span id="rsai-ecart-lib">par rapport à la médiane</span></div>
      </div>
    </div>
    <div class="bloc">
      <div class="bloc-tete"><h3>Fiabilité <em>de l'estimation</em></h3><span id="rsai-src-modele"></span></div>
      <div class="fiab">
        <div id="rsai-anneau"></div>
        <div class="fiab-txt"><p class="classe-fiab" id="rsai-classe-fiab"></p><div id="rsai-fiab-txt"></div></div>
      </div>
    </div>
    <div class="bloc" id="rsai-bloc-dpe" hidden>
      <div class="bloc-tete"><h3>Performance <em>énergétique</em></h3><span id="rsai-dpe-source"></span></div>
      <div id="rsai-dpe-contenu"></div>
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
    <div class="bloc bloc-large" id="rsai-bloc-comparables" hidden>
      <div class="bloc-tete"><h3>Ventes <em>dans l'immeuble</em></h3><span>ventes notariées · prix ramenés au marché actuel</span></div>
      <table class="comparables"><thead><tr><th>Date</th><th>Surface</th><th>Pièces</th><th>Prix</th><th>€/m² à la vente</th><th id="rsai-th-actuel">€/m² au marché actuel</th></tr></thead>
        <tbody id="rsai-comparables"></tbody></table>
      <p class="fiab-txt" id="rsai-immeuble-ref"></p>
    </div>
    <div class="bloc">
      <details class="methodo">
        <summary><h3>Méthodologie <em>et détail du calcul</em></h3></summary>
        <div class="methodo-grille" id="rsai-methodo"></div>
      </details>
    </div>
    <div class="bloc">
      <div class="bloc-tete"><h3>Valeur <em>dans 10 ans</em></h3><span>trois scénarios de marché</span></div>
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

<section class="manifeste">
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


<div class="bas">
  <span>Sources : ventes notariées DVF (DGFiP, Etalab) · DPE (ADEME) · quartiers IRIS (INSEE) · bâtiments BDNB (CSTB)</span>
  <span>Estimation indicative, ne constitue pas une expertise immobilière.</span>
  <span>RealStateAI — v${__APP_VERSION__}</span>
</div>
`

const ANNEES = [2021, 2022, 2023, 2024, 2025]
const euro = (n) => Math.round(n).toLocaleString('fr-FR') + ' €'
const nb = (n) => Math.round(n).toLocaleString('fr-FR')

const TYPE_LABEL = { apartment: 'Appartement', house: 'Maison', other: 'Autre' }

// Classes de fiabilité du protocole d'évaluation (docs/protocole_evaluation.md)
const CLASSES = {
  fiable: { titre: 'Fiabilité élevée', texte: 'le prix peut appuyer une négociation.', ton: 'vert' },
  indicative: { titre: 'Fiabilité correcte', texte: 'un bon point de départ, à confirmer par une visite.', ton: 'ambre' },
  a_completer: { titre: 'Fiabilité limitée', texte: "secteur difficile : l'avis d'un professionnel est indispensable.", ton: 'rouge' },
  donnees_insuffisantes: { titre: 'Peu de références', texte: "trop peu de ventes récentes pour mesurer l'écart ici.", ton: 'gris' },
}

// Montants arrondis au millier : afficher un prix à l'euro près, avec une
// fourchette de plusieurs dizaines de milliers d'euros, suggère une fausse précision.
const rond = (x) => Math.round(x / 1000) * 1000

/** Fiche imprimable — même principe que l'ancien frontend (fenêtre + print()). */
function exporterPDF(bien, modelInfo) {
  if (!bien) return
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

  // Marché du secteur : médiane, position du bien entre 1er et 9e décile, évolution
  const avecSecteur = !!(s && s.med)
  const ecart = avecSecteur ? Math.round(100 * (r.prix_m2 / s.med - 1)) : null
  const posDecile = avecSecteur && s.p10 && s.p90 ? Math.min(98, Math.max(2, (100 * (r.prix_m2 - s.p10)) / (s.p90 - s.p10))) : null
  const evo = avecSecteur && s.eco?.length >= 2 ? 100 * (s.eco[s.eco.length - 1] / s.eco[0] - 1) : null

  // Points d'attention : les mêmes que sur la page
  const attention = []
  if (r.sansNumero && ml) attention.push("Adresse sans numéro : l'immeuble n'est pas identifié, ses ventes et son DPE ne sont pas pris en compte.")
  if (r.alerteGeo) attention.push(esc(r.alerteGeo))
  if (r.segments?.length && ml) attention.push('Segment plus difficile pour le modèle : ' + r.segments.map((x) => `${esc(x.libelle)} (erreur moyenne mesurée ${fr(x.mape)} %)`).join(' ; ') + '.')
  if (['F', 'G'].includes(r.dpeClasse)) attention.push(`Passoire thermique (classe ${r.dpeClasse}) : décote à la vente et location ${r.dpeClasse === 'G' ? 'interdite depuis 2025' : 'interdite à partir de 2028'}.`)
  if (!ml) attention.push("Estimation sans adresse précise : médiane des ventes comparables de la commune, sans le modèle.")

  const dpe = r.dpeClasse
    ? `${r.dpeClasse}${r.dpeSource === 'adresse' ? ` · retrouvé à l'adresse (ADEME${r.dpeDate ? `, diagnostic du ${new Date(r.dpeDate).toLocaleDateString('fr-FR')}` : ''})` : r.dpeSource === 'saisi' || !r.dpeSource ? ' · déclaré' : ''}`
    : 'non trouvé'

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Avis de valeur ${ref}</title>
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
  .fiab .classe.fiable{background:#e3f2e6;color:#1f6b35}.fiab .classe.a_completer{background:#f8e3df;color:#9a3a26}
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
  .pied{margin-top:22px;padding-top:10px;border-top:1px solid #e3ded6;font-size:10.5px;color:#6b655d}
  .imprimer{position:fixed;top:14px;right:14px;padding:8px 16px;border:0;border-radius:999px;background:#9C6A26;color:#fff;font:600 13px Arial;cursor:pointer}
  @media print{.imprimer{display:none}body{max-width:none;padding:14mm 15mm 12mm}}
</style></head><body>
<button class="imprimer" onclick="window.print()">Enregistrer en PDF</button>
<div class="tete">
  <div><div class="marque">RealState<i>AI</i></div><small>Estimation immobilière · Île-de-France</small></div>
  <div class="ref">Avis de valeur indicatif<br>Réf. ${ref}<br>${date}</div>
</div>

<h1>Le bien</h1>
<p class="lieu">${lieu}</p>
<p class="desc">${TYPE_LABEL[type] || 'Bien'} · ${surface} m² · ${pieces} pièce${pieces > 1 ? 's' : ''}${r.annee ? ` · construit en ${r.annee}` : ''} · DPE ${dpe}</p>

<div class="prix">
  <div class="carte">
    <div class="valeur">environ ${euro(rond(r.valeur))}</div>
    <div class="m2">soit <b>${euro(r.prix_m2)} / m²</b>${ecart != null ? ` · ${ecart > 0 ? '+' : ''}${ecart} % par rapport à la médiane du secteur` : ''}</div>
    <div class="barre"><b style="left:${place}%"></b></div>
    <div class="bornes"><span>${euro(rond(r.basse))}</span><span>${euro(rond(r.haute))}</span></div>
    <div class="note">${ml && val?.fourchette ? `Le prix de vente réel tombe dans cette fourchette 85 fois sur 100 (vérifié sur ${fr(val.n_test, 0)} ventes récentes : ${fr(val.fourchette.couverture)} %).` : 'Fourchette des ventes comparables de la commune.'}</div>
  </div>
  <div class="carte fiab">
    <b>Fiabilité</b><br>
    ${r.classe ? `<span class="classe ${r.classe}">${CLASSES[r.classe]?.titre || r.classe}</span>` : ''}
    ${r.mape != null ? `<p>Dans ce secteur, nos estimations s'écartent en moyenne de <b>${Math.round(r.mape)} %</b> du prix de vente réel${r.mape_n ? ` (vérifié sur ${fr(r.mape_n, 0)} ventes récentes)` : ''}.</p>` : ''}
    ${val ? `<p>En Île-de-France : écart moyen de ${Math.round(val.mape)} %, et ${Math.round(val.dans_20pct)} % des estimations à moins de 20 % du prix réel.</p>` : ''}
  </div>
</div>

<h2>Ventes dans l'immeuble</h2>
${r.comparables?.length ? `<table><tr><th>Date</th><th class="n">Surface</th><th class="n">Pièces</th><th class="n">Prix</th><th class="n">€/m² à la vente</th><th class="n">€/m² au marché ${r.immeuble?.annee || 'actuel'}</th></tr>
${r.comparables.map((c) => `<tr><td>${moisAn(c.date)}${c.vefa ? ' <i>(neuf, sur plan)</i>' : ''}</td><td class="n">${c.surface_m2} m²</td><td class="n">${c.nb_pieces ?? '—'}</td><td class="n">${euro(c.prix)}</td><td class="n">${euro(c.prix_m2)}</td><td class="n"><b>${euro(c.prix_m2_aujourdhui)}</b></td></tr>`).join('')}</table>
<p class="note">Dernières ventes notariées de la même parcelle, ramenées au marché ${r.immeuble?.annee || 'actuel'} avec l'évolution des prix du secteur.${r.immeuble ? ` Leur médiane (${euro(r.immeuble.prix_m2)}/m²) donnerait environ ${euro(r.immeuble.valeur)} pour cette surface. Une vente isolée peut s'écarter du marché (étage, état, travaux).` : ''}</p>`
  : `<p class="vide">Aucune vente récente enregistrée dans cet immeuble${r.sansNumero ? " (adresse sans numéro : immeuble non identifié)" : ''}.</p>`}

${avecSecteur ? `<h2>Le marché du secteur · ${esc(s.nom)}</h2>
<div class="deux">
  <div>
    <table>
      <tr><td>Médiane ${s.annee || ''}</td><td class="n"><b>${euro(s.med)} / m²</b></td></tr>
      ${s.p10 && s.p90 ? `<tr><td>8 ventes sur 10 entre</td><td class="n">${euro(s.p10)} et ${euro(s.p90)} / m²</td></tr>` : ''}
      ${s.n ? `<tr><td>Ventes analysées</td><td class="n">${fr(s.n, 0)}</td></tr>` : ''}
      ${evo != null ? `<tr><td>Évolution ${s.annees?.[0] ?? 2021}–${s.annees?.[s.annees.length - 1] ?? 2025}</td><td class="n">${evo > 0 ? '+' : ''}${fr(evo)} %</td></tr>` : ''}
    </table>
  </div>
  <div>
    ${posDecile != null ? `<b>Position du bien dans le secteur</b>
    <div class="reglette"><b style="left:${posDecile}%"></b></div>
    <div class="bornes" style="font-weight:400;font-size:11.5px;color:#6b655d"><span>moins cher</span><span>plus cher</span></div>` : ''}
  </div>
</div>` : ''}

${attention.length ? `<h2>Points d'attention</h2>${attention.map((x) => `<p class="att">${x}</p>`).join('')}` : ''}

<h2>Méthode</h2>
<p style="margin:0">${ml
    ? `Modèle LightGBM${modelInfo?.nFeatures ? ` à ${modelInfo.nFeatures} variables` : ''}, entraîné sur les ventes notariées DVF d'Île-de-France 2021–2025${modelInfo?.trainedAt ? ` (entraînement du ${new Date(modelInfo.trainedAt).toLocaleDateString('fr-FR')})` : ''} : caractéristiques du bien, ventes de l'immeuble, DPE (ADEME), revenus du quartier (INSEE) et bâtiment (BDNB). Erreur mesurée selon un protocole fixé avant le test, sur des ventes postérieures à l'entraînement.`
    : 'Médiane des ventes notariées DVF comparables de la commune (type, surface et pièces proches).'}</p>

<p class="pied">Avis de valeur indicatif, établi automatiquement à partir de données publiques : il ne remplace pas une expertise ni un avis de valeur signé par un professionnel, et n'a pas de valeur contractuelle. Sources : DVF (DGFiP, Etalab), DPE (ADEME), IRIS (INSEE), BDNB (CSTB).</p>
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
  if (bien.codePostal) p.set('postal_code', bien.codePostal)
  if (bien.dpe) p.set('dpe', bien.dpe)
  if (bien.annee) p.set('year', bien.annee)
  return `${window.location.origin}${window.location.pathname}?${p.toString()}`
}

export function mount(root, { apiBase = '', onPlusValue, onFinancement, onEstime, demanderConnexion, relance } = {}) {
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
  // Une réponse arrivée après le démontage de la page (React monte deux fois
  // en développement) ne doit rien écrire : sinon la grille se remplit en double.
  let actif = true
  $('#illus-heros').innerHTML = heroEstimation()
  $('#rsai-fond-page').innerHTML = heroEstimation()

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
        badge.className = 'etat-api direct'
        badge.innerHTML = `<i></i><span>Service en ligne</span>`
        chargerCommunes()
      } else {
        badge.innerHTML = `<i></i><span>Estimation par adresse indisponible</span>`
      }
      modelInfo = {
        mape: d.model_mape, r2: d.model_r2, nFeatures: d.model_n_features,
        trainedAt: d.model_trained_at, nTrain: d.model_n_train,
        nVentes: d.n_rows, validation: d.model_validation, anneeMax: d.dvf_max_year,
      }
      afficherStats()
      if (dernierBien) afficher(dernierBien.r, dernierBien.s, dernierBien.adresse, dernierBien.surface, dernierBien.pieces, dernierBien.type)
    } catch {
      badge.innerHTML = `<i></i><span>Service momentanément indisponible</span>`
      selecteur.placeholder = 'Indisponible'
    }
  }

  // Chiffres de la section « Notre approche » : servis par le backend, jamais
  // écrits en dur — l'erreur affichée est celle de la validation officielle
  // (docs/protocole_evaluation.md), mesurée une fois sur un test jamais vu.
  function afficherStats() {
    const mi = modelInfo || {}, v = mi.validation
    const pct = (x) => String(x).replace('.', ',') + ' %'
    if (mi.nVentes) $('#rsai-stat-ventes').textContent = nb(mi.nVentes)
    if (v) {
      $('#rsai-stat-mape').textContent = pct(v.mape)
      $('#rsai-stat-mape-lib').textContent = `Écart moyen avec le prix de vente réel, sur des ventes de ${periode(v.periode_test)}`
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
      const liste = Array.isArray(d) ? d.filter(Boolean) : Array.isArray(d?.communes) ? d.communes.filter(Boolean) : []
      if (!actif || !liste.length) return
      communes = liste
      $('#rsai-communes').innerHTML = liste.map((c) => `<option value="${c}"></option>`).join('')
      selecteur.placeholder = 'Rechercher une commune'
    } catch {
      selecteur.placeholder = 'Indisponible'
    }
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
      <b>${s.name}</b><span>${s.postcode} ${s.city}</span></li>`).join('')
    liste.hidden = !suggestions.length
    champAdresse.setAttribute('aria-expanded', String(!!suggestions.length))
  }
  function choisir(s) {
    champAdresse.value = s.label
    $('#rsai-cp').value = s.postcode
    selecteur.value = ''
    suggestions = []; fermerSuggestions()
  }
  champAdresse.addEventListener('input', () => {
    $('#rsai-cp').value = ''   // adresse modifiée à la main : code postal à redéduire
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
        suggestions = (d.features || []).filter((f) => /^(75|77|78|91|92|93|94|95)/.test(f.properties.postcode || ''))
          .slice(0, 6).map((f) => ({ label: f.properties.label, name: f.properties.name,
          postcode: f.properties.postcode || '', city: f.properties.city || '' }))
        choix = -1; montrerSuggestions()
      } catch { suggestions = []; fermerSuggestions() }
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
    const adresse = $('#rsai-adresse').value.trim()
    const commune = selecteur.value.trim()
    const codePostal = $('#rsai-cp').value
    const annee = +$('#rsai-annee').value || null
    if (!adresse && !commune) return message("Indiquez l'adresse du bien ou choisissez sa commune.")
    if (!adresse && communes.length && !communes.includes(commune)) return message('Choisissez une commune dans la liste proposée.')
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
      enregistreLe: null,
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
    $('#rsai-valeur').textContent = euro(rond(r.valeur))
    $('#rsai-fourchette').innerHTML = `Entre <b>${euro(rond(r.basse))}</b> et <b>${euro(rond(r.haute))}</b>` +
      `<small>${r.modele === 'ml' ? `Le prix de vente réel tombe dans cette fourchette ${(r.confiance || '85 %').replace(' %', '')} fois sur 100.` : 'Fourchette des ventes comparables de la commune.'}` +
      `${modelInfo?.anneeMax ? ` Marché observé jusqu'à fin ${modelInfo.anneeMax} (dernière publication des ventes notariées).` : ''}</small>`
    const place = Math.min(96, Math.max(4, (100 * (r.valeur - r.basse)) / (r.haute - r.basse)))
    $('#rsai-curseur-ci').style.left = place + '%'
    $('#rsai-ci-bas').textContent = euro(rond(r.basse))
    $('#rsai-ci-haut').textContent = euro(rond(r.haute))

    $('#rsai-m2').textContent = nb(r.prix_m2)
    if (avecSecteur) {
      $('#rsai-med').textContent = nb(s.med)
      const e = Math.round(100 * (r.prix_m2 / s.med - 1))
      $('#rsai-ecart').textContent = (e > 0 ? '+' : '') + e + ' %'
      $('#rsai-ecart-lib').textContent = e > 0 ? 'au-dessus de la médiane du secteur' : e < 0 ? 'en dessous de la médiane du secteur' : 'au niveau de la médiane du secteur'
    }

    $('#rsai-anneau').innerHTML = anneau(r.fiabilite, CLASSES[r.classe]?.ton)
    afficherAlertes(r)
    afficherClasse(r)
    afficherDpe(r)
    afficherComparables(r)
    $('#rsai-src-modele').innerHTML = `<span class="puce claire">${r.modele === 'ml' ? "Estimation à l'adresse" : 'Médiane de la commune'}</span>`
    const val = modelInfo?.validation
    $('#rsai-fiab-txt').innerHTML =
      (r.mape != null
        ? `Dans ce secteur, nos estimations s'écartent en moyenne de <b>${Math.round(r.mape)} %</b> du prix de vente réel${r.mape_n ? `, vérifié sur ${nb(r.mape_n)} ventes récentes` : ''}.`
        : val
          ? `En Île-de-France, nos estimations s'écartent en moyenne de <b>${Math.round(val.mape)} %</b> du prix de vente réel ; ${Math.round(val.dans_20pct)} % tombent à moins de 20 % du prix.`
          : '') +
      (r.meta?.n_transactions ? `<br>Secteur documenté par <b>${nb(r.meta.n_transactions)}</b> ventes.` : '')

    if (avecSecteur) afficherSecteur(r, s)

    afficherTechnique(r, [
      ['Prix au m² estimé', `${nb(r.prix_m2)} €`],
      ['Surface', `${surface} m²`],
      ...(avecSecteur ? [[`Médiane du secteur ${s.annee}`, `${nb(s.med)} €/m²`]] : []),
      ['Valeur avant arrondi', euro(r.valeur)],
    ])
    const cp = r.codePostal || $('#rsai-cp').value || null
    dernierBien = { commune: s?.nom || selecteur.value || null, code_commune: s?.code || null,
                    departement: s?.code ? s.code.slice(0, 2) : cp ? cp.slice(0, 2) : null, secteur: s?.code || null,
                    codePostal: cp, dpe: dpeChoisi || r.dpeClasse || null, annee: +$('#rsai-annee').value || null,
                    prix: Math.round(r.valeur), r, s, adresse, surface, pieces, type,
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
    if (r.modele === 'ml' && r.sansNumero) a.push(['ambre', "<b>Adresse sans numéro.</b> L'immeuble n'a pas pu être identifié : ni ses ventes, ni son DPE, ni ses caractéristiques ne sont pris en compte. Indiquez le numéro pour une estimation plus précise."])
    if (r.modele !== 'ml') r.notes.filter((n) => !/estimation fournie/i.test(n)).forEach((n) => a.push(['gris', n]))
    if (r.modele !== 'ml' && r.modele) a.push(['gris', "Sans adresse précise, l'estimation repose sur la médiane des ventes comparables de la commune ; indiquez l'adresse pour activer le modèle."])
    // Segments où le modèle se trompe plus que sa moyenne, mesurés sur le test officiel
    if (r.modele === 'ml' && r.segments?.length) {
      const fr = (x) => String(x).replace('.', ',')
      const moy = modelInfo?.validation?.mape
      const s = r.segments
      a.push(['ambre', `<b>Bien dans un segment plus difficile pour le modèle.</b> Erreur moyenne mesurée sur les ventes de test : ` +
        s.map((x) => `${x.libelle}, <b>${fr(x.mape)} %</b>`).join(' ; ') +
        `${moy ? `, contre ${fr(moy)} % sur l'ensemble` : ''}. Appuyez le prix sur les ventes de l'immeuble et une visite.`])
    }
    if (r.enregistreLe) a.push(['gris', `<b>Estimation enregistrée le ${dateFr(r.enregistreLe)}</b>, réaffichée telle qu'elle était. Cliquez sur « Estimer » pour obtenir le prix d'aujourd'hui.`])
    if (['F', 'G'].includes(r.dpeClasse)) a.push(['rouge', `<b>Passoire thermique (classe ${r.dpeClasse})</b> — depuis la loi Climat et Résilience, les biens F et G se vendent avec une décote, et leur mise en location est interdite${r.dpeClasse === 'G' ? ' depuis 2025' : ' à partir de 2028'}.`])
    $('#rsai-alertes').innerHTML = a.map(([ton, txt]) => `<p class="alerte alerte-${ton}">${txt}</p>`).join('')
  }

  function afficherClasse(r) {
    const c = CLASSES[r.classe]
    const pct = r.fiabilite != null ? Math.round(r.fiabilite * 100) : null
    const niveau = pct == null ? '' : pct >= 80 ? 'Bonne fiabilité' : pct >= 60 ? 'Fiabilité moyenne' : 'Fiabilité limitée'
    $('#rsai-classe-fiab').innerHTML = c
      ? `<span class="puce puce-${c.ton}">${c.titre}</span> ${c.texte}`
      : niveau ? `<span class="niveau">${niveau}</span>` : ''
  }

  function afficherDpe(r) {
    const bloc = $('#rsai-bloc-dpe')
    if (!r.dpeClasse && r.dpeZone == null) { bloc.hidden = true; return }
    bloc.hidden = false
    const date = r.dpeDate ? new Date(r.dpeDate).toLocaleDateString('fr-FR') : null
    $('#rsai-dpe-source').textContent = r.dpeSource === 'adresse' ? `retrouvé à l'adresse · ADEME${date ? ` · diagnostic du ${date}` : ''}`
      : r.dpeSource === 'numero' ? 'retrouvé par son numéro · ADEME' : r.dpeClasse ? 'classe saisie' : ''
    $('#rsai-dpe-contenu').innerHTML =
      (r.dpeClasse ? `<p class="dpe-ligne"><span class="badge-dpe dpe-${r.dpeClasse}">DPE ${r.dpeClasse}</span>${r.annee ? ` construit en ${r.annee}` : ''}</p>` : '') +
      (r.dpeSource === 'adresse' && r.dpeAppariement === 'probable'
        ? `<p class="fiab-txt">Plusieurs logements de surface proche ont un DPE à cette adresse : si ce n'est pas la classe du bien, indiquez-la dans « Affiner l'estimation ».</p>` : '') +
      (r.dpeZone != null ? `<p class="fiab-txt"><b>${String(r.dpeZone).replace('.', ',')} %</b> de passoires thermiques (F et G) parmi les diagnostics du code postal.</p>` : '')
  }

  function afficherComparables(r) {
    const bloc = $('#rsai-bloc-comparables')
    bloc.hidden = !r.comparables.length
    const date = (d) => new Date(d).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
    $('#rsai-comparables').innerHTML = r.comparables.map((c) => `<tr${c.vefa ? ' class="vefa"' : ''}><td>${date(c.date)}${c.vefa ? ' <span class="puce claire" title="Vente sur plan (VEFA) : prix du neuf, TVA et prime au neuf comprises">neuf, sur plan</span>' : ''}</td><td>${nb(c.surface_m2)} m²</td>
      <td>${c.nb_pieces ? nb(c.nb_pieces) : '—'}</td><td>${euro(c.prix)}</td><td>${nb(c.prix_m2)} €</td><td><b>${nb(c.prix_m2_aujourdhui)} €</b></td></tr>`).join('')
    const ref = r.immeuble
    if (ref?.annee) $('#rsai-th-actuel').textContent = `€/m² au marché ${ref.annee}`
    if (!ref) { $('#rsai-immeuble-ref').innerHTML = ''; return }
    const ecart = Math.round(100 * (r.valeur / ref.valeur - 1))
    $('#rsai-immeuble-ref').innerHTML =
      `Chaque vente est ramenée au marché ${ref.annee} avec l'évolution des prix du secteur (courbe ci-dessus). ` +
      (ref.n_vefa ? `Les ventes sur plan (neuf) sont écartées : leur prix inclut la prime au neuf, qui disparaît à la revente. ` : '') +
      `La médiane des ${ref.n_vefa ? 'reventes' : 'ventes'}, <b>${nb(ref.prix_m2)} €/m²</b>, donnerait environ <b>${euro(ref.valeur)}</b> pour cette surface ; ` +
      (Math.abs(ecart) <= 5 ? 'notre estimation est au même niveau. '
        : `notre estimation est ${ecart > 0 ? `${ecart} % au-dessus` : `${-ecart} % en dessous`}, car elle tient compte aussi du secteur, du DPE et de l'année de construction. `) +
      `Une vente isolée peut s'écarter du marché (étage, état, travaux, vente entre proches) : les données publiques ne le précisent pas.`
  }

  function afficherSecteur(r, s) {
    $('#rsai-volume').innerHTML = `<span class="puce claire">${nb(s.n)} ventes</span>`
    const pos = Math.min(100, Math.max(0, (100 * (r.prix_m2 - s.p10)) / (s.p90 - s.p10)))
    $('#rsai-curseur').style.left = pos + '%'
    $('#rsai-bas').textContent = '10 % des ventes sous ' + nb(s.p10) + ' €/m²'
    $('#rsai-haut-d').textContent = '10 % au-dessus de ' + nb(s.p90) + ' €/m²'

    const dernier = s.eco.length - 1
    const v = 100 * (s.eco[dernier] / s.eco[0] - 1)
    $('#rsai-tendance').innerHTML = `<span class="puce claire">${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')} %</span>`
    $('#rsai-courbe').innerHTML = courbe(s.eco, s.annees)

    // Projection de plus-value à 10 ans : mêmes trois scénarios et même scénario
    // central que le simulateur de plus-value (vanilla/scenarios.js).
    const [bas, central, haut] = scenariosMarche(s.eco, s.annees)
    const revente = (sc) => r.valeur * Math.pow(1 + sc.taux, 10)
    const taux = (sc) => `${sc.taux > 0 ? '+' : sc.taux < 0 ? '−' : ''}${Math.abs(100 * sc.taux).toFixed(1).replace('.', ',')} %/an`
    $('#rsai-pv-resume').innerHTML =
      `Dans 10 ans, selon l'évolution du marché, ce bien vaudrait entre <b>${euro(rond(revente(bas)))}</b> et <b>${euro(rond(revente(haut)))}</b>. ` +
      `Scénario central (${central.nom.toLowerCase()}, ${taux(central)}) : environ <b>${euro(rond(revente(central)))}</b>. ` +
      `Les trois scénarios : la tendance du secteur depuis 2021 prolongée, la stabilité, une reprise modérée (+2 %/an). Ce ne sont pas des prévisions.`

  }

  function afficherTechnique(r, calcul) {
    // Méthodologie en trois cartes : le calcul, le modèle, la mesure de l'erreur.
    // Uniquement des valeurs servies par le backend : une ligne sans donnée est omise.
    const mi = modelInfo || {}, val = mi.validation, ml = r.modele === 'ml'
    const pc = (x) => `${String(x).replace('.', ',')} %`
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
      ...(r.mape != null ? [[`Dans ce secteur${r.mape_n ? ` (${nb(r.mape_n)} ventes)` : ''}`, pc(r.mape)]] : []),
      ...(val ? [['En Île-de-France', pc(val.mape)], ['Ventes de contrôle', `${nb(val.n_test)} · ${periode(val.periode_test)}`]] : []),
      ['Fourchette', ml ? `à ${r.confiance || '85 %'}, calibrée` : 'ventes de la commune'],
    ]
    const carte = (titre, lignes, note) => `<section class="methodo-carte"><h4>${titre}</h4>
      <dl>${lignes.map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join('')}</dl>${note ? `<p>${note}</p>` : ''}</section>`
    $('#rsai-methodo').innerHTML =
      carte('Le calcul', calcul, r.adresse ? `Adresse retenue : ${r.adresse}` : '') +
      carte('Le modèle', modele, ml ? "Ventes atypiques et incomplètes écartées. Limites des ventes notariées : surface bâtie (pas la surface Carrez), parking ou cave parfois compris dans le prix, ni étage, ni état, ni extérieur." : '') +
      carte("La mesure de l'erreur", erreur, val ? 'Mesurée sur des ventes que le modèle évalué n\'avait jamais vues.' : '')

  }

  // Anneau de fiabilité : la part remplie suit la fiabilité mesurée du secteur,
  // la couleur suit la classe (vert, ambre, rouge, gris), comme l'étiquette à côté.
  function anneau(f, ton) {
    if (f == null) return ''
    const R = 44, C = 2 * Math.PI * R, part = C * Math.min(1, Math.max(0, f))
    const couleur = { vert: 'var(--vert)', ambre: 'var(--ambre)', rouge: 'var(--rouge)', gris: 'var(--gris)' }[ton]
      || (f >= 0.8 ? 'var(--vert)' : f >= 0.6 ? 'var(--ambre)' : 'var(--rouge)')
    return `<svg viewBox="0 0 110 110" style="width:110px;display:block" role="img" aria-label="Fiabilité de l'estimation">
      <circle cx="55" cy="55" r="${R}" fill="none" stroke="var(--fond)" stroke-width="11"/>
      <circle cx="55" cy="55" r="${R}" fill="none" stroke="${couleur}" stroke-width="11" stroke-linecap="round"
        stroke-dasharray="${part} ${C - part}" transform="rotate(-90 55 55)"/>
      <text x="55" y="58" text-anchor="middle" font-size="26" font-style="italic" font-family="Instrument Serif,serif" fill="var(--encre)">${Math.round(f * 100)}</text>
      <text x="55" y="73" text-anchor="middle" font-size="9" font-family="Inter,sans-serif" fill="var(--gris)">FIABILITÉ</text></svg>`
  }

  // Évolution du prix au m² : même grammaire que les autres graphiques (grille,
  // axe gradué, libellés en sans-serif). L'échelle couvre au moins ±15 % autour
  // de la moyenne : une baisse de 10 % ne doit pas ressembler à un effondrement.
  function courbe(val, annees) {
    const L = 900, H = 260, mg = 60, md = 24, mh = 30, mb = 34
    const centre = (Math.min(...val) + Math.max(...val)) / 2
    const demi = Math.max(((Math.max(...val) - Math.min(...val)) / 2) * 1.2, centre * 0.15)
    const min = centre - demi, max = centre + demi
    const x = (i) => mg + (i * (L - mg - md)) / (val.length - 1)
    const y = (v) => mh + (H - mh - mb) * (1 - (v - min) / (max - min))
    const k = (v) => (v / 1000).toFixed(1).replace('.', ',') + 'k'
    const grilles = [0, 1, 2, 3, 4].map((i) => min + ((max - min) * i) / 4)
    const ligne = val.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ')
    const resume = `Prix médian au m² : ${val.map((v, i) => `${annees[i]} ${nb(v)} €`).join(', ')}`
    return `<svg viewBox="0 0 ${L} ${H}" style="width:100%;height:auto" role="img" aria-label="${resume}">
      ${grilles.map((g) => `<line x1="${mg}" x2="${L - md}" y1="${y(g)}" y2="${y(g)}" stroke="var(--ligne)"/>
        <text x="${mg - 8}" y="${y(g) + 4}" text-anchor="end" font-size="13" font-family="Inter,sans-serif" fill="var(--gris)">${k(g)}</text>`).join('')}
      <path d="${ligne}" fill="none" stroke="var(--encre)" stroke-width="2.5" stroke-linejoin="round"/>
      ${val.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4.5" fill="var(--blanc)" stroke="var(--encre)" stroke-width="2"/>
        <text x="${x(i) + (i === 0 ? 8 : i === val.length - 1 ? -8 : 0)}" y="${y(v) - 12}" text-anchor="${i === 0 ? 'start' : i === val.length - 1 ? 'end' : 'middle'}" font-size="13" font-weight="600" font-family="Inter,sans-serif" fill="var(--encre)">${nb(v)} €</text>
        <text x="${x(i)}" y="${H - 10}" text-anchor="middle" font-size="13" font-family="Inter,sans-serif" fill="var(--gris)">${annees[i]}</text>`).join('')}</svg>`
  }

  $('#rsai-pv-voir').addEventListener('click', () => {
    if (dernierBien && onPlusValue) onPlusValue(dernierBien)
  })
  $('#rsai-fin-voir').addEventListener('click', () => {
    if (dernierBien && onFinancement) onFinancement(dernierBien)
  })
  $('#rsai-pdf').addEventListener('click', () => exporterPDF(dernierBien, modelInfo))
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
    $('#rsai-adresse').value = v.adresse_normalisee || v.address || ''
    $('#rsai-cp').value = v.postal_code || ''
    selecteur.value = !$('#rsai-adresse').value ? (v.commune || '') : ''
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
