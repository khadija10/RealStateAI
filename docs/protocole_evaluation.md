# Protocole d'évaluation du modèle de prix — fixé avant mesure

> **Fixé le 2 octobre 2026, avant toute mesure sur le jeu de test défini ci-dessous.**
> Le commit qui introduit ce fichier fait foi : son horodatage précède celui
> du commit des résultats (`docs/resultats_protocole_*.md`). Les seuils et la
> règle de décision ne sont **pas modifiables** après mesure. Toute révision
> passe par un nouveau protocole daté, appliqué à une nouvelle période de test.

## 1. Pourquoi ce protocole

Remarque du jury (soutenance blanche) : *« affichez une erreur par zone, avec
une marge fixée avant le test »*. Une marge choisie après avoir vu les
résultats n'apporte aucune garantie : on peut toujours en trouver une que le
modèle respecte.

L'évaluation précédente avait en outre deux faiblesses, corrigées ici :

| Faiblesse | Avant | Ce protocole |
|---|---|---|
| Test non chronologique | 15 % tirés **au hasard** dans 2025, les 85 % restants à l'entraînement : mêmes mois, mêmes rues | Test **strictement postérieur** à toutes les données d'entraînement |
| Test utilisé pour régler le modèle | L'arrêt anticipé (*early stopping*) choisissait le nombre d'arbres **sur le test** | Jeu de **validation séparé** pour l'arrêt anticipé ; test mesuré **une seule fois** |
| MAPE locale ≠ MAPE globale | Médiane des erreurs, divisée par le prix **prédit**, dès 5 ventes | Même définition que la MAPE globale, au moins 30 ventes |

## 2. Découpage temporel

Règle générale : pour une période de test **P**, la validation couvre les
**3 mois qui précèdent immédiatement P**, l'entraînement **tout ce qui précède
la validation**. Aucune vente de validation ou de test n'est vue à
l'entraînement.

Application à l'évaluation principale (données DVF publiées le 18/05/2026) :

| Jeu | Période | Usage |
|---|---|---|
| Entraînement | janvier 2021 → juin 2025 | apprentissage |
| Validation | juillet → septembre 2025 | arrêt anticipé uniquement |
| **Test** | **octobre → décembre 2025** | **mesure unique** |

Réévaluation prévue : dès la publication DVF couvrant le 1er semestre 2026
(attendue en octobre 2026 ; absente au 2 octobre 2026, vérifié), même script,
mêmes seuils, P = janvier → juin 2026, validation = octobre → décembre 2025.
Ce sera le premier test sur des ventes **postérieures à la rédaction du protocole**.

Tout le reste est inchangé par rapport à `ml/config.yaml` : features,
hyperparamètres LightGBM, pondération par année, dataset gold.

## 3. Métriques

Erreur relative d'une vente : `|prix réel − prix estimé| / prix réel`.

- **MAPE** : moyenne des erreurs relatives.
- **Part à ±10 %** et **part à ±20 %** : proportion de ventes dont l'erreur
  relative est ≤ 10 % (resp. ≤ 20 %).
- **MAPE locale** d'une commune : MAPE calculée sur les ventes de test de la
  commune. Les arrondissements de Paris comptent comme des communes.

## 4. Objectif global (seuils fixés a priori)

| Critère | Seuil | Justification |
|---|---|---|
| Part à ±10 % | **≥ 50 %** | La majorité des estimations dans une marge comparable à une marge de négociation courante |
| Part à ±20 % | **≥ 80 %** | Au plus une estimation sur cinq franchement éloignée du prix réel |

Règle de décision : l'objectif est **atteint si les deux critères le sont**,
sinon **non atteint**. Le résultat est publié tel quel, y compris en cas
d'échec. Les seuils ont été choisis pour leur sens métier et sont **plus
exigeants** que les résultats connus de l'ancienne évaluation (47 % et 75 %) :
ils n'ont pas été ajustés pour être atteints.

## 5. Classement des communes (ce que l'agent voit)

| Classe | Condition | Message pour l'agent |
|---|---|---|
| **Fiable** | MAPE locale ≤ 10 % | L'estimation peut appuyer un prix |
| **Indicative** | 10 % < MAPE locale ≤ 20 % | Point de départ, à confirmer |
| **À compléter** | MAPE locale > 20 % | Expertise terrain indispensable |
| **Données insuffisantes** | moins de 30 ventes de test | Pas de fiabilité affichée |

Résultats publiés : nombre de communes par classe, **part des ventes de test**
par classe, et MAPE observée à l'intérieur de chaque classe.

Limite assumée : la classe d'une commune est établie sur le test lui-même.
Elle décrit la fiabilité **observée** ; la réévaluation 2026 dira si elle
**prédit** la fiabilité future (une commune « fiable » en 2025 le reste-t-elle
en 2026 ?).

## 6. Limites connues, non corrigées par ce protocole

