"""Tests unitaires — database.py

Couvre :
  - SearchHistoryService.add_search  : persistance dpe_classe / annee_construction
  - SearchHistoryService.list_recent : renvoi des nouveaux champs
  - Migration automatique            : ALTER TABLE sur DB existante sans les colonnes
"""

from __future__ import annotations

import sqlite3

import pytest

from database import SearchHistoryService, _resolve_sqlite_path


# ==========================================================================
#  FIXTURE
# ==========================================================================

@pytest.fixture
def svc(tmp_path):
    db_url = f"sqlite:///{tmp_path / 'test.db'}"
    s = SearchHistoryService(database_url=db_url)
    s.init_db()
    return s


# ==========================================================================
#  add_search — champs DPE
# ==========================================================================

def test_add_search_avec_dpe(svc):
    record = svc.add_search(
        query="21 rue du Fbg St-Antoine 75011",
        commune="PARIS 11",
        property_type="apartment",
        area_m2=65.0,
        estimated_price=710_000.0,
        rooms=3,
        dpe_classe="B",
        annee_construction=2010,
    )
    assert record["dpe_classe"] == "B"
    assert record["annee_construction"] == 2010


def test_add_search_sans_dpe(svc):
    record = svc.add_search(
        query="Versailles",
        commune="VERSAILLES",
        property_type="house",
        area_m2=120.0,
        estimated_price=850_000.0,
    )
    assert record["dpe_classe"] is None
    assert record["annee_construction"] is None


@pytest.mark.parametrize("classe", ["A", "B", "C", "D", "E", "F", "G"])
def test_add_search_toutes_classes_dpe(svc, classe):
    record = svc.add_search(query="test", dpe_classe=classe)
    assert record["dpe_classe"] == classe


# ==========================================================================
#  list_recent — champs DPE renvoyés
# ==========================================================================

def test_list_recent_renvoie_dpe(svc):
    svc.add_search(query="Paris 15", dpe_classe="C", annee_construction=1995)
    rows = svc.list_recent()
    assert rows[0]["dpe_classe"] == "C"
    assert rows[0]["annee_construction"] == 1995


def test_list_recent_dpe_null_quand_absent(svc):
    svc.add_search(query="Melun")
    rows = svc.list_recent()
    assert rows[0]["dpe_classe"] is None
    assert rows[0]["annee_construction"] is None


def test_list_recent_plusieurs_entrees_preservent_dpe(svc):
    svc.add_search(query="A", dpe_classe="A", annee_construction=2020)
    svc.add_search(query="B", dpe_classe="G", annee_construction=1970)
    rows = svc.list_recent()
    # list_recent renvoie du plus récent au plus ancien
    assert rows[0]["dpe_classe"] == "G"
    assert rows[1]["dpe_classe"] == "A"


# ==========================================================================
#  Migration automatique — DB sans les colonnes dpe_classe / annee_construction
# ==========================================================================

def test_migration_ajoute_colonnes_dpe(tmp_path):
    """init_db() doit ajouter les colonnes si la DB existe sans elles."""
    db_path = tmp_path / "legacy.db"

    # Créer une DB sans les colonnes DPE (schéma d'avant la v1.4)
    conn = sqlite3.connect(str(db_path))
    conn.execute("""
        CREATE TABLE search_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            query TEXT NOT NULL,
            commune TEXT,
            property_type TEXT,
            area_m2 REAL,
            estimated_price REAL,
            rooms INTEGER,
            address TEXT,
            postal_code TEXT,
            adresse_normalisee TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("INSERT INTO search_history (query) VALUES ('legacy entry')")
    conn.commit()
    conn.close()

    # init_db() doit migrer sans erreur
    svc = SearchHistoryService(database_url=f"sqlite:///{db_path}")
    svc.init_db()

    # Vérifier que les colonnes existent maintenant
    conn = sqlite3.connect(str(db_path))
    cols = {row[1] for row in conn.execute("PRAGMA table_info(search_history)")}
    conn.close()
    assert "dpe_classe" in cols
    assert "annee_construction" in cols


def test_migration_conserve_donnees_existantes(tmp_path):
    """La migration ne doit pas effacer les données existantes."""
    db_path = tmp_path / "legacy2.db"

    conn = sqlite3.connect(str(db_path))
    conn.execute("""
        CREATE TABLE search_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            query TEXT NOT NULL,
            commune TEXT,
            property_type TEXT,
            area_m2 REAL,
            estimated_price REAL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("INSERT INTO search_history (query, commune) VALUES ('ancien', 'PARIS 8')")
    conn.commit()
    conn.close()

    svc = SearchHistoryService(database_url=f"sqlite:///{db_path}")
    svc.init_db()

    rows = svc.list_recent()
    assert len(rows) == 1
    assert rows[0]["commune"] == "PARIS 8"
