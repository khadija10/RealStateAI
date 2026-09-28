# Dictionnaire de données — dataset `gold_transactions`

**Contrat d'interface entre le périmètre Data Engineering et l'équipe Modélisation.**

- **Source** : DVF géolocalisées (Etalab / DGFiP), open data, mise à jour semestrielle (avril et octobre)
- **Périmètre** : Île-de-France — départements 75, 77, 78, 91, 92, 93, 94, 95
- **Millésimes** : 2021 à 2025, cinq années complètes (2026 non encore publié par la DGFiP)
- **Volumétrie** : 711 443 transactions, issues de 2 433 220 lignes brutes
- **Format** : Parquet, compression ZSTD, partitionné par `annee`
- **Chemin** : `data/processed/gold_transactions/annee=YYYY/*.parquet`
- **Granularité** : **une ligne = une mutation immobilière portant sur un seul logement**
- **Clé primaire** : `id_mutation` (unicité garantie par test automatisé)

## Lecture

```python
import duckdb
df = duckdb.sql("""
    SELECT * FROM read_parquet('data/processed/gold_transactions/**/*.parquet',
                               hive_partitioning=true)
""").df()
```

---

## Schéma

### Identification et calendrier

| Colonne | Type | Nullable | Description |
|---|---|---|---|
| `id_mutation` | string | non | Identifiant de la mutation. **Clé primaire.** |
| `date_mutation` | date | non | Date de signature de l'acte |
| `annee` | int | non | Année (clé de partitionnement) |
| `mois` | int | non | Mois, 1–12 |
| `trimestre` | int | non | Trimestre, 1–4 |
| `mois_index` | int | non | Mois écoulés depuis janvier 2000. Index temporel continu, à utiliser pour les découpages train/test chronologiques. |

### Localisation

| Colonne | Type | Nullable | Description |
|---|---|---|---|
| `code_departement` | string | non | Code sur 2 caractères. **Toujours string** (le `0` initial est signifiant hors IDF). |
| `code_commune` | string | non | Code INSEE sur 5 caractères. **Pour Paris, Lyon et Marseille, DVF descend à l'arrondissement** (`75112` = Paris 12e), pas au code global de la ville. Les features de marché sont donc calculées par arrondissement. Clé de jointure avec les référentiels INSEE. **Différent du code postal.** |
| `nom_commune` | string | non | Libellé, pour l'affichage uniquement — ne jamais l'utiliser comme clé |
| `ville` | string | non | `Paris`, `Lyon`, `Marseille` pour les villes à arrondissements, sinon le nom de la commune. Permet de regrouper les arrondissements d'une même ville. |
| `arrondissement` | int | oui | Numéro d'arrondissement (1 à 20 pour Paris, 1 à 9 pour Lyon, 1 à 16 pour Marseille). `NULL` ailleurs. **Les features de marché sont calculées à cette maille**, pas au niveau de la ville. |
| `code_postal` | string | oui | Code postal. Sert aussi de clé à l'indicateur de zone DPE. |
| `adresse_numero` | string | oui | Numéro dans la voie, sans suffixe |
| `adresse_suffixe` | string | oui | `B`, `T`... quand il existe |
| `adresse_nom_voie` | string | oui | Voie au format DVF, abrégé : `AV DE LA REPUBLIQUE`, `BD ST GERMAIN`. Clé de jointure avec le DPE après normalisation. |
| `latitude`, `longitude` | float | non | WGS84, géocodage à la parcelle. Contrôlées : chaque point est à moins de 1,5° du centroïde de son département. La source publie quelques coordonnées fausses, elles sont écartées. |

### Caractéristiques du bien

| Colonne | Type | Nullable | Unité / plage | Description |
|---|---|---|---|---|
| `nature_mutation` | string | non | | `Vente` ou `Vente en l'état futur d'achèvement` |
| `est_vefa` | bool | non | | Vrai pour une vente en l'état futur d'achèvement. **91 % des VEFA sont classées A, B ou C et se vendent avec une prime de neuf** : à contrôler dans toute analyse du DPE |
| `type_local` | string | non | `Maison` \| `Appartement` | Libellé |
| `code_type_local` | string | non | `1` = Maison, `2` = Appartement | Version encodée, à préférer pour le ML |
| `surface_bati` | float | non | m², ≥ 9 | Surface réelle bâtie |
| `nb_pieces` | float | oui | pièces | Nombre de pièces principales. **`NULL` sur 0,06 % des lignes** où la source avait recopié la surface dans ce champ : la mutation est conservée, seul le champ est neutralisé. |
| `surface_terrain` | float | oui | m² | Somme des parcelles de la mutation. `NULL` = pas de terrain associé, ce qui est la norme en appartement. |
| `nb_parcelles` | int | non | ≥ 1 | Nombre de parcelles cadastrales |
| `a_terrain` | bool | non | | Indicateur dérivé, pratique pour l'imputation |
| `surface_moyenne_piece` | float | oui | m²/pièce | `surface_bati / nb_pieces` |

