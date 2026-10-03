# Mémoire : ce qu'il ne doit pas contenir

**Établi le 3 octobre 2026, pour la rédaction du mémoire de la soutenance du 6 octobre.**
À lire avec la section 10 du [rapport v1.5](RAPPORT_V1_5.md), qui donne les chiffres et les formulations à utiliser.

Le principe : un jury pardonne une limite expliquée, pas une contradiction, une exagération ou un chiffre périmé. Ce document liste ce qui fait mauvaise impression. Il ne demande **jamais** de cacher un résultat : la dernière section rappelle ce qui doit rester.

---

## 1. Des chiffres périmés ou contradictoires

Le mémoire doit utiliser **une seule série de chiffres**, celle du tableau 10.2 du rapport. Les anciens documents du dépôt contiennent d'autres valeurs : ne pas les recopier.

| À ne pas écrire | Pourquoi | À écrire à la place |
|---|---|---|
| 16,4 %, 16,37 % ou 16,5 % d'erreur moyenne | anciennes mesures, faites avec une méthode qui surestimait le modèle | **14,91 %** (v1.5) ; 16,98 % pour l'ancienne version mesurée avec le même protocole |
| R² 0,82 | ancienne mesure, et le protocole n'utilise pas le R² | MAPE, part à ±10 % et à ±20 % |
| 28 variables, 33 variables | anciennes versions du modèle | **45 variables** |
| 721 675 ventes | ancien décompte | **721 674 ventes analysées**, 700 270 retenues pour l'entraînement |
| Un tableau de 27 secteurs avec leurs prix (Paris 6ᵉ à 14 783 €/m²…) | chiffres écrits à la main, périmés | les prix servis par l'application (Paris 6ᵉ : 14 146 €/m² dans le dataset) |
| 14,99 € par mois | ancien prix, jugé trop bas par le jury | la grille cible (39 à 49 € HT par agent), présentée comme cible |
| « 1 279 communes » à côté de « 742 communes » sur la carte | les deux sont vrais mais se contredisent sans explication | 1 279 communes dans le dataset ; la carte n'affiche que celles qui ont au moins 5 ventes du type choisi |

**Documents anciens à ne pas utiliser comme source de chiffres :** `AVANCEMENT_MLOPS.md`, `PROJECT_REPORT.md`, `RAPPORT_V1_2.md`, `RAPPORT_V1_3.md`, `RAPPORT_V1_4.md`, `enrichissement_dpe.md`, `cleaning_rules.md`. Ils restent valables pour l'historique du projet, pas pour les résultats.

---

## 2. Des affirmations qui vont au-delà de ce qui est prouvé

| À ne pas écrire | Pourquoi |
|---|---|
| « Objectif atteint » sans préciser le critère | faux pour le critère à ±20 % au global (78,0 %) ; voir 10.3 du rapport pour la bonne formulation |
| « 8 estimations sur 10 à moins de 20 % » | 78 %, c'est « près de 8 sur 10 » ; « plus de 8 sur 10 » seulement avec les ventes de l'immeuble ou le DPE |
| « Précision de 85 % » | 85 % est la **couverture de la fourchette**, pas une précision du prix |
| « Le modèle tient compte de l'étage » ou « de l'état du bien » | l'étage n'existe dans aucune donnée ouverte ; l'état est approché par le DPE et la BDNB, ce sont des **indicateurs**, pas une mesure de l'état |
| « Nos données sont à jour » ou « en temps réel » | le marché est observé jusqu'à fin 2025 |
| « Validé sur 2026 » ou « la validation officielle se fera sur 2026 » comme si c'était acquis | rien n'est encore mesuré sur 2026 : c'est la **prochaine** mesure, prévue |
| « L'IA prédit le prix exact », « deep learning », « réseau de neurones » | le modèle est un LightGBM (gradient boosting d'arbres) ; il donne une estimation et une fourchette |
| « Le modèle utilise CatBoost » ou « un ensemble de modèles » | CatBoost a été testé puis retiré (0,1 % de gain) : le modèle est un LightGBM seul |
| « Le modèle distingue le neuf de l'ancien » | testé (`est_vefa`), non retenu ; seul l'affichage des secteurs écarte le neuf |
| « Le PTZ est calculé », « l'application vérifie l'éligibilité aux aides » | les aides sont **signalées**, jamais chiffrées |
| « Score bancaire », « accord de prêt », « conseil en crédit » | l'indice de solidité est indicatif et propre à l'application ; l'assistant donne des informations générales (activité d'IOBSP réglementée) |
| « Expertise » ou « avis de valeur » | en France, l'avis de valeur est le document remis par un agent après visite ; ici, c'est une **estimation** indicative, automatique, sans valeur contractuelle |
| « Version mobile », « mode sombre » comme fonctionnalités abouties | non vérifiés |
| « Déployé en production » pour la v1.5 | vrai seulement si le redéploiement sur Render est fait avant le 6 octobre ; sinon, Render sert la v1.4.2 |
| « Fiche à votre logo », « envoi du dossier au client », « paiement intégré » | fonctions de l'offre pro **cible**, non développées |
| « Testé auprès d'utilisateurs », un score SUS | seulement si les tests ont réellement eu lieu, avec leurs résultats |

