#!/usr/bin/env python3
"""
etl_uspto.py

USPTO Open Data Portal (PEDS) → Postgres loader for SynapseIP staging.

Differences from the BigQuery loader:
- Reads patent metadata via the USPTO Patent Examination Data System API.
- Filters locally using CPC regex and AI keyword heuristics.
- Upserts into patent_staging (same schema as patent) and logs ingestion source.
- No claims fetching or embedding generation logic.

After running this script:
1. Add XML files from USPTO bulk data to resources/current_ipa/
2. Run scripts/etl_xml_fulltext.py to populate abstract and claims_text in patent_staging.
3. Delete records from patent_staging that do not include "language model", "artificial intelligence", "neural network", or "machine learning" in title or abstract.
4. Merge patent_staging into patent table. 
5. Run scripts/etl_add_embeddings.py to generate embeddings for new records.
6. Run scripts/add_canon_name.py to populate canon names.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from collections.abc import Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

import psycopg
import requests
from dotenv import load_dotenv
from psycopg import Connection
from psycopg.rows import TupleRow
from psycopg_pool import ConnectionPool
from tenacity import (
    retry,
    retry_if_not_exception_type,
    stop_after_attempt,
    wait_random_exponential,
)

from infrastructure.logger import setup_logger

logger = setup_logger()

# -----------------------
# Configuration defaults
# -----------------------
load_dotenv()

AI_CPC_REGEX_DEFAULT = r"^(G06N|G06V|G06F17|G06F18|G06F40|G06F16/90|G06K9|G06T7|G10L|A61B|B60W|G05D)"
AI_KEYWORDS_DEFAULT = (
    "artificial intelligence",
    "machine learning",
    "neural network",
    "artificial-intelligence",
    "machine-learning",
    "neural-network",
)
# CPC codes for AI domain 
AI_CPC_CODES = [
    "G06N*",
    "G06V*",
    "G06F16/90*",
    "G06F17*",
    "G06F18*",
    "G06F40*",
    "G06K9*",
    "G06T7*",
    "A16B*",
    "G10L*",
    "G05D*",
    "B60W*"
    ]

USPTO_BASE_URL = os.getenv(
    "USPTO_ODP_BASE_URL",
    "https://api.uspto.gov/api/v1/patent/applications/search",
)
USPTO_TIMEOUT = int(os.getenv("USPTO_ODP_TIMEOUT", "45"))
USPTO_PAGE_SIZE = int(os.getenv("USPTO_ODP_PAGE_SIZE", "100"))
USPTO_SORT_FIELD = "applicationMetaData.earliestPublicationDate"
USPTO_SORT_ORDER = "Desc"

# psycopg generics
type PgConn = Connection[TupleRow]

# -------------
# SQL templates
# -------------

UPSERT_SQL = """
INSERT INTO patent_staging (
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
ON CONFLICT (application_number) DO UPDATE SET
    pub_id            = COALESCE(EXCLUDED.pub_id,            patent_staging.pub_id),
    priority_date     = COALESCE(EXCLUDED.priority_date,     patent_staging.priority_date),
    family_id         = COALESCE(EXCLUDED.family_id,         patent_staging.family_id),
    kind_code         = COALESCE(EXCLUDED.kind_code,         patent_staging.kind_code),
    pub_date          = COALESCE(EXCLUDED.pub_date,          patent_staging.pub_date),
    filing_date       = COALESCE(EXCLUDED.filing_date,       patent_staging.filing_date),
    title             = COALESCE(NULLIF(EXCLUDED.title, ''), patent_staging.title),
    abstract          = COALESCE(EXCLUDED.abstract,          patent_staging.abstract),
    claims_text       = COALESCE(EXCLUDED.claims_text,       patent_staging.claims_text),
    assignee_name     = COALESCE(EXCLUDED.assignee_name,     patent_staging.assignee_name),
    inventor_name     = COALESCE(EXCLUDED.inventor_name,     patent_staging.inventor_name),
    cpc               = COALESCE(EXCLUDED.cpc,               patent_staging.cpc)
WHERE (EXCLUDED.pub_date > patent_staging.pub_date OR patent_staging.pub_date IS NULL)
  AND EXCLUDED.kind_code NOT IN ('B1', 'B2')
"""

INGEST_LOG_SQL = """
INSERT INTO ingest_log (pub_id, stage, content_hash, detail, created_at)
VALUES (%(pub_id)s, %(stage)s, %(content_hash)s, %(detail)s, NOW())
ON CONFLICT (pub_id, stage) DO UPDATE SET
  content_hash = EXCLUDED.content_hash,
  detail = EXCLUDED.detail,
  created_at = NOW();
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


def _date_to_int(s: str | None) -> int | None:
    if not s:
        return None
    t = s.strip()
    if not t:
        return None
    digits = t.replace("-", "")
    if len(digits) < 8 or not digits[:8].isdigit():
        return None
    return int(digits[:8])


def _parse_cpc_code(code: str) -> Mapping[str, str | None]:
    """
    Parse a CPC code like 'G06N3/08' into components.
    Returns dict with keys: code, section, class, subclass, group, subgroup.
    Missing parts become None.
    """
    s = code.replace(" ", "").upper()
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
    return hash_payload(payload)


def hash_payload(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def pub_to_docnum(pub_id: str) -> str:
    return "".join(_DIGITS.findall(pub_id))

def _first(seq: Sequence[str] | None) -> str | None:
    if not seq:
        return None
    return seq[0]


def _extract_assignee(meta: Mapping[str, Any], applicants: Sequence[Mapping[str, Any]] | None) -> str | None:
    if isinstance(meta.get("firstApplicantName"), str):
        candidate = meta["firstApplicantName"].strip()
        if candidate:
            return candidate
    if applicants:
        for app in applicants:
            name = app.get("applicantNameText")
            if isinstance(name, str) and name.strip():
                return name.strip()
    return None


def _extract_inventors(inventors: Sequence[Mapping[str, Any]] | None) -> list[str]:
    if not inventors:
        logger.info("No inventors data provided to _extract_inventors")
        return []
    out: list[str] = []
    for inv in inventors:
        if not isinstance(inv, Mapping):
            logger.info("Skipping non-mapping inventor entry: %s", inv)
            continue
        name_text = inv.get("inventorNameText")
        if isinstance(name_text, str) and name_text.strip():
            out.append(name_text.strip())
            logger.info("Extracted inventor name from inventorNameText: %s", name_text.strip())
            continue
        first = inv.get("firstName") or ""
        middle = inv.get("middleName") or ""
        last = inv.get("lastName") or ""
        parts = [str(p).strip() for p in (first, middle, last) if isinstance(p, str) and p.strip()]
        if parts:
            full_name = " ".join(parts)
            out.append(full_name)
            logger.info("Extracted inventor name from parts: %s", full_name)
        else:
            logger.info("Could not extract name from inventor entry: %s", inv)
    logger.info("Extracted %d inventor names total", len(out))
    return out


def _extract_priority_date(priorities: Sequence[Mapping[str, Any]] | None) -> int | None:
    if not priorities:
        return None
    dates = [
        _date_to_int(p.get("filingDate"))
        for p in priorities
        if isinstance(p, Mapping)
    ]
    dates = [d for d in dates if d is not None]
    if not dates:
        return None
    return min(dates)


def _extract_pub_id(meta: Mapping[str, Any], item: Mapping[str, Any]) -> str | None:
    candidates: Sequence[Any] = (
        meta.get("patentNumber"),
        item.get("patentNumber"),
        meta.get("earliestPublicationNumber"),
        meta.get("publicationNumber"),
    )
    for cand in candidates:
        if isinstance(cand, str) and cand.strip():
            cand_str = cand.strip()
            cand_country = cand_str[:2].upper()
            if cand_country == "US":
                cand_number = cand_str[2:-2]
                cand_kind = cand_str[-2:].upper()
                return f"{cand_country}-{cand_number}-{cand_kind}"
            else:
                return f"US-{cand_str}"
    return None


def _extract_pub_date(meta: Mapping[str, Any], item: Mapping[str, Any]) -> int | None:
    candidates: Sequence[Any] = (
        meta.get("grantDate"),
        item.get("grantDate"),
        meta.get("earliestPublicationDate"),
        meta.get("publicationDate"),
        meta.get("publicationDateText"),
        item.get("publicationDate"),
        meta.get("applicationStatusDate"),
        meta.get("filingDate"),
    )
    for candidate in candidates:
        as_int = _date_to_int(candidate) if isinstance(candidate, str) else None
        if as_int:
            return as_int
    return None


def record_from_uspto(item: Mapping[str, Any]) -> PatentRecord | None:
    meta = item.get("applicationMetaData") or {}
    # Inventors and applicants are inside applicationMetaData, not at the top level
    applicants = meta.get("applicantBag")
    inventors = meta.get("inventorBag")
    priorities = item.get("foreignPriorityBag")

    # Log inventor data for debugging
    if inventors:
        logger.info("Found inventors data: %s", json.dumps(inventors)[:200])

    pub_id = _extract_pub_id(meta, item)
    if not pub_id:
        logger.error("Skipping USPTO record without publication identifier: %s", item)
        return None

    pub_date = _extract_pub_date(meta, item)
    if pub_date is None:
        logger.info("USPTO record %s missing publication date-like fields", pub_id)
        return None

    cpc_raw = meta.get("cpcClassificationBag") or []
    if isinstance(cpc_raw, Mapping):
        cpc_raw = [str(v) for v in cpc_raw.values()]
    elif isinstance(cpc_raw, str):
        cpc_raw = [cpc_raw]
    cpc_codes = []
    if isinstance(cpc_raw, Sequence):
        for entry in cpc_raw:
            if isinstance(entry, str) and entry.strip():
                cpc_codes.append(_parse_cpc_code(entry.strip()))

    kind_code = pub_id[-2:].upper()
    if not kind_code.startswith("A"):
        kind_code = None

    filing_date = _date_to_int(meta.get("filingDate") if isinstance(meta.get("filingDate"), str) else None)
    applicant_seq = (
        applicants
        if isinstance(applicants, Sequence) and not isinstance(applicants, (str, bytes))
        else None
    )
    inventor_seq = (
        inventors
        if isinstance(inventors, Sequence) and not isinstance(inventors, (str, bytes))
        else None
    )
    priority_seq = (
        priorities
        if isinstance(priorities, Sequence) and not isinstance(priorities, (str, bytes))
        else None
    )
    priority_date = _extract_priority_date(priority_seq)

    inventor_names = _extract_inventors(inventor_seq)
    record = PatentRecord(
        pub_id=pub_id,
        application_number=f"US{item.get('applicationNumberText')}" if isinstance(item.get("applicationNumberText"), str) else None,
        priority_date=priority_date,
        family_id=None,
        kind_code=kind_code,
        pub_date=pub_date,
        filing_date=filing_date,
        title=meta.get("inventionTitle"),
        abstract=None,
        claims_text=None,
        assignee_name=_extract_assignee(meta, applicant_seq),
        inventor_name=inventor_names,
        cpc=cpc_codes,
    )
    logger.info("Constructed PatentRecord for %s with %d inventors", pub_id, len(inventor_names))

    return record


# ----------------------
# USPTO API interaction
# ----------------------

class USPTOApiError(RuntimeError):
    pass


class USPTONotFoundError(USPTOApiError):
    """Raised when the USPTO API returns a 404 Not Found error."""
    pass


def build_filters(cpc_codes: list[str] | None) -> list[dict[str, Any]]:
    # PEDS searchText uses Lucene syntax; we keep the date_to exclusive by subtracting one day.

    filters = []
    cpc_param = {
        "name": "applicationMetaData.cpcClassificationBag",
        "value": cpc_codes or AI_CPC_CODES,
    }
    filters.append(cpc_param)

    application_type = {
        "name": "applicationMetaData.applicationTypeLabelName",
        "value": ["Utility"],
    }
    filters.append(application_type)

    publication_category = {
        "name": "applicationMetaData.publicationCategoryBag",
        "value": [
            "Pre-Grant Publications - PGPub", 
            "Granted/Issued"
            ]
    }
    filters.append(publication_category)

    return filters

def build_range_filter(date_from: str, date_to: str) -> list[dict[str, str]]:

    start = date.fromisoformat(date_from)
    end_exclusive = date.fromisoformat(date_to)
    if end_exclusive <= start:
        end_inclusive = end_exclusive
    else:
        end_inclusive = end_exclusive - timedelta(days=1)

    range_filter = [{
        "field": "applicationMetaData.earliestPublicationDate",
        "valueFrom": start.isoformat(),
        "valueTo": end_inclusive.isoformat()
    }]

    return range_filter

def build_pagination(offset: int = 0, page_size: int = 100) -> dict[str, int]:
    return {
        "offset": offset,
        "limit": page_size,
    }

def build_sorting(field: str = USPTO_SORT_FIELD, order: str = USPTO_SORT_ORDER) -> list[dict[str, str]]:
    return [
        {
            "field": field,
            "order": order,
        }
    ]


@retry(
    wait=wait_random_exponential(min=1, max=60),
    stop=stop_after_attempt(6),
    retry=retry_if_not_exception_type(USPTONotFoundError),
)
def fetch_page(
    session: requests.Session,
    base_url: str,
    params: dict[str, Any],
) -> Mapping[str, Any]:
    logger.info("Requesting USPTO page with params=%s", params)

    headers = {
        "x-api-key": os.getenv("USPTO_ODP_API_KEY", ""),
    }

    resp = session.post(
        url=base_url,
        headers=headers,
        json=params
    )

    # Handle 404 Not Found errors gracefully - these should not be retried
    if resp.status_code == 404:
        logger.error(
            "USPTO API returned 404 Not Found for the requested parameters. "
            "This may indicate the date range or filters returned no results. "
            "Request params: %s",
            json.dumps(params, default=str)[:500]
        )
        raise USPTONotFoundError(f"USPTO API returned 404 for request: {resp.text[:200]}")

    # Handle transient errors that should be retried
    if resp.status_code in {400, 429, 500, 502, 503, 504}:
        logger.error("USPTO API transient error %s: %s", resp.status_code, resp.text[:200])
        resp.raise_for_status()

    # Handle other non-OK responses
    if not resp.ok:
        logger.error("USPTO API error %s: %s", resp.status_code, resp.text[:200])
        raise USPTOApiError(f"USPTO API error {resp.status_code}: {resp.text[:200]}")

    logger.info("USPTO API response: %s", resp.text[:200])
    return resp.json()


def query_uspto(
    session: requests.Session,
    *,
    base_url: str,
    date_from: str,
    date_to: str,
    cpc_pattern: re.Pattern[str] | None,
    keyword_patterns: Sequence[re.Pattern[str]],
    page_size: int = 100,
) -> Iterator[PatentRecord]:
    offset = 0
    total: int | None = None
    seen_ids: set[str] = set()
    duplicate_pages = 0
    while True:
        params = {
            "q": None,
            "filters": build_filters(AI_CPC_CODES),
            "rangeFilters": build_range_filter(date_from, date_to),
            "pagination": build_pagination(offset=offset, page_size=page_size),
            "sort": build_sorting(),
        }
        
        logger.info("Fetching USPTO records with offset=%s, page_size=%s", offset, page_size)

        try:
            payload = fetch_page(session, base_url, params)
        except USPTONotFoundError as e:
            logger.error(
                "USPTO API returned 404 for offset=%s. This may indicate no more records available "
                "or the requested resource does not exist. Stopping pagination. Error: %s",
                offset,
                str(e)
            )
            break

        logger.info("Fetched USPTO payload: %s", json.dumps(payload)[:200])
        total = total or payload.get("count")
        items = payload.get("patentFileWrapperDataBag") or []
        if not isinstance(items, Sequence) or not items:
            logger.info("No additional records returned from USPTO (offset=%s); stopping.", offset)
            break

        new_records: list[Mapping[str, Any]] = []
        page_ids: set[str] = set()
        for raw in items:
            if not isinstance(raw, Mapping):
                logger.error("Unexpected USPTO item payload: %s", raw)
                continue
            candidate_id = raw.get("applicationNumberText")
            if isinstance(candidate_id, str) and candidate_id.strip():
                ident = candidate_id.strip()
                page_ids.add(ident)
                if ident in seen_ids:
                    continue
                seen_ids.add(ident)
            new_records.append(raw)

        if not new_records:
            duplicate_pages += 1
            logger.error(
                "USPTO API returned duplicate-only page (offset=%s, size=%s); skip_count=%s",
                offset,
                len(items),
                duplicate_pages,
            )
            if duplicate_pages >= 3:
                logger.error("Encountered %s consecutive duplicate pages; stopping pagination.", duplicate_pages)
                break
            offset += len(items)
            continue

        duplicate_pages = 0
        logger.info(
            "Fetched %s new USPTO items (page had %s total, seen=%s)",
            len(new_records),
            len(items),
            len(seen_ids),
        )

        for raw in new_records:
            record = record_from_uspto(raw)
            if record is None:
                logger.info("USPTO record did not yield ingestible PatentRecord: %s", raw)
                continue
            logger.info("Yielding USPTO record: %s", record.pub_id)
            yield record

        offset += len(items)
        if total is not None and offset >= int(total):
            logger.info("Reached end of USPTO records (offset=%s, total=%s); stopping.", offset, total)
            break


# ----------------------
# Postgres upsert stage
# ----------------------

def upsert_batch(pool: ConnectionPool[PgConn], records: Sequence[PatentRecord]) -> None:
    logger.info("Upserting batch of %s records", len(records))
    with pool.connection() as conn:
        for r in records:
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        UPSERT_SQL,
                        {
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
                        },
                    )
                    cur.execute(
                        INGEST_LOG_SQL,
                        {
                            "pub_id": r.pub_id,
                            "stage": "inserted",
                            "content_hash": content_hash(r),
                            "detail": json.dumps({"source": "uspto_odp"}, ensure_ascii=False),
                        },
                    )
                conn.commit()
            except Exception as exc:  # noqa: BLE001
                logger.error("Error upserting record %s: %s", r.pub_id, exc, exc_info=True)
                conn.rollback()


def latest_watermark(conn_str: str, table: str) -> date | None:
    sql = "SELECT max(pub_date) FROM patent_staging"
    with psycopg.connect(conn_str) as conn, conn.cursor() as cur:
        cur.execute(sql)
        row = cur.fetchone()
    int_wm = row[0] if row and row[0] is not None else None
    logger.info("Latest watermark from %s: %s", table, int_wm)
    if int_wm is not None:
        str_wm = str(int_wm)
        return datetime.strptime(str_wm, "%Y%m%d").date()
    return None


# -----------
# CLI / main
# -----------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Load USPTO ODP data into patent_staging.")
    p.add_argument("--date-from", help="YYYY-MM-DD; default=max(pub_date) or last 10 days")
    p.add_argument("--date-to", help="YYYY-MM-DD (exclusive); default=max(pub_date)+3 days or today")
    p.add_argument("--batch-size", type=int, default=200, help="DB upsert batch size")
    p.add_argument("--page-size", type=int, default=USPTO_PAGE_SIZE, help="USPTO API page size")
    p.add_argument("--dsn", default=os.getenv("PG_DSN", ""), help="Postgres DSN")
    p.add_argument("--api-key", default=os.getenv("USPTO_ODP_API_KEY", ""), help="USPTO ODP API key")
    p.add_argument("--base-url", default=USPTO_BASE_URL, help="USPTO ODP endpoint")
    p.add_argument("--cpc-regex", default=os.getenv("CPC_REGEX", AI_CPC_REGEX_DEFAULT), help="Regex to filter CPC codes")
    p.add_argument(
        "--keywords",
        default=",".join(AI_KEYWORDS_DEFAULT),
        help="Comma-separated keywords for title/abstract filtering; empty to disable",
    )
    p.add_argument("--watermark-table", default=os.getenv("WATERMARK_TABLE", "patent_staging"), help="Table for watermark lookup")
    p.add_argument("--dry-run", action="store_true", help="Do not write to Postgres")
    return p.parse_args()


def compile_keyword_patterns(raw: str) -> list[re.Pattern[str]]:
    raw = raw.strip()
    if not raw:
        return []
    parts = [frag.strip() for frag in raw.split(",") if frag.strip()]
    return [re.compile(re.escape(term.lower())) for term in parts]


def ensure_api_key(session: requests.Session, api_key: str | None) -> None:
    if api_key:
        session.headers["X-Api-Key"] = api_key


def main() -> int:
    args = parse_args()

    if not args.dsn:
        logger.error("Postgres DSN not provided; set via --dsn or PG_DSN env var.")
        return 2

    if not args.api_key:
        logger.error("USPTO API key not provided; requests may be rate limited.")
        return 2

    cpc_regex = args.cpc_regex or ""
    cpc_pattern = re.compile(cpc_regex) if cpc_regex else None
    logger.info("Using CPC regex: %s", cpc_regex or "<none>")

    keyword_patterns = compile_keyword_patterns(args.keywords)
    logger.info("Using %s keyword patterns for filtering", len(keyword_patterns))

    # Resolve watermark
    if args.date_from:
        date_from = args.date_from
    else:
        wm = latest_watermark(args.dsn, args.watermark_table)
        date_from = wm.isoformat() if wm else (date.today() - timedelta(days=10)).isoformat()
    logger.info("Starting from watermark date %s", date_from)

    if args.date_to:
        date_to = args.date_to
    else:
        if args.date_from:
            date_to = (date.fromisoformat(args.date_from) + timedelta(days=3)).isoformat()
        else:
            wm = latest_watermark(args.dsn, args.watermark_table)
            date_to = (wm + timedelta(days=7)).isoformat() if wm else date.today().isoformat()
    logger.info("Loading up to date %s", date_to)

    session = requests.Session()
    logger.info("Initialized HTTP session for USPTO API")
    session.headers.update({"Accept": "application/json"})
    ensure_api_key(session, args.api_key)

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
    logger.info("Initialized connection pool for Postgres")

    stream = query_uspto(
        session,
        base_url=args.base_url,
        date_from=date_from,
        date_to=date_to,
        cpc_pattern=cpc_pattern,
        keyword_patterns=keyword_patterns,
        page_size=args.page_size,
    )

    total_rows = 0

    for batch in chunked(stream, args.batch_size):
        if args.dry_run:
            total_rows += len(batch)
            logger.info("Dry run: %s records processed", len(batch))
            continue
        upsert_batch(pool, batch)
        total_rows += len(batch)

    logger.info("Upserted %s records from %s to %s", total_rows, date_from, date_to)
    print(f"Upserted {total_rows} records from {date_from} to {date_to}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
