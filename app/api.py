from __future__ import annotations

import importlib.util
import inspect
import os

# Standard library imports
from collections.abc import Sequence
from contextlib import asynccontextmanager
from io import BytesIO
from pathlib import Path
from typing import Annotated, Any, cast

import psycopg

# Third-party imports
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from psycopg.rows import dict_row
from psycopg.types.json import Json
from pydantic import BaseModel

from infrastructure.logger import get_logger

# Local application imports
from .auth import ensure_auth0_configured, get_current_user
from .citation_api import router as citation_router
from .db import get_conn, init_pool
from .embed import embed as embed_text
from .observability import init_glitchtip_if_configured
from .overview_api import router as overview_router
from .payment_api import router as payment_router
from .repository import (
    export_rows,
    get_patent_detail,
    scope_claim_knn,
    search_hybrid,
    trend_volume,
)
from .schemas import (
    PatentDetail,
    ScopeAnalysisRequest,
    ScopeAnalysisResponse,
    SearchFilters,
    SearchRequest,
    SearchResponse,
    SearchSortOption,
    TrendPoint,
    TrendResponse,
)
from .stripe_config import ensure_stripe_configured
from .stripe_webhooks import process_webhook_event, verify_webhook_signature
from .subscription_middleware import ActiveSubscription

# Load environment variables from .env file
load_dotenv()

logger = get_logger()

# Optional PDF support
_has_reportlab = (
    importlib.util.find_spec("reportlab") is not None
    and importlib.util.find_spec("reportlab.pdfgen") is not None
    and importlib.util.find_spec("reportlab.lib.pagesizes") is not None
)

if _has_reportlab:
    from reportlab.lib.pagesizes import letter as _LETTER  # type: ignore
    from reportlab.pdfgen import canvas as _CANVAS  # type: ignore
    HAVE_REPORTLAB = True
else:  # pragma: no cover - optional dependency missing
    _LETTER = None  # type: ignore[assignment]
    _CANVAS = None  # type: ignore[assignment]
    HAVE_REPORTLAB = False

@asynccontextmanager
async def lifespan(_: FastAPI):
    # Initialize observability first so startup errors get captured
    init_glitchtip_if_configured()
    ensure_auth0_configured()
    ensure_stripe_configured()
    # Initialize pool at startup for early failure if misconfigured.
    pool = init_pool()
    try:
        yield
    finally:
        await pool.close()


app = FastAPI(title="SynapseIP API", version="0.1.0", lifespan=lifespan)
Conn = Annotated[psycopg.AsyncConnection, Depends(get_conn)]
User = Annotated[dict, Depends(get_current_user)]
origins = [o.strip() for o in os.getenv("CORS_ALLOW_ORIGINS", "").split(",") if o.strip()] or [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://localhost:3000",
    "https://127.0.0.1:3000",
    "https://localhost:5174",
    "https://127.0.0.1:5174",
    "https://synapseip.onrender.com",
    "https://synapseip.vercel.app",
    "https://www.synapse-ip.com",
    "https://synapse-ip.com",
]

_FAVICON_PATH = Path(__file__).resolve().parent.parent / "public" / "favicon.ico"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(overview_router)
app.include_router(citation_router)
app.include_router(payment_router)

class DateRangeReponse(BaseModel):
    min_date: int | None  # YYYYMMDD
    max_date: int | None  # YYYYMMDD


@app.get("/favicon.ico", include_in_schema=False)
async def favicon() -> FileResponse:
    if not _FAVICON_PATH.exists():
        raise HTTPException(status_code=404, detail="favicon not found")
    return FileResponse(_FAVICON_PATH, media_type="image/x-icon")


