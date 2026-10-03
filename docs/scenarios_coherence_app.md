# Scénarios de cohérence application / modèle

Généré par `ml/scenarios_coherence_app.py`. Ventes réelles d'octobre à décembre 2025, 5 par département, estimées à partir de l'adresse seule par l'application, comparées à la prédiction hors ligne du même modèle (DPE du gold hors ligne, DPE retrouvé à l'adresse par l'application).

**Ce n'est pas une mesure de précision** : le modèle de production a appris sur ces ventes. On vérifie que l'inférence recalcule les mêmes features qu'à l'entraînement.

**Résultat : 40 ventes estimées par le modèle ML, écart médian 2.1 %, 75 % à moins de 5 %, écart maximal 30.9 %.**

Écarts attendus, sans défaut : (1) l'application estime au marché du jour (dernière référence connue), la ligne du gold au marché du mois de la vente ; (2) dans l'application, la vente testée fait partie de l'historique de son immeuble, alors que le gold n'utilise que les ventes antérieures.

| Dép. | Commune | Surface | Hors ligne (€/m²) | Application (€/m²) | Écart |
|---|---|---:|---:|---:|---:|
| 94 | Saint-Mandé | 53 m² | 7 347 | 7 331 | -0.2 % |
| 94 | Le Perreux-sur-Marne | 83 m² | 3 999 | 4 474 | +11.9 % |
| 94 | Rungis | 68 m² | 3 632 | 3 693 | +1.7 % |
| 94 | Alfortville | 30 m² | 5 211 | 5 421 | +4.0 % |
| 94 | Thiais | 55 m² | 3 927 | 2 974 | -24.3 % |
| 93 | Rosny-sous-Bois | 83 m² | 3 591 | 3 573 | -0.5 % |
| 93 | Saint-Denis | 69 m² | 4 556 | 4 514 | -0.9 % |
| 93 | Sevran | 72 m² | 2 074 | 2 093 | +0.9 % |
| 93 | Bagnolet | 56 m² | 4 726 | 5 401 | +14.3 % |
| 93 | Saint-Denis | 85 m² | 3 342 | 3 711 | +11.0 % |
| 75 | Paris 10e Arrondissement | 150 m² | 9 953 | 10 748 | +8.0 % |
| 75 | Paris 14e Arrondissement | 32 m² | 9 900 | 9 868 | -0.3 % |
| 75 | Paris 19e Arrondissement | 39 m² | 9 654 | 9 606 | -0.5 % |
| 75 | Paris 17e Arrondissement | 113 m² | 10 473 | 10 636 | +1.6 % |
| 75 | Paris 20e Arrondissement | 23 m² | 9 219 | 9 332 | +1.2 % |
| 78 | Maisons-Laffitte | 43 m² | 5 722 | 6 963 | +21.7 % |
| 78 | Verneuil-sur-Seine | 61 m² | 2 058 | 2 694 | +30.9 % |
| 78 | Saint-Germain-en-Laye | 61 m² | 6 044 | 6 009 | -0.6 % |
| 78 | Longnes | 100 m² | 2 806 | 2 450 | -12.7 % |
| 78 | Montigny-le-Bretonneux | 65 m² | 4 562 | 4 386 | -3.9 % |
| 92 | Antony | 77 m² | 6 948 | 7 273 | +4.7 % |
| 92 | Saint-Cloud | 98 m² | 9 190 | 9 213 | +0.3 % |
| 92 | Châtenay-Malabry | 101 m² | 3 584 | 3 661 | +2.1 % |
| 92 | Antony | 44 m² | 4 557 | 4 580 | +0.5 % |
| 92 | La Garenne-Colombes | 43 m² | 7 048 | 5 711 | -19.0 % |
| 95 | Cergy | 76 m² | 3 098 | 3 054 | -1.4 % |
| 95 | Franconville | 33 m² | 3 442 | 3 335 | -3.1 % |
| 95 | Pontoise | 73 m² | 3 440 | 3 330 | -3.2 % |
| 95 | Survilliers | 28 m² | 3 743 | 3 622 | -3.2 % |
| 95 | Saint-Ouen-l'Aumône | 35 m² | 3 791 | 3 712 | -2.1 % |
| 91 | Évry-Courcouronnes | 46 m² | 2 788 | 2 708 | -2.9 % |
| 91 | Les Ulis | 50 m² | 2 415 | 2 421 | +0.3 % |
| 91 | Yerres | 47 m² | 4 061 | 4 021 | -1.0 % |
| 91 | Saint-Germain-lès-Corbeil | 53 m² | 3 087 | 3 089 | +0.1 % |
| 91 | Palaiseau | 56 m² | 3 634 | 3 654 | +0.5 % |
| 77 | La Ferté-sous-Jouarre | 82 m² | 2 262 | 2 183 | -3.5 % |
| 77 | Mary-sur-Marne | 90 m² | 2 041 | 2 188 | +7.2 % |
| 77 | Chelles | 150 m² | 2 797 | 2 716 | -2.9 % |
| 77 | Moissy-Cramayel | 65 m² | 2 719 | 2 663 | -2.1 % |
| 77 | Villenoy | 51 m² | 3 167 | 3 098 | -2.2 % |
