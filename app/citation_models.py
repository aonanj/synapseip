from __future__ import annotations

from datetime import date
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel

BucketGranularity = Literal["month", "quarter"]


class CitationScope(BaseModel):
    focus_pub_ids: list[str] | None = None
    focus_assignee_ids: list[UUID] | None = None
    focus_assignee_names: list[str] | None = None
    filters: dict[str, Any] | None = None

    citing_pub_date_from: date | None = None
    citing_pub_date_to: date | None = None

    bucket: BucketGranularity = "month"


class ForwardImpactRequest(BaseModel):
    scope: CitationScope
    top_n: int = 50


class ForwardImpactPoint(BaseModel):
    bucket_start: date
    citing_count: int


class PatentImpactSummary(BaseModel):
    pub_id: str
    title: str
    assignee_name: str | None
    canonical_assignee_id: UUID | None
    pub_date: date | None
    fwd_citation_count: int
    fwd_citation_velocity: float
    first_citation_date: date | None
    last_citation_date: date | None


class ForwardImpactResponse(BaseModel):
    scope_description: dict[str, Any]
    total_forward_citations: int
    distinct_citing_patents: int
    timeline: list[ForwardImpactPoint]
    top_patents: list[PatentImpactSummary]


class DependencyMatrixRequest(BaseModel):
    scope: CitationScope
    min_citations: int = 5
    normalize: bool = True


class DependencyEdge(BaseModel):
    citing_assignee_id: UUID | None
    citing_assignee_name: str | None
    cited_assignee_id: UUID | None
    cited_assignee_name: str | None
    citation_count: int
    citing_to_cited_pct: float | None


class DependencyMatrixResponse(BaseModel):
    edges: list[DependencyEdge]


class RiskRadarRequest(BaseModel):
    scope: CitationScope
    competitor_assignee_ids: list[UUID] | None = None
    competitor_assignee_names: list[str] | None = None
    top_n: int = 200


class PatentRiskMetrics(BaseModel):
    pub_id: str
    title: str
    assignee_name: str | None
    canonical_assignee_id: UUID | None
    pub_date: date | None

    fwd_total: int
    fwd_from_competitors: int
    fwd_competitor_ratio: float | None

    bwd_total: int
    bwd_cpc_entropy: float | None
    bwd_cpc_top_share: float | None
    bwd_assignee_diversity: float | None

    exposure_score: float
    fragility_score: float
    overall_risk_score: float


class RiskRadarResponse(BaseModel):
    patents: list[PatentRiskMetrics]


class EncroachmentRequest(BaseModel):
    target_assignee_ids: list[UUID] | None = None
    target_assignee_names: list[str] | None = None
    competitor_assignee_ids: list[UUID] | None = None
    competitor_assignee_names: list[str] | None = None
    citing_pub_date_from: date | None = None
    citing_pub_date_to: date | None = None
    bucket: BucketGranularity = "quarter"


class EncroachmentTimelinePoint(BaseModel):
    bucket_start: date
    competitor_assignee_id: UUID | None
    competitor_assignee_name: str | None
    citing_patent_count: int


class AssigneeEncroachmentSummary(BaseModel):
    competitor_assignee_id: UUID | None
    competitor_assignee_name: str | None
    total_citing_patents: int
    encroachment_score: float
    velocity: float | None


class EncroachmentResponse(BaseModel):
    target_assignee_ids: list[UUID]
    timeline: list[EncroachmentTimelinePoint]
    competitors: list[AssigneeEncroachmentSummary]
