# Module financement — guide d'intégration

Fonctionnalité d'accompagnement au montage de dossier de prêt immobilier.

Destiné à **Akram** (backend) et **Yougarthen** (frontend).

Le module est une **bibliothèque Python**, pas un service HTTP : la couche web
relève du backend. Tout ce qui suit décrit ce qu'il fournit et comment
l'appeler.

> **Si vous faites lire ce document à un assistant IA**, précisez-lui bien :
> *« voici une bibliothèque existante et testée, que je dois exposer en HTTP.
> Je ne la modifie pas, je l'appelle. »* Sans cette consigne, un modèle
> propose spontanément de réécrire ou d'étendre le module — ce qui ferait
> diverger les calculs du reste du projet.

---

## Démarrage rapide

```bash
pip install -e "financement[agent]"
pytest financement/tests -q            # 73 tests, aucune clé requise
```

```python
from realstate_financement.modeles import ProfilEmprunteur, Projet
from realstate_financement.dossier import generer_dossier

profil = ProfilEmprunteur(revenus_nets_mensuels=4200, apport=45_000,
                          charges_credits_mensuelles=250, nb_adultes=2,
                          nb_enfants=1, loyer_actuel=1100, primo_accedant=True)
projet = Projet(prix_bien=250_000, departement="94")

dossier = generer_dossier(profil, projet, charges_logement_previsionnelles=250)
```

`dossier` est un dictionnaire directement sérialisable en JSON. C'est le
livrable de la fonctionnalité.

---

# Pour essayer le module — sans rien intégrer

Cette partie s'adresse à quiconque veut simplement voir ce que fait le module.

## 1. Installation

```bash
git clone <le-depot> && cd RealStateAI
python -m venv .venv
```

Activation de l'environnement :

```bash
.venv\Scripts\activate          # Windows
source .venv/bin/activate        # macOS, Linux
```

```bash
pip install -e "financement[dev,agent]"
pytest financement/tests -q
```

73 tests doivent passer. À ce stade, **aucune clé API n'est nécessaire.**

## 2. Ce qui marche sans clé

Le moteur de calcul est entièrement déterministe : il tourne hors ligne.

```bash
cd financement
python demo.py             # capacité, budget maximum, analyse d'un projet
python demo_outils.py      # simule les appels du modèle aux outils
python verif_dossier.py    # génère un dossier complet + dossier_exemple.json
```

`verif_dossier.py` est le plus parlant : il affiche le plan de financement,
la conformité réglementaire, le score, les leviers chiffrés et les pièces à
réunir, puis écrit le JSON sur disque.

Pour changer le profil testé, éditer les variables `profil` et `projet` en
tête du fichier.

## 3. Ce qui demande une clé

Seul l'agent conversationnel appelle un modèle de langage. Il faut donc une
clé, et il en existe des gratuites.

**Mistral** — offre gratuite généreuse. Créer un compte sur
`console.mistral.ai`, vérifier son numéro de téléphone, puis « API Keys » →
« Create new key ». Le plan gratuit implique que les données servent à
l'entraînement : à savoir, sans conséquence pour un projet d'école.

**Groq** — gratuit, sans carte bancaire ni vérification. Compte sur
`console.groq.com`, puis « API Keys ».

Attention à ne pas confondre **Groq** (gratuit) et **Grok / xAI** (payant).

## 4. Configurer la clé

```bash
cp financement/.env.example financement/.env      # copy sous Windows
```

Puis éditer `financement/.env` :

```
LLM_API_KEY=votre_cle
LLM_BASE_URL=https://api.mistral.ai/v1
LLM_MODEL=mistral-small-latest
```

Vérifier que la clé donne accès au modèle :

```bash
python lister_modeles.py
```

Si le modèle configuré n'apparaît pas dans la liste, en choisir un autre parmi
ceux affichés. Les catalogues changent souvent.

**Ne jamais mettre la clé dans `.env.example`** : ce fichier est versionné.
Le `.env`, lui, est ignoré par Git.

## 5. Lancer l'agent

```bash
python chat.py --trace
```

Exemple de première phrase :

> on gagne 4200 net à deux, 45 000 d'apport, on vise un T3 dans le 94

L'option `--trace` affiche chaque appel d'outil :

```
  [outil] calculer_budget_maximum({"revenus_nets_mensuels": 4200, ...})
```

