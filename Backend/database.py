from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _resolve_sqlite_path(database_url: str) -> str:
    if database_url.startswith("sqlite:///:memory:"):
        return ":memory:"
    if database_url.startswith("sqlite:///"):
        return database_url.removeprefix("sqlite:///")
    if database_url.startswith("sqlite://"):
        return database_url.removeprefix("sqlite://")
    return str(Path(".").resolve() / "search_history.db")


class SearchHistoryService:
    """Service de persistance pour l'historique des recherches immobilières.

    Le service utilise SQLite par défaut pour les environnements de dev/test.
    En production, il accepte une URL PostgreSQL sans casser le code si
    `psycopg` n'est pas encore installé au moment du lancement.
    """

    def __init__(self, database_url: str | None = None):
        self.database_url = (database_url or os.getenv("DATABASE_URL") or "sqlite:///search_history.db").strip()
        self._db_type = "sqlite" if self.database_url.startswith("sqlite") else "postgresql"

    def init_db(self) -> None:
        if self._db_type == "sqlite":
            conn = sqlite3.connect(_resolve_sqlite_path(self.database_url))
            try:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS search_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        query TEXT NOT NULL,
                        commune TEXT,
                        property_type TEXT,
                        area_m2 REAL,
                        estimated_price REAL,
                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
                conn.commit()
            finally:
                conn.close()
            return

        try:
            import psycopg
        except ImportError as exc:  # pragma: no cover - dépend de l'installation réelle
            raise RuntimeError(
                "Le driver PostgreSQL psycopg est requis pour utiliser DATABASE_URL PostgreSQL."
            ) from exc

        with psycopg.connect(self.database_url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS search_history (
                        id SERIAL PRIMARY KEY,
                        query TEXT NOT NULL,
                        commune TEXT,
                        property_type TEXT,
                        area_m2 DOUBLE PRECISION,
                        estimated_price DOUBLE PRECISION,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
                conn.commit()

    def add_search(
        self,
        *,
        query: str,
        commune: str | None = None,
        property_type: str | None = None,
        area_m2: float | None = None,
        estimated_price: float | None = None,
    ) -> dict[str, Any]:
        created_at = datetime.now(timezone.utc).isoformat()

        if self._db_type == "sqlite":
            conn = sqlite3.connect(_resolve_sqlite_path(self.database_url))
            try:
                cursor = conn.execute(
                    """
                    INSERT INTO search_history (query, commune, property_type, area_m2, estimated_price, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        query,
                        commune,
                        property_type,
                        float(area_m2) if area_m2 is not None else None,
                        float(estimated_price) if estimated_price is not None else None,
                        created_at,
                    ),
                )
                conn.commit()
                record_id = cursor.lastrowid
            finally:
                conn.close()
            return {
                "id": record_id,
                "query": query,
                "commune": commune,
                "property_type": property_type,
                "area_m2": float(area_m2) if area_m2 is not None else None,
                "estimated_price": float(estimated_price) if estimated_price is not None else None,
                "created_at": created_at,
            }

        try:
            import psycopg
        except ImportError as exc:  # pragma: no cover - dépend de l'installation réelle
            raise RuntimeError(
                "Le driver PostgreSQL psycopg est requis pour utiliser DATABASE_URL PostgreSQL."
            ) from exc

        with psycopg.connect(self.database_url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO search_history (query, commune, property_type, area_m2, estimated_price, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        query,
                        commune,
                        property_type,
                        float(area_m2) if area_m2 is not None else None,
                        float(estimated_price) if estimated_price is not None else None,
                        created_at,
                    ),
                )
                row_id = cur.fetchone()[0]
                conn.commit()

        return {
            "id": row_id,
            "query": query,
            "commune": commune,
            "property_type": property_type,
            "area_m2": float(area_m2) if area_m2 is not None else None,
            "estimated_price": float(estimated_price) if estimated_price is not None else None,
            "created_at": created_at,
        }

    def list_recent(self, limit: int = 10) -> list[dict[str, Any]]:
        if self._db_type == "sqlite":
            conn = sqlite3.connect(_resolve_sqlite_path(self.database_url))
            conn.row_factory = sqlite3.Row
            try:
                rows = conn.execute(
                    """
                    SELECT id, query, commune, property_type, area_m2, estimated_price, created_at
                    FROM search_history
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (limit,),
                ).fetchall()
            finally:
                conn.close()
            return [dict(row) for row in rows]

        try:
            import psycopg
        except ImportError as exc:  # pragma: no cover - dépend de l'installation réelle
            raise RuntimeError(
                "Le driver PostgreSQL psycopg est requis pour utiliser DATABASE_URL PostgreSQL."
            ) from exc

        with psycopg.connect(self.database_url) as conn:
            with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
                cur.execute(
                    """
                    SELECT id, query, commune, property_type, area_m2, estimated_price, created_at
                    FROM search_history
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (limit,),
                )
                return cur.fetchall()
