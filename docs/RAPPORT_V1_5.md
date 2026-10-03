# RAPPORT DE VERSION — RealEstateAI v1.5

**Version v1.5 — 3 octobre 2026, mise à jour en fin de journée (version finale présentée le 6 octobre 2026)**
**Branche : `main` (données, modèle, backend et frontend fusionnés)**
**Comparée à : la version déployée sur Render, image `v1.4.2` (commit `de276ba`, 29 septembre 2026)**

---

## 1. CONTEXTE ET OBJECTIF

Ce rapport documente ce qui a changé entre la **version en ligne sur Render (v1.4.2)** et la **v1.5**, préparée pour la soutenance du 6 octobre 2026 du mastère Data & IA.

Il répond aux retours du jury de soutenance blanche :

> « Améliorer la précision du modèle. Avec 16,5 % d'erreur moyenne et un quart des estimations au-delà de 20 % du prix réel, un agent ne peut pas "prouver un prix à son client". Ajoutez l'étage et l'état du bien, et affichez une erreur par zone, avec une marge fixée avant le test. »

Trois axes de travail :

1. **une évaluation incontestable** : un protocole fixé avant la mesure et daté par commit ;
2. **un modèle plus précis** : ventes du même immeuble, caractéristiques des bâtiments (BDNB), IRIS, proxy de l'état du bien ;
3. **une application qui calcule exactement ce que le modèle a appris**, et qui montre sa preuve : comparables de l'immeuble, fourchette calibrée, fiabilité par commune.

Le 3 octobre 2026, la v1.5 a ensuite été relue par **trois regards extérieurs** : un client non spécialiste, un designer UX/UI et un professionnel de l'immobilier et du crédit. Leurs remarques, ce qui en a été retenu et ce qui a été corrigé sont détaillés en section 7.

Les autres retours du jury (prix, marché adressable, tests utilisateurs) sont traités en section 8. La section 10 rassemble les éléments à reprendre dans le mémoire.

---

## 2. TABLEAU DE BORD — RENDER v1.4.2 vs v1.5

Toutes les lignes de précision sont mesurées **avec le même protocole**, sur les mêmes 31 696 ventes d'octobre à décembre 2025, jamais vues à l'entraînement (section 3).

| Axe | Render v1.4.2 | v1.5 |
|---|---|---|
| **Erreur moyenne (MAPE)** | 16,98 % | **14,91 %** (−2,1 pt) |
| **Estimations à ±10 % du prix réel** | 44,1 % | **50,2 %** |
| **Estimations à ±20 % du prix réel** | 72,9 % | **78,0 %** |
| **Objectifs fixés avant le test (≥ 50 % à ±10 %, ≥ 80 % à ±20 %)** | 44,1 % à ±10 % · 72,9 % à ±20 % | **±10 % : 50,2 %, objectif atteint · ±20 % : 78,0 % au global pour 80 % visés, 81,6 % quand l'immeuble a des ventes, 81,7 % quand le DPE est connu** |
| **Communes « fiables » (erreur locale ≤ 10 %)** | 3 (0,5 % des ventes) | **15 (3,3 % des ventes)** |
| **Fourchette affichée « à 85 % »** | non vérifiée | **calibrée : prix réel dedans 84,7 % du temps** |
| **Features du modèle** | 28 | **45** |
| **Sources de données** | DVF, DPE (classe) | **DVF, DPE (classe + déperditions + chauffage), IRIS INSEE, BDNB CSTB, ventes de l'immeuble** |
| **Méthode d'évaluation** | 15 % de 2025 tirés au hasard, arrêt anticipé sur ce même test | **protocole fixé avant mesure, test strictement postérieur, mesure unique** |
| **Erreur affichée par l'application** | 16,37 % (évaluation optimiste) | **14,91 % (validation officielle)** |
| **Comparables de l'immeuble renvoyés par l'API** | non | **oui (6 dernières ventes, prix ramenés au marché du jour)** |
| **DPE retrouvé par son numéro ADEME** | non | **oui** |
| **Chiffres du frontend** | écrits en dur, périmés | **servis par le backend** |
| **Segments difficiles signalés à l'utilisateur** | non | **oui, avec leur erreur mesurée sur le test** |
| **Historique** | liste d'estimations | **regroupé par bien : résultat complet, évolution du prix, simulations rattachées** |
| **Confirmation sur la validation (juil.–sept. 2025)** | — | **14,09 %, 50,9 % à ±10 %, 79,6 % à ±20 %** : les deux périodes racontent la même histoire |
| **Ventes sur plan (VEFA)** | mélangées partout | **signalées dans l'immeuble, écartées des statistiques de secteur** ; testées dans le modèle, sans gain (section 4.4) |
| **Carte et référence du marché** | maisons et appartements mélangés ; carte issue d'une ancienne extraction | **séparées par type de bien et par marché (tout, ancien, neuf), calculées sur le dataset servi** |
| **Avis de valeur PDF** | fiche reprenant le formulaire | **avis de valeur d'une page : prix, fourchette, fiabilité, ventes de l'immeuble, marché, points d'attention, méthode** |
| **Financement** | mensualité, HCSF, frais | **+ point mort acheter ou louer, aides aux primo-accédants signalées, montants saisissables** |
| **Mémoire du backend au chargement** | — | **pic de 979 Mo** avec les statistiques de marché (2 627 Mo avant la correction de la section 5.2) |

À noter : avec son ancienne méthode, la v1.4.2 affichait 16,37 % d'erreur. Le même modèle, mesuré proprement, est à 16,98 %. L'ancienne évaluation surestimait donc le modèle d'environ 0,6 point (section 3.1).

---

## 3. ÉVALUATION — UNE MARGE FIXÉE AVANT LE TEST

### 3.1 Deux défauts de l'ancienne évaluation

| Défaut | v1.4.2 | v1.5 |
|---|---|---|
| Test non chronologique | 15 % des ventes 2025 tirées **au hasard**, les 85 % restants à l'entraînement : mêmes mois, mêmes rues | test **strictement postérieur** à toutes les données d'entraînement |
| Test utilisé pour régler le modèle | l'arrêt anticipé choisissait le nombre d'arbres **sur le test** | jeu de **validation séparé** ; test mesuré **une seule fois** |
| Erreur locale ≠ erreur globale | médiane des erreurs, divisée par le prix **prédit**, dès 5 ventes | même définition que l'erreur globale, au moins 30 ventes |

Le point fort cité par le jury, « un test chronologique sur 2025 plutôt qu'un découpage aléatoire », n'était donc qu'en partie exact. Il l'est désormais.

### 3.2 Le protocole — [`docs/protocole_evaluation.md`](protocole_evaluation.md)

Commité **avant** toute mesure. Le commit en fait foi.

