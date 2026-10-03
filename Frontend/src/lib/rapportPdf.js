// Rapport d'estimation imprimable (une page A4), enregistrable en PDF depuis
// la boîte d'impression du navigateur.
//
// Règle : chaque chiffre vient d'une réponse du backend (estimation,
// /api/market/map, /api/market/trends, /api/health). Une donnée absente est
// omise ou signalée « non communiquée », jamais complétée.

import { METHODES } from '../api/normalize'
import { heroEstimation } from '../illustrations'
import { DPE_COULEURS, libelleFourchette, niveauFiabilite } from './estimation'
import { dateHeure, dateLongue, euro, euroM2, nb, pct, pctPoints } from './format'
import { nomDepartement } from './geo'
import { MOIS_COURTS, syntheseAnnuelle, variationDouzeMois } from './tendance'

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const TYPES = { apartment: 'Appartement', house: 'Maison' }

const EXPLICATION_METHODE = {
  ml: 'Le prix est prédit par un modèle de gradient boosting (LightGBM) entraîné sur les ventes notariées DVF d’Île-de-France. L’adresse est géolocalisée par la Base Adresse Nationale, puis le modèle combine les caractéristiques du bien et celles de son environnement.',
  dvf: 'Le prix est la médiane des ventes notariées DVF comparables (même secteur, type et surface proche). La fourchette correspond aux 1er et 3e quartiles de ces ventes.',
  mock: 'Le serveur ne disposait d’aucune donnée exploitable pour ce bien : le montant résulte d’une heuristique de démonstration et ne constitue pas une estimation.',
}

/** Référence courte et stable pour une estimation donnée. */
function reference(at, lieu) {
  let h = 0
  for (const c of `${at}|${lieu}`) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const d = new Date(at)
  const jour = Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10).replace(/-/g, '')
  return `RSAI-${jour}-${h.toString(36).toUpperCase().slice(0, 5).padStart(5, '0')}`
}

function niceTicks(min, max, count = 4) {
  if (!(max > min)) return [min]
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const ticks = []
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.5; v += step) ticks.push(Math.round(v))
  return ticks
}

const k = (v) => `${(v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k€`

// ── Éléments graphiques (SVG statique) ────────────────────────────────────

function anneau(valeur) {
  const lvl = niveauFiabilite(valeur)
  const couleur = { success: '#3E7A5B', warning: '#A9701F', danger: '#B5533F' }[lvl?.tone] ?? '#CFC7BB'
  const R = 40
  const C = 2 * Math.PI * R
  const part = C * Math.min(1, Math.max(0, valeur ?? 0))
  return `<svg width="46" height="46" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="${R}" fill="none" stroke="#E3DED6" stroke-width="9"/>
    <circle cx="50" cy="50" r="${R}" fill="none" stroke="${couleur}" stroke-width="9" stroke-linecap="round"
      stroke-dasharray="${part} ${C - part}" transform="rotate(-90 50 50)"/>
    <text x="50" y="56" text-anchor="middle" font-family="Instrument Serif, Georgia, serif" font-size="28" fill="#141311">${valeur != null ? Math.round(valeur * 100) : '—'}</text>
  </svg>`
}

function barrePosition(q1, med, q3, valeur) {
  const lo = Math.min(q1, valeur ?? q1) * 0.85
  const hi = Math.max(q3, valeur ?? q3) * 1.1
  const p = (v) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))
  return `<div class="position">
    <div class="position-piste"></div>
    <div class="position-bande" style="left:${p(q1)}%;width:${p(q3) - p(q1)}%"></div>
    <div class="position-mediane" style="left:${p(med)}%"></div>
    ${valeur != null ? `<div class="position-bien" style="left:${p(valeur)}%"></div>` : ''}
  </div>`
}

