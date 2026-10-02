// Illustrations additionnelles de l'artefact "Estimation" (vignettes
// services + grille marché) + ré-export du fond de héros déjà porté dans
// src/illustrations.js pour éviter la duplication.
export { heroEstimation } from '../illustrations.js'

let uid = 0
const id = (p) => p + (++uid)

export function heroTour() {
  const c = id('c'), f = id('f')
  let s = `<svg viewBox="0 0 400 480" preserveAspectRatio="xMidYMid slice"><defs>
    <linearGradient id="${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FB0CF"/><stop offset="1" stop-color="#E9DDCB"/></linearGradient>
    <linearGradient id="${f}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F4F1EC"/><stop offset="1" stop-color="#BDB5A9"/></linearGradient></defs>
    <rect width="400" height="480" fill="url(#${c})"/><rect x="96" y="40" width="190" height="460" fill="url(#${f})"/><rect x="286" y="70" width="64" height="430" fill="#9E968A"/>`
  for (let j = 0; j < 13; j++) for (let i = 0; i < 4; i++) s += `<rect x="${110 + i * 44}" y="${60 + j * 32}" width="30" height="20" rx="2" fill="#3F4D5C" opacity="${0.62 + ((i + j) % 3) * 0.12}"/>`
  for (let j = 0; j < 13; j++) s += `<rect x="296" y="${86 + j * 32}" width="44" height="16" fill="#2F3A45" opacity=".55"/>`
  return s + `<rect y="440" width="400" height="40" fill="#3B4A3A"/></svg>`
}

export function heroVilla() {
  const c = id('c')
  return `<svg viewBox="0 0 400 480" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B7C9D8"/><stop offset="1" stop-color="#F1E6D6"/></linearGradient></defs>
    <rect width="400" height="480" fill="url(#${c})"/><rect x="40" y="196" width="230" height="130" fill="#F7F5F1"/><rect x="130" y="126" width="220" height="92" fill="#FFFFFF"/>
    <rect x="130" y="210" width="220" height="10" fill="#D8D2C8"/><rect x="150" y="146" width="180" height="46" fill="#39434D"/>
    <rect x="60" y="236" width="120" height="70" fill="#4A5561"/><rect x="196" y="236" width="56" height="90" fill="#2B333B"/>
    <rect x="0" y="326" width="400" height="154" fill="#5F7A57"/><rect x="0" y="326" width="400" height="18" fill="#7E9670"/>
    <rect x="290" y="340" width="96" height="46" rx="4" fill="#8FC3D6" opacity=".9"/>
    <circle cx="352" cy="170" r="52" fill="#2E4A30"/><circle cx="378" cy="206" r="40" fill="#24402A"/></svg>`
}

export function heroInterieur() {
  const m = id('m'), f = id('f')
  return `<svg viewBox="0 0 400 480" preserveAspectRatio="xMidYMid slice"><defs>
    <linearGradient id="${m}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6B5140"/><stop offset="1" stop-color="#2E2119"/></linearGradient>
    <linearGradient id="${f}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8B884"/><stop offset="1" stop-color="#7D6A8A"/></linearGradient></defs>
    <rect width="400" height="480" fill="url(#${m})"/><rect x="150" y="60" width="210" height="270" fill="url(#${f})"/>
    <rect x="252" y="60" width="4" height="270" fill="#2E2119"/><rect x="150" y="190" width="210" height="4" fill="#2E2119"/>
    <rect y="380" width="400" height="100" fill="#241A13"/><rect x="40" y="318" width="220" height="70" rx="16" fill="#C9B8A3"/>
    <rect x="52" y="296" width="196" height="40" rx="14" fill="#DDCDB9"/>
    <line x1="318" y1="200" x2="318" y2="380" stroke="#1A120D" stroke-width="3"/><ellipse cx="318" cy="196" rx="26" ry="14" fill="#F4D9A8"/>
    <circle cx="318" cy="210" r="60" fill="#F4D9A8" opacity=".12"/></svg>`
}

export function heroBois() {
  const c = id('c')
  let s = `<svg viewBox="0 0 400 480" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#435A7A"/><stop offset=".7" stop-color="#C79A7E"/><stop offset="1" stop-color="#E7C29A"/></linearGradient></defs>
    <rect width="400" height="480" fill="url(#${c})"/><path d="M60 330 L60 190 L200 110 L340 190 L340 330 Z" fill="#4A3527"/>`
  for (let i = 0; i < 28; i++) s += `<rect x="${64 + i * 10}" y="120" width="2" height="210" fill="#2E2018" opacity=".4"/>`
  return s + `<path d="M60 190 L200 110 L340 190" stroke="#2A1D14" stroke-width="10" fill="none"/>
    <rect x="98" y="220" width="84" height="110" fill="#FFD58A"/><rect x="218" y="220" width="84" height="60" fill="#FFD58A" opacity=".85"/>
    <circle cx="140" cy="280" r="90" fill="#FFD58A" opacity=".1"/><rect y="330" width="400" height="150" fill="#2C3A2A"/></svg>`
}
