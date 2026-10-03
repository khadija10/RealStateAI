import { useNavigate } from 'react-router-dom'
import History from '../components/History'
import PageHeader, { PageContainer } from '../components/layout/PageHeader'
import RequireAuth from '../components/layout/RequireAuth'
import { usePageTitle } from '../hooks/usePageTitle'
import { FORM_VIDE } from '../lib/estimation'
import { cheminEstimation, valeursDepuisHistorique } from '../lib/estimationExport'

/**
 * Historique des estimations (utilisateur connecté), regroupé par bien.
 * « Ré-estimer » relance l'estimation du bien ; « Voir » réaffiche le
 * résultat enregistré sans nouveau calcul. Refonte visuelle : phase 4.
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
          <History
            onReEstimate={(item) => navigate(cheminEstimation(valeursDepuisHistorique(item, FORM_VIDE)))}
            onVoir={(item) => navigate('/estimation', { state: { voir: item } })}
          />
        </div>
      </PageContainer>
    </RequireAuth>
  )
}