@app.post("/search", response_model=SearchResponse)
async def post_search(req: SearchRequest, conn: Conn, user: ActiveSubscription) -> SearchResponse:
    qv: list[float] | None = None
    if req.semantic_query:
        maybe = embed_text(req.semantic_query)
        if inspect.isawaitable(maybe):
            qv = cast(list[float], await maybe)
        else:
            qv = list(cast(Sequence[float], maybe))
    total, items = await search_hybrid(
        conn,
        keywords=req.keywords,
        query_vec=qv,
        limit=max(1, min(req.limit, 200)),
        offset=max(0, req.offset),
        filters=req.filters,
        sort_by=req.sort_by,
    )
    return SearchResponse(total=total, items=items)


@app.post("/scope_analysis", response_model=ScopeAnalysisResponse)
async def post_scope_analysis(
    req: ScopeAnalysisRequest,
    conn: Conn,
    user: ActiveSubscription,
) -> ScopeAnalysisResponse:
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text must not be empty")

    maybe = embed_text(text)
    if inspect.isawaitable(maybe):
        query_vec = list(cast(Sequence[float], await maybe))
    else:
        query_vec = list(cast(Sequence[float], maybe))

    matches = await scope_claim_knn(conn, query_vec=query_vec, limit=req.top_k)
    return ScopeAnalysisResponse(query_text=text, top_k=req.top_k, matches=matches)


@app.post("/scope_analysis/export")
async def export_scope_analysis(
    req: ScopeAnalysisRequest,
    conn: Conn,
    user: ActiveSubscription,
):
    if not HAVE_REPORTLAB:
        raise HTTPException(status_code=500, detail="PDF generation not available")

    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text must not be empty")

    maybe = embed_text(text)
    if inspect.isawaitable(maybe):
        query_vec = list(cast(Sequence[float], await maybe))
    else:
        query_vec = list(cast(Sequence[float], maybe))

    matches = await scope_claim_knn(conn, query_vec=query_vec, limit=req.top_k)

    buffer = BytesIO()
    c = _CANVAS.Canvas(buffer, pagesize=_LETTER)  # type: ignore
    width, height = _LETTER  # type: ignore
    margin = 40
    y = height - margin

    c.setFont("Helvetica-Bold", 16)
    c.drawString(margin, y, "Scope Analysis Results")
    y -= 24
    
    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin, y, "Input Subject Matter")
    y -= 14
    
    def _ensure_space(font_name: str | None = None, font_size: int | None = None):
        nonlocal y
        if y < 60:
            c.showPage()
            y = height - margin
            if font_name and font_size:
                c.setFont(font_name, font_size)

    def draw_wrapped_text(text: str, font_name="Helvetica", font_size=10, indent=0):
        nonlocal y
        c.setFont(font_name, font_size)
        max_w = width - margin * 2 - indent
        words = text.split()
        line = ""
        for w in words:
            test = (line + " " + w).strip()
            if c.stringWidth(test, font_name, font_size) <= max_w:
                line = test
            else:
                c.drawString(margin + indent, y, line)
                y -= (font_size + 2)
                _ensure_space(font_name, font_size)
                line = w
        if line:
            c.drawString(margin + indent, y, line)
            y -= (font_size + 2)

    draw_wrapped_text(text)
    y -= 12
    _ensure_space()
    
    c.setLineWidth(1)
    c.line(margin, y, width - margin, y)
    y -= 20

    for m in matches:
        _ensure_space()
        # Title + Pub ID
        title = m.title or "Untitled"
        pub_id = m.pub_id
        header = f"{title} ({pub_id})"
        
        draw_wrapped_text(header, font_name="Helvetica-Bold", font_size=11)
        _ensure_space()

        # Meta
        assignee = m.assignee_name or "Unknown"
        pub_date = _int_date(m.pub_date) or "-"
        sim = f"{m.similarity:.1%}"
        meta = f"Assignee: {assignee} | Grant Date: {pub_date} | Similarity: {sim}"
        
        c.setFont("Helvetica", 9)
        c.drawString(margin, y, meta)
        y -= 14
        _ensure_space()

        # Claim Text
        claim_text = m.claim_text or "No claim text available."
        claim_num = m.claim_number
        if claim_num:
            claim_text = f"{claim_num}. {claim_text}"
        
        draw_wrapped_text(claim_text, font_size=10)
        
        y -= 10
        _ensure_space()
        c.setLineWidth(0.5)
        c.line(margin, y, width - margin, y)
        y -= 14

    c.showPage()
    c.save()
    buffer.seek(0)
    
    filename = "scope_analysis_export"
    headers = {
        "Content-Type": "application/pdf",
        "Content-Disposition": f"attachment; filename={filename}.pdf",
    }
    return StreamingResponse(buffer, headers=headers, media_type="application/pdf")


