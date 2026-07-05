#!/usr/bin/env python3
"""
etl_complete_July_2026.py

Comprehensive BigQuery → Postgres ETL for SynapseIP.

Single-command replacement for the multi-script ingestion pipeline
(etl_uspto.py → etl_xml_fulltext.py → migrate_staged_patents.py →
etl_add_embeddings.py → add_canon_name.py → citation CSV scripts).

Pipeline stages, in order:

1. Records: query `patents-public-data.patents.publications` for US utility
   publications in [date_from, date_to) that carry an AI/ML CPC code and an
   AI/ML keyword in title/abstract/claims. The query is deduplicated per
   application_number server-side, keeping the most recent publication
   (e.g. a B2 grant supersedes its A1 pre-grant publication).
2. Replace + upsert: any existing `patent` row whose application_number
   matches an incoming record is DELETED first (FK cascades remove its
   embeddings, claims, citations, assignee links, and overview analysis;
   orphaned `knn_edge` rows are removed explicitly), then the fresh
   BigQuery record is upserted.
3. Canonical assignee: for each record, if any harmonized assignee name is
   already known (exact `assignee_alias` match, or canonicalized match in
   `canonical_assignee_name`), that name is used; otherwise the first
   harmonized name. The name is canonicalized with the shared
   `add_canon_name` logic, `canonical_assignee_name`/`assignee_alias` are
   upserted, and `patent` + `patent_assignee` are linked.
4. Claims: independent claims are extracted from claims_text (same
   heuristics as bq_update_issued_patent_staging.py) and upserted into
   `patent_claim`.
5. Embeddings: OpenAI embeddings are generated and upserted into
   `patent_embeddings` (models `<model>|ta` and `<model>|claims`) and into
   `patent_claim_embeddings` (one embedding per independent claim).
6. Citations: a second BigQuery query unnests each ingested publication's
   `citation` array and self-joins `publications` to resolve the cited
   application_number (formatted), filing/priority dates, and first
   harmonized assignee. Rows are upserted into `patent_citation`
   (relation_source='bigquery'). Because every ingested record's backward
   citations are loaded corpus-wide, forward-citation metrics (queries on
   the cited side of `patent_citation`, see app/repository_citation.py)
   are updated automatically for both new and pre-existing patents.
   Cited patents that are not in the `patent` table get their assignee
   canonicalized and upserted into `cited_patent_assignee`
   (source='bigquery'; no USPTO ODP calls).

Idempotency / re-run cost note: matching application_number rows are always
deleted and re-created per step 2, so re-running over an already-ingested
window regenerates embeddings for those records (OpenAI cost). Use
--date-from/--date-to to bound the window when re-running.

Usage:
    python scripts/etl_complete_July_2026.py \
        [--date-from YYYY-MM-DD] [--date-to YYYY-MM-DD] \
        [--batch-size 500] [--dry-run] [--skip-embeddings] [--skip-citations]

Defaults: date_from = max(patent.pub_date); date_to = day after the latest
publication_date available in BigQuery (i.e. everything available).

Environment: PG_DSN (or --dsn), BQ_PROJECT (or --project), OPENAI_API_KEY,
optional EMBEDDING_MODEL / EMB_BATCH_SIZE / EMB_MAX_CHARS / EMB_SLEEP_SECS /
CPC_REGEX / BQ_LOCATION, and Google application-default credentials.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from collections.abc import Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import LiteralString

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import psycopg
from dotenv import load_dotenv
from google.cloud import bigquery
from openai import OpenAI
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

# Reuse the shared assignee canonicalization logic so canonical names and
# aliases stay consistent with the rest of the pipeline.
try:
    from scripts.backfill.add_canon_name import (
        canonicalize_assignee,
        upsert_aliases,
        upsert_canonical_names,
    )
except ImportError:  # running as `python scripts/etl_complete_July_2026.py`
    from scripts.backfill.add_canon_name import (  # type: ignore[no-redef]
        canonicalize_assignee,
        upsert_aliases,
        upsert_canonical_names,
    )

logger = setup_logger(__name__)

# -----------------------
# Configuration constants
# -----------------------
load_dotenv()

AI_CPC_REGEX_DEFAULT = r"^(G06N|G06V|G06F17|G06F18|G06F40|G06F16/90|G06K9|G06T7|G10L|A61B|B60W|G05D)"

BQ_PAGE_SIZE = 5000
# One citations query covers up to this many citing pub_ids; larger runs are
# split into multiple queries to keep array parameters well under BQ limits.
CITATION_PUBS_PER_QUERY = 50_000

# Rows per executemany pipeline flush. Large flushes (e.g. 500 records with
# full claims text ≈ tens of MB) can fail mid-send over SSL with
# "SSL error: bad length", so writes are split into small chunks.
DB_WRITE_CHUNK = int(os.getenv("DB_WRITE_CHUNK", "50"))
DB_BATCH_RETRIES = int(os.getenv("DB_BATCH_RETRIES", "3"))

EMB_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
EMB_BATCH_SIZE = int(os.getenv("EMB_BATCH_SIZE", "150"))
EMB_MAX_CHARS = int(os.getenv("EMB_MAX_CHARS", "25000"))  # guard for overlong inputs
EMB_SLEEP_SECS = float(os.getenv("EMB_SLEEP_SECS", "2"))
TA_WORDS_PER_CHUNK = 900
CLAIM_WORDS_PER_CHUNK = 2000

# Model names stored in patent_embeddings (one row per pub_id per model)
MODEL_TA = f"{EMB_MODEL}|ta"
MODEL_CLAIMS = f"{EMB_MODEL}|claims"

# psycopg generics
type PgConn = Connection[TupleRow]

# ------------------
# BigQuery templates
# ------------------

RECORDS_BQ_SQL = """
DECLARE start_date INT64 DEFAULT CAST(REPLACE(@date_from, '-', '') AS INT64);
DECLARE end_date   INT64 DEFAULT CAST(REPLACE(@date_to, '-', '') AS INT64);

