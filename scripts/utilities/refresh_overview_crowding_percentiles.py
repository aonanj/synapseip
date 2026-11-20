#!/usr/bin/env python3
"""
Refresh overview_crowding_percentiles, the reference distribution behind the
IP Overview "Percentile" (app/overview_api.py::_lookup_crowding_percentile).

The reference is a sample of keyword searches over the corpus:
1. Window: the IP Overview default range, i.e. the 24 months ending at
   --end-date (default today), starting on the first of the month 23 months
   earlier.
2. Sample: title terms (single lexemes) and adjacent title-word pairs that occur
   in at least --min-title-hits titles in the window; up to --max-terms in total,
   half of each kind, picked deterministically by md5(term).
3. Count: for each sampled term, the patents in the window that match it with
   the same full-text expression the IP Overview uses (title + abstract +
   claims), i.e. what an IP Overview keyword search for that term would count.
4. Write: one row per distinct count v with percentile = share of sampled terms
   whose count is <= v, plus a sentinel row (2147483647, 1.0) so totals above
   the sample maximum read 1.0. The table is replaced in one transaction.

The API scales a search's total to its 24-month equivalent before the lookup
(OVERVIEW_PERCENTILE_REF_MONTHS in app/overview_api.py); keep WINDOW_MONTHS in
sync with it.

Usage:
    python scripts/utilities/refresh_overview_crowding_percentiles.py --dry-run
    python scripts/utilities/refresh_overview_crowding_percentiles.py

Notes:
- Requires migration i3j4k5l6m7n8 (alembic upgrade head) for a real run.
- Re-run after each ETL load so the reference tracks the corpus.
- Timeouts are transaction-local (set_config(..., true)), so it is safe through
  the PgBouncer -pooler endpoint in PG_DSN.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from collections import Counter
from collections.abc import Sequence
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import psycopg
from dotenv import load_dotenv
from psycopg import Connection
from psycopg.rows import TupleRow

from infrastructure.logger import setup_logger

load_dotenv()
logger = setup_logger()

type PgConn = Connection[TupleRow]

WINDOW_MONTHS = 24  # keep in sync with OVERVIEW_PERCENTILE_REF_MONTHS in app/overview_api.py
SENTINEL_THRESHOLD = 2_147_483_647  # max integer: totals above the sample maximum read 1.0
UI_BOUNDARIES = (0.4, 0.8, 0.95)  # Low / Medium / High / Very High cut points (app/overview/page.tsx)
DB_LOCK_TIMEOUT = os.getenv("DB_LOCK_TIMEOUT", "90s")
DB_STATEMENT_TIMEOUT = os.getenv("DB_STATEMENT_TIMEOUT", "300s")

# Must stay identical to SEARCH_EXPR in app/repository.py (what IP Overview keyword
# searches match) and to the expression of the patent_search_expr_gin index, or the
# counts stop matching the app and stop using the index.
SEARCH_EXPR = (
    "setweight(to_tsvector('english', coalesce(p.title,'')),'A') || "
    "setweight(to_tsvector('english', coalesce(p.abstract,'')),'B') || "
    "setweight(to_tsvector('english', coalesce(p.claims_text,'')),'C')"
)

UNIGRAM_SQL = """
SELECT word
FROM ts_stat(%(stat_query)s)
WHERE ndoc >= %(min_hits)s
  AND length(word) >= 3
  AND word !~ '^[0-9]+$'
  AND word !~ '-'
