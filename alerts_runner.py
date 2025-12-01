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
import json
import os
from typing import Any

import asyncpg
import httpx
from dotenv import load_dotenv



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


def _where_clause() -> str:
    # CPC filter expects saved_query.cpc = JSON array of codes, e.g. ["G06F/16","G06N/20"]
    # We treat it as "match any" of the provided codes using the `?` jsonb key-existence operator.
    return """
      WHERE ($1::text IS NULL OR
             to_tsvector('english', coalesce(p.title,'') || ' ' || coalesce(p.abstract,'')) @@ plainto_tsquery('english', $1))
        AND ($2::text IS NULL OR p.assignee_name = $2)
        AND (
              $3::jsonb IS NULL
              OR EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements_text($3) AS q(code)
                    WHERE p.cpc ? q.code
                 )
            )
                AND (
                            $4::date IS NULL
                            OR to_date(p.pub_date::text, 'YYYYMMDD') >= $4
                        )
                AND (
                            $5::date IS NULL
                            OR to_date(p.pub_date::text, 'YYYYMMDD') <= $5
                        )
    """


SEARCH_SQL_NEW = f"""
WITH last_run AS (
  SELECT sq.id AS saved_query_id,
         COALESCE(MAX(ae.created_at), TIMESTAMPTZ '1970-01-01') AS ts
  FROM saved_query sq
  LEFT JOIN alert_event ae ON ae.saved_query_id = sq.id
  GROUP BY sq.id
)
SELECT p.pub_id, p.title, p.pub_date
FROM patent p
JOIN last_run lr ON lr.saved_query_id = $6
{_where_clause()}
    AND to_date(p.pub_date::text, 'YYYYMMDD') > (lr.ts AT TIME ZONE 'UTC')::date
ORDER BY to_date(p.pub_date::text, 'YYYYMMDD') DESC
LIMIT 500;
"""


def _extract_filters(filters: dict[str, Any] | None) -> tuple[str | None, str | None, str | None, str | None, str | None]:
        """Extract normalized filter tuple from saved_query.filters JSON.

        Expected keys inside filters JSONB:
            - keywords: str | null
            - assignee: str | null
            - cpc: list[str] | null
            - date_from: str(YYYY-MM-DD) | null
            - date_to: str(YYYY-MM-DD) | null
        Returns a 5-tuple matching SQL parameter order for _where_clause.
        """
        if not isinstance(filters, dict):
                return None, None, None, None, None

        keywords = filters.get("keywords") or None
        assignee = filters.get("assignee") or None

        cpc = None
        try:
                raw = filters.get("cpc")
                if raw:
                        # store as JSON-encoded array of strings for the SQL ? operator logic
                        cpc = json.dumps(list(map(str, raw)))
        except Exception:
                cpc = None

        date_from = filters.get("date_from") or None
        date_to = filters.get("date_to") or None
        return keywords, assignee, cpc, date_from, date_to


async def run_one(conn: asyncpg.Connection, sq: asyncpg.Record) -> int:
    # filters are in jsonb column 'filters'
    k, a, cpc_json, dfrom, dto = _extract_filters(sq.get("filters"))
    params = (
        k,            # $1 keywords
        a,            # $2 assignee
        cpc_json,     # $3 cpc array as json
        dfrom,        # $4 date_from
        dto,          # $5 date_to
        sq["id"],     # $6 saved_query uuid
    )
    rows = await conn.fetch(SEARCH_SQL_NEW, *params)
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
    lines = [f"・ {r['pub_date']}  {r['pub_id']}  {r['title']}" for r in sample]
    text = (
        f"SynapseIP Alert: {name}\n"
        f"Total new results: {count}\n\n"
        + "\n".join(lines)
        + "\n\n(Showing up to 50. See app for full list.)"
    )
    html = (
        "<html><head>"
        "        <style>"
        "           body {"
        "                text-align: center;"
        "           }"
        "           table {"
        "               margin: 0 auto;"
        "               border: 1px solid black;"
        "           }"
        "           table,"
        "           th,"
        "           td {"
        "               border-collapse: collapse;"
        "           }"
        "        </style>"       
        "   </head>"
        "   <body>"
        f"  <h3>SynapseIP Alert: {name}</h3>"
        f"  <p>Total new results: <b>{count}</b></p>"
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