| Jeu | Période | Usage |
|---|---|---|
| Entraînement | janvier 2021 → juin 2025 | apprentissage |
| Validation | juillet → septembre 2025 | arrêt anticipé et calibration de la fourchette |
| **Test** | **octobre → décembre 2025** | **mesure unique** |

Les seuils et leur justification métier :

- **Objectif global** : au moins 50 % des estimations à ±10 % (une marge comparable à une marge de négociation courante) et au moins 80 % à ±20 %.
- **Classement des communes** : *fiable* si l'erreur locale est ≤ 10 %, *indicative* jusqu'à 20 %, *à compléter* au-delà, *données insuffisantes* sous 30 ventes de test.
- **Fourchette** : couverture ≥ 80 % au global et dans chaque classe, largeur médiane ≤ 30 % du prix.

**Historique daté :**

| Commit | Contenu |
|---|---|
| `689c181` | protocole et seuils, avant toute mesure |
| `f425ff4` | addendum : filtre d'outliers ML, avant mesure |
| `ba5021c` | mesure du modèle v1 |
| `1412817` | addendum : fourchette annoncée, avant mesure |
| `fb413ff` | addendum 8 : validation du v2, modèle figé (`c77b014`), avant mesure |
| `9807cec` | mesure du v2 |

**Deux réserves, déclarées dans l'addendum 8 :**
1. la période octobre–décembre 2025 avait déjà servi à *mesurer* le v1 (mesurer un autre modèle ne règle rien du v2) ;
2. l'entraînement de production l'a utilisée pour son arrêt anticipé, *après* le gel de tous les choix du v2.

Tous les choix du v2 ont été faits sur juillet–septembre 2025, jamais en regardant octobre–décembre.

### 3.3 Résultats officiels

| Modèle | MAPE | ±10 % | ±20 % | Sans filtre outliers | Source |
|---|---:|---:|---:|---:|---|
| Render v1.4.2 (28 features) | 16,98 % | 44,1 % | 72,9 % | 18,86 % | [`resultats_protocole_render_…`](resultats_protocole_render_2025-10_2025-12.md) |
| v1 (+ IRIS, proxy DPE ; 33 features) | 16,71 % | 45,0 % | 73,7 % | 18,59 % | [`resultats_protocole_…`](resultats_protocole_2025-10_2025-12.md) |
| **v2 (v1.5 ; 45 features)** | **14,91 %** | **50,2 %** | **78,0 %** | **16,63 %** | [`resultats_protocole_v2_…`](resultats_protocole_v2_2025-10_2025-12.md) |

« Sans filtre outliers » : mêmes ventes de test, y compris les 1,4 % de ventes atypiques (viagers, ventes familiales, biens d'exception) retirées de la mesure principale.

**Lecture des résultats, critère par critère :**
- **±10 % : 50,2 %, objectif atteint** (≥ 50 %).
- **±20 % : 78,0 % au global, pour 80 % visés.** Ce taux est **dépassé dans les cas où l'application dispose d'une preuve** : 81,6 % quand l'immeuble a des ventes, 81,7 % quand le DPE est connu (section 6.1).
- **Confirmation sur la validation** (juillet–septembre 2025, 36 181 ventes, section 4.4) : 14,09 %, 50,9 % à ±10 %, 79,6 % à ±20 %.

**La règle n'a pas été déplacée après la mesure.** Les fichiers de résultats générés au moment de la mesure ([`resultats_protocole_v2_…`](resultats_protocole_v2_2025-10_2025-12.md)) conservent leur verdict d'origine : ils constituent la trace horodatée du protocole et ne sont jamais modifiés.

**Fourchette du v2** ([`resultats_fourchette_v2_…`](resultats_fourchette_v2_2025-10_2025-12.json)) : la couverture passe de 71,5 % (brute) à **84,7 %** (calibrée), pour une promesse de 85 %. La promesse est donc tenue en moyenne. Deux sous-critères restent à améliorer : la couverture de la classe « à compléter » (78,2 %, seuil 80 %) et la largeur médiane (50 % du prix, seuil 30 %). Pour resserrer la fourchette, il faut un modèle plus précis : la calibration la rend honnête, pas plus étroite.

---

## 4. AMÉLIORATIONS DU MODÈLE

### 4.1 Gains mesurés sur la période de développement

Période de développement : test juillet–septembre 2025, entraînement jusqu'à mars 2025, arrêt anticipé avril–juin. C'est la seule période sur laquelle les choix ont été faits.

| Étape | MAPE | ±10 % | ±20 % |
|---|---:|---:|---:|
| Référence (v1 : DVF + DPE + IRIS + proxy état du bien) | 15,71 % | 46,1 % | 75,3 % |
| + ventes du même immeuble et revente du logement | 15,07 % | 48,4 % | 77,3 % |
| + cible log(prix) et perte de Huber | 14,56 % | 49,3 % | 78,1 % |
| + `colsample_bytree` 0,5 | 14,50 % | 49,7 % | 78,4 % |
| **+ BDNB (caractéristiques des immeubles)** | **14,09 %** | **50,9 %** | **79,6 %** |

**Pistes testées puis écartées**, faute de gain :
- les ventes de la même rue et celles dans un rayon de 100 m n'apportent rien de plus que l'immeuble et la cellule d'environ 1 km. Le code a été retiré ;
- les hyperparamètres au-delà de `colsample` : les écarts restent à ±0,05 pt, soit du bruit.

### 4.2 Données ajoutées depuis Render

| Source | Ce qu'elle apporte | Couverture | Poids dans le modèle |
|---|---|---|---:|
| **IRIS (INSEE)** | revenu médian, part de logements collectifs, part de propriétaires du quartier | 100 % des ventes | 8,2 % |
| **DPE (ADEME), proxy de l'état du bien** | déperditions de l'enveloppe par m², type de chauffage | 58,7 % | inclus dans 8,6 % (DPE) |
| **Même immeuble (DVF)** | prix des ventes de l'immeuble sur 24 mois et revente du même logement, ramenés au marché du jour | 53,8 % / 2,7 % | 6,0 % |
| **BDNB (CSTB)** | niveaux, hauteur, année de construction, logements, matériau des murs, distance aux monuments historiques, part de logement social, quartier prioritaire | 93,4 % | 18,6 % |

Le « poids dans le modèle » est la part de l'importance totale des features.

**Réponse au jury sur l'étage et l'état du bien.** L'étage n'existe dans aucune source ouverte. L'état du bien non plus, mais deux proxys techniques sont désormais utilisés : les déperditions thermiques du DPE, et les caractéristiques du bâtiment (année, matériaux, hauteur) issues de la BDNB. `bdnb_annee_construction`, `bdnb_mat_mur` et `dpe_deperdition_enveloppe_m2` figurent parmi les 8 features les plus importantes.

Toutes les nouvelles features sont **sans fuite temporelle** : seuls les mois strictement antérieurs à la vente sont utilisés ([`data_dictionary.md`](data_dictionary.md)).

### 4.3 Entraînement de production

- **Cible log(prix au m²) et perte de Huber** : l'erreur est jugée en pourcentage, et la perte de Huber reste robuste aux ventes atypiques qui subsistent.
- **Deux temps** : arrêt anticipé sur les 3 derniers mois, puis réentraînement sur **toutes** les ventes avec le nombre d'arbres retenu. Le modèle connaît ainsi le marché le plus récent.
- **Fourchette calibrée par CQR** (conformal quantile regression), classe de communes par classe de communes ([`calibration.json`](../Backend/models/calibration.json)).
- **Erreur locale par commune** selon la définition du protocole ([`local_mape.json`](../Backend/models/local_mape.json)).

### 4.4 Expérience du 3 octobre : l'indicateur de vente sur plan (`est_vefa`)

Un professionnel a fait remarquer que les ventes sur plan (VEFA) portent une « prime au neuf », qui disparaît à la première revente. Le gold contient l'indicateur `est_vefa`, mais le modèle ne l'utilisait pas.

**Méthode, conforme au protocole :** la décision se prend sur la **validation** (juillet–septembre 2025), jamais sur le test. Les deux modèles sont mesurés avec le même code, l'un après l'autre ([`ml/experiences/`](../ml/experiences/)). La production n'est pas touchée : l'expérience utilise une copie de la configuration.

| Validation juil.–sept. 2025 (36 181 ventes) | v2 (production) | v2 + `est_vefa` |
|---|---:|---:|
| Erreur moyenne (MAPE) | 14,09 % | 14,07 % |
| Estimations à ±10 % | 50,9 % | 51,2 % |
| Estimations à ±20 % | 79,6 % | 79,5 % |
| Sans filtre des ventes atypiques | 15,20 % | 15,17 % |
| Communes « fiables » | 41 | 38 |

**Décision : non retenu.** Les écarts sont de l'ordre du centième de point, dans les deux sens. La raison est dans les données : les ventes sur plan sont passées de 8,2 % des ventes en 2021 à **1,9 % en 2025**, et seulement 424 des 31 696 ventes du test (1,3 %), sur lesquelles le modèle se trompe déjà peu (8,1 %).

**En revanche, la VEFA change l'affichage.** Elle faussait les statistiques de secteur : voir la section 5.2 (Bobigny).

*Note technique :* le script d'évaluation ne lit plus que les colonnes utiles du gold (au lieu de 66), car le chargement complet dépassait la mémoire de la machine de développement. Les lignes et les valeurs lues sont identiques.

---

## 5. APPLICATION — INFÉRENCE, PREUVE ET DONNÉES SERVIES

### 5.1 L'inférence recalcule les features de l'entraînement

Nouveau module [`ml/contexte.py`](../ml/contexte.py). Pour une adresse saisie, il recalcule les features du modèle :

| Étape | Méthode |
|---|---|
| Parcelle | vente DVF au même numéro à moins d'environ 60 m du point BAN, sinon API Carto de l'IGN |
| Immeuble | ventes de la parcelle sur 24 mois, ramenées au marché du jour ; elles sont aussi renvoyées comme **comparables** |
| Revente | si le numéro de lot de copropriété est transmis à l'API (champ `numero_lot`, non demandé dans l'interface) |
| IRIS | IRIS de la parcelle, sinon celui de la vente connue la plus proche |
| BDNB | caractéristiques de la parcelle |
| DPE | **retrouvé automatiquement à l'adresse** dans la base de l'ADEME (même adresse, même type, surface à 10 % près), comme dans le pipeline : classe, déperditions, chauffage, année. Rien à saisir ; une classe saisie prime |

