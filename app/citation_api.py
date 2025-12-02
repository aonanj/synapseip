from __future__ import annotations

import importlib.util
from datetime import date
from io import BytesIO
from typing import Annotated

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from infrastructure.logger import get_logger

from .auth import get_current_user
from .citation_metrics import (
    build_forward_timeline_points,
    build_patent_impact_summaries,
    compute_encroachment_summaries,
    compute_forward_totals,
    compute_risk_scores,
)
from .citation_models import (
    DependencyEdge,
    DependencyMatrixRequest,
    DependencyMatrixResponse,
    EncroachmentRequest,
    EncroachmentResponse,
    EncroachmentTimelinePoint,
    ForwardImpactRequest,
    ForwardImpactResponse,
    RiskRadarExportRequest,
    RiskRadarRequest,
    RiskRadarResponse,
)
from .db import get_conn
from .repository_citation import (
    get_cross_assignee_dependency_matrix,
    get_encroachment_timeline,
    get_forward_citation_summary,
    get_forward_citation_timeline,
    get_risk_raw_metrics,
    resolve_assignee_ids_by_name,
    resolve_portfolio_pub_ids,
)
from .subscription_middleware import ActiveSubscription

logger = get_logger()

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

router = APIRouter(
    prefix="/citation",
    tags=["citation"],
    dependencies=[Depends(get_current_user)],
)

Conn = Annotated[psycopg.AsyncConnection, Depends(get_conn)]


@router.post("/impact", response_model=ForwardImpactResponse)
async def get_forward_impact(req: ForwardImpactRequest, conn: Conn, user: ActiveSubscription):
    portfolio_pub_ids = await resolve_portfolio_pub_ids(conn, req.scope)

    timeline_rows = await get_forward_citation_timeline(conn, portfolio_pub_ids, req.scope)
    patent_rows = await get_forward_citation_summary(conn, portfolio_pub_ids, req.top_n)

    timeline = build_forward_timeline_points(timeline_rows, req.scope.bucket)
    top_patents = build_patent_impact_summaries(patent_rows)
    totals = compute_forward_totals(timeline_rows)

    return ForwardImpactResponse(
        scope_description={"pub_ids": portfolio_pub_ids, "filters": req.scope.filters},
        total_forward_citations=totals.total_citations,
        distinct_citing_patents=totals.distinct_citing,
        timeline=timeline,
        top_patents=top_patents,
    )


@router.post("/dependency-matrix", response_model=DependencyMatrixResponse)
async def get_dependency_matrix(req: DependencyMatrixRequest, conn: Conn, user: ActiveSubscription):
    portfolio_pub_ids = await resolve_portfolio_pub_ids(conn, req.scope)

    rows = await get_cross_assignee_dependency_matrix(
        conn,
        portfolio_pub_ids=portfolio_pub_ids,
        min_citations=req.min_citations,
        normalize=req.normalize,
    )

    edges = [DependencyEdge(**r) for r in rows]
    return DependencyMatrixResponse(edges=edges)


@router.post("/risk-radar", response_model=RiskRadarResponse)
async def get_risk_radar(req: RiskRadarRequest, conn: Conn, user: ActiveSubscription):
    portfolio_pub_ids = await resolve_portfolio_pub_ids(conn, req.scope)
    competitor_ids = req.competitor_assignee_ids or []
    if not competitor_ids and req.competitor_assignee_names:
        competitor_ids = await resolve_assignee_ids_by_name(conn, req.competitor_assignee_names)
    rows = await get_risk_raw_metrics(
        conn,
        portfolio_pub_ids=portfolio_pub_ids,
        competitor_assignee_ids=competitor_ids or None,
        limit=req.top_n,
    )
    patents = [compute_risk_scores(r) for r in rows]
    return RiskRadarResponse(patents=patents)


