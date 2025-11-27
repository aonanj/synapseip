from __future__ import annotations

from collections.abc import Iterable
from datetime import date
from typing import Any

import psycopg
from psycopg import sql as _sql
from psycopg.rows import dict_row

from .citation_models import BucketGranularity, CitationScope
from .repository import CANONICAL_ASSIGNEE_LATERAL, SEARCH_EXPR


def _dtint(d: date | None) -> int | None:
    if d is None:
        return None
    return d.year * 10000 + d.month * 100 + d.day


def _coerce_list(items: Iterable[Any] | None) -> list[Any]:
    return [x for x in (items or [])]


async def resolve_assignee_ids_by_name(
    conn: psycopg.AsyncConnection, names: list[str] | None
) -> list[Any]:
    if not names:
        return []
    cleaned = [n.strip() for n in names if n and str(n).strip()]
    if not cleaned:
        return []
    patterns = [f"{n}%" for n in cleaned]
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            "SELECT id FROM canonical_assignee_name WHERE canonical_assignee_name ILIKE ANY(%s)",
            [patterns],
        )
        rows = await cur.fetchall()
    return [r["id"] for r in rows if r.get("id")]


async def resolve_portfolio_pub_ids(
    conn: psycopg.AsyncConnection,
    scope: CitationScope,
    *,
    limit: int = 500,
) -> list[str]:
    """Convert CitationScope into a concrete list of patent pub_ids."""
    # Priority 1: explicit pub IDs
    explicit = [pid.strip() for pid in _coerce_list(scope.focus_pub_ids) if pid and str(pid).strip()]
    if explicit:
        seen: set[str] = set()
        ordered: list[str] = []
        for pid in explicit:
            if pid not in seen:
                seen.add(pid)
                ordered.append(pid)
        return ordered[:limit]

    # Priority 2: assignee IDs or names
    args: list[Any] = []
    where: list[str] = []
    if scope.focus_assignee_ids:
        where.append("p.canonical_assignee_name_id = ANY(%s)")
        args.append(scope.focus_assignee_ids)
    elif scope.focus_assignee_names:
        names = [n.strip() for n in scope.focus_assignee_names if n.strip()]
        if names:
            where.append("p.assignee_name ILIKE ANY(%s)")
            args.append([f"{n}%" for n in names])

    filters = scope.filters or {}
    keyword = (filters.get("keyword") or filters.get("keywords") or filters.get("q") or "").strip()
    cpc = (filters.get("cpc") or "").strip()
    assignee_filter = (filters.get("assignee") or filters.get("assignee_contains") or "").strip()
    date_from = filters.get("date_from")
    date_to = filters.get("date_to")
    if date_from:
        where.append("p.pub_date >= %s")
        args.append(int(str(date_from).replace("-", "")))
    if date_to:
        where.append("p.pub_date <= %s")
        args.append(int(str(date_to).replace("-", "")))
    if assignee_filter:
        where.append("(COALESCE(can.canonical_assignee_name, p.assignee_name) ILIKE %s)")
        args.append(f"%{assignee_filter}%")
    if cpc:
        prefix = cpc.upper().replace(" ", "")
        where.append(
            "EXISTS ("
            "   SELECT 1 FROM jsonb_array_elements(COALESCE(p.cpc, '[]'::jsonb)) c"
            "   WHERE ( (c->>'section')"
            "          || (c->>'class')"
            "          || (c->>'subclass')"
            "          || COALESCE(c->>'group', '')"
            "          || COALESCE('/' || (c->>'subgroup'), '') ) LIKE %s"
            ")"
        )
        args.append(f"{prefix}%")

    if not where and not keyword:
        # No filters to constrain; return empty to avoid sweeping the table.
        return []

    limit = max(1, min(limit, 800))
    base_query = [
        "SELECT p.pub_id",
        f"FROM patent p {CANONICAL_ASSIGNEE_LATERAL}",
    ]
    if where or keyword:
        clauses = list(where)
        if keyword:
            base_query.append(f"WHERE ({' AND '.join(clauses) if clauses else '1=1'}) AND ({SEARCH_EXPR}) @@ plainto_tsquery('english', %s)")
            args.append(keyword)
        else:
            base_query.append(f"WHERE {' AND '.join(clauses)}")
    base_query.append("ORDER BY p.pub_date DESC NULLS LAST")
    base_query.append("LIMIT %s")
    args.append(limit)

    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_sql.SQL("\n".join(base_query)), args) # type: ignore
        rows = await cur.fetchall()
    return [r["pub_id"] for r in rows if r.get("pub_id")]


