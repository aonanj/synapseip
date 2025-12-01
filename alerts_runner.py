#!/usr/bin/env python3
"""
alerts_runner.py
- Executes saved alerts against Neon.tech Postgres
- Sends emails via Mailgun HTTP API
- Filters by keywords, assignee, CPC codes, and date window
- Only reports NEW results since the last run per saved_query

Install:
    pip install psycopg[binary] httpx python-dotenv openai

Env:
    DATABASE_URL="postgresql://USER:PASS@HOST/DB?sslmode=require"

    MAILGUN_DOMAIN="mg.your-domain.com"
    MAILGUN_API_KEY="key-xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    MAILGUN_FROM="Alerts <alerts@mg.your-domain.com>"

    EMBEDDING_MODEL="text-embedding-3-small"
    OPENAI_API_KEY="sk-..."

    # Optional semantic alert config:
    # ALERT_SEMANTIC_MODEL_TAG="text-embedding-3-small|claims"
    # ALERT_SEMANTIC_DIST_CAP="0.35"
"""
"""
SQL setup (for reference)

CREATE TABLE IF NOT EXISTS alert_event (
    id              bigserial PRIMARY KEY,
    saved_query_id  bigint NOT NULL REFERENCES saved_query(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    results_sample  jsonb NOT NULL,
    count           integer NOT NULL CHECK (count >= 0)
);
"""
import html
import json
import os
from collections.abc import Mapping, Sequence
from typing import Any

import httpx
import psycopg
from psycopg import sql as _sql
from openai import OpenAI
from psycopg.rows import dict_row
from dotenv import load_dotenv

load_dotenv()

from infrastructure.logger import get_logger

logger = get_logger(__name__)
_OPENAI_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
_OPENAI_CLIENT = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

# Optional semantic alert configuration:
# - ALERT_SEMANTIC_MODEL_TAG: which patent_embeddings.model to use
#   (e.g., "text-embedding-3-small|claims").
# - ALERT_SEMANTIC_DIST_CAP: if set, enable filtered semantic mode and
#   discard results with distance above this cap.
_SEMANTIC_MODEL_TAG = os.environ.get("ALERT_SEMANTIC_MODEL_TAG")

_SEMANTIC_DIST_CAP_ENV = os.environ.get("ALERT_SEMANTIC_DIST_CAP")
try:
    _SEMANTIC_DIST_CAP: float | None = (
        float(_SEMANTIC_DIST_CAP_ENV) if _SEMANTIC_DIST_CAP_ENV else None
    )
except (TypeError, ValueError):
    logger.warning("Invalid ALERT_SEMANTIC_DIST_CAP=%r; ignoring", _SEMANTIC_DIST_CAP_ENV)
    _SEMANTIC_DIST_CAP = None


def _from_header() -> str:

    load_dotenv()

    MAILGUN_FROM = os.getenv("MAILGUN_FROM", "SynapseIP Alerts <noreply@mg.phaethonorder.com>")

    return MAILGUN_FROM


VEC_DIM = 1536
_VEC_CAST = "::halfvec" if os.environ.get("VECTOR_TYPE", "vector").lower().startswith("half") else "::vector"
TSVECTOR_EXPR = (
    "setweight(to_tsvector('english', coalesce(p.title,'')),'A') || "
    "setweight(to_tsvector('english', coalesce(p.abstract,'')),'B') || "
    "setweight(to_tsvector('english', coalesce(p.claims_text,'')),'C')"
)


def _get_db_conn() -> psycopg.Connection:
    url = os.environ["DATABASE_URL"]
    logger.info("Connecting to Postgres")
    return psycopg.connect(url, autocommit=True)


def _add_hyphens_to_date(date_str: str) -> str:
    """Convert YYYYMMDD -> YYYY-MM-DD; leave others unchanged."""
    if len(date_str) == 8 and date_str.isdigit():
        return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
    return date_str


def _as_str(value: Any) -> str:
    """Safe string representation for filters/values."""
    if value is None:
        return ""
    if isinstance(value, (list, tuple, set)):
        return ", ".join(map(str, value))
    return str(value)


def _normalize_filters(raw: Any) -> dict[str, Any]:
    """
    Normalize the `filters` JSON from saved_query into a dict with keys:
        - keywords (str | None)
        - assignee (str | None)
        - cpc_list (list[str] | None)
        - date_from (str | None)
        - date_to (str | None)
    """
    if not raw:
        return {
            "keywords": None,
            "assignee": None,
            "cpc_list": None,
            "date_from": None,
            "date_to": None,
        }

    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning(f"Invalid filters JSON on saved_query: {raw!r}")
            raw = {}

    if not isinstance(raw, Mapping):
        logger.warning(f"Unexpected filters type on saved_query: {type(raw)!r}")
        raw = {}

    cpc_val = raw.get("cpc") or raw.get("cpc_list")
    cpc_list: list[str] | None = None
    if cpc_val:
        if isinstance(cpc_val, str):
            cpc_list = [c.strip() for c in cpc_val.split(",") if c.strip()]
        elif isinstance(cpc_val, (list, tuple, set)):
            cpc_list = [str(c).strip() for c in cpc_val if str(c).strip()]

    return {
        "keywords": (raw.get("keywords") or raw.get("keyword") or None) or None,
        "assignee": raw.get("assignee") or None,
        "cpc_list": cpc_list or None,
        "date_from": raw.get("date_from") or None,
        "date_to": raw.get("date_to") or None,
    }


