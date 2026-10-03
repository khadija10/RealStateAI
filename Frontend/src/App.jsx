import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import EstimationPage from './pages/EstimationPage'
import FinancementPage from './pages/FinancementPage'
import HistoriquePage from './pages/HistoriquePage'
import MarchePage, { CarteView, TendancesView } from './pages/MarchePage'
import NotFoundPage from './pages/NotFoundPage'
import PlusValuePage from './pages/PlusValuePage'
import ProfilPage from './pages/ProfilPage'

/**
 * La racine renvoie vers l'estimation, parcours central de l'application.
 * Les paramètres d'URL sont conservés : les liens de partage d'estimation
 * créés avant l'ajout du routeur (« /?area_m2=…&rooms=… ») restent valides.
 */
function RedirectToEstimation() {
  const { search } = useLocation()
  return <Navigate to={`/estimation${search}`} replace />
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<RedirectToEstimation />} />
        <Route path="estimation" element={<EstimationPage />} />
        <Route path="financement" element={<FinancementPage />} />
        <Route path="plus-value" element={<PlusValuePage />} />
        <Route path="marche" element={<MarchePage />}>
          <Route index element={<Navigate to="carte" replace />} />
          <Route path="carte" element={<CarteView />} />
          <Route path="tendances" element={<TendancesView />} />
        </Route>
        <Route path="historique" element={<HistoriquePage />} />
        <Route path="profil" element={<ProfilPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
