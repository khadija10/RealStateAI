# Fonctionnalités de RealStateAI

**État au 3 octobre 2026, branche `main`, version 1.5.1.**
Cette version n'est pas encore déployée : Render sert la v1.4.2. Les évolutions depuis cette version sont détaillées dans [`RAPPORT_V1_5.md`](RAPPORT_V1_5.md), dont la section v1.5.1 (retours d'une relecture extérieure).

Règle d'écriture de l'interface : l'information utile d'abord, le mot simple puis le terme exact (« prix médian de la commune », « €/m² actualisé »), pour les particuliers comme pour les professionnels. Tout chiffre affiché est servi par le backend ou mesuré, avec sa source ; les paramètres choisis par l'équipe sont présentés comme tels dans la méthodologie.

RealStateAI estime le prix des logements en Île-de-France (Paris et les 7 départements de la région), simule le financement et la plus-value, et publie l'erreur réelle de son modèle, quartier par quartier.

---

## 1. Estimation d'un bien

### Saisie

- **Un seul champ « Adresse ou commune »** avec suggestions pendant la frappe : les communes du dataset d'abord (1 279), puis les adresses de l'API Adresse de l'État. Une adresse active le modèle de machine learning ; une commune seule donne la médiane des ventes comparables.
- **Type de bien** : appartement, maison, autre.
- **Surface et nombre de pièces**, obligatoires, sans valeur par défaut.
- **DPE retrouvé automatiquement** à partir de l'adresse et de la surface dans la base de l'ADEME : classe, isolation, chauffage, année. On applique la même règle d'appariement que le pipeline à l'entraînement, et rien n'est à saisir.
- **Panneau « Affiner l'estimation »**, facultatif : classe DPE de A à G et année de construction, seulement pour corriger le DPE retrouvé. Son bouton « Mettre à jour l'estimation » n'apparaît qu'une fois un résultat affiché (un seul bouton « Estimer » au départ).
- **Contrôles de saisie** avec des messages clairs : adresse ou commune manquante, surface inférieure à 9 m², année invalide. Le backend refuse aussi un ratio surface / pièces irréaliste et toute adresse hors Île-de-France.
- **Rien n'est estimé automatiquement** : l'estimation part uniquement d'un clic sur « Estimer » ou sur une carte de secteur.
- **Connexion demandée** avant d'estimer ; l'estimation reprend d'elle-même une fois connecté.

### Résultat

Ordre d'affichage : le prix et sa fiabilité, les ventes qui le justifient, la valeur dans 10 ans, la commune, les points à vérifier, la méthodologie.

- **Prix estimé** arrondi au millier, prix au m², **fourchette à 85 %** (« le prix réel y tombe 85 fois sur 100 »), écart au prix médian de la commune.
- **Carte Fiabilité** :
  - un **cercle en trois arcs** avec, au centre, la **marge de prix en euros** (demi-largeur de la fourchette, par exemple ± 44 000 €) ; le pourcentage est dans l'infobulle ;
  - une étiquette **Marge réduite / normale / large** : la fourchette du bien est située parmi les tiers des fourchettes produites par l'application sur les ventes de la période de validation (juillet–septembre 2025, 36 181 ventes : seuils ±21,1 % et ±27,7 %), mesurés par `ml/exporter_largeurs.py` et servis par `/api/health` (`model_largeurs`) ;
  - la **fiabilité locale** en pourcentage : le score `reliability` du backend, soit 100 − l'écart moyen mesuré dans la commune pour une estimation à l'adresse, avec en dessous « écart moyen de 13 % avec le prix réel dans la commune (48 ventes vérifiées) ».