WITH base AS (
  SELECT
    p.publication_number                          AS pub_id,
    NULLIF(p.application_number_formatted, '')    AS application_number,
    NULLIF(p.priority_date, 0)                    AS priority_date,
    p.family_id,
    p.kind_code,
    p.publication_date                            AS pub_date,
    NULLIF(p.filing_date, 0)                      AS filing_date,
    p.title_localized[SAFE_OFFSET(0)].text        AS title,
    p.abstract_localized[SAFE_OFFSET(0)].text     AS abstract,
    p.claims_localized[SAFE_OFFSET(0)].text       AS claims_text,
    ARRAY(
      SELECT an.name FROM UNNEST(p.assignee_harmonized) AS an
      WHERE an.name IS NOT NULL AND an.name != ''
    ) AS assignee_names,
    ARRAY(
      SELECT iname.name FROM UNNEST(p.inventor_harmonized) AS iname
      WHERE iname.name IS NOT NULL
    ) AS inventor_names,
    ARRAY(
      SELECT DISTINCT REPLACE(cx.code, ' ', '')
      FROM UNNEST(p.cpc) AS cx
      WHERE cx.code IS NOT NULL
    ) AS cpc_codes
  FROM `patents-public-data.patents.publications` AS p
  WHERE p.country_code = 'US'
    AND p.publication_date IS NOT NULL
    AND p.publication_date >= start_date
    AND p.publication_date <  end_date
    AND NOT (p.publication_number LIKE 'USD%'  OR p.publication_number LIKE 'US-D%')   -- exclude design
    AND NOT (p.publication_number LIKE 'USPP%' OR p.publication_number LIKE 'US-PP%')  -- exclude plant
    AND EXISTS (
      SELECT 1
      FROM UNNEST(p.cpc) AS cx
      WHERE cx.code IS NOT NULL AND REGEXP_CONTAINS(REPLACE(cx.code, ' ', ''), @cpc_regex)
    )
    AND (
      REGEXP_CONTAINS(LOWER(COALESCE(p.title_localized[SAFE_OFFSET(0)].text, '')),
                      r'(language model|artificial intelligence|machine learning|machine-learning|neural network|neural-network)')
      OR REGEXP_CONTAINS(LOWER(COALESCE(p.abstract_localized[SAFE_OFFSET(0)].text, '')),
                         r'(language model|artificial intelligence|machine learning|machine-learning|neural network|neural-network)')
      OR REGEXP_CONTAINS(LOWER(COALESCE(p.claims_localized[SAFE_OFFSET(0)].text, '')),
                         r'(language model|artificial intelligence|machine learning|machine-learning|neural network|neural-network)')
    )
)
SELECT *
FROM base
-- One row per application: keep the most recent publication so a grant
-- supersedes its pre-grant publication within the same window.
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY COALESCE(application_number, pub_id)
  ORDER BY pub_date DESC, pub_id DESC
) = 1
ORDER BY pub_date, pub_id
"""

LATEST_BQ_DATE_SQL = (
    "SELECT MAX(publication_date) AS max_pub_date "
    "FROM `patents-public-data.patents.publications`"
)

CITATIONS_BQ_SQL = """
SELECT
  citing.publication_number                    AS citing_pub_id,
  cx.publication_number                        AS cited_pub_id,
  NULLIF(TRIM(cx.type), '')                    AS cite_type,
  NULLIF(TRIM(cx.category), '')                AS cite_category,
  NULLIF(cited.application_number_formatted, '') AS cited_application_number,
  NULLIF(cited.filing_date, 0)                 AS cited_filing_date,
  NULLIF(cited.priority_date, 0)               AS cited_priority_date,
  (
    SELECT an.name FROM UNNEST(cited.assignee_harmonized) AS an
    WHERE an.name IS NOT NULL AND an.name != ''
    LIMIT 1
  ) AS cited_assignee_name
FROM `patents-public-data.patents.publications` AS citing
CROSS JOIN UNNEST(citing.citation) AS cx
LEFT JOIN `patents-public-data.patents.publications` AS cited
  ON cited.publication_number = cx.publication_number
WHERE citing.publication_number IN UNNEST(@citing_pub_ids)
  AND cx.publication_number IS NOT NULL
  AND STARTS_WITH(cx.publication_number, 'US-')
ORDER BY citing.publication_number, cx.publication_number
"""

# ------------------
# Postgres templates
# ------------------

DELETE_MATCHING_PATENTS_SQL = """
DELETE FROM patent
WHERE application_number = ANY(%(application_numbers)s)
RETURNING pub_id, application_number;
"""

DELETE_KNN_EDGES_SQL = """
DELETE FROM knn_edge
WHERE src = ANY(%(pub_ids)s)
   OR dst = ANY(%(pub_ids)s);
"""

# cited_patent_assignee must not hold mappings that match a patent row (the
# patent table itself provides those; see citation_assignee_resolved view).
DELETE_CITED_ASSIGNEE_OVERLAP_SQL = """
DELETE FROM cited_patent_assignee
WHERE pub_id = ANY(%(pub_ids)s)
   OR application_number = ANY(%(application_numbers)s);
"""

DELETE_PATENT_ASSIGNEE_SQL = "DELETE FROM patent_assignee WHERE pub_id = ANY(%(pub_ids)s);"

UPSERT_PATENT_SQL = """
INSERT INTO patent (
    pub_id,
    application_number,
    priority_date,
    family_id,
    kind_code,
    pub_date,
    filing_date,
    title,
    abstract,
    claims_text,
    assignee_name,
    inventor_name,
    cpc
) VALUES (
    %(pub_id)s,
    %(application_number)s,
    %(priority_date)s,
    %(family_id)s,
    %(kind_code)s,
    %(pub_date)s,
    %(filing_date)s,
    %(title)s,
    %(abstract)s,
    %(claims_text)s,
    %(assignee_name)s,
    %(inventor_name)s::jsonb,
    %(cpc)s::jsonb
)
ON CONFLICT (pub_id) DO UPDATE SET
    application_number = EXCLUDED.application_number,
    priority_date      = EXCLUDED.priority_date,
    family_id          = EXCLUDED.family_id,
    kind_code          = EXCLUDED.kind_code,
    pub_date           = EXCLUDED.pub_date,
    filing_date        = EXCLUDED.filing_date,
    title              = EXCLUDED.title,
    abstract           = EXCLUDED.abstract,
    claims_text        = EXCLUDED.claims_text,
    assignee_name      = EXCLUDED.assignee_name,
    inventor_name      = EXCLUDED.inventor_name,
    cpc                = EXCLUDED.cpc,
    updated_at         = NOW();
"""

INGEST_LOG_SQL = """
INSERT INTO ingest_log (pub_id, stage, content_hash, detail, created_at)
VALUES (%(pub_id)s, %(stage)s, %(content_hash)s, %(detail)s, NOW())
ON CONFLICT (pub_id, stage) DO UPDATE SET
  content_hash = EXCLUDED.content_hash,
  detail = EXCLUDED.detail,
  created_at = NOW();
"""

SELECT_ALIAS_MATCHES_SQL = """
SELECT assignee_alias
FROM assignee_alias
WHERE assignee_alias = ANY(%(names)s);
"""

SELECT_CANONICAL_MATCHES_SQL = """
SELECT canonical_assignee_name
FROM canonical_assignee_name
WHERE canonical_assignee_name = ANY(%(names)s);
"""

UPDATE_PATENT_ASSIGNEE_IDS_SQL = """
UPDATE patent
SET canonical_assignee_name_id = %(canonical_id)s,
    assignee_alias_id = %(alias_id)s
