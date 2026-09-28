"""
Enrichissement par le Diagnostic de Performance Énergétique (DPE).

POURQUOI
Depuis la réforme de juillet 2021 et la loi Climat et Résilience, les
logements classés F et G — les « passoires thermiques » — sont
progressivement interdits à la location. Cela se traduit par une décote à
la vente. DVF ne contient aucune information sur la qualité du bien : le DPE
comble en partie ce manque.

SOURCE
ADEME, jeu « DPE Logements existants (depuis juillet 2021) », identifiant
`dpe03existant`, API Data Fair en accès libre, licence ouverte, limitée à
10 appels par seconde. Aucune clé requise.

MÉTHODE D'APPARIEMENT
DVF et l'ADEME ne partagent aucun identifiant commun. On rapproche donc les
deux sources par l'ADRESSE, puis par la SURFACE :

  1. Normalisation des adresses. DVF écrit « AV DE LA CELLE ST CLOUD »,
     l'ADEME « Avenue de la Celle-Saint-Cloud ». On passe les deux sous une
     forme commune : majuscules, sans accents, abréviations développées,
     articles supprimés.

  2. Jointure sur (code postal, numéro, voie normalisée).

  3. Désambiguïsation par la surface. Une adresse d'immeuble abrite de
     nombreux appartements, chacun avec son DPE. On retient celui dont la
     surface habitable s'écarte le moins de la surface vendue, dans une
     tolérance paramétrable. Sans ce second critère, on attribuerait au
     hasard le DPE du voisin.

La qualité de chaque appariement est tracée dans `dpe_qualite_appariement`,
pour que l'équipe ML puisse filtrer selon le niveau de confiance souhaité.

COUVERTURE PARTIELLE — ASSUMÉE
Les DPE au nouveau format n'existent que depuis juillet 2021, et tous les
logements vendus n'en ont pas. Une partie des ventes restera donc sans classe
individuelle. L'indicateur de zone `zone_part_dpe_fg`, calculé sur tous les
DPE du code postal, fournit un signal complémentaire pour 100 % des ventes.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import duckdb
import requests

from realstate_data.config import Settings, charger_settings
from realstate_data.logging_conf import configurer_logging

log = configurer_logging()

# Champs demandés à l'API. Tous figurent dans le schéma public de
# `dpe03existant`. Ils sont centralisés ici pour être corrigés en un seul
# endroit si l'ADEME fait évoluer son modèle de données.
CHAMPS_DPE = [
    "numero_dpe",
    "etiquette_dpe",
    "etiquette_ges",
    "surface_habitable_logement",
    "date_etablissement_dpe",
    "type_batiment",
    "annee_construction",
    "adresse_ban",
    "code_postal_ban",
    "nom_commune_ban",
]

# Abréviations employées par DVF (norme FANTOIR de la DGFiP), développées
# pour rejoindre l'écriture en toutes lettres de la Base Adresse Nationale.
# L'ordre compte : "STE" doit être traité avant "ST".
ABREVIATIONS: dict[str, str] = {
    "AV": "AVENUE", "BD": "BOULEVARD", "BLD": "BOULEVARD",
    "CHE": "CHEMIN", "CHEM": "CHEMIN", "IMP": "IMPASSE", "PL": "PLACE",
    "ALL": "ALLEE", "SQ": "SQUARE", "CRS": "COURS", "PAS": "PASSAGE",
    "PASS": "PASSAGE", "FG": "FAUBOURG", "RTE": "ROUTE", "VLA": "VILLA",
    "QU": "QUAI", "RPT": "ROND POINT", "SEN": "SENTIER", "RES": "RESIDENCE",
    "HAM": "HAMEAU", "LOT": "LOTISSEMENT", "PRV": "PARVIS", "PROM": "PROMENADE",
    "STE": "SAINTE", "ST": "SAINT",
    "GAL": "GENERAL", "MAL": "MARECHAL", "PDT": "PRESIDENT",
    "PROF": "PROFESSEUR", "DR": "DOCTEUR", "CDT": "COMMANDANT",
    "CPT": "CAPITAINE", "LT": "LIEUTENANT", "COL": "COLONEL",
}

# Mots sans valeur discriminante, qui varient souvent d'une source à l'autre
# ("RUE DE LA PAIX" contre "RUE PAIX").
MOTS_VIDES = ["DE", "DU", "DES", "LA", "LE", "LES", "L", "D", "ET", "A", "AU", "AUX"]


def macro_normalisation() -> str:
    """
    Construit la macro SQL `normaliser_voie`, appliquée aux deux sources.

    Générée à partir des constantes ci-dessus : une seule source de vérité,
    et exactement la même transformation côté DVF et côté ADEME. Sans cela,
    deux normalisations légèrement différentes empêcheraient toute jointure.
    """
    expression = "upper(strip_accents(coalesce(v, '')))"
    expression = f"regexp_replace({expression}, '[-''’.,/]', ' ', 'g')"
    for abrege, complet in ABREVIATIONS.items():
        expression = f"regexp_replace({expression}, '\\b{abrege}\\b', '{complet}', 'g')"
    motif_vides = "|".join(MOTS_VIDES)
    expression = f"regexp_replace({expression}, '\\b({motif_vides})\\b', ' ', 'g')"
    expression = f"trim(regexp_replace({expression}, '\\s+', ' ', 'g'))"
    return f"CREATE OR REPLACE MACRO normaliser_voie(v) AS {expression};"


# --- Téléchargement ---------------------------------------------------------

def _url_api(settings: Settings) -> str:
    return settings.enrichissement.get(
        "dpe_api",
        "https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines",
    )


# Certaines protections en amont des API publiques rejettent les requêtes
# sans agent déclaré. On s'identifie explicitement : c'est aussi la
# correction usuelle d'un 403 inattendu.
ENTETES = {"User-Agent": "RealStateAI-pipeline/0.1 (projet academique)",
           "Accept": "application/json"}


def diagnostic_api(settings: Settings | None = None) -> list[dict[str, Any]]:
    """
    Essaie plusieurs formes de requête et indique lesquelles l'API accepte.

    L'API a renvoyé 403 sur une requête combinant `select` et un `qs` à
    plusieurs termes, alors qu'une requête nue passait. Plutôt que de
    supposer la cause, on teste les variantes une à une : c'est la manière
    la plus rapide de trouver la forme utilisable.
    """
    settings = settings or charger_settings()
    url = _url_api(settings)
    departement = settings.departements[0]
    select = ",".join(CHAMPS_DPE)

    variantes = [
        ("nue", {"size": 1}),
        ("select seul", {"size": 1, "select": select}),
        ("qs prefixe", {"size": 1, "qs": f"code_postal_ban:{departement}*"}),
        ("select + qs prefixe",
         {"size": 1, "select": select, "qs": f"code_postal_ban:{departement}*"}),
        ("qs deux termes",
         {"size": 1, "qs": f'code_postal_ban:{departement}* AND type_batiment:"appartement"'}),
        ("filtre egalite", {"size": 1, "code_postal_ban": f"{departement}001"}),
        ("filtre egalite + select",
         {"size": 1, "select": select, "code_postal_ban": f"{departement}001"}),
        ("filtre _in",
         {"size": 1, "code_postal_ban_in": f"{departement}001,{departement}002"}),
    ]

    resultats = []
    for nom, params in variantes:
        try:
            reponse = requests.get(url, params=params, headers=ENTETES, timeout=30)
            lignes = reponse.json().get("results", []) if reponse.ok else []
            resultats.append({
                "variante": nom,
                "statut": reponse.status_code,
                "total": reponse.json().get("total") if reponse.ok else None,
                "surface_presente": bool(
                    lignes and lignes[0].get("surface_habitable_logement")),
                "message": "" if reponse.ok else reponse.text[:120],
            })
        except requests.RequestException as err:
            resultats.append({"variante": nom, "statut": "erreur",
                              "total": None, "surface_presente": False,
                              "message": str(err)[:120]})
        time.sleep(0.2)
    return resultats


def champs_du_jeu(settings: Settings) -> set[str]:
    """
    Champs déclarés au schéma du jeu de données.

    POURQUOI PAS UN ÉCHANTILLON DE LIGNES : l'API Data Fair OMET les champs
    vides de ses réponses. Un DPE d'immeuble n'a pas de surface habitable de
    logement ; conclure de son absence que le champ n'existe pas serait faux.
    Le schéma, lui, est exhaustif.
    """
    url = _url_api(settings).rsplit("/lines", 1)[0] + "/schema"
    reponse = requests.get(url, headers=ENTETES, timeout=30)
    reponse.raise_for_status()
    return {champ.get("key") for champ in reponse.json()}


def tester_api(settings: Settings | None = None) -> dict[str, Any]:
    """
    Contrôle préalable au téléchargement.

    Vérifie trois choses : que l'API répond, que les champs attendus figurent
    au schéma, et que le filtre par département fonctionne. On récupère aussi
    un logement réel du périmètre, avec sa surface, pour confirmer que la
    donnée utile est bien renseignée.
    """
    settings = settings or charger_settings()
    declares = champs_du_jeu(settings)

    total = requests.get(_url_api(settings), params={"size": 0},
                         headers=ENTETES, timeout=30).json().get("total")

    # Seule la forme `{champ}_in` filtre réellement : l'égalité simple est
    # acceptée puis ignorée, et `qs` est rejeté en 403.
    departement = settings.departements[0]
    codes = codes_postaux_du_perimetre(settings).get(departement, [])[:5]
    reponse = requests.get(_url_api(settings), params={
        "size": 3,
        "select": ",".join(sorted(set(CHAMPS_DPE) & declares)),
        "code_postal_ban_in": ",".join(codes),
    }, headers=ENTETES, timeout=60)
    reponse.raise_for_status()
    donnees = reponse.json()
    lignes = donnees.get("results", [])

    return {
        "total_dpe_france": total,
        "champs_attendus_presents": sorted(set(CHAMPS_DPE) & declares),
        "champs_attendus_absents": sorted(set(CHAMPS_DPE) - declares),
        "departement_teste": f"{departement} ({len(codes)} codes postaux)",
        "filtre_effectif": bool(donnees.get("total", 0) < (total or 0)),
        "dpe_dans_le_departement": donnees.get("total"),
        "exemple": {c: lignes[0].get(c) for c in CHAMPS_DPE} if lignes else {},
        "surface_renseignee": bool(lignes and lignes[0].get("surface_habitable_logement")),
    }


def codes_postaux_du_perimetre(settings: Settings) -> dict[str, list[str]]:
    """
    Codes postaux effectivement présents dans les ventes, par département.

    On ne télécharge que les DPE des codes postaux où l'on a des ventes :
    c'est exactement le besoin, et cela réduit fortement le volume.
    """
    chemin = settings.chemins.interim / "silver_mutations.parquet"
    if not chemin.exists():
        raise FileNotFoundError(
            f"{chemin} introuvable. Lance d'abord :\n"
            "    python -m realstate_data.pipeline silver"
        )
    lignes = duckdb.sql(f"""
        SELECT DISTINCT code_departement, CAST(code_postal AS VARCHAR) AS code_postal
        FROM read_parquet('{chemin}')
        WHERE code_postal IS NOT NULL
        ORDER BY 1, 2
    """).fetchall()
    par_departement: dict[str, list[str]] = {}
    for departement, code_postal in lignes:
        par_departement.setdefault(departement, []).append(code_postal)
    return par_departement


def _lots(valeurs: list[str], taille: int):
    for debut in range(0, len(valeurs), taille):
        yield valeurs[debut:debut + taille]


def telecharger_dpe(settings: Settings | None = None, forcer: bool = False,
                    departements: list[str] | None = None) -> dict:
    """
    Télécharge les DPE des codes postaux du périmètre, un fichier par département.

    FILTRAGE — point critique.
    L'API rejette les requêtes `qs` (403 nginx) et IGNORE SILENCIEUSEMENT les
    filtres d'égalité simples : `code_postal_ban=75001` renvoie 200 et les
    15,6 millions de DPE de France entière. Seule la forme `{champ}_in=a,b,c`
    filtre réellement.

    Un garde-fou vérifie donc que le total renvoyé est bien inférieur au total
    national : sans lui, un changement d'API ferait télécharger la France
    entière sans que personne ne s'en aperçoive.

    REPRENABLE.
    Chaque lot de codes postaux est écrit sur disque dès qu'il est terminé,
    dans son propre fichier. Une interruption ne fait donc perdre qu'un lot,
    et relancer la commande repart là où elle s'était arrêtée. Le volume
    national se compte en millions de diagnostics : un téléchargement qui
    ne serait récupérable qu'à la fin serait inutilisable.
    """
    import pandas as pd

    settings = settings or charger_settings()
    dossier = settings.chemins.external / "dpe"
    dossier.mkdir(parents=True, exist_ok=True)
    conf = settings.enrichissement
    taille = int(conf.get("dpe_taille_page", 5000))
    pause = float(conf.get("dpe_pause_s", 0.15))       # < 10 appels / seconde
    taille_lot = int(conf.get("dpe_codes_par_requete", 30))

    declares = champs_du_jeu(settings)
    champs = [c for c in CHAMPS_DPE if c in declares]
    manquants = [c for c in CHAMPS_DPE if c not in declares]
    if manquants:
        log.warning("Champs absents du schéma ADEME, ignorés : %s",
                    ", ".join(manquants))
    if "surface_habitable_logement" not in champs:
        raise RuntimeError(
            "Le champ 'surface_habitable_logement' n'existe plus dans le jeu "
            "ADEME. L'appariement repose dessus : vérifier CHAMPS_DPE."
        )

    total_national = requests.get(_url_api(settings), params={"size": 0},
                                  headers=ENTETES, timeout=30).json().get("total", 0)
    codes = codes_postaux_du_perimetre(settings)
    bilan: dict[str, int] = {}
    lots_en_echec: list[str] = []

    for departement in (departements or settings.departements):
        codes_departement = codes.get(departement, [])
        if not codes_departement:
            log.warning("Aucun code postal connu pour le département %s", departement)
            continue

        tous_les_lots = list(_lots(codes_departement, taille_lot))
        log.info("DPE %s : %d codes postaux, %d lots",
                 departement, len(codes_departement), len(tous_les_lots))
        total_departement = 0

        for numero_lot, lot in enumerate(tous_les_lots, start=1):
            cible = dossier / f"dpe_{departement}_{numero_lot:03d}.parquet"
            if cible.exists() and not forcer:
                log.info("DPE %s lot %d/%d déjà téléchargé, ignoré",
                         departement, numero_lot, len(tous_les_lots))
                continue
            lignes: list[dict] = []
            url: str | None = _url_api(settings)
            params: dict[str, Any] | None = {
                "size": taille,
                "select": ",".join(champs),
                "code_postal_ban_in": ",".join(lot),
            }
            premiere_page = True
            echec_lot = False
            while url:
                donnees = None
                for tentative in range(6):
                    try:
                        reponse = requests.get(url, params=params,
                                               headers=ENTETES, timeout=120)
                        reponse.raise_for_status()
                        donnees = reponse.json()
                        break
                    except requests.RequestException as err:
                        # Attente plafonnée à une minute : une coupure réseau
                        # ou une résolution DNS défaillante met souvent
                        # plusieurs dizaines de secondes à se rétablir.
                        attente = min(5 * 2 ** tentative, 60)
                        log.warning("DPE %s lot %d : %s — nouvel essai dans %ds",
                                    departement, numero_lot,
                                    type(err).__name__, attente)
                        time.sleep(attente)
                if donnees is None:
                    # Un lot perdu n'interrompt pas les autres : il sera
                    # simplement repris au prochain lancement.
                    log.error("DPE %s lot %d abandonné après 6 tentatives, "
                              "il sera repris plus tard", departement, numero_lot)
                    echec_lot = True
                    break
                if premiere_page:
                    total_lot = donnees.get("total", 0)
                    if total_national and total_lot >= total_national:
                        raise RuntimeError(
                            "Le filtre par code postal n'a pas été appliqué : "
                            f"{total_lot} résultats, soit le jeu national entier. "
                            "L'API a probablement changé de syntaxe de filtre. "
                            "Relance 'pipeline dpe-diagnostic' pour trouver la "
                            "forme acceptée."
                        )
                    premiere_page = False

                lignes.extend(donnees.get("results", []))
                url, params = donnees.get("next"), None
                time.sleep(pause)

            if echec_lot:
                lots_en_echec.append(f"{departement}-{numero_lot}")
                continue

            # Écriture immédiate : le lot est acquis, même si on interrompt.
            pd.DataFrame(lignes, columns=champs).to_parquet(cible, index=False)
            total_departement += len(lignes)
            log.info("DPE %s : lot %d/%d terminé, %d diagnostics (%d cumulés)",
                     departement, numero_lot, len(tous_les_lots),
                     len(lignes), total_departement)

        bilan[departement] = total_departement

    if lots_en_echec:
        log.warning("%d lot(s) non téléchargés : %s. Relance la même commande "
                    "pour les reprendre.", len(lots_en_echec),
                    ", ".join(lots_en_echec))
    return bilan


# --- Appariement ------------------------------------------------------------

COLONNES_DPE_GOLD = {
    "dpe_classe": "VARCHAR",
    "annee_construction": "INTEGER",
    "periode_construction": "VARCHAR",
    "dpe_ges": "VARCHAR",
    "dpe_qualite_appariement": "VARCHAR",
    "dpe_nb_candidats": "INTEGER",
    "dpe_ecart_surface": "DOUBLE",
    "dpe_date": "DATE",
    "zone_part_dpe_fg": "DOUBLE",
    "zone_nb_dpe": "INTEGER",
}


def enrichir_dpe(con: duckdb.DuckDBPyConnection, settings: Settings) -> dict[str, Any]:
    """
    Ajoute les colonnes DPE à la table `gold` de la connexion.

    Si aucun fichier DPE n'est présent, les colonnes sont tout de même créées,
    vides : le schéma du dataset reste identique, que l'enrichissement ait
    été lancé ou non. L'équipe ML n'a jamais à gérer deux formats.
    """
    fichiers = sorted((settings.chemins.external / "dpe").glob("dpe_*.parquet"))
    if not fichiers:
        log.warning("Aucun fichier DPE : colonnes DPE créées vides. "
                    "Lance d'abord : python -m realstate_data.pipeline dpe")
        colonnes = ", ".join(f"CAST(NULL AS {t}) AS {c}"
                             for c, t in COLONNES_DPE_GOLD.items())
        con.execute(f"CREATE OR REPLACE TABLE gold AS SELECT *, {colonnes} FROM gold;")
        return {"dpe_disponible": False}

    conf = settings.enrichissement
    tolerance = float(conf.get("dpe_tolerance_surface", 0.10))
    min_zone = int(conf.get("dpe_min_diagnostics_zone", 30))
    motif = str(settings.chemins.external / "dpe" / "dpe_*.parquet")

    con.execute(macro_normalisation())

    # DPE : clé d'adresse extraite de `adresse_ban`, de la forme
    # "12 Rue de la Paix 75002 Paris". On retire le numéro en tête et le
    # code postal suivi de la commune en fin de chaîne.
    con.execute(f"""
        CREATE OR REPLACE TABLE dpe AS
        SELECT
            numero_dpe,
            upper(etiquette_dpe)                                  AS classe,
            upper(etiquette_ges)                                  AS ges,
            TRY_CAST(surface_habitable_logement AS DOUBLE)        AS surface,
            TRY_CAST(date_etablissement_dpe AS DATE)              AS date_dpe,
            lower(type_batiment)                                  AS type_batiment,
            TRY_CAST(annee_construction AS INTEGER)               AS annee_construction,
            CAST(code_postal_ban AS VARCHAR)                      AS code_postal,
            TRY_CAST(regexp_extract(adresse_ban, '^\\s*(\\d+)', 1) AS INTEGER) AS numero,
            normaliser_voie(regexp_replace(
                regexp_replace(adresse_ban,
                    '^\\s*\\d+\\s*(BIS|TER|QUATER|[A-Z](\\s|$))?\\s*', '', 'i'),
                '\\s+\\d{{5}}(\\s.*)?$', ''))                     AS voie
        FROM read_parquet('{motif}')
        WHERE upper(etiquette_dpe) IN ('A', 'B', 'C', 'D', 'E', 'F', 'G')
          AND adresse_ban IS NOT NULL;
    """)

    # DVF : même normalisation, appliquée aux champs d'adresse du gold.
    con.execute("""
        CREATE OR REPLACE TABLE cles_dvf AS
        SELECT
            id_mutation, type_local, surface_bati, date_mutation,
            CAST(code_postal AS VARCHAR)                                 AS code_postal,
            TRY_CAST(regexp_extract(adresse_numero, '(\\d+)', 1) AS INTEGER) AS numero,
            normaliser_voie(adresse_nom_voie)                            AS voie
        FROM gold
        WHERE adresse_nom_voie IS NOT NULL AND adresse_numero IS NOT NULL;
    """)

    con.execute("""
        CREATE OR REPLACE TABLE candidats AS
        SELECT
            k.id_mutation, k.type_local,
            d.classe, d.ges, d.date_dpe, d.numero_dpe, d.annee_construction,
            abs(d.surface - k.surface_bati) / k.surface_bati          AS ecart_surface,
            abs(date_diff('day', k.date_mutation, d.date_dpe))         AS ecart_jours,
            d.date_dpe <= k.date_mutation                              AS anterieur,
            count(*) OVER (PARTITION BY k.id_mutation)                 AS nb_a_l_adresse
        FROM cles_dvf k
        JOIN dpe d
          ON d.code_postal = k.code_postal
         AND d.numero      = k.numero
         AND d.voie        = k.voie
        WHERE d.surface > 0
          -- Le type doit concorder : une maison n'hérite pas du DPE d'un
          -- appartement situé à la même adresse. Un type non renseigné
          -- côté DPE n'élimine pas le candidat.
          AND (d.type_batiment IS NULL
               OR (k.type_local = 'Maison' AND d.type_batiment = 'maison')
               OR (k.type_local = 'Appartement'
                   AND d.type_batiment IN ('appartement', 'immeuble')));
    """)

    # Choix du DPE. Ordre de préférence :
    #   1. la surface la plus proche — c'est ce qui identifie le logement ;
    #   2. à surface égale, un DPE ANTÉRIEUR à la vente, qui décrit l'état du
    #      bien au moment de la transaction. Un DPE postérieur peut refléter
    #      des travaux de rénovation réalisés par l'acheteur ;
    #   3. le DPE le plus proche dans le temps.
    con.execute(f"""
        CREATE OR REPLACE TABLE appariement AS
        WITH compatibles AS (
            SELECT *, count(*) OVER (PARTITION BY id_mutation) AS nb_compatibles
            FROM candidats WHERE ecart_surface <= {tolerance}
        ),
        par_surface AS (
            SELECT id_mutation, classe, ges, date_dpe, ecart_surface,
                   annee_construction,
                   nb_compatibles AS nb_candidats,
                   CASE WHEN nb_compatibles = 1 THEN 'exacte' ELSE 'probable' END
                       AS qualite
            FROM (
                SELECT *, row_number() OVER (
                    PARTITION BY id_mutation
                    ORDER BY round(ecart_surface, 2), anterieur DESC, ecart_jours
                ) AS rang
                FROM compatibles
            ) WHERE rang = 1
        )
        -- NOTE MÉTHODOLOGIQUE : une règle complémentaire, qui acceptait une
        -- maison dont l'adresse ne porte qu'un seul DPE quelle que soit la
        -- surface, a été testée puis ÉCARTÉE. Mesurée contre une vérité
        -- terrain, sa précision était nulle : sans contrainte de surface,
        -- elle attribuait le DPE d'un autre bien de la même adresse.
        SELECT * FROM par_surface;
    """)

    # Indicateur de zone : part des passoires F et G parmi tous les DPE du
    # code postal. Ce n'est PAS une fuite de la cible : il décrit le parc de
    # logements, pas les prix. Il couvre toutes les ventes, y compris celles
    # sans DPE individuel.
    con.execute(f"""
        CREATE OR REPLACE TABLE zone_dpe AS
        SELECT code_postal,
               count(*)                                                    AS zone_nb_dpe,
               avg(CASE WHEN classe IN ('F', 'G') THEN 1.0 ELSE 0.0 END)   AS zone_part_dpe_fg
        FROM dpe GROUP BY 1 HAVING count(*) >= {min_zone};
    """)

    con.execute("""
        CREATE OR REPLACE TABLE gold AS
        SELECT g.*,
               a.classe                               AS dpe_classe,
               a.ges                                  AS dpe_ges,
               a.qualite                              AS dpe_qualite_appariement,
               CAST(a.nb_candidats AS INTEGER)        AS dpe_nb_candidats,
               round(a.ecart_surface, 4)              AS dpe_ecart_surface,
               a.date_dpe                             AS dpe_date,
               a.annee_construction                   AS annee_construction,
               -- Période de construction : sans elle, l'étiquette énergie est
               -- confondue avec l'âge du bâti. Un logement récent est à la
               -- fois bien classé ET vendu avec une prime de modernité.
               CASE
                   WHEN a.annee_construction IS NULL THEN NULL
                   WHEN a.annee_construction < 1949 THEN 'avant 1949'
                   WHEN a.annee_construction < 1975 THEN '1949-1974'
                   WHEN a.annee_construction < 1990 THEN '1975-1989'
                   WHEN a.annee_construction < 2006 THEN '1990-2005'
                   ELSE 'depuis 2006'
               END                                    AS periode_construction,
               round(z.zone_part_dpe_fg, 4)           AS zone_part_dpe_fg,
               CAST(z.zone_nb_dpe AS INTEGER)         AS zone_nb_dpe
        FROM gold g
        LEFT JOIN appariement a USING (id_mutation)
        LEFT JOIN zone_dpe z ON z.code_postal = CAST(g.code_postal AS VARCHAR);
    """)

    total, apparies, zone = con.execute("""
        SELECT count(*), count(dpe_classe), count(zone_part_dpe_fg) FROM gold
    """).fetchone()
    repartition = dict(con.execute("""
        SELECT dpe_qualite_appariement, count(*) FROM gold
        WHERE dpe_qualite_appariement IS NOT NULL GROUP BY 1
    """).fetchall())
    nb_dpe = con.execute("SELECT count(*) FROM dpe").fetchone()[0]

    bilan = {
        "dpe_disponible": True,
        "diagnostics_charges": nb_dpe,
        "ventes": total,
        "ventes_avec_dpe": apparies,
        "taux_appariement": round(apparies / total, 4) if total else 0,
        "repartition_qualite": repartition,
        "ventes_avec_indicateur_zone": zone,
    }
    log.info("DPE : %d ventes appariées sur %d (%.1f %%), indicateur de zone "
             "sur %d ventes", apparies, total, 100 * bilan["taux_appariement"], zone)
    return bilan