def _format_filters_for_email(
    filters: dict[str, Any],
    semantic_query: str | None,
    raw_filters: Any,
) -> tuple[str, str]:
    """
    Format filters into text + HTML snippets for the alert email.
    Includes semantic_query if present.
    """
    entries: list[tuple[str, str]] = []

    if semantic_query:
        entries.append(("Semantic query", semantic_query))

    for key in ("keywords", "assignee", "cpc_list", "date_from", "date_to"):
        val = filters.get(key)
        if val:
            if isinstance(val, (list, tuple, set)):
                val_str = ", ".join(map(str, val))
            else:
                val_str = _as_str(val)
            if val_str.strip():
                label = key.replace("_", " ").title()
                entries.append((label, val_str))

    # Show any unknown filters too, to aid debugging.
    if isinstance(raw_filters, Mapping):
        for key, val in raw_filters.items():
            if key in {"keywords", "keyword", "assignee", "cpc", "cpc_list", "date_from", "date_to"}:
                continue
            if val is None:
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
    """Render a Python list[float] as a Postgres vector literal."""
    return "[" + ",".join(map(str, vec)) + "]"


def _embed_semantic_query(text: str | None) -> list[float] | None:
    if not text:
        logger.info("No semantic_query provided; skipping embedding")
        return None
    try:
        logger.info(f"Generating embedding for semantic_query: {text}")
        res = _OPENAI_CLIENT.embeddings.create(model=_OPENAI_MODEL, input=text)
        return list(res.data[0].embedding)
    except Exception as e:  # pragma: no cover - network/API errors
        logger.error(f"Embedding failed for semantic_query: {e}")
        return None


def _build_where_clauses(params: list[Any], filters: dict[str, Any]) -> list[str]:
    """Build WHERE fragments with sequential placeholders."""
    clauses: list[str] = []

    if filters.get("keywords"):
        params.append(filters["keywords"])
        clauses.append(f"{TSVECTOR_EXPR} @@ plainto_tsquery('english', %s)")
    if filters.get("assignee"):
        params.append(filters["assignee"])
        clauses.append("p.assignee_name = %s")
    if filters.get("cpc_list"):
        params.append(json.dumps(filters["cpc_list"]))
        clauses.append(
            "EXISTS (SELECT 1 FROM jsonb_array_elements_text(%s::jsonb) AS q(code) WHERE p.cpc ? q.code)"
        )
    if filters.get("date_from"):
        params.append(filters["date_from"])
        clauses.append(
            "to_date(p.pub_date::text, 'YYYYMMDD') >= to_date(%s, 'YYYY-MM-DD')"
        )
    if filters.get("date_to"):
        params.append(filters["date_to"])
        clauses.append(
            "to_date(p.pub_date::text, 'YYYYMMDD') <= to_date(%s, 'YYYY-MM-DD')"
        )

    return clauses


def _build_search_sql(
    filters: dict[str, Any],
    saved_query_id: Any,
    *,
    query_vec: Sequence[float] | None,
) -> tuple[str, list[Any]]:
    """Construct SQL and params for alert search, optionally semantic."""
    params: list[Any] = [saved_query_id]
    last_run_cte = """
WITH last_run AS (
  SELECT COALESCE(MAX(ae.created_at), TIMESTAMPTZ '1970-01-01') AS ts
  FROM alert_event ae
  WHERE ae.saved_query_id = %s
)
"""

    base_select = "SELECT p.pub_id, p.title, p.pub_date"
    from_clause = "FROM patent p CROSS JOIN last_run lr"
    order_by = "to_date(p.pub_date::text, 'YYYYMMDD') DESC"

    # If we have an embedding vector, add semantic distance and LEFT JOIN embeddings
    if query_vec is not None:
        params.append(_vector_literal(query_vec))
        base_select += f", (e.embedding <=> %s{_VEC_CAST}) AS dist"
        # Short-term fix: LEFT JOIN so patents without embeddings still show up
        from_clause = (
            "FROM patent p "
            "LEFT JOIN patent_embeddings e ON p.pub_id = e.pub_id "
            "CROSS JOIN last_run lr"
        )
        # Simple, valid ordering: semantic distance first, then newest pub_date
        order_by = "dist ASC, to_date(p.pub_date::text, 'YYYYMMDD') DESC"

    where_clauses = _build_where_clauses(params, filters)
    # Only new results since last run
    where_clauses.append(
        "to_date(p.pub_date::text, 'YYYYMMDD') > (lr.ts AT TIME ZONE 'UTC')::date"
    )
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



