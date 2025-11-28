#!/usr/bin/env python3
"""
backfill_cited_patent_assignee.py

Populate cited_patent_assignee from cited_patent_assignee_raw_dedup using
assignee names obtained from USPTO ODP, while reusing the same
canonicalization + upsert logic as scripts/add_canon_name.py.

Key design points:

- Assignee is a property of the patent/application, not of the citation row.
- cited_patent_assignee enforces one row per pub_id and one row per
  application_number via UNIQUE constraints.
- In practice, the same application_number may have multiple pub_id values
  (e.g., pre-grant publication and later-issued patent, or formatting variants
  like "US-20040083092-A1" vs "US-2004083092-A1").

To handle this without violating constraints:

- For each incoming (pub_id, application_number, assignee_name_raw):
  - Look up any existing cited_patent_assignee row where pub_id OR
    application_number matches.
  - If found: UPDATE that row in-place (optionally filling in missing
    pub_id/application_number), never inserting a second row for the same
    application_number.
  - If not found: INSERT a new row.

This script is idempotent and safe to re-run.

Usage:

    python scripts/backfill_cited_patent_assignee.py \
        --dsn "$DATABASE_URL" \
        --batch-size 1000 \
        --limit 50000

If --dsn is omitted, DATABASE_URL from the environment is used.
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from typing import Iterable, Sequence

import psycopg
from psycopg import Connection
from psycopg.rows import TupleRow
from psycopg_pool import ConnectionPool
from dotenv import load_dotenv

from infrastructure.logger import setup_logger

# Reuse canonicalization + upsert logic from add_canon_name.py
try:
    # If run as `python -m scripts.backfill_cited_patent_assignee`
    from scripts.add_canon_name import (
        canonicalize_assignee,
        upsert_aliases,
        upsert_canonical_names,
    )
except ImportError:
    # If run as `python scripts/backfill_cited_patent_assignee.py`
    from add_canon_name import (  # type: ignore[no-redef]
        canonicalize_assignee,
        upsert_aliases,
        upsert_canonical_names,
    )

logger = setup_logger(__name__)
load_dotenv()

PgConn = Connection[TupleRow]


@dataclass(frozen=True)
class RawCitedRow:
    """Row from cited_patent_assignee_raw_dedup that still needs mapping."""

    pub_id: str | None
    application_number: str | None
    assignee_name_raw: str
    sort_key: str


@dataclass(frozen=True)
class CitedAssigneeUpdate:
    """Resolved assignee mapping ready to be upserted into cited_patent_assignee."""

    pub_id: str | None
    application_number: str | None
    assignee_name_raw: str
    canonical_id: str
    alias_id: str


SELECT_BATCH_SQL = """
SELECT
    r.pub_id,
    r.application_number,
    r.assignee_name_raw,
    COALESCE(r.pub_id, r.application_number, '') AS sort_key
FROM cited_patent_assignee_raw_dedup AS r
LEFT JOIN cited_patent_assignee AS c
  ON (
        c.pub_id IS NOT NULL
    AND r.pub_id IS NOT NULL
    AND c.pub_id = r.pub_id
  )
  OR (
        c.application_number IS NOT NULL
    AND r.application_number IS NOT NULL
    AND c.application_number = r.application_number
  )
WHERE
    -- Only rows that are not yet in cited_patent_assignee
    (c.pub_id IS NULL AND c.application_number IS NULL)
    -- Simple monotonic progression by combined identifier
    AND COALESCE(r.pub_id, r.application_number, '') > %(after_key)s
