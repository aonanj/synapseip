#!/usr/bin/env python3
"""
add_canon_name.py

Normalize assignee names into a canonical form and upsert mappings.

For each patent row with a non-null assignee_name:
- Build canonical_assignee_name by uppercasing, removing punctuation, trimming,
  and stripping trailing company suffixes (INC, LLC, CORP, LTD, etc.).
- Upsert the canonical name into canonical_assignee_name (unique on canonical_assignee_name).
- Upsert the original assignee_name as an alias into assignee_alias
  (unique on assignee_alias), pointing to the canonical id.
- Update patent.canonical_assignee_name_id and patent.assignee_alias_id accordingly.

The script runs in batches to handle large tables efficiently.

Usage:
    python add_canon_name.py --dsn "postgresql://user:pass@host/db?sslmode=require" 
    # or with env DATABASE_URL set

Optional:
    --batch-size 1000     # rows per batch (default 1000)
    --limit 50000         # stop after processing this many patents (default: no limit)

Note:
- Expects the following schema (ids are UUID with defaults in DB):
    canonical_assignee_name(id uuid pk, canonical_assignee_name text unique)
    assignee_alias(id uuid pk, assignee_alias text unique, canonical_id uuid fk)
    patent(..., assignee_name text, canonical_assignee_name_id uuid, assignee_alias_id uuid)
    patent_assignee(pub_id text fk, alias_id uuid fk, canonical_id uuid fk, position smallint)
- Run this after backfilling missing assignee_name values (e.g., via scripts/backfill_assignee_names_bigquery.py).
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

import psycopg
from dotenv import load_dotenv
from psycopg import Connection, sql
from psycopg.rows import TupleRow
from psycopg_pool import ConnectionPool

from infrastructure.logger import setup_logger

logger = setup_logger(__name__)

load_dotenv()

# psycopg generics
type PgConn = Connection[TupleRow]


# Suffixes to strip when appearing at the end. These are applied AFTER
# punctuation removal and uppercasing, and matched as whole trailing tokens.
_RAW_SUFFIXES = [
    "INC", "LLC", "CORP", "LTD", "CORPORATION", "INCORPORATED", "INCORP",
    "COMPANY", "LIMITED", "GMBH", "ASS", "PTY", "MFF", "SYS", "MAN",
    "L Y", "L P", "LY", "LP", "OY", "NV", "SAS", "CO", "BV", "AG",
    "A G", "A B", "O Y", "N V", "S E", "N A", "MANF", "INST", "B V",
    "INT", "IND", "KK", "SE", "AB", "INTL", "INDST", "NA",
]

# Normalize list: de-duplicate while preserving order, sort by length desc for greedy match
_SUFFIXES: list[str] = sorted(
    list(dict.fromkeys(s.strip().upper() for s in _RAW_SUFFIXES if s.strip())),
    key=len,
    reverse=True,
)


def _remove_punct_and_collapse(s: str) -> str:
    """Remove all punctuation/symbols, collapse spaces, and uppercase.

    Replaces any non-alphanumeric character with a space to preserve token
    boundaries, then collapses whitespace and uppercases the result.
    """
    # Replace any non-alphanumeric with space
    cleaned = re.sub(r"[^0-9A-Za-z]+", " ", s)
    # Collapse whitespace and uppercase
    return " ".join(cleaned.split()).upper()


def canonicalize_assignee(name: str) -> str:
    """Return canonical assignee per rules.

    Steps:
    - Remove punctuation/symbols, collapse spaces, uppercase
    - Strip any defined suffix tokens if they appear at the end (greedy, repeat)
    - Trim again
    """
    if not name:
        return ""
    s = _remove_punct_and_collapse(name)
    if not s:
        return s

    # Greedily strip any suffixes from the end, repeatedly.
    # Work with a token list for whole-token matching and handle multi-word suffixes.
    tokens = s.split()
    changed = True
    while changed and tokens:
        changed = False
        tail = " ".join(tokens[-2:]) if len(tokens) >= 2 else tokens[-1]
        for suf in _SUFFIXES:
            # Try matching last two tokens joined or last one token depending on suffix form
            if " " in suf:
                # multi-token suffix (e.g., "A G") – compare against tail (up to 2 tokens)
                suf_tokens = suf.split()
                n = len(suf_tokens)
                if n <= len(tokens) and " ".join(tokens[-n:]) == suf:
                    tokens = tokens[:-n]
                    changed = True
                    break
            else:
                if tokens and tokens[-1] == suf:
                    tokens = tokens[:-1]
                    changed = True
                    break
    return " ".join(tokens).strip()


@dataclass(frozen=True)
class PatentRow:
    pub_id: str
    assignee_name: str


@dataclass(frozen=True)
class PatentUpdate:
    pub_id: str
    canonical_id: str
    alias_id: str


SELECT_BATCH_SQL = """
SELECT p.pub_id, p.assignee_name
FROM patent p
WHERE p.assignee_name IS NOT NULL
  AND (
        %(only_missing)s = FALSE
        OR p.canonical_assignee_name_id IS NULL
        OR p.assignee_alias_id IS NULL
        OR NOT EXISTS (
            SELECT 1
            FROM patent_assignee pa
            WHERE pa.pub_id = p.pub_id
        )
      )
  AND p.pub_id > %(after_pub_id)s