**C'est le contrôle à faire** : un montant qui apparaît sans ligne `[outil]`
juste avant a été inventé par le modèle. Cela arrive avec les petits modèles ;
si le cas se présente, prendre un modèle plus capable.

Commandes pendant la conversation : `/outils` liste les appels effectués,
`/reset` repart de zéro, `/quitter` termine.

---

## Arborescence

```
financement/
├── config/bareme.yaml              TOUS les paramètres réglementaires
├── src/realstate_financement/
│   ├── config.py                   chargement du barème
│   ├── modeles.py                  ProfilEmprunteur, Projet
│   ├── pret.py                     mensualité, capacité, coût du crédit
│   ├── frais.py                    DMTO, émoluments, garantie
│   ├── hcsf.py                     conformité réglementaire
│   ├── budget.py                   reste à vivre par poste
│   ├── scoring.py                  solidité du dossier
│   ├── moteur.py                   orchestration des calculs
│   ├── dossier.py                  génération du dossier JSON
│   ├── outils.py                   9 outils exposés au modèle
│   └── agent.py                    boucle de function calling
├── tests/                          73 tests
├── demo.py  demo_outils.py  verif_dossier.py  chat.py  lister_modeles.py
└── .env.example
```

Les imports se font toujours depuis `realstate_financement` :

```python
from realstate_financement.modeles import ProfilEmprunteur, Projet
from realstate_financement.moteur import analyser_projet
from realstate_financement.dossier import generer_dossier
from realstate_financement.agent import Agent
from realstate_financement.outils import OUTILS, executer_outil
```

---

## Structures d'entrée

### `ProfilEmprunteur`

| Champ | Type | Défaut | Description |
|---|---|---|---|
| `revenus_nets_mensuels` | float | — | **Obligatoire.** Revenus nets du foyer, tous emprunteurs confondus |
| `apport` | float | 0.0 | Apport personnel |
| `charges_credits_mensuelles` | float | 0.0 | Mensualités de crédits en cours |
| `autres_revenus_mensuels` | float | 0.0 | Loyers, pensions — retenus à 70 % |
| `situation_professionnelle` | str | `"CDI"` | `CDI`, `fonctionnaire`, `CDD`, `independant`, `interim`, `chomage` |
| `nb_adultes` | int | 1 | Adultes du foyer |
| `nb_enfants` | int | 0 | Enfants à charge |
| `loyer_actuel` | float | 0.0 | Loyer payé aujourd'hui — mesure le saut de charge |
| `primo_accedant` | bool | False | Ouvre droit au taux réduit de droits de mutation |

Propriété calculée : `revenus_totaux` = revenus nets + 70 % des autres revenus.

### `Projet`

| Champ | Type | Défaut | Description |
|---|---|---|---|
| `prix_bien` | float | — | **Obligatoire.** Prix du bien |
| `departement` | str | `"75"` | Code sur 2 caractères : `"75"`, `"94"`, `"2A"`, `"971"` |
| `type_bien` | str | `"ancien"` | `ancien` ou `neuf` — les frais diffèrent d'un facteur 8 |
| `montant_travaux` | float | 0.0 | Au-delà de 10 % de l'opération, la durée maximale passe à 27 ans |
| `duree_souhaitee_annees` | int | 25 | Durée du prêt |
| `type_garantie` | str | `"caution"` | `caution` ou `hypotheque` |

Propriétés calculées : `cout_operation`, `part_travaux`.

**Les valeurs par défaut sont des commodités de calcul, pas des hypothèses
acceptables.** Un dossier produit sans avoir demandé la situation
professionnelle ou l'apport repose sur des suppositions : l'outil
`verifier_dossier` existe précisément pour éviter cela.

---

## Principe à retenir

> **Le moteur calcule. L'agent explique. Aucun montant ne sort d'un modèle
> de langage.**

Toutes les valeurs proviennent de fonctions déterministes fondées sur la
réglementation : HCSF, barèmes DMTO, émoluments notariaux, coefficients INSEE.
Le modèle choisit quel outil appeler et commente le résultat ; il ne calcule
jamais.

Conséquence pratique : **le dossier peut être produit sans aucune IA.** Si le
fournisseur de modèle est indisponible, `generer_dossier` fonctionne toujours.

---

## Configuration