async def get_forward_citation_timeline(
    conn: psycopg.AsyncConnection,
    portfolio_pub_ids: list[str],
    scope: CitationScope,
) -> list[dict[str, Any]]:
    if not portfolio_pub_ids:
        return []
    bucket: BucketGranularity = scope.bucket or "month"
    bucket_expr = f"date_trunc('{bucket}', to_date(citing.pub_date::text, 'YYYYMMDD'))::date"
    args: list[Any] = [portfolio_pub_ids]
    date_from = _dtint(scope.citing_pub_date_from)
    date_to = _dtint(scope.citing_pub_date_to)

    where: list[str] = ["r.cited_pub_id = ANY(%s)", "citing.pub_date IS NOT NULL"]
    if date_from:
        where.append("citing.pub_date >= %s")
        args.append(date_from)
    if date_to:
        where.append("citing.pub_date <= %s")
        args.append(date_to)

    query = f"""
    WITH resolved AS (
        SELECT
            pc.citing_pub_id,
            COALESCE(pc.cited_pub_id, cited_app.pub_id) AS cited_pub_id
        FROM patent_citation pc
        LEFT JOIN patent cited_app ON cited_app.application_number = pc.cited_application_number AND pc.cited_pub_id IS NULL
    )
    SELECT
        {bucket_expr} AS bucket_start,
        COUNT(*) AS citation_total,
        COUNT(DISTINCT r.citing_pub_id) AS citing_count
    FROM resolved r
    JOIN patent citing ON citing.pub_id = r.citing_pub_id
    WHERE {' AND '.join(where)}
    GROUP BY bucket_start
    ORDER BY bucket_start;
    """
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_sql.SQL(query), args) # type: ignore
        return await cur.fetchall()


async def get_forward_citation_summary(
    conn: psycopg.AsyncConnection,
    portfolio_pub_ids: list[str],
    top_n: int,
) -> list[dict[str, Any]]:
    if not portfolio_pub_ids:
        return []
    args: list[Any] = [portfolio_pub_ids, portfolio_pub_ids, max(1, top_n)]
    query = """
    WITH resolved AS (
        SELECT
            COALESCE(pc.cited_pub_id, cited_app.pub_id) AS cited_pub_id,
            pc.citing_pub_id
        FROM patent_citation pc
        LEFT JOIN patent cited_app ON cited_app.application_number = pc.cited_application_number AND pc.cited_pub_id IS NULL
        WHERE COALESCE(pc.cited_pub_id, cited_app.pub_id) = ANY(%s)
    ),
    agg AS (
        SELECT
            r.cited_pub_id,
            COUNT(DISTINCT r.citing_pub_id) AS fwd_citation_count,
            MIN(citing.pub_date) AS first_citation_date,
            MAX(citing.pub_date) AS last_citation_date
        FROM resolved r
        JOIN patent citing ON citing.pub_id = r.citing_pub_id
        WHERE r.cited_pub_id IS NOT NULL
        GROUP BY r.cited_pub_id
    )
    SELECT
        p.pub_id,
        p.title,
        COALESCE(can.canonical_assignee_name, p.assignee_name) AS assignee_name,
        p.canonical_assignee_name_id AS canonical_assignee_id,
        p.pub_date,
        COALESCE(a.fwd_citation_count, 0) AS fwd_citation_count,
        a.first_citation_date,
        a.last_citation_date
    FROM patent p
    LEFT JOIN agg a ON a.cited_pub_id = p.pub_id
    LEFT JOIN canonical_assignee_name can ON can.id = p.canonical_assignee_name_id
    WHERE p.pub_id = ANY(%s)
    ORDER BY COALESCE(a.fwd_citation_count, 0) DESC, p.pub_date DESC NULLS LAST
    LIMIT %s;
    """
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(query, args)
        return await cur.fetchall()