- **Ventes dans l'immeuble** : dernières ventes de la parcelle, prix au m² actualisé avec la série du secteur, puis « au prix 2025, ces ventes donnent environ … pour votre surface (médiane, hors neuf) ».
- **Ventes similaires à proximité** quand l'immeuble a moins de trois reventes : même type de bien, surface à ±20 %, 24 derniers mois publiés, hors ventes sur plan, dans un rayon de 300 m élargi à 600 m puis 1 km s'il y a moins de 5 ventes ; médiane affichée à partir de 3 ventes (`ml/contexte.py`, `ventes_proximite`).
- **Valeur dans 10 ans** : trois chiffres, avec les scénarios communs à toutes les pages (voir la Plus-value).
- **Commune** : position du bien (plus cher qu'environ x % des ventes), prix médian, 8 ventes sur 10, courbe 2021–2025 avec le nombre de ventes de chaque année ; une année de moins de 30 ventes est signalée comme moins sûre.
- **Performance énergétique** : classe DPE, année, source (ADEME et date du diagnostic, ou « indiquée par vous ») ; avertissement quand le DPE est celui d'un logement de surface proche à la même adresse.
- **Alertes courtes** : adresse sans numéro, type de bien incohérent, segment où le modèle est moins précis (avec l'écart mesuré, contre la moyenne), secteur difficile, passoire thermique.
- **À vérifier lors de la visite** : étage et ascenseur, extérieur, stationnement, état, surface Carrez — ce que les ventes notariées ne décrivent pas. Aucun ajustement chiffré : aucune donnée publique ne les mesure pour ce modèle.
- **Méthodologie** (repliée) : calcul, modèle, mesure de l'erreur, et **choix de méthode** (rayons, critères, seuils) présentés comme des paramètres et non des mesures.
- **Actions** :
  - exporter une **fiche PDF d'une page A4**, avec les mêmes chiffres et les mêmes mots que la page (fiabilité, ventes, valeur dans 10 ans, commune, points à vérifier) ;
  - copier un lien de partage qui reconstitue le formulaire ;
  - simuler la plus-value ou le financement, avec le prix et le département transmis.
- **Pastille sur l'onglet Estimation** une fois une estimation disponible.

### Page d'accueil de l'estimation

- **Chiffres clés du modèle**, servis par l'API et arrondis à l'unité : transactions analysées, erreur moyenne mesurée sur le test officiel, part des estimations à moins de 20 % du prix réel. Ils laissent la place au résultat après une estimation.

---

## 2. Financement

- **Formulaire court** : prix du bien (en premier), revenus, apport, crédits en cours, loyer actuel, durée, département, « Premier achat », « Neuf, sur plan (VEFA) ». Le volet **« Préciser »** (fermé par défaut) contient la situation professionnelle, le foyer, les charges du futur logement, et le **taux et l'assurance** à saisir quand la banque ou le courtier les a proposés (sinon : barème indicatif).
- **Préremplissage** depuis l'Estimation (prix, département) ou depuis la Plus-value (prix, département et loyer d'un bien équivalent de la carte des loyers ANIL).
- **Calcul au clic** par le moteur de règles du backend, puis mis à jour en direct.
- **Résultats** :
  - verdict en clair : « Finançable selon les règles des banques », « Au-delà de 35 % : dérogation nécessaire » ou « Non finançable en l'état » (normes HCSF) ;
  - mensualité assurance comprise, taux indicatif ou saisi ;
  - montant emprunté, taux d'endettement et sa jauge (maximum des banques : 35 %), solidité du dossier ;
  - résumé : frais de notaire, coût total du crédit, reste à vivre ;
  - plan de financement en six lignes, frais de notaire détaillés (taxes, rémunération du notaire, frais divers) ;
  - points forts et points de vigilance.
- **Acheter ou louer ?** : délai au bout duquel l'achat devient plus avantageux, pour les trois scénarios communs ; hypothèses dans un volet replié.
- **Aides à vérifier** (premier achat) : PTZ selon la zone de la commune (lien vers le simulateur de zonage), prêt Action Logement, droits de mutation.
- **Mis de côté en v1.5.1** (code conservé, bloc HTML commenté dans `vanilla/financement.js`) :
  - l'**agent conversationnel** : il appelle les calculs réels du moteur ; une clé d'API (Groq, xAI ou autre API compatible OpenAI) se place dans `financement/.env`, jamais commité, et `GET /api/financing/agent/statut` indique s'il est configuré. Mis de côté à cause de la limite de débit de l'offre gratuite en démonstration ;
  - la **liste des pièces du dossier de prêt** : les cases cochées n'étaient pas enregistrées.
- Onglet **réservé aux comptes connectés**.

---

## 3. Plus-value

- **Saisie** : commune, prix d'achat, année d'achat (2021 à 2026), durée avant revente (1 à 30 ans), résidence principale ou investissement, revente par une agence (5 % de frais) ou entre particuliers.
- **Trois scénarios, communs à l'Estimation, au Financement et à la Plus-value** (`vanilla/scenarios.js`) :
  - **baisse** : la dernière correction se reproduit, à son rythme mesuré sur l'indice Notaires-INSEE des prix de l'ancien du département et du type de bien, du point haut de 2021-2022 au point bas suivant (calculé par le backend, `/api/market/indices`, champ `correction_recente`) — par exemple −3,2 %/an pour les appartements des Yvelines, −6,4 %/an en Seine-Saint-Denis ;
  - **prix stables**, scénario central ;
  - **reprise** de 2 %/an, cible d'inflation de la Banque centrale européenne.
  La tendance propre de la commune depuis 2021 est affichée à titre d'information seulement.
- **Prix de revente minimum pour ne rien perdre** (chiffre principal) et, en dessous, en clair : « Soit +1,9 % par an. Atteint seulement si les prix remontent. »
- **Cartes de scénario** : prix de revente d'abord, puis l'écart avec le prix d'achat.
- **Est-ce déjà arrivé ?** : part des périodes passées de même durée (indices Notaires-INSEE depuis 1992 ou 1996) où la hausse nécessaire a été atteinte.
- **Louer plutôt qu'acheter** : loyer d'un bien équivalent (Carte des loyers ANIL 2025) et bouton vers « Acheter ou louer » du Financement, prérempli.
- **Fiscalité 2026**, **trajectoire du prix au m²** et **communes du département depuis 2021**, comme avant, avec des textes raccourcis.

---

## 4. Marché

- **Filtres communs** à la carte et à la référence : **appartements ou maisons**, et **tout le marché, ancien seul ou neuf vendu sur plan (VEFA)**. Une médiane qui mélange maisons et appartements dépend de ce qui s'est vendu (Versailles en 2025 : 6 415 €/m² en appartement, 8 939 € en maison).
- **Carte des prix** : carte interactive (Leaflet) des communes d'Île-de-France, colorées du sable au brun selon le prix médian au m² de la dernière année (sur 2021–2025 pour les communes de moins de 10 ventes), avec un filtre par département, une légende et des infobulles. Paliers espacés en luminosité pour être distingués ; communes de moins de 5 ventes **hachurées**, avec l'explication de la couverture (736 communes ont assez de ventes d'appartements anciens, 1 254 pour les maisons).
- **Référence du marché** : prix médian au m² par département, en moyenne glissante sur 3 mois, avec le choix des départements à comparer.
- Les deux écrans sont **calculés au démarrage du backend sur le dataset servi**, comme les secteurs de l'estimation : mêmes chiffres partout.

---

## 5. Compte et historique

- **Compte** : création, connexion, mot de passe oublié avec code de réinitialisation, changement de mot de passe, suppression du compte. La session tient par un jeton JWT. Nombre de tentatives limité : 3 par minute pour l'inscription et la demande de réinitialisation, 5 par minute pour la connexion.
- **Historique du compte, regroupé par bien** (même adresse, type, surface et pièces) :
  - une ligne par bien : dernier prix et fourchette arrondis au millier, étiquette de marge (la même que sur la page Estimation), DPE, nombre d'estimations ;
  - **écart entre deux estimations expliqué** : autre saisie (DPE, année), nouvelle version du modèle, ou mise à jour des ventes du secteur ; seule la dernière est présentée comme une évolution du marché ;
  - toutes les estimations sont gardées : le prix d'un même bien peut changer d'une estimation à l'autre (marché, DPE retrouvé, modèle réentraîné) ;
  - **« Voir le résultat »** réaffiche l'estimation enregistrée telle qu'elle était, sans recalcul, avec sa date ;
  - **« Ré-estimer »** relance l'estimation pour obtenir le prix d'aujourd'hui ;
  - **simulations rattachées au bien** : dernière plus-value (scénario, revente, plus-value, gain net) et dernier financement (mensualité, endettement, conformité HCSF, score), enregistrés automatiquement ;
  - recherche, tri (récents, prix croissant ou décroissant), suppression d'un bien ou d'une estimation, effacement complet avec confirmation ;
  - **comparaison de deux biens** : écart de prix et de prix au m², fourchette, DPE, fiabilité, bien le moins cher.
  Chaque compte ne voit que ses propres estimations.
- **Profil** : adresse e-mail, date d'inscription, changement de mot de passe, « Supprimer mon compte » avec confirmation.
- **Mode clair / sombre**, mémorisé sur l'appareil.
- **Indicateurs dans l'en-tête** : état des données DVF et couverture du DPE.

---

## 6. API (backend FastAPI)

| Endpoint | Rôle |
|---|---|
| `POST /api/predictions/estimate` | estimation : modèle ML à partir d'une adresse (avec ventes de l'immeuble et ventes proches), repli sur la médiane DVF à partir d'une commune |
| `GET /api/health` | état du service, informations sur le modèle, **résultats de la validation officielle**, tiers de largeur des fourchettes (`model_largeurs`) |
| `GET /api/metadata/communes` | liste des communes |
| `GET /api/market/secteurs` | statistiques par secteur : médiane, déciles, ventes, évolution 2021-2025 et nombre de ventes de chaque année |
| `GET /api/market/map` | statistiques par commune pour la carte |
| `GET /api/market/trends` | tendances mensuelles par département |
| `GET /api/market/indices` | indice Notaires-INSEE du département et rythme de la dernière correction (`correction_recente`) |
| `POST /api/financing/dossier` | dossier de financement complet (taux et assurance facultatifs : `taux_nominal`, `taux_assurance`) |
| `POST /api/financing/dossier/resume` | résumé du dossier |
| `POST /api/financing/agent/message`, `DELETE /api/financing/agent/{session}`, `GET /api/financing/agent/statut` | agent conversationnel (mis de côté dans l'interface en v1.5.1) |
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
