#!/usr/bin/env python3
"""
Backfill missing patent.assignee_name values using the USPTO ODP API.

The script:
1. Finds patent rows where assignee_name IS NULL and application_number is present.
2. Calls https://api.uspto.gov/api/v1/patent/applications/search (POST) per row with
   the application number minus the "US" prefix, using the JSON request template
   stored in docs/uspto_odp_api/uspto-odp-query-on-application-number.json.
3. Updates patent.assignee_name with the first assigneeNameText returned.

Usage:
    python backfill_assignee_names.py --limit 200 --sleep 0.2

Notes:
- Run scripts/add_canon_name.py after this to populate canon names.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import psycopg
import requests
from dotenv import load_dotenv
from psycopg import Connection
from psycopg import errors as psycopg_errors
from psycopg.rows import TupleRow

from infrastructure.logger import setup_logger

API_URL = "https://api.uspto.gov/api/v1/patent/applications/search"
REQUEST_TEMPLATE_PATH = (
    Path(__file__).resolve().parent.parent
    / "docs"
    / "uspto_odp_api"
    / "uspto-odp-query-on-application-number.json"
)

load_dotenv()
logger = setup_logger()

type PgConn = Connection[TupleRow]


@dataclass(frozen=True)
class PatentRow:
    pub_id: str
    application_number: str


@dataclass
class Stats:
    scanned: int = 0
    updated: int = 0
    skipped_missing_application: int = 0
    skipped_no_api_data: int = 0
    api_errors: int = 0
    db_reconnects: int = 0
    db_errors: int = 0


@dataclass
class LookupResult:
    assignee_name: str | None
    status: Literal["ok", "no_data", "error"]
    detail: str | None = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill patent.assignee_name via USPTO ODP API"
    )
    parser.add_argument(
        "--dsn",
        default=os.getenv("DATABASE_URL", ""),
        help="Postgres DSN; defaults to DATABASE_URL env var",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Rows to fetch per DB query (default: 100)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Max patents to process (0 = entire result set)",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.25,
        help="Delay (seconds) between API calls to avoid throttling (default: 0.25)",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=3,
        help="Retries for USPTO API errors/429s (default: 3)",
    )
    parser.add_argument(
        "--db-retries",
        type=int,
        default=3,
        help="Retries for database operations/reconnects (default: 3)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="HTTP timeout in seconds (default: 30)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch names but do not write to the database",
    )
    return parser.parse_args()


def normalize_application_number(raw: str | None) -> str:
    if not raw:
        return ""
    cleaned = raw.strip()
    if cleaned.upper().startswith("US"):
        cleaned = cleaned[2:]
    return cleaned.lstrip(" -")


def load_request_template(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def build_request_body(template: dict[str, Any], application_number: str) -> dict[str, Any]:
    body = copy.deepcopy(template)
    filters = body.setdefault("filters", [])
    target_filter: dict[str, Any] | None = None
    for f in filters:
        if f.get("name") == "applicationNumberText":
            target_filter = f
            break
    if target_filter is None:
        target_filter = {"name": "applicationNumberText", "value": []}
        filters.insert(0, target_filter)
    target_filter["value"] = [application_number]
    return body


def create_session(api_key: str) -> requests.Session:
    sess = requests.Session()
    sess.headers.update(
        {
            "x-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
    )
    return sess


def fetch_assignee_name(
    session: requests.Session,
    template: dict[str, Any],
    application_number: str,
    *,
    timeout: float,
    max_retries: int,
) -> LookupResult:
    request_body = build_request_body(template, application_number)
    error_detail: str | None = None
    for attempt in range(1, max_retries + 1):
        try:
            resp = session.post(API_URL, json=request_body, timeout=timeout)
        except requests.RequestException as exc:
            error_detail = f"HTTP error: {exc}"
            logger.warning("Request error for %s: %s", application_number, exc)
            time.sleep(min(5, attempt))
            continue

        if resp.status_code in {429} or resp.status_code >= 500:
            error_detail = f"HTTP {resp.status_code}: {resp.text[:200]}"
            logger.warning(
                "USPTO API rate/server error for %s (attempt %s/%s): %s",
                application_number,
                attempt,
                max_retries,
                error_detail,
            )
            time.sleep(min(5, attempt))
            continue

        if resp.status_code >= 400:
            detail = f"HTTP {resp.status_code}: {resp.text[:200]}"
            logger.error("USPTO API client error for %s: %s", application_number, detail)
            return LookupResult(None, "error", detail)

        try:
            data = resp.json()
        except ValueError as exc:
            detail = f"Invalid JSON response: {exc}"
            logger.error("USPTO API response parse failed for %s: %s", application_number, detail)
            return LookupResult(None, "error", detail)

        assignee = extract_assignee_name(data)
        if assignee:
            return LookupResult(assignee, "ok", None)
        return LookupResult(None, "no_data", "assigneeNameText not found")

    return LookupResult(None, "error", error_detail)


def extract_assignee_name(payload: dict[str, Any]) -> str | None:
    records = payload.get("patentFileWrapperDataBag")
    if isinstance(records, list):
        for record in records:
            assignee = _extract_from_record(record)
            if assignee:
                return assignee
    return _find_first_field(payload, "assigneeNameText")


def _extract_from_record(record: dict[str, Any]) -> str | None:
    assignment_bag = record.get("assignmentBag")
    if isinstance(assignment_bag, list):
        for assignment in assignment_bag:
            assignee_bag = assignment.get("assigneeBag")
            if isinstance(assignee_bag, list):
                for assignee in assignee_bag:
                    name = assignee.get("assigneeNameText")
                    if isinstance(name, str) and name.strip():
                        return name.strip()
    return None


def _find_first_field(node: Any, field_name: str) -> str | None:
    if isinstance(node, dict):
        if field_name in node and isinstance(node[field_name], str) and node[field_name].strip():
            return node[field_name].strip()
        for value in node.values():
            result = _find_first_field(value, field_name)
            if result:
                return result
    elif isinstance(node, list):
        for item in node:
            result = _find_first_field(item, field_name)
            if result:
                return result
    return None


SELECT_SQL = """
SELECT pub_id, application_number
FROM patent
WHERE assignee_name IS NULL
  AND application_number IS NOT NULL
  AND TRIM(application_number) <> ''
  AND pub_id > %(after_pub_id)s
