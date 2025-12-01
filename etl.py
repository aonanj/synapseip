#!/usr/bin/env python3
"""
etl_bigquery_to_postgres.py

BigQuery → Postgres loader for SynapseIP MVP with integrated:
- claims ingestion 
- embeddings generation (OpenAI text-embedding-3-small) for title+abstract and claims

Idempotent:
- Upsert into patent
- Log stages in ingest_log
- Skip existing embeddings (per pub_id, model)
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
from dataclasses import dataclass
from datetime import date, datetime, timedelta

import psycopg
from dotenv import load_dotenv
from google.cloud import bigquery
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

AI_CPC_REGEX_DEFAULT = r"^(G06N|G06V|G06F17|G06F18|G06F40|G06F16/90|G06K9|G06T7|G10L|A61B|B60W|G05D)"

PATENTSVIEW_BASE = "https://search.patentsview.org/api/v1"
PV_TIMEOUT = 60
PV_MAX_DOCS_PER_REQ = 200
BQ_PAGE_SIZE = 5000

EMB_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
EMB_DIM_HINT = 1024  # used only for DDL consistency; actual dim read from result length
EMB_BATCH_SIZE = int(os.getenv("EMB_BATCH_SIZE", "150"))
EMB_MAX_CHARS = int(os.getenv("EMB_MAX_CHARS", "25000"))  # simple guard for overlong inputs

# Derived model names to store multiple rows per pub_id without schema change
MODEL_TA = f"{EMB_MODEL}|ta"
MODEL_CLAIMS = f"{EMB_MODEL}|claims"

# psycopg generics
type PgConn = Connection[TupleRow]

# -------------
# SQL templates
# -------------

BQ_SQL_TEMPLATE = """
DECLARE start_date INT64 DEFAULT CAST(REPLACE(@date_from, '-', '') AS INT64);
DECLARE end_date   INT64 DEFAULT CAST(REPLACE(@date_to, '-', '') AS INT64);

WITH base AS (
  SELECT
    p.publication_number    AS pub_id,
    p.application_number_formatted AS application_number,
    p.priority_date,
    p.family_id,
    p.kind_code,
    p.publication_date    AS pub_date,
    p.filing_date,
    p.title_localized[SAFE_OFFSET(0)].text     AS title,
    p.abstract_localized[SAFE_OFFSET(0)].text  AS abstract,
    p.claims_localized[SAFE_OFFSET(0)].text    AS claims_text,
    (SELECT an.name FROM UNNEST(p.assignee_harmonized) an WHERE an.name IS NOT NULL LIMIT 1) AS assignee_name,
    ARRAY(SELECT iname.name FROM UNNEST(p.inventor_harmonized) iname WHERE iname.name IS NOT NULL) AS inventor_names,
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
    AND NOT (p.publication_number LIKE 'USD%'  OR p.publication_number LIKE 'US-D%')  -- exclude design
    AND NOT (p.publication_number LIKE 'USPP%' OR p.publication_number LIKE 'US-PP%')  -- exclude plant
    AND EXISTS (
      SELECT 1
      FROM UNNEST(p.cpc) AS cx
      WHERE cx.code IS NOT NULL AND REGEXP_CONTAINS(REPLACE(cx.code, ' ', ''), @cpc_regex)
    )
    AND (
      REGEXP_CONTAINS(LOWER(COALESCE(p.title_localized[SAFE_OFFSET(0)].text, '')),
                      r'(artificial intelligence|machine learning|machine-learning|neural network|neural-network)')
      OR REGEXP_CONTAINS(LOWER(COALESCE(p.abstract_localized[SAFE_OFFSET(0)].text, '')),
                         r'(artificial intelligence|machine learning|machine-learning|neural network|neural-network)')
      OR REGEXP_CONTAINS(LOWER(COALESCE(p.claims_localized[SAFE_OFFSET(0)].text, '')),
                         r'(artificial intelligence|machine learning|machine-learning|neural network|neural-network)')
    )
)
SELECT
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
  inventor_names,
  cpc_codes
