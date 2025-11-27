# app/repository.py
from __future__ import annotations

import os
from collections.abc import Iterable
from typing import Any, Final

import psycopg
from psycopg import sql as _sql
from psycopg.rows import dict_row

from .schemas import (
    PatentDetail,
    PatentHit,
    ScopeClaimMatch,
    SearchFilters,
    SearchSortOption,
)

_VEC_CAST: Final[str] = (
    "::halfvec" if os.environ.get("VECTOR_TYPE", "vector").lower().startswith("half") else "::vector"
)

# Semantic search tuning (less restrictive by default)
SEMANTIC_TOPK: Final[int] = int(os.getenv("SEMANTIC_TOPK", "1000"))
SEMANTIC_JUMP: Final[float] = float(os.getenv("SEMANTIC_JUMP", "0.1"))
EXPORT_MAX_ROWS: Final[int] = int(os.getenv("EXPORT_MAX_ROWS", "1000"))
EXPORT_SEMANTIC_TOPK: Final[int] = int(os.getenv("EXPORT_SEMANTIC_TOPK", "1500"))

# add near top of repository.py, after imports/constants
SEARCH_EXPR = (
    "setweight(to_tsvector('english', coalesce(p.title,'')),'A') || "
    "setweight(to_tsvector('english', coalesce(p.abstract,'')),'B') || "
    "setweight(to_tsvector('english', coalesce(p.claims_text,'')),'C')"
)

CANONICAL_ASSIGNEE_LATERAL = """
LEFT JOIN LATERAL (
    SELECT
        string_agg(name, ', ' ORDER BY position, name) AS canonical_assignee_name
    FROM (
        SELECT DISTINCT
            can2.canonical_assignee_name AS name,
            COALESCE(pa.position, 32767) AS position
        FROM patent_assignee pa
        JOIN canonical_assignee_name can2 ON can2.id = pa.canonical_id
        WHERE pa.pub_id = p.pub_id
    ) ordered
) can ON TRUE
""".strip()

ASSIGNEE_SORT_EXPR: Final[str] = "COALESCE(can.canonical_assignee_name, p.assignee_name)"


def _dtint(s: int | str | None) -> int | None:
    if s is None:
        return None
    if isinstance(s, int):
        return s
    # accepts YYYY-MM-DD or YYYYMMDD
    t = s.replace("-", "")
    return int(t) if t.isdigit() and len(t) == 8 else None

def _filters_sql(f: SearchFilters, args: list[object]) -> str:
    """Build WHERE clause and append positional args."""
    where: list[str] = ["1=1"]

    if f.assignee:
        # Filter against canonical when available; fall back to raw assignee
        where.append(f"{ASSIGNEE_SORT_EXPR} ILIKE %s")
        args.append(f"%{f.assignee}%")

    if f.cpc:
        prefix = f.cpc.upper().replace(" ", "")
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

    if f.date_from:
        where.append("p.pub_date >= %s")
        args.append(_dtint(f.date_from))

    if f.date_to:
        where.append("p.pub_date < %s")
        args.append(_dtint(f.date_to))

    return " AND ".join(where)


def _assignee_sort_key(row: dict[str, Any], *, descending: bool = False) -> tuple[Any, ...]:
    """Sort key mirroring the SQL ORDER BY for canonical assignee."""
    name_raw = row.get("assignee_name") or ""
    name = name_raw.strip()
    name_priority = 0 if name else 1  # push empties to the end
    comp_name = name.casefold()
    if descending:
        # Use negative code points so ascending sort yields Z->A while keeping empties last.
        comp_name = tuple([-ord(ch) for ch in comp_name])  # type: ignore[assignment]
    pub_date_val = row.get("pub_date")
    if isinstance(pub_date_val, int):
        date_sort = -pub_date_val
    elif isinstance(pub_date_val, str) and pub_date_val.isdigit():
        date_sort = -int(pub_date_val)
    else:
        date_sort = -1
    pub_id = row.get("pub_id") or ""
    return (name_priority, comp_name, date_sort, pub_id)


