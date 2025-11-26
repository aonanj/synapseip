from __future__ import annotations

from datetime import date
from typing import Annotated

import psycopg
from fastapi import APIRouter, Depends

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
