# Règles de nettoyage — justification

Chaque règle appliquée au pipeline DVF, son coût mesuré et son argument métier.
Chiffres établis sur l'Île-de-France, millésimes 2021 à 2025, 8 départements.

**Volumétrie :** 2 433 220 lignes brutes → 998 431 mutations → 733 720 mutations
propres → 711 443 lignes dans le dataset gold.

---

## 1. Déduplication — la règle centrale

**Constat.** Une mutation DVF s'étale sur plusieurs lignes : une par lot, par
parcelle et par local. La colonne `valeur_fonciere` est répétée à l'identique
sur chacune. Mesuré : **2 433 220 lignes pour 998 431 ventes réelles**, soit un
facteur 2,44.

**Règle.** Reconstruction des biens distincts de chaque mutation, puis
agrégation par `id_mutation` : valeur foncière prise une seule fois (`max`,
constante par construction), surfaces sommées sur les biens distincts.

**Contrôle.** Un test automatisé sur cas construit vérifie qu'une vente de
300 000 € pour 60 m² éclatée sur 3 lignes redevient une ligne à 5 000 €/m².
Un contrôle d'exécution alerte si la valeur foncière n'est pas constante au
sein d'une mutation.

**Conséquence si omise.** Sur-comptage du volume de ventes et prix au m²
multipliés par le nombre de lots. C'est l'erreur la plus fréquente sur DVF.

---

## 2. Filtre `nature_mutation` — coût 0,9 %

**Conservé :** Vente, Vente en l'état futur d'achèvement.
**Écarté :** Échange (pas de prix de marché), Expropriation (prix administratif),
Adjudication (vente forcée, systématiquement décotée).

**Argument.** Seules les transactions de gré à gré à titre onéreux reflètent un
prix de marché exploitable pour un modèle d'estimation.

---

## 3. Filtre `type_local` — coût 22,1 %, la perte principale

**Conservé :** maisons (code 1) et appartements (code 2).

**Composition mesurée de ce qui est écarté** (une mutation pouvant contenir
plusieurs types de biens, les parts se recoupent) :

| Type de bien | Mutations concernées | Part |
|---|---:|---:|
| Dépendance (parking, cave, box) | 579 214 | 58,4 % |
| Terrain seul, aucun local bâti | 156 888 | 15,8 % |
| Local industriel ou commercial | 57 565 | 5,8 % |

**Argument.** Les mutations ne contenant aucun logement sont hors périmètre
d'un modèle d'estimation résidentielle. Les inclure ferait s'effondrer
artificiellement le prix au m² : un box de 12 m² et un trois-pièces n'ont
aucun rapport de valeur.

**Limite assumée.** Ce filtre est le plus coûteux du pipeline. Il est
réversible : les codes conservés sont paramétrés dans `settings.yaml`.

---

## 4. Ventes multi-logements — coût 3,5 %

**Règle.** Seules les mutations portant sur un logement unique sont conservées.

**Argument.** Une vente en bloc de plusieurs appartements comporte une décote
d'immeuble qui ne reflète pas le marché de détail que le modèle doit estimer.

**Précision.** Ces mutations ne sont pas détruites : elles restent disponibles
dans la table `ecartees_multibiens` de la couche silver.

---

## 5. Surface bâtie minimale de 9 m² — coût 0,2 %

**Argument.** Seuil de décence d'un logement en droit français. En dessous, la
surface est soit erronée, soit le bien n'est pas un logement.

---

## 6. Géolocalisation obligatoire — coût 1,0 %

**Argument.** Sans coordonnées ni code commune, aucune feature géographique
n'est calculable. Le géocodage Etalab s'avère excellent : seulement 1 % de
perte à cette étape.

---

## 6 bis. Cohérence géographique — coût 0,02 %

**Constat.** Le contrôle qualité automatisé a détecté 120 mutations portant
des latitudes hors de France : 78° et 83°, soit l'océan Arctique, sur des
communes des Hauts-de-Seine. Remontée à la source : les 334 lignes brutes
correspondantes contiennent déjà ces valeurs. **L'anomalie provient de la
donnée publiée, pas du pipeline.**

Elle est concentrée sur cinq communes — Vaucresson, Malakoff,
Issy-les-Moulineaux, Châtenay-Malabry, Garches — et n'affecte que le
géocodage : commune, surface et valeur foncière restent plausibles sur ces
lignes. Il ne s'agit donc pas d'un décalage de colonnes.

**Pourquoi un contrôle par bornes nationales est insuffisant.** Sur ces mêmes
enregistrements, la longitude est également fausse tout en restant dans les
limites de la France : 0,27 au lieu de 2,27 pour Issy-les-Moulineaux, 1,26 au
lieu de 2,30 pour Malakoff. Un test « le point est-il en France ? » les
laisserait passer.

**Règle retenue.** Chaque coordonnée doit être à moins de 1,5° (environ
165 km) du centroïde de son propre département. Le centroïde est calculé par
**médiane**, donc insensible aux points aberrants que l'on cherche justement
à détecter. La tolérance est volontairement large : elle n'écarte que
l'impossible, jamais un bien réellement situé aux confins de son département.

**Portée.** La règle ne dépend d'aucun référentiel externe et fonctionne pour
n'importe quel département français, sans paramétrage supplémentaire.

---

## 6 ter. Cohérence surface / nombre de pièces — coût 0 ligne

