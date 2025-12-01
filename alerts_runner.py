#!/usr/bin/env python3
"""
alerts_runner.py
- Executes saved alerts against Neon.tech Postgres
- Sends emails via Mailgun HTTP API
- Filters by keywords, assignee, CPC codes, and date window
- Only reports NEW results since the last run per saved_query

Install:
    pip install asyncpg httpx python-dotenv

Env:
    DATABASE_URL="postgresql://USER:PASS@HOST/DB?sslmode=require"

    MAILGUN_DOMAIN="mg.your-domain.com"
    MAILGUN_API_KEY="key-xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    MAILGUN_FROM_NAME="SynapseIP Alerts"
    MAILGUN_FROM_EMAIL="alerts@your-domain.com"
    # Optional:
    MAILGUN_BASE_URL="https://api.mailgun.net/v3"  # default

DB schema (current):
    -- app users
    CREATE TABLE app_user (
        id           text PRIMARY KEY,
        email        citext UNIQUE NOT NULL,
        display_name text,
        created_at   timestamptz NOT NULL DEFAULT now()
    );

    -- saved queries (filters is JSONB)
    CREATE TABLE saved_query (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id       text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        name           text NOT NULL,
        filters        jsonb NOT NULL, -- {keywords?, assignee?, cpc?[], date_from?, date_to?}
        semantic_query text,
        schedule_cron  text,
        is_active      boolean NOT NULL DEFAULT true,
        created_at     timestamptz NOT NULL DEFAULT now(),
        updated_at     timestamptz NOT NULL DEFAULT now()
    );

    -- alert events (per run summary)
    CREATE TABLE alert_event (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        saved_query_id uuid NOT NULL REFERENCES saved_query(id) ON DELETE CASCADE,
        created_at     timestamptz NOT NULL DEFAULT now(),
        results_sample jsonb NOT NULL,
        count          integer NOT NULL CHECK (count >= 0)
    );
"""
import asyncio
import html
import json
import os
from collections.abc import Mapping, Sequence
from typing import Any

import asyncpg
import httpx
from dotenv import load_dotenv

load_dotenv()

from app.embed import embed as embed_text
from infrastructure.logger import get_logger

logger = get_logger(__name__)

def _from_header() -> str:

    load_dotenv()

    MAILGUN_DOMAIN = os.getenv("MAILGUN_DOMAIN", "mg.phaethonorder.com")
    MAILGUN_FROM_NAME = os.getenv("MAILGUN_FROM_NAME", "SynapseIP Alerts")
    MAILGUN_FROM_EMAIL = os.getenv(
        "MAILGUN_FROM_EMAIL",
        f"alerts@{MAILGUN_DOMAIN}" if MAILGUN_DOMAIN else "synapseip-alerts@phaethonorder.com"
    )
    return f"{MAILGUN_FROM_NAME} <{MAILGUN_FROM_EMAIL}>"

def _add_hyphens_to_date(date_str: str) -> str:
    """Convert YYYYMMDD to YYYY-MM-DD."""
    if len(date_str) == 8 and date_str.isdigit():
        return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
    return date_str

_VEC_CAST = "::halfvec" if os.environ.get("VECTOR_TYPE", "vector").lower().startswith("half") else "::vector"
TSVECTOR_EXPR = "to_tsvector('english', coalesce(p.title,'') || ' ' || coalesce(p.abstract,''))"
     


