"""
Démonstration de la couche d'outils — SANS appel à l'API.

On simule ici ce que le modèle enverra : un nom d'outil et des arguments en
JSON. Cela permet de valider toute la mécanique avant de brancher l'agent, et
de ne pas consommer de crédits pour déboguer un schéma.

Usage :
    python demo_outils.py
"""

from __future__ import annotations

import json

from realstate_financement.outils import OUTILS, executer_outil

# Ce que le modèle produirait pour ces demandes utilisateur.
SCENARIOS = [
    (
        "On gagne 4200 net à deux, on a 45 000 d'apport et un crédit auto de 250. "
        "Combien on peut emprunter ?",
        "calculer_capacite_emprunt",
        {"revenus_nets_mensuels": 4200, "apport": 45000,
         "charges_credits_mensuelles": 250, "duree_annees": 25},
    ),
    (
        "Quel budget max pour un appart dans le 93 ? C'est notre premier achat.",
        "calculer_budget_maximum",
        {"revenus_nets_mensuels": 4200, "apport": 45000,
         "charges_credits_mensuelles": 250, "departement": "93",
         "primo_accedant": True, "duree_annees": 25},
    ),
    (
        "On a trouvé un T3 à 260 000 à Montreuil, c'est jouable ?",
        "analyser_projet",
        {"revenus_nets_mensuels": 4200, "apport": 45000,
         "charges_credits_mensuelles": 250, "prix_bien": 260000,
         "departement": "93", "primo_accedant": True, "nb_adultes": 2,
         "nb_enfants": 1, "loyer_actuel": 1100, "duree_annees": 25},
    ),
    (
        "Et si on empruntait sur 20 ans au lieu de 25 ?",
        "comparer_durees",
        {"revenus_nets_mensuels": 4200, "charges_credits_mensuelles": 250,
         "durees": [20, 25]},
    ),
    (
        "Quels documents je dois préparer ? Je suis indépendant.",
        "lister_pieces_justificatives",
        {"situation_professionnelle": "independant", "primo_accedant": True},
    ),
]


def apercu(resultat: dict, profondeur: int = 0) -> str:
    """Affichage compact : on ne déroule pas les dictionnaires imbriqués."""
    lignes = []
    for cle, valeur in resultat.items():
        if isinstance(valeur, dict):
            lignes.append(f"    {cle} : {{...}}")
        elif isinstance(valeur, list):
            lignes.append(f"    {cle} : {len(valeur)} éléments")
        else:
            lignes.append(f"    {cle} : {valeur}")
    return "\n".join(lignes[:9])


print("=" * 76)
print(f"{len(OUTILS)} OUTILS EXPOSÉS AU MODÈLE")
print("=" * 76)
for outil in OUTILS:
    f = outil["function"]
    requis = ", ".join(f["parameters"]["required"])
    print(f"  {f['name']:<32} requis : {requis}")

for question, nom_outil, arguments in SCENARIOS:
    print("\n" + "=" * 76)
    print(f"UTILISATEUR : {question}")
    print(f"-> le modèle appelle : {nom_outil}")
    resultat = executer_outil(nom_outil, json.dumps(arguments))
    print("-> résultat renvoyé au modèle :")
    print(apercu(resultat))

print("\n" + "=" * 76)
print("GESTION D'ERREUR — le modèle oublie un argument obligatoire")
print("=" * 76)
print(executer_outil("analyser_projet", '{"revenus_nets_mensuels": 4000}'))
print("\nL'erreur revient au modèle, qui peut demander l'information manquante")
print("à l'utilisateur au lieu de faire planter la conversation.\n")