# ----------------------------- Saved Queries -----------------------------
class SavedQueryCreate(BaseModel):
    name: str
    filters: dict[str, Any]
    semantic_query: str | None = None
    schedule_cron: str | None = None
    is_active: bool = True


class SavedQueryUpdate(BaseModel):
    is_active: bool | None = None
    # In the future, allow updating schedule_cron or other fields if needed
    # schedule_cron: str | None = None


async def ensure_app_user_record(conn: Conn, user: dict[str, Any]) -> str:
    """Ensure the Auth0 user exists in app_user for FK + email lookups."""
    owner_id = user.get("sub")
    if not owner_id:
        raise HTTPException(status_code=400, detail="user missing sub claim")

    email = user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="user missing email claim")

    display_name = (
        user.get("name")
        or user.get("nickname")
        or user.get("given_name")
        or user.get("email")
    )

    upsert_sql = """
        INSERT INTO app_user (id, email, display_name)
        VALUES (%s, %s, %s)
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            display_name = COALESCE(EXCLUDED.display_name, app_user.display_name)
    """
    try:
        async with conn.cursor() as cur:
            await cur.execute(upsert_sql, [owner_id, email, display_name])
            logger.info(f"Ensured app_user record for user {owner_id}")
    except psycopg.Error as e:
        logger.error(f"Error upserting app_user record for {owner_id}: {e}")
        # If there's a unique constraint violation on email, provide a helpful message
        if "unique constraint" in str(e).lower() and "email" in str(e).lower():
            raise HTTPException(
                status_code=400,
                detail="Email address is already associated with another account"
            ) from e
        # Re-raise other database errors
        raise HTTPException(
            status_code=500,
            detail="Failed to create user record"
        ) from e
    return owner_id


@app.get("/saved-queries")
async def list_saved_queries(conn: Conn, user: ActiveSubscription):

    owner_id = user.get("sub")
    if owner_id is None:
        raise HTTPException(status_code=400, detail="user missing sub claim")
    

    sql = (
        "SELECT id, owner_id, name, filters, semantic_query, schedule_cron, is_active, created_at, updated_at "
        "FROM saved_query "
        "WHERE owner_id = %s "
        "ORDER BY created_at DESC NULLS LAST, name ASC"
    )
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(sql, [owner_id])  
        rows = await cur.fetchall()
    return {"items": rows}


@app.post("/saved-queries")
async def create_saved_query(req: SavedQueryCreate, conn: Conn, user: ActiveSubscription):
    """Create a saved query.
    """
    owner_id = await ensure_app_user_record(conn, user)

    insert_sq_sql = (
        "INSERT INTO saved_query (owner_id, name, filters, semantic_query, schedule_cron, is_active) "
        "VALUES (%s,%s,%s,%s,%s,%s) RETURNING id"
    )
    try:
        async with conn.cursor() as cur:
            await cur.execute(
                insert_sq_sql,
                [
                    owner_id,
                    req.name,
                    Json(req.filters),
                    req.semantic_query,
                    req.schedule_cron,
                    req.is_active,
                ],
            )
            row = await cur.fetchone()
        return {"id": row[0] if row else None}
    except psycopg.Error as e:  # unique violation, FK errors, etc.
        logger.error(f"Error creating saved query: {e}")
        raise HTTPException(status_code=400, detail=str(e).split("\n")[0]) from e


