#!/usr/bin/env python3
"""
etl_add_embeddings.py

Backfill missing embeddings for patents within a date range or updated since a date.

Queries patents with pub_date between --date-from and --date-to,
checks for missing embeddings (title+abstract and claims),
and generates/upserts them into patent_embeddings.

Usage:
    python etl_add_embeddings.py --date-from 2024-01-01 --date-to 2024-02-01
    python etl_add_embeddings.py --updated-date 2024-03-15
"""

from __future__ import annotations

import argparse
import os
import time
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from dotenv import load_dotenv
from openai import OpenAI
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

EMB_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
EMB_BATCH_SIZE = int(os.getenv("EMB_BATCH_SIZE", "150"))
EMB_MAX_CHARS = int(os.getenv("EMB_MAX_CHARS", "25000"))

# Model names for the two embedding types
MODEL_TA = f"{EMB_MODEL}|ta"
MODEL_CLAIMS = f"{EMB_MODEL}|claims"

# psycopg generics
type PgConn = Connection[TupleRow]

# -------------
# SQL templates
# -------------

SELECT_PATENTS_BY_DATE_SQL = """
SELECT
    p.pub_id,
    p.title,
    p.abstract,
    p.claims_text,
    p.pub_date
FROM patent p
WHERE p.pub_date >= %(date_from)s
  AND p.pub_date < %(date_to)s
ORDER BY p.pub_date, p.pub_id;
"""

SELECT_PATENTS_BY_UPDATED_DATE_SQL = """
SELECT
    p.pub_id,
    p.title,
    p.abstract,
    p.claims_text,
    p.pub_date
FROM patent p
WHERE p.updated_at >= %(updated_at)s
ORDER BY p.updated_at, p.pub_date, p.pub_id;
"""

SELECT_EXISTING_EMB_SQL = """
SELECT pub_id, model
FROM patent_embeddings
WHERE pub_id = ANY(%(pub_ids)s)
  AND model = ANY(%(models)s);
"""

UPSERT_EMBEDDINGS_SQL = """
INSERT INTO patent_embeddings (pub_id, model, dim, created_at, embedding)
VALUES (%(pub_id)s, %(model)s, %(dim)s, NOW(), CAST(%(embedding)s AS vector))
ON CONFLICT (model, pub_id)
DO UPDATE SET dim = EXCLUDED.dim,
              embedding = EXCLUDED.embedding,
              created_at = NOW();
"""

# --------------
# Data structures
# --------------

@dataclass(frozen=True)
class PatentRecord:
    """Minimal patent record for embedding generation."""

    pub_id: str
    title: str | None
    abstract: str | None
    claims_text: str | None
    pub_date: int


# -----------
# Utilities
# -----------


def clamp_text(s: str, max_chars: int = EMB_MAX_CHARS) -> str:
    """
    Truncate text to max_chars, preferring whitespace boundaries.

    Args:
        s: Input text.
        max_chars: Maximum character length.

    Returns:
        Truncated text string.
    """
    if len(s) <= max_chars:
        return s
    # Prefer cutting at a whitespace boundary
    cutoff = s.rfind(" ", 0, max_chars)
    return s[: (cutoff if cutoff > 0 else max_chars)]


def split_by_words(s: str, words_per_chunk: int = 900) -> list[str]:
    """
    Split text into chunks by word count.

    Args:
        s: Input text.
        words_per_chunk: Maximum words per chunk.

    Returns:
        List of text chunks.
    """
    ws = s.split()
    return [" ".join(ws[i : i + words_per_chunk]) for i in range(0, len(ws), words_per_chunk)]


def vec_to_literal(v: Sequence[float]) -> str:
    """
    Convert vector to pgvector text literal format.

    Args:
        v: Vector as sequence of floats.

    Returns:
        String in pgvector '[v1,v2,...]' format.
    """
    return "[" + ",".join(f"{x:.8f}" for x in v) + "]"


def average_vectors(rows: Sequence[Sequence[float]]) -> list[float]:
    """
    Compute element-wise average of vectors.

    Args:
        rows: Sequence of vectors with same dimension.

    Returns:
        Averaged vector.
    """
    if not rows:
        return []
    dim = len(rows[0])
    acc = [0.0] * dim
    for r in rows:
        for i, x in enumerate(r):
            acc[i] += float(x)
    n = float(len(rows))
    return [x / n for x in acc]


