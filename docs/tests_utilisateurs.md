# Tests utilisateurs — protocole et synthèse

**Version testée : RealStateAI v1.5** · Protocole établi le 3 octobre 2026, en réponse au retour du jury :

> « Reprendre l'interface : 3 à 5 tests utilisateurs. »

Durée : **25 minutes par participant**, en présentiel ou en visioconférence avec partage d'écran.

---

## 1. Objectif

Vérifier, sur des utilisateurs réels, trois choses :

1. On peut **estimer un bien sans aide** et **comprendre la fiabilité** du résultat.
2. On peut **enchaîner sur le financement et la plus-value** du même bien.
3. Un professionnel **utiliserait l'estimation PDF** face à un client.

## 2. Participants (3 à 5)

| # | Profil | Pourquoi |
|---|---|---|
| P1 | Agent immobilier ou négociateur en agence | cible payante (offre Pro) |
| P2 | Mandataire indépendant | cible payante (offre Pro) |
| P3 | Acquéreur ayant un projet en Île-de-France | particulier, financement |
| P4 | Propriétaire qui envisage de vendre | particulier, estimation |
| P5 (facultatif) | Personne peu à l'aise avec le numérique | accessibilité |

Aucun participant ne doit avoir vu l'application avant le test.

## 3. Préparation

- L'application est ouverte sur la page d'accueil, le compte de test déconnecté et son historique vidé.
- Chaque participant a un bien en tête. À défaut, on lui en donne un : *20 rue du Couserans, 78310 Maurepas, appartement de 65 m², 3 pièces* (l'immeuble a des ventes et un DPE retrouvé).
- Consigne de départ, à lire telle quelle : *« Nous testons l'application, pas vous. Pensez à voix haute : dites ce que vous cherchez, ce qui vous surprend, ce qui vous gêne. Je ne vous aiderai pas pendant les tâches. »*
- Avec l'accord du participant, on enregistre l'écran et la voix. Sinon, on prend des notes.

## 4. Tâches

On lit la consigne sans montrer où cliquer. On note le temps, les hésitations et les erreurs.

| # | Consigne lue au participant | Réussite si… | Temps cible |
|---|---|---|---|
| T1 | « Estimez la valeur de ce bien. » | un prix s'affiche, après la création du compte ou la connexion | 3 min |
| T2 | « Selon vous, à quel point peut-on se fier à ce prix ? Pourquoi ? » | il cite la fourchette, la fiabilité ou les ventes de l'immeuble | 1 min |
| T3 | « Vous l'achetez à ce prix. Combien paierez-vous par mois ? » | une mensualité s'affiche, avec le prix repris de l'estimation | 3 min |
| T4 | « Combien pourriez-vous gagner en le revendant dans 10 ans ? » | une plus-value s'affiche, pour un horizon de 10 ans | 2 min |
| T5 | « Retrouvez l'estimation de ce bien sans la refaire. » | il passe par l'historique et « Voir le résultat » | 1 min |
| T6 | Pros seulement : « Préparez le document que vous remettriez à un vendeur. » | l'estimation PDF est exportée | 1 min |

## 5. Après les tâches

**Questionnaire SUS** (*System Usability Scale*, version française) : 10 affirmations notées de 1 (pas du tout d'accord) à 5 (tout à fait d'accord).

1. Je pense que j'utiliserais cette application fréquemment.
2. J'ai trouvé cette application inutilement complexe.
3. J'ai trouvé cette application facile à utiliser.
4. J'aurais besoin de l'aide d'un technicien pour pouvoir l'utiliser.
5. J'ai trouvé que les différentes fonctions étaient bien intégrées.
6. J'ai trouvé qu'il y avait trop d'incohérences dans cette application.
7. Je pense que la plupart des gens apprendraient très vite à l'utiliser.
8. J'ai trouvé cette application très lourde à utiliser.
9. Je me suis senti(e) en confiance en utilisant cette application.
10. J'ai dû apprendre beaucoup de choses avant de pouvoir l'utiliser.

**Calcul du score :**
- affirmations impaires : note − 1 ;
- affirmations paires : 5 − note ;
- on additionne, puis on multiplie par 2,5. On obtient un score sur 100.
- Lecture : au-dessus de 68, l'utilisabilité est au-dessus de la moyenne ; au-dessus de 80, elle est bonne.

**Trois questions ouvertes :**
1. « Qu'est-ce qui vous a le plus servi ? »
2. « Qu'est-ce qui vous a gêné ou manqué ? »
3. Pros seulement : « Montreriez-vous cette estimation à un vendeur ? Combien paieriez-vous par mois pour cet outil ? »

## 6. Grille d'observation (une par participant)

| Tâche | Réussie (oui / avec aide / non) | Temps | Hésitations, erreurs, verbatim |
|---|---|---|---|
| T1 Estimer | | | |
| T2 Fiabilité | | | |
| T3 Financement | | | |
| T4 Plus-value | | | |
| T5 Historique | | | |
| T6 Avis de valeur | | | |

Score SUS : ___ / 100 · Prix acceptable cité (pros) : ___ € par mois

## 7. Synthèse (à remplir après les tests)

| | P1 | P2 | P3 | P4 | P5 | Bilan |
|---|---|---|---|---|---|---|
| T1 Estimer | | | | | | _/5 |
| T2 Fiabilité comprise | | | | | | _/5 |
| T3 Financement | | | | | | _/5 |
| T4 Plus-value | | | | | | _/5 |
| T5 Historique | | | | | | _/5 |
| T6 Avis de valeur (pros) | | | | | | _/2 |
| Score SUS | | | | | | moyenne |

**Problèmes relevés, classés par gravité :**

| Problème | Participants concernés | Gravité (bloquant / gênant / mineur) | Correction |
|---|---|---|---|
| | | | |

**Pour la soutenance :** présenter le taux de réussite par tâche, le score SUS moyen, les 3 principaux problèmes et ce qui a été corrigé. On garde la formule du jury : « c'est un bon point, voici ce que nous en faisons ».
