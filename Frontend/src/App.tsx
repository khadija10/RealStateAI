import { NavigationProvider, useNavigation } from './contexts/NavigationContext';
import Header from './components/Header';
import Home from './pages/Home';
import Estimator from './pages/Estimator';

function AppContent() {
  const { currentPage } = useNavigation();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main>
        {currentPage === 'home' && <Home />}
        {currentPage === 'estimator' && <Estimator />}
      </main>
    </div>
  );
}

function App() {
  return (
    <NavigationProvider>
      <AppContent />
    </NavigationProvider>
  );
}

export default App;