def _pub_date_sort_key(row: dict[str, Any], *, ascending: bool) -> tuple[int, Any, str]:
    """Sort key for publication date with stable fallback and direction toggle."""
    raw = row.get("pub_date")
    pub_id = row.get("pub_id") or ""
    if isinstance(raw, int):
        val = raw
    elif isinstance(raw, str) and raw.isdigit():
        val = int(raw)
    else:
        return (1, None, pub_id)
    return (0, val if ascending else -val, pub_id)


def _pub_date_desc_sort_key(row: dict[str, Any]) -> tuple[int, Any, str]:
    return _pub_date_sort_key(row, ascending=False)


def _pub_date_asc_sort_key(row: dict[str, Any]) -> tuple[int, Any, str]:
    return _pub_date_sort_key(row, ascending=True)

def _adaptive_filters(rows: list[dict[str, Any]], *,
                      dist_cap: float | None = None,
                      jump: float = 0.1,
                      limit: int = 500) -> list[dict[str, Any]]:
    if not rows:
        return rows
    
    keep = []
    last = rows[0]["dist"]
    for r in rows:
        d = r["dist"]
        if dist_cap is not None and d > dist_cap:
            break
        if keep and (d - last) > jump:
            break
        keep.append(r)
        last = d
        if len(keep) >= limit:
            break
    return keep

def _cpc_dict_to_code(c: dict[str, Any] | None) -> str:
    if not c:
        return ""
    sec = (c.get("section") or "").strip()
    cls = (c.get("class") or "").strip()
    sub = (c.get("subclass") or "").strip()
    grp = (c.get("group") or "").strip()
    sgrp = (c.get("subgroup") or "").strip()
    head = f"{sec}{cls}{sub}".strip()
    tail = ""
    if grp:
        tail = grp + (f"/{sgrp}" if sgrp else "")
    return (head + tail).strip()