WHERE pub_id = %(pub_id)s;
"""

INSERT_PATENT_ASSIGNEE_SQL = """
INSERT INTO patent_assignee (pub_id, alias_id, canonical_id, position)
VALUES (%(pub_id)s, %(alias_id)s, %(canonical_id)s, 1)
ON CONFLICT (pub_id, alias_id) DO NOTHING;
"""

DELETE_CLAIMS_SQL = "DELETE FROM patent_claim WHERE pub_id = ANY(%(pub_ids)s);"

INSERT_CLAIM_SQL = """
INSERT INTO patent_claim (pub_id, claim_number, is_independent, claim_text)
VALUES (%(pub_id)s, %(claim_number)s, TRUE, %(claim_text)s)
ON CONFLICT (pub_id, claim_number) DO UPDATE SET
  is_independent = EXCLUDED.is_independent,
  claim_text = EXCLUDED.claim_text,
  updated_at = NOW();
"""

UPSERT_EMBEDDINGS_SQL = """
INSERT INTO patent_embeddings (pub_id, model, dim, created_at, embedding)
VALUES (%(pub_id)s, %(model)s, %(dim)s, NOW(), CAST(%(embedding)s AS vector))
ON CONFLICT (model, pub_id)
DO UPDATE SET dim = EXCLUDED.dim,
              embedding = EXCLUDED.embedding,
              created_at = NOW();
"""

SELECT_EXISTING_EMB_SQL = """
SELECT pub_id, model
FROM patent_embeddings
WHERE pub_id = ANY(%(pub_ids)s)
  AND model = ANY(%(models)s);
"""

SELECT_EXISTING_CLAIM_EMB_SQL = """
SELECT pub_id, claim_number
FROM patent_claim_embeddings
WHERE pub_id = ANY(%(pub_ids)s);
"""

UPSERT_CLAIM_EMBEDDINGS_SQL = """
INSERT INTO patent_claim_embeddings (pub_id, claim_number, dim, created_at, embedding)
VALUES (%(pub_id)s, %(claim_number)s, %(dim)s, NOW(), CAST(%(embedding)s AS vector))
ON CONFLICT (pub_id, claim_number)
DO UPDATE SET dim = EXCLUDED.dim,
              embedding = EXCLUDED.embedding,
              created_at = NOW();
"""

INSERT_CITATION_SQL = """
INSERT INTO patent_citation (
    citing_pub_id, cited_pub_id, cited_application_number,
    cite_type, cited_filing_date, cited_priority_date, relation_source
)
SELECT %(citing_pub_id)s, %(cited_pub_id)s, %(cited_application_number)s,
       %(cite_type)s, %(cited_filing_date)s, %(cited_priority_date)s, 'bigquery'
WHERE EXISTS (SELECT 1 FROM patent WHERE pub_id = %(citing_pub_id)s)
  AND NOT EXISTS (
        SELECT 1
        FROM patent_citation pc
        WHERE pc.citing_pub_id = %(citing_pub_id)s
          AND (pc.cited_pub_id = %(cited_pub_id)s
               OR (%(cited_application_number)s::text IS NOT NULL
                   AND pc.cited_application_number = %(cited_application_number)s::text))
  );
"""

SELECT_PATENT_PUBS_SQL = "SELECT pub_id FROM patent WHERE pub_id = ANY(%(pub_ids)s);"

SELECT_PATENT_APPS_SQL = """
SELECT application_number
FROM patent
WHERE application_number = ANY(%(application_numbers)s);
"""

SELECT_CITED_ASSIGNEE_MATCH_SQL = """
SELECT id
FROM cited_patent_assignee
WHERE (pub_id = %(pub_id)s)
   OR (%(application_number)s::text IS NOT NULL AND application_number = %(application_number)s::text)
LIMIT 1;
"""

UPDATE_CITED_ASSIGNEE_SQL = """
UPDATE cited_patent_assignee
SET canonical_assignee_name_id = %(canonical_id)s,
    assignee_alias_id          = %(alias_id)s,
    assignee_name_raw          = %(assignee_name_raw)s,
    pub_id                     = COALESCE(pub_id, %(pub_id)s),
    application_number         = COALESCE(application_number, %(application_number)s),
    source                     = 'bigquery',
    updated_at                 = NOW()
WHERE id = %(id)s;
"""

INSERT_CITED_ASSIGNEE_SQL = """
INSERT INTO cited_patent_assignee (
    pub_id, application_number, canonical_assignee_name_id,
    assignee_alias_id, assignee_name_raw, source
)
VALUES (%(pub_id)s, %(application_number)s, %(canonical_id)s,
        %(alias_id)s, %(assignee_name_raw)s, 'bigquery');
