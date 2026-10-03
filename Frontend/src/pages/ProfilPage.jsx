import ProfilePanel from '../components/ProfilePanel'
import PageHeader, { PageContainer } from '../components/layout/PageHeader'
import RequireAuth from '../components/layout/RequireAuth'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'

/**
 * Profil de l'utilisateur.
 * Phase 0 : composant existant conservé tel quel. Refonte : phase 4.
 */
export default function ProfilPage() {
  usePageTitle('Profil')
  const { user, logout } = useAuth()
  return (
    <RequireAuth
      title="Connectez-vous pour gérer votre compte"
      reason="Modifiez votre mot de passe ou supprimez votre compte depuis cette page."
    >
      <PageContainer>
        <PageHeader
          eyebrow="Mon espace"
          title={<>Mon <em>profil</em></>}
          description="Paramètres et sécurité de votre compte."
        />
        <ProfilePanel user={user} onLogout={logout} />
      </PageContainer>
    </RequireAuth>
  )
}
