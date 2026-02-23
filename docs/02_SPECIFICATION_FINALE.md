# 📋 SPÉCIFICATION PROTOTYPE - RealEstateAI
## Avec Répartition d'Équipe (5 Personnes)

---

## 🎯 DÉFINITION FINALE DU PROTOTYPE

### Objectif Principal
Créer un **estimateur de prix immobilier** basé sur des **données réelles DVF** qui permet à un utilisateur d'estimer le prix d'une propriété en entrant une **adresse réelle** et ses caractéristiques.

### En Une Phrase
> **L'utilisateur entre une adresse + surface + pièces + type** → **Le système cherche dans les données DVF réelles** → **Retourne le prix du marché basé sur transactions similaires**

---

## 📊 LES 4 CHAMPS D'ENTRÉE

```
1. 📍 ADRESSE           : "123 Rue de Paris, 75001" (ou Paris, 75001)
2. 📏 SURFACE EN M²     : 65
3. 🏠 NOMBRE DE PIÈCES : 2
4. 🏢 TYPE DE BIEN      : apartment / house / studio
```

---

## 💡 LE FLUX DE CALCUL

```
INPUT → PARSER ADRESSE → CHERCHER DVF → MOYENNE → RÉSULTAT

1. Utilisateur entre adresse
2. Parser l'adresse → Extraire commune + code postal
3. Chercher dans DVF :
   - Même commune
   - Même type de bien
   - Surface similaire (±10%)
4. Prendre les N transactions trouvées
5. Calculer prix moyen au m²
6. Appliquer : Surface × Prix_moyen = Prix estimé
7. Calculer intervalle ±15%
8. AFFICHER RÉSULTAT
```

---

## 📤 LE RÉSULTAT AFFICHÉ

```
┌────────────────────────────────────────┐
│                                        │
│  💰 Prix estimé : €458,250            │
│  📊 Prix/m² : €7,050 (marché réel)   │
│                                        │
│  📍 Commune : Paris (75001)           │
│  🔍 Basé sur : 20 transactions        │
│                                        │
│  📈 Intervalle :                      │
│    Min : €389,512                    │
│    Max : €526,987                    │
│    Confiance : 85%                   │
│                                        │
└────────────────────────────────────────┘
```

---

## ✅ CE QUI EST INCLUS (MVP)

- ✅ Formulaire 4 champs (adresse, surface, pièces, type)
- ✅ Parser adresse → extraire commune
- ✅ Recherche dans DVF
- ✅ Calcul prix moyen
- ✅ Affichage résultat
- ✅ Intervalle de confiance
- ✅ Gestion d'erreurs basiques

## ❌ CE QUI N'EST PAS INCLUS

- ❌ Base de données (juste fichier CSV)
- ❌ Modèle ML complexe (juste moyenne statistique)
- ❌ Cartographie interactive
- ❌ Historique des estimations
- ❌ Authentification

---

## 📊 HYPOTHÈSES DU POC

1. **Données DVF suffisantes** : Au moins 10-20 transactions similaires par commune/type
2. **Adresses parsables** : Format "Rue, Code postal" ou "Ville, Code postal"
3. **Surface ±10%** : On considère comme similaire si surface ±10% de la demande
4. **Prix linéaire** : Le prix est proportionnel à la surface (hypothèse simplifiée)
5. **Pas de valeurs aberrantes** : DVF contient quelques anomalies qu'on filtre

---

## 🏗️ ARCHITECTURE TECHNIQUE

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  UTILISATEUR (Browser)                                 │
│  http://localhost:8501                                │
│       ↓                                                │
│  ┌──────────────────────────────────────────────────┐ │
│  │ STREAMLIT FRONTEND (frontend/app.py)             │ │
│  │ - Formulaire (4 champs)                          │ │
│  │ - Affichage résultat                             │ │
│  └──────────────────────────────────────────────────┘ │
│       ↓ (HTTP POST JSON)                              │
│  ┌──────────────────────────────────────────────────┐ │
│  │ FASTAPI BACKEND (backend/main.py)                │ │
│  │ - Parser adresse                                 │ │
│  │ - Chercher DVF                                   │ │
│  │ - Calculer prix moyen                            │ │
│  │ - Retourner résultat JSON                        │ │
│  └──────────────────────────────────────────────────┘ │
│       ↓ (JSON response)                               │
│  ┌──────────────────────────────────────────────────┐ │
│  │ DATA (data/dvf_processed.csv)                    │ │
│  │ - Transactions immobilières réelles              │ │
│  │ - Colonnes: adresse, code_postal, commune, prix │ │
│  │            surface, type, prix_au_m2             │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ STACK TECHNIQUE

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| **Frontend** | Streamlit | Rapide, interactif, pas besoin HTML/CSS |
| **Backend** | FastAPI | Léger, rapide, documentation auto |
| **Data** | CSV + Pandas | Prototypage rapide, pas besoin DB |
| **Lang** | Python | Écosystème data riche, développement rapide |
| **Deploy** | Docker | Reproductibilité, facile à partager |

---

## 📝 ENDPOINTS API

### Route 1 : Health Check
```
GET /api/health
Response: {"status": "healthy"}
```

### Route 2 : Estimation (LA PRINCIPALE)
```
POST /api/predictions/estimate

Request Body:
{
  "adresse": "123 Rue de Paris, 75001",
  "surface_m2": 65,
  "nb_pieces": 2,
  "type_bien": "apartment"
}

Response:
{
  "predicted_price": 458250,
  "price_per_m2": 7050,
  "commune": "Paris",
  "code_postal": "75001",
  "nb_transactions_trouvees": 20,
  "confidence_interval": {
    "lower": 389512,
    "upper": 526987,
    "confiance": "85%"
  },
  "status": "success"
}

Error Response:
{
  "error": "Aucune transaction trouvée pour cette commune",
  "status": "error"
}
```