"""

WATERMARK_SQL = "SELECT max(pub_date) FROM patent;"

# ---------------
# Data structures
# ---------------

@dataclass(frozen=True)
class PatentRecord:
    pub_id: str
    application_number: str | None
    priority_date: int | None
    family_id: str | None
    filing_date: int | None
    kind_code: str | None
    title: str
    abstract: str | None
    claims_text: str | None
    assignee_names: tuple[str, ...]
    inventor_name: tuple[str, ...]
    pub_date: int
    cpc: tuple[Mapping[str, str | None], ...]


@dataclass(frozen=True)
class CitationRecord:
    citing_pub_id: str
    cited_pub_id: str
    cited_application_number: str | None
    cite_type: str | None
    cited_filing_date: int | None
    cited_priority_date: int | None
    cited_assignee_name: str | None

    def cited_key(self) -> str:
        return self.cited_pub_id or (self.cited_application_number or "")


@dataclass(frozen=True)
class IndependentClaim:
    claim_number: int
    claim_text: str


@dataclass
class BatchIngestResult:
    records: list[PatentRecord] = field(default_factory=list)
    replaced: int = 0
    claims_by_pub: dict[str, list[IndependentClaim]] = field(default_factory=dict)
    failed: int = 0


@dataclass
class RunStats:
    records: int = 0
    replaced: int = 0
    failed_records: int = 0
    claims: int = 0
    doc_embeddings: int = 0
    claim_embeddings: int = 0
    citations: int = 0
    cited_assignees: int = 0


# ---------
# Utilities
# ---------

# Preamble phrases stripped from the head of claims_text; ordered so that the
# longer/more specific phrases are tried before their prefixes.
_CLAIM_PREAMBLES = (
    "having thus described the invention what is claimed as new and desired to be secured by letters patent is as follows",
    "having thus described the invention, what is claimed is",
    "the embodiments of the invention in which an exclusive property or privilege is claimed are defined as follows",
    "therefore, the following is claimed",
    "that which is claimed is",
    "the invention claimed is",
    "the claimed invention is",
    "the following is claimed",
    "what is claimed is",
    "what is claimed",
    "i (we) claim",
    "we (i) claim",
    "it is claimed",
    "we claim",
    "i claim",
    "what we claim is",
    "what i/we claim is",
    "what we claim",
    "what i/we claim",
    "we we/i claim is",
    "what we/i claim",
)

# Claim numbering heuristics (mirrors scripts/bq_update_issued_patent_staging.py,
# which is not imported because that module sets GOOGLE_APPLICATION_CREDENTIALS
# as an import side effect).
CLAIM_START_RE = re.compile(r"(?m)^\s*(\d+)\.\s")
INDEPENDENT_CLAIM_RE = re.compile(r"(?mi)^\s*(\d+)\.\s{1,4}a[n]?\s")


def chunked(iterable: Iterable, size: int) -> Iterator[list]:
    buf: list = []
    for item in iterable:
        buf.append(item)
        if len(buf) >= size:
            yield buf
            buf = []
    if buf:
        yield buf


def _safe_rollback(conn: PgConn) -> None:
    """Roll back without masking the original error when the connection died."""
    try:
        conn.rollback()
    except Exception as exc:
        logger.warning("Rollback skipped; connection already lost: %s", exc)


def executemany_chunked(
    cur: psycopg.Cursor[TupleRow],
    sql: LiteralString,
    params: Sequence[dict],
    chunk_size: int = DB_WRITE_CHUNK,
) -> int:
    """executemany in small chunks so one pipeline flush never grows into a
    multi-MB SSL write (which fails with 'SSL error: bad length' on some
    stacks). Returns the total affected-row count."""
    total = 0
    for chunk in chunked(params, chunk_size):
        cur.executemany(sql, chunk)
        total += max(cur.rowcount, 0)
    return total


def _parse_cpc_code(code: str) -> Mapping[str, str | None]:
    """Parse a CPC code like 'G06N3/08' into its components."""
    s = code.replace(" ", "").upper()
    m = re.match(r"^([A-HY])(\d{2})([A-Z])(\d+)(?:/(\d+))?$", s)
    if not m:
        return {"section": None, "class": None, "subclass": None, "group": None, "subgroup": None}
    section, cls, subclass, group, subgroup = m.groups()
    return {"section": section, "class": cls, "subclass": subclass, "group": group, "subgroup": subgroup}


def _clean_claims(claims: str | None) -> str | None:
    if not claims:
        return None
    lowered = claims.lower()
    for preamble in _CLAIM_PREAMBLES:
        if preamble in lowered:
            cleaned = re.sub(rf"^\s*{re.escape(preamble)}:?\s*", "", claims, flags=re.IGNORECASE)
            return cleaned.strip()
    return claims.strip()


def extract_independent_claims(claims_text: str | None) -> list[IndependentClaim]:
    """Extract independent claims from a claims blob using numbering heuristics.

    Independent claims start with "<num>. A/An" and run until the next claim
    number or the end of the string. The returned claim_text excludes the
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


def content_hash(rec: PatentRecord) -> str:
    payload = json.dumps(
        {
            "pub_id": rec.pub_id,
            "kind_code": rec.kind_code or "",
            "title": rec.title,
            "abstract": rec.abstract or "",
            "claims_text": rec.claims_text or "",
            "assignee_names": list(rec.assignee_names),
            "cpc": [dict(c) for c in rec.cpc],
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def clamp_text(s: str, max_chars: int = EMB_MAX_CHARS) -> str:
    if len(s) <= max_chars:
        return s
    cutoff = s.rfind(" ", 0, max_chars)
    return s[: (cutoff if cutoff > 0 else max_chars)]


def split_by_words(s: str, words_per_chunk: int) -> list[str]:
    """Approximate token-based chunking without external deps."""
    ws = s.split()
    return [" ".join(ws[i : i + words_per_chunk]) for i in range(0, len(ws), words_per_chunk)]


def vec_to_literal(v: Sequence[float]) -> str:
    # pgvector accepts '[v1,v2,...]' text literal
    return "[" + ",".join(f"{x:.8f}" for x in v) + "]"


def average_vectors(rows: Sequence[Sequence[float]]) -> list[float]:
    if not rows:
        return []
    dim = len(rows[0])
    acc = [0.0] * dim
    for r in rows:
        for i, x in enumerate(r):
            acc[i] += float(x)
    n = float(len(rows))
    return [x / n for x in acc]


# ---------------
# BigQuery stages
# ---------------

def _to_record(row: bigquery.Row) -> PatentRecord:
    cpc_struct = tuple(_parse_cpc_code(c) for c in (row["cpc_codes"] or []))
    return PatentRecord(
        pub_id=row["pub_id"],
        application_number=row.get("application_number"),
        priority_date=row.get("priority_date"),
        family_id=row.get("family_id"),
        kind_code=row.get("kind_code"),
        pub_date=row["pub_date"],
        filing_date=row.get("filing_date"),
        title=row.get("title") or "",
        abstract=row.get("abstract"),
        claims_text=_clean_claims(row.get("claims_text")),
        assignee_names=tuple(row.get("assignee_names") or []),
        inventor_name=tuple(row.get("inventor_names") or []),
        cpc=cpc_struct,
    )


def query_records(
    client: bigquery.Client,
    date_from: str,
    date_to: str,
    cpc_regex: str,
) -> Iterator[PatentRecord]:
    logger.info("Querying BigQuery records from %s to %s (CPC regex %s)", date_from, date_to, cpc_regex)
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("date_from", "STRING", date_from),
            bigquery.ScalarQueryParameter("date_to", "STRING", date_to),
            bigquery.ScalarQueryParameter("cpc_regex", "STRING", cpc_regex),
        ]
    )
    job = client.query(RECORDS_BQ_SQL, job_config=job_config)
    for row in job.result(page_size=BQ_PAGE_SIZE):
        yield _to_record(row)


def query_citations(client: bigquery.Client, citing_pub_ids: Sequence[str]) -> Iterator[CitationRecord]:
    logger.info("Querying BigQuery citations for %d citing publications", len(citing_pub_ids))
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ArrayQueryParameter("citing_pub_ids", "STRING", list(citing_pub_ids)),
        ]
    )
    job = client.query(CITATIONS_BQ_SQL, job_config=job_config)
    for row in job.result(page_size=BQ_PAGE_SIZE):
        yield CitationRecord(
            citing_pub_id=row["citing_pub_id"],
            cited_pub_id=row["cited_pub_id"],
            cited_application_number=row.get("cited_application_number"),
            # BigQuery's citation.type is usually empty; category (e.g. SEA) is
            # the informative field, so it is used as the fallback.
            cite_type=row.get("cite_type") or row.get("cite_category"),
            cited_filing_date=row.get("cited_filing_date"),
            cited_priority_date=row.get("cited_priority_date"),
            cited_assignee_name=row.get("cited_assignee_name"),
        )