ORDER BY md5(word)
LIMIT %(limit)s
"""

# Adjacent title lexemes (positions n and n+1) after stop-word removal. Hyphenated
# compound lexemes (e.g. 'high-qual') are skipped in both samples; their parts are
# separate lexemes, so 'high qualiti' is still sampled as a pair.
BIGRAM_SQL = """
WITH tok AS (
    SELECT p.pub_id, t.lexeme, pos
    FROM patent p
    CROSS JOIN LATERAL unnest(to_tsvector('english', coalesce(p.title, ''))) AS t(lexeme, positions, weights)
    CROSS JOIN LATERAL unnest(t.positions) AS pos
    WHERE p.pub_date >= %(start)s AND p.pub_date <= %(end)s
      AND length(t.lexeme) >= 3
      AND t.lexeme !~ '^[0-9]+$'
      AND t.lexeme !~ '-'
),
pairs AS (
    SELECT a.lexeme || ' ' || b.lexeme AS term
    FROM tok a
    JOIN tok b ON b.pub_id = a.pub_id AND b.pos = a.pos + 1
    WHERE a.lexeme <> b.lexeme
    GROUP BY a.lexeme, b.lexeme
    HAVING COUNT(DISTINCT a.pub_id) >= %(min_hits)s
)
SELECT term FROM pairs ORDER BY md5(term) LIMIT %(limit)s
"""

# Each term is a space-separated list of lexemes, AND-ed into a tsquery without
# re-stemming; equivalent to plainto_tsquery('english', <original words>).
COUNT_SQL = f"""
SELECT t.term,
       (SELECT COUNT(*)
          FROM patent p
         WHERE p.pub_date >= %(start)s AND p.pub_date <= %(end)s
           AND ({SEARCH_EXPR}) @@ t.q) AS n
