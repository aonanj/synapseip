#!/usr/bin/env python3
"""
Rebuild patent_claim rows from each patent's current claims_text.

The script:
1. Walks every patent with non-empty claims_text (keyset pagination on pub_id).
2. Extracts independent claims with scripts/backfill/claim_extraction.py, the
   same extractor scripts/big-query-etl/etl.py uses.
3. Compares them with the stored patent_claim rows, ignoring whitespace:
   - unchanged: left alone, so rows and their embeddings are kept
   - new: the patent has no claim rows yet, so they are inserted
   - changed: stored rows differ, so they are deleted and re-inserted
     (delete-first, as etl.py does; the FK cascade drops their embeddings)
   - extraction empty: stored rows are kept, never deleted

It does not generate embeddings. Afterwards run
scripts/generate-embeddings/independent_claims_embeddings.py, which embeds every
claim row that has no vector.

Usage:
    python scripts/backfill/backfill_patent_claims.py --dry-run
    python scripts/backfill/backfill_patent_claims.py --limit 200

Notes:
- Idempotent; re-running only touches patents whose claims changed. Use
  --start-after to resume an interrupted run.
- Re-run after scripts that rewrite patent.claims_text without rebuilding claims
  (scripts/utilities/migrate_staged_patents.py,
  scripts/utilities/update_applications_to_patents.py).
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import psycopg
from dotenv import load_dotenv
from psycopg import Connection
from psycopg.rows import TupleRow

from infrastructure.logger import setup_logger
from scripts.backfill.claim_extraction import extract_independent_claims

load_dotenv()
logger = setup_logger()

type PgConn = Connection[TupleRow]

SELECT_PATENTS_SQL = """
SELECT pub_id, claims_text
FROM patent
WHERE claims_text IS NOT NULL
  AND claims_text <> ''
  AND pub_id > %(after_pub_id)s
ORDER BY pub_id
LIMIT %(batch_size)s;
"""

SELECT_CLAIMS_SQL = """
SELECT pub_id, claim_number, claim_text
FROM patent_claim
WHERE pub_id = ANY(%(pub_ids)s);
"""

DELETE_CLAIMS_SQL = "DELETE FROM patent_claim WHERE pub_id = ANY(%(pub_ids)s);"

# Same statement as INSERT_CLAIM_SQL in scripts/big-query-etl/etl.py.
INSERT_CLAIM_SQL = """
INSERT INTO patent_claim (pub_id, claim_number, is_independent, claim_text)
VALUES (%(pub_id)s, %(claim_number)s, TRUE, %(claim_text)s)
ON CONFLICT (pub_id, claim_number) DO UPDATE SET
  is_independent = EXCLUDED.is_independent,
  claim_text = EXCLUDED.claim_text,
  updated_at = NOW();