@app.delete("/saved-queries/{id}")
async def delete_saved_query(id: str, conn: Conn, user: ActiveSubscription):
    """Delete a saved query owned by the current user.

    Requires authentication and enforces ownership in the DELETE statement.
    """
    owner_id = user.get("sub")
    if owner_id is None:
        raise HTTPException(status_code=400, detail="user missing sub claim")

    async with conn.cursor() as cur:
        await cur.execute(
            "DELETE FROM saved_query WHERE id = %s AND owner_id = %s",
            [id, owner_id],  # type: ignore[arg-type]
        )
        deleted = cur.rowcount if hasattr(cur, "rowcount") else None  # type: ignore[attr-defined]
    # If nothing was deleted, either it doesn't exist or user doesn't own it
    if not deleted:
        logger.error(f"User {owner_id} attempted to delete non-existent saved query {id}")
        raise HTTPException(status_code=404, detail="saved query not found")
    return {"deleted": deleted}


@app.patch("/saved-queries/{id}")
async def update_saved_query(id: str, req: SavedQueryUpdate, conn: Conn, user: ActiveSubscription):
    """Update a saved query owned by the current user.

    Currently supports toggling is_active.
    """
    owner_id = user.get("sub")
    if owner_id is None:
        logger.error("User missing sub claim")
        raise HTTPException(status_code=400, detail="user missing sub claim")

    if req.is_active is None:
        logger.error("No updatable fields provided")
        raise HTTPException(status_code=400, detail="no updatable fields provided")

    async with conn.cursor() as cur:
        await cur.execute(
            "UPDATE saved_query SET is_active = %s, updated_at = now() WHERE id = %s AND owner_id = %s RETURNING id",
            [req.is_active, id, owner_id],
        )
        row = await cur.fetchone()
    if not row:
        logger.error(f"User {owner_id} attempted to update non-existent saved query {id}")
        raise HTTPException(status_code=404, detail="saved query not found")
    
    logger.info(f"User {owner_id} updated saved query {id} to is_active={req.is_active}")
    return {"id": row[0], "is_active": req.is_active}


# app/api.py

@app.get("/trend/volume", response_model=TrendResponse)
async def get_trend(
    conn: Conn,
    user: ActiveSubscription,
    group_by: str = Query(...),
    q: str | None = Query(None),
    assignee: str | None = Query(None),
    cpc: str | None = Query(None),
    date_from: int | None = Query(None),
    date_to: int | None = Query(None),
    semantic_query: str | None = Query(None),
) -> TrendResponse:
    owner_id = user.get("sub")
    if owner_id is None:
        logger.error("User missing sub claim")
        raise HTTPException(status_code=400, detail="user missing sub claim")
    
    qv: list[float] | None = None
    if semantic_query:
        maybe = embed_text(semantic_query)
        if inspect.isawaitable(maybe):
            qv = cast(list[float], await maybe)
        else:
            qv = list(cast(Sequence[float], maybe))

    filters = SearchFilters(
        assignee=assignee,
        cpc=cpc,
        date_from=date_from,
        date_to=date_to,
    )

    rows = await trend_volume(
        conn,
        group_by=group_by,
        filters=filters,
        keywords=q,
        query_vec=qv,
    )
    points: list[TrendPoint] = [
        TrendPoint(bucket=str(b), count=int(c), top_assignee=top_a)
        for b, c, top_a in rows
    ]
    return TrendResponse(points=points)


@app.get("/patent-date-range", response_model=DateRangeReponse)
async def get_patent_date_range(conn: Conn) -> DateRangeReponse:
    sql = "SELECT MIN(pub_date), MAX(pub_date) FROM patent"
    async with conn.cursor() as cur:
        await cur.execute(sql)
        row = await cur.fetchone()
    if not row:
        return DateRangeReponse(min_date=None, max_date=None)
    return DateRangeReponse(min_date=row[0], max_date=row[1])