---

## 🎯 CRITÈRES DE SUCCÈS

### MVP MINIMAL (Essentiels)
- [x] Formulaire 4 champs fonctionnel
- [x] Parser adresse → commune
- [x] Recherche DVF fonctionnelle
- [x] Calcul prix moyen
- [x] Affichage résultat
- [x] Pas d'erreur non gérée

### Nice-to-have (Bonus)
- [ ] Stats commune affichées
- [ ] Message "basé sur X transactions"
- [ ] Gestion adresses partielles
- [ ] Tests unitaires

---

## 💾 STRUCTURE DES DONNÉES DVF

### Colonnes minimales requises
```
{
  "id": 1,
  "adresse": "123 Rue de Paris, 75001",
  "code_postal": "75001",
  "commune": "Paris",
  "type_bien": "apartment",    # apartment, house, studio
  "surface_m2": 65,
  "prix_vente": 458250,
  "prix_au_m2": 7050,
  "date_transaction": "2023-06-15"
}
```

### Nettoyage DVF à effectuer
- Supprimer lignes avec prix = 0
- Supprimer outliers (prix extrêmes)
- Garder seulement Île-de-France (pour MVP)
- Format type_bien : normaliser (apt → apartment, etc.)

---

## 🔍 ALGORITHME DE RECHERCHE

```python
def find_similar_properties(commune, type_bien, surface_m2):
    """
    Cherche les transactions similaires dans DVF
    """
    # 1. Filtrer par commune + type
    filtered = dvf[
        (dvf['commune'] == commune) &
        (dvf['type_bien'] == type_bien)
    ]
    
    # 2. Filtrer par surface (±10%)
    min_surface = surface_m2 * 0.9
    max_surface = surface_m2 * 1.1
    filtered = filtered[
        (filtered['surface_m2'] >= min_surface) &
        (filtered['surface_m2'] <= max_surface)
    ]
    
    # 3. Vérifier qu'on a assez de transactions
    if len(filtered) < 3:
        return None  # Pas assez de données
    
    # 4. Retourner les transactions
    return filtered

def calculate_price(commune, type_bien, surface_m2):
    """
    Calcule le prix estimé
    """
    transactions = find_similar_properties(commune, type_bien, surface_m2)
    
    if transactions is None:
        return {"error": "Pas assez de transactions"}
    
    # Moyenne des prix au m²
    prix_moyen_m2 = transactions['prix_au_m2'].mean()
    
    # Appliquer à la surface
    prix_estime = surface_m2 * prix_moyen_m2
    
    # Intervalle ±15%
    margin = prix_estime * 0.15
    
    return {
        "predicted_price": round(prix_estime, 2),
        "price_per_m2": round(prix_moyen_m2, 2),
        "nb_transactions": len(transactions),
        "confidence_interval": {
            "lower": round(prix_estime - margin, 2),
            "upper": round(prix_estime + margin, 2)
        }
    }
```

---

## 📦 DONNÉES À UTILISER

### Source DVF
- **URL** : https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres/
- **Format** : CSV
- **Taille** : ~500 MB (complet), ~50 MB (Île-de-France)
- **Colonnes clés** : 
  - Adresse
  - Code postal
  - Commune
  - Type de bien
  - Surface
  - Prix de vente
  - Date transaction

### Traitement des données
1. Télécharger DVF complet
2. Filtrer pour Île-de-France seulement (MVPrapide)
3. Supprimer anomalies (prix = 0, surface = 0)
4. Créer colonne `prix_au_m2 = prix / surface`
5. Standardiser `type_bien` (normaliser les libellés)
6. Exporter en CSV optimisé (~50 MB)

---

## 🚀 PHASAGE DU DÉVELOPPEMENT

### Phase 1 : MVP (2-3 jours)
- [ ] Télécharger + nettoyer DVF
- [ ] Parser adresse simple
- [ ] Recherche DVF basique
- [ ] Backend endpoint
- [ ] Frontend Streamlit
- [ ] Tests manuels

### Phase 2 : Polish (optionnel)
- [ ] Stats commune détaillées
- [ ] Gestion erreurs avancées
- [ ] Tests unitaires
- [ ] Documentation complète

---

## 🎓 COMPÉTENCES DÉMONTRÉES

Ce prototype démontre :

1. **Traitement données** : Nettoyage DVF, filtrage
2. **Backend API** : FastAPI, endpoints REST
3. **Frontend UX** : Streamlit, formulaires
4. **Algorithmes** : Recherche, calculs statistiques
5. **DevOps** : Docker, déploiement
6. **Documentation** : Spécification, manuel d'utilisation

---

## 📋 LIMITATIONS & LIMITES DU POC

### Limitations acceptées
- ✓ Prix linéaire à la surface (pas de modèle ML complexe)
- ✓ Pas de géolocalisation fine (juste commune)
- ✓ Données incomplètes / imparfaites de DVF
- ✓ Pas de contexte socio-éco (INSEE)

### Pistes d'amélioration future
- [ ] Intégrer INSEE pour contexte
- [ ] Ajouter visualisation carte (IGN)
- [ ] Modèle ML réel (XGBoost, etc.)
- [ ] Historique des estimations (DB)
- [ ] Comparaison quartiers
- [ ] Évolution temporelle

---

**État** : 🟢 Spécification complète  
**Prochaine étape** : Répartition d'équipe + démarrage

