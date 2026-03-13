# DVF CLEANER – Pipeline de traitement des données DVF (IDF)

## Description

Ce script Python permet de :

- Lire les fichiers DVF (Demandes de Valeurs Foncières)
- Nettoyer et filtrer les données
- Restreindre l'analyse à l'Île-de-France
- Garder uniquement les maisons et appartements
- Calculer le prix au m²
- Exporter un CSV final propre

> **IMPORTANT** : Les fichiers DVF d'entrée ainsi que les fichiers générés ne sont PAS push sur GitHub (trop volumineux). Ils doivent être ajoutés localement.

## Structure du projet

```
project-root/
├── src/
│   └── dvf_pipeline.py
├── Data/              (À créer en local – non versionné)
│   ├── ValeursFoncieres-2025.txt
│   └── ValeursFoncieres-2024.txt
├── outputs/           (À créer en local – non versionné)
└── README.txt
```

### Attention

Dans le script :

```
Folder = "../Data/"
```

et l'export se fait vers :

```
../outputs/
```

**Donc si le script est dans "src/", les dossiers Data et outputs doivent être au même niveau que src.**

## Pré-requis

- Python 3.9+ recommandé
- Installer les dépendances :

```bash
pip install pandas
```

## Exécution

Se placer dans le dossier `src` :

```bash
python dvf_pipeline.py
```

## Paramètres à modifier

Dans le script, dans la section `if __name__ == "__main__":` :

```python
Folder = "../Data/"
Year = 2025

dvf_final = pipeline_dvf(Folder, Year)
```

### Paramètre important : `Year`

Si `Year = 2025` :

- Le script lira automatiquement :
  - `ValeursFoncieres-2025.txt`
  - `ValeursFoncieres-2024.txt`

- Et générera :
  - `DVF_clean_2024_2025.csv`

## Fonctionnement du pipeline

### `read_row_dvf(Folder, Year)`

**Lecture de Year et Year-1**

- Ajout d'une colonne "Année"
- Conservation uniquement des colonnes utiles :
  - No voie
  - B/T/Q
  - Type de voie
  - Voie
  - Code postal
  - Commune
  - Type local
  - Surface reelle bati
  - Valeur fonciere
  - Date mutation
  - Année

- Suppression des lignes vides sur :
  - Valeur fonciere
  - Surface reelle bati

### `prepare_dvf(df)`

**Typage :**

- Conversion des colonnes numériques (gestion virgule → point)
- Conversion des dates
- Conversion des colonnes texte en string

**Filtres :**

- Valeur fonciere > 0
- Surface reelle bati > 0
- Code postal valide (5 chiffres)
- Départements Île-de-France : 75, 77, 78, 91, 92, 93, 94, 95
- Type de bien : Maison, Appartement

**Colonnes construites :**

- `adresse` : concaténation propre de l'adresse complète
- `type_bien` : house / apartment
- `prix_au_m2` : Valeur fonciere / Surface reelle bati (arrondi à 2 décimales)

### `pipeline_dvf(Folder, Year)`

- Nettoyage des 2 années
- Concaténation
- Suppression des doublons sur :
  - adresse
  - Date mutation
  - Valeur fonciere
- Ajout d'un id unique
- Export CSV dans `../outputs/`

## Traiter une seule année

Par défaut, le script traite 2 années (Year et Year-1).

Si vous voulez traiter **UNE seule année** (ex : 2025 uniquement) :

Modifier dans `pipeline_dvf` :

**Remplacer :**

```python
df1_light, df2_light = read_row_dvf(Folder, Year)
df1_clean = prepare_dvf(df1_light)
df2_clean = prepare_dvf(df2_light)

df_final = pd.concat([df1_clean, df2_clean], ignore_index=True)
```

**Par :**

```python
df1_light, _ = read_row_dvf(Folder, Year)
df_final = prepare_dvf(df1_light)
```

Et modifier l'export en :

```python
df_final.to_csv(f"../outputs/DVF_clean_{Year}.csv", index=False)
```

Dans ce cas, seul le fichier `ValeursFoncieres-2025.txt` est nécessaire dans le dossier Data.

## Output final

Le CSV final contient notamment :

- adresse
- Code postal
- Commune
- type_bien
- Surface reelle bati
- Valeur fonciere
- prix_au_m2
- Date mutation
- Année
- id

## Contrôle qualité du nettoyage (run 2024)

Sur le fichier généré `DVF_clean_2023_2024.csv` :

- Lignes totales : `257354`
- `Valeur fonciere <= 0` : `0`
- `Surface reelle bati <= 0` : `0`
- Départements hors IDF : `0`
- Types de biens conservés : `apartment`, `house`
- Doublons `(adresse, Date mutation, Valeur fonciere)` : `0`

Points à améliorer :

- `prix_au_m2 <= 0` : `2` lignes restent présentes (prix très faibles).
- Le script ne fait pas encore de filtre outliers explicite (IQR/quantiles/seuil métier).

Conclusion :

- Le nettoyage est correct pour un MVP.
- Pour un usage production, ajouter un filtre de valeurs aberrantes est recommandé.

## Objectif

Ce pipeline produit un dataset propre et exploitable pour :

- Analyse immobilière
- Étude du prix au m²
- Data visualisation
- Machine learning
- Analyse territoriale IDF