function courbe(rows, annees) {
  const W = 520
  const H = 200
  const m = { top: 16, right: 10, bottom: 22, left: 44 }
  const iw = W - m.left - m.right
  const ih = H - m.top - m.bottom
  const vals = rows.map((r) => r.prix_m2_median)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const pad = (hi - lo) * 0.1 || hi * 0.05 || 1
  const ticks = niceTicks(lo - pad, hi + pad)
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const n = rows.length
  const x = (i) => m.left + (n > 1 ? (i * iw) / (n - 1) : iw / 2)
  const y = (v) => m.top + ih * (1 - (v - yMin) / (yMax - yMin || 1))
  const d = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(r.prix_m2_median).toFixed(1)}`).join(' ')

  // Une année sur deux teintée (sable), comme sur la page.
  const janviers = rows.map((r, i) => (r.mois === 1 ? i : -1)).filter((i) => i >= 0)
  const bandes = janviers
    .filter((_, j) => j % 2 === 1)
    .map((from) => {
      const fin = janviers.find((i) => i > from) ?? n - 1
      return `<rect x="${x(from)}" y="${m.top}" width="${x(fin) - x(from)}" height="${ih}" fill="#F5EBDD"/>`
    })

  // Repère annuel : prix moyen de l'année, au milieu de ses mois.
  const reperes = annees.map((a2) => {
    const idx = rows.map((r, i) => (r.annee === a2.annee ? i : -1)).filter((i) => i >= 0)
    const xi = (x(idx[0]) + x(idx[idx.length - 1])) / 2
    return `<circle cx="${xi.toFixed(1)}" cy="${y(a2.prix).toFixed(1)}" r="3.4" fill="#FFFFFF" stroke="#2A1F17" stroke-width="1.8"/>
      <text x="${xi.toFixed(1)}" y="${(y(a2.prix) - 8).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="#2A1F17" stroke="#FFFFFF" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke">${esc(k(a2.prix))}</text>`
  })

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" aria-hidden="true" style="display:block">
    <defs><linearGradient id="aire" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#C2893A" stop-opacity=".34"/><stop offset="1" stop-color="#C2893A" stop-opacity="0"/>
    </linearGradient></defs>
    ${bandes.join('')}
    ${ticks.map((t) => `<line x1="${m.left}" x2="${W - m.right}" y1="${y(t)}" y2="${y(t)}" stroke="#E3DED6" ${t === yMin ? '' : 'stroke-dasharray="2 4"'}/>
      <text x="${m.left - 6}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="#6B655E">${esc(k(t))}</text>`).join('')}
    ${rows.map((r, i) => (r.mois === 1 ? `<text x="${x(i)}" y="${H - 5}" text-anchor="middle" font-size="11" fill="#6B655E">${r.annee}</text>` : '')).join('')}
    <path d="${d} L${x(n - 1)} ${m.top + ih} L${x(0)} ${m.top + ih} Z" fill="url(#aire)"/>
    <path d="${d}" fill="none" stroke="#C2893A" stroke-width="2.2" stroke-linejoin="round"/>
    ${reperes.join('')}
    <circle cx="${x(n - 1)}" cy="${y(vals[n - 1])}" r="7" fill="#C2893A" opacity=".2"/>
    <circle cx="${x(n - 1)}" cy="${y(vals[n - 1])}" r="3.4" fill="#C2893A"/>
  </svg>`
}

// ── Assemblage ───────────────────────────────────────────────────────────

const ligne = ([k2, v]) => `<tr><th>${esc(k2)}</th><td>${v}</td></tr>`
const nc = '<span class="nc">non communiqué</span>'

/**
 * Ouvre le rapport dans une nouvelle fenêtre et lance l'impression.
 * Renvoie false si le navigateur bloque la fenêtre.
 */
export function exporterRapport({ r, values, lieu, description, at, stats, dep, trendRows = [], health }) {
  const w = window.open('', '_blank')
  if (!w) return false

  const ref = reference(at, lieu)
  const methode = METHODES[r.method]
  const fiab = niveauFiabilite(r.reliability)
  const m = health?.model?.loaded ? health.model : null
  const ecart = !r.isDemo && r.pricePerM2 != null && stats?.prix_m2_median ? r.pricePerM2 / stats.prix_m2_median - 1 : null
  const annees = trendRows.length ? syntheseAnnuelle(trendRows) : []
  const dernier = trendRows[trendRows.length - 1]
  const var12 = variationDouzeMois(trendRows)
  const nomDep = nomDepartement(dep ?? stats?.code_departement)
  const dpe = r.dpeClasse ?? values.dpe

  // Phrase de synthèse, construite uniquement à partir des données disponibles.
  let synthese = `Le bien est estimé à <b>${esc(euro(r.price))}</b>`
  if (r.pricePerM2 != null) synthese += `, soit <b>${esc(euroM2(r.pricePerM2))}</b>`
  if (ecart != null) {
    synthese += `, ${Math.abs(ecart) < 0.005 ? 'au niveau de' : `<b>${esc(pct(Math.abs(ecart), { digits: 0 }))} ${ecart > 0 ? 'au-dessus' : 'en dessous'}</b> de`} la médiane de ${esc(stats.nom_commune)} (${esc(euroM2(stats.prix_m2_median))}, ${esc(nb(stats.n_transactions))} ventes)`
  }
  synthese += '.'
  if (r.low != null && r.high != null) synthese += ` ${esc(libelleFourchette(r))} : de ${esc(euro(r.low))} à ${esc(euro(r.high))}.`
  if (var12 != null && nomDep) synthese += ` Sur les 12 derniers mois, le prix médian au m² du département (${esc(nomDep)}) a évolué de ${esc(pct(var12, { signed: true }))}.`

  const bien = [
    ['Type de bien', esc(TYPES[values.type] ?? '—')],
    ['Surface habitable', `${esc(values.surface)} m²`],
    ['Nombre de pièces', values.rooms ? esc(values.rooms) : nc],
    ['Classe énergie (DPE)', dpe ? `<span class="dpe" style="background:${DPE_COULEURS[dpe]?.fond};color:${DPE_COULEURS[dpe]?.texte}">${esc(dpe)}</span>` : nc],
    ['Année de construction', r.anneeConstruction ?? values.annee ? esc(r.anneeConstruction ?? values.annee) : nc],
    values.mode === 'adresse' && ['Adresse saisie', esc(values.address)],
    r.address && ['Adresse normalisée (BAN)', esc(r.address)],
    ['Commune', esc(r.commune ?? stats?.nom_commune ?? (values.mode === 'commune' ? values.commune : '—'))],
    r.codeCommune && ['Code commune (INSEE)', esc(r.codeCommune)],
    nomDep && ['Département', `${esc(nomDep)}${dep ? ` (${esc(dep)})` : ''}`],
  ].filter(Boolean)

  const calcul = [
    r.pricePerM2 != null && ['Prix au m² estimé', esc(euroM2(r.pricePerM2))],
    r.lowPerM2 != null && r.highPerM2 != null && ['Fourchette au m²', `${esc(euroM2(r.lowPerM2))} – ${esc(euroM2(r.highPerM2))}`],
    r.reliability != null && ['Indice de fiabilité', `${Math.round(r.reliability * 100)} / 100${fiab ? ` (${esc(fiab.label.toLowerCase())})` : ''}`],
    r.localMape != null && ['Erreur médiane locale du modèle', `${esc(pctPoints(r.localMape))}${r.localMapeN ? ` (${esc(nb(r.localMapeN))} ventes de contrôle)` : ''}`],
    r.method === 'dvf' && r.meta.scope && ['Périmètre des comparables', `${esc(r.meta.scope)}${r.meta.scopeValue ? ` · ${esc(r.meta.scopeValue)}` : ''}`],
    r.method === 'dvf' && r.meta.propertyTypeUsed && ['Type de bien retenu', esc(r.meta.propertyTypeUsed)],
    r.method === 'dvf' && r.meta.nTransactions && ['Ventes comparables', esc(nb(r.meta.nTransactions))],
    r.method === 'dvf' && r.meta.dispersion != null && ['Dispersion des prix', esc(pct(r.meta.dispersion))],
    r.method === 'dvf' && r.meta.surfaceTolerance != null && ['Tolérance de surface', `± ${esc(pct(r.meta.surfaceTolerance, { digits: 0 }))}`],
    r.method === 'dvf' && r.meta.roomsTolerance != null && ['Tolérance sur les pièces', `± ${esc(r.meta.roomsTolerance)}`],
    r.dpeZonePct != null && ['Logements F/G dans le code postal', esc(pctPoints(r.dpeZonePct))],
  ].filter(Boolean)

  const modele = m
    ? [
        m.mape != null && ['Erreur moyenne (MAPE)', esc(pctPoints(m.mape))],
        m.r2 != null && ['Coefficient de détermination (R²)', esc(m.r2.toLocaleString('fr-FR', { maximumFractionDigits: 3 }))],
        m.nFeatures != null && ['Variables utilisées', esc(nb(m.nFeatures))],
        m.nTransactions != null && ['Transactions analysées', esc(nb(m.nTransactions))],
        m.nTrain != null && ['Ventes d’entraînement', esc(nb(m.nTrain))],
        m.nTest != null && ['Ventes de test', esc(nb(m.nTest))],
        m.trainedAt && ['Date d’entraînement', esc(dateLongue(m.trainedAt))],
      ].filter(Boolean)
    : []

  const dvf = health?.dvf
  const sources = [
    ['DVF', `DGFiP / Etalab — ventes notariées${dvf?.minYear && dvf?.maxYear ? ` ${dvf.minYear}–${dvf.maxYear}` : ''} : prix et tendances.`],
    ['Base Adresse Nationale', 'géocodage, commune et code INSEE.'],
    ['DPE — ADEME', `classe énergie et passoires thermiques${health?.dpe?.coveragePct != null ? ` (couverture ${pctPoints(health.dpe.coveragePct)})` : ''}.`],
    ['geo.api.gouv.fr', 'découpage communes et départements.'],
  ]

  const illustration = heroEstimation()
  const titre = `Rapport d’estimation — ${lieu}`
  const tendanceCls = (v) => (v == null ? '' : v >= 0 ? 'hausse' : 'baisse')
  const fleche = (v) => (v == null ? '' : v >= 0 ? '↗ ' : '↘ ')

  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>${esc(titre)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 9mm 10mm 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html { background: #E9E5DE; }
  body { margin: 0; font: 7.6pt/1.42 Inter, Helvetica, Arial, sans-serif; color: #141311; }
  /* Zone imprimable A4 : 190 × 278 mm. */
  .page { width: 190mm; height: 278mm; margin: 0 auto; overflow: hidden; }
  .contenu { transform-origin: top left; display: flex; flex-direction: column; gap: 2.8mm; min-height: 100%; }
  @media screen {
    .feuille { width: 210mm; margin: 64px auto 32px; padding: 9mm 10mm 10mm; background: #fff; box-shadow: 0 10px 40px rgba(0,0,0,.12); }
    .barre-outils { position: fixed; inset: 0 0 auto; z-index: 9; display: flex; justify-content: center; gap: 10px; padding: 12px; background: rgba(243,241,236,.94); border-bottom: 1px solid #E3DED6; font: 13px Inter, sans-serif; }
    .barre-outils button { font: 600 13px Inter, sans-serif; padding: 9px 18px; border-radius: 999px; border: 0; background: #2A1F17; color: #fff; cursor: pointer; }
    .barre-outils span { align-self: center; color: #6B655E; }
  }
  @media print { html { background: #fff; } .barre-outils { display: none; } }
  em { font-family: 'Instrument Serif', Georgia, serif; font-style: italic; font-weight: 400; }
  .entete { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 2.2mm; border-bottom: 1px solid #E3DED6; }
  .marque { font-size: 12pt; font-weight: 600; letter-spacing: -.01em; }
  .marque em { color: #A38C77; font-size: 13.5pt; }
  .entete-droite { text-align: right; font-size: 7pt; color: #6B655E; line-height: 1.4; }
  .entete-droite b { color: #141311; font-size: 8.5pt; }
  .surtitre { font-size: 6.4pt; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: #6B655E; margin: 0 0 1mm; }
  h3 { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-size: 12pt; line-height: 1.1; margin: 0 0 1.6mm; }
  h3 em { color: #3D3832; }
  .bandeau { position: relative; height: 40mm; border-radius: 4mm; overflow: hidden; background: #8BA3C0; color: #fff; flex: none; }
  .bandeau .illus, .bandeau .illus svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .bandeau .voile { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(15,20,30,.12) 0%, rgba(15,20,30,0) 30%, rgba(20,16,12,.80) 100%), linear-gradient(270deg, rgba(20,16,12,.45), rgba(20,16,12,0) 55%); }
  .bandeau .methode { position: absolute; top: 3.5mm; right: 4mm; background: rgba(255,255,255,.92); color: #141311; border-radius: 999px; padding: .8mm 2.6mm; font-size: 7pt; font-weight: 600; }
  .bandeau .gauche { position: absolute; left: 5.5mm; bottom: 4.5mm; max-width: 52%; }
  .bandeau .droite { position: absolute; right: 5.5mm; bottom: 4.5mm; text-align: right; }
  .bandeau .surtitre { color: rgba(255,255,255,.8); }
  .bandeau .lieu { font-family: 'Instrument Serif', Georgia, serif; font-size: 17pt; line-height: 1.05; margin: 0; }
  .bandeau .desc { margin: 1mm 0 0; font-size: 8pt; color: rgba(255,255,255,.88); }
  .bandeau .prix { font-size: 25pt; font-weight: 600; letter-spacing: -.035em; line-height: 1; margin: 0; white-space: nowrap; }
  .bandeau .fourchette { margin: 1.4mm 0 0; font-size: 7.6pt; color: rgba(255,255,255,.88); }
  .kpis { display: grid; grid-template-columns: repeat(5, 1fr) 1.35fr; gap: 2mm; }
  .kpi { background: #F3F1EC; border-radius: 2.5mm; padding: 2.2mm 2.6mm; }
  .kpi.ambre { background: #F5EBDD; }
  .kpi b { display: block; font-size: 10.5pt; font-weight: 600; letter-spacing: -.02em; white-space: nowrap; }
  .kpi span { font-size: 6.6pt; color: #6B655E; }
  .kpi.fiab { display: flex; align-items: center; gap: 2mm; padding: 1.2mm 2.2mm; }
  .synthese { background: #F5EBDD; border-radius: 3mm; padding: 2.6mm 4mm; font-size: 8.2pt; line-height: 1.5; margin: 0; }
  .alerte { background: #F7EDDC; border: 1px solid #E5CFA6; border-radius: 2.5mm; padding: 1.8mm 3mm; font-size: 7.6pt; margin: 0; }
  .grille { display: grid; gap: 5mm; }
  .g2 { grid-template-columns: 1fr 1fr; }
  .g-tendance { grid-template-columns: 1.5fr 1fr; align-items: start; }
  .g3 { grid-template-columns: 1fr 1fr 1fr; }
  .carte { border: 1px solid #E3DED6; border-radius: 3mm; padding: 3mm 3.6mm; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 1.05mm 0; border-bottom: 1px solid #EFEBE4; text-align: left; vertical-align: top; font-size: 7.4pt; }
  th { font-weight: 400; color: #6B655E; padding-right: 2mm; }
  td { font-weight: 500; text-align: right; }
  tr:last-child th, tr:last-child td { border-bottom: 0; }
  .annuel th, .annuel td { text-align: right; }
  .annuel th:first-child, .annuel td:first-child { text-align: left; }
  .annuel thead th { font-size: 6.2pt; text-transform: uppercase; letter-spacing: .08em; border-bottom: 1px solid #E3DED6; }
  .annuel tr.derniere td { font-weight: 600; }
  .position { position: relative; height: 5.5mm; margin: 1.5mm 0 .6mm; }
  .position-piste, .position-bande { position: absolute; top: 2mm; height: 1.5mm; border-radius: 99px; }
  .position-piste { left: 0; right: 0; background: #EFEBE4; }
  .position-bande { background: linear-gradient(90deg, #D9CBB9, #C2893A); }
  .position-mediane { position: absolute; top: 1mm; width: .45mm; height: 3.5mm; margin-left: -.22mm; background: #3D3832; }
  .position-bien { position: absolute; top: .95mm; width: 3.6mm; height: 3.6mm; margin-left: -1.8mm; border-radius: 50%; background: #fff; border: 1.1mm solid #141311; }
  .quartiles { display: flex; justify-content: space-between; font-size: 6.6pt; color: #6B655E; }
  .quartiles b { display: block; color: #141311; font-size: 7.8pt; }
  .entete-carte { display: flex; justify-content: space-between; align-items: baseline; gap: 3mm; }
  .chips { display: flex; gap: 1.5mm; flex-wrap: wrap; margin: 0 0 1.5mm; }
  .chip { background: #F3F1EC; border-radius: 999px; padding: .5mm 2.2mm; font-size: 6.8pt; }
  .chip b { font-weight: 600; }
  .hausse { color: #3E7A5B; } .baisse { color: #B5533F; }
  .note { font-size: 6.4pt; color: #6B655E; margin: 1.2mm 0 0; line-height: 1.45; }
  .nc { color: #8A847C; font-weight: 400; font-style: italic; }
  .dpe { display: inline-block; min-width: 4.5mm; text-align: center; border-radius: 1.2mm; padding: 0 1.2mm; font-weight: 600; }
  ul { padding-left: 3.6mm; margin: 0; }
  li { margin: 0 0 1mm; font-size: 7.2pt; }
  li b { font-weight: 600; }
  .methode-texte { font-size: 7.4pt; color: #3D3832; margin: 0 0 1.5mm; }
  .pied { margin-top: auto; padding-top: 2mm; border-top: 1px solid #E3DED6; display: flex; justify-content: space-between; gap: 4mm; font-size: 6.6pt; color: #6B655E; }
</style></head><body>
<div class="barre-outils"><span>Rapport prêt.</span><button onclick="window.print()">Imprimer / Enregistrer en PDF</button></div>
<div class="feuille"><main class="page"><div class="contenu">

  <header class="entete">
    <div class="marque">RealState<em>AI</em></div>
    <div class="entete-droite"><b>Rapport d’estimation</b><br>Réf. ${esc(ref)} · établi le ${esc(dateHeure(at))}</div>
  </header>

  <section class="bandeau">
    <div class="illus">${illustration}</div>
    <div class="voile"></div>
    <span class="methode">${esc(methode.label)}</span>
    <div class="gauche">
      <p class="surtitre">Bien estimé · Île-de-France</p>
      <p class="lieu">${esc(lieu)}</p>
      <p class="desc">${esc(description)}</p>
    </div>
    <div class="droite">
      <p class="surtitre">Valeur estimée</p>
      <p class="prix">${esc(euro(r.price))}</p>
      ${r.low != null && r.high != null ? `<p class="fourchette">${esc(libelleFourchette(r))}<br><b>${esc(euro(r.low))} – ${esc(euro(r.high))}</b></p>` : ''}
    </div>
  </section>

  <section class="kpis">
    <div class="kpi ambre"><b>${esc(euroM2(r.pricePerM2))}</b><span>Prix au m² estimé</span></div>
    <div class="kpi"><b>${r.lowPerM2 != null && r.highPerM2 != null ? `${esc(nb(r.lowPerM2))}–${esc(nb(r.highPerM2))}` : '—'}</b><span>Fourchette au m² (€)</span></div>
    <div class="kpi"><b>${stats ? esc(euroM2(stats.prix_m2_median)) : '—'}</b><span>Médiane de la commune</span></div>
    <div class="kpi"><b class="${tendanceCls(ecart)}">${ecart != null ? esc(pct(ecart, { digits: 0, signed: true })) : '—'}</b><span>Écart à la médiane</span></div>
    <div class="kpi"><b>${stats ? esc(nb(stats.n_transactions)) : '—'}</b><span>Ventes dans la commune</span></div>
    <div class="kpi fiab">${anneau(r.reliability)}<span><b style="font-size:8pt">Fiabilité${fiab ? ` ${esc(fiab.label.toLowerCase())}` : ''}</b>${r.localMape != null ? `Erreur locale : ${esc(pctPoints(r.localMape))}` : 'Indice du serveur, sur 100'}</span></div>
  </section>

  ${r.isDemo ? '<p class="alerte"><b>Mode démonstration.</b> Le serveur ne disposait d’aucune donnée exploitable pour ce bien : le montant résulte d’une heuristique et ne constitue pas une estimation.</p>' : ''}
  ${r.geocodingWarning ? `<p class="alerte">${esc(r.geocodingWarning)}</p>` : ''}

  <p class="synthese">${synthese}</p>

  <section class="grille g2">
    <div class="carte">
      <h3>Le <em>bien</em></h3>
      <table>${bien.map(ligne).join('')}</table>
    </div>
    <div class="carte">
      <div class="entete-carte"><h3>Position <em>dans la commune</em></h3>${stats ? `<span class="chip"><b>${esc(nb(stats.n_transactions))}</b> ventes</span>` : ''}</div>
      ${stats ? `
        <p style="margin:0;color:#3D3832">${esc(stats.nom_commune)}${nomDepartement(stats.code_departement) ? ` · ${esc(nomDepartement(stats.code_departement))}` : ''}</p>
        ${stats.prix_m2_q1 && stats.prix_m2_q3 ? barrePosition(stats.prix_m2_q1, stats.prix_m2_median, stats.prix_m2_q3, r.isDemo ? null : r.pricePerM2) : ''}
        <div class="quartiles"><span>1er quartile<b>${esc(euroM2(stats.prix_m2_q1))}</b></span><span style="text-align:center">Médiane<b>${esc(euroM2(stats.prix_m2_median))}</b></span><span style="text-align:right">3e quartile<b>${esc(euroM2(stats.prix_m2_q3))}</b></span></div>
        <p class="note">Bande : la moitié des ventes de la commune (1er–3e quartile) ; trait : médiane${!r.isDemo && r.pricePerM2 != null ? ' ; repère rond : le bien estimé' : ''}.</p>
      ` : '<p class="nc">Aucune statistique de marché pour cette commune.</p>'}
      <h3 style="margin-top:3mm">Méthode <em>d’estimation</em></h3>
      <p class="methode-texte">${esc(EXPLICATION_METHODE[r.method])}</p>
    </div>
  </section>

  <section class="carte">
    <div class="entete-carte">
      <h3>Tendance <em>du département</em></h3>
      <span class="note" style="margin:0">${nomDep ? `${esc(nomDep)} · ` : ''}prix médian au m², ventes DVF, par mois</span>
    </div>
    ${trendRows.length ? `
      <div class="chips">
        <span class="chip">Dernier mois (${esc(MOIS_COURTS[dernier.mois - 1])} ${dernier.annee}) : <b>${esc(euroM2(dernier.prix_m2_median))}</b></span>
        ${var12 != null ? `<span class="chip">Sur 12 mois : <b class="${tendanceCls(var12)}">${fleche(var12)}${esc(pct(var12, { signed: true }))}</b></span>` : ''}
        <span class="chip">Plus haut : <b>${esc(euroM2(Math.max(...trendRows.map((x) => x.prix_m2_median))))}</b></span>
        <span class="chip">Plus bas : <b>${esc(euroM2(Math.min(...trendRows.map((x) => x.prix_m2_median))))}</b></span>
      </div>
      <div class="grille g-tendance">
        <div>${courbe(trendRows, annees)}</div>
        <div>
          <table class="annuel">
            <thead><tr><th>Année</th><th>Prix au m²</th><th>Variation</th><th>Ventes</th></tr></thead>
            <tbody>${annees.map((a2, i) => `<tr class="${i === annees.length - 1 ? 'derniere' : ''}"><td>${a2.annee}${a2.partielle ? ` <span class="nc">(${esc(a2.partielle)})</span>` : ''}</td><td>${esc(euroM2(a2.prix))}</td><td class="${tendanceCls(a2.variation)}">${a2.variation != null ? esc(fleche(a2.variation) + pct(a2.variation, { signed: true })) : '—'}</td><td>${esc(nb(a2.ventes))}</td></tr>`).join('')}</tbody>
          </table>
          <p class="note">Prix annuel : moyenne des prix médians mensuels, pondérée par le nombre de ventes (repères sur la courbe).</p>
        </div>
      </div>
    ` : '<p class="nc">Aucune donnée de tendance pour ce département.</p>'}
  </section>

  <section class="grille g3">
    <div class="carte">
      <h3>Détail <em>du calcul</em></h3>
      <p class="methode-texte" style="margin-bottom:.6mm"><b>${esc(methode.label)}</b> — ${esc(methode.detail)}</p>
      <table>${calcul.map(ligne).join('')}</table>
      ${r.meta.notes.length ? `<p class="note">Serveur : ${r.meta.notes.map(esc).join(' · ')}</p>` : ''}
    </div>
    <div class="carte">
      <h3>Performance <em>du modèle</em></h3>
      ${modele.length ? `<table>${modele.map(ligne).join('')}</table>
        <p class="note">Mesuré sur des ventes de test jamais vues à l’entraînement.${r.method !== 'ml' ? ' Modèle non utilisé pour cette estimation.' : ''}</p>` : '<p class="nc">Modèle de prédiction non chargé sur le serveur.</p>'}
    </div>
    <div class="carte">
      <h3>Données <em>et limites</em></h3>
      <ul>${sources.map(([t, d2]) => `<li><b>${esc(t)}</b> — ${esc(d2)}</li>`).join('')}</ul>
      <p class="note">Estimation fondée sur des ventes passées et les seules caractéristiques renseignées (état, étage, vue ou travaux ne sont pas connus). Document indicatif : ni expertise immobilière, ni évaluation opposable.</p>
    </div>
  </section>

  <footer class="pied"><span>RealStateAI · Estimation immobilière en Île-de-France</span><span>Réf. ${esc(ref)} · ${esc(dateHeure(at))}</span></footer>
</div></main></div>
<script>
  // Garantie « une seule page » : si le contenu dépasse la zone A4, il est réduit.
  function ajuster() {
    var page = document.querySelector('.page'), c = document.querySelector('.contenu')
    c.style.transform = ''; c.style.width = ''
    var dispo = page.clientHeight, besoin = c.scrollHeight
    if (besoin > dispo) {
      var e = dispo / besoin
      c.style.transform = 'scale(' + e + ')'
      c.style.width = (100 / e) + '%'
    }
  }
  ;(document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
    ajuster()
    setTimeout(function () { window.print() }, 250)
  })
</script>
</body></html>`)
  w.document.close()
  w.focus()
  return true
}
