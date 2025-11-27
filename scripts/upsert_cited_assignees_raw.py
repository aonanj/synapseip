#!/usr/bin/env python3
"""
upsert_cited_assignees_raw.py

Upserts rows from a CSV file into the cited_patent_assignee_raw table.
Expected CSV format: pub_id, application_number, assignee_name_raw
Rows with fewer than 3 entries are skipped.
"""

import argparse
import csv
import os
import sys
from pathlib import Path
# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from psycopg import Connection
from psycopg.rows import TupleRow
from psycopg_pool import ConnectionPool
from tenacity import retry, stop_after_attempt, wait_random_exponential

from infrastructure.logger import setup_logger

logger = setup_logger(__name__)

load_dotenv()

# Type alias for connection pool
type PgConn = Connection[TupleRow]

# Note: ON CONFLICT requires a unique constraint on (pub_id, application_number)
# If the table cited_patent_assignee_raw does not have this constraint, this query will fail.
UPSERT_SQL = """
INSERT INTO cited_patent_assignee_raw (pub_id, application_number, assignee_name_raw)
VALUES (%s, %s, %s)
ON CONFLICT (pub_id, application_number) 
DO UPDATE SET 
    assignee_name_raw = EXCLUDED.assignee_name_raw;
"""

@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
def upsert_batch(pool: ConnectionPool[PgConn], batch: list[tuple[str, str, str]]) -> int:
    """
    Upserts a batch of records into the database.
    Retries on failure using tenacity.
    """
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.executemany(UPSERT_SQL, batch)
        conn.commit()
    return len(batch)

def main():
    parser = argparse.ArgumentParser(description="Upsert cited patent assignees from CSV")
    parser.add_argument("csv_file", help="Path to the CSV file")
    parser.add_argument("--batch-size", type=int, default=500, help="Batch size (default: 500)")
    args = parser.parse_args()

    if not os.path.exists(args.csv_file):
        logger.error(f"File not found: {args.csv_file}")
        sys.exit(1)

    # Get database connection string
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        dsn = os.getenv("PG_DSN")
    
    if not dsn:
        logger.error("DATABASE_URL or PG_DSN environment variable not set")
        sys.exit(1)

    # Initialize connection pool
    pool = ConnectionPool[PgConn](dsn, min_size=1, max_size=5, kwargs={"autocommit": False})

    try:
        with open(args.csv_file, encoding='utf-8') as f:
            reader = csv.reader(f)
            batch = []
            total_upserted = 0
            total_skipped = 0
            
            logger.info(f"Starting processing of {args.csv_file}")

            for row_num, row in enumerate(reader, 1):
                if len(row) < 3:
                    total_skipped += 1
                    continue
                
                # Extract fields (assuming first 3 columns)
                pub_id = row[0].strip() if row[0] else None
                app_num = row[1].strip() if row[1] else None
                assignee = row[2].strip() if row[2] else None
                
                batch.append((pub_id, app_num, assignee))

                if len(batch) >= args.batch_size:
                    try:
                        count = upsert_batch(pool, batch)
                        total_upserted += count
                        logger.info(f"Batch processed: {count} upserted. Total upserted: {total_upserted}. Total skipped: {total_skipped}")
                    except Exception as e:
                        logger.error(f"Error upserting batch at row {row_num}: {e}")
                        sys.exit(1)
                    batch = []

            # Process remaining records
            if batch:
                try:
                    count = upsert_batch(pool, batch)
                    total_upserted += count
                    logger.info(f"Final batch processed: {count} upserted. Total upserted: {total_upserted}. Total skipped: {total_skipped}")
                except Exception as e:
                    logger.error(f"Error upserting final batch: {e}")
                    sys.exit(1)
            
            logger.info(f"Processing complete. Total upserted: {total_upserted}. Total skipped: {total_skipped}")

    except Exception as e:
        logger.error(f"An unexpected error occurred: {e}")
        sys.exit(1)
    finally:
        pool.close()

if __name__ == "__main__":
    main()