ORDER BY COALESCE(r.pub_id, r.application_number, '')
LIMIT %(batch_size)s;
"""


def fetch_raw_batch(
    conn: PgConn,
    after_key: str,
    batch_size: int,
) -> list[RawCitedRow]:
    """Fetch the next batch of raw cited-assignee rows needing resolution."""
    with conn.cursor() as cur:
        cur.execute(
            SELECT_BATCH_SQL,
            {
                "after_key": after_key,
                "batch_size": batch_size,
            },
        )
        rows = cur.fetchall() or []

    out: list[RawCitedRow] = []
    for pub_id, app_no, assignee_name_raw, sort_key in rows:
        pub_id_s = str(pub_id) if pub_id is not None else None
        app_no_s = str(app_no) if app_no is not None else None
        assignee_raw_s = (assignee_name_raw or "").strip()
        sort_key_s = str(sort_key or "")

        if not assignee_raw_s:
            # No usable assignee name; skip and log for later inspection.
            logger.debug(
                "Skipping row with empty assignee_name_raw: pub_id=%s, application_number=%s",
                pub_id_s,
                app_no_s,
            )
            continue

        out.append(
            RawCitedRow(
                pub_id=pub_id_s,
                application_number=app_no_s,
                assignee_name_raw=assignee_raw_s,
                sort_key=sort_key_s,
            )
        )

    return out


def build_updates_from_batch(
    conn: PgConn,
    batch: Sequence[RawCitedRow],
) -> list[CitedAssigneeUpdate]:
    """
    Given a batch of RawCitedRow, canonicalize and upsert into
    canonical_assignee_name and assignee_alias, then return the resolved
    mappings as CitedAssigneeUpdate objects.

    This reuses:
      - canonicalize_assignee()
      - upsert_canonical_names()
      - upsert_aliases()
    from add_canon_name.py to ensure consistent behavior and to avoid
    inserting duplicate canonical/alias rows.
    """
    if not batch:
        return []

    # 1) Build alias -> canonical string map (local, in-memory).
    canon_by_alias: dict[str, str] = {}
    for row in batch:
        c = canonicalize_assignee(row.assignee_name_raw)
        if not c:
            continue
        canon_by_alias[row.assignee_name_raw] = c

    if not canon_by_alias:
        return []

    # 2) Upsert canonical names and resolve to IDs.
    canon_ids = upsert_canonical_names(conn, canon_by_alias.values())
    # canon_ids: canonical_name -> id

    # 3) Upsert alias mappings and resolve to IDs.
    alias_pairs: list[tuple[str, str]] = []
    for alias, canon in canon_by_alias.items():
        canon_id = canon_ids.get(canon)
        if not canon_id:
            continue
        alias_pairs.append((alias, canon_id))

    alias_ids = upsert_aliases(conn, alias_pairs)
    # alias_ids: alias_text -> id

    # 4) Construct CitedAssigneeUpdate objects.
    updates: list[CitedAssigneeUpdate] = []
    for row in batch:
        canon = canon_by_alias.get(row.assignee_name_raw)
        if not canon:
            continue
        canon_id = canon_ids.get(canon)
        alias_id = alias_ids.get(row.assignee_name_raw)
        if not canon_id or not alias_id:
            continue
        updates.append(
            CitedAssigneeUpdate(
                pub_id=row.pub_id,
                application_number=row.application_number,
                assignee_name_raw=row.assignee_name_raw,
                canonical_id=canon_id,
                alias_id=alias_id,
            )
        )

    return updates

def upsert_cited_assignees(conn: PgConn, updates: Sequence[CitedAssigneeUpdate]) -> None:
    """
    Upsert into cited_patent_assignee without violating UNIQUE(pub_id) or
    UNIQUE(application_number), even when:

      - multiple pub_id values share the same application_number (e.g.,
        pre-grant publication and issued patent), or
      - the same publication is represented with different formatting of the
        publication number (e.g., 10 vs 11 digits).

    Strategy per update:

      1. Look for an existing row by pub_id or application_number.
      2. If found, UPDATE that row (and fill in missing pub_id/application_number
         if possible).
      3. If not found, INSERT a new row.

    This guarantees at most one row per application_number and one row per
    pub_id, so database constraints are never violated.
    """
    if not updates:
        return

    with conn.cursor() as cur:
        for u in updates:
            # Step 1: find any existing row matching by pub_id OR application_number.
            cur.execute(
                """
                SELECT id, pub_id, application_number
                FROM cited_patent_assignee
                WHERE
                    (pub_id = %(pub_id)s)
                    OR (application_number = %(app_no)s)
                LIMIT 1;
                """,
                {"pub_id": u.pub_id, "app_no": u.application_number},
            )
            row = cur.fetchone()

            if row:
                existing_id, existing_pub_id, existing_app_no = row

                # Optional: log when we see conflicting representations for the same asset.
                if (
                    u.pub_id
                    and existing_pub_id
                    and u.pub_id != existing_pub_id
                ):
                    logger.debug(
                        "Pub-id variant detected for same asset: existing=%s, new=%s, app_no=%s",
                        existing_pub_id,
                        u.pub_id,
                        existing_app_no or u.application_number,
                    )

                # Step 2: UPDATE in place, optionally filling in missing identifiers.
                cur.execute(
                    """
                    UPDATE cited_patent_assignee
                    SET
                        canonical_assignee_name_id = %(canonical_id)s,
                        assignee_alias_id          = %(alias_id)s,
                        assignee_name_raw          = %(assignee_name_raw)s,
                        pub_id = COALESCE(pub_id, %(pub_id)s),
                        application_number = COALESCE(application_number, %(app_no)s),
                        source = 'uspto_odp',
                        updated_at = NOW()
                    WHERE id = %(id)s;
                    """,
                    {
                        "canonical_id": u.canonical_id,
                        "alias_id": u.alias_id,
                        "assignee_name_raw": u.assignee_name_raw,
                        "pub_id": u.pub_id,
                        "app_no": u.application_number,
                        "id": existing_id,
                    },
                )
            else:
                # Step 3: INSERT a new row.
                cur.execute(
                    """
                    INSERT INTO cited_patent_assignee (
                        pub_id,
                        application_number,
                        canonical_assignee_name_id,
                        assignee_alias_id,
                        assignee_name_raw,
                        source
                    )
                    VALUES (%(pub_id)s, %(app_no)s, %(canonical_id)s, %(alias_id)s, %(assignee_name_raw)s, 'uspto_odp');
                    """,
                    {
                        "pub_id": u.pub_id,
                        "app_no": u.application_number,
                        "canonical_id": u.canonical_id,
                        "alias_id": u.alias_id,
                        "assignee_name_raw": u.assignee_name_raw,
                    },
                )


def run(
    dsn: str,
    batch_size: int = 1000,
    limit: int | None = None,
) -> None:
    """
    Main driver: iteratively pull raw rows, resolve assignees, and upsert.

    Parameters:
        dsn: Postgres DSN string.
        batch_size: number of rows from cited_patent_assignee_raw_dedup per batch.
        limit: optional cap on total rows processed (for testing).
    """
    pool = ConnectionPool[PgConn](dsn, min_size=1, max_size=4)

    processed = 0
    total_updates = 0
    last_key = ""

    logger.info(
        "Starting cited_patent_assignee backfill: batch_size=%d, limit=%s",
        batch_size,
        limit,
    )

    try:
        while True:
            if limit is not None and processed >= limit:
                break

            with pool.connection() as conn:
                batch = fetch_raw_batch(
                    conn,
                    after_key=last_key,
                    batch_size=min(
                        batch_size,
                        (limit - processed) if limit is not None else batch_size,
                    ),
                )

                if not batch:
                    break

                # Resolve canonical + alias ids using shared logic.
                updates = build_updates_from_batch(conn, batch)

                # Upsert cited_patent_assignee.
                upsert_cited_assignees(conn, updates)

                # Commit all changes for this batch.
                conn.commit()

                processed += len(batch)
                total_updates += len(updates)
                last_key = batch[-1].sort_key

            logger.info(
                "Batch processed: raw_rows=%d, updates=%d, total_processed=%d, last_key=%s",
                len(batch),
                len(updates),
                processed,
                last_key,
            )

        logger.info(
            "Done backfilling cited_patent_assignee: raw_rows_processed=%d, updates=%d",
            processed,
            total_updates,
        )
    finally:
        try:
            pool.close()
        except Exception:
            # Non-fatal
            pass


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Backfill cited_patent_assignee from cited_patent_assignee_raw_dedup "
            "using existing assignee canonicalization logic."
        ),
    )
    parser.add_argument(
        "--dsn",
        help="Postgres DSN. If omitted, uses DATABASE_URL env var.",
        default=os.getenv("DATABASE_URL", ""),
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=int(os.getenv("CITED_ASSIGNEE_BATCH_SIZE", "1000")),
        help="Batch size for processing cited_patent_assignee_raw_dedup.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional maximum number of raw rows to process (for testing).",
    )

    args = parser.parse_args(argv)

    dsn = args.dsn or os.getenv("DATABASE_URL", "")
    if not dsn:
        logger.error("No DSN provided. Use --dsn or set DATABASE_URL.")
        return 1

    try:
        run(
            dsn=dsn,
            batch_size=args.batch_size,
            limit=args.limit,
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