FROM (
    SELECT term,
           array_to_string(
               ARRAY(SELECT quote_literal(w) FROM unnest(string_to_array(term, ' ')) AS w),
               ' & '
           )::tsquery AS q
    FROM unnest(%(terms)s::text[]) AS term
) t
"""

INSERT_SQL = """
INSERT INTO overview_crowding_percentiles (count_threshold, percentile)
VALUES (%s, %s)
"""


def default_window(end: date) -> tuple[date, date]:
    """IP Overview default range: first of the month WINDOW_MONTHS-1 months before `end` through `end`."""
    month_index = end.year * 12 + (end.month - 1) - (WINDOW_MONTHS - 1)
    return date(month_index // 12, month_index % 12 + 1, 1), end


def to_int_date(d: date) -> int:
    return int(d.strftime("%Y%m%d"))


def build_percentile_rows(counts: Sequence[int]) -> list[tuple[int, float]]:
    """(count_threshold, percentile) rows: for each distinct count v, the share of
    counts <= v, plus a sentinel row so totals above the maximum read 1.0."""
    if not counts:
        return []
    tally = Counter(counts)
    rows: list[tuple[int, float]] = []
    cumulative = 0
    for value in sorted(tally):
        cumulative += tally[value]
        rows.append((value, cumulative / len(counts)))
    if rows[-1][0] < SENTINEL_THRESHOLD:
        rows.append((SENTINEL_THRESHOLD, 1.0))
    return rows


def boundary_thresholds(rows: Sequence[tuple[int, float]]) -> dict[float, int | None]:
    """For each UI boundary b, the largest total that still reads below b (None: none do)."""
    return {
        b: max((v for v, p in rows if p < b), default=None)
        for b in UI_BOUNDARIES
    }


def _set_txn_timeouts(conn: PgConn) -> None:
    conn.execute("SELECT set_config('statement_timeout', %s, true)", (DB_STATEMENT_TIMEOUT,))
    conn.execute("SELECT set_config('lock_timeout', %s, true)", (DB_LOCK_TIMEOUT,))


def sample_terms(conn: PgConn, start: int, end: int, max_terms: int, min_hits: int) -> tuple[list[str], list[str]]:
    per_kind = max_terms // 2
    stat_query = (
        "SELECT to_tsvector('english', coalesce(title,'')) FROM patent "
        f"WHERE pub_date >= {start} AND pub_date <= {end}"
    )
    with conn.transaction():
        _set_txn_timeouts(conn)
        unigrams = [
            r[0]
            for r in conn.execute(
                UNIGRAM_SQL, {"stat_query": stat_query, "min_hits": min_hits, "limit": per_kind}
            ).fetchall()
        ]
    with conn.transaction():
        _set_txn_timeouts(conn)
        bigrams = [
            r[0]
            for r in conn.execute(
                BIGRAM_SQL, {"start": start, "end": end, "min_hits": min_hits, "limit": per_kind}
            ).fetchall()
        ]
    return unigrams, bigrams


def count_terms(conn: PgConn, terms: list[str], start: int, end: int, batch_size: int) -> list[int]:
    counts: list[int] = []
    t0 = time.monotonic()
    for i in range(0, len(terms), batch_size):
        batch = terms[i : i + batch_size]
        with conn.transaction():
            _set_txn_timeouts(conn)
            rows = conn.execute(COUNT_SQL, {"start": start, "end": end, "terms": batch}).fetchall()
        counts.extend(int(r[1]) for r in rows)
        logger.info(
            "Counted %s/%s terms (%.0fs elapsed)", min(i + batch_size, len(terms)), len(terms), time.monotonic() - t0
        )
    return counts


def write_rows(conn: PgConn, rows: list[tuple[int, float]]) -> None:
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("SELECT set_config('lock_timeout', %s, true)", (DB_LOCK_TIMEOUT,))
        cur.execute("DELETE FROM overview_crowding_percentiles")
        cur.executemany(INSERT_SQL, rows)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Refresh the IP Overview crowding percentile reference table.")
    p.add_argument("--dsn", default=os.getenv("PG_DSN", ""), help="Postgres DSN (default: $PG_DSN)")
    p.add_argument(
        "--end-date", type=date.fromisoformat, default=None, help="YYYY-MM-DD window end (default: today)"
    )
    p.add_argument("--max-terms", type=int, default=4000, help="sampled search terms, half single words, half pairs")
    p.add_argument("--min-title-hits", type=int, default=5, help="minimum titles a sampled term must appear in")
    p.add_argument("--batch-size", type=int, default=100, help="terms counted per SQL statement")
    p.add_argument("--dry-run", action="store_true", help="compute and log the distribution; write nothing")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    if not args.dsn:
        logger.error("PG_DSN not provided via --dsn or environment")
        sys.exit(1)
    if args.max_terms < 2 or args.batch_size < 1 or args.min_title_hits < 1:
        logger.error("--max-terms must be >= 2; --batch-size and --min-title-hits must be >= 1")
        sys.exit(1)

    start_d, end_d = default_window(args.end_date or date.today())
    start, end = to_int_date(start_d), to_int_date(end_d)
    t0 = time.monotonic()

    with psycopg.connect(args.dsn, autocommit=True) as conn:
        if not args.dry_run:
            exists = conn.execute("SELECT to_regclass('public.overview_crowding_percentiles')").fetchone()
            if not exists or exists[0] is None:
                logger.error("overview_crowding_percentiles missing; run `alembic upgrade head` first")
                sys.exit(1)

        unigrams, bigrams = sample_terms(conn, start, end, args.max_terms, args.min_title_hits)
        logger.info(
            "Window %s..%s: sampled %s single terms and %s pairs", start_d, end_d, len(unigrams), len(bigrams)
        )
        counts = count_terms(conn, unigrams + bigrams, start, end, args.batch_size)
        rows = build_percentile_rows(counts)
        if not rows:
            logger.error("No terms sampled for %s..%s; table left unchanged", start_d, end_d)
            sys.exit(1)

        for b, v in boundary_thresholds(rows).items():
            logger.info("Totals <= %s read below the %.0f%% boundary", v, b * 100)
        logger.info(
            "%s rows from %s terms (count range %s..%s) in %.0fs",
            len(rows),
            len(counts),
            min(counts),
            max(counts),
            time.monotonic() - t0,
        )

        if args.dry_run:
            logger.info("Dry run: overview_crowding_percentiles not written")
            return
        write_rows(conn, rows)
        logger.info("Wrote %s rows to overview_crowding_percentiles", len(rows))


if __name__ == "__main__":
    main()
