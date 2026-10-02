# Scénarios de cohérence application / modèle

Généré par `ml/scenarios_coherence_app.py`. Ventes réelles d'octobre à décembre 2025, 5 par département, estimées à partir de l'adresse seule par l'application, comparées à la prédiction hors ligne du même modèle (DPE individuel retiré des deux côtés).

**Ce n'est pas une mesure de précision** : le modèle de production a appris sur ces ventes. On vérifie que l'inférence recalcule les mêmes features qu'à l'entraînement.

**Résultat : 40 ventes estimées par le modèle ML, écart médian 2.2 %, 70 % à moins de 5 %, écart maximal 37.9 %.**

Écarts attendus, sans défaut : (1) l'application estime au marché du jour (dernière référence connue), la ligne du gold au marché du mois de la vente ; (2) dans l'application, la vente testée fait partie de l'historique de son immeuble, alors que le gold n'utilise que les ventes antérieures.

| Dép. | Commune | Surface | Hors ligne (€/m²) | Application (€/m²) | Écart |
|---|---|---:|---:|---:|---:|
| 75 | Paris 10e Arrondissement | 150 m² | 9 953 | 10 748 | +8.0 % |
| 75 | Paris 14e Arrondissement | 32 m² | 9 765 | 9 683 | -0.8 % |
| 75 | Paris 19e Arrondissement | 39 m² | 9 654 | 9 606 | -0.5 % |
| 75 | Paris 17e Arrondissement | 113 m² | 10 132 | 10 468 | +3.3 % |
| 75 | Paris 20e Arrondissement | 23 m² | 9 835 | 9 960 | +1.3 % |
| 93 | Rosny-sous-Bois | 83 m² | 3 521 | 3 498 | -0.6 % |
| 93 | Saint-Denis | 69 m² | 4 492 | 4 437 | -1.2 % |
| 93 | Sevran | 72 m² | 2 115 | 2 134 | +0.9 % |
| 93 | Bagnolet | 56 m² | 4 762 | 6 107 | +28.2 % |
| 93 | Saint-Denis | 85 m² | 3 342 | 3 711 | +11.0 % |
| 77 | La Ferté-sous-Jouarre | 82 m² | 2 262 | 2 183 | -3.5 % |
| 77 | Mary-sur-Marne | 90 m² | 2 041 | 2 188 | +7.2 % |
| 77 | Chelles | 150 m² | 2 797 | 2 716 | -2.9 % |
| 77 | Moissy-Cramayel | 65 m² | 2 722 | 2 687 | -1.3 % |
| 77 | Villenoy | 51 m² | 2 954 | 2 928 | -0.9 % |
| 95 | Cergy | 76 m² | 3 072 | 3 017 | -1.8 % |
| 95 | Franconville | 33 m² | 3 442 | 3 335 | -3.1 % |
| 95 | Pontoise | 73 m² | 3 344 | 3 422 | +2.3 % |
| 95 | Survilliers | 28 m² | 4 012 | 3 804 | -5.2 % |
| 95 | Saint-Ouen-l'Aumône | 35 m² | 3 844 | 3 747 | -2.5 % |
| 91 | Évry-Courcouronnes | 46 m² | 2 820 | 2 760 | -2.1 % |
| 91 | Les Ulis | 50 m² | 2 415 | 2 421 | +0.3 % |
| 91 | Yerres | 47 m² | 4 028 | 4 031 | +0.1 % |
| 91 | Saint-Germain-lès-Corbeil | 53 m² | 3 103 | 3 114 | +0.4 % |
| 91 | Palaiseau | 56 m² | 3 673 | 3 691 | +0.5 % |
| 94 | Saint-Mandé | 53 m² | 7 311 | 7 315 | +0.1 % |
| 94 | Le Perreux-sur-Marne | 83 m² | 3 999 | 4 474 | +11.9 % |
| 94 | Rungis | 68 m² | 3 353 | 3 413 | +1.8 % |
| 94 | Alfortville | 30 m² | 5 211 | 5 669 | +8.8 % |
| 94 | Thiais | 55 m² | 3 816 | 2 942 | -22.9 % |
| 78 | Maisons-Laffitte | 43 m² | 5 722 | 6 963 | +21.7 % |
| 78 | Verneuil-sur-Seine | 61 m² | 2 097 | 2 892 | +37.9 % |
| 78 | Saint-Germain-en-Laye | 61 m² | 6 291 | 6 278 | -0.2 % |
| 78 | Longnes | 100 m² | 2 797 | 2 450 | -12.4 % |
| 78 | Montigny-le-Bretonneux | 65 m² | 4 527 | 4 403 | -2.7 % |
| 92 | Antony | 77 m² | 6 948 | 7 273 | +4.7 % |
| 92 | Saint-Cloud | 98 m² | 9 190 | 9 213 | +0.3 % |
| 92 | Châtenay-Malabry | 101 m² | 3 584 | 3 661 | +2.1 % |
| 92 | Antony | 44 m² | 4 598 | 4 605 | +0.2 % |
| 92 | La Garenne-Colombes | 43 m² | 7 083 | 5 711 | -19.4 % |
