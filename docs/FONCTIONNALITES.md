# Fonctionnalités de RealStateAI

**État au 2 octobre 2026, branche `feat/interface-v1.5`.**
Cette version n'est pas encore déployée : Render sert la v1.4.2. Les évolutions depuis cette version sont détaillées dans [`RAPPORT_V1_5.md`](RAPPORT_V1_5.md).

RealStateAI estime le prix des logements en Île-de-France (Paris et les 7 départements de la région), simule le financement et la plus-value, et publie l'erreur réelle de son modèle, quartier par quartier.

---

## 1. Estimation d'un bien

### Saisie

- **Adresse avec suggestions pendant la frappe** (API Adresse de l'État, navigation au clavier). Choisir une suggestion fixe aussi le code postal. L'adresse active le modèle de machine learning.
- **Ou commune seule**, cherchable parmi les 1 279 communes du dataset. Sans adresse, l'estimation repose sur la médiane des ventes comparables de la commune.
- **Type de bien** : appartement, maison, autre.
- **Surface et nombre de pièces**, obligatoires, sans valeur par défaut.
- **DPE retrouvé automatiquement** à partir de l'adresse et de la surface dans la base de l'ADEME : classe, isolation, chauffage, année. On applique la même règle d'appariement que le pipeline à l'entraînement, et rien n'est à saisir.
- **Panneau « Affiner l'estimation »**, facultatif : classe DPE de A à G et année de construction, seulement pour corriger le DPE retrouvé.
- **Contrôles de saisie** avec des messages clairs : adresse ou commune manquante, commune absente de la liste, surface inférieure à 9 m², année invalide. Le backend refuse aussi un ratio surface / pièces irréaliste et toute adresse hors Île-de-France.
- **Rien n'est estimé automatiquement** : l'estimation part uniquement d'un clic sur « Estimer » ou sur une carte de secteur.
- **Connexion demandée** avant d'estimer ; l'estimation reprend d'elle-même une fois connecté.

### Résultat

- **Prix estimé**, prix au m² et **fourchette à 85 %**, calibrée pour contenir le prix réel 85 fois sur 100.
- **Classe de fiabilité de la commune**, reprise du protocole d'évaluation : *fiable*, *indicative*, *secteur difficile* ou *peu de ventes de contrôle*. S'y ajoutent l'erreur moyenne locale et le nombre de ventes de contrôle.
- **Ventes dans l'immeuble** : les 6 dernières ventes de la même parcelle, avec leur date, surface, pièces et prix, et le prix au m² ramené au marché du jour. C'est la preuve que l'agent peut montrer à un vendeur.
- **Performance énergétique** : badge DPE, année de construction, origine du DPE (retrouvé à l'adresse avec sa date, ou saisi), avertissement quand plusieurs logements de surface proche ont un DPE à cette adresse, et part de passoires thermiques F et G dans le code postal.
- **Alertes** : adresse mal localisée, passoire thermique (décote et interdiction de location), notes du repli DVF, et invitation à saisir l'adresse quand l'estimation ne repose que sur la commune.
- **Secteur** : médiane du prix au m², écart du bien au marché, position du bien entre le 1ᵉʳ et le 9ᵉ décile, nombre de ventes, courbe d'évolution 2021–2025.
- **Plus-value projetée à 10 ans**, au rythme observé sur le secteur.
- **Détail du calcul** : méthode, adresse normalisée, erreur locale et erreur validée, nature de la fourchette, nombre de variables, date d'entraînement, volumes d'entraînement et de test.
- **Actions** :
  - exporter une fiche PDF (bien, type, surface, DPE, année, fiabilité, prix, fourchette) ;
  - copier un lien de partage qui reconstitue le formulaire ;
  - simuler la plus-value ;
  - simuler le financement, avec le prix et le département transmis.
- **Pastille sur l'onglet Estimation** une fois une estimation disponible. Le formulaire, le résultat et les simulations restent affichés quand on change d'onglet, comme en v1.4.

### Page d'accueil de l'estimation

- **Chiffres clés du modèle**, servis par l'API : transactions analysées, nombre de variables, erreur moyenne mesurée sur le test officiel, part des estimations à moins de 20 % du prix réel.

---

## 2. Financement

- **Situation de l'emprunteur** : revenus nets du foyer, apport, crédits en cours, loyer actuel, durée (15, 20 ou 25 ans), situation professionnelle (CDI, fonctionnaire, CDD, indépendant, intérim, sans emploi), nombre d'adultes et d'enfants, primo-accession, bien neuf (VEFA) ou ancien.
- **Projet** : prix du bien et département. Les deux sont préremplis quand on arrive depuis une estimation.
- **Calcul au clic** par le moteur de règles du backend, puis mis à jour en direct quand on modifie un réglage. Aucun calcul approximatif côté navigateur.
- **Résultats** :
  - verdict de conformité aux normes du HCSF (Haut Conseil de stabilité financière) : conforme, dérogation nécessaire, ou non finançable ;
  - décision indicative ;
  - mensualité, avec assurance et hors assurance, taux indicatif ;
  - montant emprunté, taux d'endettement et sa jauge (plafond de 35 %) ;
  - score du dossier sur 100 et son appréciation ;
  - plan de financement : prix, frais d'acquisition, frais de dossier et de garantie, apport, coût total du crédit, coût total de l'opération, reste à vivre ;
  - frais d'acquisition détaillés (droits de mutation, émoluments du notaire, débours) ;
  - points forts et points de vigilance.
- **Dossier de prêt** : liste des pièces justificatives adaptée à la situation, à cocher au fur et à mesure.
- **Agent conversationnel** : il répond aux questions sur le financement en appelant les calculs réels du moteur, sans inventer de chiffre. Ses outils couvrent la capacité d'emprunt, le budget maximum, l'analyse du projet, les frais d'acquisition, la comparaison des durées, la vérification et la génération du dossier, et le plan de budget. Le modèle de langage est configurable (API compatible OpenAI).
- Onglet **réservé aux comptes connectés**.

---

## 3. Plus-value

- **Saisie** : secteur, prix d'achat, année d'achat (2021 à 2026), horizon de revente (1 à 30 ans), résidence principale ou investissement. Le bien et son secteur sont préremplis quand on arrive depuis une estimation.
- **Trois scénarios tirés du marché observé** : tendance 2021-2025, rythme de la dernière année, stabilité des prix. Pour chacun : prix de revente et plus-value.
- **Résultat du scénario choisi** : plus-value brute, prix de revente, impôt sur la plus-value et gain net après frais d'acquisition.
- **Trajectoire du prix au m²** : prix observés de 2021 à 2025, puis l'éventail des trois scénarios jusqu'à la revente.
- **Fiscalité 2026** : exonération de la résidence principale, sinon impôt sur le revenu à 19 % et prélèvements sociaux à 17,2 %, avec les abattements pour durée de détention, la surtaxe sur les plus-values élevées, et les forfaits d'acquisition et de travaux. Une courbe montre les abattements.
- **Résilience des secteurs** : variation du prix au m² de 2021 à 2025 pour les 25 secteurs aux plus gros volumes de ventes, avec le secteur choisi mis en évidence.
- **Simulation au clic** sur « Simuler la plus-value ». Elle est directe quand on arrive depuis une estimation. Les séries de prix viennent de l'API.

---

## 4. Marché

- **Carte des prix** : carte interactive (Leaflet) des communes d'Île-de-France, colorées selon le prix médian au m², avec un filtre par département, une légende et des infobulles.
- **Référence du marché** : évolution mensuelle du prix médian au m² par département, avec un choix des départements à comparer (Paris, Hauts-de-Seine et Seine-Saint-Denis au départ).

---

## 5. Compte et historique

- **Compte** : création, connexion, mot de passe oublié avec code de réinitialisation, changement de mot de passe, suppression du compte. La session tient par un jeton JWT. Nombre de tentatives limité : 3 par minute pour l'inscription et la demande de réinitialisation, 5 par minute pour la connexion.
- **Historique du compte, regroupé par bien** (même adresse, type, surface et pièces) :
  - une ligne par bien : dernier prix, fourchette, classe de fiabilité, DPE, nombre d'estimations et évolution du prix depuis la première ;
  - toutes les estimations sont gardées : le prix d'un même bien peut changer d'une estimation à l'autre (marché, DPE retrouvé, modèle réentraîné) ;
  - **« Voir le résultat »** réaffiche l'estimation enregistrée telle qu'elle était, sans recalcul, avec sa date ;
  - **« Ré-estimer »** relance l'estimation pour obtenir le prix d'aujourd'hui ;
  - **simulations rattachées au bien** : dernière plus-value (scénario, revente, plus-value, gain net) et dernier financement (mensualité, endettement, conformité HCSF, score), enregistrés automatiquement ;
  - recherche, tri (récents, prix croissant ou décroissant), suppression d'un bien ou d'une estimation, effacement complet avec confirmation ;
  - **comparaison de deux biens** : écart de prix et de prix au m², fourchette, DPE, fiabilité, bien le moins cher.
  Chaque compte ne voit que ses propres estimations.
- **Profil** : adresse e-mail, date d'inscription, changement de mot de passe, zone de danger pour supprimer le compte.
- **Mode clair / sombre**, mémorisé sur l'appareil.
- **Indicateurs dans l'en-tête** : état des données DVF et couverture du DPE.

---

## 6. API (backend FastAPI)

| Endpoint | Rôle |
|---|---|
| `POST /api/predictions/estimate` | estimation : modèle ML à partir d'une adresse, repli sur la médiane DVF à partir d'une commune |
| `GET /api/health` | état du service, informations sur le modèle, **résultats de la validation officielle** |
| `GET /api/metadata/communes` | liste des communes |
| `GET /api/market/secteurs` | statistiques par secteur : médiane, déciles, ventes, évolution 2021-2025 |
| `GET /api/market/map` | statistiques par commune pour la carte |
| `GET /api/market/trends` | tendances mensuelles par département |
| `POST /api/financing/dossier` | dossier de financement complet |
| `POST /api/financing/dossier/resume` | résumé du dossier |
| `POST /api/financing/agent/message`, `DELETE /api/financing/agent/{session}` | agent conversationnel |
| `GET /api/financing/rates` | taux indicatifs du barème |
| `POST /api/auth/register`, `/login`, `/forgot-password`, `/reset-password` | authentification |
| `GET`, `DELETE /api/auth/me`, `PUT /api/auth/me/password` | compte |
| `GET /api/search-history`, `DELETE /api/history[/{id}]` | historique (avec le résultat complet de chaque estimation) |
| `PUT /api/history/{id}/simulation` | rattacher une simulation de plus-value ou de financement à une estimation |

---

## 7. Modèle de prix

- **LightGBM**, 45 variables, entraîné sur la cible log(prix au m²) avec une perte de Huber, à partir de 700 270 ventes DVF de 2021 à 2025.
- **Sources** :
  - DVF : le bien et le marché local, sans fuite temporelle ;
  - ventes du même immeuble et revente du même logement ;
  - DPE de l'ADEME : classe, déperditions de l'enveloppe, chauffage, part de passoires du code postal ;
  - IRIS de l'INSEE : revenu médian, type d'habitat, part de propriétaires ;
  - BDNB du CSTB : niveaux, hauteur, année, matériaux, monuments historiques, logement social, quartier prioritaire.
- **Fourchette** : quantiles q7,5 et q92,5, calibrés par la méthode CQR (*conformal quantile regression*) pour chaque classe de communes.
- **Inférence alignée sur l'entraînement** (`ml/contexte.py`) : parcelle retrouvée par l'adresse, puis immeuble, IRIS, bâtiment et DPE recalculés comme dans le pipeline.
- **Évaluation fixée avant la mesure** ([`protocole_evaluation.md`](protocole_evaluation.md)) : test sur octobre–décembre 2025, jamais vu à l'entraînement. Résultat : **MAPE 14,91 %, 50,2 % des estimations à ±10 %, 78,0 % à ±20 %.** Le détail par segment est dans [`scenarios_performance.md`](scenarios_performance.md).

---

## 8. Données et MLOps

- **Pipeline de données** bronze → silver → gold (DuckDB) : ingestion DVF, nettoyage et déduplication, filtres d'outliers relatifs à la commune, features de marché sans fuite, enrichissements DPE, IRIS et BDNB, contrôle qualité (schéma pandera et seuils) qui bloque la CI en cas d'échec.
- **Suivi des expériences** avec MLflow.
- **CI/CD GitHub Actions** :
  - tests du backend et test de non-régression du modèle (seuil de MAPE) à chaque push ;
  - **surveillance hebdomadaire de la dérive** du modèle, avec ouverture automatique d'une issue en cas de dérive ;
  - **réentraînement automatique annuel** à la publication DVF de mai, avec un seuil d'acceptation.
- **Scénarios de test** : performance par segment, cohérence métier (effet du DPE, quartiers, comparaison avec les Notaires) et cohérence entre l'application et le modèle hors ligne.
- **Déploiement** : image Docker du backend sur Render (elle embarque le dataset gold et la BDNB agrégée), PostgreSQL ou SQLite pour les comptes et l'historique.
