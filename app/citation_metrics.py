from __future__ import annotations

import math
from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from .citation_models import (
    AssigneeEncroachmentSummary,
    EncroachmentTimelinePoint,
    ForwardImpactPoint,
    PatentImpactSummary,
    PatentRiskMetrics,
)


@dataclass
class ForwardTotals:
    total_citations: int
    distinct_citing: int
    velocity_values: list[float]


def _to_date(value: Any) -> date | None:
    """Normalize common date representations to `date`."""
    if value is None:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    s = f"{value:08d}" if isinstance(value, int) else str(value)
    try:
        if len(s) == 8 and s.isdigit():
            return datetime.strptime(s, "%Y%m%d").date()
        return datetime.fromisoformat(s).date()
    except Exception:
        return None


def _velocity_from_dates(first: date | None, last: date | None, count: int) -> float:
    """Estimate a per-month velocity from first/last citation dates."""
    if not first or not last or count <= 0:
        return 0.0
    span_days = max((last - first).days, 1)
    months = max(span_days / 30.0, 0.5)
    return round(count / months, 3)


def build_forward_timeline_points(rows: Iterable[dict[str, Any]], bucket: str) -> list[ForwardImpactPoint]:
    points: list[ForwardImpactPoint] = []
    for r in rows:
        b = _to_date(r.get("bucket_start"))
        if b is None:
            continue
        points.append(
            ForwardImpactPoint(
                bucket_start=b,
                citing_count=int(r.get("citing_count") or 0),
            )
        )
    return points


def build_patent_impact_summaries(rows: Iterable[dict[str, Any]]) -> list[PatentImpactSummary]:
    summaries: list[PatentImpactSummary] = []
    for r in rows:
        first = _to_date(r.get("first_citation_date"))
        last = _to_date(r.get("last_citation_date"))
        count = int(r.get("fwd_citation_count") or 0)
        summaries.append(
            PatentImpactSummary(
                pub_id=str(r.get("pub_id")),
                title=r.get("title") or "",
                assignee_name=r.get("assignee_name"),
                canonical_assignee_id=r.get("canonical_assignee_id"),
                pub_date=_to_date(r.get("pub_date")),
                fwd_citation_count=count,
                fwd_citation_velocity=_velocity_from_dates(first, last, count),
                first_citation_date=first,
                last_citation_date=last,
            )
        )
    return summaries


def compute_forward_totals(rows: Iterable[dict[str, Any]]) -> ForwardTotals:
    total_citations = 0
    distinct_citing = 0
    velocities: list[float] = []
    for r in rows:
        total_citations += int(r.get("citation_total") or r.get("citing_count") or 0)
        distinct_citing += int(r.get("citing_count") or 0)
        if "fwd_citation_velocity" in r:
            try:
                velocities.append(float(r["fwd_citation_velocity"]))
            except Exception:
                pass
    return ForwardTotals(total_citations=total_citations, distinct_citing=distinct_citing, velocity_values=velocities)


def compute_velocity_from_timeline(points: Sequence[EncroachmentTimelinePoint | ForwardImpactPoint]) -> float | None:
    if len(points) < 2:
        return None
    sorted_pts = sorted(points, key=lambda p: p.bucket_start)
    first_date = sorted_pts[0].bucket_start
    x_vals: list[float] = []
    y_vals: list[float] = []
    for p in sorted_pts:
        delta_months = (p.bucket_start - first_date).days / 30.0
        x_vals.append(delta_months)
        if isinstance(p, ForwardImpactPoint):
            y_vals.append(p.citing_count)
        else:
            y_vals.append(getattr(p, "citing_patent_count", 0))
    n = len(x_vals)
    mean_x = sum(x_vals) / n
    mean_y = sum(y_vals) / n
    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(x_vals, y_vals))
    denominator = sum((x - mean_x) ** 2 for x in x_vals) or 1.0
    slope = numerator / denominator
    return round(slope, 3)


