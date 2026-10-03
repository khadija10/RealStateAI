import { useAuth } from '../../context/AuthContext'
import { Button, Card, EmptyState, IconLock, LoadingState } from '../ui'
import { PageContainer } from './PageHeader'

/**
 * Protège une page réservée aux utilisateurs connectés. Sans session, on
 * explique pourquoi et on propose de se connecter, sans quitter la page.
 */
export default function RequireAuth({ title, reason, children }) {
  const { status, openAuth } = useAuth()

  if (status === 'loading') {
    return (
      <PageContainer>
        <LoadingState label="Vérification de votre session…" />
      </PageContainer>
    )
  }

  if (status !== 'authenticated') {
    return (
      <PageContainer width="narrow">
        <Card padding="lg">
          <EmptyState
            icon={<IconLock size={22} />}
            title={title}
            description={reason}
            action={<Button onClick={openAuth}>Se connecter</Button>}
          />
        </Card>
      </PageContainer>
    )
  }

  return children
}