Exemple au 54 rue de Malte, 75011, sur 66 m² : avec le DPE retrouvé à l'adresse, la fourchette passe de 486 k€–902 k€ à **556 k€–874 k€**. Avant, l'inférence ne recevait le DPE que s'il était saisi, presque jamais, alors que 58,7 % des ventes d'entraînement l'avaient.

### 5.2 Défauts corrigés

| Défaut | Présent sur Render | Correction |
|---|---|---|
| Le prix local (cellule d'environ 1 km) prenait le **maximum sur toutes les années**, souvent le pic 2021-2022 | **oui** | valeur du mois le plus récent |
| Le point BAN tombait sur la parcelle voisine : features d'immeuble et de bâtiment vides ou fausses, IRIS de l'autre côté de la rue | — | parcelle retrouvée via DVF au même numéro |
| Pour une surface < 30 m², la fourchette était **remplacée** par ±20 %, parfois plus étroite que la fourchette calibrée | **oui** | elle ne peut plus qu'être élargie |
| L'estimation plantait avec le modèle à 33 features (IRIS absent à l'inférence) | non (introduit le 2 octobre, jamais déployé) | inférence complète |
| La classe DPE retrouvée par son numéro n'était pas renvoyée | — | renvoyée avec l'année de construction |
| Le formulaire de la nouvelle interface n'a pas de code postal ; `estimer_prix()` l'exigeait : **toutes les estimations par adresse retombaient sur la médiane DVF** | — (nouvelle interface, non déployée) | code postal facultatif, test de signature |
| La part de passoires du code postal (feature du modèle) restait vide sans code postal saisi | — | code postal retrouvé par le géocodage, part de passoires lue dans le gold |
| Une commune seule était envoyée au modèle, géocodée au centre de la commune | — | le modèle seulement à partir d'une adresse ; la commune seule passe par le repli DVF |
| Un délai dépassé sur la BAN faisait basculer l'estimation sur le repli DVF (constaté sur Clichy) | oui | second essai au délai doublé et cache des réponses, pour la BAN, l'API Carto et l'ADEME ([`ml/tests/test_reseau.py`](../ml/tests/test_reseau.py)) |
| Le backend lisait les 66 colonnes du gold : pic de **2 627 Mo** au chargement, au-delà d'une petite instance | oui | seules les colonnes utiles sont lues : pic de **892 Mo**, chargement de 12,8 s à 7,0 s ; **979 Mo** avec le calcul des statistiques de marché |
| Les ventes de l'immeuble étaient ramenées au « marché du jour » avec l'indice de la commune sur 12 mois, alors que la page affiche l'évolution annuelle du secteur : une vente de 2021 « montait » quand le secteur baissait | — | ramenées avec la série du secteur affichée (Maurepas : vente d'août 2021 de 3 883 à 3 480 €/m², −10,4 % comme le secteur) ; médiane de l'immeuble appliquée à la surface et écart avec l'estimation expliqué |
| Une vente sur plan (VEFA) comptait comme une revente dans les ventes de l'immeuble | — | signalée « neuf, sur plan » et écartée de la médiane (Maurepas : médiane des reventes 3 624 €/m², soit environ 236 000 € pour 65 m²) |
| Les statistiques de secteur (médiane, position, courbe, scénarios, résilience) mélangeaient neuf et ancien | — | calculées sur l'ancien seul. **Bobigny, appartements :** 7 453 €/m² en 2021 avec 65 % de neuf, soit une baisse affichée de 54 % jusqu'en 2025 ; **dans l'ancien : de 3 333 à 3 404 €/m², +2 %** |
| La carte des prix et la référence du marché mélangeaient maisons et appartements ; la carte venait d'une ancienne extraction (Versailles : 3 835 ventes contre 5 040 dans le gold) | oui | calculées au démarrage sur le dataset servi, par type de bien et par marché |
| Une maison estimée à l'adresse d'un immeuble (23 rue Lecourbe, où les 3 ventes sont des appartements) donnait un prix sans signification, sans avertissement | — | **alerte** quand le type saisi ne s'est jamais vendu à l'adresse alors que l'autre l'a été au moins 3 fois |
| Une adresse sans numéro (« Rue Proudhon ») laissait croire qu'il n'y avait « aucune vente dans l'immeuble » | — | « Adresse sans numéro : l'immeuble n'a pas pu être identifié » |
| L'interface d'origine lançait une estimation de démonstration à chaque ouverture de page, enregistrée en double (double montage React) : 32 lignes « Paris 11ᵉ » identiques dans un historique | — | plus aucun calcul automatique ; historiques de test nettoyés |
| Les résultats disparaissaient en changeant d'onglet, alors que la pastille verte annonçait une estimation disponible | — (régression de la nouvelle interface) | pages conservées en mémoire, comme en v1.4 |
| Projection de plus-value à 10 ans : médianes annuelles prolongées sans limite (Bobigny : entre 30 000 et 205 000 €) | — | secteurs calculés sur l'ancien (le saut de Bobigny venait du neuf), rythmes limités à ±4 %/an par sécurité ; scénarios revus (section 7.3) |

