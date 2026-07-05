#!/usr/bin/env python3
"""
update_patent_staging.py

Update issued_patent_staging table with data from BigQuery patents-public-data.patents.publications.
Also stages independent claim text into patent_claim_staging for the matched grants.

Updates the following fields in issued_patent_staging based on matching application_number:
1. abstract from bqp.abstract_localized[SAFE_OFFSET(0)].text
2. claims_text from bqp.claims_localized[SAFE_OFFSET(0)].text
3. kind_code from bqp.kind_code
4. pub_id from bqp.publication_number
5. family_id from bqp.family_id
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from dataclasses import dataclass
from collections.abc import Iterator, Sequence
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from google.cloud import bigquery
from psycopg import Connection
from psycopg.rows import TupleRow
from psycopg_pool import ConnectionPool
from tenacity import retry, stop_after_attempt, wait_random_exponential

from infrastructure.logger import setup_logger

logger = setup_logger(__name__)

# -----------------------
# Configuration constants
# -----------------------
load_dotenv()

BQ_PROJECT = "patent-scout-etl"
BQ_LOCATION = os.getenv("BQ_LOCATION", None)
CREDENTIALS_PATH = ".secrets/patent-scout-etl-9ca3cd656391.json"

# Set credentials environment variable
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = CREDENTIALS_PATH

# psycopg generics
type PgConn = Connection[TupleRow]

# -------------
# SQL templates
# -------------

# BigQuery query to get data from patents-public-data.patents.publications
BQ_SQL_TEMPLATE = """
SELECT
    bqp.publication_number AS pub_id,
    bqp.application_number_formatted AS application_number,
    bqp.kind_code,
    bqp.family_id,
    bqp.abstract_localized[SAFE_OFFSET(0)].text AS abstract,
    bqp.claims_localized[SAFE_OFFSET(0)].text AS claims_text,
    (SELECT an.name FROM UNNEST(bqp.assignee_harmonized) an WHERE an.name IS NOT NULL LIMIT 1) AS assignee_name,
FROM 
    `patents-public-data.patents.publications` AS bqp
WHERE 
    bqp.application_number_formatted IN UNNEST(@application_numbers)
    AND bqp.application_number_formatted IS NOT NULL
    AND REGEXP_CONTAINS(bqp.publication_number, r"(?i)B[12]$")
"""

# SQL to get application numbers from issued_patent_staging
GET_APPLICATION_NUMBERS_SQL = """
SELECT DISTINCT application_number 
FROM issued_patent_staging 
WHERE application_number IS NOT NULL
  AND claims_text IS NULL
ORDER BY application_number
"""

# SQL to update issued_patent_staging with BigQuery data
UPDATE_PATENT_STAGING_SQL = """
UPDATE issued_patent_staging 
SET 
    abstract = COALESCE(%(abstract)s, abstract),
    claims_text = COALESCE(%(claims_text)s, claims_text),
    kind_code = COALESCE(%(kind_code)s, kind_code),
    pub_id = COALESCE(%(pub_id)s, pub_id),
    family_id = COALESCE(%(family_id)s, family_id),
    assignee_name = COALESCE(%(assignee_name)s, assignee_name),
    updated_at = NOW()
WHERE application_number = %(application_number)s
RETURNING pub_id, application_number
"""

UPSERT_CLAIM_STAGING_SQL = """
INSERT INTO patent_claim_staging (
    pub_id,
    claim_number,
    is_independent,
    claim_text
) VALUES (
    %(pub_id)s,
    %(claim_number)s,
    TRUE,
    %(claim_text)s
)
ON CONFLICT (pub_id, claim_number) DO UPDATE
SET
    claim_text = EXCLUDED.claim_text,
    is_independent = EXCLUDED.is_independent,
    updated_at = NOW();