---

## 3. Des sources non vérifiées

| À ne pas citer | Pourquoi |
|---|---|
| Les écarts avec les prix Notaires-INSEE (« écart moyen de 10 % », « Évry −33 % ») | chiffres repris d'un script, source exacte non vérifiée |
| « Contrôle de cohérence avec les Notaires du Grand Paris (+0,6 %) » | à garder seulement si la source et la date de la comparaison sont retrouvées et citées |
| « 6 000 agences » ou « 20 000 agences en Île-de-France » | chiffres d'articles sans méthode ; utiliser le dimensionnement du [`marche_professionnels_idf.md`](marche_professionnels_idf.md) |
| Des chiffres de concurrents (prix, précision annoncée) | non vérifiés dans ce projet ; les citer avec leur source et leur date, ou ne pas les citer |

---

## 4. Ce qui relève de la cuisine interne

Ces éléments n'apportent rien au jury et donnent une impression de bricolage. Ils ne sont pas cachés : ils restent dans le dépôt et les rapports techniques.

- **Les incidents de la machine de développement** : mémoire saturée, VS Code qui se ferme, évaluations relancées, serveur à redémarrer.
- **Les bugs d'interface corrigés en cours de route**, détaillés un par un (doublons « Paris 11ᵉ », pastille verte, suggestions sous les onglets, encart du notaire…). Si besoin, une phrase suffit : « les relectures ont conduit à corriger la cohérence de l'interface ».
- **Les noms de fichiers, de branches, de commits et les commandes**, sauf dans une annexe technique. Exception utile : le commit qui date le protocole, preuve que l'objectif a été fixé avant la mesure.
- **Les comptes de test** (« admin@admin.com », « parcours-test ») et les adresses de test répétées.
- **Les débats internes** sur la formulation de l'objectif ou la crainte de l'afficher.

---

## 5. Des captures d'écran qui trahissent une ancienne version

Refaire toutes les captures sur la version finale. Une capture ancienne contredit le texte. À vérifier sur chaque capture :

- pas de « MAPE 14,91 % » dans le bandeau, ni de « Modèle ML », ni de « DPE 58,7 % » dans l'en-tête ;
- prix arrondi (« 220 000 € »), pas à l'euro près ;
- pas d'onglets « Historique » et « Profil » dans la barre principale (ils sont dans l'espace du compte) ;
- carte aux couleurs sable → brun, pas vert → rouge ;
- compte de démonstration présentable, pas « admin@admin.com » ;
- pas de maison estimée à l'adresse d'un immeuble (23 rue Lecourbe) ;
- historique sans lignes en double.

---

## 6. Un ton qui dessert

- **Pas de mot « échec »**, ni de « non atteint » en titre. Les chiffres, présentés critère par critère, suffisent.
- **Pas de ton défensif** face aux retours du jury de la soutenance blanche. Préférer : « c'est un bon point, voici ce que nous en avons fait ».
- **Pas de promesse floue** (« bientôt », « prochainement ») sans contenu : dire ce qui est prévu, et comment ce sera mesuré.
- **Pas de jargon non expliqué** pour les membres du jury qui ne sont pas data scientists : « MAPE » se dit « erreur moyenne », « ±20 % » se dit « à moins de 20 % du prix de vente réel ».

---

## 7. Ce qui doit rester, même si c'est moins flatteur

Retirer ces éléments ferait une impression bien pire s'ils étaient découverts. Le jury a demandé une « marge fixée avant le test » : il vérifiera ces points.

- **Le résultat à ±20 % : 78,0 % au global**, avec la formulation du rapport (dépassé avec les ventes de l'immeuble ou le DPE).
- **Le fait que la règle a été fixée avant la mesure et n'a pas été déplacée.**
- **Les deux réserves de l'addendum 8 du protocole** (période déjà utilisée pour mesurer le v1 ; arrêt anticipé de production sur cette période, après le gel des choix).
- **La largeur de la fourchette** (50 % du prix en médiane) et ce qui la resserre.
- **Les limites de la section 9 du rapport** : critères qualitatifs absents, effet maison / appartement trop uniforme, segments difficiles, données arrêtées fin 2025.
- **La comparaison honnête avec l'ancienne version** : l'ancienne méthode surestimait le modèle d'environ 0,6 point.
- **L'usage d'outils d'IA dans la réalisation du projet**, s'il doit être déclaré selon les règles de l'école : se conformer à ces règles.