**Effet mesuré** (section 6.3) : l'écart médian entre l'application et le modèle hors ligne passe de 5,9 % à **2,2 %**, et la part des ventes à moins de 5 % d'écart de 45 % à **70 %**.

### 5.3 Données servies par le backend

| Endpoint | Nouveau contenu |
|---|---|
| `POST /api/predictions/estimate` | champs facultatifs `numero_dpe` et `numero_lot` ; réponse avec `comparables_immeuble`, `classe_fiabilite`, `secteur` (médiane, déciles, ventes, évolution 2021-2025), `dpe_source`, `dpe_date`, `dpe_appariement`, `code_postal`, `dpe_zone_fg_pct` |
| `GET /api/market/secteurs` | **nouveau** : 308 secteurs (appartements, ≥ 200 ventes) classés par prix médian |
| `GET /api/health` | `model_validation` : résultats officiels du protocole |
| `POST /api/predictions/estimate` (suite) | `segments_difficiles` : segments du bien où le modèle se trompe plus que sa moyenne, avec l'erreur mesurée sur le test ; `historique_id` : ligne d'historique de l'estimation |
| `GET /api/search-history` | chaque estimation avec sa **réponse complète** (fourchette, fiabilité, DPE, date d'entraînement du modèle) et ses simulations |
| `PUT /api/history/{id}/simulation` | **nouveau** : rattache la dernière simulation de plus-value ou de financement au bien |
| `POST /api/predictions/estimate` (suite) | `immeuble_reference` (médiane des reventes de l'immeuble ramenée au secteur, nombre de ventes sur plan écartées), `alerte_type`, `adresse_sans_numero` ; chaque comparable porte `vefa` |
| `GET /api/market/map`, `GET /api/market/trends` | paramètres `type_bien` (`apartment`, `house`) et `marche` (`tous`, `ancien`, `neuf`) ; calculés sur le dataset servi, fichiers statiques en repli |
| `GET /api/auth/me` | date d'inscription, affichée dans le profil |

### 5.4 Frontend

- **Refonte de Skander fusionnée sur `main`** : nouveau design, pages Estimation, Financement et Plus-value, mise en page à la manière des portails immobiliers (bandeau pleine largeur, contenu en colonne).
- **Fin des chiffres écrits en dur** : transactions, variables, erreur, secteurs et taux sont lus dans l'API. Les anciennes valeurs étaient périmées : la page annonçait par exemple Paris 6ᵉ à 14 783 €/m², contre 14 146 €/m² dans le dataset.
- **Plus aucun calcul par défaut** : les pages n'affichent plus d'estimation ni de simulation de démonstration ; chaque résultat part d'un clic.
- **DPE retrouvé automatiquement** à l'adresse ; le numéro de DPE et le numéro de lot, inconnus des utilisateurs, ne sont plus demandés.
- **Résultats conservés entre les onglets**, comme en v1.4 : la pastille verte de l'onglet Estimation retrouve le formulaire et le résultat, et les simulations de plus-value et de financement restent affichées.
- **Même scénario central de plus-value** sur la page Estimation et dans le simulateur (module commun `vanilla/scenarios.js`).
- **Segments difficiles signalés** sous la fourchette, avec leur erreur mesurée (sections 6.1 et 9).
- **Historique regroupé par bien** : dernier prix, fourchette, fiabilité, DPE, évolution du prix entre les estimations, « Voir le résultat » sans recalcul, « Ré-estimer », dernières simulations, tri et comparaison de deux biens.
- La fourchette n'est plus présentée comme « calibrée » quand l'estimation vient du repli DVF.
- **Avis de valeur PDF d'une page** : référence, prix arrondi et fourchette avec sa couverture mesurée, fiabilité locale et régionale, ventes de l'immeuble ramenées au marché (VEFA signalée), marché du secteur et position du bien, points d'attention, méthode et mentions. L'export est fidèle à l'écran (fonds imprimés, sans en-têtes du navigateur).
- **Langage clair** : plus de « MAPE », « modèle ML », « variables » ou « déciles » à l'écran (« 10 % des ventes sous… »). Le détail technique est replié dans une section « Méthodologie » en trois cartes : le calcul, le modèle, la mesure de l'erreur.
- **Prix arrondis au millier**, fourchette juste en dessous (« Entre 173 000 € et 266 000 €. Le prix de vente réel tombe dans cette fourchette 85 fois sur 100. »), et mention « Marché observé jusqu'à fin 2025 ».
- **Fiabilité cohérente** : l'anneau prend la couleur de la classe, et les libellés sont « Fiabilité élevée », « correcte », « limitée », « Peu de références ».
- **Financement** : section **« Acheter ou louer ? »** (point mort sur le vrai prêt et le loyer saisi), **aides à vérifier** (PTZ, prêt Action Logement, droits de mutation), « indice de solidité · indicatif » au lieu de « score », mention réglementaire de l'assistant (IOBSP), montants saisissables à côté des sliders.
- **Plus-value** : scénarios « tendance prolongée / stabilité / reprise modérée » ; courbe des abattements masquée en résidence principale ; résilience comparée aux secteurs du même département.
- **Carte et référence du marché** : filtres « Appartements | Maisons » et « Tout le marché | Ancien | Neuf (sur plan) » ; échelle de couleur d'une seule teinte (sable → brun), lisible par les daltoniens ; moyenne glissante sur 3 mois.
- **Système de design** : titres de page uniformes, une seule largeur de colonne, badges à trois sens fixes (information, statut, alerte), cases à cocher pour les options indépendantes et boutons radio pour les choix exclusifs, focus clavier visible, contrastes contrôlés (textes secondaires ≥ 6:1, bouton d'action 4,66:1 pour un seuil de 4,5:1).
- **Navigation** : Historique et Profil dans l'espace du compte, en haut à droite ; résultat de l'estimation placé avant le bloc de présentation ; suggestions d'adresse limitées à l'Île-de-France.

---

## 6. SCÉNARIOS DE TEST

### 6.1 Performance par segment — [`scenarios_performance.md`](scenarios_performance.md)

Même test que le protocole (31 696 ventes), modèles figés : on découpe la mesure officielle sans rien régler. **Le v2 fait mieux que le v1 dans tous les segments.**

| Segment | Ventes | MAPE v1 | MAPE v2 | ±20 % v2 |
|---|---:|---:|---:|---:|
| Grande couronne | 13 751 | 16,5 % | **14,5 %** | 79,5 % |
| Petite couronne | 11 037 | 16,3 % | **14,3 %** | 79,0 % |
| Paris | 6 908 | 17,8 % | **16,5 %** | 73,2 % |
| Appartements | 22 213 | 16,1 % | **14,1 %** | 79,8 % |
| Maisons | 9 483 | 18,2 % | **16,8 %** | 73,5 % |
| < 30 m² | 3 792 | 18,8 % | **17,4 %** | 71,6 % |
| 60–100 m² | 12 069 | 15,9 % | **13,9 %** | 81,1 % |
| DPE du bien connu | 22 117 | 14,5 % | **13,3 %** | 81,7 % |
| DPE inconnu | 9 579 | 21,7 % | **18,7 %** | 69,3 % |
| Ventes antérieures dans l'immeuble | 18 324 | 15,4 % | **13,4 %** | 81,6 % |
| Aucune vente antérieure dans l'immeuble | 13 372 | 18,5 % | **17,0 %** | 72,9 % |

**À retenir pour le jury.** Quand l'immeuble a un historique de ventes ou que le DPE est connu, le modèle **dépasse l'objectif de 80 % à ±20 %**. L'écart restant se concentre sur Paris, les maisons, les très petites surfaces et les biens sans DPE. C'est pourquoi l'application retrouve désormais le DPE à l'adresse, sans rien demander.

### 6.2 Cohérence métier via l'API

Scripts `test_scenarios.py`, `test_adresses.py` et `test_coherence_full.py`, lancés sur l'API locale après les correctifs :

| Scénario | Résultat | Verdict |
|---|---|---|
| Classe DPE, de A à G (65 m², Paris 11ᵉ) | B −2,0 %, C −5,1 %, D −6,2 %, F −12,0 %, G −12,9 % | ✅ décroissance régulière |
| Rues d'un même arrondissement (Paris 8ᵉ, avenue Montaigne vs rue du Rocher) | −25,7 % | ✅ sensible à la rue |
| Paris 18ᵉ, place du Tertre vs boulevard Barbès | −23,7 % | ✅ |
| Comparaison avec les prix médians Notaires-INSEE T1 2025 (10 zones) | écart moyen **10,0 %** (13,3 % avant les correctifs), 9 zones sur 10 à moins de 20 % ; Évry −33 % | ✅ / ⚠️ Évry |
| Surface de 25 m² à 130 m² (même adresse) | hors Paris, prix au m² **décroissant** (Maurepas 4 479 → 2 873 €/m², Montreuil 7 248 → 5 614 €/m²) ; à Paris, **stable à légèrement croissant** (rue de Malte 9 861 → 10 229 €/m²) | ✅ conforme aux ventes (ci-dessous) |
| Nombre de pièces à 65 m² (de 1 à 5) | prix au m² en légère hausse : +4 % à +11 % de 1 à 5 pièces | ⚠️ hors Paris, les ventes d'un même immeuble montrent un effet plat ou légèrement négatif |
| Maison de 100 m² à Paris 11ᵉ | 13 855 €/m² | ⚠️ peu crédible, segment quasi absent des données ; signalé comme segment difficile |

**Correction d'une conclusion de la version précédente du rapport.** L'effet de la surface avait été jugé « contraire au marché parisien ». Les ventes de 2024-2025 disent l'inverse : rapporté au prix de référence de la commune, le m² parisien vaut 0,996 sous 30 m² et 1,091 au-delà de 120 m² (prime des grands appartements anciens). Hors Paris, il baisse nettement : de 1,22 à 0,87 en grande couronne. Le modèle reproduit les deux comportements. Une contrainte de monotonie, envisagée, aurait donc **dégradé** Paris : elle n'a pas été appliquée.

Pour les pièces, à surface égale (60 à 70 m²), dans le même immeuble et hors logement social, le m² varie peu : de −3 % à +3 % selon le nombre de pièces, en baisse hors Paris et en hausse à Paris. L'effet du modèle (+4 % de 3 à 5 pièces) reste faible devant l'erreur moyenne. Il n'est pas corrigé, car le protocole interdit de régler le modèle sur le test, et une contrainte globale irait contre Paris.

Les chiffres Notaires-INSEE sont repris tels quels du script `test_coherence_full.py`. Leur source exacte reste à vérifier avant de les citer.

### 6.3 Cohérence application / modèle — [`scenarios_coherence_app.md`](scenarios_coherence_app.md)

Sur 40 ventes réelles (5 par département), l'estimation de l'application, faite à partir de l'adresse seule, est comparée à la prédiction hors ligne du même modèle. Ce n'est **pas** une mesure de précision : on vérifie que l'inférence calcule les mêmes features qu'à l'entraînement.

| | Écart médian | Ventes à moins de 5 % d'écart |
|---|---:|---:|
| Avant les correctifs | 5,9 % | 45 % |
| **Après les correctifs (section 5.2)** | **2,2 %** | **70 %** |

Les écarts restants s'expliquent :
- l'application estime au marché du jour, alors que le gold utilise le marché du mois de la vente ;
- pour une grande résidence de Verneuil-sur-Seine, DVF géolocalise la vente à 500 m du point BAN.

### 6.4 Maisons et appartements

Comparaison entre l'effet du type de bien dans le modèle (même adresse, 90 m², 4 pièces) et l'écart des médianes de 2025 dans l'ancien :

| Commune | Modèle : maison / appartement | Marché 2025, ancien : maison / appartement |
|---|---:|---:|
| Maurepas | +12 % | +13 % |
| Versailles | +11 % à +27 % selon l'adresse | +38 % |
| Vincennes | +9 % | +27 % |
| Paris 15ᵉ | +14 % | +30 % (44 maisons en 5 ans) |
| Montreuil | +19 % | +2 % |
| Saint-Denis | 0 % | −19 % |

**Lecture.** Le sens de l'écart est juste : une maison vaut en général plus cher au m². Mais le modèle applique un écart presque constant (environ +10 %), alors que le marché varie de −19 % à +38 % selon la commune. Les médianes du marché comparent des biens qui ne sont ni dans les mêmes quartiers, ni de la même taille : elles ne sont pas directement comparables à l'effet du modèle, mais elles montrent que celui-ci n'a pas appris finement l'effet par commune. Le segment « maisons » est d'ailleurs moins précis (16,8 % d'erreur contre 14,1 % pour les appartements) et signalé comme tel à l'utilisateur.

---

## 7. RELECTURES DU 3 OCTOBRE 2026

### 7.1 Un client non spécialiste

*« Beau, sérieux et haut de gamme, mais pas écrit pour moi, et les chiffres ne collent pas entre eux. »*

| Remarque | Vérification | Suite donnée |
|---|---|---|
| Une vente de l'immeuble à 184 000 € contredit l'estimation de 219 528 € | vrai : rien ne l'expliquait | médiane de l'immeuble et explication affichées ; la vente à 184 000 € est la plus basse des quatre |
| Le prix « aujourd'hui » des ventes monte alors que le secteur baisse | vrai : deux indices différents | ventes ramenées avec la série affichée |
| Le marché baisse ou remonte ? | les « +0,9 % » concernaient d'autres départements que celui du bien | scénario de reprise ajouté ; scénarios revus (7.3) |
| Le reste à vivre est contradictoire | deux notions justes mais mal formulées | « 2 936 € par mois, soit 1 336 € de plus que le minimum d'usage (1 600 €) » |
| Fausse précision (prix à l'euro près) | vrai | prix et projections arrondis au millier |
| Jargon (MAPE, LightGBM, déciles, backend) | vrai | langage clair, méthodologie repliée |
| 721 674 contre 700 270 + 31 696 | les ventes de contrôle font partie des 700 270 | libellé corrigé : « 700 270 ventes retenues sur les 721 674 analysées » |

### 7.2 Un designer UX/UI

*« La direction artistique est forte ; les problèmes viennent du système. »*

Corrigé : contrôles Primo-accédant / VEFA (cases indépendantes), montants saisissables, listes avec chevron, suppressions protégées et éloignées, résultat remonté, navigation compte, titres uniformes, badges à sens fixe, graphiques sur une même grammaire (grille, axe gradué), carte monochrome, sélection « Comparer » explicite dans l'historique, focus clavier, contrastes vérifiés.

Déjà réglé avant la relecture : largeurs de conteneur, couleurs de la comparaison, historique regroupé par bien.

**Non retenu :** les chiffres en italique à empattement, conservés par choix d'identité visuelle ; le champ unique « adresse ou commune », jugé trop risqué avant la soutenance.

**Non vérifié :** la version mobile et le mode sombre. La démonstration se fait sur ordinateur.

### 7.3 Un professionnel de l'immobilier et du crédit

*« Financement et fiscalité de niveau professionnel ; estimation et projection de niveau grand public. »*

| Remarque | Vérification | Suite donnée |
|---|---|---|
| La vente d'août 2021 de l'immeuble est probablement une VEFA | **vrai** (`est_vefa`) | VEFA signalée et écartée (5.2) ; testée dans le modèle (4.4) |
| Projeter −2,7 %/an sur 10 ans prolonge une correction conjoncturelle | juste sur le fond | scénarios : **tendance du secteur prolongée** (bornée à ±4 %/an, borne basse), **stabilité** (centrale), **reprise modérée à +2 %/an** (inflation visée par la BCE) |
| Il manque la comparaison acheter / louer | vrai | point mort calculé sur le vrai prêt : sur le bien de Maurepas (environ 210 000 €, loyer de 1 100 €), **9 ans à prix stables**, 16 ans avec −2 %/an, 5 ans avec +2 %/an ; hypothèses affichées |
| Droits de mutation à 5,807 % | **faux** : c'est le taux réduit des primo-accédants ; 6,32 % sinon dans les départements qui ont voté la hausse | rien à corriger, rappelé dans le bloc « aides » |
| Surtaxe au-delà de 50 000 € manquante | **faux** : déjà calculée (2 à 6 %) | — |
| Vérifier la loi de finances 2026 | vérifié : aucun changement pour les plus-values des particuliers (loi du 19 février 2026) | — |
| Aides aux primo-accédants absentes | vrai | PTZ, prêt Action Logement (30 000 € à 1 %), droits de mutation signalés, non chiffrés (conditions inconnues de la simulation) |
| Le « score 77/100 » peut passer pour une pré-acceptation | vrai | « Indice de solidité · indicatif », infobulle « ce n'est pas un accord de prêt » |
| L'assistant conversationnel frôle l'activité d'IOBSP | vrai | mention : « informations générales, pas un conseil en crédit » |
| Séparer maisons et appartements, neuf et ancien | vrai pour la carte et la référence | corrigé (5.2) ; l'estimation séparait déjà les types (6.4) |
| Critères qualitatifs (étage, extérieur, parking, état) | vrai, absents des données ouvertes | limite déclarée (section 9) |
| Données arrêtées fin 2025 | vrai | affiché sous la fourchette |

---

## 8. MARCHÉ, PRIX ET VALIDATION UTILISATEUR

| Retour du jury | Réponse | Document |
|---|---|---|
| « Votre SAM est compté en ventes ; il faut chiffrer les agents et mandataires » | **environ 40 000 professionnels de la transaction en Île-de-France** (33 000 à 52 000) : fichier des CCI au 1ᵉʳ janvier 2026 (41 471 cartes transaction, 84 470 agents commerciaux, 58 541 salariés habilités), part francilienne encadrée par la population (≈ 18 %) et le répertoire SIRENE (28,1 % des agences, comptage du 3 octobre 2026) | [`marche_professionnels_idf.md`](marche_professionnels_idf.md) |
| « 14,99 € par mois, c'est trop bas » | grille cible : 39 à 49 € HT par mois et par agent, 33 à 42 € HT par utilisateur en agence ; **modèle économique cible, sans paiement dans l'application** | mémoire |
| « 3 à 5 tests utilisateurs » | protocole prêt : 6 tâches, questionnaire SUS, grille de synthèse ; **à mener avant le 6 octobre** | [`tests_utilisateurs.md`](tests_utilisateurs.md) |
| « Élargir l'enquête (20 entretiens, 150 répondants) » | hors du périmètre du code | mémoire |

---

## 9. LIMITES ET SUITES

État au 3 octobre 2026, version finale.

| Limite | État | Ce qui a été fait, ou ce qui reste |
|---|---|---|
| Part à ±20 % : 78,0 % au global, pour 80 % visés | **à confirmer sur 2026** | Le chiffre officiel n'est pas retouché : la règle a été fixée avant la mesure et n'a pas été déplacée. L'objectif est atteint quand l'immeuble a un historique (81,6 %) ou que le DPE est connu (81,7 %). Les ventes du 1ᵉʳ semestre 2026 ne sont pas encore publiées par DVF (vérifié le 3 octobre 2026 : dernier millésime 2025) ; elles serviront de second test, sans réglage préalable. |
| Fourchette large (50 % du prix en médiane) | **assumée** | Elle est honnête : 84,7 % de couverture pour 85 % annoncés. Elle se resserre avec le DPE retrouvé à l'adresse et l'historique de l'immeuble. |
| Effet de la surface jugé inversé | **levée** | Analyse des ventes (section 6.2) : le modèle reproduit le marché, en baisse hors Paris et stable à Paris. |
| Effet du nombre de pièces | **reste, faible** | +4 % de 3 à 5 pièces à surface égale, contre −3 % à +3 % dans les ventes ; non corrigé (section 6.2). |
| Paris, maisons, petites surfaces, biens sans DPE | **corrigée** | L'application signale chaque segment difficile du bien avec son erreur mesurée sur le test (par exemple : DPE introuvable 18,7 %, moins de 30 m² 17,4 %, Paris 16,5 %, contre 14,91 % sur l'ensemble). |
| Dépendance aux API externes (BAN, API Carto, ADEME) | **corrigée** | Second essai au délai doublé et cache des réponses ; un délai dépassé isolé ne fait plus basculer sur le repli DVF. Une panne durable de la BAN reste un cas de repli. |
| DPE retrouvé à l'adresse parfois ambigu | **traitée** | Signalé à l'utilisateur, qui peut corriger la classe dans « Affiner l'estimation ». |
| Démarrage du backend : 2,6 Go de pic mémoire | **corrigée** | 892 Mo au chargement, 838 Mo pour le service complet (section 5.2). |
| Ventes sur plan (VEFA) mélangées aux reventes | **en partie traitée** | Dans les ventes de l'immeuble, la VEFA est signalée (« neuf, sur plan ») et exclue de la médiane affichée : sa prime au neuf disparaît à la revente. Les statistiques de secteur de l'estimation (médiane, position, évolution, scénarios, résilience) sont calculées sur l'ancien seul : à Bobigny, la courbe des appartements passait de −54 % (65 % de neuf en 2021) à +2 % dans l'ancien. L'indicateur dans le modèle a été testé sur la validation, sans gain (ligne suivante). |
| Effet maison / appartement presque constant dans le modèle (environ +10 %) | **reste** | Le marché varie de −19 % à +38 % selon la commune (section 6.4). Piste : interaction type × commune, à évaluer sur la validation. |
| Courbes de Paris en maisons très irrégulières | **assumée** | Quelques ventes par mois seulement : c'est la réalité des données. |
| Version mobile et mode sombre | **non vérifiés** | La démonstration se fait sur ordinateur. |
| Indicateur de vente sur plan (`est_vefa`) dans le modèle | **testé, non retenu** | Mesuré sur la validation (juil.–sept. 2025, 36 181 ventes, même code) : MAPE 14,07 % contre 14,09 % pour le v2, 51,2 % contre 50,9 % à ±10 %, 79,5 % contre 79,6 % à ±20 %, 38 communes fiables contre 41. Gain nul : le neuf ne pèse plus que 1,9 % des ventes de 2025. La production reste sur le v2 ([`ml/experiences/`](../ml/experiences/), [`resultats_protocole_validation_*`](resultats_protocole_validation_vefa_2025-07_2025-09.md)). |
| Critères qualitatifs absents (étage, ascenseur, extérieur, parking, état, exposition) | **reste** | Ils ne figurent pas dans les ventes notariées : la fourchette (±20 % environ) les reflète. L'application le dit dans la méthodologie et invite à confirmer par une visite. Piste : un ajustement optionnel saisi par l'agent, documenté comme tel. |
| Carte et référence du marché mélangeant maisons et appartements, carte calculée sur une ancienne extraction | **corrigée** | Calculées au démarrage sur le dataset servi, séparément pour les appartements et les maisons, et pour tout le marché, l'ancien ou le neuf (VEFA). |
| Données arrêtées à fin 2025 | **affichée** | « Marché observé jusqu'à fin 2025 (dernière publication des ventes notariées) » sous la fourchette. |
| Projection de plus-value | **revue** | Trois scénarios : tendance du secteur prolongée (bornée à ±4 %/an), stabilité (centrale), reprise modérée à 2 %/an. La correction de 2022-2024 sert de borne basse, pas de tendance de fond. |
| v1.5 pas encore déployée | **reste** | Tout est fusionné sur `main`. Il reste à pousser sur GitHub, reconstruire l'image Docker (elle embarque la BDNB agrégée, 27 Mo) et redéployer sur Render. |
| Prochaine mesure officielle | **prévue** | Un protocole v2, fixé et daté avant la mesure, sur les ventes 2026 dès leur publication par DVF. Aucune autre période ne peut servir de test : 2021 à mi-2025 ont servi à l'entraînement, juillet–septembre 2025 aux choix du modèle, octobre–décembre 2025 à la mesure officielle, et le modèle de production a été réentraîné sur l'ensemble. |

---

## 10. POUR LA RÉDACTION DU MÉMOIRE

### 10.1 Les messages à retenir

1. **Une évaluation incontestable.** L'objectif a été fixé et daté **avant** la mesure, sur des ventes que le modèle n'avait jamais vues, et il n'a pas été déplacé. L'ancienne méthode surestimait le modèle de 0,6 point.
2. **Un modèle nettement plus précis.** L'erreur moyenne passe de 16,98 % à 14,91 %. Une estimation sur deux tombe à moins de 10 % du prix réel, comme visé. **Près de huit sur dix** tombent à moins de 20 %, et **plus de huit sur dix** quand l'immeuble a des ventes ou que le DPE est connu.
3. **Une application qui montre sa preuve et ses limites.** Ventes de l'immeuble, fourchette dont la promesse est tenue (84,7 % pour 85 %), erreur mesurée par commune et par segment, alertes quand la saisie est douteuse.
4. **Des décisions appuyées sur des mesures.** Exemple : l'indicateur de vente sur plan a été testé sur la validation et écarté faute de gain, mais il a corrigé l'affichage (Bobigny).
5. **Un parcours complet** : estimation, avis de valeur, financement conforme aux normes HCSF, point mort acheter ou louer, plus-value et fiscalité 2026.

### 10.2 Les chiffres à citer

| Chiffre | Valeur | Source |
|---|---|---|
| Ventes analysées | 721 674 (2021–2025) | dataset gold |
| Ventes du test officiel | 31 696 (oct.–déc. 2025) | protocole |
| Erreur moyenne | 14,91 % (contre 16,98 % pour Render mesuré pareil) | `resultats_protocole_v2_…` |
| À ±10 % / ±20 % | 50,2 % / 78,0 % | idem |
| ±20 % quand l'immeuble a des ventes / DPE connu | 81,6 % / 81,7 % | `scenarios_performance.md` |
| Confirmation sur la validation | 14,09 %, 50,9 %, 79,6 % | section 4.4 |
| Couverture de la fourchette à 85 % | 84,7 % | `resultats_fourchette_v2_…` |
| Communes « fiables » | 15 (3,3 % des ventes) | protocole |
| Sources croisées | 4 : DVF, DPE (ADEME), IRIS (INSEE), BDNB (CSTB) | section 4.2 |
| Variables du modèle | 45 | `config.yaml` |
| Professionnels de la transaction en Île-de-France | ≈ 40 000 (33 000 à 52 000) | `marche_professionnels_idf.md` |
| Écart application / modèle hors ligne | 2,2 % en médiane (contre 5,9 %) | section 6.3 |

### 10.3 Formulations recommandées

- **Pour l'objectif** : « ±10 % : 50,2 %, objectif atteint. ±20 % : 78,0 % au global pour 80 % visés, et plus de 80 % quand l'application dispose d'une preuve (81,6 % avec les ventes de l'immeuble, 81,7 % avec le DPE). »
- **À l'oral, en réponse à « avez-vous atteint votre objectif ? »** : « Le premier oui. Le second à deux points près au global, et il est dépassé là où l'agent a besoin de défendre un prix. Nous n'avons pas déplacé la barre après coup : c'est ce qui rend ces chiffres crédibles. »
- **Pour un public non spécialiste** : « une estimation sur deux à moins de 10 % du vrai prix ; près de huit sur dix à moins de 20 % ».
- **Sur l'étage et l'état du bien** : « L'étage n'existe dans aucune donnée ouverte. Pour l'état, nous utilisons deux indicateurs techniques : les déperditions thermiques du DPE et les caractéristiques du bâtiment (BDNB). »
- **Sur la fourchette** : « Elle est large, mais honnête : le prix réel y tombe 85 fois sur 100. Un agent la resserre après visite. »

### 10.4 À éviter

- Écrire « objectif atteint » sans préciser le critère, ou arrondir 78 % à « 8 sur 10 » sans « près de ».
- Citer les écarts avec les prix Notaires-INSEE (section 6.2) : leur source exacte n'est pas vérifiée.
- Présenter la grille tarifaire comme un prix pratiqué : c'est un modèle économique cible.
- Présenter la validation (79,6 %) comme le résultat officiel : c'est une confirmation, le résultat officiel reste 78,0 %.
- Modifier les fichiers de résultats du protocole : ils font foi.

### 10.5 Questions probables du jury

| Question | Réponse courte |
|---|---|
| « Un agent peut-il défendre un prix avec 15 % d'erreur ? » | Il défend un avis de valeur, pas un chiffre seul : ventes de l'immeuble ramenées au marché, fourchette tenue à 85 %, erreur mesurée dans son secteur. Avec ces preuves, plus de 80 % des estimations sont à moins de 20 %. |
| « Pourquoi ne pas avoir retouché le modèle pour atteindre 80 % ? » | Parce que le test était consommé : régler le modèle en le regardant aurait rendu le chiffre optimiste, ce qui était le défaut de l'ancienne évaluation. La prochaine mesure se fera sur les ventes 2026. |
| « Pourquoi 39 € et pas 14,99 € ? » | Parce que la valeur pour un agent est le dossier (preuves, financement de l'acheteur), et que ses outils actuels coûtent davantage. C'est une grille cible, à valider par une bêta gratuite. |
| « Combien d'agents en Île-de-France ? » | Environ 40 000 professionnels de la transaction, dont environ 20 000 mandataires (fichier des CCI au 1ᵉʳ janvier 2026). |
| « Et le neuf ? » | Testé : l'indicateur n'apporte rien au modèle (le neuf pèse 1,9 % des ventes de 2025), mais il corrige l'affichage des secteurs. |

---

## 11. FICHIERS PRINCIPAUX

| Fichier | Rôle |
|---|---|
| `docs/protocole_evaluation.md` | protocole et addendums, fixés avant mesure |
| `docs/resultats_protocole_{render_,,v2_}2025-10_2025-12.*` | résultats officiels |
| `docs/scenarios_performance.md`, `docs/scenarios_coherence_app.md` | scénarios de test |
| `data-pipeline/src/realstate_data/enrichment/bdnb.py` | enrichissement BDNB |
| `data-pipeline/src/realstate_data/features/gold.py` | features immeuble et revente (étape 5b) |
| `ml/config.yaml`, `ml/train.py` | modèle v2 et entraînement de production |
| `ml/evaluer_protocole.py` | évaluation selon le protocole |
| `ml/contexte.py`, `ml/predict.py`, `ml/estimator.py`, `ml/geocoding.py` | inférence |
| `Backend/main.py` | API : secteurs, validation, nouveaux champs |
| `Frontend/src/vanilla/estimation.js` | page d'estimation, chiffres servis par l'API, segments difficiles |
| `Frontend/src/vanilla/scenarios.js`, `historique.js` | scénarios de plus-value communs, enregistrement des simulations |
| `Frontend/src/components/History.jsx` | historique regroupé par bien |
| `Backend/database.py` | historique : résultat complet et simulations (colonnes `resultat`, `simulations`) |
| `ml/exporter_segments.py`, `Backend/models/segments_performance.json` | erreur mesurée par segment, servie à l'application |
| `Backend/utils/dvf_search.py` | chargement du dataset limité aux colonnes utiles |
| `ml/experiences/config_v2_vefa.yaml`, `validation_vefa.log`, `docs/resultats_protocole_validation_*` | expérience `est_vefa` sur la validation |
| `Frontend/src/vanilla/acheterlouer.js`, `montants.js` | point mort acheter ou louer ; montants saisissables |
| `Frontend/src/components/FiltresMarche.jsx` | filtres type de bien et marché (carte, référence) |
| `docs/marche_professionnels_idf.md`, `docs/tests_utilisateurs.md` | marché adressable ; protocole de tests utilisateurs |
| `docs/FONCTIONNALITES.md` | liste des fonctionnalités |