def latest_publication_date(client: bigquery.Client) -> date | None:
    """Most recent publication_date available in the public patents table."""
    row = next(client.query(LATEST_BQ_DATE_SQL).result(), None)
    max_pub_date = row["max_pub_date"] if row else None
    logger.info("Latest publication_date in BigQuery: %s", max_pub_date)
    if max_pub_date is None:
        return None
    return datetime.strptime(str(max_pub_date), "%Y%m%d").date()


def latest_watermark(dsn: str) -> date | None:
    with psycopg.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute(WATERMARK_SQL)
        row = cur.fetchone()
    int_wm = row[0] if row and row[0] is not None else None
    logger.info("Latest watermark from Postgres: %s", int_wm)
    if int_wm is None:
        return None
    return datetime.strptime(str(int_wm), "%Y%m%d").date()


# --------------------------------------
# Record ingestion (delete-then-upsert)
# --------------------------------------

def choose_assignee_names(conn: PgConn, batch: Sequence[PatentRecord]) -> dict[str, str]:
    """Pick the assignee name to use for each record.

    Preference order per record:
    1. a harmonized name that already exists verbatim in assignee_alias;
    2. a harmonized name whose canonical form already exists in
       canonical_assignee_name;
    3. the first harmonized name.
    """
    all_names = sorted({n for r in batch for n in r.assignee_names})
    if not all_names:
        return {}
    all_canons = sorted({c for c in (canonicalize_assignee(n) for n in all_names) if c})

    with conn.cursor() as cur:
        cur.execute(SELECT_ALIAS_MATCHES_SQL, {"names": all_names})
        existing_aliases = {r[0] for r in cur.fetchall()}
        existing_canons: set[str] = set()
        if all_canons:
            cur.execute(SELECT_CANONICAL_MATCHES_SQL, {"names": all_canons})
            existing_canons = {r[0] for r in cur.fetchall()}

    chosen: dict[str, str] = {}
    for rec in batch:
        if not rec.assignee_names:
            continue
        name = next((n for n in rec.assignee_names if n in existing_aliases), None)
        if name is None:
            name = next(
                (n for n in rec.assignee_names if canonicalize_assignee(n) in existing_canons),
                None,
            )
        chosen[rec.pub_id] = name if name is not None else rec.assignee_names[0]
    return chosen


def link_assignees(conn: PgConn, batch: Sequence[PatentRecord], chosen: Mapping[str, str]) -> None:
    """Canonicalize chosen assignee names and link patent + patent_assignee."""
    canon_by_alias: dict[str, str] = {}
    for rec in batch:
        alias = chosen.get(rec.pub_id)
        if not alias:
            continue
        canon = canonicalize_assignee(alias)
        if canon:
            canon_by_alias[alias] = canon
    if not canon_by_alias:
        return

    canon_ids = upsert_canonical_names(conn, canon_by_alias.values())
    alias_pairs = [
        (alias, canon_ids[canon])
        for alias, canon in canon_by_alias.items()
        if canon in canon_ids
    ]
    alias_ids = upsert_aliases(conn, alias_pairs)

    link_params: list[dict[str, str]] = []
    for rec in batch:
        alias = chosen.get(rec.pub_id)
        if not alias:
            continue
        canon = canon_by_alias.get(alias)
        canon_id = canon_ids.get(canon or "")
        alias_id = alias_ids.get(alias)
        if canon_id and alias_id:
            link_params.append({"pub_id": rec.pub_id, "canonical_id": canon_id, "alias_id": alias_id})

    if link_params:
        with conn.cursor() as cur:
            # Fresh data wins: drop any surviving links from a prior ingest of
            # the same pub_id (delete-cascade already covered replaced rows).
            cur.execute(DELETE_PATENT_ASSIGNEE_SQL, {"pub_ids": [p["pub_id"] for p in link_params]})
            executemany_chunked(cur, UPDATE_PATENT_ASSIGNEE_IDS_SQL, link_params)
            executemany_chunked(cur, INSERT_PATENT_ASSIGNEE_SQL, link_params)


def _ingest_records(conn: PgConn, batch: Sequence[PatentRecord]) -> BatchIngestResult:
    """Delete rows matching incoming application numbers, then upsert fresh
    records with assignee links, independent claims, and ingest_log entries.

    Runs entirely inside the caller's transaction.
    """
    result = BatchIngestResult()
    chosen = choose_assignee_names(conn, batch)

    app_numbers = [r.application_number for r in batch if r.application_number]
    replaced_by_app: dict[str, str] = {}
    with conn.cursor() as cur:
        if app_numbers:
            cur.execute(DELETE_MATCHING_PATENTS_SQL, {"application_numbers": app_numbers})
            deleted = cur.fetchall()
            if deleted:
                replaced_by_app = {app: pub for pub, app in deleted}
                # knn_edge has no FK to patent; drop edges of replaced rows so
                # the graph never references deleted pub_ids.
                cur.execute(DELETE_KNN_EDGES_SQL, {"pub_ids": [pub for pub, _ in deleted]})

        executemany_chunked(
            cur,
            UPSERT_PATENT_SQL,
            [
                {
                    "pub_id": r.pub_id,
                    "application_number": r.application_number,
                    "priority_date": r.priority_date,
                    "family_id": r.family_id,
                    "kind_code": r.kind_code,
                    "pub_date": r.pub_date,
                    "filing_date": r.filing_date,
                    "title": r.title,
                    "abstract": r.abstract,
                    "claims_text": r.claims_text,
                    "assignee_name": chosen.get(r.pub_id),
                    "inventor_name": json.dumps(list(r.inventor_name), ensure_ascii=False),
                    "cpc": json.dumps([dict(c) for c in r.cpc], ensure_ascii=False),
                }
                for r in batch
            ],
        )

        # These assets are now first-class patent rows, so their assignee
        # mappings must come from the patent table, not cited_patent_assignee.
        cur.execute(
            DELETE_CITED_ASSIGNEE_OVERLAP_SQL,
            {"pub_ids": [r.pub_id for r in batch], "application_numbers": app_numbers},
        )

    link_assignees(conn, batch, chosen)

    # Rebuild independent claims for every pub in the batch. The delete also
    # covers same-pub_id re-ingests, where cascades did not clear old claims.
    claims_by_pub: dict[str, list[IndependentClaim]] = {}
    claim_params: list[dict] = []
    for r in batch:
        claims = extract_independent_claims(r.claims_text)
        if claims:
            claims_by_pub[r.pub_id] = claims
            claim_params.extend(
                {"pub_id": r.pub_id, "claim_number": c.claim_number, "claim_text": c.claim_text}
                for c in claims
            )
    with conn.cursor() as cur:
        cur.execute(DELETE_CLAIMS_SQL, {"pub_ids": [r.pub_id for r in batch]})
        if claim_params:
            executemany_chunked(cur, INSERT_CLAIM_SQL, claim_params)

        executemany_chunked(
            cur,
            INGEST_LOG_SQL,
            [
                {
                    "pub_id": r.pub_id,
                    "stage": "inserted",
                    "content_hash": content_hash(r),
                    "detail": json.dumps(
                        {
                            "source": "bigquery",
                            "replaced_pub_id": replaced_by_app.get(r.application_number or ""),
                            "independent_claims": len(claims_by_pub.get(r.pub_id, [])),
                        },
                        ensure_ascii=False,
                    ),
                }
                for r in batch
            ],
        )

    result.records = list(batch)
    result.replaced = len(replaced_by_app)
    result.claims_by_pub = claims_by_pub
    return result


