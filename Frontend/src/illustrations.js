// Illustrations SVG générées — reprises des artefacts de design Claude.
// Portage direct des générateurs JS en chaînes SVG (mêmes dégradés, même
// composition), pour garder l'identité visuelle des artefacts dans l'app React.

let uid = 0
const id = (p) => p + (++uid)

function seeded(g) {
  return () => ((g = (g * 16807) % 2147483647) - 1) / 2147483646
}

function palmier(x, y, e) {
  let s = `<g transform="translate(${x},${y}) scale(${e})"><path d="M0 0 Q-8 -120 6 -250" stroke="#2A2118" stroke-width="7" fill="none"/>`
  for (let a = 0; a < 9; a++) {
    const rad = ((-160 + a * 40) * Math.PI) / 180
    const lx = Math.cos(rad) * 110
    const ly = Math.sin(rad) * 52
    s += `<path d="M6 -250 Q${6 + lx * 0.5} ${-250 + ly - 30} ${6 + lx} ${-250 + ly + 26}" stroke="#1F3A26" stroke-width="9" fill="none" stroke-linecap="round"/>`
  }
  return s + `</g>`
}

/** Immeubles au crépuscule, palmiers — fond du bandeau "Estimation". */
export function heroEstimation() {
  const c = id('c'), d = id('d'), v = id('v'), s = id('s'), t = id('t')
  let svg = `<svg viewBox="0 0 1200 680" preserveAspectRatio="xMidYMid slice"><defs>
    <linearGradient id="${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5E7FA8"/><stop offset=".5" stop-color="#9DB2CC"/><stop offset=".86" stop-color="#E6CCB0"/><stop offset="1" stop-color="#F0D6B6"/></linearGradient>
    <linearGradient id="${d}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FAF7F2"/><stop offset="1" stop-color="#CFC8BD"/></linearGradient>
    <linearGradient id="${v}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A9BCCF"/><stop offset=".6" stop-color="#6E8298"/><stop offset="1" stop-color="#4A5A6C"/></linearGradient>
    <radialGradient id="${s}" cx=".78" cy=".78" r=".45"><stop offset="0" stop-color="#FFE1B4" stop-opacity=".85"/><stop offset="1" stop-color="#FFE1B4" stop-opacity="0"/></radialGradient>
    <linearGradient id="${t}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2D4A34"/><stop offset="1" stop-color="#16271B"/></linearGradient></defs>
    <rect width="1200" height="680" fill="url(#${c})"/><rect width="1200" height="680" fill="url(#${s})"/>`
  for (let i = 0; i < 7; i++) {
    const y = 330 + i * 34, o = Math.sin(i * 0.9) * 10
    svg += `<rect x="${258 + o}" y="${y}" width="170" height="34" fill="url(#${v})" opacity=".85"/><rect x="${244 + o}" y="${y + 26}" width="198" height="8" rx="4" fill="url(#${d})"/>`
  }
  for (let i = 0; i < 11; i++) {
    const y = 78 + i * 46, g = Math.sin(i * 0.72) * 34, dr = Math.sin(i * 0.72 + 1.3) * 26
    svg += `<rect x="${560 + g * 0.3}" y="${y}" width="330" height="46" fill="url(#${v})"/>`
    for (let m = 0; m < 7; m++) svg += `<rect x="${575 + m * 47 + g * 0.3}" y="${y + 4}" width="2" height="36" fill="#E8EEF4" opacity=".35"/>`
    svg += `<path d="M${505 + g} ${y + 31} Q${470 + g} ${y + 42} ${505 + g} ${y + 48} L${930 + dr} ${y + 48} Q${975 + dr} ${y + 40} ${930 + dr} ${y + 31} Z" fill="#DDE6EE" opacity=".42"/>`
    svg += `<path d="M${500 + g} ${y + 44} Q${466 + g} ${y + 51} ${500 + g} ${y + 57} L${935 + dr} ${y + 57} Q${980 + dr} ${y + 50} ${935 + dr} ${y + 44} Z" fill="url(#${d})"/>`
  }
  const r = seeded(9)
  for (let i = 0; i < 46; i++) {
    const x = r() * 1240 - 20, y = 560 + r() * 110, rr = 34 + r() * 46
    svg += `<circle cx="${x}" cy="${y}" r="${rr}" fill="url(#${t})" opacity="${(0.72 + r() * 0.28).toFixed(2)}"/>`
  }
  return svg + palmier(1030, 640, 1) + palmier(150, 660, 0.85) + `</svg>`
}

