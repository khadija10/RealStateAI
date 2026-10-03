// Client HTTP unique pour le backend FastAPI RealStateAI.
// Base URL configurable via la variable Vite VITE_API_URL (voir .env.example).
//
// Toutes les pages passent par ce module : jeton d'authentification,
// délai maximal, annulation (AbortSignal) et messages d'erreur sont gérés
// ici, une seule fois.

// En développement (`npm run dev`), les appels passent par le proxy Vite
// (voir vite.config.js) : URL relative, pas de CORS. Le build de production
// appelle directement VITE_API_URL.
export const API_BASE = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL || 'http://localhost:8000'

const TOKEN_KEY = 'reai_token'
const DEFAULT_TIMEOUT_MS = 15000

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export function saveToken(t) {
  try { localStorage.setItem(TOKEN_KEY, t) } catch { /* navigation privée */ }
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* navigation privée */ }
}

/**
 * Erreur d'appel à l'API.
 * - `status` : code HTTP (0 si le serveur est injoignable).
 * - `kind`   : 'http' | 'network' | 'timeout' | 'aborted'.
 * Le message est celui du champ `detail` renvoyé par le backend quand il existe.
 */
export class ApiError extends Error {
  constructor(message, status, kind = 'http') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.kind = kind
  }
}

export const isAbortError = (e) => e instanceof ApiError && e.kind === 'aborted'

/**
 * Appel générique. `body` objet → sérialisé en JSON.
 * `signal` permet d'annuler l'appel (changement de page, nouvelle saisie).
 */
export async function request(path, { method = 'GET', body, signal, timeout = DEFAULT_TIMEOUT_MS, headers } = {}) {
  const token = getToken()
  const controller = new AbortController()
  let timedOut = false
  const timer = timeout ? setTimeout(() => { timedOut = true; controller.abort() }, timeout) : null
  const onAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    })
  } catch {
    if (timedOut) {
      throw new ApiError('Le serveur met trop de temps à répondre. Réessayez dans un instant.', 0, 'timeout')
    }
    if (signal?.aborted) throw new ApiError('Requête annulée.', 0, 'aborted')
    throw new ApiError("Impossible de joindre le serveur. Vérifiez votre connexion ou que le backend est démarré.", 0, 'network')
  } finally {
    if (timer) clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }

  const text = await response.text()
  let data = null
  if (text) {
    try { data = JSON.parse(text) } catch { data = text }
  }

  if (!response.ok) {
    const detail = data && typeof data === 'object' ? data.detail || data.message : null
    throw new ApiError(
      typeof detail === 'string' && detail ? detail : messageParDefaut(response.status),
      response.status,
      'http',
    )
  }
  return data
}

function messageParDefaut(status) {
  if (status === 401) return 'Votre session a expiré. Reconnectez-vous.'
  if (status === 404) return 'Ressource introuvable.'
  if (status === 429) return 'Trop de tentatives. Patientez une minute avant de réessayer.'
  if (status === 503) return 'Ce service est momentanément indisponible.'
  if (status >= 500) return `Erreur du serveur (${status}). Réessayez dans un instant.`
  return `Requête refusée (${status}).`
}

// ── Système ──────────────────────────────────────────────────────────────

// Délai long : un backend hébergé en offre gratuite (Render) peut mettre
// jusqu'à une minute à sortir de veille au premier appel.
export const getHealth = (opts) => request('/api/health', { timeout: 60000, ...opts })

export const getCommunes = (q, opts) =>
  request(q ? `/api/metadata/communes?q=${encodeURIComponent(q)}` : '/api/metadata/communes', opts)

// ── Estimation ───────────────────────────────────────────────────────────

/** Réponse brute ; voir api/normalize.js pour la forme utilisée par l'UI. */
export const estimatePrice = (payload, opts) =>
  request('/api/predictions/estimate', { method: 'POST', body: payload, timeout: 25000, ...opts })

