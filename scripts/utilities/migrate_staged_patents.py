#!/usr/bin/env python3
"""
migrate_staged_patents.py

Migrate patents from patent_staging to patent table with AI keyword filtering.

Process:
1. Delete non-AI entries from patent_staging
2. Migrate all entries from patent_staging to patent with conflict resolution
3. Delete all entries from patent_staging
4. Invoke etl_add_embeddings.py for the date range of migrated patents
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import datetime, timedelta
from typing import Any

import psycopg
from dotenv import load_dotenv
from psycopg import Connection
from psycopg.rows import TupleRow
from psycopg_pool import ConnectionPool
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_random_exponential,
)

from infrastructure.logger import setup_logger

logger = setup_logger(__name__)

# -----------------------
# Configuration defaults
# -----------------------
load_dotenv()

# AI keywords for filtering (case-insensitive, allow wildcards)
AI_KEYWORDS = [
    "artificial intelligence",
    "artificial-intelligence",
    "neural network",
    "neural-network",
    "machine learning",
    "machine-learning",
]

# psycopg generics
type PgConn = Connection[TupleRow]

# -------------
# SQL templates
# -------------

DELETE_NON_AI_SQL = """
DELETE FROM patent_staging
WHERE NOT (
    -- Title contains AI keywords (case-insensitive)
    title ILIKE ANY(%(keywords)s)
    -- Abstract contains AI keywords (case-insensitive)
    OR abstract ILIKE ANY(%(keywords)s)
    -- Claims text contains AI keywords (case-insensitive)
    OR claims_text ILIKE ANY(%(keywords)s)
);
"""

COUNT_STAGING_SQL = """
SELECT COUNT(*) FROM patent_staging;
"""

SELECT_STAGING_DATE_RANGE_SQL = """
SELECT MIN(pub_date) AS min_date, MAX(pub_date) AS max_date
FROM patent_staging
WHERE pub_date IS NOT NULL;
"""

SELECT_STAGING_BATCH_SQL = """
SELECT
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
FROM patent_staging
ORDER BY pub_id
LIMIT %(batch_size)s
OFFSET %(offset)s;
"""

# Check if patent exists with same pub_id but later pub_date
CHECK_PUB_ID_CONFLICT_SQL = """
SELECT pub_id, pub_date, application_number
FROM patent
WHERE pub_id = %(pub_id)s;
"""

# Check if patent exists with same application_number
CHECK_APP_NUM_CONFLICT_SQL = """
SELECT pub_id, pub_date, application_number
FROM patent
WHERE application_number = %(application_number)s
  AND application_number IS NOT NULL;
"""

# Delete existing patent by pub_id
DELETE_BY_PUB_ID_SQL = """
DELETE FROM patent WHERE pub_id = %(pub_id)s;
"""

# Upsert patent
UPSERT_PATENT_SQL = """
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
) VALUES (
    %(pub_id)s,
    %(application_number)s,
    %(priority_date)s,
    %(family_id)s,
    %(kind_code)s,
    %(pub_date)s,
    %(filing_date)s,
    %(title)s,
    %(abstract)s,
    %(claims_text)s,
    %(assignee_name)s,
    %(inventor_name)s,
    %(cpc)s
)
ON CONFLICT (pub_id) DO UPDATE SET
    application_number = EXCLUDED.application_number,
    priority_date     = EXCLUDED.priority_date,
    family_id         = EXCLUDED.family_id,
    kind_code         = EXCLUDED.kind_code,
    pub_date          = EXCLUDED.pub_date,
    filing_date       = EXCLUDED.filing_date,
    title             = COALESCE(NULLIF(EXCLUDED.title, ''), patent.title),
    abstract          = COALESCE(EXCLUDED.abstract, patent.abstract),
    claims_text       = COALESCE(EXCLUDED.claims_text, patent.claims_text),
    assignee_name     = COALESCE(EXCLUDED.assignee_name, patent.assignee_name),
    inventor_name     = COALESCE(EXCLUDED.inventor_name, patent.inventor_name),
    cpc               = COALESCE(EXCLUDED.cpc, patent.cpc);