/** Salon avec baie vitrée sur les toits au crépuscule — fond "Financement". */
export function heroFinancement() {
  const m = id('m'), c = id('c'), s = id('s'), r = seeded(31)
  let toits = ''
  for (let x = 560, k = 0; x < 1220; k++) {
    const l = 40 + r() * 60, h = 60 + r() * 110, y = 420 - h
    toits += `<path d="M${x} 420 L${x} ${y + 12} L${x + 10} ${y} L${x + l - 10} ${y} L${x + l} ${y + 12} L${x + l} 420 Z" fill="#2A2233"/>`
    for (let j = 0; j < Math.floor(h / 26); j++)
      for (let i = 0; i < Math.floor(l / 18); i++)
        if (r() > 0.55) toits += `<rect x="${x + 8 + i * 16}" y="${y + 18 + j * 24}" width="5" height="8" fill="#FFD28A" opacity="${(0.45 + r() * 0.5).toFixed(2)}"/>`
    x += l + 3
  }
  return `<svg viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice"><defs>
    <linearGradient id="${m}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5C4636"/><stop offset="1" stop-color="#2B2019"/></linearGradient>
    <linearGradient id="${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3E4A78"/><stop offset=".6" stop-color="#B7788A"/><stop offset="1" stop-color="#F0B27E"/></linearGradient>
    <radialGradient id="${s}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFD9A0" stop-opacity=".55"/><stop offset="1" stop-color="#FFD9A0" stop-opacity="0"/></radialGradient></defs>
    <rect width="1200" height="520" fill="url(#${m})"/>
    <rect x="540" y="40" width="640" height="380" fill="url(#${c})"/>${toits}
    <rect x="540" y="40" width="640" height="6" fill="#1E1611"/><rect x="856" y="40" width="7" height="380" fill="#1E1611"/>
    <rect x="540" y="414" width="640" height="8" fill="#1E1611"/>
    <rect y="440" width="1200" height="80" fill="#231A14"/>
    <rect x="600" y="360" width="380" height="96" rx="22" fill="#CDBBA6"/>
    <rect x="618" y="330" width="344" height="52" rx="20" fill="#DFCFBB"/>
    <line x1="1080" y1="210" x2="1080" y2="448" stroke="#15100C" stroke-width="4"/>
    <ellipse cx="1080" cy="204" rx="38" ry="18" fill="#F6DDA8"/>
    <circle cx="1080" cy="230" r="110" fill="url(#${s})"/>
  </svg>`
}

/** Toits de Paris à l'aube — fond "Plus-value". */
export function heroPlusValue() {
  const c = id('c'), s = id('s')
  let plans = ''
  ;[
    [330, '#8C6F86', 0.28, 70, 120, 4],
    [400, '#5E4A62', 0.4, 90, 160, 11],
    [470, '#3A2E40', 0.5, 110, 210, 23],
  ].forEach(([base, coul, op, hmin, hmax, g]) => {
    const rr = seeded(g)
    for (let x = -20; x < 1240; ) {
      const l = 50 + rr() * 70, h = hmin + rr() * (hmax - hmin), y = base - h
      plans += `<path d="M${x} 520 L${x} ${y + 14} L${x + 12} ${y} L${x + l - 12} ${y} L${x + l} ${y + 14} L${x + l} 520 Z" fill="${coul}"/>`
      for (let k = 0; k < Math.floor(rr() * 3); k++) {
        const cx = x + 10 + rr() * (l - 20)
        plans += `<rect x="${cx}" y="${y - 9}" width="6" height="11" fill="${coul}"/>`
      }
      for (let j = 0; j < Math.floor(h / 26); j++)
        for (let i = 0; i < Math.floor(l / 18); i++)
          if (rr() > 0.8) plans += `<rect x="${x + 9 + i * 16}" y="${y + 22 + j * 24}" width="5" height="8" fill="#FFE2B0" opacity="${op}"/>`
      x += l + 2
    }
  })
  return `<svg viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice"><defs>
    <linearGradient id="${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7F8FB8"/><stop offset=".45" stop-color="#D8A9B4"/><stop offset=".8" stop-color="#F6C99E"/><stop offset="1" stop-color="#FBE1BE"/></linearGradient>
    <radialGradient id="${s}" cx=".72" cy=".62" r=".3"><stop offset="0" stop-color="#FFF4DD"/><stop offset=".25" stop-color="#FFE0A6" stop-opacity=".9"/><stop offset="1" stop-color="#FFE0A6" stop-opacity="0"/></radialGradient></defs>
    <rect width="1200" height="520" fill="url(#${c})"/><rect width="1200" height="520" fill="url(#${s})"/>
    <circle cx="864" cy="322" r="42" fill="#FFF3DA" opacity=".95"/>${plans}</svg>`
}