FROM base
ORDER BY pub_date, pub_id
"""

UPSERT_SQL = """
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
    application_number = COALESCE(EXCLUDED.application_number, patent.application_number),
    priority_date     = COALESCE(EXCLUDED.priority_date,     patent.priority_date),
    family_id         = COALESCE(EXCLUDED.family_id,         patent.family_id),
    kind_code         = COALESCE(EXCLUDED.kind_code,         patent.kind_code),
    pub_date          = COALESCE(EXCLUDED.pub_date,          patent.pub_date),
    filing_date       = COALESCE(EXCLUDED.filing_date,       patent.filing_date),
    title             = COALESCE(NULLIF(EXCLUDED.title, ''), patent.title),
    abstract          = COALESCE(EXCLUDED.abstract,          patent.abstract),
    claims_text       = COALESCE(EXCLUDED.claims_text,       patent.claims_text),
    assignee_name     = COALESCE(EXCLUDED.assignee_name,     patent.assignee_name),
    inventor_name     = COALESCE(EXCLUDED.inventor_name,     patent.inventor_name),
    cpc               = COALESCE(EXCLUDED.cpc,               patent.cpc)
"""

INGEST_LOG_SQL = """
INSERT INTO ingest_log (pub_id, stage, content_hash, detail, created_at)
VALUES (%(pub_id)s, %(stage)s, %(content_hash)s, %(detail)s, NOW())
ON CONFLICT (pub_id, stage) DO UPDATE SET
  content_hash = EXCLUDED.content_hash,
  detail = EXCLUDED.detail,
  created_at = NOW();
"""

UPDATE_CLAIMS_SQL = """
UPDATE patent
SET claims_text = %(claims_text)s,
    updated_at = NOW()