ORDER BY pub_id
LIMIT %(batch_size)s;
"""


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
    return [
        PatentRow(pub_id=row[0], application_number=row[1])
        for row in rows
        if row[0] and row[1]
    ]


def update_patent_assignee(conn: PgConn, pub_id: str, assignee_name: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE patent SET assignee_name = %s, updated_at = NOW() WHERE pub_id = %s",
            (assignee_name, pub_id),
        )
        return cur.rowcount > 0


def connect_db(dsn: str) -> PgConn:
    return psycopg.connect(dsn)


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


def backfill_missing_assignees(
    dsn: str,
    session: requests.Session,
    request_template: dict[str, Any],
    batch_size: int,
    limit: int,
    sleep_seconds: float,
    timeout: float,
    max_retries: int,
    db_retries: int,
    dry_run: bool,
) -> Stats:
    stats = Stats()
    conn = connect_db(dsn)
    db_retry_limit = max(db_retries, 1)

    def reconnect_db(context: str) -> None:
        nonlocal conn
        safe_close(conn)
        last_error: psycopg.Error | None = None
        for attempt in range(1, db_retry_limit + 1):
            try:
                delay = min(attempt - 1, 5)
                if delay > 0:
                    time.sleep(delay)
                logger.warning(
                    "Reconnecting to database (attempt %s/%s) after %s",
                    attempt,
                    db_retry_limit,
                    context,
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

    after_pub_id = ""

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
                            "Database error while fetching batch after pub_id '%s': %s",
                            after_pub_id or "<start>",
                            exc,
                        )
                        reconnect_db("fetch_batch")
                        continue
                    stats.db_errors += 1
                    logger.error(
                        "Unrecoverable database error while fetching batch: %s",
                        exc,
                        exc_info=exc,
                    )
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

                lookup = fetch_assignee_name(
                    session,
                    request_template,
                    normalized,
                    timeout=timeout,
                    max_retries=max_retries,
                )

                if lookup.status == "error":
                    stats.api_errors += 1
                    logger.error(
                        "Failed to fetch assignee for %s (%s): %s",
                        row.pub_id,
                        normalized,
                        lookup.detail,
                    )
                    continue

                if lookup.assignee_name is None:
                    stats.skipped_no_api_data += 1
                    logger.info(
                        "No assigneeNameText returned for %s (application %s)",
                        row.pub_id,
                        normalized,
                    )
                    continue

                if dry_run:
                    stats.updated += 1
                    logger.info(
                        "[dry-run] Would set assignee_name='%s' for pub_id=%s",
                        lookup.assignee_name,
                        row.pub_id,
                    )
                else:
                    updated = False
                    db_attempt = 0
                    while db_attempt < db_retry_limit:
                        db_attempt += 1
                        try:
                            updated = update_patent_assignee(conn, row.pub_id, lookup.assignee_name)
                            conn.commit()
                            break
                        except psycopg.Error as exc:
                            safe_rollback(conn)
                            if should_attempt_reconnect(exc):
                                logger.warning(
                                    "Database error while updating %s (attempt %s/%s): %s",
                                    row.pub_id,
                                    db_attempt,
                                    db_retry_limit,
                                    exc,
                                )
                                reconnect_db(f"update for {row.pub_id}")
                                continue
                            stats.db_errors += 1
                            logger.error(
                                "Database update failed for %s: %s",
                                row.pub_id,
                                exc,
                                exc_info=exc,
                            )
                            break

                    if not updated:
                        logger.warning(
                            "Patent %s could not be updated after %s attempts; skipping",
                            row.pub_id,
                            db_attempt,
                        )
                        continue

                    stats.updated += 1
                    logger.info(
                        "Updated %s with assignee '%s'",
                        row.pub_id,
                        lookup.assignee_name,
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
        logger.error("DATABASE_URL not provided via --dsn or environment")
        sys.exit(1)

    if args.db_retries < 1:
        logger.error("--db-retries must be >= 1")
        sys.exit(1)

    if not api_key:
        logger.error("USPTO_ODP_API_KEY not set in environment")
        sys.exit(1)

    if not REQUEST_TEMPLATE_PATH.exists():
        logger.error("Request template not found at %s", REQUEST_TEMPLATE_PATH)
        sys.exit(1)

    request_template = load_request_template(REQUEST_TEMPLATE_PATH)
    session = create_session(api_key)

    try:
        stats = backfill_missing_assignees(
            dsn=database_url,
            session=session,
            request_template=request_template,
            batch_size=args.batch_size,
            limit=args.limit,
            sleep_seconds=args.sleep,
            timeout=args.timeout,
            max_retries=args.max_retries,
            db_retries=args.db_retries,
            dry_run=args.dry_run,
        )
    except psycopg.Error as exc:
        logger.error("Database connection failed: %s", exc, exc_info=exc)
        sys.exit(1)
    except RuntimeError as exc:
        logger.error("%s", exc)
        sys.exit(1)

    logger.info(
        "Completed backfill: scanned=%s updated=%s skipped_missing_app=%s "
        "skipped_no_api_data=%s api_errors=%s db_reconnects=%s db_errors=%s",
        stats.scanned,
        stats.updated,
        stats.skipped_missing_application,
        stats.skipped_no_api_data,
        stats.api_errors,
        stats.db_reconnects,
        stats.db_errors,
    )


if __name__ == "__main__":
    main()