def ingest_record_batch(pool: ConnectionPool[PgConn], batch: Sequence[PatentRecord]) -> BatchIngestResult:
    """Ingest a batch in one transaction. Transient connection errors are
    retried on a fresh connection; any other failure falls back to per-record
    transactions so one bad record does not sink the batch."""
    for attempt in range(1, DB_BATCH_RETRIES + 1):
        with pool.connection() as conn:
            try:
                result = _ingest_records(conn, batch)
                conn.commit()
                return result
            except psycopg.OperationalError as exc:
                _safe_rollback(conn)
                logger.warning(
                    "Batch ingest hit a connection error (attempt %d/%d): %s",
                    attempt,
                    DB_BATCH_RETRIES,
                    exc,
                )
                time.sleep(min(2 ** (attempt - 1), 30))
            except Exception:
                _safe_rollback(conn)
                logger.exception("Batch ingest failed for %d records; retrying record-by-record", len(batch))
                break

    merged = BatchIngestResult()
    for record in batch:
        with pool.connection() as conn:
            try:
                single = _ingest_records(conn, [record])
                conn.commit()
                merged.records.extend(single.records)
                merged.replaced += single.replaced
                merged.claims_by_pub.update(single.claims_by_pub)
            except Exception as exc:
                _safe_rollback(conn)
                merged.failed += 1
                logger.error("Skipping record %s after ingest error: %s", record.pub_id, exc, exc_info=True)
    return merged


# --------------------------
# Embeddings stage (OpenAI)
# --------------------------

def get_openai_client() -> OpenAI:
    # OPENAI_API_KEY required; OPENAI_BASE_URL optional for self-hosted proxies
    base = os.getenv("OPENAI_BASE_URL")
    if base:
        return OpenAI(base_url=base)
    return OpenAI()


@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
def embed_texts(client: OpenAI, texts: Sequence[str], model: str) -> list[list[float]]:
    out: list[list[float]] = []
    for batch in chunked(texts, EMB_BATCH_SIZE):
        resp = client.embeddings.create(model=model, input=list(batch))
        out.extend([d.embedding for d in resp.data])
        time.sleep(EMB_SLEEP_SECS)
    return out


def build_ta_input(r: PatentRecord) -> str | None:
    parts = [p for p in (r.title, r.abstract or "") if p]
    if not parts:
        return None
    return clamp_text("\n\n".join(parts))


def build_claims_inputs(claims_text: str | None, words_per_chunk: int) -> list[str]:
    if not claims_text:
        return []
    return split_by_words(clamp_text(claims_text), words_per_chunk=words_per_chunk)


def _embed_chunked[K](
    client: OpenAI, items: Sequence[tuple[K, list[str]]]
) -> list[tuple[K, list[float]]]:
    """Embed per-item chunk lists in one flat API pass; average chunks per item."""
    flat_texts: list[str] = []
    offsets: list[tuple[int, int]] = []
    start = 0
    for _, chunks in items:
        flat_texts.extend(chunks)
        offsets.append((start, start + len(chunks)))
        start += len(chunks)
    flat_vecs = embed_texts(client, flat_texts, EMB_MODEL)
    out: list[tuple[K, list[float]]] = []
    for (key, _chunks), (s, e) in zip(items, offsets, strict=True):
        avg = average_vectors(flat_vecs[s:e])
        if avg:
            out.append((key, avg))
    return out


@retry(
    retry=retry_if_exception_type(psycopg.OperationalError),
    wait=wait_random_exponential(min=1, max=30),
    stop=stop_after_attempt(DB_BATCH_RETRIES),
    reraise=True,
)
def upsert_rows(pool: ConnectionPool[PgConn], sql: LiteralString, rows: Sequence[dict]) -> None:
    if not rows:
        return
    with pool.connection() as conn:
        try:
            with conn.cursor() as cur:
                executemany_chunked(cur, sql, rows)
            conn.commit()
        except Exception:
            _safe_rollback(conn)
            raise


def ensure_doc_embeddings_for_batch(
    pool: ConnectionPool[PgConn], client: OpenAI, batch: Sequence[PatentRecord]
) -> int:
    """Create |ta and |claims embeddings for records missing them. Returns upsert count."""
    if not batch:
        return 0

    pub_ids = [r.pub_id for r in batch]
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(SELECT_EXISTING_EMB_SQL, {"pub_ids": pub_ids, "models": [MODEL_TA, MODEL_CLAIMS]})
        existing = {(r[0], r[1]) for r in cur.fetchall()}

    rows: list[dict] = []

    ta_inputs = [
        (r.pub_id, text)
        for r in batch
        if (r.pub_id, MODEL_TA) not in existing and (text := build_ta_input(r))
    ]
    if ta_inputs:
        vectors = embed_texts(client, [t for _, t in ta_inputs], EMB_MODEL)
        rows.extend(
            {"pub_id": pub_id, "model": MODEL_TA, "dim": len(vec), "embedding": vec_to_literal(vec)}
            for (pub_id, _), vec in zip(ta_inputs, vectors, strict=True)
        )

    claims_items = [
        (r.pub_id, chunks)
        for r in batch
        if (r.pub_id, MODEL_CLAIMS) not in existing
        and (chunks := build_claims_inputs(r.claims_text, TA_WORDS_PER_CHUNK))
    ]
    if claims_items:
        rows.extend(
            {"pub_id": pub_id, "model": MODEL_CLAIMS, "dim": len(vec), "embedding": vec_to_literal(vec)}
            for pub_id, vec in _embed_chunked(client, claims_items)
        )

    upsert_rows(pool, UPSERT_EMBEDDINGS_SQL, rows)
    return len(rows)