async def send_mailgun_email(
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str | None = None,
) -> None:
    
    load_dotenv()

    MAILGUN_DOMAIN = os.getenv("MAILGUN_DOMAIN", "mg.phaethonorder.com")
    MAILGUN_API_KEY = os.getenv("MAILGUN_API_KEY", "")
    MAILGUN_BASE_URL = os.getenv("MAILGUN_BASE_URL", "https://api.mailgun.net/v3")
    # If Mailgun is not configured, no-op with console output.
    if not MAILGUN_DOMAIN:
        print("Mailgun Domain: ", MAILGUN_DOMAIN)
    if not MAILGUN_API_KEY:
        print("MAILGUN API KEY: ", MAILGUN_API_KEY)
        print("To:", to_email)
        print("Subject:", subject)
        print(text_body)

    url = "https://api.mailgun.net/v3/mg.phaethonorder.com/messages"
    data = {
        "from": "SynapseIP Alerts <noreply@mg.phaethonorder.com>",
        "to": [to_email],
        "subject": subject,
        "text": text_body,
    }
    if html_body:
        data["html"] = html_body

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(url, auth=("api", MAILGUN_API_KEY), data=data)
        if resp.status_code >= 300:
            print(f"[error] Mailgun send failed: {resp.status_code} {resp.text}")


def _normalize_filters(filters: dict[str, Any] | None) -> dict[str, Any]:
    """Normalize saved_query.filters JSON into consistent strings/lists."""
    if isinstance(filters, Mapping) and not isinstance(filters, dict):
        filters = dict(filters)
    def _clean_str(val: Any) -> str | None:
        if val is None:
            return None
        s = str(val).strip()
        return s or None

    def _normalize_cpc(raw: Any) -> list[str] | None:
        if not raw:
            return None
        if isinstance(raw, str):
            parts = [p.strip() for p in raw.replace(";", ",").split(",") if p.strip()]
        elif isinstance(raw, (list, tuple, set)):
            parts = [str(item).strip() for item in raw if str(item).strip()]
        else:
            parts = []
        return parts or None

    def _normalize_date(raw: Any) -> str | None:
        if raw is None:
            return None
        s = str(raw).strip()
        if not s:
            return None
        if len(s) == 10 and s[4] == "-" and s[7] == "-":
            s = s.replace("-", "")
        return s

    if not isinstance(filters, dict):
        logger.error(f"Invalid filters format: {filters!r}")
        return {
            "keywords": None,
            "assignee": None,
            "cpc_list": None,
            "date_from": None,
            "date_to": None,
        }
    
    logger.info(f"Normalizing filters: {filters!r}")
    logger.info(f" - keywords: {_clean_str(filters.get('keywords'))!r}")
    logger.info(f" - assignee: {_clean_str(filters.get('assignee'))!r}")
    logger.info(f" - cpc: {_normalize_cpc(filters.get('cpc'))!r}")
    logger.info(f" - date_from: {_normalize_date(filters.get('date_from'))!r}")
    logger.info(f" - date_to: {_normalize_date(filters.get('date_to'))!r}")

    return {
        "keywords": _clean_str(filters.get("keywords")),
        "assignee": _clean_str(filters.get("assignee")),
        "cpc_list": _normalize_cpc(filters.get("cpc")),
        "date_from": _normalize_date(filters.get("date_from")),
        "date_to": _normalize_date(filters.get("date_to")),
    }


def _format_filters_for_email(
    filters: dict[str, Any],
    semantic_query: str | None,
    raw_filters: dict[str, Any] | None = None,
) -> tuple[str, str]:
    """Return (text_block, html_block) describing applied filters.

    Falls back to showing any raw filter keys we don't explicitly normalize.
    """
    entries: list[tuple[str, str]] = []
    used_keys: set[str] = set()

    def _as_str(val: Any) -> str:
        if val is None:
            return ""
        if isinstance(val, (str, int, float)):
            return str(val)
        try:
            return json.dumps(val)
        except Exception:
            logger.error(f"Failed to json.dumps filter val: {val!r}")
            return str(val)

    if filters.get("keywords"):
        entries.append(("Keywords", str(filters["keywords"])))
        used_keys.add("keywords")
    if semantic_query:
        entries.append(("Semantic query", semantic_query))
    if filters.get("assignee"):
        entries.append(("Assignee", str(filters["assignee"])))
        used_keys.add("assignee")
    if filters.get("cpc_list"):
        entries.append(("CPC", ", ".join(filters["cpc_list"])))
        used_keys.update({"cpc", "cpc_list"})
    if filters.get("date_from") or filters.get("date_to"):
        start = _add_hyphens_to_date(str(filters.get("date_from") or ""))
        end = _add_hyphens_to_date(str(filters.get("date_to") or ""))
        entries.append(("Date range", f"{start or 'Any'} to {end or 'Any'}"))
        used_keys.update({"date_from", "date_to"})

    # Show any additional raw filter keys that were provided
    if isinstance(raw_filters, Mapping):
        for key, val in raw_filters.items():
            if key in used_keys:
                continue
            val_str = _as_str(val).strip()
            if not val_str:
                continue
            label = key.replace("_", " ").title()
            entries.append((label, val_str))

    if not entries:
        return "Filters: none\n", "<p><b>Filters:</b> none</p>"

    text = "Filters:\n" + "\n".join(f"- {label}: {value}" for label, value in entries) + "\n"
    html_list = "".join(
        f"<li><b>{html.escape(label)}:</b> {html.escape(value)}</li>" for label, value in entries
    )
    html_block = f"<div style=\"text-align:left; max-width:760px; margin:0 auto;\"><p><b>Filters applied</b></p><ul>{html_list}</ul></div>"
    return text, html_block


