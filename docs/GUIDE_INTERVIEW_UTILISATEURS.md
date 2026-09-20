# Guide d'Interview Utilisateurs — RealEstateAI
**Estimateur de prix immobilier**
Version 1.1 — Mars 2026

> **Note sur le périmètre :** Le prototype actuel couvre uniquement l'Île-de-France (données DVF disponibles). Ce guide est volontairement rédigé sans restriction géographique pour préparer le produit final à l'échelle nationale.

---

## Objectif du guide

Valider les hypothèses produit avant de passer à une version production :
- Le problème de l'estimation de prix est réel et douloureux pour les utilisateurs cibles
- La solution (estimation via données de transactions réelles, par commune + type + surface) répond au besoin
- L'interface et le résultat retourné sont compréhensibles et utilisables

---

## Profils à interviewer

| Profil | Pourquoi | Nb cible |
|--------|----------|----------|
| **Particulier vendeur** | Cas principal : quelqu'un qui veut vendre sans passer par une agence | 3–4 |
| **Particulier acheteur** | Veut vérifier si un bien est au juste prix avant d'acheter | 2–3 |
| **Agent immobilier** | Utilisateur pro, peut valider ou invalider la pertinence des estimations | 1–2 |
| **Primo-accédant** | Cherche à comprendre les prix d'un marché qu'il ne connaît pas | 1–2 |

**Total recommandé : 8–12 personnes**

---

## Règles de conduite (Mom Test)

1. Ne jamais pitcher le produit pendant l'interview problème
2. Parler du passé, pas du futur : *"raconte-moi la dernière fois que..."*
3. Chercher les comportements réels, pas les opinions
4. Si l'interviewé demande ce que fait le produit, noter sa curiosité mais ne pas répondre avant la fin
5. Silence = information — ne pas remplir les blancs

---

## Structure de l'interview (45 min)

### PARTIE 1 — Introduction (5 min)

> *"Merci de prendre le temps. On travaille sur un outil lié à l'immobilier et on cherche à comprendre comment les gens gèrent l'estimation de prix aujourd'hui. Il n'y a pas de bonnes ou mauvaises réponses. Je ne vais pas te montrer de produit tout de suite — j'ai juste des questions sur ton vécu."*

**Questions de contexte :**
- Tu peux te présenter rapidement ? (profession, situation logement)
- Dans quelle ville / région tu vis ?
- Tu as déjà été impliqué dans un achat ou une vente immobilière ?

---

### PARTIE 2 — Exploration du problème (15 min)

**Objectif : comprendre si le problème existe et à quel point il est douloureux**

#### Bloc 2a — Vécu général
- *"Raconte-moi la dernière fois que tu as eu besoin de connaître le prix d'un bien immobilier."*
  - Pourquoi tu en avais besoin ?
  - C'était dans quel contexte ? (vente, achat, curiosité, succession...)
  - Tu as fait comment pour trouver cette information ?

#### Bloc 2b — Outils actuels
- *"Quels outils ou sources tu as utilisés ?"*
  - Leboncoin, SeLoger, Meilleurs Agents, notaire.fr, agent immo... ?
  - Tu as eu confiance dans ce que tu as trouvé ? Pourquoi / pourquoi pas ?
  - Combien de temps ça t'a pris ?

#### Bloc 2c — Frustrations
- *"Qu'est-ce qui t'a frustré dans cette démarche ?"*
- *"T'es-tu déjà senti perdu ou mal informé sur les prix ? Dans quel moment ?"*
- *"Est-ce qu'il t'est arrivé de douter d'une estimation que tu avais trouvée ?"*
  - Qu'est-ce qui t'a fait douter ?
  - Qu'est-ce que tu as fait ensuite ?

#### Bloc 2d — Impact
- *"Si tu n'avais pas eu d'estimation fiable, qu'est-ce que ça aurait changé ?"*
- *"Tu dirais que c'était un vrai problème ou juste une légère contrainte ?"*
- *(Si vendeur)* *"Comment tu as finalement fixé ton prix de vente ?"*

---

### PARTIE 3 — Validation de la solution (15 min)

> *"Je vais maintenant te montrer un prototype. C'est un outil qui, à partir de la commune, du type de bien (appartement ou maison) et de la surface, retourne une fourchette de prix basée sur les vraies transactions notariées. Pour l'instant le prototype ne couvre que l'Île-de-France, mais le produit final vise toute la France."*