def chunked(iterable, size: int):
    """
    Yield successive chunks from iterable.

    Args:
        iterable: Input iterable.
        size: Chunk size.

    Yields:
        Lists of up to size elements.
    """
    buf = []
    for item in iterable:
        buf.append(item)
        if len(buf) >= size:
            yield buf
            buf = []
    if buf:
        yield buf


# ----------------------
# OpenAI client
# ----------------------


def get_openai_client() -> OpenAI:
    """
    Create OpenAI client from environment variables.

    Returns:
        Configured OpenAI client instance.
    """
    base = os.getenv("OPENAI_BASE_URL")
    if base:
        return OpenAI(base_url=base)
    return OpenAI()


@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
def embed_texts(client: OpenAI, texts: Sequence[str], model: str) -> list[list[float]]:
    """
    Generate embeddings for texts using OpenAI API with retry logic.

    Args:
        client: OpenAI client instance.
        texts: Sequence of text strings to embed.
        model: Embedding model name.

    Returns:
        List of embedding vectors.
    """
    out: list[list[float]] = []
    for batch in chunked(texts, EMB_BATCH_SIZE):
        resp = client.embeddings.create(model=model, input=list(batch))
        out.extend([d.embedding for d in resp.data])
        time.sleep(5)
    return out


# ----------------------
# Database operations
# ----------------------


def query_patents_by_date(
    pool: ConnectionPool[PgConn], date_from: int, date_to: int
) -> list[PatentRecord]:
    """
    Query patents with pub_date between date_from (inclusive) and date_to (exclusive).

    Args:
        pool: Database connection pool.
        date_from: Start date as YYYYMMDD integer.
        date_to: End date as YYYYMMDD integer (exclusive).

    Returns:
        List of PatentRecord instances.
    """
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(SELECT_PATENTS_BY_DATE_SQL, {"date_from": date_from, "date_to": date_to})
        rows = cur.fetchall()

    records = []
    for row in rows:
        records.append(
            PatentRecord(
                pub_id=row[0],
                title=row[1],
                abstract=row[2],
                claims_text=row[3],
                pub_date=row[4],
            )
        )
    return records


def query_patents_by_updated_date(
    pool: ConnectionPool[PgConn], updated_date: int
) -> list[PatentRecord]:
    """
    Query patents with updated_date on or after the provided date.

    Args:
        pool: Database connection pool.
        updated_date: Lower bound date as YYYYMMDD integer.

    Returns:
        List of PatentRecord instances.
    """
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(SELECT_PATENTS_BY_UPDATED_DATE_SQL, {"updated_at": updated_date})
        rows = cur.fetchall()

    records = []
    for row in rows:
        records.append(
            PatentRecord(
                pub_id=row[0],
                title=row[1],
                abstract=row[2],
                claims_text=row[3],
                pub_date=row[4],
            )
        )
    return records


def select_existing_embeddings(
    pool: ConnectionPool[PgConn], pub_ids: Sequence[str], models: Sequence[str]
) -> set[tuple[str, str]]:
    """
    Query existing embeddings for given pub_ids and models.

    Args:
        pool: Database connection pool.
        pub_ids: Sequence of publication IDs.
        models: Sequence of model names.

    Returns:
        Set of (pub_id, model) tuples that already exist.
    """
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(SELECT_EXISTING_EMB_SQL, {"pub_ids": list(pub_ids), "models": list(models)})
        rows = cur.fetchall()
    return {(r[0], r[1]) for r in rows}


def upsert_embeddings(pool: ConnectionPool[PgConn], rows: Sequence[dict]) -> None:
    """
    Upsert embedding records into patent_embeddings table.

    Args:
        pool: Database connection pool.
        rows: Sequence of dicts with keys: pub_id, model, dim, embedding.

    Raises:
        Exception: If database operation fails.
    """
    if not rows:
        return
    conn = None
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                for row in rows:
                    cur.execute(UPSERT_EMBEDDINGS_SQL, row)
            conn.commit()
    except Exception as e:
        logger.error(f"Error upserting embeddings: {e}")
        if conn is not None:
            conn.rollback()
        raise


