import { MapPin, Zap, TrendingUp, ArrowRight } from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';

export default function Home() {
  const { navigateTo } = useNavigation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-orange-600 uppercase tracking-wider mb-4">
            Bienvenue sur RealEstateAI
          </p>
          <h2 className="text-5xl font-serif text-gray-900 mb-6">
            Estimez la valeur de votre bien{' '}
            <span className="text-orange-600 italic">en quelques clics</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Une solution intelligente pour estimer la valeur de votre bien immobilier
            dans la région parisienne, basée sur les données DVF.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mb-4">
              <MapPin className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              Données Locales
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Analyse basée sur les transactions réelles de votre commune.
            </p>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-yellow-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              Estimation Rapide
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Obtenez une estimation en quelques secondes.
            </p>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              Fourchette de Prix
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Visualisez l'intervalle de confiance.
            </p>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={() => navigateTo('estimator')}
            className="inline-flex items-center gap-2 bg-gray-900 text-white px-8 py-4 rounded-lg font-medium hover:bg-gray-800 transition-all duration-300 hover:shadow-lg hover:scale-105"
          >
            Commencer l'estimation
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-16 bg-blue-50 border border-blue-100 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <div className="text-2xl">👋</div>
            <div>
              <p className="text-blue-900">
                Cliquez sur l'onglet{' '}
                <button
                  onClick={() => navigateTo('estimator')}
                  className="font-semibold underline hover:text-blue-700"
                >
                  Estimateur
                </button>{' '}
                ci-dessus pour démarrer.
              </p>
            </div>
          </div>
        </div>

        <footer className="mt-20 pt-8 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">
            Développé pour le marché immobilier parisien ·{' '}
            <span className="text-orange-600 font-medium">RealEstateAI</span> · 2026
          </p>
        </footer>
      </div>
    </div>
  );
}