async def export_rows(
    conn: psycopg.AsyncConnection,
    *,
    keywords: str | None,
    query_vec: Iterable[float] | None,
    filters: SearchFilters,
    limit: int = EXPORT_MAX_ROWS,
    sort_by: SearchSortOption = "pub_date_desc",
) -> list[dict[str, Any]]:
    """Return up to `limit` rows for export with flattened CPC.

    Fields: pub_id, title, abstract, assignee_name, pub_date, cpc (comma-separated), priority_date
    """
    limit = max(1, min(limit, EXPORT_MAX_ROWS))
    tsq = None
    if keywords:
        tsq = "plainto_tsquery('english', %s)"

    if query_vec is None:
        # Keyword-only path: use SQL with optional TS ranking.
        args: list[object] = []
        select_core = (
            "SELECT p.pub_id, p.title, p.abstract, COALESCE(can.canonical_assignee_name, p.assignee_name) AS assignee_name, p.pub_date, p.priority_date, "
            "(SELECT string_agg(DISTINCT \n"
            "        (COALESCE(c->>'section','') || COALESCE(c->>'class','') || COALESCE(c->>'subclass','') || \n"
            "         COALESCE(c->>'group','') || COALESCE('/' || (c->>'subgroup'), '')), ', ')\n"
            "   FROM jsonb_array_elements(COALESCE(p.cpc, '[]'::jsonb)) c) AS cpc_str"
        )
        from_clause = f"FROM patent p {CANONICAL_ASSIGNEE_LATERAL}"
        where = [_filters_sql(filters, args)]

        if keywords:
            where.append(f"({SEARCH_EXPR}) @@ {tsq}")
            args.append(keywords)

        base_query = f"{from_clause} WHERE {' AND '.join(where)}"
        if sort_by == "assignee_asc":
            order_by = f"ORDER BY {ASSIGNEE_SORT_EXPR} ASC NULLS LAST, p.pub_date DESC, p.pub_id ASC"
        elif sort_by == "assignee_desc":
            order_by = f"ORDER BY {ASSIGNEE_SORT_EXPR} DESC NULLS LAST, p.pub_date DESC, p.pub_id ASC"
        elif sort_by == "pub_date_asc":
            order_by = "ORDER BY p.pub_date ASC NULLS LAST, p.pub_id ASC"
        elif sort_by == "relevance_desc" and keywords:
            # order by text search rank when keywords present
            order_by = f"ORDER BY ts_rank_cd(({SEARCH_EXPR}), {tsq}) DESC, p.pub_date DESC"
            args.append(keywords)
        else:
            order_by = "ORDER BY p.pub_date DESC NULLS LAST, p.pub_id ASC"

        sql = f"{select_core} {base_query} {order_by} LIMIT %s"
        args.append(limit)

        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(_sql.SQL(sql), args)  # type: ignore
            rows: list[dict[str, Any]] = await cur.fetchall()

        # Normalize 'cpc' as string
        out: list[dict[str, Any]] = []
        for r in rows:
            out.append(
                {
                    "pub_id": r.get("pub_id"),
                    "title": r.get("title"),
                    "abstract": r.get("abstract"),
                    "assignee_name": r.get("assignee_name"),
                    "pub_date": r.get("pub_date"),
                    "priority_date": r.get("priority_date"),
                    "cpc": r.get("cpc_str") or "",
                }
            )
        return out

    # Semantic path: select top-K by distance then post-filter in Python.
    topk = max(limit, EXPORT_SEMANTIC_TOPK)
    args: list[object] = []
    select_core = (
        "SELECT p.pub_id, p.title, p.abstract, COALESCE(can.canonical_assignee_name, p.assignee_name) AS assignee_name, p.pub_date, p.priority_date, "
        f"(e.embedding <=> %s{_VEC_CAST}) AS dist, "
        "(SELECT string_agg(DISTINCT \n"
        "        (COALESCE(c->>'section','') || COALESCE(c->>'class','') || COALESCE(c->>'subclass','') || \n"
        "         COALESCE(c->>'group','') || COALESCE('/' || (c->>'subgroup'), '')), ', ')\n"
        "   FROM jsonb_array_elements(COALESCE(p.cpc, '[]'::jsonb)) c) AS cpc_str"
    )
    args.append(list(query_vec))
    from_clause = (
        f"FROM patent p JOIN patent_embeddings e ON p.pub_id = e.pub_id {CANONICAL_ASSIGNEE_LATERAL}"
    )
    where = [_filters_sql(filters, args)]
    where.append("e.model LIKE '%%|ta'")
    if keywords:
        where.append(f"({SEARCH_EXPR}) @@ {tsq}")
        args.append(keywords)
    base_query = f"{from_clause} WHERE {' AND '.join(where)}"
    sql = f"{select_core} {base_query} ORDER BY dist ASC LIMIT {topk}"

    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_sql.SQL(sql), args)  # type: ignore
        rows: list[dict[str, Any]] = await cur.fetchall()

    kept = _adaptive_filters(rows, jump=SEMANTIC_JUMP, limit=topk)
    # Preserve distance ordering by default so exports stay relevance-sorted;
    # only re-sort when callers explicitly request a different ordering.
    if sort_by == "assignee_asc":
        kept = sorted(kept, key=_assignee_sort_key)
    elif sort_by == "assignee_desc":
        kept = sorted(kept, key=lambda row: _assignee_sort_key(row, descending=True))
    elif sort_by == "pub_date_asc":
        kept = sorted(kept, key=_pub_date_asc_sort_key)
    elif sort_by == "pub_date_desc":
        kept = sorted(kept, key=_pub_date_desc_sort_key)
    kept = kept[:limit]
    out: list[dict[str, Any]] = []
    for r in kept:
        out.append(
            {
                "pub_id": r.get("pub_id"),
                "title": r.get("title"),
                "abstract": r.get("abstract"),
                "assignee_name": r.get("assignee_name"),
                "pub_date": r.get("pub_date"),
                "priority_date": r.get("priority_date"),
                "cpc": r.get("cpc_str") or "",
            }
        )
    return out