@router.post("/risk-radar/export")
async def export_risk_radar(req: RiskRadarExportRequest, conn: Conn, user: ActiveSubscription):
    if not HAVE_REPORTLAB:
        logger.error("PDF export requested but reportlab is not installed")
        raise HTTPException(status_code=500, detail="PDF generation not available on server")

    portfolio_pub_ids = await resolve_portfolio_pub_ids(conn, req.scope)
    competitor_ids = req.competitor_assignee_ids or []
    if not competitor_ids and req.competitor_assignee_names:
        competitor_ids = await resolve_assignee_ids_by_name(conn, req.competitor_assignee_names)

    rows = await get_risk_raw_metrics(
        conn,
        portfolio_pub_ids=portfolio_pub_ids,
        competitor_assignee_ids=competitor_ids or None,
        limit=req.top_n,
    )
    patents = [compute_risk_scores(r) for r in rows]

    sort_by = req.sort_by or "overall"
    sort_map = {
        "overall": lambda p: p.overall_risk_score,
        "exposure": lambda p: p.exposure_score,
        "fragility": lambda p: p.fragility_score,
        "fwd": lambda p: p.fwd_total,
    }
    key_func = sort_map.get(sort_by, sort_map["overall"])
    patents.sort(key=key_func, reverse=True)

    buffer = BytesIO()
    c = _CANVAS.Canvas(buffer, pagesize=_LETTER)  # type: ignore[union-attr]
    width, height = _LETTER  # type: ignore[assignment]
    margin = 40
    y = height - margin

    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin, y, "SynapseIP – Risk Radar")
    y -= 18

    sort_label = {
        "overall": "Overall risk",
        "exposure": "Exposure",
        "fragility": "Fragility",
        "fwd": "Forward citations",
    }.get(sort_by, "Overall risk")
    c.setFont("Helvetica", 9)
    c.drawString(
        margin,
        y,
        f"Top {len(patents)} of {req.top_n} requested • Sort: {sort_label}",
    )
    y -= 16

    def _ensure_space(font_name: str | None = None, font_size: int | None = None):
        nonlocal y
        if y < 60:
            c.showPage()
            y = height - margin
            if font_name and font_size:
                c.setFont(font_name, font_size)

    def _wrap_lines(text: str, font: str, size: int, max_width: float) -> list[str]:
        words = text.split()
        lines: list[str] = []
        current = ""
        for w in words:
            candidate = (current + " " + w).strip()
            if c.stringWidth(candidate, font, size) <= max_width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = w
        if current:
            lines.append(current)
        return lines

    def draw_label_value(
        label: str,
        value: str | None,
        *,
        label_font: str = "Helvetica-Bold",
        label_size: int = 9,
        value_font: str = "Helvetica",
        value_size: int = 9,
    ):
        nonlocal y
        if not value:
            return
        _ensure_space()
        c.setFont(label_font, label_size)
        c.drawString(margin, y, f"{label}:")
        y -= 12
        _ensure_space(value_font, value_size)
        c.setFont(value_font, value_size)
        max_width = width - margin * 2
        for line in _wrap_lines(value, value_font, value_size, max_width):
            c.drawString(margin, y, line)
            y -= 12

    scope_filters = req.scope.filters or {}
    draw_label_value("Source assignee(s)", ", ".join(req.scope.focus_assignee_names or []))
    draw_label_value("Patent/Pub #s", ", ".join(req.scope.focus_pub_ids or []))
    draw_label_value("Keyword filter", str(scope_filters.get("keyword") or "") or None)
    draw_label_value("CPC filter", str(scope_filters.get("cpc") or "") or None)
    draw_label_value("Citing assignee filter", str(scope_filters.get("assignee") or "") or None)
    if req.scope.citing_pub_date_from or req.scope.citing_pub_date_to:
        draw_label_value(
            "Citing pub date",
            f"{req.scope.citing_pub_date_from or '—'} – {req.scope.citing_pub_date_to or '—'}",
        )
    if req.competitor_assignee_names:
        draw_label_value("Target assignee(s)", ", ".join(req.competitor_assignee_names))
    draw_label_value("Time bucket", req.scope.bucket)
    draw_label_value("Top N", str(req.top_n))
    draw_label_value("Sort", sort_label)

    if not patents:
        draw_label_value("Note", "No patents matched the current risk radar scope.")

    def fmt_pct(val: float | None) -> str:
        return f"{val * 100:.1f}%" if val is not None else "—"

    for idx, p in enumerate(patents, start=1):
        draw_label_value("Patent/Pub No", f"{idx}. {p.pub_id}", label_size=10)
        draw_label_value("Title", str(p.title).title())
        draw_label_value("Assignee", p.assignee_name)
        draw_label_value(
            "Forward citations",
            f"{p.fwd_total} (from target assignees: {p.fwd_from_competitors}; share {fmt_pct(p.fwd_competitor_ratio)})",
        )
        draw_label_value("Backward citations", str(p.bwd_total))
        draw_label_value("Exposure score", f"{p.exposure_score:.1f}")
        draw_label_value("Fragility score", f"{p.fragility_score:.1f}")
        draw_label_value("Overall risk score", f"{p.overall_risk_score:.1f}")
        _ensure_space()
        c.setLineWidth(0.5)
        c.line(margin, y, width - margin, y)
        y -= 10

    c.showPage()
    c.save()
    buffer.seek(0)
    headers = {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=risk_radar.pdf",
    }
    return StreamingResponse(buffer, headers=headers, media_type="application/pdf")


@router.post("/encroachment", response_model=EncroachmentResponse)
async def get_encroachment(req: EncroachmentRequest, conn: Conn, user: ActiveSubscription):
    target_ids = req.target_assignee_ids or []
    if not target_ids and req.target_assignee_names:
        target_ids = await resolve_assignee_ids_by_name(conn, req.target_assignee_names)

    competitor_ids = req.competitor_assignee_ids or []
    if not competitor_ids and req.competitor_assignee_names:
        competitor_ids = await resolve_assignee_ids_by_name(conn, req.competitor_assignee_names)

    timeline_rows = await get_encroachment_timeline(
        conn,
        target_assignee_ids=target_ids,
        competitor_assignee_ids=competitor_ids or None,
        from_date=req.citing_pub_date_from,
        to_date=req.citing_pub_date_to,
        bucket=req.bucket,
    )

    summaries = compute_encroachment_summaries(timeline_rows)

    return EncroachmentResponse(
        target_assignee_ids=target_ids,
        timeline=[
            EncroachmentTimelinePoint(
                bucket_start=r.get("bucket_start") or date.today(),
                competitor_assignee_id=r.get("competitor_assignee_id"),
                competitor_assignee_name=r.get("competitor_assignee_name"),
                citing_patent_count=r.get("citing_patent_count") or 0,
            )
            for r in timeline_rows
        ],
        competitors=summaries,
    )