@app.get("/patent/{pub_id}", response_model=PatentDetail)
async def get_detail(pub_id: str, conn: Conn) -> PatentDetail:
    detail = await get_patent_detail(conn, pub_id)
    if not detail:
        logger.error(f"Attempt to access non-existent patent {pub_id}")
        raise HTTPException(status_code=404, detail="not found")
    return detail


def _int_date(v: int | None) -> str:
    if not v:
        return ""
    s = str(v)
    if len(s) == 8:
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
    return s


@app.get("/export")
async def export(
    conn: Conn,
    user: ActiveSubscription,
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    q: str | None = Query(None),
    assignee: str | None = Query(None),
    cpc: str | None = Query(None),
    date_from: int | None = Query(None),
    date_to: int | None = Query(None),
    semantic_query: str | None = Query(None),
    limit: int = Query(1000, ge=1, le=1000),
    sort: SearchSortOption = Query("pub_date_desc"),
):

    owner_id = user.get("sub")
    if owner_id is None:
        raise HTTPException(status_code=400, detail="user missing sub claim")

    qv: list[float] | None = None
    if semantic_query:
        maybe = embed_text(semantic_query)
        if inspect.isawaitable(maybe):
            qv = cast(list[float], await maybe)
        else:
            qv = list(cast(Sequence[float], maybe))

    filters = SearchFilters(
        assignee=assignee,
        cpc=cpc,
        date_from=date_from,
        date_to=date_to,
    )

    rows = await export_rows(
        conn,
        keywords=q,
        query_vec=qv,
        filters=filters,
        limit=limit,
        sort_by=sort,
    )

    filename = "synapseip_export"
    if format == "csv":
        def gen():
            header = ["pub_id", "title", "abstract", "assignee_name", "pub_date", "cpc", "priority_date"]
            yield (",").join(header) + "\n"
            for r in rows:
                vals = [
                    r.get("pub_id") or "",
                    (r.get("title") or "").replace("\n", " ").replace("\r", " "),
                    (r.get("abstract") or "").replace("\n", " ").replace("\r", " "),
                    r.get("assignee_name") or "",
                    _int_date(r.get("pub_date")),
                    r.get("cpc") or "",
                    _int_date(r.get("priority_date")),
                ]
                # Basic CSV quoting
                out = []
                for v in vals:
                    s = str(v)
                    if any(ch in s for ch in [',','\n','\r','"']):
                        s = '"' + s.replace('"','""') + '"'
                    out.append(s)
                yield ",".join(out) + "\n"
        headers = {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": f"attachment; filename={filename}.csv",
        }
        return StreamingResponse(gen(), headers=headers, media_type="text/csv")

    # PDF
    if not HAVE_REPORTLAB:
        logger.error("PDF export requested but reportlab is not installed")
        raise HTTPException(status_code=500, detail="PDF generation not available on server")

    buffer = BytesIO()
    c = _CANVAS.Canvas(buffer, pagesize=_LETTER)  # type: ignore[union-attr]
    width, height = _LETTER  # type: ignore[assignment]

    margin = 40
    y = height - margin
    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin, y, "SynapseIP Export (top results)")
    y -= 18
    c.setFont("Helvetica", 9)

    def _ensure_space(font_name: str | None = None, font_size: int | None = None):
        nonlocal y
        if y < 60:
            c.showPage()
            y = height - margin
            if font_name and font_size:
                c.setFont(font_name, font_size)

    def draw_label_value(label: str, value: str | None, label_font: str = "Helvetica-Bold", label_size: int = 9, value_font: str = "Helvetica", value_size: int = 9):
        """Draw a label in bold on its own line, followed by the value on subsequent wrapped lines.
        This guarantees each field starts on a new line for readability."""
        nonlocal y
        if not value:
            return
        _ensure_space()
        label_text = f"{label}:"
        # draw label on its own line
        c.setFont(label_font, label_size)
        c.drawString(margin, y, label_text)
        y -= 12
        _ensure_space()
        # now draw wrapped value starting at margin
        c.setFont(value_font, value_size)
        max_value_width = width - margin * 2
        words = str(value).split()
        line = ""
        for w in words:
            test = (line + " " + w).strip()
            test_w = c.stringWidth(test, value_font, value_size)
            if test_w <= max_value_width:
                line = test
            else:
                c.drawString(margin, y, line)
                y -= 12
                _ensure_space(value_font, value_size)
                line = w
        if line:
            c.drawString(margin, y, line)
            y -= 12

    def draw_inline_meta(pairs: list[tuple[str, str]]):
        """Draw meta pairs with each pair on its own line using the label/value layout for consistency."""
        nonlocal y
        if not pairs:
            return
        for lab, val in pairs:
            draw_label_value(lab, val)

    for r in rows:
        # Patent/Pub No (bold label)
        draw_label_value("Patent/Pub No", r.get("pub_id"), label_size=10)

        # Title and Assignee
        if r.get("title"):
            draw_label_value("Title", r.get("title"))
        if r.get("assignee_name"):
            draw_label_value("Assignee", r.get("assignee_name"))

        # Inline meta (Pub Date | Priority)
        date_s = _int_date(r.get("pub_date"))
        prio_s = _int_date(r.get("priority_date"))
        meta_pairs: list[tuple[str, str]] = []
        if date_s:
            meta_pairs.append(("Pub Date", date_s))
        if prio_s:
            meta_pairs.append(("Priority", prio_s))
        if meta_pairs:
            draw_inline_meta(meta_pairs)

        # CPC
        if r.get("cpc"):
            draw_label_value("CPC", r.get("cpc"))

        # Abstract (use the label/value wrapper to handle wrapping)
        if r.get("abstract"):
            abstract = str(r.get("abstract")).replace("\n", " ")
            draw_label_value("Abstract", abstract)

        # horizontal separator between records
        _ensure_space()
        # draw a thin line and advance
        c.setLineWidth(0.5)
        c.line(margin, y, width - margin, y)
        y -= 12

    c.showPage()
    c.save()
    buffer.seek(0)
    headers = {
        "Content-Type": "application/pdf",
        "Content-Disposition": f"attachment; filename={filename}.pdf",
    }
    return StreamingResponse(buffer, headers=headers, media_type="application/pdf")