def send_mailgun_email(
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str | None = None,
) -> None:
    """Send an email via Mailgun HTTP API, or print if not configured."""

    MAILGUN_API_KEY = os.getenv("MAILGUN_API_KEY", "")
    # If Mailgun is not configured, no-op with console output.
    if not MAILGUN_API_KEY:
        print("Mailgun not fully configured; printing email instead")
        print("To:", to_email)
        print("Subject:", subject)
        print(text_body)
        return

    url = "https://api.mailgun.net/v3/mg.phaethonorder.com/messages"
    data = {
        "from": "SynapseIP Alerts <noreply@mg.phaethonorder.com>",
        "to": [to_email],
        "subject": subject,
        "text": text_body,
    }
    if html_body:
        data["html"] = html_body

    with httpx.Client(timeout=10) as client:
        resp = client.post(url, auth=("api", MAILGUN_API_KEY), data=data)
        if resp.status_code >= 400:
            logger.error(
                f"Mailgun error status={resp.status_code} body={resp.text!r}"
            )
        else:
            logger.info(f"Mailgun sent email to {to_email} subject={subject!r}")


def run_one(conn: psycopg.Connection, sq: Mapping[str, Any]) -> int:
    raw_filters = sq.get("filters")
    filters = _normalize_filters(raw_filters)
    semantic_query = (sq.get("semantic_query") or "").strip() or None

    query_vec = _embed_semantic_query(semantic_query)
    logger.info(
        f"Running alert for saved_query id={sq['id']} "
        f"name={sq.get('name')!r} "
        f"with filters={filters!r} semantic_query={semantic_query!r}"
    )
    sql, params = _build_search_sql(filters, sq["id"], query_vec=query_vec)
    logger.info(f"SQL: {sql}")
    logger.info(f"Params: {params}")

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(_sql.SQL(sql), params)  # type: ignore
        rows = cur.fetchall()
        logger.info(f"Fetched {len(rows)} rows")

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

    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO alert_event(saved_query_id, results_sample, count) "
            "VALUES (%s,%s,%s)",
            [sq["id"], json.dumps(sample), count],
        )

    name = sq["name"] or "Saved Query"
    filters_text, filters_html = _format_filters_for_email(filters, semantic_query, raw_filters)
    lines = [f"・ {_add_hyphens_to_date(str(r['pub_date']))}  {r['pub_id']}  {str(r['title']).title()}" for r in sample]
    text_body = (
        f"SynapseIP Alert: {name}\n"
        f"Total new results: {count}\n"
        f"{filters_text}\n"
        + "\n".join(lines)
        + "\n\n(Showing up to 50. See app for full list.)"
    )

    html_body = (
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
        f"  <h3>SynapseIP Alert: {html.escape(name)}</h3>"
        f"  <p>Total new results: <b>{count}</b></p>"
        f"  {filters_html}"
        "   <table><tr><th>Grant/Pub Date</th><th>Patent/Pub #</th><th>Title</th></tr>"
        + "".join(f"<tr><td>{html.escape(_add_hyphens_to_date(str(r['pub_date'])))}</td><td><b>{html.escape(r['pub_id'])}</b></td><td>{html.escape(str(r['title']).title())}</td></tr>" for r in sample)
        + "</table><p>Showing up to 50. Visit <a href=\"https://www.synapse-ip.com\">Synapse-IP.com</a> for full list.</p>"
        "   </body></html>"
    )

    to_email = sq.get("email") or sq.get("user_email")
    if not to_email:
        logger.warning(f"Saved query {sq['id']} has no email; skipping send")
        return count

    subject = f"SynapseIP alert: {name} ({count} new results)"
    send_mailgun_email(to_email, subject, text_body, html_body)
    return count


def fetch_saved_queries(conn: psycopg.Connection) -> list[dict[str, Any]]:
    sql = """
SELECT
  sq.id,
  sq.name,
  sq.filters,
  sq.semantic_query,
  u.email AS user_email
FROM saved_query sq
JOIN app_user u ON u.id = sq.owner_id
WHERE sq.is_active = TRUE
"""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql)
        rows = cur.fetchall()
    logger.info(f"Loaded {len(rows)} enabled saved queries")
    return rows  # type: ignore[return-value]


def main() -> None:
    conn = _get_db_conn()
    try:
        saved = fetch_saved_queries(conn)
        if not saved:
            print("No enabled saved queries; exiting.")
            return
        logger.info(f"Fetched: {saved!r}")
        total = 0
        for sq in saved:
            try:
                total += run_one(conn, sq)
            except Exception as e:
                print(f"[error] saved_query id={sq['id']}: {e}")
        print(f"[done] total new results across alerts: {total}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