# ----------------------
# Embedding generation
# ----------------------


def build_ta_input(r: PatentRecord) -> str | None:
    """
    Build title+abstract input text for embedding.

    Args:
        r: PatentRecord instance.

    Returns:
        Concatenated title and abstract, or None if both empty.
    """
    parts = [p for p in [r.title or "", r.abstract or ""] if p]
    if not parts:
        return None
    return clamp_text("\n\n".join(parts))


def build_claims_inputs(r: PatentRecord) -> list[str]:
    """
    Build claims input chunks for embedding.

    Args:
        r: PatentRecord instance.

    Returns:
        List of text chunks from claims, or empty list if no claims.
    """
    if not r.claims_text:
        return []
    text = clamp_text(r.claims_text)
    return split_by_words(text, words_per_chunk=900)


def ensure_embeddings_for_batch(
    pool: ConnectionPool[PgConn], client: OpenAI, batch: Sequence[PatentRecord]
) -> tuple[int, int]:
    """
    Generate and upsert missing embeddings for a batch of patents.

    Args:
        pool: Database connection pool.
        client: OpenAI client instance.
        batch: Sequence of PatentRecord instances.

    Returns:
        Tuple of (embeddings_upserted, total_targets).
    """
    if not batch:
        return (0, 0)

    pub_ids = [r.pub_id for r in batch]
    target_models = [MODEL_TA, MODEL_CLAIMS]

    existing = select_existing_embeddings(pool, pub_ids, target_models)

    rows: list[dict] = []
    total_targets = 0

    # Title+Abstract embeddings
    ta_inputs: list[tuple[str, str]] = []  # (pub_id, text)
    for r in batch:
        if (r.pub_id, MODEL_TA) in existing:
            continue
        text = build_ta_input(r)
        if text:
            ta_inputs.append((r.pub_id, text))
            total_targets += 1
        else:
            logger.error(f"Skipping title+abstract embedding for {r.pub_id}: no text available")

    if ta_inputs:
        logger.info(f"Generating {len(ta_inputs)} title+abstract embeddings")
        vectors = embed_texts(client, [t for _, t in ta_inputs], EMB_MODEL)
        for (pub_id, _), vec in zip(ta_inputs, vectors, strict=True):
            rows.append(
                {
                    "pub_id": pub_id,
                    "model": MODEL_TA,
                    "dim": len(vec),
                    "embedding": vec_to_literal(vec),
                }
            )

    # Claims embeddings (average of chunk vectors to fit schema)
    claims_pub_chunks: list[tuple[str, list[str]]] = []
    for r in batch:
        if (r.pub_id, MODEL_CLAIMS) in existing:
            continue
        chunks = build_claims_inputs(r)
        if chunks:
            claims_pub_chunks.append((r.pub_id, chunks))
            total_targets += 1
        else:
            logger.error(f"Skipping claims embedding for {r.pub_id}: no claims text available")

    if claims_pub_chunks:
        logger.info(f"Generating {len(claims_pub_chunks)} claims embeddings")
        # Flatten for batching
        flat_texts: list[str] = []
        offsets: list[tuple[int, int]] = []  # start, end
        start = 0
        for _, chunks in claims_pub_chunks:
            flat_texts.extend(chunks)
            end = start + len(chunks)
            offsets.append((start, end))
            start = end
        flat_vecs = embed_texts(client, flat_texts, EMB_MODEL)
        # Re-aggregate by pub
        for (pub_id, _chunks), (s, e) in zip(claims_pub_chunks, offsets, strict=True):
            vecs = flat_vecs[s:e]
            avg = average_vectors(vecs)
            if avg:
                rows.append(
                    {
                        "pub_id": pub_id,
                        "model": MODEL_CLAIMS,
                        "dim": len(avg),
                        "embedding": vec_to_literal(avg),
                    }
                )

    # Write
    if rows:
        logger.info(f"Upserting {len(rows)} embeddings")
        upsert_embeddings(pool, rows)

    return (len(rows), total_targets)


# -----------
# CLI / main
# -----------