Fichier `financement/.env`, **jamais commité** (couvert par le `.gitignore`) :

```
LLM_API_KEY=...
LLM_BASE_URL=https://api.mistral.ai/v1
LLM_MODEL=mistral-small-latest
```

L'API du fournisseur est compatible OpenAI. Changer ces deux dernières lignes
suffit pour passer à un autre fournisseur, sans toucher au code :

| Fournisseur | `LLM_BASE_URL` | Modèle testé |
|---|---|---|
| Mistral | `https://api.mistral.ai/v1` | `mistral-small-latest` |
| Groq | `https://api.groq.com/openai/v1` | `openai/gpt-oss-120b` |
| xAI | `https://api.x.ai/v1` | `grok-4.6` |

Le script `lister_modeles.py` affiche les modèles auxquels une clé donne
réellement accès — utile, les catalogues changent souvent.

**La clé ne doit jamais atteindre le frontend.** Tous les appels au modèle
passent par le backend.

---

# Pour le backend

## Trois modes d'utilisation

### 1. Calculs directs — sans modèle de langage

Instantané, sans réseau, sans coût. À privilégier pour un formulaire.

```python
from realstate_financement.moteur import (
    analyser_projet, budget_maximum, calculer_capacite)

calculer_capacite(profil, duree_annees=25)
#   capital_empruntable, mensualite_maximale, enveloppe_totale,
#   taux_endettement_resultant, plafond_hcsf, derogation_hcsf

budget_maximum(profil, departement="94", duree_annees=25)
#   prix_bien_maximum, frais_acquisition, frais_credit, montant_a_emprunter

analyser_projet(profil, projet)
#   plan_financement, credit, taux_endettement, reste_a_vivre,
#   conformite_hcsf, score_dossier, points_de_vigilance
```

### 2. Dossier de prêt — le livrable

```python
from realstate_financement.dossier import generer_dossier, resumer_dossier

dossier = generer_dossier(profil, projet,
                          charges_logement_previsionnelles=250,
                          nb_enfants_moins_14=1,
                          reference_dossier="RSAI-00042")

resumer_dossier(dossier)   # version texte courte, pour un e-mail
```

**Reproductible** : deux appels sur le même profil donnent un résultat
identique, hors horodatage. C'est testé.

### 3. Agent conversationnel

```python
from realstate_financement.agent import Agent

agent = Agent()                                   # lit le .env
reponse = agent.repondre("je gagne 3200 net")     # str

agent.historique       # list[dict] — à conserver entre deux requêtes HTTP
agent.journal_outils   # outils appelés, avec leurs arguments
agent.reinitialiser()
```

## Gestion des sessions — le point d'attention

HTTP est sans mémoire ; l'agent conserve `historique` en mémoire vive. Il faut
donc une instance d'`Agent` par conversation.

```python
SESSIONS: dict[str, Agent] = {}

def repondre(session_id: str, message: str) -> dict:
    agent = SESSIONS.setdefault(session_id, Agent())
    deja = len(agent.journal_outils)
    reponse = agent.repondre(message)
    return {
        "reply": reponse,
        "outils_appeles": [a["outil"] for a in agent.journal_outils[deja:]],
    }
```

Un dictionnaire suffit pour une démonstration. En production il faudra Redis
ou une base : un dictionnaire est perdu au redémarrage et non partagé entre
plusieurs workers.

Le client est injectable — `Agent(client=..., modele=...)` — ce qui permet de
tester la couche web sans clé ni appel réseau. Voir `tests/test_agent.py` pour
un exemple de faux client.

## Gestion des erreurs

`executer_outil` **ne lève jamais d'exception** : les erreurs reviennent en
dictionnaire, ce qui permet au modèle de se rattraper.

```python
{"erreur": "Département invalide : 'inconnu'...", "conseil": "..."}
```

`agent.repondre` peut en revanche lever si le fournisseur est injoignable —
clé invalide, quota épuisé, service indisponible. À encapsuler :

```python
try:
    reponse = agent.repondre(message)
except Exception:
    return {"erreur": "Service de conversation momentanément indisponible"}
```

**Les appels au modèle prennent 2 à 15 secondes.** Prévoir un timeout généreux
et un indicateur d'attente côté interface.

## Les 9 outils du moteur

