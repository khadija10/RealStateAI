# 👥 RÉPARTITION D'ÉQUIPE - 5 PERSONNES

## 📊 Vue d'ensemble des Rôles

| Rôle | Personne | Responsabilité | Livrables |
|------|----------|-----------------|-----------|
| **1. Data Engineer** | Personne 1 | DVF + nettoyage | CSV propre |
| **2. Backend Dev** | Personne 2 | FastAPI + logique | API fonctionnelle |
| **3. Frontend Dev** | Personne 3 | Streamlit + UI | App web |
| **4. Full-stack intégration** | Personne 4 | Connexion complets | Tests + Docker |
| **5. Doc + Reporting** | Personne 5 | Dossier + présentation | Documentation |

---

## 🎯 RÔLE 1 : DATA ENGINEER

### Responsabilité
Préparer les données DVF pour que le backend puisse les utiliser.

### Tâches

#### Semaine 1 - Préparation (2-3 jours)
- [ ] **Télécharger DVF**
  - URL : https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres/
  - Télécharger CSV (ou utiliser API)
  - Faire une sauvegarde

- [ ] **Exploration des données**
  - Charger en Pandas
  - Vérifier colonnes disponibles
  - Vérifier qualité (null, doublons)
  - Statuts : `python explore_dvf.py`

- [ ] **Nettoyage DVF**
  - Filtrer Île-de-France seulement
  - Supprimer prix = 0
  - Supprimer surface = 0
  - Supprimer outliers (prix > 10M)
  - Normaliser type_bien (apt → apartment, etc.)
  - Créer colonne `prix_au_m2 = prix / surface`

- [ ] **Export données nettoyées**
  - Créer `data/dvf_idf_clean.csv`
  - Colonnes : adresse, code_postal, commune, type_bien, surface_m2, prix_vente, prix_au_m2, date_transaction
  - Taille finale : ~50-100 MB
  - Index les colonnes pour rapidité

#### Semaine 2 - Optimisation (1 jour)
- [ ] **Indexation pour rapidité**
  - Créer structure de données optimisée
  - Parquet ou feather (plus rapide que CSV)

- [ ] **Documentation données**
  - Documenter le dictionnaire de données
  - Expliquer nettoyage effectué
  - Statistiques (nb lignes, nb communes, etc.)

### Livrables
```
data/
├── dvf_raw.csv           (original)
├── dvf_idf_clean.csv     (principal - 50 MB)
├── data_stats.txt        (statistiques)
└── README_DATA.md        (documentation)
```

### Communication
- **Avant J1** : Partager URL + instructions téléchargement DVF
- **J2** : Partager fichier CSV nettoyé avec backend
- **J3** : Documenter format exact des données
- **Ongoing** : Répondre aux questions du backend sur les données

---

## 🎯 RÔLE 2 : BACKEND DEVELOPER

### Responsabilité
Créer l'API FastAPI qui traite les demandes et retourne les estimations.

### Tâches

#### Semaine 1 - Setup (1 jour)
- [ ] **Configuration FastAPI**
  - Créer `backend/main.py`
  - Configurer CORS pour Streamlit
  - Créer endpoint health check

- [ ] **Charger les données DVF**
  - Charger CSV une fois au démarrage
  - Indexer par commune + type pour rapidité
  - Mettre en cache (global variable)

#### Semaine 1-2 - Logique d'estimation (2 jours)

- [ ] **Créer fonctions utilitaires**
  - `backend/utils/address_parser.py` : Parser adresse
    ```python
    def parse_address(address: str):
        # "123 Rue de Paris, 75001" → {"street": "...", "code_postal": "75001", "commune": "Paris"}
        # Peut être simple regex ou appel API (geopy)
    ```

  - `backend/utils/dvf_search.py` : Chercher dans DVF
    ```python
    def find_similar_properties(commune, type_bien, surface_m2):
        # Retourner les transactions similaires
    ```

  - `backend/utils/price_calculation.py` : Calculer prix
    ```python
    def calculate_price(transactions):
        # Moyenne prix_au_m2, intervalle, etc.
    ```

- [ ] **Créer endpoint principal**
  - `POST /api/predictions/estimate`
  - Valider inputs
  - Appeler les fonctions
  - Retourner JSON

- [ ] **Gestion erreurs**
  - Adresse non trouvée
  - Pas assez de transactions
  - Erreurs de parsing

#### Semaine 2 - Testing (1 jour)
- [ ] **Tests manuels**
  - Tester avec vraies adresses
  - Vérifier résultats réalistes
  - Tester cas d'erreur

- [ ] **Optimisation**
  - Rapidité : < 500ms par requête
  - Mémoire : charger DVF une fois
  - Caching si nécessaire

### Livrables
```
backend/
├── main.py
├── requirements_back.txt
├── utils/
│   ├── address_parser.py
│   ├── dvf_search.py
│   └── price_calculation.py
└── tests/
    └── test_endpoints.py
```