**Constat.** Le contrôle qualité a signalé des logements à 50, 62 ou 80 pièces
principales. L'inspection révèle un mécanisme précis : sur ces lignes, le
nombre de pièces est **rigoureusement égal à la surface** — 28 pièces pour
28 m², 24 pour 24 m², 12 pour 12 m². La valeur de surface a été recopiée dans
le champ `nombre_pieces_principales` à la saisie. C'est un défaut systématique
de la source, pas une variation aléatoire.

**Ampleur.** 430 mutations sur 721 675, soit 0,06 %.

**Règle retenue.** En dessous de 8 m² par pièce, le champ `nb_pieces` est
neutralisé (`NULL`).

**Pourquoi neutraliser plutôt que supprimer.** Sur ces lignes, la surface, le
prix et la localisation sont corrects : seul le nombre de pièces est faux.
Supprimer la mutation ferait perdre 430 observations de prix parfaitement
exploitables. On invalide donc le champ fautif, pas l'enregistrement entier.
La colonne est déclarée nullable dans le contrat d'interface, l'équipe ML sait
la traiter.

**Validation du seuil.** À 8 m² par pièce, la règle préserve les biens
d'exception réels — un hôtel particulier parisien de 1 561 m² et 23 pièces
affiche 68 m² par pièce — tout en écartant l'impossible.

---

## 7. Valeurs aberrantes — coût 3,1 %

### Garde-fous absolus : 300 et 30 000 €/m²

Retirent 0,88 % des mutations. Inspection des cas écartés :

- **Bas :** ventes à 1 ou 2 euros — donations déguisées, cessions
  intrafamiliales, transferts sans contrepartie réelle.
- **Haut :** un appartement de 16 m² à 255 millions d'euros — la valeur
  foncière couvre un portefeuille entier alors que la surface ne compte qu'un
  lot. Erreur structurelle, pas du marché de luxe.

### Règle relative : entre 0,25× et 4× la médiane de la commune

**Pourquoi pas un seuil absolu.** La médiane va de 3 115 €/m² en Essonne à
10 313 €/m² à Paris. Un plancher assez haut pour Paris amputerait la grande
couronne ; assez bas pour la grande couronne, il laisse passer des ventes
parisiennes à 800 €/m².

**Pourquoi pas des quantiles.** Ils retirent un pourcentage fixe de chaque
côté, que la queue soit anormale ou non. Mesuré : après quantiles à 1 %/99 %,
le 1er percentile parisien restait à **1 516 €/m²**, toujours invraisemblable.

**Calibrage comparatif** (script `calibrage.py`) :

| Stratégie | Perte | p1 Paris | Minimum Paris |
|---|---:|---:|---:|
| Aucun filtre | 0,00 % | 65 €/m² | 0 € |
| Bornes absolues seules | 0,88 % | 1 516 €/m² | 300 € |
| Quantiles 1 %/99 % par zone | 3,04 % | 1 516 €/m² | 300 € |
| **Bornes + ratio 0,25–4× (retenue)** | **1,62 %** | **4 181 €/m²** | **2 231 €** |
| Bornes + ratio 0,35–3× | 2,25 % | 4 741 €/m² | 3 036 € |

**Décision.** La règle relative est retenue : elle retire **moins** de données
que les quantiles (1,62 % contre 3,04 %) tout en traitant nettement mieux la
queue basse. Repli sur la médiane départementale pour les communes de moins de
20 ventes.

**Découverte associée.** Les ventes écartées par cette règle affichent des
ratios autour de 0,02 — 2 % du prix médian de leur propre arrondissement. Il
s'agit très probablement de **ventes en nue-propriété ou en viager occupé**,
où le prix enregistré ne représente qu'une fraction de la valeur du bien.
DVF ne les identifie pas ; la règle relative les capture indirectement.

**Justification de fond.** Le traitement des outliers ne vise pas à corriger
la médiane — elle est insensible aux extrêmes, et vaut 10 134 €/m² avec ou
sans filtrage. Il vise la **stabilité de l'apprentissage** : une régression à
erreur quadratique est violemment sensible aux valeurs extrêmes, et un seul
point à 15 millions du m² peut déformer un modèle entier.

---

## Validation externe

| Contrôle | Résultat |
|---|---|
| Prix médian appartements Paris 2023 | 10 189 €/m² contre 10 130 €/m² publiés par les Notaires du Grand Paris, soit **+0,6 %** |
| Hiérarchie géographique | Paris 10 313 → Hauts-de-Seine 6 846 → Val-de-Marne 5 000 → Essonne 3 115 €/m², conforme au marché |
| Retournement de marché | Volume de ventes en baisse de 36 % entre 2021 et 2024, prix au pic en 2022 — cohérent avec la remontée des taux |
| Saisonnalité | Pic en juillet, creux en août, reprise en septembre, reproduit sur 2024 et 2025 |
| Cohérence surface / pièces | Progression monotone : 25, 42, 63, 83, 105, 131, 158, 185 m² de 1 à 8 pièces |

## Anomalies résiduelles assumées

Sur 733 720 mutations : 48 cas de petite surface avec 4 pièces ou plus,
404 sans nombre de pièces, 196 surfaces supérieures à 400 m². Volume
négligeable, conservé plutôt qu'écarté par des règles supplémentaires
difficiles à justifier.

Les 5 096 appartements associés à une surface de terrain ne sont pas une
anomalie : rez-de-chaussée avec jardin ou parcelle rattachée au lot.

## Taux de conservation global

**73,5 %** des mutations initiales, stable entre le périmètre parisien seul
(72,8 %) et l'Île-de-France entière. Cette stabilité indique que les règles ne
sont pas calibrées sur un cas particulier.
