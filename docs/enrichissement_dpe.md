# Enrichissement par le DPE

Ajout de la performance énergétique des logements au dataset de ventes.

---

## Pourquoi

DVF ne dit rien de la qualité d'un logement : ni son état, ni son isolation,
ni son étiquette énergie. Or depuis la réforme du DPE de juillet 2021 et la loi
Climat et Résilience, les logements classés **F et G** — les « passoires
thermiques » — sont progressivement interdits à la location. Cette contrainte
se répercute sur leur prix de vente.

Le DPE comble en partie ce manque. C'est la feature que le backlog classe à
**haute valeur**.

## Source

| | |
|---|---|
| Producteur | ADEME |
| Jeu de données | DPE Logements existants depuis juillet 2021 (`dpe03existant`) |
| Accès | API Data Fair, libre, sans clé |
| Limite | 10 appels par seconde |
| Licence | Licence ouverte |
| Mise à jour | mensuelle |

Seuls les DPE au nouveau format, établis depuis juillet 2021, sont utilisés :
les diagnostics antérieurs suivaient une autre méthode de calcul et ne sont pas
comparables.

---

## Utilisation

```bash
python -m realstate_data.pipeline dpe-test    # vérifie l'API et les champs
python -m realstate_data.pipeline dpe         # télécharge les DPE du périmètre
python -m realstate_data.pipeline gold        # appariement, colonnes DPE remplies
```

`dpe-test` est à lancer en premier : il interroge l'API sur deux lignes et
vérifie que tous les champs attendus sont présents. Si l'ADEME a renommé un
champ, il le signale avant tout téléchargement.

`dpe` est idempotent : un département déjà téléchargé est ignoré. Les fichiers
sont écrits dans `data/external/dpe/`, jamais versionnés.

Pour analyser le résultat :

```bash
python verif_dpe.py
```

---

## Méthode d'appariement

DVF et l'ADEME ne partagent **aucun identifiant commun**. On rapproche les deux
sources par l'adresse, puis par la surface.

### 1. Normalisation des adresses

Les deux sources n'écrivent pas les adresses de la même façon :

| DVF (format FANTOIR) | ADEME (format BAN) |
|---|---|
| `AV DE LA CELLE ST CLOUD` | `Avenue de la Celle-Saint-Cloud` |
| `BD ST GERMAIN` | `Boulevard Saint-Germain` |
| `AV DU GAL LECLERC` | `Avenue du Général Leclerc` |

Les deux passent par la même transformation : majuscules, suppression des
accents et de la ponctuation, développement des abréviations (`AV` → `AVENUE`,
`ST` → `SAINT`, `GAL` → `GENERAL`...), retrait des mots sans valeur
discriminante (`DE`, `LA`, `DU`...). Les deux exemples ci-dessus donnent alors
`AVENUE CELLE SAINT CLOUD` et `BOULEVARD SAINT GERMAIN` des deux côtés.

La transformation est une macro SQL unique, générée à partir d'une seule table
d'abréviations : c'est la garantie que DVF et l'ADEME sont traités
exactement de la même manière.

### 2. Jointure sur l'adresse

Clé : code postal, numéro dans la voie, voie normalisée.

### 3. Désambiguïsation par la surface

**C'est l'étape décisive.** Une adresse d'immeuble abrite de nombreux
appartements, chacun avec son propre DPE. Joindre sur l'adresse seule
attribuerait au hasard le DPE du voisin de palier.

On retient donc le DPE dont la **surface habitable** s'écarte le moins de la
**surface vendue**, dans une tolérance de 10 %. Les deux mesures ne sont
jamais strictement égales — surface réelle bâtie d'un côté, surface habitable
de l'autre — mais un voisin de taille différente est écarté.

Deux critères complémentaires :
- **le type doit concorder** : une maison n'hérite jamais du DPE d'un
  appartement situé à la même adresse ;
- **à surface égale, on préfère un DPE antérieur à la vente**, qui décrit
  l'état du bien au moment de la transaction. Un DPE postérieur peut refléter
  des travaux de rénovation réalisés par l'acheteur.

### 4. Niveau de confiance

| `dpe_qualite_appariement` | Signification |
|---|---|
| `exacte` | Un seul DPE compatible à l'adresse |
| `probable` | Plusieurs DPE compatibles, le plus proche en surface est retenu |
| `NULL` | Aucun DPE compatible |

### 5. Indicateur de zone

