import { useState, useEffect } from 'react';
import { MapPin, Home, Minus, Plus, Sparkles } from 'lucide-react';
import EstimationResult from '../components/EstimationResult';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type EstimationResultData = {
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

export default function Estimator() {
  const [communes, setCommunes] = useState<string[]>([]);
  const [selectedCommune, setSelectedCommune] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [surface, setSurface] = useState<number>(65);
  const [rooms, setRooms] = useState<number>(3);
  const [propertyType, setPropertyType] = useState<string>('apartment');
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [estimation, setEstimation] = useState<EstimationResultData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showResult, setShowResult] = useState<boolean>(false);

  useEffect(() => {
    loadCommunes();
    loadPropertyTypes();
  }, []);

  const loadCommunes = async () => {
    try {
      const resp = await fetch(`${API_URL}/api/metadata/communes`);
      if (!resp.ok) throw new Error('Failed to load communes');
      const data = await resp.json();
      const items = Array.isArray(data?.communes) ? data.communes : [];
      setCommunes(items.filter((c: string) => !!c));
    } catch (e) {
      console.error('Error loading communes:', e);
      setCommunes([]);
    }
  };

  const loadPropertyTypes = async () => {
    try {
      const resp = await fetch(`${API_URL}/api/metadata/property-types`);
      if (!resp.ok) throw new Error('Failed to load property types');
      const data = await resp.json();
      const items = Array.isArray(data?.types) ? data.types : [];
      const cleaned = items.filter((t: string) => !!t);
      setPropertyTypes(cleaned);
      setPropertyType((prev) => (cleaned.includes(prev) ? prev : (cleaned[0] || '')));
    } catch (e) {
      console.error('Error loading property types:', e);
      setPropertyTypes([]);
      setPropertyType('');
    }
  };

  const formatPropertyType = (value: string) => {
    const labels: Record<string, string> = {
      apartment: 'Appartement',
      house: 'Maison',
    };
    if (labels[value]) return labels[value];
    return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const calculateEstimation = async () => {
    setIsLoading(true);
    setShowResult(false);

    const payload = {
      area_m2: surface,
      rooms,
      property_type: propertyType,
      commune: selectedCommune || undefined,
      address: address || undefined,
    };

    try {
      const resp = await fetch(`${API_URL}/api/predictions/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(`API error ${resp.status}`);
      const r = await resp.json();
      const newEstimation: EstimationResultData = {
        commune: selectedCommune,
        property_type: propertyType,
        surface,
        rooms,
        predicted_price: r.predicted_price,
        price_per_m2: r.price_per_m2,
        confidence_interval: r.confidence_interval,
        model: r.model,
      };
      setEstimation(newEstimation);
      setIsLoading(false);
      setShowResult(true);
    } catch (e) {
      console.error('Error estimating:', e);
      setIsLoading(false);
      setShowResult(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <p className="text-sm font-medium text-orange-600 uppercase tracking-wider mb-2">
            Estimation Personnalisée
          </p>
          <h2 className="text-4xl font-serif text-gray-900 mb-3">
            Décrivez votre bien <span className="text-orange-600 italic">immobilier</span>
          </h2>
          <p className="text-gray-600">
            Renseignez les caractéristiques pour obtenir une estimation basée sur le marché local.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-6">
                  <MapPin className="w-5 h-5 text-red-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Localisation</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Commune
                    </label>
                    <select
                      value={selectedCommune}
                      onChange={(e) => setSelectedCommune(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                    >
                      <option value="">Sélectionnez une commune</option>
                      {communes.map((commune) => (
                        <option key={commune} value={commune}>
                          {commune}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Adresse (optionnel)
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Ex: 21 rue proudhon, 93210 Saint Denis"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-8">
                <div className="flex items-center gap-2 mb-6">
                  <Home className="w-5 h-5 text-orange-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Caractéristiques</h3>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Surface (m²)
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSurface(Math.max(10, surface - 5))}
                          className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          value={surface}
                          onChange={(e) => setSurface(Number(e.target.value))}
                          className="flex-1 px-4 py-3 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                        />
                        <button
                          onClick={() => setSurface(surface + 5)}
                          className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pièces
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setRooms(Math.max(1, rooms - 1))}
                          className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          value={rooms}
                          onChange={(e) => setRooms(Number(e.target.value))}
                          className="flex-1 px-4 py-3 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                        />
                        <button
                          onClick={() => setRooms(rooms + 1)}
                          className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type de bien
                    </label>
                    <select
                      value={propertyType}
                      onChange={(e) => setPropertyType(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                      disabled={propertyTypes.length === 0}
                    >
                      {propertyTypes.length === 0 ? (
                        <option value="">Aucun type disponible</option>
                      ) : (
                        propertyTypes.map((type) => (
                          <option key={type} value={type}>
                            {formatPropertyType(type)}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <button
                  onClick={calculateEstimation}
                  disabled={(!selectedCommune && !address) || isLoading}
                  className="w-full bg-gray-900 text-white px-6 py-4 rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300 hover:shadow-lg flex items-center justify-center gap-2 group"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Calcul en cours...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                      Lancer l'estimation
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            {showResult && estimation ? (
              <EstimationResult estimation={estimation} />
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col items-center justify-center h-full min-h-[400px]">
                <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
                  <Home className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">
                  Votre estimation apparaîtra ici
                </h3>
                <p className="text-gray-600 text-center text-sm">
                  Complétez le formulaire puis cliquez sur « Lancer l'estimation ».
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
