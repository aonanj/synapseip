#!/usr/bin/env python3
"""
update_patent_staging.py

Update patent_staging table with data from BigQuery patents-public-data.patents.publications

Updates the following fields in patent_staging based on matching application_number:
1. abstract from bqp.abstract_localized[SAFE_OFFSET(0)].text
2. claims_text from bqp.claims_localized[SAFE_OFFSET(0)].text
3. kind_code from bqp.kind_code
4. pub_id from bqp.publication_number
5. family_id from bqp.family_id
6. grant_date from bqp.grant_date
7. citation_publication_numbers from bqp.citation.publication_number array
8. citation_application_numbers from bqp.citation.application_number array
"""

from __future__ import annotations

import argparse
import os
import sys
from collections.abc import Iterator
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
CREDENTIALS_PATH = "../.secrets/patent-scout-etl-9ca3cd656391.json"

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
    bqp.grant_date,
    bqp.abstract_localized[SAFE_OFFSET(0)].text AS abstract,
    bqp.claims_localized[SAFE_OFFSET(0)].text AS claims_text,
    ARRAY(
        SELECT citation.publication_number 
        FROM UNNEST(bqp.citation) AS citation 
        WHERE citation.publication_number IS NOT NULL
    ) AS citation_publication_numbers,
    ARRAY(
        SELECT citation.application_number 
        FROM UNNEST(bqp.citation) AS citation 
        WHERE citation.application_number IS NOT NULL
    ) AS citation_application_numbers,
    (SELECT an.name FROM UNNEST(bqp.assignee_harmonized) an WHERE an.name IS NOT NULL LIMIT 1) AS assignee_name,
FROM 
    `patents-public-data.patents.publications` AS bqp
WHERE 
    bqp.application_number_formatted IN UNNEST(@application_numbers)
    AND bqp.application_number_formatted IS NOT NULL
"""

# SQL to get application numbers from patent_staging
GET_APPLICATION_NUMBERS_SQL = """
SELECT DISTINCT application_number 
FROM patent_staging 
WHERE application_number IS NOT NULL
ORDER BY application_number
"""

# SQL to update patent_staging with BigQuery data
UPDATE_PATENT_STAGING_SQL = """
UPDATE patent_staging 
SET 
    abstract = COALESCE(%(abstract)s, abstract),
    claims_text = COALESCE(%(claims_text)s, claims_text),
    kind_code = COALESCE(%(kind_code)s, kind_code),
    pub_id = COALESCE(%(pub_id)s, pub_id),
    family_id = COALESCE(%(family_id)s, family_id),
    assignee_name = %(assignee_name)s,
    grant_date = %(grant_date)s,
    citation_publication_numbers = %(citation_publication_numbers)s,
    citation_application_numbers = %(citation_application_numbers)s,
    updated_at = NOW()
WHERE application_number = %(application_number)s
RETURNING pub_id, application_number
"""

# SQL to add citation columns if they don't exist
ADD_CITATION_COLUMNS_SQL = """
DO $$ 
BEGIN
    -- Add citation_publication_numbers column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patent_staging' 
        AND column_name = 'citation_publication_numbers'
    ) THEN
        ALTER TABLE patent_staging ADD COLUMN citation_publication_numbers TEXT[];
    END IF;
    
    -- Add citation_application_numbers column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patent_staging' 
        AND column_name = 'citation_application_numbers'
    ) THEN
        ALTER TABLE patent_staging ADD COLUMN citation_application_numbers TEXT[];
    END IF;
    
    -- Add grant_date column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patent_staging' 
        AND column_name = 'grant_date'
    ) THEN
        ALTER TABLE patent_staging ADD COLUMN grant_date INTEGER;
    END IF;
END $$;
"""

# --------------
# Data structures
# --------------

class PatentUpdateRecord:
    def __init__(self, row: bigquery.Row):
        self.application_number = row.get("application_number")
        self.pub_id = row.get("pub_id")
        self.kind_code = row.get("kind_code")
        self.family_id = row.get("family_id")
        self.grant_date = row.get("grant_date")
        self.assignee_name = row.get("assignee_name")
        self.abstract = row.get("abstract")
        self.claims_text = row.get("claims_text")
        self.citation_publication_numbers = list(row.get("citation_publication_numbers") or [])
        self.citation_application_numbers = list(row.get("citation_application_numbers") or [])

    def to_dict(self) -> dict[str, Any]:
        return {
            "application_number": self.application_number,
            "pub_id": self.pub_id,
            "kind_code": self.kind_code,
            "family_id": self.family_id,
            "grant_date": self.grant_date,
            "abstract": self.abstract,
            "assignee_name": self.assignee_name,
            "claims_text": self.claims_text,
            "citation_publication_numbers": self.citation_publication_numbers,
            "citation_application_numbers": self.citation_application_numbers,
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

# ----------------------
# Database operations
# ----------------------

@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
def ensure_citation_columns(pool: ConnectionPool[PgConn]) -> None:
    """Ensure citation columns exist in patent_staging table."""
    logger.info("Ensuring citation columns exist in patent_staging table...")
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(ADD_CITATION_COLUMNS_SQL)
        conn.commit()
    logger.info("Citation columns ensured")

@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
def get_application_numbers(pool: ConnectionPool[PgConn]) -> list[str]:
    """Get all application numbers from patent_staging table."""
    logger.info("Fetching application numbers from patent_staging...")
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(GET_APPLICATION_NUMBERS_SQL)
        results = cur.fetchall()
        conn.commit()
    
    app_numbers = [row[0] for row in results if row[0]]
    logger.info(f"Found {len(app_numbers)} application numbers")
    return app_numbers

@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
def update_patents_batch(pool: ConnectionPool[PgConn], records: list[PatentUpdateRecord]) -> int:
    """Update a batch of patents in the database."""
    if not records:
        return 0
    
    updated_count = 0
    with pool.connection() as conn:
        try:
            with conn.cursor() as cur:
                for record in records:
                    cur.execute(UPDATE_PATENT_STAGING_SQL, record.to_dict())
                    if cur.fetchone():  # If a row was returned, it was updated
                        updated_count += 1
            conn.commit()
        except Exception as e:
            logger.error(f"Error updating batch: {e}")
            conn.rollback()
            raise
    
    return updated_count

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
        description="Update patent_staging with data from BigQuery patents-public-data"
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
        # Ensure citation columns exist
        if not args.dry_run:
            ensure_citation_columns(pool)

        # Get application numbers from patent_staging
        app_numbers = get_application_numbers(pool)
        if not app_numbers:
            logger.info("No application numbers found in patent_staging")
            return 0

        total_updated = 0
        total_processed = 0

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
                    batch_updated = update_patents_batch(pool, bq_records)
                    total_updated += batch_updated
                    logger.info(f"Updated {batch_updated} records in database")
                else:
                    logger.info(f"Dry run: would update {len(bq_records)} records")
                    total_updated += len(bq_records)
            else:
                logger.info("No matching records found in BigQuery for this batch")

        logger.info("Processing complete!")
        logger.info(f"Total application numbers: {len(app_numbers)}")
        logger.info(f"Total records found in BigQuery: {total_processed}")
        logger.info(f"Total records updated: {total_updated}")
        
        return 0

    except Exception as e:
        logger.error(f"Update failed: {e}", exc_info=True)
        return 1
    finally:
        pool.close()

if __name__ == "__main__":
    sys.exit(main())