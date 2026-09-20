# Guide d'utilisation — pipeline data DVF

Ce pipeline transforme les données brutes DVF (Demandes de Valeurs Foncières,
DGFiP / Etalab) en un dataset prêt pour la modélisation.

**Tu choisis les départements, les millésimes et les règles de nettoyage.**
Tout se règle dans un seul fichier : `config/settings.yaml`.

---

## 1. Installation (une fois)

### Windows

```powershell
git clone <url-du-depot>
cd RealStateAI
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e "data-pipeline[dev]"
```

Toutes les commandes suivantes utilisent `.\.venv\Scripts\python.exe`.

### macOS / Linux

```bash
git clone <url-du-depot>
cd RealStateAI
make setup
```

`make help` liste les raccourcis disponibles.

### Vérifier que tout fonctionne

```
.\.venv\Scripts\python.exe -m pytest data-pipeline/tests -v
```

8 tests doivent passer. Ils tournent sur des données synthétiques générées à
la volée : aucun téléchargement n'est nécessaire à cette étape.

---

## 2. Choisir ton périmètre

Ouvre `data-pipeline/config/settings.yaml`. Les deux lignes qui comptent :

```yaml
perimetre:
  departements: ["75", "77", "78", "91", "92", "93", "94", "95"]
  millesimes: [2021, 2022, 2023, 2024, 2025]
```

### Exemples

**Paris seul, une année** — rapide, idéal pour tester une idée :
```yaml
  departements: ["75"]
  millesimes: [2024]
```

**Petite couronne, 3 ans :**
```yaml
  departements: ["75", "92", "93", "94"]
  millesimes: [2023, 2024, 2025]
```

**Une autre région** — Rhône, Isère, Loire :
```yaml
  departements: ["69", "38", "42"]
  millesimes: [2021, 2022, 2023, 2024, 2025]
```

> Les codes doivent être des **chaînes à 2 caractères**, guillemets compris.
> Le zéro initial est signifiant : `"01"` pour l'Ain, jamais `1`.
>
> Le pipeline refuse par défaut les départements hors Île-de-France, comme
> garde-fou. Pour élargir, ouvre `src/realstate_data/config.py` et adapte la
> constante `DEPARTEMENTS_IDF`.

**Millésimes disponibles :** DVF est publié en avril et octobre, avec un
décalage d'environ un an. Un millésime absent n'est pas une erreur : le
script le signale (`Non publié`) et poursuit.

### Vérifier avant de lancer

```
.\.venv\Scripts\python.exe -m realstate_data.config
```

Affiche le périmètre effectivement pris en compte.

---

## 3. Lancer le pipeline

### Tout d'un coup

```
.\.venv\Scripts\python.exe -m realstate_data.pipeline run
```

Ordre de grandeur : environ 3 minutes pour l'Île-de-France sur 5 millésimes,
dont 30 secondes de traitement, le reste en téléchargement.

### Étape par étape

| Commande | Effet |
|---|---|
| `pipeline ingest` | Télécharge les fichiers DVF (idempotent, avec cache) |
| `pipeline silver` | Nettoie, dédoublonne, filtre |
| `pipeline gold` | Calcule les features, écrit le dataset final |
| `pipeline rapport` | Affiche le journal de perte étape par étape |

Pratique : après avoir modifié un seuil de nettoyage, `silver` et `gold`
suffisent — inutile de retélécharger.

### Voir le résultat

```
.\.venv\Scripts\python.exe -m realstate_data.apercu
```

Résumé dans le terminal, plus un extrait CSV ouvrable dans Excel :
`data/processed/apercu_gold.csv`.

---

## 4. Utiliser le dataset

```python
import duckdb

df = duckdb.sql("""
    SELECT * FROM read_parquet('data/processed/gold_transactions/**/*.parquet',
                               hive_partitioning=true)
""").df()
```

Ou avec pandas seul :

```python
import pandas as pd, glob
df = pd.concat(pd.read_parquet(f) for f in
               glob.glob('data/processed/gold_transactions/**/*.parquet',
                         recursive=True))
```

**Schéma complet, unités, valeurs manquantes et pièges connus :
`docs/data_dictionary.md`.** À lire avant de modéliser.

### Trois règles à ne pas oublier

1. **Découpage train/test chronologique**, jamais aléatoire. Utilise
   `mois_index` comme axe de coupure.
2. **`prix_m2_reference_12m` est vide sur les 12 premiers mois** de la période
   choisie : c'est un démarrage à froid, pas une erreur. Écarte la première
   année ou traite ces valeurs explicitement.
3. **Ne crée aucune feature à partir de `prix_m2`** (ratios, écarts à une
   moyenne calculée sur tout le dataset) : elle contient la cible.

---

## 5. Modifier les règles de nettoyage

Toujours dans `settings.yaml`, section `nettoyage`. Rien n'est codé en dur.

```yaml
nettoyage:
  natures_mutation_gardees: ["Vente", "Vente en l'état futur d'achèvement"]
  codes_type_local_gardes: [1, 2]     # 1 = Maison, 2 = Appartement
  surface_bati_min_m2: 9
  outliers:
    methode: "ratio_mediane_zone"
    ratio_min: 0.25
    ratio_max: 4.0
    prix_m2_plancher: 300
    prix_m2_plafond: 30000
```

Après modification, relance `silver` puis `gold`, et compare avec
`pipeline rapport`.

**Le raisonnement derrière chaque seuil, son coût mesuré et les stratégies
alternatives testées : `docs/cleaning_rules.md`.** Ne change pas un seuil sans
l'avoir lu — chacun a été calibré et documenté.

Deux scripts sont fournis pour justifier tes propres choix :

| Script | Usage |
|---|---|
| `diagnostic.py` | Distribution des prix, composition des filtres, cohérence interne |
| `calibrage.py` | Compare plusieurs stratégies d'outliers sur un critère externe |

---

## 6. Reproductibilité

À chaque exécution, le pipeline écrit `data/processed/_dataset_version.json` :
configuration utilisée, empreinte de cette configuration, volumétries et prix
médian par département.

Si deux personnes obtiennent des résultats différents, comparer ces deux
fichiers identifie immédiatement l'origine de l'écart.

Le manifeste `data/raw/_manifest.json` conserve pour chaque fichier téléchargé
son URL, sa date et son empreinte SHA-256.

---

## 7. Ce qui n'est pas versionné

Le dossier `data/` est exclu de Git : données brutes, intermédiaires et
finales. Chacun régénère localement avec la commande ci-dessus.

Sont versionnés : le code, la configuration, la documentation, les tests.

---

## Problèmes courants

**`No module named realstate_data`**
L'installation n'a pas été faite, ou pas dans le bon environnement.
Relance `pip install -e "data-pipeline[dev]"`.

**Erreur de conversion à la lecture d'un CSV**
Une colonne contient une valeur inattendue. Le pipeline force le typage de
toutes les colonnes, mais si une nouvelle apparaît, ajoute-la à `TYPES_FORCES`
dans `cleaning/silver.py`.

**`Non publié : <année> <département>`**
Le millésime n'existe pas encore chez la DGFiP. Comportement normal, le
pipeline continue avec les millésimes disponibles.

**Mémoire saturée**
Baisse `execution.memory_limit` dans `settings.yaml` : DuckDB basculera
davantage sur disque. Ou réduis le périmètre.

**Erreur de syntaxe PowerShell sur une commande avec des guillemets**
Mets le code dans un fichier `.py` et lance-le, plutôt que d'utiliser
`python -c "..."`.
