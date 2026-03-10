import { Home } from 'lucide-react';

interface EstimationResultProps {
  estimation: {
    commune: string;
    property_type: string;
    surface: number;
    rooms: number;
    predicted_price: number;
    price_per_m2: number;
    confidence_interval: {
      lower: number;
      upper: number;
      confidence: number | string;
    };
    model?: string;
  };
}

export default function EstimationResult({ estimation }: EstimationResultProps) {
  const pricePerSqm = Math.round(estimation.price_per_m2);
  const minPerSqm = Math.round(estimation.confidence_interval.lower / estimation.surface);
  const maxPerSqm = Math.round(estimation.confidence_interval.upper / estimation.surface);

  const rangePercentage =
    ((estimation.predicted_price - estimation.confidence_interval.lower) /
      (estimation.confidence_interval.upper - estimation.confidence_interval.lower)) *
    100;

  const propertyTypeLabels: { [key: string]: string } = {
    'apartment': 'App.',
    'house': 'Maison',
    'studio': 'Studio',
    'duplex': 'Duplex',
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-8 shadow-2xl text-white animate-fade-in">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wider text-orange-400 mb-2">
          Estimation — {estimation.commune}
        </p>
        <h2 className="text-5xl font-bold mb-2">
          € {estimation.predicted_price.toLocaleString('fr-FR')}
        </h2>
        <p className="text-gray-400 text-sm">
          {propertyTypeLabels[estimation.property_type]} · {estimation.surface} m² · {estimation.rooms} pièces
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
          <p className="text-2xl font-bold text-orange-400">
            € {pricePerSqm.toLocaleString('fr-FR')}
          </p>
          <p className="text-xs text-gray-400 mt-1">PRIX / M²</p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
          <p className="text-2xl font-bold">{estimation.rooms}</p>
          <p className="text-xs text-gray-400 mt-1">PIÈCES</p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
          <p className="text-2xl font-bold">{estimation.surface} m²</p>
          <p className="text-xs text-gray-400 mt-1">SURFACE</p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
          <p className="text-2xl font-bold">{propertyTypeLabels[estimation.property_type]}</p>
          <p className="text-xs text-gray-400 mt-1">TYPE</p>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">€ {minPerSqm.toLocaleString('fr-FR')}</span>
          <span className="text-orange-400 font-medium">Fourchette</span>
          <span className="text-gray-400">€ {maxPerSqm.toLocaleString('fr-FR')}</span>
        </div>
        <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-1000"
            style={{ width: `${rangePercentage}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg transition-all duration-1000"
            style={{ left: `calc(${rangePercentage}% - 6px)` }}
          />
        </div>
        <div className="flex justify-between text-xs mt-2">
          <span className="text-gray-500">Min</span>
          <span className="text-orange-400 font-medium">
            € {estimation.predicted_price.toLocaleString('fr-FR')}
          </span>
          <span className="text-gray-500">Max</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/10">
        <div>
          <p className="text-xs text-gray-400 mb-1">Modèle {estimation.model || 'n/a'}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-1">
            Confiance: {estimation.confidence_interval.confidence}
          </p>
        </div>
      </div>
    </div>
  );
}
