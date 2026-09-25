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
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS search_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER REFERENCES users(id),
                        query TEXT NOT NULL,
                        commune TEXT,
                        property_type TEXT,
                        area_m2 REAL,
                        estimated_price REAL,
                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
                # Migration : ajoute user_id si table déjà existante sans cette colonne
                try:
                    conn.execute("ALTER TABLE search_history ADD COLUMN user_id INTEGER REFERENCES users(id)")
                    conn.commit()
                except sqlite3.OperationalError:
                    pass  # colonne déjà présente
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
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        email TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS search_history (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER REFERENCES users(id),
                        query TEXT NOT NULL,
                        commune TEXT,
                        property_type TEXT,
                        area_m2 DOUBLE PRECISION,
                        estimated_price DOUBLE PRECISION,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
                try:
                    cur.execute("ALTER TABLE search_history ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)")
                except Exception:
                    pass
                conn.commit()

    # ── Utilisateurs ─────────────────────────────────────────────────────────

    def create_user(self, email: str, password_hash: str) -> dict[str, Any]:
        created_at = datetime.now(timezone.utc).isoformat()
        if self._db_type == "sqlite":
            conn = sqlite3.connect(_resolve_sqlite_path(self.database_url))
            try:
                cursor = conn.execute(
                    "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
                    (email.lower().strip(), password_hash, created_at),
                )
                conn.commit()
                return {"id": cursor.lastrowid, "email": email.lower().strip(), "created_at": created_at}
            finally:
                conn.close()
        try:
            import psycopg as _pg
        except ImportError as exc:
            raise RuntimeError("psycopg requis pour PostgreSQL") from exc
        with _pg.connect(self.database_url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO users (email, password_hash) VALUES (%s, %s) RETURNING id, email, created_at",
                    (email.lower().strip(), password_hash),
                )
                row = cur.fetchone()
                conn.commit()
                return {"id": row[0], "email": row[1], "created_at": row[2].isoformat() if row[2] else created_at}

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        if self._db_type == "sqlite":
            conn = sqlite3.connect(_resolve_sqlite_path(self.database_url))
            conn.row_factory = sqlite3.Row
            try:
                row = conn.execute(
                    "SELECT id, email, password_hash, created_at FROM users WHERE email = ?",
                    (email.lower().strip(),),
                ).fetchone()
                return dict(row) if row else None
            finally:
                conn.close()
        try:
            import psycopg as _pg
            import psycopg.rows as _rows
        except ImportError as exc:
            raise RuntimeError("psycopg requis pour PostgreSQL") from exc
        with _pg.connect(self.database_url) as conn:
            with conn.cursor(row_factory=_rows.dict_row) as cur:
                cur.execute(
                    "SELECT id, email, password_hash, created_at FROM users WHERE email = %s",
                    (email.lower().strip(),),
                )
                row = cur.fetchone()
                if row and row.get("created_at") and hasattr(row["created_at"], "isoformat"):
                    row["created_at"] = row["created_at"].isoformat()
                return dict(row) if row else None

    # ── Historique ────────────────────────────────────────────────────────────

    def add_search(
        self,
        *,
        query: str,
        commune: str | None = None,
        property_type: str | None = None,
        area_m2: float | None = None,
        estimated_price: float | None = None,
        user_id: int | None = None,
    ) -> dict[str, Any]:
        created_at = datetime.now(timezone.utc).isoformat()

        if self._db_type == "sqlite":
            conn = sqlite3.connect(_resolve_sqlite_path(self.database_url))
            try:
                cursor = conn.execute(
                    """
                    INSERT INTO search_history (user_id, query, commune, property_type, area_m2, estimated_price, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        user_id,
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
                "user_id": user_id,
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
                    INSERT INTO search_history (user_id, query, commune, property_type, area_m2, estimated_price, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        user_id,
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
            "user_id": user_id,
            "query": query,
            "commune": commune,
            "property_type": property_type,
            "area_m2": float(area_m2) if area_m2 is not None else None,
            "estimated_price": float(estimated_price) if estimated_price is not None else None,
            "created_at": created_at,
        }

    def list_recent(self, limit: int = 10, user_id: int | None = None) -> list[dict[str, Any]]:
        if self._db_type == "sqlite":
            conn = sqlite3.connect(_resolve_sqlite_path(self.database_url))
            conn.row_factory = sqlite3.Row
            try:
                if user_id is not None:
                    rows = conn.execute(
                        """
                        SELECT id, user_id, query, commune, property_type, area_m2, estimated_price, created_at
                        FROM search_history WHERE user_id = ?
                        ORDER BY id DESC LIMIT ?
                        """,
                        (user_id, limit),
                    ).fetchall()
                else:
                    rows = conn.execute(
                        """
                        SELECT id, user_id, query, commune, property_type, area_m2, estimated_price, created_at
                        FROM search_history WHERE user_id IS NULL
                        ORDER BY id DESC LIMIT ?
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
                if user_id is not None:
                    cur.execute(
                        """
                        SELECT id, user_id, query, commune, property_type, area_m2, estimated_price, created_at
                        FROM search_history WHERE user_id = %s
                        ORDER BY created_at DESC LIMIT %s
                        """,
                        (user_id, limit),
                    )
                else:
                    cur.execute(
                        """
                        SELECT id, user_id, query, commune, property_type, area_m2, estimated_price, created_at
                        FROM search_history WHERE user_id IS NULL
                        ORDER BY created_at DESC LIMIT %s
                        """,
                        (limit,),
                    )
                return cur.fetchall()