### Communication
- **J1** : Demander format exact CSV à Data Engineer
- **J2** : Partager API spec avec Frontend
- **Tests** : Coordonner avec Frontend pour tester

---

## 🎯 RÔLE 3 : FRONTEND DEVELOPER

### Responsabilité
Créer l'interface Streamlit où l'utilisateur entre ses données.

### Tâches

#### Semaine 1 - Structure (1 jour)
- [ ] **Setup Streamlit**
  - Créer `frontend/app.py`
  - Configurer pages (accueil, estimateur, about)
  - Configuration générale

#### Semaine 1-2 - Formulaire (2 jours)
- [ ] **Page Estimateur (PRINCIPALE)**
  - Titre + description
  - 4 champs :
    - [ ] Input adresse (text)
    - [ ] Input surface (number, min=10, max=500)
    - [ ] Input pièces (number, min=1, max=10)
    - [ ] Dropdown type (apartment/house/studio)
  - Bouton "💰 Estimer le prix"

- [ ] **Affichage résultat**
  - Metrics : Prix, Prix/m², Confiance
  - Intervalle dans une box
  - Nombre de transactions trouvées
  - Message d'erreur si problème

- [ ] **Sidebar**
  - URL API configurable
  - Bouton "Tester connexion API"
  - Info projet

- [ ] **Pages bonus**
  - Page accueil (infos projet)
  - Page "À propos" (doc, contact)

#### Semaine 2 - Styling (1 jour)
- [ ] **UI/UX**
  - Couleurs cohérentes
  - Responsive design
  - Messages clairs
  - Icons/emojis pertinents

### Livrables
```
frontend/
├── app.py
├── pages/
│   ├── home.py
│   ├── estimator.py
│   └── about.py
└── requirements_front.txt
```

### Communication
- **J1** : Attendre API spec du Backend
- **Tests** : Tester avec Backend dev
- **Déploiement** : Coordonner avec Full-stack

---

## 🎯 RÔLE 4 : FULL-STACK / INTÉGRATION

### Responsabilité
Mettre tout ensemble, tester, docker, déploiement.

### Tâches

#### Semaine 1 - Infrastructure (1 jour)
- [ ] **Setup Docker**
  - Créer `docker-compose.yml`
  - Dockerfile backend
  - Dockerfile frontend
  - Network communication

- [ ] **Setup Git**
  - Créer repo GitHub
  - Structure dossiers
  - .gitignore, README.md
  - Commit initial

#### Semaine 1-2 - Intégration (2 jours)
- [ ] **Tests d'intégration**
  - Backend + Frontend communiquent
  - Tester flux complet
  - Tester erreurs

- [ ] **Optimisation**
  - Rapidité
  - Gestion mémoire
  - Caching si besoin

#### Semaine 2 - Déploiement (1 jour)
- [ ] **Docker**
  - `docker-compose up -d`
  - Services démarrent correctement
  - Health checks

- [ ] **Documentation technique**
  - Architecture diagram
  - Instructions déploiement
  - Commandes essentielles

### Livrables
```
projet/
├── docker-compose.yml
├── backend/Dockerfile
├── frontend/Dockerfile
├── .gitignore
├── README.md
└── docs/
    └── SETUP.md
```

### Checklist
- [ ] Backend + DB connectés
- [ ] Frontend appelle API
- [ ] Temps réponse < 500ms
- [ ] Pas d'erreur non gérée
- [ ] Docker fonctionne
- [ ] Tests OK
- [ ] Documentation complète

### Communication
- **Ongoing** : Intégrer code dès dispo
- **Jour 5** : Livrer prototype fonctionnel
- **Daily** : Résoudre blockers

---

## 🎯 RÔLE 5 : DOCUMENTATION & REPORTING

### Responsabilité
Documenter tout et préparer le dossier de prototypage.

### Tâches

#### Semaine 1 - Collecte (2-3 jours)
- [ ] **Documenter chaque composant**
  - Comment fonctionnent les données
  - Comment fonctionne le backend
  - Comment fonctionne le frontend
  - Architecture complète

- [ ] **Prendre des screenshots**
  - Page accueil
  - Formulaire rempli
  - Résultat affiché
  - Erreur gérée

- [ ] **Tests & résultats**
  - Documenter cas de test
  - Résultats obtenus
  - Vérification réalisme

#### Semaine 2 - Dossier de Prototypage (2 jours)

Créer le **dossier de prototypage** selon la spec :