async def get_cross_assignee_dependency_matrix(
    conn: psycopg.AsyncConnection,
    *,
    portfolio_pub_ids: list[str],
    min_citations: int,
    normalize: bool,
) -> list[dict[str, Any]]:
    if not portfolio_pub_ids:
        return []
    args: list[Any] = [portfolio_pub_ids, portfolio_pub_ids, normalize, min_citations]
    query = """
    WITH resolved AS (
        SELECT
            pc.citing_pub_id,
            COALESCE(pc.cited_pub_id, cited_app.pub_id) AS cited_pub_id
        FROM patent_citation pc
        LEFT JOIN patent cited_app ON cited_app.application_number = pc.cited_application_number AND pc.cited_pub_id IS NULL
        WHERE pc.citing_pub_id = ANY(%s) OR COALESCE(pc.cited_pub_id, cited_app.pub_id) = ANY(%s)
    ),
    edges_base AS (
        SELECT
            COALESCE(citing.canonical_assignee_name_id::text, LOWER(TRIM(citing.assignee_name))) AS citing_key,
            COALESCE(cited.canonical_assignee_name_id::text, LOWER(TRIM(cited.assignee_name))) AS cited_key,
            citing.canonical_assignee_name_id AS citing_assignee_id,
            COALESCE(citing_can.canonical_assignee_name, citing.assignee_name, 'Unknown') AS citing_assignee_name,
            cited.canonical_assignee_name_id AS cited_assignee_id,
            COALESCE(cited_can.canonical_assignee_name, cited.assignee_name, 'Unknown') AS cited_assignee_name
        FROM resolved r
        JOIN patent citing ON citing.pub_id = r.citing_pub_id
        JOIN patent cited ON cited.pub_id = r.cited_pub_id
        LEFT JOIN canonical_assignee_name citing_can ON citing_can.id = citing.canonical_assignee_name_id
        LEFT JOIN canonical_assignee_name cited_can ON cited_can.id = cited.canonical_assignee_name_id
    ),
    edges AS (
        SELECT
            citing_key,
            cited_key,
            MIN(citing_assignee_id::text) FILTER (WHERE citing_assignee_id IS NOT NULL)::uuid AS citing_assignee_id,
            MIN(cited_assignee_id::text) FILTER (WHERE cited_assignee_id IS NOT NULL)::uuid AS cited_assignee_id,
            MAX(citing_assignee_name) AS citing_assignee_name,
            MAX(cited_assignee_name) AS cited_assignee_name,
            COUNT(*) AS citation_count
        FROM edges_base
        GROUP BY citing_key, cited_key
    )
    SELECT
        citing_assignee_id,
        citing_assignee_name,
        cited_assignee_id,
        cited_assignee_name,
        citation_count,
        CASE WHEN %s THEN citation_count::float / NULLIF(SUM(citation_count) OVER (PARTITION BY citing_key), 0) END AS citing_to_cited_pct
    FROM edges
    WHERE citation_count >= %s
    ORDER BY citation_count DESC;
    """
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(query, args)
        return await cur.fetchall()


