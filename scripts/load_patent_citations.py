#!/usr/bin/env python3
"""
load_patent_citations.py

Load patent citation rows from a CSV file into the patent_citation table.

CSV rows must contain three comma-separated values:
    1. citing_pub_id
    2. cited_pub_id
    3. cited_application_number

If a row with the same (citing_pub_id, cited_application_number) already
exists, it is skipped automatically via ON CONFLICT DO NOTHING.
"""

from __future__ import annotations

import argparse
import csv
import sys
import os
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

DEFAULT_DSN = os.getenv("PG_DSN", "")

INSERT_CITATION_SQL = """
INSERT INTO patent_citation (citing_pub_id, cited_pub_id, cited_application_number)
SELECT %(citing_pub_id)s, %(cited_pub_id)s, %(cited_application_number)s
WHERE EXISTS (SELECT 1 FROM patent WHERE pub_id = %(citing_pub_id)s)
"""


@dataclass(slots=True)
class CitationRecord:
    citing_pub_id: str
    cited_pub_id: str | None
    cited_application_number: str

    def as_params(self) -> dict[str, str | None]:
        return {
            "citing_pub_id": self.citing_pub_id,
            "cited_pub_id": self.cited_pub_id,
            "cited_application_number": self.cited_application_number,
        }


@dataclass
class ImportStats:
    read: int = 0
    valid: int = 0
    inserted: int = 0
    duplicates: int = 0
    invalid: int = 0
    skipped_no_patent: int = 0


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
            "Insert patent citations from a CSV file into the patent_citation table. "
            "Rows must be ordered as citing_pub_id,cited_pub_id,cited_application_number."
        )
    )
    parser.add_argument(
        "csv_file",
        help="Path to the CSV file to import.",
    )
    parser.add_argument(
        "--dsn",
        default=DEFAULT_DSN,
        help="Postgres DSN (defaults to the PG_DSN environment variable).",
    )
    parser.add_argument(
        "--batch-size",
        type=positive_int,
        default=500,
        help="Number of rows to insert per transaction (default: 500).",
    )
    parser.add_argument(
        "--skip-header",
        action="store_true",
        help="Skip the first row in the CSV file (useful when a header is present).",
    )
    return parser.parse_args()


def chunked(iterable: Iterator[CitationRecord], size: int) -> Iterator[list[CitationRecord]]:
    """Yield items from *iterable* in lists of length *size*."""
    chunk: list[CitationRecord] = []
    for item in iterable:
        chunk.append(item)
        if len(chunk) >= size:
            yield chunk
            chunk = []
    if chunk:
        yield chunk


def iter_citation_rows(
    csv_path: Path,
    skip_header: bool,
    stats: ImportStats,
) -> Iterator[CitationRecord]:
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
            if len(trimmed) < 3:
                stats.invalid += 1
                logger.warning("Row %d has fewer than 3 columns, skipping", line_no)
                continue

            citing_pub_id, cited_pub_id, cited_application_number = trimmed[:3]
            if not citing_pub_id or not cited_application_number:
                stats.invalid += 1
                logger.warning(
                    "Row %d missing citing_pub_id or cited_application_number, skipping",
                    line_no,
                )
                continue

            yield CitationRecord(
                citing_pub_id=citing_pub_id,
                cited_pub_id=cited_pub_id or None,
                cited_application_number=cited_application_number,
            )


@retry(
    wait=wait_random_exponential(min=1, max=30),
    stop=stop_after_attempt(5),
    retry=retry_if_exception_type((psycopg.OperationalError, psycopg.InterfaceError)),
)
def insert_citations_batch(
    pool: ConnectionPool[PgConn],
    batch: Sequence[CitationRecord],
) -> int:
    """Insert a batch of citation rows, returning the count of new rows."""
    if not batch:
        return 0

    with pool.connection() as conn, conn.cursor() as cur:
        inserted = 0
        for record in batch:
            cur.execute(INSERT_CITATION_SQL, record.as_params())
            inserted += cur.rowcount or 0
        conn.commit()
        return inserted


def load_citations(
    csv_path: Path,
    pool: ConnectionPool[PgConn],
    batch_size: int,
    skip_header: bool,
) -> ImportStats:
    stats = ImportStats()
    for batch in chunked(iter_citation_rows(csv_path, skip_header, stats), batch_size):
        stats.valid += len(batch)
        inserted = insert_citations_batch(pool, batch)
        stats.inserted += inserted
        skipped = len(batch) - inserted
        stats.duplicates += skipped
        stats.skipped_no_patent += skipped
        logger.info(
            "Processed %d valid rows (%d inserted, %d skipped)",
            stats.valid,
            stats.inserted,
            skipped,
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
        logger.error("Postgres DSN not provided. Set PG_DSN or pass --dsn.")
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
        stats = load_citations(csv_path, pool, args.batch_size, args.skip_header)
    except Exception:
        logger.exception("Failed to load patent citations")
        return 1
    finally:
        pool.close()

    logger.info(
        "Finished: %d lines read (%d valid, %d invalid). Inserted %d new rows, %d skipped (duplicates or missing patent).",
        stats.read,
        stats.valid,
        stats.invalid,
        stats.inserted,
        stats.duplicates,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
