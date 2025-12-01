#!/usr/bin/env python3
"""
upsert_patent_citations_from_csv.py

Upsert citation data from a CSV into patent_citation and cited_patent_assignee_raw.

CSV rows must contain four comma-separated values in this order:
    1. citing_pub_id
    2. cited_pub_id
    3. cited_application_number
    4. assignee_name_raw

The first three columns are upserted into patent_citation using
ON CONFLICT (citing_pub_id, cited_application_number).
Rows are skipped if citing_pub_id does not exist in patent (to avoid FK errors).

The last three columns (cited_pub_id, cited_application_number, assignee_name_raw)
are upserted into cited_patent_assignee_raw using
ON CONFLICT (pub_id, application_number).

Requires a Postgres DSN in PG_DSN or DATABASE_URL.
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Sequence

sys.path.insert(0, str(Path(__file__).parent.parent))

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

load_dotenv()
logger = setup_logger(__name__)

# psycopg generics
type PgConn = Connection[TupleRow]

DEFAULT_DSN = os.getenv("PG_DSN") or os.getenv("DATABASE_URL") or ""

UPSERT_CITATION_SQL = """
INSERT INTO patent_citation (citing_pub_id, cited_pub_id, cited_application_number)
SELECT %(citing_pub_id)s, %(cited_pub_id)s, %(cited_application_number)s
WHERE EXISTS (SELECT 1 FROM patent WHERE pub_id = %(citing_pub_id)s)
ON CONFLICT (citing_pub_id, cited_application_number)
DO UPDATE SET
    cited_pub_id = EXCLUDED.cited_pub_id,
    cited_application_number = EXCLUDED.cited_application_number