```
📄 DOSSIER_PROTOTYPAGE.docx

1. CONTEXTE (0.5 page)
   - Présentation du projet
   - Objectif du POC
   - Problématique métier

2. LE POC (0.5 page)
   - Hypothèses
   - Ce que valide le POC
   - Hors périmètre
   - Contraintes

3. LES DONNÉES (0.5 page)
   - Origine (DVF)
   - Description (colonnes, nb lignes)
   - Traitement effectué

4. TECHNIQUE (1 page)
   - Architecture (diagram)
   - Stack (Streamlit, FastAPI, Python)
   - Algorithmes (recherche DVF, calcul moyenne)
   - Justification des choix
   - Alternatives considérées

5. MANUEL D'UTILISATION
   - Lien Git
   - Lien prototype
   - Features list avec screenshots
   - Extraits de code
```

### Code à produire
```
docs/
├── DOSSIER_PROTOTYPAGE.md (markdown)
├── screenshots/
│   ├── accueil.png
│   ├── formulaire.png
│   ├── resultat.png
│   └── erreur.png
├── ARCHITECTURE.md
└── RESULTATS_TESTS.md
```

### Étapes
1. **J2** : Commencer à documenter au fur et à mesure
2. **J4** : Collecter tous les screenshots
3. **J5** : Finaliser et formatter dossier

### Format
- Arial 12 pour texte, 14 pour titres
- Max 3 pages (soyez concis!)
- Une page par section maximum
- Diagrams + screenshots
- Fichier Word (.docx)

### Communication
- **Ongoing** : Recevoir infos des autres rôles
- **Daily** : Documenter les avancées
- **J4** : Finalize avec validations

---

## 🗓️ TIMELINE (2 SEMAINES)

### SEMAINE 1

| Jour | Data Eng | Backend | Frontend | Full-stack | Doc |
|------|----------|---------|----------|-----------|-----|
| **J1** | ✓ DL DVF | ✓ Setup FastAPI | ✓ Setup Streamlit | ✓ Setup Git | Planning |
| **J2** | Explore | Parser adresse | Formulaire | Infrastructure | Collecte |
| **J3** | Nettoyage | Search DVF | Affichage résultat | Docker setup | Screenshots |
| **J4** | Export CSV | Tests | Sidebar | Tests intégration | Draft doc |
| **J5** | ✓ CSV prêt | ✓ API fonctionne | ✓ UI fonctionne | ✓ Docker OK | Doc v1 |

### SEMAINE 2

| Jour | Backup | QA | Polish | Deploy | Final |
|------|--------|-----|--------|--------|-------|
| **J6** | Optimisation | Tests complets | UI/UX | Optim | V2 doc |
| **J7** | Archive | Bug fix | Refine | Health check | Final dossier |
| **J8** | Support | Validation | ✓ Fini | ✓ Live | ✓ Livré |

---

## 🎯 CHECKLIST DE LIVRAISON

### Code
- [ ] Backend API fonctionnelle
- [ ] Frontend Streamlit fonctionnel
- [ ] Données DVF nettoyées
- [ ] Docker compose fonctionne
- [ ] Git avec commits réguliers
- [ ] README.md complet
- [ ] .gitignore propre

### Tests
- [ ] Cas d'usage nominal (OK)
- [ ] Cas d'erreur (OK)
- [ ] Rapidité < 500ms (OK)
- [ ] Pas d'erreur non gérée (OK)

### Documentation
- [ ] Dossier prototypage complet
- [ ] Screenshots toutes les pages
- [ ] Manuel d'utilisation
- [ ] Code commenté

### Déploiement
- [ ] Docker fonctionnel
- [ ] `docker-compose up -d` = OK
- [ ] Services en health
- [ ] Accessible sur localhost

---

## 💬 COMMUNICATION INTRA-ÉQUIPE

### Daily Standup (5 min, chaque matin)
Chaque personne rapporte :
- ✓ Ce qui a été fait hier
- ⏱️ Ce qui va être fait aujourd'hui
- 🚫 Blockers (si any)

### Sync Points
- **J2 après-midi** : Data Eng + Backend (format CSV)
- **J3 après-midi** : Backend + Frontend (API spec)
- **J4 après-midi** : Full-stack + tous (tests intégration)
- **J5 soir** : Doc + tous (finale)

### Outils
- **GitHub Projects** : Kanban board
- **Slack/Discord** : Chat temps réel
- **Issues** : Blockers, bugs

---

## 🏁 CRITÈRES DE SUCCÈS ÉQUIPE

### Pour chaque rôle
- **Data Eng** : CSV propre, documenté, utilisable
- **Backend** : API rapide, robuste, bien structurée
- **Frontend** : UI claire, responsive, user-friendly
- **Full-stack** : Tout déployé, fonctionnel, testé
- **Doc** : Dossier complet, clair, respect format

### Global
- ✅ Prototype fonctionnel jour J8
- ✅ Pas de dette technique critique
- ✅ Code qualité acceptable
- ✅ Équipe satisfaite

---

**Status** : 🟢 Répartition prête  
**Next** : Démarrage projet jour 1