def entropy(histogram: dict[str, int] | None) -> float:
    if not histogram:
        return 0.0
    counts = [v for v in histogram.values() if v]
    total = sum(counts)
    if total <= 0:
        return 0.0
    probs = [c / total for c in counts]
    return -sum(p * math.log(p, 2) for p in probs if p > 0)


def _top_share(histogram: dict[str, int] | None) -> float | None:
    if not histogram:
        return None
    counts = [v for v in histogram.values() if v]
    total = sum(counts)
    if total <= 0:
        return None
    return max(counts) / total


def _clamp_score(value: float, *, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def compute_risk_scores(row: dict[str, Any]) -> PatentRiskMetrics:
    fwd_total = int(row.get("fwd_total") or 0)
    fwd_from_comp = int(row.get("fwd_from_competitors") or 0)
    fwd_ratio = None
    if fwd_total > 0:
        fwd_ratio = round(fwd_from_comp / fwd_total, 4)

    cpc_hist = row.get("bwd_cpc_hist") or {}
    assignee_hist = row.get("bwd_assignee_hist") or {}
    cpc_entropy = entropy(cpc_hist) if cpc_hist else None
    cpc_top_share = _top_share(cpc_hist)
    assignee_top = _top_share(assignee_hist)
    diversity = None if assignee_top is None else round(1 - assignee_top, 4)

    exposure_score = _clamp_score(
        (math.log1p(fwd_total) / math.log1p(200)) * 70 + (fwd_ratio or 0.0) * 30
    )
    fragility_score = _clamp_score(((cpc_top_share or 0.0) * 60) + ((1 - (diversity or 0.0)) * 40))
    overall = _clamp_score(0.55 * exposure_score + 0.45 * fragility_score)

    return PatentRiskMetrics(
        pub_id=str(row.get("pub_id")),
        title=row.get("title") or "",
        assignee_name=row.get("assignee_name"),
        canonical_assignee_id=row.get("canonical_assignee_id"),
        pub_date=_to_date(row.get("pub_date")),
        fwd_total=fwd_total,
        fwd_from_competitors=fwd_from_comp,
        fwd_competitor_ratio=fwd_ratio,
        bwd_total=int(row.get("bwd_total") or 0),
        bwd_cpc_entropy=cpc_entropy,
        bwd_cpc_top_share=cpc_top_share,
        bwd_assignee_diversity=diversity,
        exposure_score=exposure_score,
        fragility_score=fragility_score,
        overall_risk_score=overall,
    )


def compute_encroachment_summaries(rows: list[dict[str, Any]]) -> list[AssigneeEncroachmentSummary]:
    grouped: dict[Any, list[EncroachmentTimelinePoint]] = defaultdict(list)
    for r in rows:
        pt = EncroachmentTimelinePoint(
            bucket_start=_to_date(r.get("bucket_start")) or date.today(),
            competitor_assignee_id=r.get("competitor_assignee_id"),
            competitor_assignee_name=r.get("competitor_assignee_name"),
            citing_patent_count=int(r.get("citing_patent_count") or 0),
        )
        grouped[(pt.competitor_assignee_id, pt.competitor_assignee_name)].append(pt)

    totals = {key: sum(p.citing_patent_count for p in pts) for key, pts in grouped.items()}
    max_total = max(totals.values() or [0]) or 1
    summaries: list[AssigneeEncroachmentSummary] = []
    for (comp_id, comp_name), points in grouped.items():
        total = totals[(comp_id, comp_name)]
        velocity = compute_velocity_from_timeline(points)
        encroachment_score = _clamp_score((total / max_total) * 70 + (velocity or 0.0) * 30)
        summaries.append(
            AssigneeEncroachmentSummary(
                competitor_assignee_id=comp_id,
                competitor_assignee_name=comp_name,
                total_citing_patents=total,
                encroachment_score=encroachment_score,
                velocity=velocity,
            )
        )
    summaries.sort(key=lambda s: s.encroachment_score, reverse=True)
    return summaries