def _vector_literal(vec: Sequence[float]) -> str:
    """Format embedding for pgvector as a string literal."""
    return "[" + ",".join(map(str, vec)) + "]"


def _build_where_clauses(params: list[Any], filters: dict[str, Any]) -> list[str]:
    """Build WHERE fragments with sequential placeholders."""
    clauses: list[str] = []

    if filters.get("keywords"):
        params.append(filters["keywords"])
        clauses.append(f"{TSVECTOR_EXPR} @@ plainto_tsquery('english', ${len(params)})")
    if filters.get("assignee"):
        params.append(filters["assignee"])
        clauses.append(f"p.assignee_name = ${len(params)}")
    if filters.get("cpc_list"):
        params.append(json.dumps(filters["cpc_list"]))
        idx = len(params)
        clauses.append(
            f"EXISTS (SELECT 1 FROM jsonb_array_elements_text(${idx}::jsonb) AS q(code) WHERE p.cpc ? q.code)"
        )
    if filters.get("date_from"):
        params.append(filters["date_from"])
        clauses.append(
            f"to_date(p.pub_date::text, 'YYYYMMDD') >= to_date(${len(params)}::text, 'YYYYMMDD')"
        )
    if filters.get("date_to"):
        params.append(filters["date_to"])
        clauses.append(
            f"to_date(p.pub_date::text, 'YYYYMMDD') <= to_date(${len(params)}::text, 'YYYYMMDD')"
        )

    return clauses


def _build_search_sql(
    filters: dict[str, Any],
    saved_query_id: Any,
    *,
    query_vec: Sequence[float] | None,
) -> tuple[str, list[Any]]:
    """Construct SQL and params for alert search, optionally semantic."""
    params: list[Any] = []
    params.append(saved_query_id)
    last_run_cte = f"""
WITH last_run AS (
  SELECT COALESCE(MAX(ae.created_at), TIMESTAMPTZ '1970-01-01') AS ts
  FROM alert_event ae
  WHERE ae.saved_query_id = ${len(params)}
)
"""

    where_clauses = _build_where_clauses(params, filters)
    base_select = "SELECT p.pub_id, p.title, p.pub_date"
    from_clause = "FROM patent p CROSS JOIN last_run lr"
    order_by = "to_date(p.pub_date::text, 'YYYYMMDD') DESC"

    if query_vec is not None:
        params.append(_vector_literal(query_vec))
        base_select += f", (e.embedding <=> ${len(params)}{_VEC_CAST}) AS dist"
        from_clause = "FROM patent p JOIN patent_embeddings e ON p.pub_id = e.pub_id CROSS JOIN last_run lr"
        where_clauses.insert(0, "e.model LIKE '%|ta'")
        order_by = "dist ASC, to_date(p.pub_date::text, 'YYYYMMDD') DESC"

    where_clauses.append("to_date(p.pub_date::text, 'YYYYMMDD') > (lr.ts AT TIME ZONE 'UTC')::date")
    where_sql = " AND ".join(where_clauses) if where_clauses else "TRUE"

    sql = f"""
{last_run_cte}
{base_select}
{from_clause}
WHERE {where_sql}
ORDER BY {order_by}
LIMIT 500;
"""
    return sql, params


