"""
Démonstration du moteur de financement — aucune API requise.

Trois scénarios qui montrent ce que le moteur sait produire, et surtout ce
qu'il refuse de laisser passer.

Usage :
    python demo.py
"""

from __future__ import annotations

from realstate_financement.modeles import ProfilEmprunteur, Projet
from realstate_financement.moteur import analyser_projet, budget_maximum, calculer_capacite


def euro(montant: float) -> str:
    return f"{montant:,.0f} €".replace(",", " ")


def titre(texte: str) -> None:
    print("\n" + "=" * 72)
    print(texte)
    print("=" * 72)


# --- Profil de démonstration ------------------------------------------------
couple = ProfilEmprunteur(
    revenus_nets_mensuels=4200,
    apport=45_000,
    charges_credits_mensuelles=250,      # un crédit auto en cours
    situation_professionnelle="CDI",
    nb_adultes=2,
    nb_enfants=1,
    loyer_actuel=1100,
    primo_accedant=True,
)

titre("1. CAPACITÉ D'EMPRUNT")
for duree in (20, 22, 25):
    c = calculer_capacite(couple, duree)
    print(f"  sur {duree} ans (taux {c['taux_nominal_retenu']:.2%}) : "
          f"{euro(c['capital_empruntable']):>12} empruntables, "
          f"mensualité max {euro(c['mensualite_maximale'])}, "
          f"coût du crédit {euro(c['detail_credit']['cout_total_credit'])}")
print("\n  Lecture : allonger la durée augmente le budget MAIS renchérit le crédit.")
print("  C'est l'arbitrage que l'agent devra expliquer à l'utilisateur.")

titre("2. BUDGET MAXIMUM (Seine-Saint-Denis, ancien, primo-accédant)")
b = budget_maximum(couple, departement="93", duree_annees=25)
print(f"  Prix de bien maximum      : {euro(b['prix_bien_maximum'])}")
print(f"  Frais d'acquisition       : {euro(b['frais_acquisition']['total_frais_acquisition'])}"
      f"  ({b['frais_acquisition']['part_du_prix']:.2%} du prix, "
      f"DMTO {b['frais_acquisition']['taux_droits_mutation']:.3%})")
print(f"  Frais de crédit           : {euro(b['frais_credit']['total_frais_credit'])}")
print(f"  Apport mobilisé           : {euro(b['apport_mobilise'])}")
print(f"  Montant à emprunter       : {euro(b['montant_a_emprunter'])}")

titre("3. ANALYSE D'UN PROJET IDENTIFIÉ — appartement à 260 000 €")
a = analyser_projet(couple, Projet(prix_bien=260_000, departement="93",
                                   duree_souhaitee_annees=25))
pf, cr = a["plan_financement"], a["credit"]
print("  PLAN DE FINANCEMENT")
print(f"    Prix du bien            : {euro(pf['prix_bien'])}")
print(f"    Frais d'acquisition     : {euro(pf['frais_acquisition'])}")
print(f"    Frais de crédit         : {euro(pf['frais_credit'])}")
print(f"    Coût total opération    : {euro(pf['cout_total_operation'])}")
print(f"    Apport                  : - {euro(pf['apport'])}")
print(f"    Montant emprunté        : {euro(pf['montant_emprunte'])}")
print("\n  CRÉDIT")
print(f"    Mensualité (assurance comprise) : {euro(cr['mensualite_totale'])}")
print(f"      dont crédit {euro(cr['mensualite_credit'])} "
      f"et assurance {euro(cr['mensualite_assurance'])}")
print(f"    Intérêts totaux         : {euro(cr['total_interets'])}")
print(f"    Coût total du crédit    : {euro(cr['cout_total_credit'])}")
print("\n  CONFORMITÉ HCSF")
print(f"    Taux d'endettement      : {a['taux_endettement']:.2%}  (plafond 35 %)")
print(f"    Reste à vivre           : {euro(a['reste_a_vivre']['reste_a_vivre'])} "
      f"(minimum estimé {euro(a['reste_a_vivre']['minimum_requis'])})")
print(f"    Conforme                : {'OUI' if a['conformite_hcsf']['conforme_hcsf'] else 'NON'}")
for alerte in a["conformite_hcsf"]["alertes"]:
    print(f"    ! {alerte}")
print("\n  SCORE DU DOSSIER")
s = a["score_dossier"]
print(f"    {s['score_sur_100']} / 100  —  {s['appreciation']}")
for critere, points in s["detail_points"].items():
    print(f"      {critere:<28} {points:>5} pts")
print(f"    À améliorer en priorité : {', '.join(s['points_a_ameliorer'])}")
for v in a["points_de_vigilance"]:
    print(f"    ! {v}")

titre("4. CONTRE-EXEMPLE — le moteur refuse de rassurer à tort")
fragile = ProfilEmprunteur(revenus_nets_mensuels=2300, apport=8_000,
                           situation_professionnelle="CDD", nb_adultes=1)
f = analyser_projet(fragile, Projet(prix_bien=380_000, departement="75"))
print(f"  Taux d'endettement : {f['taux_endettement']:.1%}")
print(f"  Score              : {f['score_dossier']['score_sur_100']} / 100 "
      f"— {f['score_dossier']['appreciation']}")
for alerte in f["conformite_hcsf"]["alertes"]:
    print(f"  ! {alerte}")
print("\n  Aucun montant n'a été inventé : tout provient du barème réglementaire.\n")
