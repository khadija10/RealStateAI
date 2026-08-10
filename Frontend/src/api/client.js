// Client API pour le backend FastAPI RealEstateAI.
// Base URL configurable via la variable d'environnement Vite VITE_API_URL
// (voir .env.example). Par défaut, pointe sur le backend local.

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
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

export { ApiError }
