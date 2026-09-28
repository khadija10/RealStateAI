import { useState } from 'react'
import { login, register, forgotPassword, resetPassword, saveToken, ApiError } from '../api/client'

function EyeIcon({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 2l12 12M6.5 6.6A2 2 0 0010.4 9.5M4.3 4.4C2.8 5.4 1.7 6.8 1 8c1.3 2.7 4 5 7 5a7.4 7.4 0 003.7-1M6.8 3.2C7.2 3.1 7.6 3 8 3c3 0 5.7 2.3 7 5-.4.8-1 1.7-1.7 2.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

export default function AuthModal({ onSuccess, onClose }) {
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'forgot' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [resetCode, setResetCode] = useState('')
  const [devToken, setDevToken] = useState(null)
  const [newPw, setNewPw] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  function switchMode(m) {
    setMode(m)
    setError('')
    setSuccess('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      if (mode === 'login' || mode === 'register') {
        const fn = mode === 'login' ? login : register
        const data = await fn(email.trim(), password)
        saveToken(data.token)
        onSuccess(data.token, data.user)
      } else if (mode === 'forgot') {
        const data = await forgotPassword(email.trim())
        setDevToken(data.dev_token || null)
        setSuccess(data.message)
        if (data.dev_token) {
          setResetCode(data.dev_token)
          switchMode('reset')
        }
      } else if (mode === 'reset') {
        await resetPassword(resetCode.trim(), newPw)
        setSuccess('Mot de passe réinitialisé. Vous pouvez vous connecter.')
        switchMode('login')
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  const titles = {
    login: 'Connexion',
    register: 'Créer un compte',
    forgot: 'Mot de passe oublié',
    reset: 'Nouveau mot de passe',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-[var(--font-display)] text-xl text-ink">{titles[mode]}</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-label="Fermer">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {success && !devToken && (
          <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mb-4">{success}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email — toujours affiché sauf sur reset */}
          {mode !== 'reset' && (
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
          )}

          {/* Mot de passe — login/register */}
          {(mode === 'login' || mode === 'register') && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-ink-muted" htmlFor="auth-password">
                  Mot de passe {mode === 'register' && <span className="text-ink-muted">(min. 6 caractères)</span>}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-[11px] text-seine hover:underline"
                  >
                    Oublié ?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 pr-9 text-sm text-ink focus:outline-none focus:border-seine transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors"
                  aria-label={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  <EyeIcon open={showPw} />
                </button>
              </div>
            </div>
          )}

          {/* Reset — code + nouveau mdp */}
          {mode === 'reset' && (
            <>
              {devToken && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-amber-700 font-medium">Mode développement</p>
                  <p className="text-[11px] text-amber-600 mt-0.5 break-all">Code : <span className="font-mono select-all">{devToken}</span></p>
                </div>
              )}
              <div>
                <label className="block text-xs text-ink-muted mb-1" htmlFor="reset-code">Code de réinitialisation</label>
                <input
                  id="reset-code"
                  type="text"
                  required
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-ink font-mono focus:outline-none focus:border-seine transition-colors"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-muted mb-1" htmlFor="reset-pw">
                  Nouveau mot de passe <span className="text-ink-muted">(min. 6 caractères)</span>
                </label>
                <div className="relative">
                  <input
                    id="reset-pw"
                    type={showNewPw ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 pr-9 text-sm text-ink focus:outline-none focus:border-seine transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors"
                    aria-label={showNewPw ? 'Masquer' : 'Afficher'}
                  >
                    <EyeIcon open={showNewPw} />
                  </button>
                </div>
              </div>
            </>
          )}

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-seine text-white rounded-lg py-2.5 text-sm font-medium hover:bg-seine/90 disabled:opacity-60 transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Vérification…
              </span>
            ) : mode === 'login' ? 'Se connecter'
              : mode === 'register' ? 'Créer le compte'
              : mode === 'forgot' ? 'Envoyer le code'
              : 'Réinitialiser'}
          </button>
          {loading && (mode === 'login' || mode === 'register') && (
            <p className="text-center text-[11px] text-ink-muted pt-1">
              La vérification peut prendre quelques secondes.
            </p>
          )}
        </form>

        {/* Liens de navigation */}
        {(mode === 'login' || mode === 'register') && (
          <p className="mt-5 text-center text-xs text-ink-muted">
            {mode === 'login' ? "Pas encore de compte ?" : "Déjà un compte ?"}
            {' '}
            <button
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              className="text-seine hover:underline"
            >
              {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
            </button>
          </p>
        )}
        {(mode === 'forgot' || mode === 'reset') && (
          <p className="mt-5 text-center text-xs text-ink-muted">
            <button onClick={() => switchMode('login')} className="text-seine hover:underline">
              ← Retour à la connexion
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
