"""
Tests de la couche d'outils.

On vérifie que les schémas sont exploitables par un modèle et que le
dispatcher se comporte correctement, y compris en cas d'appel malformé.
Un outil qui plante fait tomber toute la conversation : les erreurs doivent
donc revenir au modèle, jamais remonter en exception.
"""

from __future__ import annotations

import json

from realstate_financement.outils import IMPLEMENTATIONS, OUTILS, executer_outil


def test_chaque_schema_a_son_implementation():
    noms_schemas = {o["function"]["name"] for o in OUTILS}
    assert noms_schemas == set(IMPLEMENTATIONS)


def test_schemas_bien_formes():
    """Format attendu par les API OpenAI, xAI, Groq et Mistral."""
    for outil in OUTILS:
        fonction = outil["function"]
        assert outil["type"] == "function"
        assert fonction["description"]
        params = fonction["parameters"]
        assert params["type"] == "object"
        # Tout champ requis doit être décrit dans les propriétés.
        for requis in params["required"]:
            assert requis in params["properties"], f"{fonction['name']} : {requis}"
        # Toute propriété doit avoir un type et une description.
        for nom, prop in params["properties"].items():
            assert "type" in prop, f"{fonction['name']}.{nom}"
            assert prop.get("description") or prop.get("enum"), f"{fonction['name']}.{nom}"


def test_schemas_serialisables_en_json():
    """Ils transitent par le réseau : ils doivent être sérialisables."""
    assert json.loads(json.dumps(OUTILS)) == OUTILS


def test_appel_avec_arguments_json():
    """Le modèle envoie ses arguments sous forme de chaîne JSON."""
    resultat = executer_outil(
        "calculer_capacite_emprunt",
        '{"revenus_nets_mensuels": 4000, "apport": 30000, "duree_annees": 20}',
    )
    assert resultat["capital_empruntable"] > 0
    assert resultat["duree_annees"] == 20


def test_outil_inconnu_renvoie_une_erreur_exploitable():
    resultat = executer_outil("calculer_le_bonheur", "{}")
    assert "erreur" in resultat
    assert "outils_disponibles" in resultat


def test_json_invalide_ne_leve_pas_d_exception():
    resultat = executer_outil("calculer_capacite_emprunt", "{ceci n'est pas du json")
    assert "erreur" in resultat


def test_argument_obligatoire_manquant_renvoie_une_erreur():
    """analyser_projet sans prix_bien : le modèle doit pouvoir se rattraper."""
    resultat = executer_outil(
        "analyser_projet",
        '{"revenus_nets_mensuels": 4000, "departement": "75"}',
    )
    assert "erreur" in resultat
    assert "conseil" in resultat


def test_comparer_durees_chiffre_l_arbitrage():
    resultat = executer_outil(
        "comparer_durees",
        '{"revenus_nets_mensuels": 4200, "durees": [15, 25]}',
    )
    arbitrage = resultat["arbitrage_court_vs_long"]
    # Allonger la durée augmente le budget ET le coût du crédit.
    assert arbitrage["budget_supplementaire"] > 0
    assert arbitrage["surcout_credit"] > 0


def test_pieces_justificatives_adaptees_a_la_situation():
    salarie = executer_outil("lister_pieces_justificatives",
                             '{"situation_professionnelle": "CDI"}')
    independant = executer_outil("lister_pieces_justificatives",
                                 '{"situation_professionnelle": "independant"}')
    assert salarie["pieces"] != independant["pieces"]
    assert any("bilan" in p.lower() for p in independant["pieces"])


def test_frais_neuf_bien_inferieurs_a_l_ancien():
    ancien = executer_outil("estimer_frais_acquisition",
                            '{"prix_bien": 300000, "departement": "93"}')
    neuf = executer_outil("estimer_frais_acquisition",
                          '{"prix_bien": 300000, "departement": "93", "type_bien": "neuf"}')
    assert neuf["total_frais_acquisition"] < ancien["total_frais_acquisition"] / 2


