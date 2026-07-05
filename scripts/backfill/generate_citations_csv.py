#!/usr/bin/env python3
"""
generate_citations_csv.py

Generate a CSV file from the patent_staging table containing:
- pub_id
- citation_publication_numbers that begin with "US"

For every pub_id in the patent_staging table, this script extracts and lists
the values in the corresponding citation_publication_numbers field that begin
with "US" and outputs them to a CSV file.
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

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

SELECT_CITATIONS_SQL = """
SELECT 
    pub_id,
    citation_publication_numbers
FROM patent_staging 
WHERE citation_publication_numbers IS NOT NULL
  AND array_length(citation_publication_numbers, 1) > 0
ORDER BY pub_id;
"""

COUNT_RECORDS_SQL = """
SELECT COUNT(*) 
FROM patent_staging 
WHERE citation_publication_numbers IS NOT NULL
  AND array_length(citation_publication_numbers, 1) > 0;
"""


# ----------------------
# Database operations with retry logic
# ----------------------


@retry(
    wait=wait_random_exponential(min=1, max=60),
    stop=stop_after_attempt(6),
    retry=retry_if_exception_type((psycopg.OperationalError, psycopg.InterfaceError)),
)
def get_patent_citations(pool: ConnectionPool[PgConn]) -> list[dict[str, Any]]:
    """
    Get all patent citations from patent_staging.

    Args:
        pool: Database connection pool.

    Returns:
        List of dicts containing pub_id and citation_publication_numbers.
    """
    logger.info("Fetching patent citations from patent_staging...")
    
    with pool.connection() as conn, conn.cursor() as cur:
        # Get count first
        cur.execute(COUNT_RECORDS_SQL)
        count_result = cur.fetchone()
        total_count = count_result[0] if count_result else 0
        logger.info("Found %d patents with citation data", total_count)
        
        # Fetch all records
        cur.execute(SELECT_CITATIONS_SQL)
        rows = cur.fetchall()
        conn.commit()
    
    results = []
    for row in rows:
        pub_id = row[0]
        citation_numbers = row[1] or []
        
        # Filter citations that begin with "US"
        us_citations = [citation for citation in citation_numbers if citation and citation.startswith("US")]
        
        if us_citations:  # Only include records with US citations
            results.append({
                "pub_id": pub_id,
                "us_citations": us_citations
            })
    
    logger.info("Found %d patents with US citations", len(results))
    return results


def generate_csv(data: list[dict[str, Any]], output_file: str) -> None:
    """
    Generate CSV file from patent citation data.
    
    Args:
        data: List of patent citation data.
        output_file: Path to output CSV file.
    """
    logger.info("Generating CSV file: %s", output_file)
    
    # Flatten the data - each US citation gets its own row
    flattened_data = []
    for record in data:
        pub_id = record["pub_id"]
        for us_citation in record["us_citations"]:
            flattened_data.append({
                "pub_id": pub_id,
                "us_citation_publication_number": us_citation
            })
    
    # Write CSV
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['pub_id', 'us_citation_publication_number']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        # Write header
        writer.writeheader()
        
        # Write data
        for row in flattened_data:
            writer.writerow(row)
    
    logger.info("CSV file generated successfully with %d rows", len(flattened_data))
    logger.info("CSV file saved to: %s", os.path.abspath(output_file))


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
        description="Generate CSV file of US patent citations from patent_staging table."
    )
    p.add_argument(
        "--output",
        "-o",
        default=f"us_patent_citations_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
        help="Output CSV filename (default: us_patent_citations_YYYYMMDD_HHMMSS.csv)",
    )
    p.add_argument(
        "--dsn",
        default=os.getenv("PG_DSN", ""),
        help="Postgres DSN (default: from PG_DSN environment variable)",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without generating the CSV file",
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
        # Fetch citation data
        citation_data = get_patent_citations(pool)
        
        if not citation_data:
            logger.warning("No patents with US citations found in patent_staging")
            return 0
        
        # Calculate some statistics
        total_us_citations = sum(len(record["us_citations"]) for record in citation_data)
        logger.info("Statistics:")
        logger.info("  Patents with US citations: %d", len(citation_data))
        logger.info("  Total US citations: %d", total_us_citations)
        logger.info("  Average US citations per patent: %.2f", 
                   total_us_citations / len(citation_data) if citation_data else 0)
        
        if args.dry_run:
            logger.info("Dry run: would generate CSV with %d rows", total_us_citations)
            # Show first few examples
            logger.info("Sample data:")
            for i, record in enumerate(citation_data[:5]):
                for citation in record["us_citations"][:3]:  # Show max 3 citations per patent
                    logger.info("  %s -> %s", record["pub_id"], citation)
                if i >= 4:  # Show max 5 patents
                    break
            if len(citation_data) > 5:
                logger.info("  ... and %d more patents", len(citation_data) - 5)
            return 0
        
        # Generate CSV
        generate_csv(citation_data, args.output)
        
        logger.info("CSV generation complete!")
        return 0

    except Exception as e:
        logger.error("CSV generation failed: %s", e, exc_info=True)
        return 1
    finally:
        pool.close()


if __name__ == "__main__":
    raise SystemExit(main())