Pour chaque code postal : part des logements classés F ou G parmi tous les
DPE, calculée si le code postal compte au moins 30 diagnostics. Il couvre les
ventes qui n'ont pas de DPE individuel.

---

## Résultats mesurés

La méthode a été évaluée contre une **vérité terrain** : un jeu synthétique où
le vrai DPE de chaque vente est connu, accompagné de leurres — les
appartements voisins du même immeuble, de surfaces différentes.

| Niveau | Appariements | Précision |
|---|---:|---:|
| `exacte` | 2 809 | **96,2 %** |
| `probable` | 227 | 81,5 % |
| **Global** | 3 036 | **95,1 %** |

**Rappel : 99,0 %** — presque toutes les ventes qui possèdent un DPE le
retrouvent.

Le jeu de test est volontairement plus dense que la réalité en ventes par
adresse, ce qui multiplie les risques de confusion : ces chiffres sont une
estimation prudente.

**La précision n'est mesurable que sur ce jeu synthétique.** Sur les données
réelles, la vérité n'est pas connue. `verif_dpe.py` fournit à la place un
indicateur indirect : la distribution des écarts de surface. Des vrais
appariements se concentrent sur les faibles écarts ; une accumulation vers
10 % signalerait des confusions avec des voisins.

### Résultats sur données réelles — Paris

Mesures effectuées sur 721 675 ventes d'Île-de-France, avec les 844 595 DPE
parisiens téléchargés.

**Couverture.** Près de 80 % des ventes d'appartements parisiens ont trouvé un
DPE. Les maisons parisiennes, marginales, sont peu couvertes.

**Répartition de la confiance.** À Paris, seuls 22 % des appariements sont
`exacte` : un immeuble haussmannien abrite des dizaines de logements
diagnostiqués, et plusieurs sont compatibles à 10 % de surface près.

| Nombre de DPE compatibles à l'adresse | Part des appariements |
|---|---:|
| 1 seul | 22,3 % |
| 2 à 3 | 31,9 % |
| 4 à 6 | 23,9 % |
| 7 et plus | 21,9 % |

**Décote des passoires.** Chaque vente est rapportée au prix de référence de
son propre marché local, ce qui neutralise l'effet de l'emplacement. Indice
100 = au prix du marché.

| Classe | Ventes | Indice de prix |
|---|---:|---:|
| B | 146 | 103,9 |
| C | 3 297 | 102,5 |
| D | 8 428 | 101,4 |
| E | 8 205 | 100,9 |
| F | 3 054 | 98,4 |
| G | 2 105 | 98,1 |

Le gradient est monotone de B à G. **Les passoires se vendent environ 3 %
sous le prix de leur marché local.**

**Validation croisée — le test qui compte.** Si l'effet était un artefact, il
serait identique quelle que soit la fiabilité de l'appariement. Ce n'est pas
le cas :

| Niveau d'appariement | Classes courantes (C, D, E) | Passoires (F, G) | Écart |
|---|---:|---:|---:|
| `exacte` | 101,4 | 98,3 | **−3,1** |
| `probable` | 98,7 | 97,6 | −1,1 |

**L'effet est trois fois plus fort sur les appariements fiables.** C'est le
comportement attendu d'un signal réel dilué par du bruit d'appariement, et non
celui d'une corrélation fortuite.

**Ampleur à relativiser.** Trois pour cent, c'est moins que les 5 à 15 %
souvent avancés au niveau national. Paris est un marché tendu où les passoires
sont fréquemment des immeubles anciens prisés. L'effet devrait être plus marqué
en grande couronne, en particulier sur les maisons.

### Île-de-France complète — et une conclusion qui contredit l'hypothèse

Avec les 3,5 millions de DPE d'Île-de-France, la couverture atteint **58,7 %**
des ventes : 70,8 % des appartements, 28,8 % des maisons, et jusqu'à 69,1 %
pour le millésime 2025.

À ce stade, une analyse naïve semblait confirmer la décote. Trois contrôles
successifs l'ont démentie.

**Contrôle 1 — le neuf.** 91,1 % des ventes en VEFA sont classées A, B ou C,
contre 26,8 % dans l'ancien, et leur indice de prix atteint 110 à 129 : c'est
la prime de neuf, pas l'isolation. VEFA exclues, un décrochage subsiste
pourtant entre C (101,7) et D (97,1).

