import { Link } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageHeader'
import { Button, Card, EmptyState, IconCompass } from '../components/ui'
import { usePageTitle } from '../hooks/usePageTitle'

export default function NotFoundPage() {
  usePageTitle('Page introuvable')
  return (
    <PageContainer width="narrow">
      <Card padding="lg">
        <EmptyState
          icon={<IconCompass size={22} />}
          title="Cette page n’existe pas"
          description="Le lien est peut-être incomplet, ou la page a été déplacée."
          action={<Button as={Link} to="/estimation">Estimer un bien</Button>}
        />
      </Card>
    </PageContainer>
  )
}