### Cibles

| Colonne | Type | Nullable | Unité | Description |
|---|---|---|---|---|
| `valeur_fonciere` | float | non | € | Prix de la mutation, **pris une seule fois** malgré sa répétition sur les lignes source |
| `prix_m2` | float | non | €/m² | `valeur_fonciere / surface_bati`. **Cible recommandée** pour le modèle d'estimation. |

### Features de marché — **sans fuite temporelle**

Toutes calculées sur une fenêtre glissante de 12 mois **strictement antérieure** au mois de la mutation (mois courant exclu).

| Colonne | Type | Nullable | Description |
|---|---|---|---|
| `prix_m2_median_commune_12m` | float | oui | Médiane des médianes mensuelles de la commune, même type de bien, sur `[m-12, m-1]` |
| `nb_ventes_commune_12m` | float | non | Volume de ventes de la fenêtre. Sert d'indicateur de fiabilité de la feature précédente. |
| `prix_m2_median_dept_12m` | float | oui | Même calcul au niveau départemental |
| `nb_ventes_dept_12m` | float | non | Volume départemental de la fenêtre |
| `prix_m2_reference_12m` | float | oui | Médiane communale si `nb_ventes_commune_12m ≥ 5`, sinon médiane départementale |
| `source_reference_prix` | string | non | `commune` \| `departement` — trace le repli appliqué |

### Performance énergétique — DPE de l'ADEME

Colonnes toujours présentes. **Vides tant que `pipeline dpe` n'a pas été lancé.**
Méthode complète et résultats mesurés : `docs/enrichissement_dpe.md`.

| Colonne | Type | Nullable | Description |
|---|---|---|---|
| `dpe_classe` | string | oui | Étiquette énergie, `A` (meilleure) à `G`. `NULL` si aucun DPE trouvé |
| `dpe_ges` | string | oui | Étiquette gaz à effet de serre, `A` à `G` |
| `dpe_qualite_appariement` | string | oui | `exacte` : un seul DPE compatible à cette adresse. `probable` : plusieurs, le plus proche en surface retenu. **Filtrer sur `exacte` pour un signal fiable** |
| `dpe_nb_candidats` | int | oui | Nombre de DPE compatibles trouvés à l'adresse |
| `dpe_ecart_surface` | float | oui | Écart relatif entre surface vendue et surface du DPE retenu, 0 à 0,10 |
| `dpe_date` | date | oui | Date d'établissement du diagnostic |
| `annee_construction` | int | oui | Année de construction du logement, issue du DPE. Renseignée sur environ la moitié des ventes appariées |
| `periode_construction` | string | oui | `avant 1949`, `1949-1974`, `1975-1989`, `1990-2005`, `depuis 2006`. **Variable de contrôle indispensable** : sans elle, l'étiquette énergie est confondue avec l'âge du bâti |
| `zone_part_dpe_fg` | float | oui | Part des logements classés F ou G parmi tous les DPE du code postal, 0 à 1. **Attention : corrélée à +0,38 avec le prix** — les quartiers haussmanniens cumulent vieux bâti et prix élevés. Ne pas utiliser sans variables de localisation. |
| `zone_nb_dpe` | int | oui | Nombre de DPE du code postal, pour juger de la fiabilité du précédent |

---

## Les 5 règles que l'équipe ML doit connaître

1. **`prix_m2_reference_12m` est `NULL` sur les 12 premiers mois d'historique.** C'est un démarrage à froid, pas une erreur : aucune donnée antérieure n'existe. Écartez le premier millésime de l'entraînement ou traitez explicitement ces `NULL` — ne les imputez pas par une moyenne calculée sur tout le dataset, ce serait réintroduire de la fuite.

2. **Découpage train/test chronologique obligatoire.** Un split aléatoire ferait apprendre au modèle des transactions futures pour prédire le passé. Utilisez `mois_index` comme axe de coupure.

