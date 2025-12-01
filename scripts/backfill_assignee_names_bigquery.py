#!/usr/bin/env python3
"""
Backfill missing patent.assignee_name values using BigQuery patent publications.

Process:
- Find the latest publication_date in `patents-public-data.patents.publications`.
- Scan patent rows where assignee_name IS NULL and pub_date <= latest publication_date.
- Fetch assignee names from BigQuery (unnesting assignee_harmonized) by pub_id.
- Update patent.assignee_name for rows with a found value.

Note:
- Run scripts/add_canon_name.py after this to populate canon names.
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from typing import Iterable, Iterator

import psycopg
from dotenv import load_dotenv
from google.cloud import bigquery
from psycopg import Connection
from psycopg.rows import TupleRow

from infrastructure.logger import setup_logger

load_dotenv()
logger = setup_logger(__name__)

type PgConn = Connection[TupleRow]


SELECT_MISSING_SQL = """
SELECT pub_id
FROM patent
WHERE assignee_name IS NULL
  AND pub_date IS NOT NULL
  AND pub_date <= %(max_pub_date)s
  AND pub_id > %(after_pub_id)s
ORDER BY pub_id
LIMIT %(batch_size)s;
"""

UPDATE_ASSIGNEE_SQL = """
UPDATE patent
SET assignee_name = %(assignee_name)s,
    updated_at = NOW()
WHERE pub_id = %(pub_id)s;
"""

BQ_ASSIGNEE_SQL = """
SELECT
  publication_number AS pub_id,
  (SELECT an.name FROM UNNEST(assignee_harmonized) an WHERE an.name IS NOT NULL LIMIT 1) AS assignee_name
FROM `patents-public-data.patents.publications`
WHERE publication_number IN UNNEST(@pub_ids)
  AND publication_date IS NOT NULL
  AND publication_date <= @max_pub_date
"""


@dataclass
class Stats:
    scanned: int = 0
    updated: int = 0
    missing_in_bq: int = 0


def chunked(iterable: Iterable, size: int) -> Iterator[list]:
    buf: list = []
    for item in iterable:
        buf.append(item)
        if len(buf) >= size:
            yield buf
            buf = []
    if buf:
        yield buf


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill patent.assignee_name using BigQuery patents-public-data source"
    )
    parser.add_argument(
        "--dsn",
        default=os.getenv("PG_DSN") or os.getenv("DATABASE_URL", ""),
        help="Postgres DSN (defaults to PG_DSN or DATABASE_URL)",
    )
    parser.add_argument(
        "--project",
        default=os.getenv("BQ_PROJECT", "patent-scout-etl"),
        help="BigQuery project id (default: env BQ_PROJECT or patent-scout-etl)",
    )
    parser.add_argument(
        "--location",
        default=os.getenv("BQ_LOCATION"),
        help="BigQuery location/region (optional)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="DB batch size for selecting missing patents (default: 500)",
    )
    parser.add_argument(
        "--bq-batch-size",
        type=int,
        default=300,
        help="Batch size for BigQuery IN lookups (default: 300)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Max patents to process (0 = no limit)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch names but do not write updates",
    )
    return parser.parse_args()


def latest_publication_date(client: bigquery.Client) -> int | None:
    sql = "SELECT MAX(publication_date) AS max_pub_date FROM `patents-public-data.patents.publications`"
    row = next(client.query(sql).result(), None)
    max_pub_date = row["max_pub_date"] if row else None
    logger.info("Latest publication_date in BigQuery: %s", max_pub_date)
    return int(max_pub_date) if max_pub_date is not None else None


def fetch_missing_pub_ids(conn: PgConn, after_pub_id: str, batch_size: int, max_pub_date: int) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            SELECT_MISSING_SQL,
            {
                "after_pub_id": after_pub_id,
                "batch_size": batch_size,
                "max_pub_date": max_pub_date,
            },
        )
        rows = cur.fetchall()
    return [row[0] for row in rows if row and row[0]]


def fetch_assignee_names(client: bigquery.Client, pub_ids: list[str], max_pub_date: int) -> dict[str, str]:
    if not pub_ids:
        return {}
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ArrayQueryParameter("pub_ids", "STRING", pub_ids),
            bigquery.ScalarQueryParameter("max_pub_date", "INT64", max_pub_date),
        ]
    )
    job = client.query(BQ_ASSIGNEE_SQL, job_config=job_config)
    result = {}
    for row in job.result():
        name = row.get("assignee_name")
        if name:
            result[row["pub_id"]] = name
    return result


def update_assignee(conn: PgConn, pub_id: str, assignee_name: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            UPDATE_ASSIGNEE_SQL,
            {"assignee_name": assignee_name, "pub_id": pub_id},
        )
        return cur.rowcount > 0


def backfill_assignees(
    conn: PgConn,
    client: bigquery.Client,
    latest_bq_pub_date: int,
    batch_size: int,
    bq_batch_size: int,
    limit: int,
    dry_run: bool,
) -> Stats:
    stats = Stats()
    after_pub_id = ""

    while True:
        remaining = limit - stats.scanned if limit else None
        if remaining is not None and remaining <= 0:
            break

        batch = fetch_missing_pub_ids(
            conn,
            after_pub_id=after_pub_id,
            batch_size=batch_size if remaining is None else min(batch_size, remaining),
            max_pub_date=latest_bq_pub_date,
        )
        if not batch:
            break

        stats.scanned += len(batch)

        for chunk in chunked(batch, bq_batch_size):
            bq_names = fetch_assignee_names(client, chunk, latest_bq_pub_date)
            updated_any = False
            for pub_id in chunk:
                assignee_name = bq_names.get(pub_id)
                if not assignee_name:
                    stats.missing_in_bq += 1
                    continue
                if dry_run:
                    stats.updated += 1
                    continue
                if update_assignee(conn, pub_id, assignee_name):
                    stats.updated += 1
                    updated_any = True
            if not dry_run and updated_any:
                conn.commit()

        after_pub_id = batch[-1]

    return stats


def build_bq_client(project: str, location: str | None) -> bigquery.Client:
    if location:
        return bigquery.Client(project=project, location=location)
    return bigquery.Client(project=project)


def main() -> int:
    args = parse_args()
    dsn = args.dsn

    if not dsn:
        logger.error("Postgres DSN not provided via --dsn, PG_DSN, or DATABASE_URL")
        return 1

    try:
        bq_client = build_bq_client(args.project, args.location)
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("Failed to create BigQuery client: %s", exc)
        return 1

    latest_bq_pub_date = latest_publication_date(bq_client)
    if latest_bq_pub_date is None:
        logger.error("Could not determine latest publication_date from BigQuery")
        return 1

    try:
        conn = psycopg.connect(dsn)
    except psycopg.Error as exc:
        logger.error("Database connection failed: %s", exc)
        return 1

    try:
        stats = backfill_assignees(
            conn=conn,
            client=bq_client,
            latest_bq_pub_date=latest_bq_pub_date,
            batch_size=args.batch_size,
            bq_batch_size=args.bq_batch_size,
            limit=args.limit,
            dry_run=args.dry_run,
        )
    finally:
        try:
            conn.close()
        except psycopg.Error:
            pass

    logger.info(
        "Backfill complete: scanned=%s updated=%s missing_in_bq=%s latest_bq_pub_date=%s",
        stats.scanned,
        stats.updated,
        stats.missing_in_bq,
        latest_bq_pub_date,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
