import { Home, TrendingUp } from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';

export default function Header() {
  const { currentPage, navigateTo } = useNavigation();

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
              <Home className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-serif text-gray-900">
                Estimation Immobilière — Paris
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
              Prototype v1.0
            </span>
            <span className="text-xs text-gray-500 ml-2">10 March 2026</span>
          </div>
        </div>

        <nav className="flex border-t border-gray-100">
          <button
            onClick={() => navigateTo('home')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              currentPage === 'home'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <Home className="w-4 h-4" />
            Accueil
          </button>
          <button
            onClick={() => navigateTo('estimator')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              currentPage === 'estimator'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Estimateur
          </button>
        </nav>
      </div>
    </header>
  );
}