// ── Marché ───────────────────────────────────────────────────────────────

/** Filtres de marché acceptés par le backend : type de bien et marché (tous, ancien, neuf/VEFA). */
const filtresMarche = (typeBien = 'apartment', marche = 'tous') => ({ type_bien: typeBien, marche })

/** Prix au m² par commune (carte), pour un type de bien et un marché. */
export const getMarketMap = (typeBien, marche, opts) =>
  request(`/api/market/map?${new URLSearchParams(filtresMarche(typeBien, marche))}`, opts)

/** Médiane mensuelle du prix au m² par département (tous si `dep` est vide). */
export const getMarketTrends = (dep, typeBien, marche, opts) =>
  request(`/api/market/trends?${new URLSearchParams({ ...filtresMarche(typeBien, marche), ...(dep ? { dep } : {}) })}`, opts)

/** Secteurs (communes, arrondissements) classés par prix médian, avec loyers de référence. */
export const getMarketSecteurs = (propertyType = 'apartment', minVentes, opts) =>
  request(`/api/market/secteurs?${new URLSearchParams({ property_type: propertyType, ...(minVentes ? { min_ventes: minVentes } : {}) })}`, opts)

/** Indice Notaires-INSEE trimestriel des prix de l'ancien d'un département. */
export const getMarketIndices = (dep, propertyType = 'apartment', opts) =>
  request(`/api/market/indices?${new URLSearchParams({ dep, property_type: propertyType })}`, opts)

// ── Historique ───────────────────────────────────────────────────────────

export const getSearchHistory = (limit = 20, opts) => request(`/api/search-history?limit=${limit}`, opts)
/**
 * Rattache une simulation (financement ou plus-value) à une estimation de
 * l'historique (`historique_id` renvoyé par l'estimation).
 */
export const saveHistorySimulation = (historiqueId, type, donnees, opts) =>
  request(`/api/history/${historiqueId}/simulation`, { method: 'PUT', body: { type, donnees }, ...opts })

export const deleteHistoryItem = (id, opts) => request(`/api/history/${id}`, { method: 'DELETE', ...opts })
export const clearHistory = (opts) => request('/api/history', { method: 'DELETE', ...opts })

// ── Financement ──────────────────────────────────────────────────────────

export const getFinancingDossier = (payload, opts) =>
  request('/api/financing/dossier', { method: 'POST', body: payload, ...opts })

export const getFinancingRates = (opts) => request('/api/financing/rates', opts)

/** Résumé texte du dossier, rédigé par le moteur (même corps que /dossier). */
export const getFinancingResume = (payload, opts) =>
  request('/api/financing/dossier/resume', { method: 'POST', body: payload, timeout: 30000, ...opts })

export const sendFinancingAgentMessage = (sessionId, message, opts) =>
  request('/api/financing/agent/message', {
    method: 'POST',
    body: { session_id: sessionId, message },
    timeout: 30000,
    ...opts,
  })

export const resetFinancingAgent = (sessionId, opts) =>
  request(`/api/financing/agent/${encodeURIComponent(sessionId)}`, { method: 'DELETE', ...opts })

// ── Authentification ─────────────────────────────────────────────────────

export const register = (email, password) =>
  request('/api/auth/register', { method: 'POST', body: { email, password } })

export const login = (email, password) =>
  request('/api/auth/login', { method: 'POST', body: { email, password } })

export const getMe = (opts) => request('/api/auth/me', opts)

export const forgotPassword = (email) =>
  request('/api/auth/forgot-password', { method: 'POST', body: { email } })

export const resetPassword = (token, newPassword) =>
  request('/api/auth/reset-password', { method: 'POST', body: { token, new_password: newPassword } })

export const changePassword = (currentPassword, newPassword) =>
  request('/api/auth/me/password', {
    method: 'PUT',
    body: { current_password: currentPassword, new_password: newPassword },
  })

export const deleteAccount = () => request('/api/auth/me', { method: 'DELETE' })
