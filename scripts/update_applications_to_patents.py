#!/usr/bin/env python3
"""
update_applications_to_patents.py

Promote granted applications from issued_patent_staging into the patent table.

For each staging row:
  - If the application_number exists in patent, update the row in place (including pub_id).
  - If it does not exist, insert a new patent row.
  - Immediately invalidate derived data: patent_embeddings, user_overview_analysis, knn_edge.
  - Rebuild |ta and |claims embeddings for the affected pub_ids.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from collections.abc import Iterator, Sequence

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from psycopg import Connection
from psycopg.rows import TupleRow
from psycopg_pool import ConnectionPool
from tenacity import retry, stop_after_attempt, wait_random_exponential

import scripts.etl_add_embeddings as emb
from infrastructure.logger import setup_logger

logger = setup_logger(__name__)

# -----------------------
# Configuration constants
# -----------------------
load_dotenv()

# psycopg generics
type PgConn = Connection[TupleRow]

# -------------
# SQL templates
# -------------

COUNT_STAGING_SQL = "SELECT COUNT(*) FROM issued_patent_staging;"

COUNT_MATCHING_SQL = """
SELECT COUNT(*)
FROM issued_patent_staging st
JOIN patent p ON p.application_number = st.application_number;
"""

COUNT_NEW_SQL = """
SELECT COUNT(*)
FROM issued_patent_staging st
WHERE NOT EXISTS (
    SELECT 1 FROM patent p WHERE p.application_number = st.application_number
);
"""

UPDATE_PATENT_SQL = """
UPDATE patent p
SET
    pub_id         = st.pub_id,
    kind_code      = COALESCE(st.kind_code, p.kind_code),
    title          = COALESCE(NULLIF(st.title, ''), p.title),
    abstract       = COALESCE(st.abstract, p.abstract),
    claims_text    = COALESCE(st.claims_text, p.claims_text),
    assignee_name  = COALESCE(st.assignee_name, p.assignee_name),
    inventor_name  = COALESCE(st.inventor_name, p.inventor_name),
    cpc            = COALESCE(st.cpc, p.cpc),
    family_id      = COALESCE(st.family_id, p.family_id),
    priority_date  = COALESCE(st.priority_date, p.priority_date),
    filing_date    = COALESCE(st.filing_date, p.filing_date),
    pub_date       = COALESCE(st.pub_date, p.pub_date),
    updated_at     = NOW()
FROM issued_patent_staging st
WHERE p.application_number = st.application_number
RETURNING st.pub_id;
"""

INSERT_NEW_PATENTS_SQL = """
INSERT INTO patent (
    pub_id,
    application_number,
    priority_date,
    family_id,
    kind_code,
    pub_date,
    filing_date,
    title,
    abstract,
    claims_text,
    assignee_name,
    inventor_name,
    cpc
)
SELECT
    st.pub_id,
    st.application_number,
    st.priority_date,
    st.family_id,
    st.kind_code,
    st.pub_date,
    st.filing_date,
    st.title,
    st.abstract,
    st.claims_text,
    st.assignee_name,
    st.inventor_name,
    st.cpc
FROM issued_patent_staging st
WHERE NOT EXISTS (
    SELECT 1 FROM patent p WHERE p.application_number = st.application_number
)
ON CONFLICT (pub_id) DO NOTHING
RETURNING pub_id;
"""

DELETE_EMBED_SQL = "DELETE FROM patent_embeddings WHERE pub_id = ANY(%(pub_ids)s);"
DELETE_OVERVIEW_SQL = "DELETE FROM user_overview_analysis WHERE pub_id = ANY(%(pub_ids)s);"

DELETE_KNN_SQL = """
DELETE FROM knn_edge
WHERE src = ANY(%(pub_ids)s)
   OR dst = ANY(%(pub_ids)s);