async def run_one(conn: asyncpg.Connection, sq: asyncpg.Record) -> int:
    raw_filters = sq.get("filters")
    filters = _normalize_filters(raw_filters)
    semantic_query = (sq.get("semantic_query") or "").strip() or None

    query_vec: list[float] | None = None
    if semantic_query:
        try:
            maybe = await embed_text(semantic_query)
            query_vec = list(maybe) if maybe else None
        except Exception as e:  # pragma: no cover - downstream network/API errors
            print(f"[error] embedding semantic_query for saved_query id={sq['id']}: {e}")

    sql, params = _build_search_sql(filters, sq["id"], query_vec=query_vec)

    rows = await conn.fetch(sql, *params)
    count = len(rows)
    if count == 0:
        return 0

    sample = [
        {
            "pub_id": r["pub_id"],
            "title": r["title"],
            "pub_date": str(r["pub_date"]),
        }
        for r in rows[:50]
    ]

    await conn.execute(
        "INSERT INTO alert_event(saved_query_id, results_sample, count) VALUES ($1,$2,$3)",
        sq["id"], json.dumps(sample), count
    )

    name = sq["name"] or "Saved Query"
    filters_text, filters_html = _format_filters_for_email(filters, semantic_query, raw_filters)
    lines = [f"・ {_add_hyphens_to_date(str(r['pub_date']))}  {r['pub_id']}  {r['title']}" for r in sample]
    text = (
        f"SynapseIP Alert: {name}\n"
        f"Total new results: {count}\n"
        f"{filters_text}\n"
        + "\n".join(lines)
        + "\n\n(Showing up to 50. See app for full list.)"
    )
    html = (
        "<html><head>"
        "        <style>"
        "           body {"
        "                text-align: center;"
        "           }"
        "           table,"
        "           th,"
        "           td {"
        "               text-align: center;"
        "               padding: 2px;"
        "               border: 1px solid black;"
        "               border-collapse: collapse;"
        "           }"
        "        </style>"       
        "   </head>"
        "   <body>"
        f"  <h3>SynapseIP Alert: {name}</h3>"
        f"  <p>Total new results: <b>{count}</b></p>"
        f"  {filters_html}"
        "   <table><tr><th>Grant/Pub Date</th><th>Patent/Pub #</th><th>Title</th></tr>"
        + "".join(f"<tr><td>{_add_hyphens_to_date(str(r['pub_date']))}</td><td><b>{r['pub_id']}</b></td><td>{str(r['title']).title()}</td></tr>" for r in sample)
        + "</table><p>Showing up to 50. Visit <a href=\"https://www.synapse-ip.com\">Synapse-IP.com</a> for full list.</p>"
        "   </body></html>"
    )
    to_email = sq.get("owner_email") or sq.get("email")
    if not to_email:
        print(f"[warn] No owner email for saved_query id={sq['id']}; skipping email send")
    else:
        await send_mailgun_email(to_email, f"SynapseIP Alert: {name}", text, html)
    return count


async def main():
    load_dotenv()
    DB_URL = os.getenv("DATABASE_URL")

    conn = await asyncpg.connect(DB_URL)
    try:
        # Fetch active queries and join to owner email
        saved = await conn.fetch(
            """
            SELECT sq.*, au.email AS owner_email
            FROM saved_query sq
            JOIN app_user au ON au.id = sq.owner_id
            WHERE sq.is_active = TRUE
            ORDER BY sq.created_at
            """
        )
        total = 0
        for sq in saved:
            try:
                total += await run_one(conn, sq)
            except Exception as e:
                print(f"[error] saved_query id={sq['id']}: {e}")
        print(f"[done] total new results across alerts: {total}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
