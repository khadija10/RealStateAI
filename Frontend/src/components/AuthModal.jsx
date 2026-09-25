import { useState } from 'react'
import { login, register, saveToken, ApiError } from '../api/client'

export default function AuthModal({ onSuccess, onClose }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fn = mode === 'login' ? login : register
      const data = await fn(email.trim(), password)
      saveToken(data.token)
      onSuccess(data.token, data.user)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-[var(--font-display)] text-xl text-ink">
            {mode === 'login' ? 'Connexion' : 'Créer un compte'}
          </h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-label="Fermer">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-ink-muted mb-1" htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-seine transition-colors"
              placeholder="vous@exemple.com"
            />
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1" htmlFor="auth-password">
              Mot de passe {mode === 'register' && <span className="text-ink-muted">(min. 6 caractères)</span>}
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-seine transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-seine text-white rounded-lg py-2.5 text-sm font-medium hover:bg-seine/90 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Chargement…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-ink-muted">
          {mode === 'login' ? "Pas encore de compte ?" : "Déjà un compte ?"}
          {' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            className="text-seine hover:underline"
          >
            {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
          </button>
        </p>
      </div>
    </div>
  )
}