async def get_risk_raw_metrics(
    conn: psycopg.AsyncConnection,
    *,
    portfolio_pub_ids: list[str],
    competitor_assignee_ids: list[Any] | None,
    limit: int,
) -> list[dict[str, Any]]:
    if not portfolio_pub_ids:
        return []
    competitor_ids = competitor_assignee_ids or []
    limit = max(1, min(limit, 500))
    args: list[Any] = [portfolio_pub_ids, competitor_ids, portfolio_pub_ids, portfolio_pub_ids, limit]
    query = """
    WITH resolved_fwd AS (
        SELECT
            COALESCE(pc.cited_pub_id, cited_app.pub_id) AS target_pub_id,
            pc.citing_pub_id
        FROM patent_citation pc
        LEFT JOIN patent cited_app ON cited_app.application_number = pc.cited_application_number AND pc.cited_pub_id IS NULL
        WHERE COALESCE(pc.cited_pub_id, cited_app.pub_id) = ANY(%s)
    ),
    fwd AS (
        SELECT
            target_pub_id AS pub_id,
            COUNT(DISTINCT citing_pub_id) AS fwd_total,
            COUNT(DISTINCT citing_pub_id) FILTER (WHERE citing.canonical_assignee_name_id = ANY(%s)) AS fwd_from_competitors
        FROM resolved_fwd r
        JOIN patent citing ON citing.pub_id = r.citing_pub_id
        WHERE r.target_pub_id IS NOT NULL
        GROUP BY target_pub_id
    ),
    resolved_bwd AS (
        SELECT
            pc.citing_pub_id AS pub_id,
            COALESCE(pc.cited_pub_id, cited_app.pub_id) AS cited_pub_id
        FROM patent_citation pc
        LEFT JOIN patent cited_app ON cited_app.application_number = pc.cited_application_number AND pc.cited_pub_id IS NULL
        WHERE pc.citing_pub_id = ANY(%s)
    ),
    bwd_totals AS (
        SELECT pub_id, COUNT(*) AS bwd_total
        FROM resolved_bwd
        WHERE cited_pub_id IS NOT NULL
        GROUP BY pub_id
    ),
    cpc_counts AS (
        SELECT
            r.pub_id,
            CONCAT(
                COALESCE(cpc_elem->>'section', ''),
                COALESCE(cpc_elem->>'class', ''),
                COALESCE(cpc_elem->>'subclass', ''),
                COALESCE(cpc_elem->>'group', ''),
                COALESCE('/' || (cpc_elem->>'subgroup'), '')
            ) AS cpc_code,
            COUNT(*) AS cnt
        FROM resolved_bwd r
        JOIN patent cited ON cited.pub_id = r.cited_pub_id
        LEFT JOIN LATERAL jsonb_array_elements(COALESCE(cited.cpc, '[]'::jsonb)) c(cpc_elem) ON TRUE
        WHERE r.cited_pub_id IS NOT NULL
        GROUP BY r.pub_id, cpc_code
    ),
    assignee_counts AS (
        SELECT
            r.pub_id,
            COALESCE(cited.canonical_assignee_name_id::text, cited.assignee_name, 'Unknown') AS assignee_key,
            COUNT(*) AS cnt
        FROM resolved_bwd r
        JOIN patent cited ON cited.pub_id = r.cited_pub_id
        WHERE r.cited_pub_id IS NOT NULL
        GROUP BY r.pub_id, assignee_key
    ),
    cpc_hist AS (
        SELECT pub_id, jsonb_object_agg(cpc_code, cnt) FILTER (WHERE cpc_code IS NOT NULL AND cpc_code <> '') AS bwd_cpc_hist
        FROM cpc_counts
        GROUP BY pub_id
    ),
    assignee_hist AS (
        SELECT pub_id, jsonb_object_agg(assignee_key, cnt) AS bwd_assignee_hist
        FROM assignee_counts
        GROUP BY pub_id
    )
    SELECT
        p.pub_id,
        p.title,
        COALESCE(can.canonical_assignee_name, p.assignee_name) AS assignee_name,
        p.canonical_assignee_name_id AS canonical_assignee_id,
        p.pub_date,
        COALESCE(fwd.fwd_total, 0) AS fwd_total,
        COALESCE(fwd.fwd_from_competitors, 0) AS fwd_from_competitors,
        COALESCE(bwd.bwd_total, 0) AS bwd_total,
        COALESCE(cpc_hist.bwd_cpc_hist, '{}'::jsonb) AS bwd_cpc_hist,
        COALESCE(assignee_hist.bwd_assignee_hist, '{}'::jsonb) AS bwd_assignee_hist
    FROM patent p
    LEFT JOIN fwd ON fwd.pub_id = p.pub_id
    LEFT JOIN bwd_totals bwd ON bwd.pub_id = p.pub_id
    LEFT JOIN cpc_hist ON cpc_hist.pub_id = p.pub_id
    LEFT JOIN assignee_hist ON assignee_hist.pub_id = p.pub_id
    LEFT JOIN canonical_assignee_name can ON can.id = p.canonical_assignee_name_id
    WHERE p.pub_id = ANY(%s)
    ORDER BY COALESCE(fwd.fwd_total, 0) DESC, p.pub_date DESC NULLS LAST
    LIMIT %s;
    """
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(query, args)
        return await cur.fetchall()


