import { useLocation } from 'react-router-dom'
import { API_BASE } from '../api/client'
import VanillaPage from '../components/VanillaPage'
import { usePageTitle } from '../hooks/usePageTitle'
import * as financementPage from '../vanilla/financement.js'

/**
 * Page Financement.
 * Phase 0 : page existante montée telle quelle ; le pré-remplissage depuis
 * l'estimation arrive par l'état de navigation. Refonte : phase 2.
 */
export default function FinancementPage() {
  usePageTitle('Financement')
  const { state } = useLocation()
  return (
    <div className="w-full px-4 py-8 sm:px-6">
      <VanillaPage page={financementPage} apiBase={API_BASE} options={{ prefill: state?.prefill ?? null }} />
    </div>
  )
}