"""

# Claim parsing patterns
CLAIM_START_RE = re.compile(r"(?m)^\s*(\d+)\.\s")
INDEPENDENT_CLAIM_RE = re.compile(r"(?mi)^\s*(\d+)\.\s{1,4}a[n]?\s")

# --------------
# Data structures
# --------------


@dataclass
class IndependentClaim:
    claim_number: int
    claim_text: str


class PatentUpdateRecord:
    def __init__(self, row: bigquery.Row):
        self.application_number = row.get("application_number")
        self.pub_id = row.get("pub_id")
        self.kind_code = row.get("kind_code")
        self.family_id = row.get("family_id")
        self.assignee_name = row.get("assignee_name")
        self.abstract = row.get("abstract")
        self.claims_text = row.get("claims_text")
        self.independent_claims = extract_independent_claims(self.claims_text)

    def to_dict(self) -> dict[str, Any]:
        return {
            "application_number": self.application_number,
            "pub_id": self.pub_id,
            "kind_code": self.kind_code,
            "family_id": self.family_id,
            "abstract": self.abstract,
            "assignee_name": self.assignee_name,
            "claims_text": self.claims_text,
        }

# -----------
# Utilities
# -----------

def chunked(iterable: Iterator, size: int) -> Iterator[list]:
    """Chunk an iterable into batches of specified size."""
    buf: list = []
    for item in iterable:
        buf.append(item)
        if len(buf) >= size:
            yield buf
            buf = []
    if buf:
        yield buf


def extract_independent_claims(claims_text: str | None) -> list[IndependentClaim]:
    """Extract independent claims from a claims blob using numbering heuristics.

    Independent claims start with "<num>. <spaces> A/An" and run until the next
    claim number or the end of the string. The returned claim_text excludes the
    leading number/dot prefix.
    """
    if not claims_text:
        return []

    boundaries = [m.start() for m in CLAIM_START_RE.finditer(claims_text)]
    if not boundaries:
        return []

    next_boundary_by_start = {
        start: boundaries[idx + 1] if idx + 1 < len(boundaries) else len(claims_text)
        for idx, start in enumerate(boundaries)
    }

    seen_numbers: set[int] = set()
    claims: list[IndependentClaim] = []
    for match in INDEPENDENT_CLAIM_RE.finditer(claims_text):
        start_idx = match.start()
        end_idx = next_boundary_by_start.get(start_idx, len(claims_text))
        claim_number = int(match.group(1))
        if claim_number in seen_numbers:
            continue

        segment = claims_text[start_idx:end_idx].strip()
        if not segment:
            continue

        cleaned_text = re.sub(r"^\s*\d+\.\s+", "", segment, count=1).strip()
        if not cleaned_text:
            continue

        claims.append(IndependentClaim(claim_number=claim_number, claim_text=cleaned_text))
        seen_numbers.add(claim_number)

    return claims


def _is_grant_pub_id(pub_id: str | None) -> bool:
    """Return True when pub_id ends with a grant kind code (B1/B2)."""
    return bool(pub_id) and pub_id.upper().endswith(("B1", "B2"))
# ----------------------
# Database operations
# ----------------------

@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
def get_application_numbers(pool: ConnectionPool[PgConn]) -> list[str]:
    """Get all application numbers from issued_patent_staging table."""
    logger.info("Fetching application numbers from issued_patent_staging...")
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(GET_APPLICATION_NUMBERS_SQL)
        results = cur.fetchall()
        conn.commit()
    
    app_numbers = [row[0] for row in results if row[0]]
    logger.info(f"Found {len(app_numbers)} application numbers")
    return app_numbers


def upsert_independent_claims(
    cur: Any, pub_id: str, claims: Sequence[IndependentClaim]
) -> int:
    """Upsert independent claims for a publication into patent_claim_staging."""
    if not claims:
        return 0

    staged = 0
    for claim in claims:
        if not claim.claim_text:
            continue
        cur.execute(
            UPSERT_CLAIM_STAGING_SQL,
            {
                "pub_id": pub_id,
                "claim_number": claim.claim_number,
                "claim_text": claim.claim_text,
            },
        )
        staged += 1
    return staged

@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
def update_patents_batch(pool: ConnectionPool[PgConn], records: list[PatentUpdateRecord]) -> tuple[int, int]:
    """Update a batch of patents in the database and stage independent claims."""
    if not records:
        return 0, 0
    
    updated_count = 0
    staged_claims = 0
    with pool.connection() as conn:
        try:
            with conn.cursor() as cur:
                for record in records:
                    if not _is_grant_pub_id(record.pub_id):
                        continue
                    cur.execute(UPDATE_PATENT_STAGING_SQL, record.to_dict())
                    update_result = cur.fetchone()
                    if update_result:  # If a row was returned, it was updated
                        updated_count += 1
                        pub_id = update_result[0] or record.pub_id
                        if pub_id and record.independent_claims:
                            staged_claims += upsert_independent_claims(
                                cur,
                                pub_id,
                                record.independent_claims,
                            )
            conn.commit()
        except Exception as e:
            logger.error(f"Error updating batch: {e}")
            conn.rollback()
            raise
    
    return updated_count, staged_claims

# ----------------------
# BigQuery operations
# ----------------------

def query_bigquery_batch(client: bigquery.Client, app_numbers: list[str]) -> Iterator[PatentUpdateRecord]:
    """Query BigQuery for patent data matching the application numbers."""
    if not app_numbers:
        return
    
    logger.info(f"Querying BigQuery for {len(app_numbers)} application numbers...")
    
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ArrayQueryParameter("application_numbers", "STRING", app_numbers)
        ]
    )
    
    try:
        job = client.query(BQ_SQL_TEMPLATE, job_config=job_config)
        
        for row in job.result():
            yield PatentUpdateRecord(row)
    except Exception as e:
        logger.error(f"BigQuery query failed: {e}")
        raise

# -----------
# CLI / main
# -----------

def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    p = argparse.ArgumentParser(
        description="Update issued_patent_staging with data from BigQuery patents-public-data"
    )
    p.add_argument(
        "--batch-size",
        type=int,
        default=1000,
        help="Batch size for processing application numbers (default: 1000)",
    )
    p.add_argument(
        "--dsn",
        default=os.getenv("PG_DSN", ""),
        help="Postgres DSN (default: from PG_DSN environment variable)",
    )
    p.add_argument(
        "--project",
        default=BQ_PROJECT,
        help=f"BigQuery project ID (default: {BQ_PROJECT})",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be updated without making changes",
    )
    return p.parse_args()

def main() -> int:
    """Main entry point for the script."""
    args = parse_args()

    if not args.dsn:
        logger.error("PG_DSN not set and --dsn not provided")
        return 2

    # Check if credentials file exists
    if not os.path.exists(CREDENTIALS_PATH):
        logger.error(f"Google credentials file not found: {CREDENTIALS_PATH}")
        return 2

    # Setup BigQuery client
    try:
        bq_client = bigquery.Client(project=args.project, location=BQ_LOCATION) if BQ_LOCATION else bigquery.Client(project=args.project)
        # Test the connection
        bq_client.get_dataset("patents-public-data.patents")
        logger.info(f"BigQuery client initialized successfully for project: {args.project}")
    except Exception as e:
        logger.error(f"Failed to initialize BigQuery client: {e}")
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

        # Get application numbers from issued_patent_staging
        app_numbers = get_application_numbers(pool)
        if not app_numbers:
            logger.info("No application numbers found in issued_patent_staging")
            return 0

        total_updated = 0
        total_processed = 0
        total_claims_staged = 0

        # Process in batches
        for batch_app_numbers in chunked(iter(app_numbers), args.batch_size):
            logger.info(f"Processing batch of {len(batch_app_numbers)} application numbers...")
            
            # Query BigQuery for this batch
            bq_records = list(query_bigquery_batch(bq_client, batch_app_numbers))
            total_processed += len(bq_records)
            
            if bq_records:
                logger.info(f"Found {len(bq_records)} records from BigQuery")
                
                if not args.dry_run:
                    # Update database
                    batch_updated, batch_claims = update_patents_batch(pool, bq_records)
                    total_updated += batch_updated
                    total_claims_staged += batch_claims
                    logger.info(
                        f"Updated {batch_updated} records in database; "
                        f"staged {batch_claims} independent claims"
                    )
                else:
                    staged_claims = sum(
                        len(r.independent_claims)
                        for r in bq_records
                        if _is_grant_pub_id(r.pub_id)
                    )
                    grant_records = [r for r in bq_records if _is_grant_pub_id(r.pub_id)]
                    logger.info(
                        f"Dry run: would update {len(grant_records)} grant records and "
                        f"stage {staged_claims} independent claims"
                    )
                    total_updated += len(grant_records)
                    total_claims_staged += staged_claims
            else:
                logger.info("No matching records found in BigQuery for this batch")

        logger.info("Processing complete!")
        logger.info(f"Total application numbers: {len(app_numbers)}")
        logger.info(f"Total records found in BigQuery: {total_processed}")
        logger.info(f"Total records updated: {total_updated}")
        logger.info(f"Total independent claims staged: {total_claims_staged}")
        
        return 0

    except Exception as e:
        logger.error(f"Update failed: {e}", exc_info=True)
        return 1
    finally:
        pool.close()

if __name__ == "__main__":
    sys.exit(main())