def ensure_claim_embeddings_for_batch(
    pool: ConnectionPool[PgConn],
    client: OpenAI,
    claims_by_pub: Mapping[str, Sequence[IndependentClaim]],
) -> int:
    """Create one embedding per independent claim. Returns upsert count."""
    if not claims_by_pub:
        return 0

    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(SELECT_EXISTING_CLAIM_EMB_SQL, {"pub_ids": list(claims_by_pub)})
        existing = {(r[0], r[1]) for r in cur.fetchall()}

    items: list[tuple[tuple[str, int], list[str]]] = []
    for pub_id, claims in claims_by_pub.items():
        for claim in claims:
            if (pub_id, claim.claim_number) in existing:
                continue
            chunks = build_claims_inputs(claim.claim_text, CLAIM_WORDS_PER_CHUNK)
            if chunks:
                items.append(((pub_id, claim.claim_number), chunks))
    if not items:
        return 0

    rows = [
        {"pub_id": pub_id, "claim_number": claim_number, "dim": len(vec), "embedding": vec_to_literal(vec)}
        for (pub_id, claim_number), vec in _embed_chunked(client, items)
    ]
    upsert_rows(pool, UPSERT_CLAIM_EMBEDDINGS_SQL, rows)
    return len(rows)


def log_stage(pool: ConnectionPool[PgConn], pub_ids: Iterable[str], stage: str, detail: Mapping) -> None:
    params = [
        {"pub_id": pub_id, "stage": stage, "content_hash": None, "detail": json.dumps(detail, ensure_ascii=False)}
        for pub_id in pub_ids
    ]
    if params:
        upsert_rows(pool, INGEST_LOG_SQL, params)


# ----------------
# Citations stage
# ----------------

def _dedupe_citations(rows: Sequence[CitationRecord]) -> list[CitationRecord]:
    seen: set[tuple[str, str]] = set()
    out: list[CitationRecord] = []
    for r in rows:
        key = (r.citing_pub_id, r.cited_pub_id)
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def _insert_citations(conn: PgConn, rows: Sequence[CitationRecord]) -> int:
    with conn.cursor() as cur:
        return executemany_chunked(
            cur,
            INSERT_CITATION_SQL,
            [
                {
                    "citing_pub_id": r.citing_pub_id,
                    "cited_pub_id": r.cited_pub_id,
                    "cited_application_number": r.cited_application_number,
                    "cite_type": r.cite_type,
                    "cited_filing_date": r.cited_filing_date,
                    "cited_priority_date": r.cited_priority_date,
                }
                for r in rows
            ],
        )


def _resolve_cited_assignees(
    conn: PgConn, rows: Sequence[CitationRecord], resolved: set[str]
) -> int:
    """Upsert canonicalized assignees of cited patents that are outside the
    patent table. Mirrors the update-or-insert strategy of
    backfill_cited_pub_assignees.py (cited_patent_assignee enforces unique
    pub_id AND unique application_number, and the same asset can appear under
    both a pre-grant and a granted publication number)."""
    candidates: dict[str, CitationRecord] = {}
    for r in rows:
        key = r.cited_key()
        if key and r.cited_assignee_name and key not in resolved and key not in candidates:
            candidates[key] = r
    if not candidates:
        return 0

    cited_pubs = [r.cited_pub_id for r in candidates.values()]
    cited_apps = [r.cited_application_number for r in candidates.values() if r.cited_application_number]
    with conn.cursor() as cur:
        cur.execute(SELECT_PATENT_PUBS_SQL, {"pub_ids": cited_pubs})
        in_corpus_pubs = {r[0] for r in cur.fetchall()}
        in_corpus_apps: set[str] = set()
        if cited_apps:
            cur.execute(SELECT_PATENT_APPS_SQL, {"application_numbers": cited_apps})
            in_corpus_apps = {r[0] for r in cur.fetchall()}

    out_of_corpus: list[CitationRecord] = []
    for key, r in candidates.items():
        resolved.add(key)
        if r.cited_pub_id in in_corpus_pubs or (
            r.cited_application_number and r.cited_application_number in in_corpus_apps
        ):
            continue  # assignee resolvable through the patent table itself
        out_of_corpus.append(r)
    if not out_of_corpus:
        return 0

    canon_by_alias: dict[str, str] = {}
    for r in out_of_corpus:
        assert r.cited_assignee_name is not None  # filtered above
        canon = canonicalize_assignee(r.cited_assignee_name)
        if canon:
            canon_by_alias[r.cited_assignee_name] = canon
    canon_ids = upsert_canonical_names(conn, canon_by_alias.values())
    alias_ids = upsert_aliases(
        conn,
        [(alias, canon_ids[canon]) for alias, canon in canon_by_alias.items() if canon in canon_ids],
    )

    upserted = 0
    with conn.cursor() as cur:
        for r in out_of_corpus:
            alias = r.cited_assignee_name or ""
            canon = canon_by_alias.get(alias)
            canon_id = canon_ids.get(canon or "")
            alias_id = alias_ids.get(alias)
            if not canon_id or not alias_id:
                continue
            params = {
                "pub_id": r.cited_pub_id,
                "application_number": r.cited_application_number,
                "canonical_id": canon_id,
                "alias_id": alias_id,
                "assignee_name_raw": alias,
            }
            cur.execute(SELECT_CITED_ASSIGNEE_MATCH_SQL, params)
            row = cur.fetchone()
            if row:
                cur.execute(UPDATE_CITED_ASSIGNEE_SQL, {**params, "id": row[0]})
            else:
                cur.execute(INSERT_CITED_ASSIGNEE_SQL, params)
            upserted += 1
    return upserted


