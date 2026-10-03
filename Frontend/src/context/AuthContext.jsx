import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { clearToken, getMe, getToken } from '../api/client'
import AuthModal from '../components/AuthModal'

const AuthContext = createContext(null)

/** Pages réservées aux utilisateurs connectés. */
export const PROTECTED_PATHS = ['/historique', '/profil']

/**
 * Session utilisateur partagée.
 * status : 'loading' (jeton en cours de vérification) | 'authenticated' | 'anonymous'
 * La fenêtre de connexion est pilotée ici : openAuth() l'ouvre depuis n'importe où.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(() => (getToken() ? 'loading' : 'anonymous'))
  const [authOpen, setAuthOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!getToken()) return
    let cancelled = false
    getMe()
      .then((u) => {
        if (cancelled) return
        setUser(u)
        setStatus('authenticated')
      })
      .catch(() => {
        if (cancelled) return
        clearToken()
        setUser(null)
        setStatus('anonymous')
      })
    return () => { cancelled = true }
  }, [])

  const openAuth = useCallback(() => setAuthOpen(true), [])
  const closeAuth = useCallback(() => setAuthOpen(false), [])

  const handleAuthSuccess = useCallback((_token, userData) => {
    setUser(userData)
    setStatus('authenticated')
    setAuthOpen(false)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
    setStatus('anonymous')
    if (PROTECTED_PATHS.some((p) => location.pathname.startsWith(p))) {
      navigate('/estimation', { replace: true })
    }
  }, [location.pathname, navigate])

  const value = useMemo(
    () => ({ user, status, openAuth, closeAuth, logout }),
    [user, status, openAuth, closeAuth, logout],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
      {authOpen && <AuthModal onSuccess={handleAuthSuccess} onClose={closeAuth} />}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