async def search_hybrid(
    conn: psycopg.AsyncConnection,
    *,
    keywords: str | None,
    query_vec: Iterable[float] | None,
    limit: int,
    offset: int,
    filters: SearchFilters,
    sort_by: SearchSortOption = "pub_date_desc",
) -> tuple[int, list[PatentHit]]:
    """Keyword and/or vector search.

    When query_vec is provided, perform rank-only cosine distance search:
    - Fetch top 200 by cosine distance (no distance predicate in SQL)
    - Apply post-filter in code: drop after jump in distance > 0.05
    - Then apply offset/limit on the filtered list
    For keyword-only, fall back to existing ranking and total counting.
    """

    tsq = None
    if keywords:
        tsq = "plainto_tsquery('english', %s)"


    # Keyword-only path (no semantic vector): keep existing behavior
    if query_vec is None:
        args: list[object] = []
        select_core = (
            "SELECT p.pub_id, p.title, p.abstract, COALESCE(can.canonical_assignee_name, p.assignee_name) AS assignee_name, p.pub_date, p.kind_code, p.cpc"
        )
        from_clause = f"FROM patent p {CANONICAL_ASSIGNEE_LATERAL}"
        joins: list[str] = []
        where = [_filters_sql(filters, args)]

        if keywords:
            where.append(f"({SEARCH_EXPR}) @@ {tsq}")
            args.append(keywords)

        base_query = f"{from_clause} {' '.join(joins)} WHERE {' AND '.join(where)}"
        count_query = f"SELECT COUNT(DISTINCT p.pub_id) {base_query}"

        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(_sql.SQL(count_query), args)  # type: ignore
            total_row = await cur.fetchone()
            total = total_row["count"] if total_row else 0

        if sort_by == "assignee_asc":
            order_by = f"ORDER BY {ASSIGNEE_SORT_EXPR} ASC NULLS LAST, p.pub_date DESC, p.pub_id ASC"
        elif sort_by == "assignee_desc":
            order_by = f"ORDER BY {ASSIGNEE_SORT_EXPR} DESC NULLS LAST, p.pub_date DESC, p.pub_id ASC"
        elif sort_by == "pub_date_asc":
            order_by = "ORDER BY p.pub_date ASC NULLS LAST, p.pub_id ASC"
        elif sort_by == "relevance_desc" and keywords:
            # add keyword again for ordering
            args.append(keywords)
            order_by = f"ORDER BY ts_rank_cd(({SEARCH_EXPR}), {tsq}) DESC, p.pub_date DESC"
        else:
            order_by = "ORDER BY p.pub_date DESC NULLS LAST, p.pub_id ASC"

        paged_query = f"{select_core} {base_query} {order_by} LIMIT %s OFFSET %s"
        args.extend([limit, offset])

        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(_sql.SQL(paged_query), args)  # type: ignore
            rows = await cur.fetchall()

        items = [PatentHit(**row) for row in rows]
        return total, items

    # Vector (semantic) path: fetch top-K, apply adaptive filter, then paginate
    # Fetch a larger set to ensure we have enough results after filtering
    topk = max(SEMANTIC_TOPK, offset + limit * 2)

    select_core = (
        "SELECT p.pub_id, p.title, p.abstract, COALESCE(can.canonical_assignee_name, p.assignee_name) AS assignee_name, p.pub_date, p.kind_code, p.cpc, "
        f"(e.embedding <=> %s{_VEC_CAST}) AS dist"
    )
    from_clause = (
        f"FROM patent p JOIN patent_embeddings e ON p.pub_id = e.pub_id {CANONICAL_ASSIGNEE_LATERAL}"
    )

    filter_args: list[object] = []
    where_clauses = [_filters_sql(filters, filter_args)]
    where_clauses.append("e.model LIKE '%%|ta'")
    if keywords:
        where_clauses.append(f"({SEARCH_EXPR}) @@ {tsq}")
        filter_args.append(keywords)

    where_sql = " AND ".join(where_clauses)

    # Fetch top-K candidates ordered by distance
    topk_query = f"{select_core} {from_clause} WHERE {where_sql} ORDER BY dist ASC LIMIT {topk}"

    async with conn.cursor(row_factory=dict_row) as cur:
        select_args = [list(query_vec), *filter_args]
        await cur.execute(_sql.SQL(topk_query), select_args)  # type: ignore
        rows = await cur.fetchall()

    # Apply adaptive filtering to remove irrelevant results based on distance jumps
    kept = _adaptive_filters(rows, jump=SEMANTIC_JUMP, limit=topk)
    if sort_by == "assignee_asc":
        kept = sorted(kept, key=_assignee_sort_key)
    elif sort_by == "assignee_desc":
        kept = sorted(kept, key=lambda row: _assignee_sort_key(row, descending=True))
    elif sort_by == "pub_date_asc":
        kept = sorted(kept, key=_pub_date_asc_sort_key)
    elif sort_by == "pub_date_desc":
        kept = sorted(kept, key=_pub_date_desc_sort_key)

    # Calculate total based on filtered results
    total = len(kept)

    # Apply pagination to filtered results
    paged_results = kept[offset:offset + limit]

    items = [
        PatentHit(
            pub_id=r["pub_id"],
            title=r.get("title"),
            abstract=r.get("abstract"),
            assignee_name=r.get("assignee_name"),
            pub_date=r.get("pub_date"),
            kind_code=r.get("kind_code"),
            cpc=r.get("cpc"),
            score=r.get("dist"),
        )
        for r in paged_results
    ]
    return total, items


