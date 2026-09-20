# data-pipeline — périmètre Data Engineering

Ingestion, nettoyage et préparation des données DVF géolocalisées (Etalab / DGFiP)
pour le projet RealStateAI.

**Périmètre :** Île-de-France, 8 départements (75, 77, 78, 91, 92, 93, 94, 95).

## Démarrage

```bash
make setup     # environnement virtuel + dépendances
make ingest    # téléchargement des millésimes DVF (étape 1)
make data      # pipeline complet bronze -> silver -> gold
make test      # tests unitaires sur l'échantillon versionné
```

## Couches de données

| Couche | Dossier | Contenu | Versionné |
|---|---|---|---|
| bronze | `data/raw/` | `.csv.gz` DVF tels que téléchargés | non |
| silver | `data/interim/` | dédoublonné, typé, filtré | non |
| gold | `data/processed/` | dataset ML-ready (Parquet) | non |
| samples | `data/samples/` | ~5 000 lignes pour tests et CI | **oui** |

Voir `docs/data_dictionary.md` pour le contrat d'interface avec l'équipe ML.
