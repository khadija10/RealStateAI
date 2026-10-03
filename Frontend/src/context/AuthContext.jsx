import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { clearToken, getMe, getToken } from '../api/client'
import AuthModal from '../components/AuthModal'
import { effacerSession } from '../lib/estimationSession'

const AuthContext = createContext(null)

/** Pages réservées aux utilisateurs connectés (l'estimation reste ouverte à tous). */
export const PROTECTED_PATHS = ['/financement', '/plus-value', '/historique', '/profil']

/**
 * Session utilisateur partagée.
 * status : 'loading' (jeton en cours de vérification) | 'authenticated' | 'anonymous'
 * La fenêtre de connexion est pilotée ici : openAuth() l'ouvre depuis n'importe où ;
 * openAuth(action) reprend ensuite l'action demandée (ouvrir le financement, la plus-value).
 * `deconnexions` augmente à chaque déconnexion : les pages effacent alors leurs résultats.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(() => (getToken() ? 'loading' : 'anonymous'))
  const [authOpen, setAuthOpen] = useState(false)
  const [deconnexions, setDeconnexions] = useState(0)
  const actionApresConnexion = useRef(null)
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

  const openAuth = useCallback((action) => {
    actionApresConnexion.current = typeof action === 'function' ? action : null
    setAuthOpen(true)
  }, [])
  const closeAuth = useCallback(() => {
    actionApresConnexion.current = null
    setAuthOpen(false)
  }, [])

  const handleAuthSuccess = useCallback((_token, userData) => {
    setUser(userData)
    setStatus('authenticated')
    setAuthOpen(false)
    // date d'inscription et autres champs du profil : servis par /api/auth/me
    getMe().then(setUser).catch(() => {})
    const action = actionApresConnexion.current
    actionApresConnexion.current = null
    action?.()
  }, [])

  /** Exécute `action` si l'utilisateur est connecté, sinon après sa connexion. */
  const requireAuth = useCallback(
    (action) => {
      if (status === 'authenticated') action()
      else openAuth(action)
    },
    [status, openAuth],
  )

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
    setStatus('anonymous')
    // Le résultat d'un compte ne doit pas rester visible pour le suivant
    effacerSession()
    setDeconnexions((n) => n + 1)
    if (PROTECTED_PATHS.some((p) => location.pathname.startsWith(p))) {
      navigate('/estimation', { replace: true })
    }
  }, [location.pathname, navigate])

  const value = useMemo(
    () => ({ user, status, openAuth, closeAuth, requireAuth, logout, deconnexions }),
    [user, status, openAuth, closeAuth, requireAuth, logout, deconnexions],
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