def test_departement_invente_est_refuse():
    """
    Cas observé en conditions réelles : le modèle remplit le champ obligatoire
    avec "inconnu" au lieu de poser la question.
    """
    for valeur in ("inconnu", "France", "IDF", "", "7"):
        resultat = executer_outil(
            "calculer_budget_maximum",
            f'{{"revenus_nets_mensuels": 3200, "departement": "{valeur}"}}',
        )
        assert "erreur" in resultat, f"{valeur!r} aurait dû être refusé"
        assert "demande" in resultat["erreur"].lower()


def test_departements_valides_acceptes():
    for valeur in ("75", "93", "2A", "971"):
        resultat = executer_outil(
            "estimer_frais_acquisition",
            f'{{"prix_bien": 250000, "departement": "{valeur}"}}',
        )
        assert "erreur" not in resultat, f"{valeur!r} aurait dû être accepté"


def test_taux_assurance_renvoye_explicitement():
    """Sans ce champ, le modèle le déduit par division et publie un taux faux."""
    resultat = executer_outil("calculer_capacite_emprunt",
                              '{"revenus_nets_mensuels": 4000}')
    assert resultat["detail_credit"]["taux_assurance_applique"] > 0


def test_taux_endettement_inclut_les_credits_en_cours():
    """
    Cas observé en réel : le modèle recalculait le taux en oubliant le prêt
    étudiant et annonçait 20,7 % au lieu de 35 %.
    """
    resultat = executer_outil(
        "calculer_capacite_emprunt",
        '{"revenus_nets_mensuels": 3500, "charges_credits_mensuelles": 500}',
    )
    assert resultat["taux_endettement_resultant"] == 0.35
    assert resultat["charges_credits_prises_en_compte"] == 500


def test_derogation_est_auto_explicative():
    """
    Cas observé en réel : recevant le nombre nu 0.20, le modèle l'a présenté
    comme "2 points d'endettement supplémentaires", ce qui est faux. La valeur
    doit donc voyager avec son sens.
    """
    resultat = executer_outil("calculer_capacite_emprunt",
                              '{"revenus_nets_mensuels": 3500}')
    derogation = resultat["derogation_hcsf"]
    assert derogation["part_des_dossiers_pouvant_deroger"] == 0.20
    assert "quota" in derogation["signification"].lower()
    assert "a_ne_pas_dire" in derogation
    assert resultat["plafond_hcsf"] == 0.35


def test_champs_sensibles_declares_obligatoires():
    """
    apport et crédits en cours changent matériellement le résultat : les
    rendre obligatoires force le modèle à les collecter au lieu de les
    remplir silencieusement à zéro.
    """
    for nom in ("calculer_capacite_emprunt", "calculer_budget_maximum",
                "analyser_projet"):
        schema = next(o for o in OUTILS if o["function"]["name"] == nom)
        requis = schema["function"]["parameters"]["required"]
        assert "apport" in requis, nom
        assert "charges_credits_mensuelles" in requis, nom


def test_hypotheses_signalees_au_modele():
    """Sans apport fourni, l'outil doit le signaler comme supposé."""
    resultat = executer_outil("calculer_capacite_emprunt",
                              '{"revenus_nets_mensuels": 3500}')
    assert "apport" in resultat["hypotheses_appliquees"]


def test_situation_professionnelle_signalee_si_non_fournie():
    """Cas observé : le modèle affirmait un CDI que la personne n'avait pas dit."""
    resultat = executer_outil(
        "analyser_projet",
        '{"revenus_nets_mensuels": 3500, "prix_bien": 250000, "departement": "94"}',
    )
    assert "situation_professionnelle" in resultat["hypotheses_appliquees"]


def test_aucune_hypothese_si_tout_est_fourni():
    resultat = executer_outil(
        "calculer_capacite_emprunt",
        '{"revenus_nets_mensuels": 3500, "apport": 20000, '
        '"charges_credits_mensuelles": 500, "autres_revenus_mensuels": 0}',
    )
    assert resultat["hypotheses_appliquees"] == {}