- **Filtre d'outliers** : les ventes extrêmes (ratio au prix médian communal
  hors [0,25 ; 4]) sont retirées de toutes les périodes, test compris, et ce
  médian est calculé sur toute la période 2021-2025. En usage réel, ces biens
  existent : la performance sur l'ensemble des ventes est donc un peu moins
  bonne que celle mesurée.
- **DPE** : l'appariement peut retenir un diagnostic établi après la vente. En
  usage réel, l'agent saisit la classe DPE connue du bien, ce qui est
  cohérent, mais le proxy de déperditions n'est pas saisi par l'utilisateur.
- **IRIS** : statistiques INSEE de 2021, fixes sur toute la période.
- Les features de marché, elles, sont sans fuite : fenêtres glissantes sur
  les mois m-12 à m-1, mois de la vente exclu
  (`data-pipeline/src/realstate_data/features/gold.py`, étape 4).

## 6 bis. Addendum — 2 octobre 2026, toujours avant mesure

Un second filtre, côté ML (`ml/features.py`, `_filtrer_outliers`), retire
les ventes dont le prix au m² sort de [0,40 ; 2,50] × le prix de référence
des 12 mois précédents. Il ne crée pas de fuite (la référence est passée),
mais il retire du test des ventes difficiles. On publie donc **deux mesures** :

- **mesure principale** : test filtré comme le reste du pipeline — c'est
  elle qui décide de l'objectif (section 4) et du classement (section 5) ;
- **mesure complémentaire** : mêmes modèle et période de test, **sans** ce
  filtre ML, pour montrer l'écart. Elle ne change pas la décision.

## 6 ter. Addendum — 2 octobre 2026 : fourchette annoncée (avant mesure)

Seconde lecture de la remarque du jury : la marge **annoncée à l'agent** doit
être tenue. L'outil affiche une fourchette à 85 % (modèles quantiles q7,5 et
q92,5). Elle n'a jamais été vérifiée. Critères fixés avant toute mesure de
couverture ; les modèles quantiles sont entraînés sur le seul jeu
d'entraînement, avec le nombre d'arbres retenu sur la validation.

| Critère | Seuil | Justification |
|---|---|---|
| Couverture globale (prix réel dans la fourchette) | **≥ 80 %** | Fourchette annoncée à 85 % ; 5 points de tolérance |
| Couverture dans chaque classe de communes (fiable, indicative, à compléter) | **≥ 80 %** | La promesse doit tenir partout où une fiabilité est affichée, pas seulement en moyenne |
| Largeur médiane de la fourchette (q92,5 − q7,5) / prix estimé | **≤ 30 %** | Au-delà de ±15 % autour de l'estimation, la fourchette n'aide plus à fixer un prix de mandat |

Règle de décision : la fourchette est **tenue si les trois critères le sont**.
La couverture et la largeur sont publiées ensemble : une couverture élevée
obtenue avec une fourchette trop large ne compte pas.

## 8. Addendum — 2 octobre 2026 : validation du modèle v2 (avant mesure)

**Objet.** Valider le modèle v2 (ventes du même immeuble, BDNB, cible log et
perte de Huber, fourchette calibrée) avant la soutenance du 6 octobre 2026.

**Modèle figé.** Code au commit `c77b014` (configuration `ml/config.yaml`),
script d'évaluation au commit `bad9d10`, dataset gold d'empreinte
`9a6c3409791e6905` (721 674 ventes, généré le 2 octobre 2026). Aucun réglage
ne sera modifié après la mesure.

**Découpage.** Identique à la section 2 : entraînement jusqu'à juin 2025,
validation juillet–septembre 2025 (arrêt anticipé et calibration de la
fourchette), **test octobre–décembre 2025, mesure unique**.

**Critères.** Inchangés : objectif global de la section 4 (≥ 50 % à ±10 %,
≥ 80 % à ±20 %), classement de la section 5, fourchette de la section 6 ter
appliquée à la fourchette **calibrée**, celle qu'affiche l'application.

**Pourquoi ce test reste valable — et ses deux réserves.** Tous les choix du
v2 (features, transformation, perte, hyperparamètres) ont été faits sur la
période juillet–septembre 2025, jamais en regardant octobre–décembre. Réserves
déclarées :

1. octobre–décembre 2025 a déjà servi à **mesurer** le modèle v1 (sections
   4 à 6 ter). Mesurer un autre modèle ne règle rien du v2 ;
2. l'entraînement de production du v2 (`ml/train.py`) utilise ces 3 mois pour
   son arrêt anticipé et a affiché ses métriques ; ce passage a eu lieu
   **après** le gel des choix, et aucun réglage n'a été modifié ensuite.

**Règle.** Le résultat est publié tel quel, objectif atteint ou non
(`docs/resultats_protocole_v2_2025-10_2025-12.md` et
`docs/resultats_fourchette_v2_2025-10_2025-12.json`).

## 7. Exécution

```bash
data_env/bin/python ml/evaluer_protocole.py --test-debut 2025-10 --test-fin 2025-12
```

Le script n'écrit que des résultats (`docs/resultats_protocole_<période>.md`
et `.json`) ; il ne touche pas au modèle de production.