"""

UPSERT_CITED_ASSIGNEE_SQL = """
INSERT INTO cited_patent_assignee_raw (pub_id, application_number, assignee_name_raw)
VALUES (%(cited_pub_id)s, %(cited_application_number)s, %(assignee_name_raw)s)
ON CONFLICT (pub_id, application_number)
DO UPDATE SET assignee_name_raw = EXCLUDED.assignee_name_raw
"""


@dataclass(slots=True)
class CitationRow:
    citing_pub_id: str
    cited_pub_id: str
    cited_application_number: str
    assignee_name_raw: str | None

    def citation_params(self) -> dict[str, str | None]:
        return {
            "citing_pub_id": self.citing_pub_id,
            "cited_pub_id": self.cited_pub_id or None,
            "cited_application_number": self.cited_application_number,
        }

    def assignee_params(self) -> dict[str, str | None]:
        return {
            "cited_pub_id": self.cited_pub_id,
            "cited_application_number": self.cited_application_number,
            "assignee_name_raw": self.assignee_name_raw,
        }


@dataclass
class ImportStats:
    read: int = 0
    valid: int = 0
    invalid: int = 0
    citation_upserts: int = 0
    citation_skipped_missing_citing: int = 0
    assignee_upserts: int = 0


def positive_int(value: str) -> int:
    """Argparse helper to enforce positive integers."""
    try:
        parsed = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Must be a positive integer") from exc
    if parsed <= 0:
        raise argparse.ArgumentTypeError("Must be a positive integer")
    return parsed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Upsert patent citations and cited assignee raw data from a CSV file. "
            "Rows must be ordered as citing_pub_id,cited_pub_id,cited_application_number,assignee_name_raw."
        )
    )
    parser.add_argument(
        "csv_file",
        help="Path to the CSV file to import.",
    )
    parser.add_argument(
        "--dsn",
        default=DEFAULT_DSN,
        help="Postgres DSN (defaults to PG_DSN or DATABASE_URL).",
    )
    parser.add_argument(
        "--batch-size",
        type=positive_int,
        default=500,
        help="Number of rows to upsert per transaction (default: 500).",
    )
    parser.add_argument(
        "--skip-header",
        action="store_true",
        help="Skip the first row in the CSV file (useful when a header is present).",
    )
    return parser.parse_args()


def chunked(iterable: Iterator[CitationRow], size: int) -> Iterator[list[CitationRow]]:
    """Yield items from *iterable* in lists of length *size*."""
    chunk: list[CitationRow] = []
    for item in iterable:
        chunk.append(item)
        if len(chunk) >= size:
            yield chunk
            chunk = []
    if chunk:
        yield chunk


def iter_rows(
    csv_path: Path,
    skip_header: bool,
    stats: ImportStats,
) -> Iterator[CitationRow]:
    """Stream citation rows from the CSV, tracking basic stats."""
    with csv_path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.reader(handle)
        for line_no, row in enumerate(reader, start=1):
            stats.read += 1

            if skip_header and line_no == 1:
                continue

            if not row:
                stats.invalid += 1
                logger.warning("Row %d is empty, skipping", line_no)
                continue

            trimmed = [cell.strip() for cell in row]
            if len(trimmed) < 4:
                stats.invalid += 1
                logger.warning("Row %d has fewer than 4 columns, skipping", line_no)
                continue

            citing_pub_id, cited_pub_id, cited_application_number, assignee_name_raw = trimmed[:4]
            if not citing_pub_id or not cited_pub_id or not cited_application_number:
                stats.invalid += 1
                logger.warning(
                    "Row %d missing citing_pub_id, cited_pub_id, or cited_application_number, skipping",
                    line_no,
                )
                continue

            yield CitationRow(
                citing_pub_id=citing_pub_id,
                cited_pub_id=cited_pub_id,
                cited_application_number=cited_application_number,
                assignee_name_raw=assignee_name_raw or None,
            )


@retry(
    wait=wait_random_exponential(min=1, max=30),
    stop=stop_after_attempt(5),
    retry=retry_if_exception_type((psycopg.OperationalError, psycopg.InterfaceError)),
)
def upsert_batch(
    pool: ConnectionPool[PgConn],
    batch: Sequence[CitationRow],
    stats: ImportStats,
) -> None:
    """Upsert a batch of citation rows."""
    if not batch:
        return

    with pool.connection() as conn, conn.cursor() as cur:
        for record in batch:
            cur.execute(UPSERT_CITATION_SQL, record.citation_params())
            affected = cur.rowcount or 0
            stats.citation_upserts += affected
            if affected == 0:
                stats.citation_skipped_missing_citing += 1

            cur.execute(UPSERT_CITED_ASSIGNEE_SQL, record.assignee_params())
            stats.assignee_upserts += cur.rowcount or 0
        conn.commit()


def load_from_csv(
    csv_path: Path,
    pool: ConnectionPool[PgConn],
    batch_size: int,
    skip_header: bool,
) -> ImportStats:
    stats = ImportStats()
    for batch in chunked(iter_rows(csv_path, skip_header, stats), batch_size):
        stats.valid += len(batch)
        upsert_batch(pool, batch, stats)
        logger.info(
            "Processed %d valid rows (citation upserts: %d, assignee upserts: %d, citation skips missing citing: %d)",
            stats.valid,
            stats.citation_upserts,
            stats.assignee_upserts,
            stats.citation_skipped_missing_citing,
        )
    return stats


def main() -> int:
    args = parse_args()

    csv_path = Path(args.csv_file).expanduser()
    if not csv_path.is_file():
        logger.error("CSV file not found: %s", csv_path)
        return 1

    dsn = args.dsn.strip()
    if not dsn:
        logger.error("Postgres DSN not provided. Set PG_DSN/DATABASE_URL or pass --dsn.")
        return 2

    pool = ConnectionPool[PgConn](
        conninfo=dsn,
        min_size=1,
        max_size=4,
        kwargs={
            "autocommit": False,
            "prepare_threshold": None,
        },
    )

    try:
        stats = load_from_csv(csv_path, pool, args.batch_size, args.skip_header)
    except Exception:
        logger.exception("Failed to upsert patent citations and cited assignee raw data")
        return 1
    finally:
        pool.close()

    logger.info(
        "Finished: %d lines read (%d valid, %d invalid). Citation upserts: %d (skipped for missing citing patent: %d). Assignee upserts: %d.",
        stats.read,
        stats.valid,
        stats.invalid,
        stats.citation_upserts,
        stats.citation_skipped_missing_citing,
        stats.assignee_upserts,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