"""

# Keep each executemany flush small; etl.py's executemany_chunked explains why
# (large pipeline flushes fail with "SSL error: bad length" on some stacks).
WRITE_CHUNK = 100
SAMPLE_DIFFS = 20


@dataclass
class Stats:
    scanned: int = 0
    unchanged: int = 0
    new: int = 0
    changed: int = 0
    empty_kept: int = 0
    empty_no_rows: int = 0
    claims_deleted: int = 0
    claims_inserted: int = 0
    diffs: list[str] = field(default_factory=list)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Rebuild patent_claim rows from patent.claims_text"
    )
    parser.add_argument(
        "--dsn",
        default=os.getenv("DATABASE_URL", ""),
        help="Postgres DSN; defaults to DATABASE_URL env var",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Patents per DB transaction (default: 500)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Max patents to scan (0 = all)",
    )
    parser.add_argument(
        "--start-after",
        default="",
        help="Resume after this pub_id (keyset position)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would change but do not write to the database",
    )
    return parser.parse_args()


def _normalize(text: str | None) -> str:
    return " ".join((text or "").split())


def process_batch(
    conn: PgConn, rows: list[tuple[str, str]], stats: Stats, dry_run: bool
) -> None:
    pub_ids = [pub_id for pub_id, _ in rows]
    stored: dict[str, dict[int, str]] = {}
    with conn.cursor() as cur:
        cur.execute(SELECT_CLAIMS_SQL, {"pub_ids": pub_ids})
        for pub_id, claim_number, claim_text in cur.fetchall():
            stored.setdefault(pub_id, {})[claim_number] = _normalize(claim_text)

    rewrite: list[str] = []
    inserts: list[dict] = []
    for pub_id, claims_text in rows:
        stats.scanned += 1
        existing = stored.get(pub_id, {})
        extracted = extract_independent_claims(claims_text)

        if not extracted:
            if existing:
                # A parser miss must never delete claims that are already stored.
                stats.empty_kept += 1
                logger.warning("No claims extracted for %s; keeping %s stored rows", pub_id, len(existing))
            else:
                stats.empty_no_rows += 1
            continue

        fresh = {c.claim_number: _normalize(c.claim_text) for c in extracted}
        if fresh == existing:
            stats.unchanged += 1
            continue

        if existing:
            stats.changed += 1
            stats.claims_deleted += len(existing)
            rewrite.append(pub_id)
            if len(stats.diffs) < SAMPLE_DIFFS:
                same_numbers = sorted(existing) == sorted(fresh)
                stats.diffs.append(
                    f"{pub_id}: {sorted(existing)} -> {sorted(fresh)}"
                    + (" (text changed)" if same_numbers else "")
                )
        else:
            stats.new += 1

        inserts.extend(
            {"pub_id": pub_id, "claim_number": c.claim_number, "claim_text": c.claim_text}
            for c in extracted
        )

    stats.claims_inserted += len(inserts)
    if dry_run or not inserts:
        return

    with conn.transaction(), conn.cursor() as cur:
        if rewrite:
            cur.execute(DELETE_CLAIMS_SQL, {"pub_ids": rewrite})
        for i in range(0, len(inserts), WRITE_CHUNK):
            cur.executemany(INSERT_CLAIM_SQL, inserts[i : i + WRITE_CHUNK])


def backfill_patent_claims(
    *, dsn: str, batch_size: int, limit: int, start_after: str, dry_run: bool
) -> Stats:
    stats = Stats()
    after_pub_id = start_after
    with psycopg.connect(dsn, autocommit=True) as conn:
        while True:
            size = batch_size if not limit else min(batch_size, limit - stats.scanned)
            if size <= 0:
                break
            with conn.cursor() as cur:
                cur.execute(
                    SELECT_PATENTS_SQL,
                    {"after_pub_id": after_pub_id, "batch_size": size},
                )
                rows = cur.fetchall()
            if not rows:
                break

            process_batch(conn, rows, stats, dry_run)
            after_pub_id = rows[-1][0]
            logger.info(
                "Through %s: scanned=%s new=%s changed=%s unchanged=%s empty_kept=%s",
                after_pub_id,
                stats.scanned,
                stats.new,
                stats.changed,
                stats.unchanged,
                stats.empty_kept,
            )
    return stats


def main() -> None:
    args = parse_args()
    if not args.dsn:
        logger.error("DATABASE_URL not provided via --dsn or environment")
        sys.exit(1)
    if args.batch_size < 1:
        logger.error("--batch-size must be >= 1")
        sys.exit(1)

    try:
        stats = backfill_patent_claims(
            dsn=args.dsn,
            batch_size=args.batch_size,
            limit=args.limit,
            start_after=args.start_after,
            dry_run=args.dry_run,
        )
    except psycopg.Error as exc:
        logger.error("Database error: %s", exc, exc_info=exc)
        sys.exit(1)

    for diff in stats.diffs:
        logger.info("Changed: %s", diff)
    logger.info(
        "%s: scanned=%s unchanged=%s new=%s changed=%s empty_kept=%s "
        "empty_no_rows=%s claims_deleted=%s claims_inserted=%s",
        "Dry run (nothing written)" if args.dry_run else "Completed backfill",
        stats.scanned,
        stats.unchanged,
        stats.new,
        stats.changed,
        stats.empty_kept,
        stats.empty_no_rows,
        stats.claims_deleted,
        stats.claims_inserted,
    )


if __name__ == "__main__":
    main()