# ----------------------------- Stripe Webhooks -----------------------------


@app.post("/webhooks/stripe")
async def stripe_webhook(request: Request, conn: Conn) -> dict[str, str]:
    """Handle Stripe webhook events.

    This endpoint processes subscription lifecycle events from Stripe:
    - checkout.session.completed - New subscription created
    - customer.subscription.created - Subscription created
    - customer.subscription.updated - Subscription modified
    - customer.subscription.deleted - Subscription canceled
    - invoice.payment_succeeded - Payment succeeded
    - invoice.payment_failed - Payment failed

    The webhook signature is verified to ensure requests come from Stripe.
    All events are logged to subscription_event table for auditing.

    Note: This endpoint does NOT require authentication - Stripe sends
    webhooks directly and authenticates via signature verification.
    """
    # Verify webhook signature and parse event
    event = await verify_webhook_signature(request)

    # Process the event (idempotent - safe to call multiple times)
    await process_webhook_event(conn, event)

    return {"status": "success"}

# ----------------------------- GlitchTip Integration -----------------------------
@app.get("/glitchtip-debug")
async def trigger_error():
    try:
        division_by_zero = 1 / 0
        return {"result": division_by_zero}
    except Exception as e:
        logger.error(f"GlitchTip Debug Error: {e}")
        # Optionally, re-raise the error to be caught by GlitchTip
        raise
