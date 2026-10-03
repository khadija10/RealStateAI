# Scénarios de performance par segment — modèles v1 et v2

Généré le 02/10/2026 à 22:37 par `ml/scenarios_performance.py`.

Test du protocole (`docs/protocole_evaluation.md`) : **ventes d'octobre à décembre 2025**, jamais vues à l'entraînement (jusqu'à juin 2025) ni au réglage (juillet–septembre 2025). Modèles figés : v1 = section 4, v2 = addendum 8. Ce découpage ne modifie aucun réglage : il détaille la mesure officielle segment par segment. Segments de moins de 30 ventes omis.

Erreur d'une vente = |prix réel − prix estimé| / prix réel. « Gain » négatif = le v2 se trompe moins que le v1.

Contrôle : MAPE globale v1 16.71 %, v2 14.91 % (officiel : 16,71 % et 14,91 %).

### Ensemble

| Segment | Ventes | MAPE v1 | MAPE v2 | Gain | ±10 % v2 | ±20 % v2 |
|---|---:|---:|---:|---:|---:|---:|
| Toutes les ventes de test | 31 696 | 16.7 % | **14.9 %** | -1.8 pt | 50.2 % | 78.0 % |

### Zone

| Segment | Ventes | MAPE v1 | MAPE v2 | Gain | ±10 % v2 | ±20 % v2 |
|---|---:|---:|---:|---:|---:|---:|
| Grande couronne (77, 78, 91, 95) | 13 751 | 16.5 % | **14.5 %** | -2.0 pt | 52.1 % | 79.5 % |
| Petite couronne (92, 93, 94) | 11 037 | 16.3 % | **14.3 %** | -1.9 pt | 50.8 % | 79.0 % |
| Paris | 6 908 | 17.8 % | **16.5 %** | -1.2 pt | 45.3 % | 73.2 % |

### Département

| Segment | Ventes | MAPE v1 | MAPE v2 | Gain | ±10 % v2 | ±20 % v2 |
|---|---:|---:|---:|---:|---:|---:|
| Paris | 6 908 | 17.8 % | **16.5 %** | -1.2 pt | 45.3 % | 73.2 % |
| Hauts-de-Seine | 4 523 | 16.0 % | **14.3 %** | -1.7 pt | 51.2 % | 79.0 % |
| Seine-et-Marne | 3 930 | 17.6 % | **15.7 %** | -1.9 pt | 50.7 % | 77.7 % |
| Yvelines | 3 714 | 16.8 % | **14.7 %** | -2.1 pt | 50.8 % | 78.8 % |
| Val-de-Marne | 3 360 | 16.2 % | **14.0 %** | -2.2 pt | 50.3 % | 80.5 % |
| Essonne | 3 296 | 14.8 % | **13.1 %** | -1.8 pt | 55.0 % | 82.3 % |
| Seine-Saint-Denis | 3 154 | 16.8 % | **14.7 %** | -2.1 pt | 50.6 % | 77.2 % |
| Val-d'Oise | 2 811 | 16.6 % | **14.4 %** | -2.2 pt | 52.6 % | 79.9 % |

### Type de bien

| Segment | Ventes | MAPE v1 | MAPE v2 | Gain | ±10 % v2 | ±20 % v2 |
|---|---:|---:|---:|---:|---:|---:|
| Appartement | 22 213 | 16.1 % | **14.1 %** | -2.0 pt | 52.0 % | 79.8 % |
| Maison | 9 483 | 18.2 % | **16.8 %** | -1.4 pt | 45.8 % | 73.5 % |

### Surface

| Segment | Ventes | MAPE v1 | MAPE v2 | Gain | ±10 % v2 | ±20 % v2 |
|---|---:|---:|---:|---:|---:|---:|
| < 30 m² | 3 792 | 18.8 % | **17.4 %** | -1.5 pt | 44.6 % | 71.6 % |
| 30–60 m² | 10 191 | 16.5 % | **14.7 %** | -1.8 pt | 51.0 % | 79.0 % |
| 60–100 m² | 12 069 | 15.9 % | **13.9 %** | -2.0 pt | 53.5 % | 81.1 % |
| ≥ 100 m² | 5 644 | 17.5 % | **15.9 %** | -1.6 pt | 45.2 % | 73.7 % |

### Niveau de prix de la commune

| Segment | Ventes | MAPE v1 | MAPE v2 | Gain | ±10 % v2 | ±20 % v2 |
|---|---:|---:|---:|---:|---:|---:|
| Marché le moins cher (Q1) | 7 946 | 16.8 % | **14.8 %** | -2.1 pt | 51.7 % | 79.3 % |
| Q2 | 7 904 | 15.9 % | **14.0 %** | -2.0 pt | 53.7 % | 80.2 % |
| Q3 | 8 001 | 16.6 % | **14.6 %** | -2.0 pt | 49.7 % | 78.6 % |
| Marché le plus cher (Q4) | 7 845 | 17.5 % | **16.3 %** | -1.2 pt | 45.6 % | 73.7 % |

### DPE du bien connu

| Segment | Ventes | MAPE v1 | MAPE v2 | Gain | ±10 % v2 | ±20 % v2 |
|---|---:|---:|---:|---:|---:|---:|
| Oui | 22 117 | 14.5 % | **13.3 %** | -1.3 pt | 53.4 % | 81.7 % |
| Non | 9 579 | 21.7 % | **18.7 %** | -3.0 pt | 42.7 % | 69.3 % |

### Ventes antérieures dans l'immeuble

| Segment | Ventes | MAPE v1 | MAPE v2 | Gain | ±10 % v2 | ±20 % v2 |
|---|---:|---:|---:|---:|---:|---:|
| Oui | 18 324 | 15.4 % | **13.4 %** | -2.0 pt | 54.2 % | 81.6 % |
| Non | 13 372 | 18.5 % | **17.0 %** | -1.5 pt | 44.7 % | 72.9 % |

### Neuf (VEFA)

| Segment | Ventes | MAPE v1 | MAPE v2 | Gain | ±10 % v2 | ±20 % v2 |
|---|---:|---:|---:|---:|---:|---:|
| Non | 31 272 | 16.8 % | **15.0 %** | -1.8 pt | 49.9 % | 77.7 % |
| Oui | 424 | 12.3 % | **8.1 %** | -4.1 pt | 70.8 % | 94.8 % |
