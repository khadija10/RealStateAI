"""
Ingestion DVF géolocalisées (Etalab) — couche BRONZE.

Principes :
- idempotent : un fichier déjà téléchargé et intègre n'est pas re-téléchargé ;
- traçable : chaque téléchargement écrit une entrée dans data/raw/_manifest.json
  (URL, date, taille, checksum SHA-256) ;
- robuste : retries avec backoff exponentiel, téléchargement en .part puis
  renommage atomique pour ne jamais laisser un fichier tronqué en cache.
"""

from __future__ import annotations

import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

from realstate_data.config import Settings, charger_settings
from realstate_data.logging_conf import configurer_logging

log = configurer_logging()

NOM_MANIFESTE = "_manifest.json"


def url_departement(base_url: str, annee: int, departement: str) -> str:
    """Construit l'URL du fichier départemental d'un millésime donné."""
    return f"{base_url}/{annee}/departements/{departement}.csv.gz"


def _sha256(chemin: Path, taille_bloc: int = 1 << 20) -> str:
    """Checksum du fichier, calculé par blocs de 1 Mo (pas de chargement RAM)."""
    h = hashlib.sha256()
    with open(chemin, "rb") as f:
        while bloc := f.read(taille_bloc):
            h.update(bloc)
    return h.hexdigest()


def _charger_manifeste(dossier_raw: Path) -> dict:
    chemin = dossier_raw / NOM_MANIFESTE
    if chemin.exists():
        return json.loads(chemin.read_text(encoding="utf-8"))
    return {"source": "DVF géolocalisées — Etalab / DGFiP", "fichiers": {}}


def _ecrire_manifeste(dossier_raw: Path, manifeste: dict) -> None:
    chemin = dossier_raw / NOM_MANIFESTE
    chemin.write_text(
        json.dumps(manifeste, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def telecharger_fichier(
    url: str,
    destination: Path,
    timeout: int = 60,
    max_retries: int = 5,
    backoff: int = 3,
) -> bool:
    """
    Télécharge `url` vers `destination`. Renvoie True si un téléchargement a eu
    lieu, False si le fichier était déjà en cache.

    Le fichier est écrit dans un `.part` temporaire puis renommé : une coupure
    réseau ne laisse jamais un fichier incomplet qui serait pris pour valide
    au prochain lancement.
    """
    if destination.exists() and destination.stat().st_size > 0:
        log.info("Cache : %s déjà présent, téléchargement ignoré", destination.name)
        return False

    temporaire = destination.with_suffix(destination.suffix + ".part")

    for tentative in range(1, max_retries + 1):
        try:
            with requests.get(url, stream=True, timeout=timeout) as reponse:
                if reponse.status_code == 404:
                    # Millésime ou département non publié : ce n'est pas une
                    # erreur technique, on le remonte proprement à l'appelant.
                    raise FileNotFoundError(url)
                reponse.raise_for_status()
                with open(temporaire, "wb") as f:
                    for morceau in reponse.iter_content(chunk_size=1 << 20):
                        f.write(morceau)
            temporaire.rename(destination)
            log.info("Téléchargé : %s (%.1f Mo)",
                     destination.name, destination.stat().st_size / 1e6)
            return True

        except FileNotFoundError:
            temporaire.unlink(missing_ok=True)
            raise
        except (requests.RequestException, OSError) as err:
            temporaire.unlink(missing_ok=True)
            attente = backoff * (2 ** (tentative - 1))
            log.warning("Échec %s (tentative %d/%d) : %s — nouvel essai dans %ds",
                        url, tentative, max_retries, err, attente)
            if tentative == max_retries:
                raise
            time.sleep(attente)

    return False


def ingerer(settings: Settings | None = None) -> dict:
    """
    Télécharge tous les couples (millésime, département) du périmètre.

    Un millésime absent (404) est journalisé et ignoré : c'est le cas normal
    pour l'année en cours, publiée seulement en avril et octobre.
    """
    settings = settings or charger_settings()
    settings.chemins.creer_dossiers()

    base_url = settings.ingestion["base_url"]
    manifeste = _charger_manifeste(settings.chemins.raw)
    resume = {"telecharges": 0, "en_cache": 0, "indisponibles": []}

    for annee in settings.millesimes:
        for departement in settings.departements:
            nom = f"dvf_{annee}_{departement}.csv.gz"
            destination = settings.chemins.raw / nom
            url = url_departement(base_url, annee, departement)

            try:
                nouveau = telecharger_fichier(
                    url,
                    destination,
                    timeout=settings.ingestion.get("timeout_s", 60),
                    max_retries=settings.ingestion.get("max_retries", 5),
                    backoff=settings.ingestion.get("backoff_s", 3),
                )
            except FileNotFoundError:
                log.warning("Non publié : %s %s (ignoré)", annee, departement)
                resume["indisponibles"].append(f"{annee}-{departement}")
                continue

            resume["telecharges" if nouveau else "en_cache"] += 1

            # Le checksum n'est recalculé que sur un nouveau fichier :
            # inutile de relire 200 Mo à chaque exécution.
            if nouveau or nom not in manifeste["fichiers"]:
                manifeste["fichiers"][nom] = {
                    "url": url,
                    "annee": annee,
                    "departement": departement,
                    "telecharge_le": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    "taille_octets": destination.stat().st_size,
                    "sha256": _sha256(destination),
                }

    _ecrire_manifeste(settings.chemins.raw, manifeste)
    log.info("Ingestion terminée : %d téléchargés, %d en cache, %d indisponibles",
             resume["telecharges"], resume["en_cache"], len(resume["indisponibles"]))
    return resume
