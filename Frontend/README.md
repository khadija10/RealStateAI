# RealEstateAI — Frontend (React + Vite)

Interface d'estimation immobilière, connectée au backend FastAPI.

## Installation

```bash
npm install
cp .env.example .env   # ajuster VITE_API_URL si besoin
npm run dev
```

Ouvrir http://localhost:5173

## Build production

```bash
npm run build
npm run preview
```

## Structure

```text
src/
├── api/client.js          # appels au backend (health, communes, estimate)
├── components/
│   ├── Header.jsx
│   ├── Footer.jsx
│   ├── EstimationForm.jsx
│   ├── ResultPanel.jsx
│   └── ConfidenceGauge.jsx
├── App.jsx
├── main.jsx
└── index.css               # design tokens (thème "Pierre de Paris")
```

## À vérifier avec le backend réel

Le mapping des champs de réponse de `/api/predictions/estimate` dans
`src/App.jsx` (fonction `normalizeResult`) est fait de façon défensive
(plusieurs noms de clés possibles : `estimated_price`, `price`,
`prediction`, etc.). À ajuster une fois le vrai payload du backend confirmé.

Idem pour `property_type` : le formulaire envoie `apartment` / `house` /
`other` — à aligner avec les valeurs acceptées par le backend si différentes.
