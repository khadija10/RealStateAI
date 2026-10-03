import { useNavigate } from 'react-router-dom'
import History from '../components/History'
import LocalEstimationsHistory from '../components/LocalEstimationsHistory'
import PageHeader, { PageContainer } from '../components/layout/PageHeader'
import RequireAuth from '../components/layout/RequireAuth'
import { usePageTitle } from '../hooks/usePageTitle'

/**
 * Historique des estimations (utilisateur connecté).
 * Phase 0 : composants existants conservés tels quels. Refonte : phase 4.
 */
export default function HistoriquePage() {
  usePageTitle('Historique')
  const navigate = useNavigate()
  return (
    <RequireAuth
      title="Connectez-vous pour voir votre historique"
      reason="Vos estimations sont enregistrées dans votre compte et accessibles depuis tous vos appareils."
    >
      <PageContainer>
        <PageHeader
          eyebrow="Mon espace"
          title={<>Historique <em>des estimations</em></>}
          description="Retrouvez, comparez et supprimez les estimations enregistrées sur votre compte."
        />
        <div className="max-w-3xl">
          <LocalEstimationsHistory />
          <History onReEstimate={() => navigate('/estimation')} />
        </div>
      </PageContainer>
    </RequireAuth>
  )
}
