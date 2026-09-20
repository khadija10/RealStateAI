"""
Configuration du logging, partagée par tous les modules du pipeline.

Pourquoi un module dédié : à l'étape 1 le téléchargement peut échouer sur un
département. Sans logs horodatés, impossible de dire au jury quelle partie du
périmètre a été effectivement ingérée.
"""

from __future__ import annotations

import logging
import os
import sys


def configurer_logging(niveau: str | None = None) -> logging.Logger:
    """Initialise le logger racine du pipeline (idempotent)."""
    niveau = niveau or os.getenv("REALSTATE_LOG_LEVEL", "INFO")
    logger = logging.getLogger("realstate_data")

    if not logger.handlers:                       # évite les doublons de logs
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
        )
        logger.addHandler(handler)

    logger.setLevel(niveau)
    logger.propagate = False
    return logger
