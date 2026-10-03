# RAPPORT DE VERSION — RealEstateAI v1.5

**Version v1.5 — 3 octobre 2026 (version finale présentée le 6 octobre 2026)**
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

---

## 2. TABLEAU DE BORD — RENDER v1.4.2 vs v1.5

Toutes les lignes de précision sont mesurées **avec le même protocole**, sur les mêmes 31 696 ventes d'octobre à décembre 2025, jamais vues à l'entraînement (section 3).

| Axe | Render v1.4.2 | v1.5 |
|---|---|---|
| **Erreur moyenne (MAPE)** | 16,98 % | **14,91 %** (−2,1 pt) |
| **Estimations à ±10 % du prix réel** | 44,1 % | **50,2 %** |
| **Estimations à ±20 % du prix réel** | 72,9 % | **78,0 %** |
| **Objectif fixé avant le test (≥ 50 % à ±10 %, ≥ 80 % à ±20 %)** | non atteint | **±10 % atteint, ±20 % manqué de 2 pt** |
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
| **Mémoire du backend au chargement du dataset** | — | **pic de 892 Mo** (2 627 Mo avant la correction de la section 5.2) |

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

**Fourchette du v2** ([`resultats_fourchette_v2_…`](resultats_fourchette_v2_2025-10_2025-12.json)) : la couverture passe de 71,5 % (brute) à **84,7 %** (calibrée), pour une promesse de 85 %. Le critère n'est **pas tenu** pour deux raisons : la classe « à compléter » est à 78,2 % (seuil 80 %), et la largeur médiane est de 50 % du prix (seuil 30 %). Pour resserrer la fourchette, il faut un modèle plus précis : la calibration la rend honnête, pas plus étroite.

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
| Le backend lisait les 66 colonnes du gold : pic de **2 627 Mo** au chargement, au-delà d'une petite instance | oui | seules les 19 colonnes utiles sont lues : pic de **892 Mo**, chargement de 12,8 s à 7,0 s ; service complet (modèle et cache d'inférence) à **838 Mo** |

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

### 5.4 Frontend

- **Refonte de Skander fusionnée sur `main`** : nouveau design, pages Estimation, Financement et Plus-value, mise en page à la manière des portails immobiliers (bandeau pleine largeur, contenu en colonne).
- **Fin des chiffres écrits en dur** : transactions, variables, erreur, secteurs et taux sont lus dans l'API. Les anciennes valeurs étaient périmées : la page annonçait par exemple Paris 6ᵉ à 14 783 €/m², contre 14 146 €/m² dans le dataset.
- **Plus aucun calcul par défaut** : les pages n'affichent plus d'estimation ni de simulation de démonstration ; chaque résultat part d'un clic.
- **DPE retrouvé automatiquement** à l'adresse ; le numéro de DPE et le numéro de lot, inconnus des utilisateurs, ne sont plus demandés.
- **Résultats conservés entre les onglets**, comme en v1.4 : la pastille verte de l'onglet Estimation retrouve le formulaire et le résultat, et les simulations de plus-value et de financement restent affichées.
- **Même scénario central de plus-value** sur la page Estimation et dans le simulateur (module commun `vanilla/scenarios.js`).
- **Segments difficiles signalés** sous la fourchette, avec leur erreur mesurée (section 7).
- **Historique regroupé par bien** : dernier prix, fourchette, fiabilité, DPE, évolution du prix entre les estimations, « Voir le résultat » sans recalcul, « Ré-estimer », dernières simulations, tri et comparaison de deux biens.
- La fourchette n'est plus présentée comme « calibrée » quand l'estimation vient du repli DVF.

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

---

## 7. LIMITES ET SUITES

État au 3 octobre 2026, version finale.

| Limite | État | Ce qui a été fait, ou ce qui reste |
|---|---|---|
| Objectif ±20 % manqué de 2 points (78,0 % pour 80 % visés) | **reste** | Le chiffre officiel n'est pas retouché : le test est consommé. L'objectif est atteint quand l'immeuble a un historique (81,6 %) ou que le DPE est connu (81,7 %). Les ventes du 1ᵉʳ semestre 2026 ne sont pas encore publiées par DVF (vérifié le 3 octobre 2026 : dernier millésime 2025) ; elles serviront de second test, sans réglage préalable. |
| Fourchette large (50 % du prix en médiane) | **assumée** | Elle est honnête : 84,7 % de couverture pour 85 % annoncés. Elle se resserre avec le DPE retrouvé à l'adresse et l'historique de l'immeuble. |
| Effet de la surface jugé inversé | **levée** | Analyse des ventes (section 6.2) : le modèle reproduit le marché, en baisse hors Paris et stable à Paris. |
| Effet du nombre de pièces | **reste, faible** | +4 % de 3 à 5 pièces à surface égale, contre −3 % à +3 % dans les ventes ; non corrigé (section 6.2). |
| Paris, maisons, petites surfaces, biens sans DPE | **corrigée** | L'application signale chaque segment difficile du bien avec son erreur mesurée sur le test (par exemple : DPE introuvable 18,7 %, moins de 30 m² 17,4 %, Paris 16,5 %, contre 14,91 % sur l'ensemble). |
| Dépendance aux API externes (BAN, API Carto, ADEME) | **corrigée** | Second essai au délai doublé et cache des réponses ; un délai dépassé isolé ne fait plus basculer sur le repli DVF. Une panne durable de la BAN reste un cas de repli. |
| DPE retrouvé à l'adresse parfois ambigu | **traitée** | Signalé à l'utilisateur, qui peut corriger la classe dans « Affiner l'estimation ». |
| Démarrage du backend : 2,6 Go de pic mémoire | **corrigée** | 892 Mo au chargement, 838 Mo pour le service complet (section 5.2). |
| Ventes sur plan (VEFA) mélangées aux reventes | **en partie traitée** | Dans les ventes de l'immeuble, la VEFA est signalée (« neuf, sur plan ») et exclue de la médiane affichée : sa prime au neuf disparaît à la revente. Le modèle, lui, n'utilise pas encore l'indicateur `est_vefa` du gold. L'ajouter est un changement de modèle, à mesurer sur une nouvelle période de test (ventes 2026), pas sur le test déjà consommé. |
| Critères qualitatifs absents (étage, ascenseur, extérieur, parking, état, exposition) | **reste** | Ils ne figurent pas dans les ventes notariées : la fourchette (±20 % environ) les reflète. L'application le dit dans la méthodologie et invite à confirmer par une visite. Piste : un ajustement optionnel saisi par l'agent, documenté comme tel. |
| Carte et référence du marché mélangeant maisons et appartements, carte calculée sur une ancienne extraction | **corrigée** | Calculées au démarrage sur le dataset servi, séparément pour les appartements et les maisons, et pour tout le marché, l'ancien ou le neuf (VEFA). |
| Données arrêtées à fin 2025 | **affichée** | « Marché observé jusqu'à fin 2025 (dernière publication des ventes notariées) » sous la fourchette. |
| Projection de plus-value | **revue** | Trois scénarios : tendance du secteur prolongée (bornée à ±4 %/an), stabilité (centrale), reprise modérée à 2 %/an. La correction de 2022-2024 sert de borne basse, pas de tendance de fond. |
| v1.5 pas encore déployée | **reste** | Tout est fusionné sur `main`. Il reste à pousser sur GitHub, reconstruire l'image Docker (elle embarque la BDNB agrégée, 27 Mo) et redéployer sur Render. |

---

## 8. FICHIERS PRINCIPAUX

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
