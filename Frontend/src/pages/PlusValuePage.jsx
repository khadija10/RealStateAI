import { useLocation } from 'react-router-dom'
import { API_BASE } from '../api/client'
import VanillaPage from '../components/VanillaPage'
import { usePageTitle } from '../hooks/usePageTitle'
import * as plusvaluePage from '../vanilla/plusvalue.js'

/**
 * Page Plus-value.
 * Phase 0 : page existante montée telle quelle ; le pré-remplissage depuis
 * l'estimation arrive par l'état de navigation. Refonte : phase 2.
 */
export default function PlusValuePage() {
  usePageTitle('Plus-value')
  const { state } = useLocation()
  return (
    <div className="w-full px-4 py-8 sm:px-6">
      <VanillaPage page={plusvaluePage} apiBase={API_BASE} options={{ prefill: state?.prefill ?? null }} />
    </div>
  )
}