async def trend_volume(
    conn: psycopg.AsyncConnection,
    *,
    group_by: str,
    filters: SearchFilters,
    keywords: str | None = None,
    query_vec: Iterable[float] | None = None,
) -> list[tuple[str, int, str | None]]:
    """Aggregate counts by month, CPC, or assignee.

    For semantic search (query_vec provided):
    - Rank-only cosine distance top-200 candidates
    - Post-filter in code with jump > 0.05
    - Perform aggregation in code over the kept set
    Otherwise, fall back to SQL aggregation with keyword/metadata filters.

    Returns list of tuples: (bucket, count, top_assignee)
    where top_assignee is only populated for group_by="month"
    """

    # Helper to compute bucket in Python
    def month_bucket(pub_date: int | None) -> str | None:
        if not pub_date:
            return None
        s = str(pub_date)
        if len(s) != 8:
            return None
        return f"{s[:4]}-{s[4:6]}"
    
    tsq = None
    if keywords:
        tsq = "plainto_tsquery('english', %s)"

    if query_vec is not None:
        # Vector path: select top-N with distance, then aggregate in Python
        topk = SEMANTIC_TOPK
        args: list[object] = []
        select_core = (
            "SELECT p.pub_id, p.pub_date, COALESCE(can.canonical_assignee_name, p.assignee_name) AS assignee_name, p.cpc, "
            f"(e.embedding <=> %s{_VEC_CAST}) AS dist"
        )
        args.append(list(query_vec))
        from_clause = (
            f"FROM patent p JOIN patent_embeddings e ON p.pub_id = e.pub_id {CANONICAL_ASSIGNEE_LATERAL}"
        )
        where_parts = [_filters_sql(filters, args)]
        where_parts.append("e.model LIKE '%%|ta'")
        if keywords:
            where_parts.append(f"({SEARCH_EXPR}) @@ {tsq}")
            args.append(keywords)

        sql = f"{select_core} {from_clause} WHERE {' AND '.join(where_parts)} ORDER BY dist ASC LIMIT {topk}"
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(_sql.SQL(sql), args)  # type: ignore
            rows: list[dict[str, Any]] = await cur.fetchall()

        kept = _adaptive_filters(rows, jump=SEMANTIC_JUMP, limit=topk)

        # Aggregate in Python based on group_by
        counts: dict[str, int] = {}
        assignees_by_month: dict[str, dict[str, int]] = {}  # month -> {assignee -> count}

        if group_by == "month":
            for r in kept:
                b = month_bucket(r.get("pub_date"))
                if not b:
                    continue
                counts[b] = counts.get(b, 0) + 1

                # Track assignee counts per month
                assignee = r.get("assignee_name")
                if assignee:
                    if b not in assignees_by_month:
                        assignees_by_month[b] = {}
                    assignees_by_month[b][assignee] = assignees_by_month[b].get(assignee, 0) + 1
        elif group_by == "assignee":
            for r in kept:
                b = r.get("assignee_name")
                if not b:
                    continue
                counts[b] = counts.get(b, 0) + 1
        elif group_by == "cpc":
            for r in kept:
                cpc_list = r.get("cpc") or []
                try:
                    for c in cpc_list:
                        sec = c.get("section")
                        clazz = c.get("class")
                        if not sec and not clazz:
                            continue
                        b = f"{sec or ''}{clazz or ''}"
                        if not b:
                            continue
                        counts[b] = counts.get(b, 0) + 1
                except Exception:
                    # If cpc value is not a list of dicts, skip
                    continue
        else:
            raise ValueError("invalid group_by")

        # Return sorted by count desc
        if group_by == "month":
            # Include top assignee for each month
            result = []
            for bucket, count in counts.items():
                top_assignee = None
                if bucket in assignees_by_month and assignees_by_month[bucket]:
                    # Find assignee with highest count for this month
                    top_assignee = max(assignees_by_month[bucket].items(), key=lambda x: x[1])[0]
                result.append((bucket, count, top_assignee))
            return sorted(result, key=lambda kv: kv[1], reverse=True)
        else:
            # For other group_by types, top_assignee is None
            return sorted([(b, c, None) for b, c in counts.items()], key=lambda kv: kv[1], reverse=True)

    # Non-vector path: keep SQL aggregation as before
    args: list[object] = []
    from_clause = f"FROM patent p {CANONICAL_ASSIGNEE_LATERAL}"
    joins: list[str] = []
    where_clauses = [_filters_sql(filters, args)]

    if keywords:
        where_clauses.append(f"({SEARCH_EXPR}) @@ {tsq}")
        args.append(keywords)

    if group_by == "month":
        bucket_sql = "to_char(to_date(p.pub_date::text,'YYYYMMDD'), 'YYYY-MM')"

        # For month grouping, also fetch the top assignee per month
        # Note: This query uses where_clauses twice (in both CTEs), so we need to duplicate args
        sql = f"""
        WITH month_counts AS (
            SELECT {bucket_sql} AS bucket, COUNT(DISTINCT p.pub_id) AS count
            {from_clause}
            {' '.join(joins)}
            WHERE {' AND '.join(where_clauses)} AND {bucket_sql} IS NOT NULL
            GROUP BY bucket
        ),
        assignee_counts AS (
            SELECT
                {bucket_sql} AS bucket,
                COALESCE(can.canonical_assignee_name, p.assignee_name) AS assignee,
                COUNT(DISTINCT p.pub_id) AS assignee_count,
                ROW_NUMBER() OVER (PARTITION BY {bucket_sql} ORDER BY COUNT(DISTINCT p.pub_id) DESC) AS rn
            {from_clause}
            {' '.join(joins)}
            WHERE {' AND '.join(where_clauses)} AND {bucket_sql} IS NOT NULL
            GROUP BY {bucket_sql}, COALESCE(can.canonical_assignee_name, p.assignee_name)
        )
        SELECT
            mc.bucket,
            mc.count,
            ac.assignee AS top_assignee
        FROM month_counts mc
        LEFT JOIN assignee_counts ac ON mc.bucket = ac.bucket AND ac.rn = 1
        ORDER BY mc.count DESC
        """
        # Duplicate args since the query uses where_clauses twice
        args = args + args
    elif group_by == "cpc":
        bucket_sql = "( (cpc_agg->>'section') || COALESCE(cpc_agg->>'class', '') )"
        from_clause += ", LATERAL jsonb_array_elements(COALESCE(p.cpc, '[]'::jsonb)) cpc_agg"

        sql = f"""
            SELECT {bucket_sql} AS bucket, COUNT(DISTINCT p.pub_id) AS count
            {from_clause}
            {' '.join(joins)}
            WHERE {' AND '.join(where_clauses)} AND {bucket_sql} IS NOT NULL
            GROUP BY bucket
            ORDER BY count DESC
        """
    elif group_by == "assignee":
        bucket_sql = "COALESCE(can.canonical_assignee_name, p.assignee_name)"

        sql = f"""
            SELECT {bucket_sql} AS bucket, COUNT(DISTINCT p.pub_id) AS count
            {from_clause}
            {' '.join(joins)}
            WHERE {' AND '.join(where_clauses)} AND {bucket_sql} IS NOT NULL
            GROUP BY bucket
            ORDER BY count DESC
        """
    else:
        raise ValueError("invalid group_by")

    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_sql.SQL(sql), args)  # type: ignore
        rows = await cur.fetchall()

    if group_by == "month":
        return [(r["bucket"], r["count"], r.get("top_assignee")) for r in rows]
    else:
        return [(r["bucket"], r["count"], None) for r in rows]