"""

DELETE_ALL_STAGING_SQL = """
DELETE FROM patent_staging;
"""


# ----------------------
# Database operations with retry logic
# ----------------------


@retry(
    wait=wait_random_exponential(min=1, max=60),
    stop=stop_after_attempt(6),
    retry=retry_if_exception_type((psycopg.OperationalError, psycopg.InterfaceError)),
)
def delete_non_ai_entries(pool: ConnectionPool[PgConn]) -> int:
    """
    Delete entries from patent_staging that don't contain AI keywords.

    Args:
        pool: Database connection pool.

    Returns:
        Number of rows deleted.
    """
    # Convert keywords to ILIKE patterns with wildcards
    patterns = [f"%{kw}%" for kw in AI_KEYWORDS]

    logger.info("Deleting non-AI entries from patent_staging...")
    logger.info("AI keywords: %s", AI_KEYWORDS)

    with pool.connection() as conn, conn.cursor() as cur:
        # Get count before deletion
        cur.execute("SELECT COUNT(*) FROM patent_staging")
        count_before_row = cur.fetchone()
        count_before = count_before_row[0] if count_before_row else 0
        logger.info("Entries in patent_staging before deletion: %d", count_before)

        # Delete non-AI entries
        cur.execute(DELETE_NON_AI_SQL, {"keywords": patterns})
        deleted = cur.rowcount

        cur.execute("SELECT COUNT(*) FROM patent_staging")
        count_after_row = cur.fetchone()
        count_after = count_after_row[0] if count_after_row else 0

        conn.commit()

    logger.info("Deleted %d non-AI entries from patent_staging", deleted)
    logger.info("Entries remaining in patent_staging: %d", count_after)

    return deleted


@retry(
    wait=wait_random_exponential(min=1, max=60),
    stop=stop_after_attempt(6),
    retry=retry_if_exception_type((psycopg.OperationalError, psycopg.InterfaceError)),
)
def get_staging_date_range(pool: ConnectionPool[PgConn]) -> tuple[int | None, int | None]:
    """
    Get the date range of entries in patent_staging.

    Args:
        pool: Database connection pool.

    Returns:
        Tuple of (min_pub_date, max_pub_date) as integers, or (None, None) if empty.
    """
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(SELECT_STAGING_DATE_RANGE_SQL)
        result = cur.fetchall()
        conn.commit()

    if result and result[0][0] is not None:
        return result[0][0], result[0][1]
    return None, None


def should_keep_existing(existing_pub_date: int | None, new_pub_date: int | None) -> bool:
    """
    Determine if existing entry should be kept over new entry.

    Args:
        existing_pub_date: Grant/Publication date of existing entry.
        new_pub_date: Grant/Publication date of new entry.

    Returns:
        True if existing should be kept, False if new should be kept.
    """
    # If new entry has no pub_date, keep existing
    if new_pub_date is None:
        return True

    # If existing has no pub_date, keep new
    if existing_pub_date is None:
        return False

    # Keep entry with later pub_date
    # If equal, keep existing
    return existing_pub_date >= new_pub_date


@retry(
    wait=wait_random_exponential(min=1, max=60),
    stop=stop_after_attempt(6),
    retry=retry_if_exception_type((psycopg.OperationalError, psycopg.InterfaceError)),
)
def migrate_single_patent(pool: ConnectionPool[PgConn], row: dict[str, Any]) -> bool:
    """
    Migrate a single patent from staging to main table with conflict resolution.

    Args:
        pool: Database connection pool.
        row: Patent data as dict.

    Returns:
        True if patent was upserted, False if skipped.
    """
    with pool.connection() as conn:
        try:
            with conn.cursor() as cur:
                pub_id = row["pub_id"]
                app_num = row["application_number"]
                new_pub_date = row["pub_date"]

                # Check for pub_id conflict
                cur.execute(CHECK_PUB_ID_CONFLICT_SQL, {"pub_id": pub_id})
                pub_id_conflict = cur.fetchone()

                if pub_id_conflict:
                    existing_pub_date = pub_id_conflict[1]
                    if should_keep_existing(existing_pub_date, new_pub_date):
                        logger.info(
                            "Skipping %s: existing pub_date %s >= new pub_date %s",
                            pub_id,
                            existing_pub_date,
                            new_pub_date,
                        )
                        conn.commit()
                        return False

                # Check for application_number conflict
                if app_num:
                    cur.execute(CHECK_APP_NUM_CONFLICT_SQL, {"application_number": app_num})
                    app_num_conflicts = cur.fetchall()

                    for conflict in app_num_conflicts:
                        conflict_pub_id = conflict[0]
                        conflict_pub_date = conflict[1]

                        # Skip if it's the same pub_id (already handled above)
                        if conflict_pub_id == pub_id:
                            continue

                        # If new entry has later pub_date, delete the old one
                        if not should_keep_existing(conflict_pub_date, new_pub_date):
                            logger.info(
                                "Deleting %s (pub_date=%s) in favor of %s (pub_date=%s) with same application_number %s",
                                conflict_pub_id,
                                conflict_pub_date,
                                pub_id,
                                new_pub_date,
                                app_num,
                            )
                            cur.execute(DELETE_BY_PUB_ID_SQL, {"pub_id": conflict_pub_id})
                        else:
                            logger.info(
                                "Skipping %s: existing entry %s with application_number %s has pub_date %s >= new pub_date %s",
                                pub_id,
                                conflict_pub_id,
                                app_num,
                                conflict_pub_date,
                                new_pub_date,
                            )
                            conn.commit()
                            return False

                # Upsert the patent
                cur.execute(UPSERT_PATENT_SQL, row)
                conn.commit()
                return True

        except Exception as e:
            logger.error("Error migrating patent %s: %s", row.get("pub_id"), e, exc_info=True)
            conn.rollback()
            raise


def migrate_patents_batch(
    pool: ConnectionPool[PgConn],
    batch_size: int = 100,
) -> tuple[int, int]:
    """
    Migrate all patents from patent_staging to patent in batches.

    Args:
        pool: Database connection pool.
        batch_size: Number of patents to process per batch.

    Returns:
        Tuple of (total_migrated, total_skipped).
    """
    logger.info("Starting migration from patent_staging to patent...")

    offset = 0
    total_migrated = 0
    total_skipped = 0

    while True:
        # Fetch batch
        with pool.connection() as conn, conn.cursor() as cur:
            cur.execute(SELECT_STAGING_BATCH_SQL, {"batch_size": batch_size, "offset": offset})
            result = cur.fetchall()
            conn.commit()

        if not result:
            logger.info("No more records to migrate")
            break

        logger.info("Processing batch at offset %d with %d records", offset, len(result))

        for row_tuple in result:
            # Convert tuple to dict
            row = {
                "pub_id": row_tuple[0],
                "application_number": row_tuple[1],
                "priority_date": row_tuple[2],
                "family_id": row_tuple[3],
                "kind_code": row_tuple[4],
                "pub_date": row_tuple[5],
                "filing_date": row_tuple[6],
                "title": row_tuple[7],
                "abstract": row_tuple[8],
                "claims_text": row_tuple[9],
                "assignee_name": row_tuple[10],
                "inventor_name": row_tuple[11],
                "cpc": row_tuple[12],
            }

            try:
                if migrate_single_patent(pool, row):
                    total_migrated += 1
                else:
                    total_skipped += 1
            except Exception as e:
                logger.error("Failed to migrate patent %s: %s", row["pub_id"], e)
                total_skipped += 1

        offset += len(result)

        # Break if we got fewer results than batch_size
        if len(result) < batch_size:
            break

    logger.info(
        "Migration complete: %d patents migrated, %d skipped",
        total_migrated,
        total_skipped,
    )

    return total_migrated, total_skipped


@retry(
    wait=wait_random_exponential(min=1, max=60),
    stop=stop_after_attempt(6),
    retry=retry_if_exception_type((psycopg.OperationalError, psycopg.InterfaceError)),
)
def delete_all_staging(pool: ConnectionPool[PgConn]) -> int:
    """
    Delete all entries from patent_staging.

    Args:
        pool: Database connection pool.

    Returns:
        Number of rows deleted.
    """
    logger.info("Deleting all entries from patent_staging...")

    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(DELETE_ALL_STAGING_SQL)
        deleted = cur.rowcount
        conn.commit()

    logger.info("Deleted %d entries from patent_staging", deleted)
    return deleted


def invoke_etl_add_embeddings(
    date_from: int,
    date_to: int,
    dsn: str,
) -> int:
    """
    Invoke etl_add_embeddings.py for the given date range.

    Args:
        date_from: Start date as YYYYMMDD integer.
        date_to: End date as YYYYMMDD integer.
        dsn: Database connection string.

    Returns:
        Exit code from etl_add_embeddings.py.
    """
    # Convert integer dates to ISO format with padding
    date_from_str = datetime.strptime(str(date_from), "%Y%m%d")
    date_to_str = datetime.strptime(str(date_to), "%Y%m%d")

    # Subtract/add one day as requested
    date_from_adjusted = (date_from_str - timedelta(days=1)).strftime("%Y-%m-%d")
    date_to_adjusted = (date_to_str + timedelta(days=1)).strftime("%Y-%m-%d")

    logger.info(
        "Invoking etl_add_embeddings.py with date range %s to %s",
        date_from_adjusted,
        date_to_adjusted,
    )

    cmd = [
        sys.executable,
        "etl_add_embeddings.py",
        "--date-from",
        date_from_adjusted,
        "--date-to",
        date_to_adjusted,
        "--dsn",
        dsn,
    ]

    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        logger.info("etl_add_embeddings.py output:\n%s", result.stdout)
        if result.stderr:
            logger.error("etl_add_embeddings.py stderr:\n%s", result.stderr)
        return result.returncode
    except subprocess.CalledProcessError as e:
        logger.error("etl_add_embeddings.py failed with exit code %d", e.returncode)
        logger.error("stdout:\n%s", e.stdout)
        logger.error("stderr:\n%s", e.stderr)
        return e.returncode


# -----------
# CLI / main
# -----------


def parse_args() -> argparse.Namespace:
    """
    Parse command-line arguments.

    Returns:
        Parsed arguments namespace.
    """
    p = argparse.ArgumentParser(
        description="Migrate patents from patent_staging to patent with AI filtering."
    )
    p.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Batch size for migration (default: 100)",
    )
    p.add_argument(
        "--dsn",
        default=os.getenv("PG_DSN", ""),
        help="Postgres DSN (default: from PG_DSN environment variable)",
    )
    p.add_argument(
        "--skip-cleanup",
        action="store_true",
        help="Skip deleting non-AI entries (for testing)",
    )
    p.add_argument(
        "--skip-embeddings",
        action="store_true",
        help="Skip invoking etl_add_embeddings.py",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )
    return p.parse_args()


def main() -> int:
    """
    Main entry point for the script.

    Returns:
        Exit code (0 for success, non-zero for error).
    """
    args = parse_args()

    if not args.dsn:
        logger.error("PG_DSN not set and --dsn not provided")
        return 2

    # Setup database pool
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
        # Step 1: Delete non-AI entries
        if not args.skip_cleanup and not args.dry_run:
            deleted = delete_non_ai_entries(pool)
            logger.info("Step 1 complete: deleted %d non-AI entries", deleted)
        elif args.dry_run:
            logger.info("Dry run: would delete non-AI entries")
        else:
            logger.info("Skipping cleanup step")

        # Get date range before migration
        min_date, max_date = get_staging_date_range(pool)
        if min_date is None or max_date is None:
            logger.info("No entries in patent_staging to migrate")
            return 0

        logger.info("Date range in patent_staging: %d to %d", min_date, max_date)

        # Step 2: Migrate patents
        if not args.dry_run:
            migrated, skipped = migrate_patents_batch(pool, batch_size=args.batch_size)
            logger.info(
                "Step 2 complete: migrated %d patents, skipped %d",
                migrated,
                skipped,
            )
        else:
            logger.info("Dry run: would migrate patents from patent_staging to patent")
            # Count how many would be migrated
            with pool.connection() as conn, conn.cursor() as cur:
                cur.execute(COUNT_STAGING_SQL)
                result = cur.fetchall()
                conn.commit()
            count = result[0][0] if result else 0
            logger.info("Would process %d patents", count)
            return 0

        # Step 3: Delete all from staging
        if not args.dry_run:
            deleted_staging = delete_all_staging(pool)
            logger.info("Step 3 complete: deleted %d entries from patent_staging", deleted_staging)

        # Step 4: Invoke etl_add_embeddings.py
        if not args.skip_embeddings and not args.dry_run:
            exit_code = invoke_etl_add_embeddings(min_date, max_date, args.dsn)
            if exit_code != 0:
                logger.error("etl_add_embeddings.py failed with exit code %d", exit_code)
                return exit_code
            logger.info("Step 4 complete: embeddings generated")
        elif args.skip_embeddings:
            logger.info("Skipping embeddings generation step")

        logger.info("Migration complete!")
        return 0

    except Exception as e:
        logger.error("Migration failed: %s", e, exc_info=True)
        return 1
    finally:
        pool.close()


if __name__ == "__main__":
    raise SystemExit(main())
