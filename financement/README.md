# financement — moteur de règles de financement immobilier

Deuxième fonctionnalité de RealStateAI : accompagnement au montage du dossier
de prêt.

## Principe

**Le moteur calcule, l'agent explique.**

Tous les montants produits ici proviennent de règles déterministes fondées sur
la réglementation en vigueur. Aucun modèle de langage n'intervient dans un
calcul : chaque résultat est reproductible et vérifiable à la main.

L'agent conversationnel (étape 3) appellera ces fonctions comme des outils.
Il ne recalculera jamais rien lui-même.

## Ce que le moteur produit

- **Capacité d'emprunt** au sens de la norme HCSF
- **Budget maximum** : prix de bien atteignable, frais compris
- **Plan de financement** détaillé poste par poste
- **Conformité réglementaire** : taux d'effort, durée, reste à vivre
- **Score du dossier** sur 100, avec ses composantes

## Base réglementaire

| Règle | Valeur | Source |
|---|---|---|
| Taux d'endettement maximal | 35 %, assurance comprise | HCSF, contraignant depuis le 01/01/2022, confirmé en mars 2026 |
| Durée maximale | 25 ans, 27 en VEFA ou travaux ≥ 10 % | HCSF |
| Marge de dérogation | 20 % de la production trimestrielle | HCSF |
| DMTO ancien | 6,32 % (5,81 % primo-accédants) | Loi de finances 2025, hausse votée par 89 départements jusqu'en avril 2028 |
| DMTO neuf (VEFA) | 0,715 % | Taxe de publicité foncière |
| Émoluments notaire | Barème dégressif par tranches | Arrêté tarifaire |

Tous ces paramètres sont dans `config/bareme.yaml`, aucun n'est codé en dur.

## Ce que le moteur ne fait PAS, volontairement

**Il ne note pas les banques et n'affiche pas de taux d'établissement.**
Aucune banque ne publie ses grilles d'octroi ni ses taux réels, qui se
négocient au cas par cas. Produire « Banque X : 3,12 %, score 87 % » serait
une invention indéfendable.

Le moteur évalue donc **la solidité du dossier**, à partir de critères
objectivables et de données fournies par l'utilisateur. Les taux figurant dans
`hypotheses_marche` sont explicitement des hypothèses paramétrables, jamais
présentées comme des offres.

## Installation

```bash
python -m venv .venv
.venv/bin/pip install -e "financement[dev]"     # Windows : .venv\Scripts\pip
```

## Utilisation

```bash
python demo.py                    # démonstration complète, sans API
python -m pytest tests -v         # 19 tests
```

```python
from realstate_financement.modeles import ProfilEmprunteur, Projet
from realstate_financement.moteur import analyser_projet

profil = ProfilEmprunteur(revenus_nets_mensuels=4200, apport=45_000,
                          charges_credits_mensuelles=250, nb_adultes=2,
                          nb_enfants=1, loyer_actuel=1100, primo_accedant=True)

analyse = analyser_projet(profil, Projet(prix_bien=260_000, departement="93"))
print(analyse["taux_endettement"], analyse["conformite_hcsf"]["conforme_hcsf"])
```

## Structure

```
financement/
├── config/bareme.yaml        # TOUS les paramètres réglementaires
├── src/realstate_financement/
│   ├── config.py             # chargement du barème
│   ├── modeles.py            # ProfilEmprunteur, Projet
│   ├── pret.py               # mensualité, capacité, coût du crédit
│   ├── frais.py              # DMTO, émoluments, garantie
│   ├── hcsf.py               # conformité réglementaire
│   ├── scoring.py            # solidité du dossier
│   └── moteur.py             # orchestration
├── tests/                    # 19 tests
└── demo.py
```

## Outils exposés au modèle

Le module `outils.py` expose six fonctions au format standard OpenAI,
également accepté par xAI, Groq, Mistral et OpenRouter :

| Outil | Usage |
|---|---|
| `calculer_capacite_emprunt` | « combien puis-je emprunter ? » |
| `calculer_budget_maximum` | « quel bien puis-je viser ? » |
| `analyser_projet` | « ce bien à 260 000 €, c'est jouable ? » |
| `estimer_frais_acquisition` | « combien de frais de notaire ? » |
| `comparer_durees` | « et sur 20 ans au lieu de 25 ? » |
| `lister_pieces_justificatives` | « quels documents préparer ? » |
| `verifier_dossier` | check-list de collecte, appelé AVANT tout calcul |
| `construire_plan_budget` | « que me restera-t-il pour vivre ? » |

Cette couche ne dépend d'aucune bibliothèque de LLM : elle se teste seule.

```bash
python demo_outils.py      # simule les appels du modèle, sans consommer d'API
```

Les erreurs ne sont jamais levées en exception : elles reviennent au modèle
sous forme de dictionnaire, pour qu'il puisse demander l'information manquante
plutôt que de faire tomber la conversation.

## Agent conversationnel

```bash
python chat.py            # conversation
python chat.py --trace    # affiche les appels d'outils, utile en démonstration
```

Boucle de function calling classique : l'agent envoie l'historique et les
schémas d'outils, exécute ceux que le modèle demande, lui renvoie les
résultats, et recommence jusqu'à obtenir une réponse en texte. Un garde-fou
limite à 6 allers-retours par message.

Le client est **injectable**, ce qui permet de tester toute la boucle avec un
faux modèle — sans clé, sans crédits, et donc en intégration continue.

`--trace` affiche chaque appel d'outil en direct. C'est l'option à utiliser
devant un jury : elle rend visible le fait que l'agent ne calcule rien
lui-même.

## Configuration de l'agent

Copier `.env.example` en `.env` et y placer la clé. **Ne jamais mettre une clé
dans le code** : un secret commité reste dans l'historique Git même après
suppression.

## Avertissement

Ces calculs sont des simulations à visée pédagogique. Ils ne constituent ni
un conseil en financement ni une offre de prêt. Seul un établissement de
crédit peut se prononcer sur un dossier.
