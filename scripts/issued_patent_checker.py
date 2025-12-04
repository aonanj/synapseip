#!/usr/bin/env python3
"""
issued_patent_checker.py

Fetch granted/issued patents from the USPTO ODP API for applications already
stored in the patent table (kind_code starting with "A") and stage the matches
in issued_patent_staging. For each application:

1. Strip the leading "US" from application_number and call the USPTO API with
   filters:
       - applicationNumberText == <number>
       - applicationMetaData.publicationCategoryBag == "Granted/Issued"
2. If a record is returned, upsert pub_id (patentNumber), title, assignee_name,
   inventor_name, application_number, kind_code, and pub_date (grantDate as
   YYYYMMDD integer) into issued_patent_staging.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from typing import Any, Literal, Sequence

import psycopg
import requests
from dotenv import load_dotenv
from psycopg import Connection
from psycopg import errors as psycopg_errors
from psycopg.rows import TupleRow

from infrastructure.logger import setup_logger

load_dotenv()

API_URL = os.getenv(
    "USPTO_ODP_BASE_URL",
    "https://api.uspto.gov/api/v1/patent/applications/search",
)
GRANTED_FILTER_VALUE = "Granted/Issued"

logger = setup_logger(__name__)

type PgConn = Connection[TupleRow]


@dataclass(frozen=True)
class PatentRow:
    pub_id: str
    application_number: str
    kind_code: str | None


@dataclass
class IssuedPatent:
    patent_number: str
    title: str
    grant_date: int
    assignee_name: str | None
    inventor_names: list[str]


@dataclass
class LookupResult:
    status: Literal["ok", "no_data", "error"]
    issued: IssuedPatent | None
    detail: str | None = None


@dataclass
class Stats:
    scanned: int = 0
    matches: int = 0
    skipped_missing_application: int = 0
    skipped_no_result: int = 0
    api_errors: int = 0
    db_upserts: int = 0
    db_errors: int = 0
    db_reconnects: int = 0


SELECT_SQL = """
SELECT pub_id, application_number, kind_code
FROM patent
WHERE kind_code ILIKE 'A%%'
  AND application_number IS NOT NULL
  AND TRIM(application_number) <> ''
  AND pub_id > %(after_pub_id)s
ORDER BY pub_id
LIMIT %(batch_size)s;
"""


UPSERT_ISSUED_SQL = """
INSERT INTO issued_patent_staging (
    pub_id,
    title,
    assignee_name,
    inventor_name,
    pub_date,
    application_number,
    kind_code
) VALUES (
    %(pub_id)s,
    %(title)s,
    %(assignee_name)s,
    %(inventor_name)s::jsonb,
    %(pub_date)s,
    %(application_number)s,
    %(kind_code)s
)
ON CONFLICT (pub_id) DO UPDATE SET
    title             = COALESCE(NULLIF(EXCLUDED.title, ''), issued_patent_staging.title),
    assignee_name     = COALESCE(EXCLUDED.assignee_name, issued_patent_staging.assignee_name),
    inventor_name     = COALESCE(EXCLUDED.inventor_name, issued_patent_staging.inventor_name),
    pub_date          = EXCLUDED.pub_date,
    application_number = COALESCE(EXCLUDED.application_number, issued_patent_staging.application_number),
    kind_code         = COALESCE(EXCLUDED.kind_code, issued_patent_staging.kind_code),
    updated_at        = NOW();
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check granted status for A-kind patents and stage matches."
    )
    parser.add_argument(
        "--dsn",
        default=os.getenv("DATABASE_URL", ""),
        help="Postgres DSN (defaults to DATABASE_URL).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=200,
        help="Number of patents to fetch per DB round trip (default: 200).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Maximum patents to scan (0 = process all).",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.2,
        help="Delay between API calls to avoid throttling (default: 0.2s).",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="HTTP timeout for USPTO requests (default: 30s).",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=3,
        help="Retries for USPTO API errors and 429/5xx responses (default: 3).",
    )
    parser.add_argument(
        "--db-retries",
        type=int,
        default=3,
        help="Retries for transient database errors (default: 3).",
    )
    parser.add_argument(
        "--after-pub-id",
        default=None,
        help=(
            "Start scanning after this pub_id (use last pub_id from prior run to resume). "
            "If omitted, processing starts from the beginning."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch data but do not write to issued_patent_staging.",
    )
    return parser.parse_args()


def normalize_application_number(raw: str | None) -> str:
    if not raw:
        return ""
    cleaned = raw.strip()
    if cleaned.upper().startswith("US"):
        cleaned = cleaned[2:]
    return cleaned.lstrip(" -")


def build_request_body(application_number: str) -> dict[str, Any]:
    return {
        "q": None,
        "filters": [
            {
                "name": "applicationNumberText",
                "value": [application_number],
            },
            {
                "name": "applicationMetaData.publicationCategoryBag",
                "value": [GRANTED_FILTER_VALUE],
            },
        ],
        "pagination": {
            "offset": 0,
            "limit": 50,
        },
    }


def create_session(api_key: str) -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "x-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "SynapseIP-Issued-Checker/1.0",
        }
    )
    return session