"""

SELECT_PATENTS_BY_IDS_SQL = """
SELECT pub_id, title, abstract, claims_text, pub_date
FROM patent
WHERE pub_id = ANY(%(pub_ids)s)
ORDER BY pub_id;
"""


# -----------
# Utilities
# -----------

def chunked(seq: Sequence, size: int) -> Iterator[list]:
    buf: list = []
    for item in seq:
        buf.append(item)
        if len(buf) >= size:
            yield buf
            buf = []
    if buf:
        yield buf


@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
def summarize_staging(pool: ConnectionPool[PgConn]) -> tuple[int, int, int]:
    """Return counts for staging rows, matches, and new grants."""
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(COUNT_STAGING_SQL)
        total = cur.fetchone()[0] or 0

        cur.execute(COUNT_MATCHING_SQL)
        matches = cur.fetchone()[0] or 0

        cur.execute(COUNT_NEW_SQL)
        new_grants = cur.fetchone()[0] or 0

    return int(total), int(matches), int(new_grants)


@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
def apply_updates_and_inserts(pool: ConnectionPool[PgConn]) -> tuple[list[str], list[str]]:
    """Update matching patents and insert new grants; invalidate derived tables."""
    updated_pub_ids: list[str] = []
    inserted_pub_ids: list[str] = []

    with pool.connection() as conn:
        try:
            with conn.cursor() as cur:
                cur.execute(UPDATE_PATENT_SQL)
                updated_pub_ids = [row[0] for row in cur.fetchall()]

                cur.execute(INSERT_NEW_PATENTS_SQL)
                inserted_pub_ids = [row[0] for row in cur.fetchall()]

                affected = sorted(set(updated_pub_ids + inserted_pub_ids))
                if affected:
                    cur.execute(DELETE_EMBED_SQL, {"pub_ids": affected})
                    cur.execute(DELETE_OVERVIEW_SQL, {"pub_ids": affected})
                    cur.execute(DELETE_KNN_SQL, {"pub_ids": affected})

            conn.commit()
        except Exception:
            conn.rollback()
            raise

    return updated_pub_ids, inserted_pub_ids


def fetch_patent_records(pool: ConnectionPool[PgConn], pub_ids: Sequence[str]) -> list[emb.PatentRecord]:
    """Load patent rows for embedding regeneration."""
    if not pub_ids:
        return []

    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(SELECT_PATENTS_BY_IDS_SQL, {"pub_ids": list(pub_ids)})
        rows = cur.fetchall()

    return [
        emb.PatentRecord(
            pub_id=row[0],
            title=row[1],
            abstract=row[2],
            claims_text=row[3],
            pub_date=row[4],
        )
        for row in rows
    ]


def refresh_embeddings(
    pool: ConnectionPool[PgConn],
    pub_ids: Sequence[str],
    batch_size: int,
) -> tuple[int, int]:
    """Regenerate title/abstract and claims embeddings for the given pub_ids."""
    records = fetch_patent_records(pool, pub_ids)
    if not records:
        return (0, 0)

    client = emb.get_openai_client()

    total_upserted = 0
    total_targets = 0

    for batch in chunked(records, batch_size):
        upserted, targets = emb.ensure_embeddings_for_batch(pool, client, batch)
        total_upserted += upserted
        total_targets += targets

    return total_upserted, total_targets


# -----------
# CLI / main
# -----------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Update patent table with granted publications from issued_patent_staging.",
    )
    parser.add_argument(
        "--dsn",
        default=os.getenv("PG_DSN") or os.getenv("DATABASE_URL") or "",
        help="Postgres DSN (defaults to PG_DSN or DATABASE_URL).",
    )
    parser.add_argument(
        "--embed-batch-size",
        type=int,
        default=100,
        help="Number of patents to embed per batch (default: 100).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show planned updates/inserts without modifying the database.",
    )
    parser.add_argument(
        "--skip-embeddings",
        action="store_true",
        help="Update/insert records but skip embedding regeneration.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not args.dsn:
        logger.error("PG_DSN not set and --dsn not provided")
        return 2

    pool = ConnectionPool[PgConn](
        conninfo=args.dsn,
        max_size=10,
        kwargs={
            "autocommit": False,
            "sslmode": "require",
            "prepare_threshold": None,
            "channel_binding": "require",
        },
    )

    try:
        total, matches, new_grants = summarize_staging(pool)
        logger.info(
            "issued_patent_staging rows: %s (matching applications: %s, new grants: %s)",
            total,
            matches,
            new_grants,
        )

        if total == 0:
            logger.info("Nothing to process; exiting.")
            return 0

        if args.dry_run:
            logger.info(
                "Dry run: would update %s existing patents and insert %s new grants.",
                matches,
                new_grants,
            )
            logger.info(
                "Dry run: would delete embeddings/overview/knn rows and regenerate embeddings for affected pub_ids.",
            )
            return 0

        updated_pub_ids, inserted_pub_ids = apply_updates_and_inserts(pool)
        affected_pub_ids = sorted(set(updated_pub_ids + inserted_pub_ids))

        logger.info(
            "Updated %s patent rows; inserted %s new grants; affected pub_ids: %s",
            len(updated_pub_ids),
            len(inserted_pub_ids),
            len(affected_pub_ids),
        )

        if not affected_pub_ids:
            logger.info("No affected pub_ids after update/insert; exiting.")
            return 0

        if args.skip_embeddings:
            logger.info("Skipping embedding regeneration per --skip-embeddings flag.")
            return 0

        upserted, targets = refresh_embeddings(
            pool,
            affected_pub_ids,
            batch_size=max(1, args.embed_batch_size),
        )
        logger.info(
            "Embedding refresh complete: upserted %s embeddings out of %s targets for %s pub_ids.",
            upserted,
            targets,
            len(affected_pub_ids),
        )
        return 0
    except Exception as exc:
        logger.error("Failed to update applications to patents: %s", exc, exc_info=True)
        return 1
    finally:
        pool.close()


if __name__ == "__main__":
    raise SystemExit(main())