| Outil | Usage |
|---|---|
| `verifier_dossier` | check-list de collecte, renvoie la prochaine question à poser |
| `calculer_capacite_emprunt` | montant empruntable |
| `calculer_budget_maximum` | prix de bien atteignable, frais compris |
| `analyser_projet` | analyse complète d'un bien identifié |
| `estimer_frais_acquisition` | frais de notaire seuls |
| `comparer_durees` | arbitrage budget / coût du crédit |
| `construire_plan_budget` | reste à vivre réparti par poste |
| `generer_dossier_pret` | dossier complet en JSON |
| `lister_pieces_justificatives` | documents à fournir |

```python
from realstate_financement.outils import OUTILS, executer_outil

OUTILS  # schémas JSON au format OpenAI, réutilisables tels quels
executer_outil("analyser_projet", '{"revenus_nets_mensuels": 4200, ...}')
```

---

# Pour le frontend

**Aucun calcul à faire.** Chaque valeur affichée existe déjà dans le JSON.

## Structure du dossier

```json
{
  "meta": {
    "version_dossier": "1.0",
    "reference": "RSAI-20260920",
    "genere_le": "2026-09-20T14:32:11+00:00",
    "avertissement": "Ce dossier est une simulation...",
    "base_reglementaire": {
      "taux_endettement_max": 0.35,
      "duree_max_annees": 25,
      "millesime_baremes": 2026
    }
  },
  "plan_financement": {
    "prix_bien": 250000,
    "frais_acquisition": 18840.32,
    "frais_credit": 4186.08,
    "cout_total_operation": 273026.40,
    "apport": 45000,
    "montant_emprunte": 228026.40,
    "detail_frais_acquisition": { "droits_mutation": 14517.50 }
  },
  "credit": {
    "duree_annees": 25,
    "taux_nominal_retenu": 0.033,
    "mensualite_totale": 1181.85,
    "mensualite_credit": 1117.24,
    "mensualite_assurance": 64.61,
    "total_interets": 107146.12,
    "cout_total_credit": 126528.36
  },
  "score_dossier": { "score_sur_100": 64.3, "appreciation": "acceptable" },
  "synthese": {
    "decision_indicative": "conforme aux normes HCSF",
    "points_forts": ["Situation professionnelle stable (CDI)."],
    "points_de_vigilance": [],
    "leviers": [
      {
        "levier": "solder_les_credits_en_cours",
        "description": "Solder 250 € de mensualités de crédits",
        "gain_capacite_emprunt": 48235.09,
        "contrepartie": "Mobilise une partie de l'épargne disponible."
      }
    ]
  }
}
```

Les sections `emprunteur`, `projet`, `conformite_hcsf`, `reste_a_vivre`,
`budget_previsionnel` et `pieces_justificatives` complètent le document.
Exécuter `verif_dossier.py` génère un `dossier_exemple.json` complet.

## Correspondance écran / clés

| Élément d'interface | Clé |
|---|---|
| Badge de statut | `synthese.decision_indicative` |
| Mensualité | `credit.mensualite_totale` |
| Jauge d'endettement | `conformite_hcsf.criteres.taux_endettement.valeur` et `.plafond` |
| Score | `score_dossier.score_sur_100`, `.appreciation` |
| Tableau de financement | `plan_financement` |
| Détail des frais | `plan_financement.detail_frais_acquisition` |
| Cartes de leviers | `synthese.leviers` — montants déjà calculés |
| Alertes | `synthese.points_de_vigilance` |
| Liste des pièces | `pieces_justificatives.pieces` |
| Barres de budget | `budget_previsionnel.repartition_indicative` |
| Mention légale | `meta.avertissement` |

## Règles d'affichage

**Les montants sont en euros**, non arrondis. Arrondir à l'affichage, jamais
en base : la reproductibilité du dossier en dépend.

**Les taux sont des fractions** : `0.033` s'affiche `3,30 %`, `0.3409`
s'affiche `34,1 %`.

**`meta.avertissement` doit toujours être affiché.** Le dossier est une
simulation, pas une offre de prêt.

**Afficher les outils appelés** — le champ `outils_appeles` renvoyé par le
backend — est fortement recommandé. C'est ce qui montre à l'utilisateur que
les montants viennent d'un calcul et non du modèle.

**Les cases à cocher des pièces** supposent un état persistant : c'est au
backend de le stocker, ce n'est pas dans le JSON.