3. **`code_commune` ≠ `code_postal`, et Paris est découpé par arrondissement.** DVF utilise `75101` à `75120` et non le code global `75056`. C'est une bonne nouvelle — la granularité est fine — mais attention lors des jointures avec un référentiel qui, lui, agrège Paris en une seule commune.

4. **Les ventes multi-logements sont exclues** du dataset (décote de bloc non représentative du marché de détail). Elles restent disponibles dans la table `ecartees_multibiens` de la couche silver si vous voulez les analyser.

5. **Ne recalculez pas d'agrégat géographique sur l'ensemble du dataset.** Toute nouvelle feature de type « prix moyen du quartier » doit respecter la même règle de fenêtre antérieure, sinon les scores de validation seront artificiellement excellents.

---

## Utiliser le DPE sans se tromper

**La couverture est partielle, par nature.** Les DPE au nouveau format n'existent
que depuis juillet 2021, et tous les logements vendus n'en ont pas. Une grande
partie des ventes de 2021 n'aura pas de classe. Ne pas imputer ces valeurs par
la classe la plus fréquente : cela effacerait précisément le signal recherché.

**L'effet du DPE sur le prix n'a PAS pu être isolé.** Mesuré seul, il donne
−3 points pour les passoires. Mais une fois le neuf exclu et l'âge du bâti
neutralisé, l'écart disparaît et s'inverse même sur le bâti d'après-guerre.
L'étiquette énergie est enchevêtrée avec la nature de la vente, l'âge du bâti
et la surface. **Sa valeur réelle doit être établie par le modèle**, en
comparant deux entraînements avec et sans ces colonnes. Détail des mesures
dans `docs/enrichissement_dpe.md`.

**Filtrer sur la qualité d'appariement change tout.** Mesuré sur Paris, l'écart
de prix entre passoires et classes courantes vaut −3,1 points sur les
appariements `exacte`, contre −1,1 seulement sur les `probable`. La colonne
`dpe_ecart_surface` permet un filtrage plus fin encore : les appariements sous
4 % d'écart portent le signal le plus net.

**Deux usages complémentaires** :
- `dpe_classe` filtré sur `dpe_qualite_appariement = 'exacte'`, pour le signal
  individuel quand il existe ;
- `zone_part_dpe_fg` comme signal de repli — mais jamais seule, voir la mise
  en garde ci-dessus.

**Aucune fuite de la cible.** Le DPE décrit le logement, pas son prix. L'indicateur
de zone décrit le parc de logements du code postal, pas les transactions.

## Pièges connus et limites assumées

- **Variables qualitatives absentes.** DVF ne contient ni étage, ni état du bien, ni DPE, ni présence d'ascenseur, ni exposition. C'est la limite structurelle de la source et elle plafonne mécaniquement la performance du modèle. L'enrichissement externe (DPE de l'ADEME, IRIS de l'INSEE) est la piste pour la lever.
- **Biens identiques indiscernables.** Une mutation portant sur deux logements strictement identiques (même surface, même parcelle, même nombre de pièces) est comptée comme un seul bien : la source ne permet pas de les distinguer. Impact marginal, mais à mentionner plutôt qu'à cacher.
- **`surface_reelle_bati` et non `surface_carrez`.** La surface Carrez est renseignée de façon très inégale ; la surface réelle bâtie est plus complète et plus homogène. Elle est en revanche légèrement supérieure à la surface Carrez d'un appartement, ce qui tire les prix au m² très légèrement vers le bas.
- **Représentativité après nettoyage.** Le pipeline conserve 73,5 % des mutations initiales. Le détail étape par étape est produit par `python -m realstate_data.pipeline rapport`, et chaque règle est justifiée dans `docs/cleaning_rules.md`.
- **Millésime 2026 absent.** DVF est publié en avril et octobre, avec un décalage entre la vente et sa publication. Ne vous étonnez pas de l'absence de données récentes.
- **Médianes annuelles non standardisées.** Une médiane calculée sur les 8 départements bouge si la part de Paris varie d'une année sur l'autre, même à prix constants. L'analyse par département neutralise cet effet.
- **Périmètre francilien.** Le dataset n'est pas représentatif du marché national. L'extension se fait par simple modification de `config/settings.yaml`, sans changement de code.
- **Modèle de plus-value.** Il ne peut pas être entraîné directement sur cette table : il faut construire une cible à horizon N années, donc ne retenir que des transactions dont l'horizon est entièrement observé, et ne mobiliser que des features antérieures à la date d'achat.