def process_citations(
    pool: ConnectionPool[PgConn],
    bq_client: bigquery.Client,
    citing_pub_ids: Sequence[str],
    batch_size: int,
    stats: RunStats,
) -> None:
    resolved_cited: set[str] = set()
    for pub_chunk in chunked(citing_pub_ids, CITATION_PUBS_PER_QUERY):
        stream = query_citations(bq_client, pub_chunk)
        for raw_batch in chunked(stream, batch_size):
            batch = _dedupe_citations(raw_batch)
            for attempt in range(1, DB_BATCH_RETRIES + 1):
                # Work on a copy so a failed attempt does not mark cited
                # patents as resolved without their rows being committed.
                attempt_resolved = set(resolved_cited)
                with pool.connection() as conn:
                    try:
                        inserted = _insert_citations(conn, batch)
                        assignees = _resolve_cited_assignees(conn, batch, attempt_resolved)
                        with conn.cursor() as cur:
                            executemany_chunked(
                                cur,
                                INGEST_LOG_SQL,
                                [
                                    {
                                        "pub_id": pub_id,
                                        "stage": "citations",
                                        "content_hash": None,
                                        "detail": json.dumps({"source": "bigquery"}),
                                    }
                                    for pub_id in sorted({r.citing_pub_id for r in batch})
                                ],
                            )
                        conn.commit()
                        resolved_cited = attempt_resolved
                        stats.citations += inserted
                        stats.cited_assignees += assignees
                        break
                    except psycopg.OperationalError as exc:
                        _safe_rollback(conn)
                        logger.warning(
                            "Citation batch hit a connection error (attempt %d/%d): %s",
                            attempt,
                            DB_BATCH_RETRIES,
                            exc,
                        )
                        time.sleep(min(2 ** (attempt - 1), 30))
                    except Exception:
                        _safe_rollback(conn)
                        logger.exception(
                            "Citation batch failed (%d rows, first citing=%s); continuing",
                            len(batch),
                            batch[0].citing_pub_id if batch else "n/a",
                        )
                        break
            logger.info(
                "Citations progress: %d rows inserted, %d cited assignees upserted",
                stats.citations,
                stats.cited_assignees,
            )


# -----------
# CLI / main
# -----------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Comprehensive BigQuery → Postgres patent ETL.")
    p.add_argument("--date-from", help="YYYY-MM-DD inclusive; default = max(patent.pub_date)")
    p.add_argument("--date-to", help="YYYY-MM-DD exclusive; default = latest BigQuery publication_date + 1 day")
    p.add_argument("--batch-size", type=int, default=500, help="records per DB transaction / embedding batch")
    p.add_argument("--citation-batch-size", type=int, default=2000, help="citation rows per DB transaction")
    p.add_argument("--project", default=os.getenv("BQ_PROJECT", "patent-scout-etl"), help="BigQuery project id")
    p.add_argument("--location", default=os.getenv("BQ_LOCATION"), help="BigQuery location")
    p.add_argument("--dsn", default=os.getenv("PG_DSN", ""), help="Postgres DSN")
    p.add_argument("--cpc-regex", default=os.getenv("CPC_REGEX", AI_CPC_REGEX_DEFAULT), help="CPC filter regex")
    p.add_argument("--skip-embeddings", action="store_true", help="Skip embedding generation")
    p.add_argument("--skip-citations", action="store_true", help="Skip the citations stage")
    p.add_argument("--dry-run", action="store_true", help="Query BigQuery and count records; write nothing")
    return p.parse_args()


def resolve_date_range(
    args: argparse.Namespace, watermark: date | None, latest_bq: date | None
) -> tuple[str, str]:
    if args.date_from:
        date_from = args.date_from
    elif watermark:
        date_from = watermark.isoformat()
    else:
        date_from = (date.today() - timedelta(days=10)).isoformat()

    if args.date_to:
        date_to = args.date_to
    elif latest_bq:
        date_to = (latest_bq + timedelta(days=1)).isoformat()
    else:
        date_to = date.today().isoformat()
    return date_from, date_to


def main() -> int:
    args = parse_args()

    if not args.project:
        logger.error("BQ_PROJECT not set and --project not provided")
        return 2
    if not args.dsn:
        logger.error("PG_DSN not set and --dsn not provided")
        return 2

    bq_client = (
        bigquery.Client(project=args.project, location=args.location)
        if args.location
        else bigquery.Client(project=args.project)
    )

    watermark = latest_watermark(args.dsn)
    latest_bq = latest_publication_date(bq_client)
    if watermark and latest_bq and watermark > latest_bq:
        logger.info(
            "Watermark %s is after latest BigQuery publication_date %s; nothing to do.",
            watermark.isoformat(),
            latest_bq.isoformat(),
        )
        return 0

    date_from, date_to = resolve_date_range(args, watermark, latest_bq)
    if date.fromisoformat(date_from) >= date.fromisoformat(date_to):
        logger.info("Empty date range %s → %s; nothing to do.", date_from, date_to)
        return 0
    logger.info("Loading publications from %s (inclusive) to %s (exclusive)", date_from, date_to)

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
    oa_client = get_openai_client() if not (args.skip_embeddings or args.dry_run) else None

    stats = RunStats()
    ingested_pub_ids: list[str] = []

    try:
        stream = query_records(bq_client, date_from=date_from, date_to=date_to, cpc_regex=args.cpc_regex)
        for batch in chunked(stream, args.batch_size):
            if args.dry_run:
                stats.records += len(batch)
                continue

            result = ingest_record_batch(pool, batch)
            stats.records += len(result.records)
            stats.replaced += result.replaced
            stats.failed_records += result.failed
            stats.claims += sum(len(c) for c in result.claims_by_pub.values())
            ingested_pub_ids.extend(r.pub_id for r in result.records)

            if oa_client is not None and result.records:
                doc_count = ensure_doc_embeddings_for_batch(pool, oa_client, result.records)
                claim_count = ensure_claim_embeddings_for_batch(pool, oa_client, result.claims_by_pub)
                stats.doc_embeddings += doc_count
                stats.claim_embeddings += claim_count
                log_stage(
                    pool,
                    (r.pub_id for r in result.records),
                    "embedded",
                    {"source": "bigquery", "models": [MODEL_TA, MODEL_CLAIMS]},
                )

            logger.info(
                "Progress: %d records upserted (%d replaced, %d failed), %d claims, %d doc embeddings, %d claim embeddings",
                stats.records,
                stats.replaced,
                stats.failed_records,
                stats.claims,
                stats.doc_embeddings,
                stats.claim_embeddings,
            )

        if args.dry_run:
            logger.info("Dry run: %d records matched between %s and %s.", stats.records, date_from, date_to)
            return 0

        if not args.skip_citations and ingested_pub_ids:
            process_citations(pool, bq_client, ingested_pub_ids, args.citation_batch_size, stats)
    finally:
        pool.close()

    logger.info(
        "ETL complete for %s → %s: %d records (%d replaced, %d failed), %d independent claims, "
        "%d doc embeddings, %d claim embeddings, %d citations, %d cited assignees.",
        date_from,
        date_to,
        stats.records,
        stats.replaced,
        stats.failed_records,
        stats.claims,
        stats.doc_embeddings,
        stats.claim_embeddings,
        stats.citations,
        stats.cited_assignees,
    )
    return 0 if stats.failed_records == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