def lookup_issued_patent(
    session: requests.Session,
    application_number: str,
    *,
    timeout: float,
    max_retries: int,
) -> LookupResult:
    body = build_request_body(application_number)
    error_detail: str | None = None
    for attempt in range(1, max_retries + 1):
        try:
            resp = session.post(API_URL, json=body, timeout=timeout)
        except requests.RequestException as exc:
            error_detail = f"HTTP error: {exc}"
            logger.warning(
                "USPTO request error for %s (attempt %s/%s): %s",
                application_number,
                attempt,
                max_retries,
                exc,
            )
            time.sleep(min(5, attempt))
            continue

        if resp.status_code in {429} or resp.status_code >= 500:
            error_detail = f"HTTP {resp.status_code}: {resp.text[:200]}"
            logger.warning(
                "USPTO throttled/server error for %s (attempt %s/%s): %s",
                application_number,
                attempt,
                max_retries,
                error_detail,
            )
            time.sleep(min(5, attempt))
            continue

        if resp.status_code >= 400:
            detail = f"HTTP {resp.status_code}: {resp.text[:200]}"
            logger.error(
                "USPTO API client error for %s: %s",
                application_number,
                detail,
            )
            return LookupResult("error", None, detail)

        try:
            payload = resp.json()
        except ValueError as exc:
            detail = f"Invalid JSON response: {exc}"
            logger.error("USPTO API returned invalid JSON for %s: %s", application_number, detail)
            return LookupResult("error", None, detail)

        issued = extract_issued_patent(payload)
        if issued:
            return LookupResult("ok", issued, None)
        return LookupResult("no_data", None, "No granted patent record found")

    return LookupResult("error", None, error_detail)


def extract_issued_patent(payload: dict[str, Any]) -> IssuedPatent | None:
    records = payload.get("patentFileWrapperDataBag")
    if isinstance(records, list):
        for record in records:
            issued = _record_to_issued(record)
            if issued:
                return issued
    elif isinstance(records, dict):
        return _record_to_issued(records)
    return None


def _record_to_issued(record: dict[str, Any]) -> IssuedPatent | None:
    metadata = record.get("applicationMetaData")
    if not isinstance(metadata, dict):
        return None

    patent_number = _safe_str(metadata.get("patentNumber"))
    grant_date = _date_to_int(metadata.get("grantDate"))
    title = _safe_str(metadata.get("inventionTitle"))

    if not patent_number or grant_date is None:
        return None

    inventors = extract_inventor_names(metadata)
    assignee_name = extract_assignee_name(record)

    return IssuedPatent(
        patent_number=patent_number,
        title=title or "",
        grant_date=grant_date,
        assignee_name=assignee_name,
        inventor_names=inventors,
    )


def extract_assignee_name(record: dict[str, Any]) -> str | None:
    assignment_bag = record.get("assignmentBag")
    if isinstance(assignment_bag, list):
        for assignment in assignment_bag:
            assignee_bag = assignment.get("assigneeBag")
            if isinstance(assignee_bag, list):
                for assignee in assignee_bag:
                    name = _safe_str(assignee.get("assigneeNameText"))
                    if name:
                        return name
    if isinstance(assignment_bag, dict):
        name = _safe_str(assignment_bag.get("assigneeNameText"))
        if name:
            return name
    return _find_first_string(record, "assigneeNameText")


def extract_inventor_names(metadata: dict[str, Any]) -> list[str]:
    names: list[str] = []
    inventor_bag = metadata.get("inventorBag")
    names.extend(_collect_field_values(inventor_bag, "inventorNameText"))

    extra = metadata.get("inventorNameText")
    if isinstance(extra, list):
        names.extend(_clean_name_list(extra))
    elif isinstance(extra, str):
        stripped = extra.strip()
        if stripped:
            names.append(stripped)

    if not names:
        names.extend(_collect_field_values(metadata, "inventorNameText"))

    # Deduplicate while preserving order
    seen = set()
    unique: list[str] = []
    for n in names:
        if n not in seen:
            seen.add(n)
            unique.append(n)
    return unique