def parse_date_arg(date_str: str) -> int:
    """
    Parse date argument to YYYYMMDD integer.

    Args:
        date_str: Date string in YYYY-MM-DD format.

    Returns:
        Date as YYYYMMDD integer.

    Raises:
        ValueError: If date format is invalid.
    """
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return int(dt.strftime("%Y%m%d"))
    except ValueError as e:
        raise ValueError(f"Invalid date format '{date_str}': expected YYYY-MM-DD") from e


def parse_args() -> argparse.Namespace:
    """
    Parse command-line arguments.

    Returns:
        Parsed arguments namespace.
    """
    p = argparse.ArgumentParser(
        description="Backfill missing embeddings for patents within a date range or updated_date."
    )
    p.add_argument(
        "--date-from",
        required=False,
        help="Start date (inclusive) in YYYY-MM-DD format",
    )
    p.add_argument(
        "--date-to",
        required=False,
        help="End date (exclusive) in YYYY-MM-DD format",
    )
    p.add_argument(
        "--updated-date",
        required=False,
        help="Process patents with updated_date on or after this date (YYYY-MM-DD)",
    )
    p.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Batch size for processing patents (default: 100)",
    )
    p.add_argument(
        "--dsn",
        default=os.getenv("PG_DSN", ""),
        help="Postgres DSN (default: from PG_DSN environment variable)",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Query patents but do not generate or upsert embeddings",
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

    if args.updated_date and (args.date_from or args.date_to):
        logger.error("Provide either --updated-date or (--date-from and --date-to), not both")
        return 2

    # Parse dates
    updated_date_int: int | None = None
    date_from: int | None = None
    date_to: int | None = None
    try:
        if args.updated_date:
            updated_date_int = parse_date_arg(args.updated_date)
        else:
            if not args.date_from or not args.date_to:
                logger.error("Either --updated-date or both --date-from and --date-to are required")
                return 2
            date_from = parse_date_arg(args.date_from)
            date_to = parse_date_arg(args.date_to)
    except ValueError as e:
        logger.error(str(e))
        return 2

    if date_from is not None and date_to is not None and date_from >= date_to:
        logger.error(f"date-from ({args.date_from}) must be before date-to ({args.date_to})")
        return 2

    if updated_date_int is not None:
        logger.info(f"Processing patents with updated_date >= {args.updated_date}")
    else:
        logger.info(f"Processing patents from {args.date_from} to {args.date_to}")

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

    patents: list[PatentRecord] = []

    # Query patents
    if updated_date_int is not None:
        logger.info("Querying patents by updated_date lower bound")
        patents = query_patents_by_updated_date(pool, updated_date_int)
    elif date_from is not None and date_to is not None:
        logger.info("Querying patents by date range")
        patents = query_patents_by_date(pool, date_from, date_to)
    else:
        logger.error("Invalid date parameters: (date-from/date-to) or (updated-date) required")
        raise RuntimeError("Invalid date parameters: (date-from/date-to) or (updated-date) required")
    
    logger.info(f"Found {len(patents)} patents in selection")

    if not patents:
        logger.info("No patents found in date range")
        return 0

    if args.dry_run:
        logger.info("Dry run mode: skipping embedding generation")
        # Still check what's missing
        pub_ids = [r.pub_id for r in patents]
        target_models = [MODEL_TA, MODEL_CLAIMS]
        existing = select_existing_embeddings(pool, pub_ids, target_models)
        missing_count = 0
        for r in patents:
            if (r.pub_id, MODEL_TA) not in existing and build_ta_input(r):
                missing_count += 1
            if (r.pub_id, MODEL_CLAIMS) not in existing and build_claims_inputs(r):
                missing_count += 1
        logger.info(f"Would generate {missing_count} missing embeddings")
        return 0

    # Setup OpenAI client
    oa_client = get_openai_client()

    # Process in batches
    total_upserted = 0
    total_targets = 0

    for i, batch in enumerate(chunked(patents, args.batch_size)):
        logger.info(f"Processing batch {i + 1} ({len(batch)} patents)")
        upserted, targets = ensure_embeddings_for_batch(pool, oa_client, batch)
        total_upserted += upserted
        total_targets += targets

    logger.info(
        f"Completed: upserted {total_upserted} embeddings out of {total_targets} targets"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
