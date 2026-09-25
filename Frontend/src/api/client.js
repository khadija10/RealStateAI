// Client API pour le backend FastAPI RealEstateAI.
// Base URL configurable via la variable d'environnement Vite VITE_API_URL
// (voir .env.example). Par défaut, pointe sur le backend local.

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const TOKEN_KEY = 'reai_token'

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export function saveToken(t) {
  try { localStorage.setItem(TOKEN_KEY, t) } catch { /* ignore */ }
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
}

class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, options = {}) {
  const token = getToken()
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {}
  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...authHeader },
      ...options,
    })
  } catch {
    throw new ApiError(
      "Impossible de joindre le serveur d'estimation. Vérifiez que le backend tourne.",
      0
    )
  }

  if (!response.ok) {
    let detail = `Erreur serveur (${response.status})`
    try {
      const body = await response.json()
      detail = body.detail || body.message || detail
    } catch {
      // pas de corps JSON exploitable
    }
    throw new ApiError(detail, response.status)
  }

  return response.json()
}

export function getHealth() {
  return request('/api/health')
}

export function getCommunes() {
  return request('/api/metadata/communes')
}

export function estimatePrice(payload) {
  return request('/api/predictions/estimate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getMarketMap() {
  return request('/api/market/map')
}

export function getMarketTrends(dep) {
  return request(dep ? `/api/market/trends?dep=${dep}` : '/api/market/trends')
}

export function getSearchHistory(limit = 20) {
  return request(`/api/search-history?limit=${limit}`)
}

export function getFinancingDossier(payload) {
  return request('/api/financing/dossier', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function register(email, password) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function login(email, password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function getMe() {
  return request('/api/auth/me')
}

export { ApiError }
