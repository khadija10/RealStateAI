"""
Vérification du dossier de prêt — sans clé ni appel API.

Génère un dossier complet sur un profil réaliste, affiche son résumé, ses
sections, ses leviers chiffrés, et l'écrit sur disque en JSON pour inspection.

Usage, depuis C:\\realstate\\financement :
    ..\\.venv\\Scripts\\python.exe verif_dossier.py
"""

from __future__ import annotations

import json
from pathlib import Path

from realstate_financement.dossier import generer_dossier, resumer_dossier
from realstate_financement.modeles import ProfilEmprunteur, Projet


def euro(montant: float) -> str:
    return f"{montant:,.0f} €".replace(",", " ")


def titre(texte: str) -> None:
    print("\n" + "=" * 74)
    print(texte)
    print("=" * 74)


profil = ProfilEmprunteur(
    revenus_nets_mensuels=4200,
    apport=45_000,
    charges_credits_mensuelles=250,
    situation_professionnelle="CDI",
    nb_adultes=2,
    nb_enfants=1,
    loyer_actuel=1100,
    primo_accedant=True,
)
projet = Projet(prix_bien=250_000, departement="94", duree_souhaitee_annees=25)

dossier = generer_dossier(profil, projet, charges_logement_previsionnelles=250)

titre("1. RÉSUMÉ DU DOSSIER")
print(resumer_dossier(dossier))

titre("2. SECTIONS DU JSON")
for nom, contenu in dossier.items():
    taille = len(contenu) if isinstance(contenu, (dict, list)) else 1
    print(f"  {nom:<24} {taille:>3} entrées")

titre("3. PLAN DE FINANCEMENT")
pf = dossier["plan_financement"]
print(f"  Prix du bien                  {euro(pf['prix_bien']):>14}")
print(f"  Frais d'acquisition           {euro(pf['frais_acquisition']):>14}")
print(f"  Frais de crédit               {euro(pf['frais_credit']):>14}")
print(f"  {'-' * 44}")
print(f"  Coût total de l'opération     {euro(pf['cout_total_operation']):>14}")
print(f"  Apport personnel            - {euro(pf['apport']):>14}")
print(f"  Montant emprunté              {euro(pf['montant_emprunte']):>14}")

print("\n  Détail des frais d'acquisition :")
fa = pf["detail_frais_acquisition"]
print(f"    Droits de mutation ({fa['taux_droits_mutation']:.3%})  "
      f"{euro(fa['droits_mutation']):>12}")
print(f"    Émoluments du notaire            {euro(fa['emoluments_notaire_ttc']):>12}")
print(f"    Sécurité immobilière             "
      f"{euro(fa['contribution_securite_immobiliere']):>12}")
print(f"    Débours                          {euro(fa['debours']):>12}")
print(f"    Part revenant au notaire : {fa['part_revenant_au_notaire']:.0%} du total")

titre("4. CONFORMITÉ RÉGLEMENTAIRE")
cf = dossier["conformite_hcsf"]
te = cf["criteres"]["taux_endettement"]
print(f"  Taux d'endettement   {te['valeur']:.2%}  (plafond {te['plafond']:.0%})"
      f"  {'conforme' if te['conforme'] else 'DÉPASSÉ'}")
du = cf["criteres"]["duree"]
print(f"  Durée                {du['valeur']} ans  (maximum {du['plafond']} ans)"
      f"  {'conforme' if du['conforme'] else 'DÉPASSÉ'}")
rav = dossier["reste_a_vivre"]
print(f"  Reste à vivre        {euro(rav['reste_a_vivre'])}  "
      f"(minimum {euro(rav['minimum_requis'])})"
      f"  {'conforme' if rav['conforme'] else 'INSUFFISANT'}")
for alerte in cf["alertes"]:
    print(f"  ! {alerte}")

titre("5. SCORE DU DOSSIER")
sc = dossier["score_dossier"]
print(f"  {sc['score_sur_100']} / 100 — {sc['appreciation']}\n")
for critere, points in sc["detail_points"].items():
    print(f"    {critere:<30} {points:>5} pts")
print(f"\n  À améliorer en priorité : {', '.join(sc['points_a_ameliorer'])}")

titre("6. LEVIERS D'AMÉLIORATION — chiffrés par le moteur")
for levier in dossier["synthese"]["leviers"]:
    print(f"\n  {levier['description']}")
    print(f"    Gain de capacité : + {euro(levier['gain_capacite_emprunt'])}")
    if "surcout_total_credit" in levier:
        print(f"    Surcoût du crédit : {euro(levier['surcout_total_credit'])}")
    print(f"    Contrepartie : {levier['contrepartie']}")

titre("7. BUDGET PRÉVISIONNEL")
bu = dossier["budget_previsionnel"]
print(f"  Unités de consommation : {bu['unites_consommation']} "
      f"— niveau de vie {bu['niveau_de_vie']}")
print(f"  Disponible après engagements : {euro(bu['disponible_apres_engagements'])}\n")
for poste in bu["repartition_indicative"][:5]:
    print(f"    {poste['poste']:<30} {euro(poste['montant_indicatif']):>10}")
print(f"\n  Épargne de précaution conseillée : "
      f"{euro(bu['epargne_precaution_recommandee'])}")

titre("8. PIÈCES JUSTIFICATIVES")
pj = dossier["pieces_justificatives"]
print(f"  {pj['nombre_de_pieces']} documents pour un profil "
      f"{pj['situation']} :\n")
for piece in pj["pieces"]:
    print(f"    - {piece}")

titre("9. SYNTHÈSE")
sy = dossier["synthese"]
print(f"  Décision indicative : {sy['decision_indicative']}\n")
if sy["points_forts"]:
    print("  Points forts :")
    for point in sy["points_forts"]:
        print(f"    + {point}")
if sy["points_de_vigilance"]:
    print("\n  Points de vigilance :")
    for point in sy["points_de_vigilance"]:
        print(f"    ! {point}")

sortie = Path("dossier_exemple.json")
sortie.write_text(json.dumps(dossier, indent=2, ensure_ascii=False),
                  encoding="utf-8")

titre("FICHIER ÉCRIT")
print(f"  {sortie.resolve()}")
print(f"  {sortie.stat().st_size / 1024:.1f} Ko")
print("\n  C'est ce JSON que le backend recevra et stockera.")
print("  Ouvre-le pour voir la structure complète.\n")