**Contrôle 2 — l'âge du bâti.** L'année de construction, fournie par l'ADEME,
renseigne 48 % des ventes appariées. En comparant les étiquettes **à
l'intérieur de chaque période de construction** :

| Période | Courants (C, D, E) | Passoires (F, G) | Écart |
|---|---:|---:|---:|
| avant 1949 | 98,2 (n=12 673) | 97,3 (n=5 134) | −0,9 |
| 1949-1974 | 93,0 (n=10 763) | 95,5 (n=3 186) | **+2,5** |

Les autres périodes comptent trop peu de passoires pour être interprétées.

**À âge de bâti comparable, la décote disparaît, et s'inverse même sur le bâti
d'après-guerre.** Les −3 points mesurés initialement traduisaient surtout le
fait que les logements bien classés sont récents, et que le récent se vend
avec une prime.

**Contrôle 3 — la surface, non neutralisé.** Les passoires sont
surreprésentées parmi les petites surfaces, dont le prix au m² est
mécaniquement plus élevé. L'indice de référence est calculé par commune et
type de bien, pas par tranche de surface : ce biais subsiste et peut masquer
une décote réelle.

### Conclusion méthodologique

**L'effet du DPE sur le prix ne peut pas être isolé par une analyse
univariée.** Il est enchevêtré avec la nature de la vente, l'âge du bâti et la
surface ; neutraliser l'un déplace l'effet vers les autres.

Cela ne disqualifie pas la feature : cela signifie que sa valeur doit être
établie **par le modèle lui-même**, en comparant une version entraînée avec et
sans les colonnes DPE, toutes choses égales par ailleurs. C'est le rôle de
l'équipe ML.

Ce que le pipeline garantit en revanche : une donnée propre, une précision
d'appariement mesurée, et les variables de contrôle nécessaires pour ne pas
confondre les effets — `est_vefa`, `annee_construction`,
`periode_construction`.

### L'indicateur de zone est un piège s'il est mal utilisé

`zone_part_dpe_fg` présente une corrélation de **+0,377 avec le prix au m²**.
Les arrondissements les plus riches en passoires sont les plus chers :

| Code postal | Part de F et G |
|---|---:|
| 75006 | 26,3 % |
| 75007 | 24,6 % |
| 75005 | 24,3 % |
| 75008 | 24,3 % |
| 75016 | 24,0 % |

Ce sont les quartiers haussmanniens : vieux bâti, mal isolé, très recherché.

**Cette colonne ne mesure donc pas la qualité d'un quartier mais l'ancienneté
de son bâti.** Utilisée seule, elle apprendrait au modèle que plus un quartier
compte de passoires, plus il est cher. Elle n'est interprétable qu'en présence
des variables de localisation.

### Une règle testée et écartée

Une règle complémentaire acceptait une maison dont l'adresse ne porte qu'un
seul DPE, **quelle que soit la surface**, pour absorber l'écart entre surface
bâtie et surface habitable. Mesurée contre la vérité terrain, **sa précision
était nulle** : sans contrainte de surface, elle attribuait le DPE d'un autre
bien de la même adresse. Elle a été retirée.

C'est précisément ce que permet l'évaluation sur vérité terrain : une règle
qui paraît raisonnable peut s'avérer entièrement fausse.

---

## Limites assumées

**Couverture partielle.** Les DPE au nouveau format n'existent que depuis
juillet 2021, et tous les logements vendus n'en ont pas. Les ventes de 2021
sont les moins couvertes.

**Pas d'étage.** DVF ne renseigne pas l'étage. Deux appartements de même
surface dans le même immeuble restent indiscernables : c'est la cause des
appariements `probable`.

**Qualité de la donnée ADEME.** Les DPE sont saisis par les diagnostiqueurs ;
l'ADEME ne les corrige pas. Une adresse mal saisie ne sera pas appariée.

**Indicateur de zone au code postal.** Un code postal regroupe parfois
plusieurs communes. À Paris, il correspond presque exactement à
l'arrondissement.

---

## Pistes d'amélioration

- **Appariement géographique en repli** : pour les adresses non normalisables,
  rapprocher par distance entre les coordonnées DVF et celles du DPE.
- **Identifiant RNB** : l'ADEME associe progressivement ses DPE au Référentiel
  National des Bâtiments. Un identifiant de bâtiment commun rendrait
  l'appariement plus sûr que l'adresse.
- **Décote mesurée par arrondissement** : vérifier si l'effet F/G est plus
  marqué dans les quartiers où le marché locatif pèse davantage.