**Montrer le prototype en action (ou une capture d'écran)**

#### Bloc 3a — Compréhension immédiate
- *"Qu'est-ce que tu comprends de ce que tu vois ?"*
- *"C'est quoi pour toi la différence entre la borne basse, le prix estimé, et la borne haute ?"*
- *"L'indicateur de confiance (ex: 72%) — tu en fais quoi ?"*

#### Bloc 3b — Utilité perçue
- *"Est-ce que ça répond au besoin que tu m'as décrit tout à l'heure ?"*
- *"Dans quel cas tu utiliserais cet outil ?"*
- *"Dans quel cas tu ne l'utiliserais PAS ?"*

#### Bloc 3c — Manques / freins
- *"Qu'est-ce qui te manque pour faire confiance à ce résultat ?"*
  - Exemples possibles à ne pas suggérer : rue, étage, état du bien, DPE, proximité transports...
- *"Est-ce que le fait que ce soit basé sur des données gouvernementales (transactions notariées officielles) change quelque chose pour toi ?"*
- *"Tu aurais peur de quoi en utilisant ça ?"*

#### Bloc 3d — Comparaison aux alternatives
- *"Par rapport à ce que tu utilisais avant, c'est mieux, pareil, moins bien ?"*
- *"Tu aurais utilisé ça à la place de [ce qu'ils utilisaient avant] ?"*

---

### PARTIE 4 — Adoption et willingness to pay (5 min)

- *"Si cet outil était disponible en ligne gratuitement, tu penses que tu l'utiliserais ? À quelle fréquence ?"*
- *"Tu le conseillerais à quelqu'un ? Dans quelle situation ?"*
- *"Si c'était payant (ex: 5€ par estimation), tu paierais ?"*
  - Si non : *"À partir de quand / sous quelle forme ça ferait sens pour toi ?"*
- *"Y a-t-il quelque chose qui t'empêcherait d'utiliser ça ?"* (RGPD, confiance, autre)

---

### PARTIE 5 — Clôture (5 min)

- *"Est-ce qu'il y a quelque chose que je n'ai pas demandé et que tu voudrais partager ?"*
- *"Si tu pouvais changer une chose dans cet outil, ce serait quoi ?"*
- *"Tu connais des gens qui pourraient être intéressés ? On cherche encore des personnes à interviewer."*

---

## Grille de dépouillement (à remplir après chaque interview)

| Critère | Note /5 | Verbatim clé |
|---------|---------|--------------|
| Le problème est réel pour lui/elle | | |
| Il/elle utilise déjà des outils d'estimation | | |
| Il/elle est frustré par les solutions existantes | | |
| Il/elle a compris le résultat du prototype | | |
| Il/elle fait confiance à la source (transactions officielles) | | |
| Il/elle utiliserait l'outil | | |
| Il/elle paierait pour l'outil | | |

---

## Signaux à surveiller (go / no-go)

### Signaux positifs (GO)
- Mentionne spontanément la difficulté à trouver des prix fiables
- A déjà utilisé plusieurs sources sans être satisfait
- Comprend la fourchette et l'indicateur de confiance sans explication
- Mentionne un cas d'usage précis et récent

### Signaux négatifs (NO-GO ou pivot)
- *"Je demande juste à mon agent immo"* — dépendance forte aux intermédiaires
- *"Je fais confiance à SeLoger/Meilleurs Agents"* — concurrence perçue comme suffisante
- Incompréhension de la fourchette de prix (UX à retravailler)
- *"Commune seule c'est pas assez précis"* — limite de granularité perçue comme bloquante

---

## Hypothèses à valider / invalider

| # | Hypothèse produit | Validée si... |
|---|-------------------|---------------|
| H1 | Le problème d'estimation est réel et fréquent | ≥ 7/10 interviewés l'ont vécu dans les 2 ans |
| H2 | Les solutions existantes sont jugées insuffisantes | ≥ 6/10 expriment une frustration |
| H3 | La commune est un niveau de granularité acceptable | ≥ 5/10 trouvent le résultat utile malgré cette limite |
| H4 | La source officielle (transactions notariées) inspire confiance | ≥ 6/10 réagissent positivement quand on la mentionne |
| H5 | La fourchette + indicateur de confiance est compréhensible | ≥ 7/10 interprètent correctement sans aide |

---

*Guide réalisé dans le cadre du POC RealEstateAI — Équipe : DIALLO, ASBANE, HARIGA, EZZAYYOUNI, ZARABA*