WHERE id = %(id)s;
"""

# Embeddings upsert; pass vector as text literal and cast
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

# --------------
# Data structures
# --------------

@dataclass(frozen=True)
class PatentRecord:
    pub_id: str
    application_number: str | None
    priority_date: int | None
    family_id: str | None
    filing_date: int | None
    kind_code: str | None
    title: str | None
    abstract: str | None
    assignee_name: str | None
    inventor_name: list[str]
    pub_date: int
    cpc: Sequence[Mapping[str, str | None]]
    claims_text: str | None


# -----------
# Utilities
# -----------

_DIGITS = re.compile(r"\d+")


def _iso_to_date(s: str) -> date:
    if "-" in s:
        return datetime.strptime(s, "%Y-%m-%d").date()
    return datetime.strptime(s, "%Y%m%d").date()

def _parse_cpc_code(code: str) -> Mapping[str, str | None]:
    """
    Parse a CPC code like 'G06N3/08' into components.
    Returns dict with keys: section, class, subclass, group, subgroup.
    Missing parts become None.
    """
    s = code.replace(" ", "").upper()
    # Pattern: Section(A-Z) Class(2 digits) Subclass(A-Z) Group(int) Optional /Subgroup(int)
    m = re.match(r"^([A-HY])(\d{2})([A-Z])(\d+)(?:/(\d+))?$", s)
    if not m:
        return {
            "section": None,
            "class": None,
            "subclass": None,
            "group": None,
            "subgroup": None,
        }
    section, cls, subclass, group, subgroup = m.groups()
    return {
        "section": section,
        "class": cls,
        "subclass": subclass,
        "group": group,
        "subgroup": subgroup,
    }

def _clean_claims(claims: str | None) -> str | None:
    if not claims:
        return None
    claims_clean = None
    if "what is claimed is" in claims.lower():
        claims_clean = re.sub(r"^\s*what is claimed is:?\s*", "", claims, flags=re.IGNORECASE)
    elif "what is claimed" in claims.lower():
        claims_clean = re.sub(r"^\s*what is claimed:?\s*", "", claims, flags=re.IGNORECASE)
    elif "the invention claimed is" in claims.lower():
        claims_clean = re.sub(r"^\s*the invention claimed is:?\s*", "", claims, flags=re.IGNORECASE)
    elif "we claim" in claims.lower():
        claims_clean = re.sub(r"^\s*we claim:?\s*", "", claims, flags=re.IGNORECASE)
    elif "i claim" in claims.lower():
        claims_clean = re.sub(r"^\s*i claim:?\s*", "", claims, flags=re.IGNORECASE)
    elif "i (we) claim" in claims.lower():
        claims_clean = re.sub(r"^\s*i (we) claim:?\s*", "", claims, flags=re.IGNORECASE)
    elif "we (i) claim" in claims.lower():
        claims_clean = re.sub(r"^\s*we (i) claim:?\s*", "", claims, flags=re.IGNORECASE)
    elif "that which is claimed is" in claims.lower():
        claims_clean = re.sub(r"^\s*that which is claimed is:?\s*", "", claims, flags=re.IGNORECASE)
    elif "having thus described the invention what is claimed as new and desired to be secured by letters patent is as follows" in claims.lower():
        claims_clean = re.sub(r"^\s*having thus described the invention what is claimed as new and desired to be secured by letters patent is as follows:?\s*", "", claims, flags=re.IGNORECASE)
    elif "having thus described the invention, what is claimed is" in claims.lower():
        claims_clean = re.sub(r"^\s*having thus described the invention, what is claimed is:?\s*", "", claims, flags=re.IGNORECASE)
    elif "it is claimed" in claims.lower():
        claims_clean = re.sub(r"^\s*it is claimed:?\s*", "", claims, flags=re.IGNORECASE)
    elif "therefore, the following is claimed" in claims.lower():
        claims_clean = re.sub(r"^\s*therefore, the following is claimed:?\s*", "", claims, flags=re.IGNORECASE)
    elif "the following is claimed" in claims.lower():
        claims_clean = re.sub(r"^\s*the following is claimed:?\s*", "", claims, flags=re.IGNORECASE)
    elif "the embodiments of the invention in which an exclusive property or privilege is claimed are defined as follows" in claims.lower():
        claims_clean = re.sub(r"^\s*the embodiments of the invention in which an exclusive property or privilege is claimed are defined as follows:?\s*", "", claims, flags=re.IGNORECASE)
    elif "the claimed invention is:" in claims.lower():
        claims_clean = re.sub(r"^\s*the claimed invention is:?\s*", "", claims, flags=re.IGNORECASE)
    return claims_clean.strip() if claims_clean else claims.strip()


def _to_record(row: bigquery.Row) -> PatentRecord:
    cpc_struct = [_parse_cpc_code(c) for c in (row["cpc_codes"] or [])]
    return PatentRecord(
        pub_id=row["pub_id"],
        application_number=row.get("application_number"),
        priority_date=row.get("priority_date"),
        family_id=row.get("family_id"),
        kind_code=row.get("kind_code"),
        pub_date=row["pub_date"],
        filing_date=row.get("filing_date"),
        title=row["title"] or "",
        abstract=row.get("abstract"),
        claims_text=_clean_claims(row.get("claims_text")),
        assignee_name=row.get("assignee_name"),
        inventor_name=list(row.get("inventor_names") or []),
        cpc=cpc_struct,
    )


def chunked(iterable: Iterable, size: int) -> Iterator[list]:
    buf: list = []
    for item in iterable:
        buf.append(item)
        if len(buf) >= size:
            yield buf
            buf = []
    if buf:
        yield buf


def content_hash(rec: PatentRecord) -> str:
    payload = json.dumps(
        {
            "pub_id": rec.pub_id,
            "kind_code": rec.kind_code or "",
            "title": rec.title or "",
            "abstract": rec.abstract or "",
            "assignee_name": rec.assignee_name or "",
            "cpc": [c.get("code", "") for c in rec.cpc],
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def claims_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def pub_to_docnum(pub_id: str) -> str:
    return "".join(_DIGITS.findall(pub_id))


def is_pregrant(kind_code: str | None) -> bool:
    if not kind_code:
        return True
    return kind_code.upper().startswith("A")


def clamp_text(s: str, max_chars: int = EMB_MAX_CHARS) -> str:
    if len(s) <= max_chars:
        return s
    # Prefer cutting at a whitespace boundary
    cutoff = s.rfind(" ", 0, max_chars)
    return s[: (cutoff if cutoff > 0 else max_chars)]


def split_by_words(s: str, words_per_chunk: int = 900) -> list[str]:
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


# ----------------------
# BigQuery query stage
# ----------------------

def query_bigquery(
    client: bigquery.Client,
    date_from: str,
    date_to: str,
    cpc_regex: str,
) -> Iterator[PatentRecord]:
    print(f"Querying BigQuery from {date_from} to {date_to} with CPC regex {cpc_regex}", file=sys.stderr)
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("date_from", "STRING", date_from),
            bigquery.ScalarQueryParameter("date_to", "STRING", date_to),
            bigquery.ScalarQueryParameter("cpc_regex", "STRING", cpc_regex),
        ]
    )
    job = client.query(BQ_SQL_TEMPLATE, job_config=job_config)
    for row in job.result(page_size=BQ_PAGE_SIZE):
        yield _to_record(row)


# ----------------------
# Postgres upsert stage
# ----------------------

def upsert_batch(pool, records):
    print("Upserting batch of", len(records), "records", file=sys.stderr)
    with pool.connection() as conn:
        for r in records:
            try:
                with conn.cursor() as cur:
                    # Upsert patent record
                    cur.execute(UPSERT_SQL, {
                        "pub_id": r.pub_id,
                        "application_number": r.application_number,
                        "priority_date": r.priority_date,
                        "family_id": r.family_id,
                        "filing_date": r.filing_date,
                        "kind_code": r.kind_code,
                        "pub_date": r.pub_date,
                        "title": r.title,
                        "abstract": r.abstract,
                        "assignee_name": r.assignee_name,
                        "inventor_name": json.dumps(list(r.inventor_name), ensure_ascii=False),
                        "cpc": json.dumps(list(r.cpc), ensure_ascii=False),
                        "claims_text": r.claims_text,
                    })

                    # Log ingestion
                    cur.execute(INGEST_LOG_SQL, {
                        "pub_id": r.pub_id,
                        "stage": "inserted",
                        "content_hash": content_hash(r),
                        "detail": json.dumps({"source": "bigquery"}, ensure_ascii=False),
                    })
                conn.commit()
            except Exception as e:
                print(f"Error upserting record with pub_id {r.pub_id}: {e}", file=sys.stderr)
                conn.rollback()
                continue



def latest_watermark(conn_str: str) -> date | None:
    sql = "SELECT max(pub_date) FROM patent;"
    with psycopg.connect(conn_str) as conn, conn.cursor() as cur:
        cur.execute(sql)
        row = cur.fetchone()
    int_wm = row[0] if row and row[0] is not None else None
    print(f"Latest watermark from Postgres: {int_wm}", file=sys.stderr)
    if int_wm is not None:
        str_wm = str(int_wm)
        dt_wm = datetime.strptime(str_wm, "%Y%m%d").date()
    
        return dt_wm


def latest_publication_date(client: bigquery.Client) -> date | None:
    """
    Fetch the most recent publication_date from the public patents table.
    Returns a date or None if the table is empty.
    """
    sql = "SELECT MAX(publication_date) AS max_pub_date FROM `patents-public-data.patents.publications`"
    job = client.query(sql)
    row = next(job.result(), None)
    max_pub_date = row["max_pub_date"] if row else None
    print(f"Latest publication_date in BigQuery: {max_pub_date}", file=sys.stderr)
    if max_pub_date is None:
        return None
    return datetime.strptime(str(max_pub_date), "%Y%m%d").date()

# --------------------------
# Embeddings stage (OpenAI)
# --------------------------

def get_openai_client() -> OpenAI:
    # OPENAI_API_KEY required; OPENAI_BASE_URL optional for self-hosted proxies
    base = os.getenv("OPENAI_BASE_URL")
    if base:
        return OpenAI(base_url=base)
    return OpenAI()


def select_existing_embeddings(pool: ConnectionPool[PgConn], pub_ids: Sequence[str], models: Sequence[str]) -> set[tuple[str, str]]:
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(SELECT_EXISTING_EMB_SQL, {"pub_ids": list(pub_ids), "models": list(models)})
        rows = cur.fetchall()
    return {(r[0], r[1]) for r in rows}


def build_ta_input(r: PatentRecord) -> str | None:
    parts = [p for p in [r.title or "", r.abstract or ""] if p]
    if not parts:
        return None
    return clamp_text("\n\n".join(parts))


def build_claims_inputs(r: PatentRecord) -> list[str]:
    if not r.claims_text:
        return []
    text = clamp_text(r.claims_text)
    return split_by_words(text, words_per_chunk=900)


@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
def embed_texts(client: OpenAI, texts: Sequence[str], model: str) -> list[list[float]]:
    out: list[list[float]] = []
    for batch in chunked(texts, EMB_BATCH_SIZE):
        resp = client.embeddings.create(model=model, input=list(batch))
        out.extend([d.embedding for d in resp.data])
        time.sleep(5)  
    return out


def upsert_embeddings(pool, rows: Sequence[dict]) -> None:
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
        print(f"Error upserting embeddings: {e}", file=sys.stderr)


def ensure_embeddings_for_batch(
    pool: ConnectionPool[PgConn], client: OpenAI, batch: Sequence[PatentRecord]
) -> tuple[int, int]:
    """Create embeddings for title+abstract and claims. Returns (upserts, total_targets)."""
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
    if ta_inputs:
        vectors = embed_texts(client, [t for _, t in ta_inputs], EMB_MODEL)
        for (pub_id, _), vec in zip(ta_inputs, vectors, strict=True):
            rows.append({"pub_id": pub_id, "model": MODEL_TA, "dim": len(vec), "embedding": vec_to_literal(vec)})

    # Claims embeddings (average of chunk vectors to fit schema)
    claims_pub_chunks: list[tuple[str, list[str]]] = []
    for r in batch:
        if (r.pub_id, MODEL_CLAIMS) in existing:
            continue
        chunks = build_claims_inputs(r)
        if chunks:
            claims_pub_chunks.append((r.pub_id, chunks))
            total_targets += 1
    if claims_pub_chunks:
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
                rows.append({"pub_id": pub_id, "model": MODEL_CLAIMS, "dim": len(avg), "embedding": vec_to_literal(avg)})

    # Write
    upsert_embeddings(pool, rows)
    return (len(rows), total_targets)


# -----------
# CLI / main
# -----------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--date-from", help="YYYY-MM-DD; default=max(pub_date) or last 10 days")
    p.add_argument("--date-to", help="YYYY-MM-DD (exclusive); default=max(pub_date) + 10 days or today")
    p.add_argument("--batch-size", type=int, default=800, help="DB upsert batch size")
    p.add_argument("--claims", action="store_true", help="Fetch and update claims_text")
    p.add_argument("--embed", action="store_true", default=True, help="Generate embeddings for title+abstract and claims")
    p.add_argument("--project", default=os.getenv("BQ_PROJECT", "patent-scout-etl"), help="BigQuery project id")
    p.add_argument("--location", default=os.getenv("BQ_LOCATION", None), help="BigQuery location")
    p.add_argument("--dsn", default=os.getenv("PG_DSN", ""), help="Postgres DSN")
    p.add_argument("--dry-run", action="store_true", help="Do not write to Postgres")
    return p.parse_args()


def main() -> int:
    args = parse_args()

    if not args.project:
        print("BQ_PROJECT not set and --project not provided", file=sys.stderr)
        return 2
    if not args.dsn:
        print("PG_DSN not set and --dsn not provided", file=sys.stderr)
        return 2

    cpc_regex = os.getenv("CPC_REGEX", AI_CPC_REGEX_DEFAULT)
    watermark = latest_watermark(args.dsn)

    bq_client = bigquery.Client(project=args.project, location=args.location) if args.location else bigquery.Client(project=args.project)

    latest_pub_date = latest_publication_date(bq_client)
    if watermark and latest_pub_date and watermark > latest_pub_date:
        print(
            f"Watermark {watermark.isoformat()} is after latest BigQuery publication_date "
            f"{latest_pub_date.isoformat()}. Exiting.",
            file=sys.stderr,
        )
        return 0

    # Resolve watermark
    if args.date_from:
        date_from = args.date_from
    else:
        date_from = watermark.isoformat() if watermark else (date.today() - timedelta(days=10)).isoformat()
    print(f"Starting from watermark date {date_from}", file=sys.stderr)

    if args.date_to:
        date_to = args.date_to
    else:
        if args.date_from:
            date_to = (date.fromisoformat(args.date_from) + timedelta(days=3)).isoformat()
        else:
            date_to = (watermark + timedelta(days=3)).isoformat() if watermark else date.today().isoformat()
    print(f"Loading up to date {date_to}", file=sys.stderr)


    # Clients
    pool = ConnectionPool[PgConn](
        conninfo=args.dsn, 
        max_size=10, 
        kwargs={
            "autocommit": False,
            "sslmode": "require",
            "prepare_threshold": None,
            "channel_binding": "require",
        }
    )

    oa_client = get_openai_client() if args.embed and not args.dry_run else None

    # Stream → upsert → claims → embeddings
    stream = query_bigquery(bq_client, date_from=date_from, date_to=date_to, cpc_regex=cpc_regex)

    total_rows = 0
    total_claims_updates = 0
    total_claims_requested = 0
    total_emb_upserts = 0
    total_emb_targets = 0

    for batch in chunked(stream, args.batch_size):
        if args.dry_run:
            total_rows += len(batch)
            continue

        upsert_batch(pool, batch)
        total_rows += len(batch)

        if args.embed and oa_client is not None:
            print("Generating embeddings for batch", file=sys.stderr)
            upserts, targets = ensure_embeddings_for_batch(pool, oa_client, batch)
            total_emb_upserts += upserts
            total_emb_targets += targets
            print("Upserted embeddings for batch", file=sys.stderr)

    print(
        f"Upserted {total_rows} records from {date_from} to {date_to}"
        + (f"; claims {total_claims_updates}/{total_claims_requested}" if args.claims else "")
        + (f"; embeddings {total_emb_upserts}/{total_emb_targets}" if args.embed else "")
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
