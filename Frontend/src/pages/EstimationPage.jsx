import { useNavigate } from 'react-router-dom'
import { API_BASE } from '../api/client'
import VanillaPage from '../components/VanillaPage'
import { usePageTitle } from '../hooks/usePageTitle'
import * as estimationPage from '../vanilla/estimation.js'

/**
 * Page Estimation.
 * Phase 0 : la page existante est montée telle quelle dans la nouvelle
 * coquille ; seuls les liens vers Financement / Plus-value passent désormais
 * par le routeur (le bien estimé est transmis dans l'état de navigation).
 * Sa refonte complète est l'objet de la phase 1.
 */
export default function EstimationPage() {
  usePageTitle('Estimation')
  const navigate = useNavigate()
  return (
    <div className="w-full px-4 py-8 sm:px-6">
      <VanillaPage
        page={estimationPage}
        apiBase={API_BASE}
        options={{
          onPlusValue: (bien) => navigate('/plus-value', { state: { prefill: bien } }),
          onFinancement: (bien) => navigate('/financement', { state: { prefill: bien } }),
        }}
      />
    </div>
  )
}