async def get_encroachment_timeline(
    conn: psycopg.AsyncConnection,
    *,
    target_assignee_ids: list[Any],
    competitor_assignee_ids: list[Any] | None,
    from_date: date | None,
    to_date: date | None,
    bucket: str,
) -> list[dict[str, Any]]:
    if not target_assignee_ids:
        return []
    bucket_expr = f"date_trunc('{bucket}', to_date(citing.pub_date::text, 'YYYYMMDD'))::date"
    args: list[Any] = [target_assignee_ids]
    date_from_int = _dtint(from_date)
    date_to_int = _dtint(to_date)
    competitor_ids = competitor_assignee_ids or []

    where: list[str] = [
        "cited.canonical_assignee_name_id = ANY(%s)",
        "citing.pub_date IS NOT NULL",
    ]
    if competitor_ids:
        where.append("citing.canonical_assignee_name_id = ANY(%s)")
        args.append(competitor_ids)
    else:
        where.append("(citing.canonical_assignee_name_id IS NULL OR citing.canonical_assignee_name_id <> ALL(%s))")
        args.append(target_assignee_ids)
    if date_from_int:
        where.append("citing.pub_date >= %s")
        args.append(date_from_int)
    if date_to_int:
        where.append("citing.pub_date <= %s")
        args.append(date_to_int)

    query = f"""
    WITH resolved AS (
        SELECT
            COALESCE(pc.cited_pub_id, cited_app.pub_id) AS cited_pub_id,
            pc.citing_pub_id
        FROM patent_citation pc
        LEFT JOIN patent cited_app ON cited_app.application_number = pc.cited_application_number AND pc.cited_pub_id IS NULL
    )
    SELECT
        {bucket_expr} AS bucket_start,
        citing.canonical_assignee_name_id AS competitor_assignee_id,
        COALESCE(citing_can.canonical_assignee_name, citing.assignee_name) AS competitor_assignee_name,
        COUNT(DISTINCT r.citing_pub_id) AS citing_patent_count
    FROM resolved r
    JOIN patent cited ON cited.pub_id = r.cited_pub_id
    JOIN patent citing ON citing.pub_id = r.citing_pub_id
    LEFT JOIN canonical_assignee_name citing_can ON citing_can.id = citing.canonical_assignee_name_id
    WHERE {' AND '.join(where)}
    GROUP BY bucket_start, competitor_assignee_id, competitor_assignee_name
    ORDER BY bucket_start, citing_patent_count DESC;
    """
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_sql.SQL(query), args)  # type: ignore
        return await cur.fetchall()