ORDER BY p.pub_id
LIMIT %(batch_size)s;
"""


def query_patent_batch(conn: PgConn, after_pub_id: str, batch_size: int, only_missing: bool) -> list[PatentRow]:
    with conn.cursor() as cur:
        cur.execute(
            SELECT_BATCH_SQL,
            {
                "after_pub_id": after_pub_id,
                "batch_size": batch_size,
                "only_missing": only_missing,
            },
        )
        rows = cur.fetchall()
    out: list[PatentRow] = []
    for r in rows or []:
        # Row order: pub_id, assignee_name
        if r[0] is None or r[1] is None:
            continue
        out.append(PatentRow(pub_id=str(r[0]), assignee_name=str(r[1])))
    return out


def upsert_canonical_names(conn: PgConn, canon_names: Iterable[str]) -> dict[str, str]:
    """Upsert canonical names and return mapping name -> id.

    Uses a single multi-row INSERT with ON CONFLICT DO UPDATE ... RETURNING
    so we get ids for both inserted and existing rows.
    """
    values = list({n for n in canon_names if n})
    if not values:
        return {}
    placeholders = sql.SQL(",").join(sql.SQL("(%s)") for _ in values)
    query = sql.SQL(
        """
        INSERT INTO canonical_assignee_name (canonical_assignee_name)
        VALUES {values}
        ON CONFLICT (canonical_assignee_name)
        DO UPDATE SET canonical_assignee_name = EXCLUDED.canonical_assignee_name
        RETURNING id, canonical_assignee_name;
        """
    ).format(values=placeholders)
    with conn.cursor() as cur:
        cur.execute(query, values)
        rows = cur.fetchall() or []
    out: dict[str, str] = {}
    for rid, nm in rows:
        out[str(nm)] = str(rid)
    return out


def upsert_aliases(conn: PgConn, pairs: Iterable[tuple[str, str]]) -> dict[str, str]:
    """Upsert assignee_alias rows and return mapping alias -> id.

    pairs: Iterable of (alias_text, canonical_id)
    """
    vals = list({(a, c) for a, c in pairs if a and c})
    if not vals:
        return {}
    placeholders = sql.SQL(",").join(sql.SQL("(%s, %s)") for _ in vals)
    flat_params: list[str] = []
    for a, c in vals:
        flat_params.extend([a, c])
    query = sql.SQL(
        """
        INSERT INTO assignee_alias (assignee_alias, canonical_id)
        VALUES {values}
        ON CONFLICT (assignee_alias)
        DO UPDATE SET canonical_id = EXCLUDED.canonical_id
        RETURNING id, assignee_alias;
        """
    ).format(values=placeholders)
    with conn.cursor() as cur:
        cur.execute(query, flat_params)
        rows = cur.fetchall() or []
    out: dict[str, str] = {}
    for rid, alias in rows:
        out[str(alias)] = str(rid)
    return out


def update_patents(conn: PgConn, updates: Sequence[PatentUpdate]) -> int:
    """Bulk update patents: set canonical_assignee_name_id, assignee_alias_id by pub_id."""
    if not updates:
        return 0
    sql = (
        "UPDATE patent SET canonical_assignee_name_id = %s, assignee_alias_id = %s "
        "WHERE pub_id = %s"
    )
    params = [(u.canonical_id, u.alias_id, u.pub_id) for u in updates]
    with conn.cursor() as cur:
        cur.executemany(sql, params)
        # rowcount on executemany may be total updated rows or -1 depending on driver
        rc = cur.rowcount if getattr(cur, "rowcount", -1) is not None else -1
    return rc if rc is not None else 0


def insert_patent_assignees(conn: PgConn, updates: Sequence[PatentUpdate]) -> None:
    """Insert patent-assignee relationships for any newly canonicalized rows."""
    if not updates:
        return
    sql = """
        INSERT INTO patent_assignee (pub_id, alias_id, canonical_id, position)
        VALUES (%s, %s, %s, 1)
        ON CONFLICT (pub_id, alias_id) DO NOTHING
    """
    params = [(u.pub_id, u.alias_id, u.canonical_id) for u in updates]
    with conn.cursor() as cur:
        cur.executemany(sql, params)


def run(dsn: str, batch_size: int = 1000, limit: int | None = None, only_missing: bool = True) -> None:
    pool = ConnectionPool[PgConn](dsn, min_size=1, max_size=4)
    processed = 0
    total_updates = 0
    total_assignee_rows = 0
    last_pub_id = ""
    try:
        while True:
            if limit is not None and processed >= limit:
                break
            with pool.connection() as conn:
                batch = query_patent_batch(
                    conn,
                    after_pub_id=last_pub_id,
                    batch_size=min(batch_size, (limit - processed) if limit is not None else batch_size),
                    only_missing=only_missing,
                )
                if not batch:
                    break

                # Build canonical names
                canon_by_alias: dict[str, str] = {}
                for row in batch:
                    c = canonicalize_assignee(row.assignee_name)
                    if c:  # skip empties after normalization
                        canon_by_alias[row.assignee_name] = c

                # Upsert canonical names and capture ids
                canon_ids = upsert_canonical_names(conn, canon_by_alias.values())

                # Upsert aliases -> canonical ids
                alias_pairs: list[tuple[str, str]] = [
                    (alias, canon_ids.get(canon, ""))
                    for alias, canon in canon_by_alias.items()
                    if canon_ids.get(canon)
                ]
                alias_ids = upsert_aliases(conn, alias_pairs)

                # Prepare patent updates
                updates: list[PatentUpdate] = []
                for row in batch:
                    canon = canon_by_alias.get(row.assignee_name)
                    if not canon:
                        continue
                    canon_id = canon_ids.get(canon)
                    alias_id = alias_ids.get(row.assignee_name)
                    if canon_id and alias_id:
                        updates.append(
                            PatentUpdate(
                                pub_id=row.pub_id,
                                canonical_id=canon_id,
                                alias_id=alias_id,
                            )
                        )

                updated = update_patents(conn, updates)
                insert_patent_assignees(conn, updates)
                conn.commit()

                processed += len(batch)
                total_updates += len(updates)
                total_assignee_rows += len(updates)
                last_pub_id = batch[-1].pub_id

                logger.info(
                    "Batch processed: patents=%d, updates=%d, patent_assignee_rows=%d, last_pub_id=%s",
                    len(batch), len(updates), len(updates), last_pub_id,
                )

        logger.info(
            "Done. processed=%d, patent_updates=%d, patent_assignee_rows=%d",
            processed,
            total_updates,
            total_assignee_rows,
        )
    finally:
        try:
            pool.close()
        except Exception:
            pass


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Canonicalize assignee names and upsert mappings.")
    parser.add_argument(
        "--dsn",
        help="Postgres DSN. If omitted, uses DATABASE_URL env var.",
        default=os.getenv("DATABASE_URL", ""),
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=int(os.getenv("CANON_BATCH_SIZE", "1000")),
        help="Batch size for processing patents.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional cap on number of patents to process.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Process all rows regardless of existing IDs (default: only rows missing IDs).",
    )
    args = parser.parse_args(argv)

    dsn = args.dsn
    if not dsn:
        logger.error("DATABASE_URL or --dsn is required")
        return 2

    try:
        run(
            dsn=dsn,
            batch_size=max(1, args.batch_size),
            limit=args.limit,
            only_missing=(not args.all),
        )
        return 0
    except psycopg.Error as e:
        logger.error("Database error: %s", str(e).split("\n")[0])
        return 1
    except Exception as e:
        logger.exception("Fatal error: %s", e)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