---

## Scripts utiles

| Script | Usage |
|---|---|
| `demo.py` | démonstration du moteur, sans API |
| `demo_outils.py` | simule les appels du modèle, sans API |
| `verif_dossier.py` | génère un dossier complet et écrit `dossier_exemple.json` |
| `chat.py --trace` | agent en ligne de commande, appels d'outils visibles |
| `lister_modeles.py` | modèles accessibles avec la clé configurée |

---

## Base réglementaire

| Règle | Valeur | Source |
|---|---|---|
| Taux d'endettement maximal | 35 %, assurance comprise | HCSF, contraignant depuis 2022, confirmé en 2026 |
| Durée maximale | 25 ans, 27 en VEFA ou travaux ≥ 10 % | HCSF |
| Marge de dérogation | 20 % de la production trimestrielle | HCSF |
| DMTO ancien | 6,32 %, 5,81 % pour les primo-accédants | Loi de finances 2025 |
| DMTO neuf | 0,715 % | Taxe de publicité foncière |
| Émoluments du notaire | barème dégressif par tranches | Arrêté tarifaire |
| Unités de consommation | échelle OCDE modifiée | INSEE |
| Structure de budget | coefficients budgétaires par niveau de vie | INSEE |

Tous ces paramètres sont dans `config/bareme.yaml`. **Aucun n'est codé en
dur** : les mettre à jour ne demande pas de toucher au code.

---

## Garanties

- **Aucun montant n'est produit par le modèle de langage.**
- **Le modèle ne peut pas combler un champ manquant** : les champs matériels
  sont obligatoires, les valeurs invalides sont rejetées, et `verifier_dossier`
  fournit la question à poser.
- **73 tests** couvrent le moteur, les outils, l'agent et le dossier. Aucun ne
  nécessite de clé API — ils tournent en intégration continue.

## Limites assumées

- Les **taux d'intérêt** sont des hypothèses paramétrables, pas des offres
  bancaires. Aucun établissement ne publie ses grilles.
- Le module **ne note pas les banques** et n'affiche aucun taux nominatif : ce
  serait une invention. Il évalue la solidité du dossier.
- Les **montants de reste à vivre** relèvent d'usages bancaires, non d'un
  texte réglementaire.
- Les **répartitions de budget** sont des moyennes INSEE, jamais des
  prescriptions. Ne jamais formuler « vous devez dépenser X ».
- Le dossier est une **simulation**, jamais un accord de principe.

---

## Erreurs fréquentes

**`ModuleNotFoundError: No module named 'realstate_financement'`**
L'installation n'a pas été faite, ou pas dans le bon environnement.
`pip install -e "financement[agent]"`.

**`Département invalide : 'inconnu'`**
Le module refuse les codes qui ne sont pas des départements français. C'est
volontaire : un modèle confronté à un champ obligatoire qu'il ne connaît pas
préfère inventer une valeur plutôt que poser la question. Transmettre un code
réel, ou appeler `verifier_dossier` pour savoir quoi demander.

**`This model is not available in your subscription tier`**
Le modèle configuré n'est pas inclus dans l'offre de la clé. Lancer
`lister_modeles.py` pour voir ce qui est réellement accessible.

**`Your team doesn't have any credits`**
Le fournisseur est payant et le compte n'a pas de crédits. Changer
`LLM_BASE_URL` et `LLM_MODEL` pour un fournisseur gratuit.

**Le modèle annonce un montant sans avoir appelé d'outil**
Il l'a inventé. Cela arrive avec les petits modèles. Vérifier avec
`chat.py --trace` : chaque chiffre doit être précédé d'une ligne `[outil]`.
Si le problème persiste, prendre un modèle plus capable.

**Le modèle remplit un champ à 0 au lieu de poser la question**
Comportement observé et traité : les champs matériels sont obligatoires dans
les schémas, et chaque résultat renvoie `hypotheses_appliquees` listant ce qui
a été supposé. Le prompt système impose de l'annoncer.

**Les montants affichés diffèrent entre deux écrans**
Un calcul a été refait quelque part. Aucune valeur ne doit être recalculée
côté backend ou frontend : tout est déjà dans le JSON.

---

Module maintenu par Skander. Chaque règle porte dans le code son commentaire
et sa justification.