def _collect_field_values(node: Any, target_key: str) -> list[str]:
    results: list[str] = []
    if isinstance(node, dict):
        for key, value in node.items():
            if key == target_key and isinstance(value, str):
                cleaned = value.strip()
                if cleaned:
                    results.append(cleaned)
            else:
                results.extend(_collect_field_values(value, target_key))
    elif isinstance(node, list):
        for item in node:
            results.extend(_collect_field_values(item, target_key))
    return results


def _find_first_string(node: Any, key: str) -> str | None:
    if isinstance(node, dict):
        if key in node and isinstance(node[key], str):
            candidate = node[key].strip()
            if candidate:
                return candidate
        for value in node.values():
            result = _find_first_string(value, key)
            if result:
                return result
    elif isinstance(node, list):
        for item in node:
            result = _find_first_string(item, key)
            if result:
                return result
    return None


def _clean_name_list(values: Sequence[Any]) -> list[str]:
    names: list[str] = []
    for value in values:
        if isinstance(value, str):
            cleaned = value.strip()
            if cleaned:
                names.append(cleaned)
    return names


def _safe_str(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    return ""


def _date_to_int(value: Any) -> int | None:
    if not isinstance(value, str):
        return None
    digits = value.replace("-", "").strip()
    if len(digits) < 8 or not digits[:8].isdigit():
        return None
    return int(digits[:8])


def fetch_batch(conn: PgConn, after_pub_id: str, batch_size: int) -> list[PatentRow]:
    with conn.cursor() as cur:
        cur.execute(
            SELECT_SQL,
            {
                "after_pub_id": after_pub_id,
                "batch_size": batch_size,
            },
        )
        rows = cur.fetchall()
    result: list[PatentRow] = []
    for row in rows:
        pub_id, application_number, kind_code = row
        if pub_id and application_number:
            result.append(
                PatentRow(
                    pub_id=pub_id,
                    application_number=application_number,
                    kind_code=kind_code,
                )
            )
    return result


def upsert_issued_patent(
    conn: PgConn,
    patent_row: PatentRow,
    issued: IssuedPatent,
) -> None:
    inventor_json = json.dumps(issued.inventor_names or [])
    with conn.cursor() as cur:
        cur.execute(
            UPSERT_ISSUED_SQL,
            {
                "pub_id": issued.patent_number,
                "title": issued.title,
                "assignee_name": issued.assignee_name,
                "inventor_name": inventor_json,
                "pub_date": issued.grant_date,
                "application_number": patent_row.application_number,
                "kind_code": patent_row.kind_code,
            },
        )


def safe_close(conn: PgConn | None) -> None:
    if conn is None:
        return
    try:
        conn.close()
    except psycopg.Error:
        pass


def safe_rollback(conn: PgConn | None) -> None:
    if conn is None:
        return
    try:
        conn.rollback()
    except psycopg.Error:
        pass


def should_attempt_reconnect(exc: psycopg.Error) -> bool:
    reconnectable = (
        psycopg.OperationalError,
        psycopg_errors.AdminShutdown,
        psycopg_errors.CannotConnectNow,
        psycopg_errors.ConnectionDoesNotExist,
        psycopg_errors.ConnectionException,
        psycopg_errors.IdleInTransactionSessionTimeout,
    )
    return isinstance(exc, reconnectable)


def connect_db(dsn: str) -> PgConn:
    return psycopg.connect(dsn)


def process_patents(
    dsn: str,
    session: requests.Session,
    *,
    batch_size: int,
    limit: int,
    sleep_seconds: float,
    timeout: float,
    max_retries: int,
    db_retries: int,
    dry_run: bool,
    after_pub_id: str,
) -> Stats:
    stats = Stats()
    conn = connect_db(dsn)
    db_retry_limit = max(db_retries, 1)
    after_pub_id = after_pub_id or ""

    def reconnect(context: str) -> None:
        nonlocal conn
        safe_close(conn)
        last_error: psycopg.Error | None = None
        for attempt in range(1, db_retry_limit + 1):
            try:
                delay = min(attempt - 1, 5)
                if delay:
                    time.sleep(delay)
                logger.warning(
                    "Reconnecting to database after %s (attempt %s/%s)",
                    context,
                    attempt,
                    db_retry_limit,
                )
                conn = connect_db(dsn)
                stats.db_reconnects += 1
                return
            except psycopg.Error as exc:
                last_error = exc
                logger.error(
                    "Database reconnect attempt %s failed after %s: %s",
                    attempt,
                    context,
                    exc,
                )
        raise RuntimeError(
            f"Unable to reconnect to database after {context}: {last_error}"
        ) from last_error

    try:
        while True:
            batch: list[PatentRow] = []
            fetch_attempts = 0
            while True:
                fetch_attempts += 1
                try:
                    batch = fetch_batch(conn, after_pub_id, batch_size)
                    break
                except psycopg.Error as exc:
                    if should_attempt_reconnect(exc) and fetch_attempts <= db_retry_limit:
                        logger.warning(
                            "Database error while fetching batch after '%s': %s",
                            after_pub_id or "<start>",
                            exc,
                        )
                        reconnect("fetch_batch")
                        continue
                    stats.db_errors += 1
                    logger.error("Unrecoverable DB error while fetching batch: %s", exc)
                    raise

            if not batch:
                break

            for row in batch:
                if limit and stats.scanned >= limit:
                    return stats

                stats.scanned += 1
                normalized = normalize_application_number(row.application_number)
                if not normalized:
                    stats.skipped_missing_application += 1
                    continue

                lookup = lookup_issued_patent(
                    session,
                    normalized,
                    timeout=timeout,
                    max_retries=max_retries,
                )

                if lookup.status == "error":
                    stats.api_errors += 1
                    logger.error(
                        "USPTO lookup failed for %s (%s): %s",
                        row.pub_id,
                        normalized,
                        lookup.detail,
                    )
                    continue

                if lookup.status == "no_data" or not lookup.issued:
                    stats.skipped_no_result += 1
                    logger.info(
                        "No granted patent found for %s (application %s)",
                        row.pub_id,
                        normalized,
                    )
                    continue

                stats.matches += 1

                if dry_run:
                    logger.info(
                        "[dry-run] Would upsert %s (pub_id=%s, title=%s, grant_date=%s)",
                        row.pub_id,
                        lookup.issued.patent_number,
                        lookup.issued.title,
                        lookup.issued.grant_date,
                    )
                else:
                    db_attempt = 0
                    success = False
                    while db_attempt < db_retry_limit:
                        db_attempt += 1
                        try:
                            upsert_issued_patent(conn, row, lookup.issued)
                            conn.commit()
                            success = True
                            break
                        except psycopg.Error as exc:
                            safe_rollback(conn)
                            if should_attempt_reconnect(exc):
                                logger.warning(
                                    "DB error while upserting %s (attempt %s/%s): %s",
                                    lookup.issued.patent_number,
                                    db_attempt,
                                    db_retry_limit,
                                    exc,
                                )
                                reconnect(f"upsert {lookup.issued.patent_number}")
                                continue
                            stats.db_errors += 1
                            logger.error(
                                "Unrecoverable DB error for %s: %s",
                                lookup.issued.patent_number,
                                exc,
                            )
                            break

                    if not success:
                        continue

                    stats.db_upserts += 1
                    logger.info(
                        "Staged issued patent %s -> application %s (%s)",
                        lookup.issued.patent_number,
                        row.application_number,
                        row.pub_id,
                    )

                if sleep_seconds > 0:
                    time.sleep(sleep_seconds)

            after_pub_id = batch[-1].pub_id

    finally:
        safe_close(conn)

    return stats


def main() -> None:
    args = parse_args()
    database_url = args.dsn or os.getenv("DATABASE_URL")
    api_key = os.getenv("USPTO_ODP_API_KEY")

    if not database_url:
        logger.error("DATABASE_URL not provided (set env or --dsn).")
        sys.exit(1)

    if args.db_retries < 1:
        logger.error("--db-retries must be >= 1")
        sys.exit(1)

    if not api_key:
        logger.error("USPTO_ODP_API_KEY not set in environment.")
        sys.exit(1)

    session = create_session(api_key)

    try:
        stats = process_patents(
            database_url,
            session,
            batch_size=args.batch_size,
            limit=args.limit,
            sleep_seconds=args.sleep,
            timeout=args.timeout,
            max_retries=args.max_retries,
            db_retries=args.db_retries,
            dry_run=args.dry_run,
            after_pub_id=args.after_pub_id or "",
        )
    except psycopg.Error as exc:
        logger.error("Database execution failed: %s", exc)
        sys.exit(1)
    except RuntimeError as exc:
        logger.error("%s", exc)
        sys.exit(1)

    logger.info(
        "Completed issued patent scan: scanned=%s matches=%s staged=%s "
        "skipped_missing_app=%s skipped_no_result=%s api_errors=%s "
        "db_reconnects=%s db_errors=%s",
        stats.scanned,
        stats.matches,
        stats.db_upserts,
        stats.skipped_missing_application,
        stats.skipped_no_result,
        stats.api_errors,
        stats.db_reconnects,
        stats.db_errors,
    )


if __name__ == "__main__":
    main()
