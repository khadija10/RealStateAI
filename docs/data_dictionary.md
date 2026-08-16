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
| `code_postal` | string | oui | Code postal |
| `latitude`, `longitude` | float | non | WGS84. Géocodage à la parcelle. |

### Caractéristiques du bien

| Colonne | Type | Nullable | Unité / plage | Description |
|---|---|---|---|---|
| `type_local` | string | non | `Maison` \| `Appartement` | Libellé |
| `code_type_local` | string | non | `1` = Maison, `2` = Appartement | Version encodée, à préférer pour le ML |
| `surface_bati` | float | non | m², ≥ 9 | Surface réelle bâtie |
| `nb_pieces` | float | oui | pièces | Nombre de pièces principales |
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

---

## Les 5 règles que l'équipe ML doit connaître

1. **`prix_m2_reference_12m` est `NULL` sur les 12 premiers mois d'historique.** C'est un démarrage à froid, pas une erreur : aucune donnée antérieure n'existe. Écartez le premier millésime de l'entraînement ou traitez explicitement ces `NULL` — ne les imputez pas par une moyenne calculée sur tout le dataset, ce serait réintroduire de la fuite.

2. **Découpage train/test chronologique obligatoire.** Un split aléatoire ferait apprendre au modèle des transactions futures pour prédire le passé. Utilisez `mois_index` comme axe de coupure.

3. **`code_commune` ≠ `code_postal`, et Paris est découpé par arrondissement.** DVF utilise `75101` à `75120` et non le code global `75056`. C'est une bonne nouvelle — la granularité est fine — mais attention lors des jointures avec un référentiel qui, lui, agrège Paris en une seule commune.

4. **Les ventes multi-logements sont exclues** du dataset (décote de bloc non représentative du marché de détail). Elles restent disponibles dans la table `ecartees_multibiens` de la couche silver si vous voulez les analyser.

5. **Ne recalculez pas d'agrégat géographique sur l'ensemble du dataset.** Toute nouvelle feature de type « prix moyen du quartier » doit respecter la même règle de fenêtre antérieure, sinon les scores de validation seront artificiellement excellents.

---

## Pièges connus et limites assumées

- **Variables qualitatives absentes.** DVF ne contient ni étage, ni état du bien, ni DPE, ni présence d'ascenseur, ni exposition. C'est la limite structurelle de la source et elle plafonne mécaniquement la performance du modèle. L'enrichissement externe (DPE de l'ADEME, IRIS de l'INSEE) est la piste pour la lever.
- **Biens identiques indiscernables.** Une mutation portant sur deux logements strictement identiques (même surface, même parcelle, même nombre de pièces) est comptée comme un seul bien : la source ne permet pas de les distinguer. Impact marginal, mais à mentionner plutôt qu'à cacher.
- **`surface_reelle_bati` et non `surface_carrez`.** La surface Carrez est renseignée de façon très inégale ; la surface réelle bâtie est plus complète et plus homogène. Elle est en revanche légèrement supérieure à la surface Carrez d'un appartement, ce qui tire les prix au m² très légèrement vers le bas.
- **Représentativité après nettoyage.** Le pipeline conserve 73,5 % des mutations initiales. Le détail étape par étape est produit par `python -m realstate_data.pipeline rapport`, et chaque règle est justifiée dans `docs/cleaning_rules.md`.
- **Millésime 2026 absent.** DVF est publié en avril et octobre, avec un décalage entre la vente et sa publication. Ne vous étonnez pas de l'absence de données récentes.
- **Médianes annuelles non standardisées.** Une médiane calculée sur les 8 départements bouge si la part de Paris varie d'une année sur l'autre, même à prix constants. L'analyse par département neutralise cet effet.
- **Périmètre francilien.** Le dataset n'est pas représentatif du marché national. L'extension se fait par simple modification de `config/settings.yaml`, sans changement de code.
- **Modèle de plus-value.** Il ne peut pas être entraîné directement sur cette table : il faut construire une cible à horizon N années, donc ne retenir que des transactions dont l'horizon est entièrement observé, et ne mobiliser que des features antérieures à la date d'achat.