async def scope_claim_knn(
    conn: psycopg.AsyncConnection,
    *,
    query_vec: Iterable[float],
    limit: int = 20,
) -> list[ScopeClaimMatch]:
    """
    Find the nearest independent claims to the provided vector embedding.
    """
    vector_list = list(query_vec)
    if not vector_list:
        return []

    limit = max(1, min(limit, 100))

    sql = f"""
        SELECT
            pc.pub_id,
            pc.claim_number,
            pc.claim_text,
            pc.is_independent,
            p.title,
            COALESCE(can.canonical_assignee_name, p.assignee_name) AS assignee_name,
            p.pub_date,
            (emb.embedding <=> %s{_VEC_CAST}) AS dist
        FROM patent_claim_embeddings emb
        JOIN patent_claim pc
          ON pc.pub_id = emb.pub_id AND pc.claim_number = emb.claim_number
        JOIN patent p ON p.pub_id = emb.pub_id
        {CANONICAL_ASSIGNEE_LATERAL}
        WHERE COALESCE(pc.is_independent, TRUE)
        ORDER BY dist ASC
        LIMIT %s
    """

    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(_sql.SQL(sql), [vector_list, limit])  # type: ignore
        rows = await cur.fetchall()

    matches: list[ScopeClaimMatch] = []
    for row in rows:
        dist_raw = row.get("dist")
        dist = float(dist_raw) if dist_raw is not None else 0.0
        similarity = max(0.0, 1.0 - dist)
        matches.append(
            ScopeClaimMatch(
                pub_id=row["pub_id"],
                claim_number=row["claim_number"],
                claim_text=row.get("claim_text"),
                title=row.get("title"),
                assignee_name=row.get("assignee_name"),
                pub_date=row.get("pub_date"),
                is_independent=row.get("is_independent"),
                distance=dist,
                similarity=similarity,
            )
        )
    return matches


async def get_patent_detail(
    conn: psycopg.AsyncConnection, pub_id: str
) -> PatentDetail | None:
    """Fetch one patent record by publication number."""
    sql = f"""
        SELECT p.pub_id,
               p.application_number,
               p.kind_code,
               p.pub_date,
               p.filing_date,
               p.title,
               p.abstract,
               p.claims_text,
               COALESCE(can.canonical_assignee_name, p.assignee_name) AS assignee_name,
               p.inventor_name,
               p.cpc
        FROM patent p
        {CANONICAL_ASSIGNEE_LATERAL}
        WHERE p.pub_id = %s
        LIMIT 1;
    """
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(sql, [pub_id])
        row = await cur.fetchone()

    return PatentDetail(**row) if row else None
