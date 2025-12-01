from __future__ import annotations

import calendar
import inspect
import json
import math
import os
import re
import time
import uuid
from collections import Counter, defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from difflib import SequenceMatcher
from typing import Annotated, Any, Literal

import igraph as ig
import leidenalg as la
import numpy as np
import psycopg
import umap
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from numpy.typing import NDArray
from psycopg import sql as _sql
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from pydantic import BaseModel, Field
from sklearn.neighbors import NearestNeighbors

from infrastructure.logger import get_logger

from .auth import get_current_user
from .db import get_conn
from .db_errors import is_recoverable_operational_error
from .embed import embed as embed_text
from .overview_signals import (
    SignalComputation,
    SignalKind,
    signal_bridge,
    signal_crowd_out,
    signal_emerging_gap,
    signal_focus_shift,
)
from .repository import CANONICAL_ASSIGNEE_LATERAL, SEARCH_EXPR
from .subscription_middleware import SubscriptionRequiredError

router = APIRouter(
    prefix="/overview",
    tags=["overview"],
    dependencies=[Depends(get_current_user)],
)

User = Annotated[dict, Depends(get_current_user)]
AsyncConn = Annotated[psycopg.AsyncConnection, Depends(get_conn)]

logger = get_logger()

def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        logger.warning("Invalid %s=%r; using default %s", name, raw, default)
        return default

MAX_GRAPH_LIMIT = 2000
MAX_GRAPH_NEIGHBORS = 50
MAX_GRAPH_LAYOUT_NEIGHBORS = 50

_semantic_dist_cap = _env_float("OVERVIEW_SEMANTIC_DIST_CAP", 0.9)
OVERVIEW_SEMANTIC_DIST_CAP = math.inf if _semantic_dist_cap <= 0 else _semantic_dist_cap
OVERVIEW_SEMANTIC_SPREAD = max(0.0, _env_float("OVERVIEW_SEMANTIC_SPREAD", 0.35))
OVERVIEW_SEMANTIC_JUMP = max(0.0, _env_float("OVERVIEW_SEMANTIC_JUMP", 0.1))

SearchMode = Literal["keywords", "assignee"]
GroupKind = Literal["assignee", "cluster"]

_VECTOR_TYPE = os.getenv("VECTOR_TYPE", "vector").lower()
_VEC_CAST = "::halfvec" if _VECTOR_TYPE.startswith("half") else "::vector"

ASSIGNEE_FUZZY_THRESHOLD = 0.80
ASSIGNEE_MATCH_LIMIT = 12
_ASSIGNEE_RAW_SUFFIXES = [
    "INC",
    "LLC",
    "CORP",
    "LTD",
    "CORPORATION",
    "INCORPORATED",
    "INCORP",
    "COMPANY",
    "LIMITED",
    "GMBH",
    "ASS",
    "PTY",
    "MFF",
    "SYS",
    "MAN",
    "L Y",
    "L P",
    "LY",
    "LP",
    "OY",
    "NV",
    "SAS",
    "CO",
    "BV",
    "AG",
    "A G",
    "A B",
    "O Y",
    "N V",
    "S E",
    "N A",
    "MANF",
    "INST",
    "B V",
    "INT",
    "IND",
    "KK",
    "SE",
    "AB",
    "INTL",
    "INDST",
    "NA",
]
_ASSIGNEE_SUFFIXES: list[str] = sorted(
    list(dict.fromkeys(s.strip().upper() for s in _ASSIGNEE_RAW_SUFFIXES if s.strip())),
    key=len,
    reverse=True,
)

CLUSTER_TERM_SAMPLE_SIZE = 20
CLUSTER_LABEL_MIN_TERMS = 3
CLUSTER_LABEL_MAX_TERMS = 8
CLUSTER_LABEL_MIN_LENGTH = 5
CLUSTER_LABEL_COMMON_TERM_RATIO = 0.7
CLUSTER_LABEL_STOPWORDS: set[str] = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "into",
    "that",
    "this",
    "those",
    "these",
    "their",
    "there",
    "where",
    "when",
    "which",
    "about",
    "using",
    "based",
    "system",
    "systems",
    "method",
    "methods",
    "device",
    "devices",
    "apparatus",
    "apparatuses",
    "process",
    "processes",
    "module",
    "modules",
    "unit",
    "units",
    "network",
    "networks",
    "data",
    "information",
    "control",
    "controlled",
    "controls",
    "application",
    "applications",
    "computer",
    "computers",
    "program",
    "programs",
    "sensor",
    "sensors",
    "analysis",
    "analyzing",
    "electric",
    "electrical",
    "component",
    "components",
    "circuit",
    "circuitry",
    "user",
    "users",
    "plurality",
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
    "eighth",
    "ninth",
    "tenth",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "may",
    "can",
    "could",
    "would",
    "should",
    "shall",
    "will",
    "within",
    "wherein",
    "thereof",
    "herein",
    "configured",
    "configuring",
    "configure",
    "includes",
    "include",
    "including",
    "included",
    "used",
    "associated",
    "association",
    "associations",
    "comprise",
    "comprises",
    "comprising",
    "composed",
    "relate",
    "related",
    "relates",
    "relating",
    "provide",
    "provides",
    "providing",
    "provided",
    "via",
    "onto",
    "across",
    "among",
    "amongst",
    "toward",
    "towards",
    "between",
    "therein",
    "therefrom",
    "thereafter",
    "therewith",
    "hereafter",
    "allows",
    "allow",
    "allowing",
    "permit",
    "permits",
    "permitting",
    "enable",
    "enables",
    "enabling",
    "enabled",
    "cause",
    "causes",
    "causing",
    "caused",
    "being",
    "further",
    "regarding",
    "having",
    "has",
    "after",
    "possible",
    "potential",
    "different",
    "least",
    "through",
    "other"
}
CLUSTER_LABEL_STEM_STOPWORDS: tuple[str, ...] = (
    "algorithm",
    "algorith",
    "associ",
    "artific",
    "calcul",
    "comput",
    "configur",
    "determin",
    "includ",
    "intellig",
    "machin",
    "model",
    "process",
    "relat",
    "technolog",
    "utiliz",
    "employ",
    "provid",
    "addition",
    "compris",
    "generat",
    "hav",
    "identifi",
    "identify",
    "implement",
    "operat",
    "involv",
    "obtain",
    "describ",
    "detect",
    "disclos",
    "apply",
    "analyz",
    "vari",
    "exampl",
    "specif",
    "particul",
    "aspect",
    "illustrat",
    "embodiment",
    "aspect",
    "consequen",
    "benefi",
    "train",
    "permit",
    "allow",
    "enabl",
    "caus",
)


def _is_allowed_cluster_term(token: str) -> bool:
    """Return True when a token can be used in cluster labels.
    
    This function filters out:
    - Empty or very short tokens
    - Pure numeric tokens
    - Exact matches in CLUSTER_LABEL_STOPWORDS (case-insensitive)
    - Tokens that start with any stem in CLUSTER_LABEL_STEM_STOPWORDS
    """
    print("Checking token for cluster term allowance: %s", token)
    if not token:
        print("Token is empty or None.")
        return False
    normalized = token.lower().strip()
    if not normalized:
        print("Token is empty after stripping.")
        return False
    if len(normalized) < CLUSTER_LABEL_MIN_LENGTH:
        print(f"Token {normalized} is too short.")
        return False
    if normalized.isdigit():
        print(f"Token {normalized} is purely numeric.")
        return False
    # Exact match check (case-insensitive)
    for stopword in CLUSTER_LABEL_STOPWORDS:
        if normalized == stopword:
            print(f"Token {normalized} is a stopword.")
            return False
    for stem in CLUSTER_LABEL_STEM_STOPWORDS:
        if normalized.startswith(stem):
            print(f"Token {normalized} starts with stopword stem {stem}.")
            return False
    print(f"Token {normalized} is allowed.")
    return True

# --- DB pool ---
_DB_URL = os.getenv("DATABASE_URL")
_pool: ConnectionPool | None = None
_MAX_DB_RETRIES = 5


def _reset_pool(bad_pool: ConnectionPool | None) -> None:
    global _pool
    if bad_pool is None:
        return
    try:
        bad_pool.close()
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception("Error closing overview pool after failure: %s", exc)
    finally:
        _pool = None


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        if not _DB_URL:
            raise RuntimeError("DATABASE_URL not set")
        _pool = ConnectionPool(conninfo=_DB_URL, min_size=1, max_size=4, kwargs={"autocommit": False})
    return _pool
_HAVE_LEIDEN = True
_HAVE_UMAP = True


@dataclass(frozen=True, slots=True)
class EmbeddingMeta:
    """Metadata for a single embedding row used to build the graph."""

    pub_id: str
    is_focus: bool
    pub_date: date | None
    assignee: str | None
    title: str | None
    abstract: str | None


@dataclass(slots=True)
class NodeDatum:
    """Derived metrics per node to power signal aggregation."""

    index: int
    pub_id: str
    assignee: str
    pub_date: date | None
    cluster_id: int
    score: float
    density: float
    proximity: float
    distance: float
    momentum: float
    is_focus: bool
    title: str | None
    abstract: str | None


def _remove_punct_and_collapse(value: str) -> str:
    cleaned = re.sub(r"[^0-9A-Za-z]+", " ", value)
    return " ".join(cleaned.split()).upper()


def _canonicalize_assignee_for_lookup(name: str) -> str:
    if not name:
        return ""
    tokens = _remove_punct_and_collapse(name).split()
    if not tokens:
        return ""
    changed = True
    while changed and tokens:
        changed = False
        tail = " ".join(tokens[-2:]) if len(tokens) >= 2 else tokens[-1]
        for suffix in _ASSIGNEE_SUFFIXES:
            if " " in suffix:
                parts = suffix.split()
                n = len(parts)
                if n <= len(tokens) and " ".join(tokens[-n:]) == suffix:
                    tokens = tokens[:-n]
                    changed = True
                    break
            else:
                if tokens and tokens[-1] == suffix:
                    tokens = tokens[:-1]
                    changed = True
                    break
    return " ".join(tokens).strip()


def _assignee_search_patterns(raw: str, canonical: str) -> list[str]:
    patterns: list[str] = []
    trimmed = raw.strip()
    if trimmed:
        patterns.append(f"%{trimmed}%")
    for token in canonical.split():
        if len(token) >= 3:
            patterns.append(f"%{token}%")
    if canonical and canonical not in {p.strip("%") for p in patterns}:
        patterns.append(f"%{canonical}%")
    seen: set[str] = set()
    ordered: list[str] = []
    for pattern in patterns:
        if pattern not in seen:
            ordered.append(pattern)
            seen.add(pattern)
    return ordered[:24]


def _tokenize_cluster_terms(text: str | None) -> Iterable[str]:
    """Extract and filter tokens from text for cluster labeling.
    
    Only yields tokens that pass the _is_allowed_cluster_term filter.
    """
    if not text:
        return []
    for token in re.findall(r"[A-Za-z0-9]+", text.lower()):
        # Apply filtering at the source to ensure consistency
        if _is_allowed_cluster_term(token):
            yield token


def _compute_cluster_term_map(node_data: Sequence[NodeDatum]) -> dict[int, list[str]]:
    """Compute distinctive terms for each cluster, excluding common stopwords.
    
    This function:
    1. Groups nodes by cluster
    2. Samples top nodes from each cluster
    3. Extracts and counts terms from titles and abstracts
    4. Filters out universal terms and stopwords
    5. Returns the most distinctive terms per cluster
    """
    clusters: dict[int, list[NodeDatum]] = defaultdict(list)
    for node in node_data:
        clusters[node.cluster_id].append(node)
    cluster_terms: dict[int, list[str]] = {}
    cluster_token_counts: dict[int, Counter[str]] = {}
    for cluster_id, nodes in clusters.items():
        sorted_nodes = sorted(
            nodes,
            key=lambda n: (-(n.score if n.score is not None else 0.0), n.pub_id),
        )[:CLUSTER_TERM_SAMPLE_SIZE]
        counter: Counter[str] = Counter()
        for node in sorted_nodes:
            for token in _tokenize_cluster_terms(node.title):
                counter[token] += 1
            for token in _tokenize_cluster_terms(node.abstract):
                counter[token] += 1
        if counter:
            cluster_token_counts[cluster_id] = counter

    if not cluster_token_counts:
        return cluster_terms

    coverage: Counter[str] = Counter()
    for counter in cluster_token_counts.values():
        for token in counter:
            coverage[token] += 1

    cluster_count = len(cluster_token_counts)
    if cluster_count <= 2:
        threshold = cluster_count
    else:
        threshold = max(2, math.ceil(cluster_count * CLUSTER_LABEL_COMMON_TERM_RATIO))

    universal_tokens: set[str] = {token for token, count in coverage.items() if count >= threshold}
    for cluster_id, counter in cluster_token_counts.items():
        ordered_terms: list[str] = []
        for term, _ in counter.most_common():
            present = 0
            if term not in ordered_terms and term not in universal_tokens and _is_allowed_cluster_term(term):
                for ot in ordered_terms:
                    if term.startswith(ot) or ot.startswith(term):
                        present = 1
                        break
                if present == 0:
                    ordered_terms.append(term)
            if len(ordered_terms) >= CLUSTER_LABEL_MAX_TERMS:
                break
        cluster_terms[cluster_id] = ordered_terms
    return cluster_terms


def _format_label_terms(terms: Sequence[str]) -> str:
    formatted = [" ".join(t.split()).title() for t in terms if t]
    return ", ".join(formatted)


def _match_canonical_assignees(
    conn: psycopg.Connection,
    query: str,
    *,
    threshold: float = ASSIGNEE_FUZZY_THRESHOLD,
    limit: int = ASSIGNEE_MATCH_LIMIT,
) -> tuple[list[uuid.UUID], list[str], list[tuple[str, float]]]:
    canonical = _canonicalize_assignee_for_lookup(query)
    if not canonical:
        return [], [], []
    patterns = _assignee_search_patterns(query, canonical)
    if not patterns:
        return [], [], []

    candidates: dict[str, tuple[str, float]] = {}

    def _score(name: str) -> float:
        canonical_candidate = _canonicalize_assignee_for_lookup(name)
        if not canonical_candidate:
            return 0.0
        ratio_primary = SequenceMatcher(None, canonical, canonical_candidate).ratio()
        ratio_compact = SequenceMatcher(
            None,
            canonical.replace(" ", ""),
            canonical_candidate.replace(" ", ""),
        ).ratio()
        return max(ratio_primary, ratio_compact)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, canonical_assignee_name AS label
            FROM canonical_assignee_name
            WHERE canonical_assignee_name ILIKE ANY(%s)
            ORDER BY char_length(canonical_assignee_name)
            LIMIT %s
            """,
            (patterns, max(limit * 5, limit)),
        )
        for row in cur:
            cid = str(row["id"])
            label = str(row["label"])
            score = _score(label)
            prev = candidates.get(cid)
            if prev is None or score > prev[1]:
                candidates[cid] = (label, score)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT DISTINCT can.id, can.canonical_assignee_name AS label
            FROM assignee_alias alias
            JOIN canonical_assignee_name can ON can.id = alias.canonical_id
            WHERE alias.assignee_alias ILIKE ANY(%s)
            ORDER BY can.canonical_assignee_name
            LIMIT %s
            """,
            (patterns, max(limit * 5, limit)),
        )
        for row in cur:
            cid = str(row["id"])
            label = str(row["label"])
            score = _score(label)
            prev = candidates.get(cid)
            if prev is None or score > prev[1]:
                candidates[cid] = (label, score)

    scored = [
        (cid, label, score)
        for cid, (label, score) in candidates.items()
        if score >= threshold
    ]
    scored.sort(key=lambda item: (-item[2], len(item[1]), item[1]))

    matched_ids: list[uuid.UUID] = []
    matched_labels: list[str] = []
    matched_debug: list[tuple[str, float]] = []
    for cid, label, score in scored[:limit]:
        try:
            matched_ids.append(uuid.UUID(cid))
            matched_labels.append(label)
            matched_debug.append((label, score))
        except ValueError:
            continue
    return matched_ids, matched_labels, matched_debug


SIGNAL_LABELS: dict[SignalKind, str] = {
    "focus_shift": "Convergence Toward Focus Area",
    "emerging_gap": "Focus Area With Neighbor Underdevelopment",
    "crowd_out": "Sharply Rising Density Near Focus Area",
    "bridge": "Neighbor Linking Potential Near Focus Area",
}
SIGNAL_ORDER: tuple[SignalKind, ...] = ("emerging_gap", "bridge", "crowd_out", "focus_shift")

def pick_model(conn: psycopg.Connection, preferred: str | None = None) -> str:
    """Choose an available embedding model.

    Preference order:
    1) If `preferred` provided and exists, use it.
    2) Any model matching '%|ta' with the highest row count.
    3) Fallback: the model with the highest row count overall.
    """
    with conn.cursor() as cur:
        if preferred:
            cur.execute("SELECT 1 FROM patent_embeddings WHERE model = %s LIMIT 1", (preferred,))
            if cur.fetchone():
                return preferred

        cur.execute(
            """
            SELECT model
            FROM patent_embeddings
            WHERE model LIKE '%%|ta'
            GROUP BY model
            ORDER BY COUNT(*) DESC
            LIMIT 1
            """
        )
        row = cur.fetchone()
        if row and row[0]:
            return str(row[0])

        cur.execute(
            """
            SELECT model
            FROM patent_embeddings
            GROUP BY model
            ORDER BY COUNT(*) DESC
            LIMIT 1
            """
        )
        row2 = cur.fetchone()
        if not row2 or not row2[0]:
            raise HTTPException(400, "No embeddings available in the database.")
        return str(row2[0])

# --- Request and response models ---
class GraphRequest(BaseModel):
    date_from: str | None = Field(None, description="YYYY-MM-DD")
    date_to: str | None = Field(None, description="YYYY-MM-DD")
    neighbors: int = Field(
        15,
        ge=1,
        le=MAX_GRAPH_NEIGHBORS,
        description=f"KNN neighbor count (1-{MAX_GRAPH_NEIGHBORS}).",
    )
    resolution: float = 0.5
    alpha: float = 0.8
    beta: float = 0.5
    limit: int = Field(
        MAX_GRAPH_LIMIT,
        ge=1,
        le=MAX_GRAPH_LIMIT,
        description=f"Maximum rows pulled from embeddings (1-{MAX_GRAPH_LIMIT}).",
    )
    focus_keywords: list[str] = []
    focus_cpc_like: list[str] = []
    search_mode: SearchMode = Field(
        "keywords",
        description="Toggle between keyword-driven scope and assignee-driven scope.",
    )
    assignee_query: str | None = Field(
        None,
        description="Raw assignee text when search_mode='assignee'.",
    )
    layout: bool = True          # compute 2D layout for graph response
    layout_min_dist: float = 0.1 # UMAP param
    layout_neighbors: int = Field(
        25,
        ge=2,
        le=MAX_GRAPH_LAYOUT_NEIGHBORS,
        description=f"Neighborhood size for layout (2-{MAX_GRAPH_LAYOUT_NEIGHBORS}).",
    )   # UMAP param
    debug: bool = False


def _validate_graph_params(req: GraphRequest) -> None:
    violations: list[str] = []
    if not 1 <= req.limit <= MAX_GRAPH_LIMIT:
        violations.append(f"limit must be between 1 and {MAX_GRAPH_LIMIT}")
    if not 1 <= req.neighbors <= MAX_GRAPH_NEIGHBORS:
        violations.append(f"neighbors must be between 1 and {MAX_GRAPH_NEIGHBORS}")
    if not 2 <= req.layout_neighbors <= MAX_GRAPH_LAYOUT_NEIGHBORS:
        violations.append(
            f"layout_neighbors must be between 2 and {MAX_GRAPH_LAYOUT_NEIGHBORS}"
        )
    if req.search_mode == "assignee":
        if not req.assignee_query or not req.assignee_query.strip():
            violations.append("assignee_query is required when search_mode='assignee'")
    if violations:
        raise HTTPException(status_code=400, detail=violations)


class GraphNode(BaseModel):
    id: str
    cluster_id: int
    assignee: str | None = None
    x: float
    y: float
    signals: list[SignalKind] = Field(default_factory=list)
    relevance: float = 0.0
    title: str | None = None
    tooltip: str | None = None
    pub_date: date | None = None
    overview_score: float | None = None
    local_density: float | None = None
    abstract: str | None = None


class GraphEdge(BaseModel):
    source: str
    target: str
    weight: float


class GraphContext(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class SignalPayload(BaseModel):
    type: SignalKind
    status: Literal["none", "weak", "medium", "strong"]
    confidence: float = Field(ge=0.0, le=1.0)
    why: str
    node_ids: list[str] = Field(default_factory=list)
    debug: dict[str, float] | None = None


class AssigneeSignals(BaseModel):
    assignee: str
    k: str
    signals: list[SignalPayload]
    summary: str | None = None
    debug: dict[str, Any] | None = None
    cluster_id: int | None = None
    group_kind: GroupKind = "assignee"
    label_terms: list[str] | None = None


class OverviewResponse(BaseModel):
    k: str
    assignees: list[AssigneeSignals]
    graph: GraphContext | None = None
    debug: dict[str, Any] | None = None
    group_mode: GroupKind = "assignee"
    matched_assignees: list[str] | None = None


class DensityMetrics(BaseModel):
    mean_per_month: float
    min_per_month: int
    max_per_month: int


class MomentumPoint(BaseModel):
    month: str
    count: int
    top_assignee: str | None = None
    top_assignee_count: int | None = None


class MomentumMetrics(BaseModel):
    slope: float
    cagr: float | None = None
    bucket: Literal["Up", "Flat", "Down"]
    series: list[MomentumPoint] = Field(default_factory=list)


class CrowdingMetrics(BaseModel):
    exact: int
    semantic: int
    total: int
    density_per_month: float
    percentile: float | None = None


class RecencyMetrics(BaseModel):
    m6: int
    m12: int
    m24: int


class CpcBreakdownItem(BaseModel):
    cpc: str
    count: int


class IPOverviewResponse(BaseModel):
    crowding: CrowdingMetrics
    density: DensityMetrics
    momentum: MomentumMetrics
    top_cpcs: list[CpcBreakdownItem]
    cpc_breakdown: list[CpcBreakdownItem]
    recency: RecencyMetrics
    timeline: list[MomentumPoint]
    window_months: int

# --- Utilities ---
def _to_int_date(s: str | None) -> int | None:
    if not s:
        return None
    y, m, d = s.split("-")
    return int(f"{y}{m}{d}")


def _from_int_date(value: int | None) -> date | None:
    """Convert an integer YYYYMMDD date into a `date`."""
    if value is None:
        return None
    s = f"{value:08d}"
    try:
        return date(int(s[:4]), int(s[4:6]), int(s[6:8]))
    except ValueError:
        return None


def _parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _month_floor_date(d: date) -> date:
    return date(d.year, d.month, 1)


def _shift_months(d: date, months: int) -> date:
    year = d.year + (d.month - 1 + months) // 12
    month = (d.month - 1 + months) % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _months_between(start: date, end: date) -> int:
    if end < start:
        return 0
    return (end.year - start.year) * 12 + (end.month - start.month) + 1


def _clean_keywords(raw: str | None) -> str | None:
    if raw is None:
        return None
    cleaned = raw.strip()
    return cleaned or None


def _split_cpc_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    parts = [part.strip().upper().replace(" ", "") for part in raw.split(",")]
    return [p for p in parts if p]


def _filter_semantic_pub_ids(
    rows: Sequence[dict[str, Any]],
    *,
    semantic_limit: int,
    tau: float | None,
) -> tuple[list[str], float | None]:
    """Apply distance-based guardrails to semantic neighbors."""
    if not rows:
        return [], None

    first_val = rows[0].get("dist")
    first_dist = float(first_val) if first_val is not None else 0.0
    cap = first_dist + OVERVIEW_SEMANTIC_SPREAD
    if not math.isinf(OVERVIEW_SEMANTIC_DIST_CAP):
        cap = min(cap, OVERVIEW_SEMANTIC_DIST_CAP)
    if tau is not None:
        cap = min(cap, float(tau))

    keep: list[str] = []
    seen: set[str] = set()
    prev = first_dist
    for row in rows:
        pub_id = row.get("pub_id")
        if not pub_id or pub_id in seen:
            continue
        dist_val = row.get("dist")
        dist = float(dist_val) if dist_val is not None else 0.0
        if dist > cap:
            break
        if keep and (dist - prev) > OVERVIEW_SEMANTIC_JUMP:
            break
        keep.append(pub_id)
        seen.add(pub_id)
        prev = dist
        if len(keep) >= semantic_limit:
            break
    return keep, cap


def _build_filter_clause(
    date_from: date | None,
    date_to: date | None,
    cpc_filters: list[str],
) -> tuple[str, list[Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    if date_from:
        clauses.append("p.pub_date >= %s")
        params.append(int(date_from.strftime("%Y%m%d")))
    if date_to:
        clauses.append("p.pub_date <= %s")
        params.append(int(date_to.strftime("%Y%m%d")))
    if cpc_filters:
        or_clauses = []
        for code in cpc_filters:
            like = f"{code}%"
            or_clauses.append(
                "EXISTS ("
                "SELECT 1 FROM jsonb_array_elements(COALESCE(p.cpc, '[]'::jsonb)) c "
                "WHERE ( (COALESCE(c->>'section','')) || COALESCE(c->>'class','') || "
                "COALESCE(c->>'subclass','') || COALESCE(c->>'group','') || "
                "COALESCE('/' || (c->>'subgroup'), '') ) LIKE %s"
                ")"
            )
            params.append(like)
        clauses.append("(" + " OR ".join(or_clauses) + ")")
    if not clauses:
        return "TRUE", []
    return " AND ".join(clauses), params


def _compute_momentum(series: list[MomentumPoint]) -> tuple[float, float | None, Literal["Up", "Flat", "Down"]]:
    if len(series) < 2:
        return 0.0, None, "Flat"
    counts = np.array([pt.count for pt in series], dtype=np.float64)
    x = np.arange(len(series), dtype=np.float64)
    x_mean = float(x.mean())
    y_mean = float(counts.mean())
    denom = float(((x - x_mean) ** 2).sum())
    slope = 0.0 if denom == 0.0 else float(((x - x_mean) * (counts - y_mean)).sum() / denom)
    norm = slope / max(y_mean, 1.0)
    base = counts[0]
    steps = max(len(series) - 1, 1)
    cagr = float((counts[-1] / max(base, 1.0)) ** (1.0 / steps) - 1.0)
    epsilon = 0.05
    if norm > epsilon:
        bucket: Literal["Up", "Flat", "Down"] = "Up"
    elif norm < -epsilon:
        bucket = "Down"
    else:
        bucket = "Flat"
    return norm, cagr, bucket


async def _lookup_crowding_percentile(conn: psycopg.AsyncConnection, total: int) -> float | None:
    try:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT percentile
                FROM overview_crowding_percentiles
                WHERE count_threshold >= %s
                ORDER BY count_threshold ASC
                LIMIT 1
                """,
                (total,),
            )
            row = await cur.fetchone()
        if row and row[0] is not None:
            return float(row[0])
    except psycopg.errors.UndefinedTable:
        logger.info("Skipping percentile lookup; overview_crowding_percentiles table missing.")
    except Exception:
        logger.exception("Failed to lookup overview crowding percentile.")
    return None

def load_embeddings(
    conn: psycopg.Connection,
    model: str,
    req: GraphRequest,
    canonical_assignee_ids: Sequence[uuid.UUID] | None = None,
) -> tuple[np.ndarray, list[EmbeddingMeta]]:
    where = ["e.model = %s"]
    base_params: list[Any] = [model]
    df = _to_int_date(req.date_from)
    dt = _to_int_date(req.date_to)
    if df is not None:
        where.append("p.pub_date >= %s")
        base_params.append(df)
    if dt is not None:
        where.append("p.pub_date < %s")
        base_params.append(dt)
    if canonical_assignee_ids:
        where.append(
            """
            EXISTS (
              SELECT 1
              FROM patent_assignee pa
              WHERE pa.pub_id = p.pub_id
                AND pa.canonical_id = ANY(%s)
            )
            """
        )
        base_params.append(list(canonical_assignee_ids))
    # Build a focus expression to bias sampling toward focus hits
    focus_conds: list[str] = []
    if req.focus_keywords:
        kw_conds = [f"(({SEARCH_EXPR}) @@ plainto_tsquery('english', %s))" for _ in req.focus_keywords]
        if kw_conds:
            focus_conds.append("(" + " OR ".join(kw_conds) + ")")
    if req.focus_cpc_like:
        focus_conds.append(
            """
            EXISTS (
              SELECT 1 FROM jsonb_array_elements(p.cpc) c(obj)
              WHERE (
                coalesce(obj->>'section','')||coalesce(obj->>'class','')||coalesce(obj->>'subclass','')||
                coalesce(obj->>'main_group','')||'/'||coalesce(obj->>'subgroup','')
              ) LIKE ANY(%s)
            )
            """
        )
    # params for focus expr appear after date params
    focus_param_values: list[Any] = []
    if req.focus_keywords:
        focus_param_values.extend(req.focus_keywords)
    if req.focus_cpc_like:
        focus_param_values.append(req.focus_cpc_like)

    focus_expr = " AND ".join(focus_conds) if focus_conds else "FALSE"

    where_sql = " AND ".join(where)
    target_limit = min(req.limit or MAX_GRAPH_LIMIT, MAX_GRAPH_LIMIT)
    if target_limit <= 0:
        raise HTTPException(400, "limit must be greater than zero.")

    vecs: list[np.ndarray] = []
    meta: list[EmbeddingMeta] = []
    seen_pub_ids: set[str] = set()

    def _ingest_rows(cur: psycopg.Cursor[dict[str, Any]]) -> bool:
        for r in cur:
            pub_id = str(r["pub_id"])
            if pub_id in seen_pub_ids:
                continue
            seen_pub_ids.add(pub_id)
            vecs.append(np.asarray(json.loads(r["embedding"]), dtype=np.float32))
            meta.append(
                EmbeddingMeta(
                    pub_id=pub_id,
                    is_focus=bool(r["is_focus"]),
                    pub_date=_from_int_date(r.get("pub_date")),
                    assignee=(r.get("assignee_name") or None),
                    title=(r.get("title") or None),
                    abstract=(r.get("abstract") or None),
                )
            )
            if len(vecs) >= target_limit:
                return True
        return False

    def _run_query(sql: str, params: Sequence[Any]) -> bool:
        with conn.cursor(row_factory=dict_row) as cur:  # type: ignore
            cur.execute(_sql.SQL(sql), params)  # type: ignore
            return _ingest_rows(cur)

    has_focus_filters = bool(focus_conds)
    if has_focus_filters:
        focus_sql = f"""
        SELECT
          e.pub_id,
          e.embedding,
          p.pub_date,
          COALESCE(can.canonical_assignee_name, p.assignee_name) AS assignee_name,
          p.title,
          p.abstract,
          TRUE AS is_focus
        FROM patent_embeddings e
        JOIN patent p USING (pub_id)
        {CANONICAL_ASSIGNEE_LATERAL}
        WHERE {where_sql}
          AND ({focus_expr})
        ORDER BY p.pub_date DESC, e.pub_id
        LIMIT %s
        """
        focus_params: list[Any] = []
        focus_params.extend(base_params)
        focus_params.extend(focus_param_values)
        focus_params.append(target_limit)
        done = _run_query(focus_sql, focus_params)
    else:
        done = False

    if not done and len(vecs) < target_limit:
        fallback_limit = target_limit if not has_focus_filters else min(target_limit * 2, MAX_GRAPH_LIMIT * 2)
        fallback_sql = f"""
        SELECT
          e.pub_id,
          e.embedding,
          p.pub_date,
          COALESCE(can.canonical_assignee_name, p.assignee_name) AS assignee_name,
          p.title,
          p.abstract,
          ({focus_expr}) AS is_focus
        FROM patent_embeddings e
        JOIN patent p USING (pub_id)
        {CANONICAL_ASSIGNEE_LATERAL}
        WHERE {where_sql}
        ORDER BY p.pub_date DESC, e.pub_id
        LIMIT %s
        """
        fallback_params: list[Any] = []
        fallback_params.extend(focus_param_values)
        fallback_params.extend(base_params)
        fallback_params.append(fallback_limit)
        _run_query(fallback_sql, fallback_params)

    if not vecs:
        raise HTTPException(400, "No embeddings match the filters.")
    X = np.vstack(vecs)
    # cosine normalization
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    X = X / norms
    return X, meta

def build_knn(X: np.ndarray, k: int) -> tuple[np.ndarray, np.ndarray]:
    nbrs = NearestNeighbors(n_neighbors=k, metric="cosine", n_jobs=-1).fit(X)
    dist, idx = nbrs.kneighbors(X)
    return dist.astype(np.float32), idx.astype(np.int32)

def local_density(dist: np.ndarray) -> np.ndarray:
    return (1.0 - dist).mean(axis=1).astype(np.float32)

def cluster_labels(dist: np.ndarray, idx: np.ndarray, resolution: float) -> np.ndarray:
    n = dist.shape[0]
    if _HAVE_LEIDEN:
        g = ig.Graph(n=n, directed=False)
        edges, weights = [], []
        for i in range(n):
            for jpos, j in enumerate(idx[i]):
                if i == j: 
                    continue
                if i < j:
                    edges.append((i, j))
                    weights.append(float(1.0 - dist[i, jpos]))
        g.add_edges(edges)
        g.es["weight"] = weights
        part = la.find_partition(g, la.RBConfigurationVertexPartition, weights="weight", resolution_parameter=resolution)
        return np.array(part.membership, dtype=np.int32)
    # fallback: thresholded components
    sim_thresh = 0.75
    parent = list(range(n))
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a
    def union(a,b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra
    for i in range(n):
        for jpos, j in enumerate(idx[i]):
            if i == j: 
                continue
            if 1.0 - float(dist[i, jpos]) >= sim_thresh:
                union(i, j)
    roots = {find(i) for i in range(n)}
    m = {r:k for k,r in enumerate(sorted(roots))}
    return np.array([m[find(i)] for i in range(n)], dtype=np.int32)

def neighbor_momentum(conn: psycopg.Connection, pub_ids: list[str], labels: np.ndarray) -> np.ndarray:
    """psycopg3 COPY-based aggregation; returns per-cluster momentum ∈ [0,1]."""
    # 1) Temp table with (pub_id, cluster_id)
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TEMP TABLE tmp_labels(
              pub_id text PRIMARY KEY,
              cluster_id int
            ) ON COMMIT DROP
        """)
        with cur.copy("COPY tmp_labels (pub_id, cluster_id) FROM STDIN") as cp:
            for pid, cid_val in zip(pub_ids, labels, strict=False):
                # psycopg3's write_row with default format handles None correctly
                cid = int(cid_val) if cid_val is not None and not np.isnan(cid_val) else None
                cp.write_row((pid, cid))

        # 2) Compute cutoff and momentum per cluster in SQL
        cur.execute("""
            WITH d AS (
              SELECT tl.cluster_id, p.pub_date
              FROM tmp_labels tl
              JOIN patent p USING (pub_id)
            ),
            cutoff AS (
              SELECT (MAX(pub_date) - 90) AS c FROM d
            ),
            m AS (
              SELECT
                cluster_id,
                GREATEST(0.0, SUM(CASE WHEN pub_date >= c THEN 1.0 ELSE -0.25 END)) AS m
              FROM d, cutoff
              GROUP BY cluster_id
            )
            SELECT cluster_id, m FROM m
            ORDER BY cluster_id
        """)
        rows = cur.fetchall()

    if not rows:
        return np.zeros(int(labels.max()) + 1, dtype=np.float32)

    # 3) Normalize to [0,1] and pack into dense array by cluster_id
    max_cid = max(r[0] for r in rows)
    arr = np.zeros(max_cid + 1, dtype=np.float32)
    for cid, m in rows:
        arr[int(cid)] = float(m)
    mmax = float(arr.max())
    if mmax > 0:
        arr /= mmax
    return arr


def compute_overview_metrics(
    X: NDArray[np.float32],
    labels: NDArray[np.int32],
    dens: NDArray[np.float32],
    focus_mask: NDArray[np.bool_],
    alpha: float,
    beta: float,
    momentum: NDArray[np.float32],
) -> tuple[NDArray[np.float32], NDArray[np.float32], NDArray[np.float32], NDArray[np.float32]]:
    """
    Composite overview score with *inverted* momentum (higher momentum reduces overview).

    Args:
        X: [N, D] embeddings.
        labels: [N] cluster id for each item, -1 if noise.
        dens: [N] unnormalized local density per item.
        focus_mask: [N] True for items in focus set.
        alpha: >=0 spatial decay.
        beta: in [0,1], strength of momentum penalty.
        momentum: [K] per-cluster momentum in [0,1], K >= max(labels)+1.

    Returns:
        score: [N] overview score, >= 0, with focus items zeroed.
        proximity: [N] soft distance weighting relative to focus vector.
        distance: [N] Euclidean distance from each point to the focus vector.
        focus_vector: [D] centroid used for focus weighting.
    """
    N = X.shape[0]
    assert dens.shape == (N,)
    assert focus_mask.shape == (N,)
    assert 0 <= beta <= 1, "beta must be in [0,1]"

    # Focus vector
    if np.any(focus_mask):
        F = X[focus_mask].mean(axis=0)
        alpha_eff = alpha
    else:
        F = X.mean(axis=0)
        alpha_eff = alpha * 0.5  # conservative when no explicit focus
    F = F.astype(np.float32, copy=False)

    # Proximity
    diff = X - F
    d = np.linalg.norm(diff, axis=1).astype(np.float32)
    proximity = np.exp(-alpha_eff * d, dtype=np.float32)

    # Sparsity = 1 - normalized density
    dmin, dmax = float(dens.min()), float(dens.max())
    denom = (dmax - dmin) if dmax > dmin else 1.0
    dens_n = (dens - dmin) / denom
    sparsity = 1.0 - dens_n
    sparsity = np.clip(sparsity, 0.0, 1.0)

    # Momentum penalty per item from its cluster
    mom = np.zeros(N, dtype=np.float32)
    valid = labels >= 0
    if np.any(valid):
        # Ensure momentum vector large enough; missing clusters -> 0
        max_lbl = int(labels[valid].max())
        K = momentum.shape[0]
        if max_lbl >= K:
            # Extend with zeros for unseen momentum ids
            momentum = np.pad(momentum, (0, max_lbl - K + 1))
        mom[valid] = momentum[labels[valid]]

    # Enforce expected ranges
    mom = np.clip(mom, 0.0, 1.0)
    penalty = 1.0 - beta * mom      # invert: high momentum reduces score
    penalty = np.clip(penalty, 0.0, 1.0)

    # Final score
    score = proximity * sparsity * penalty
    score[focus_mask] = 0.0
    return score.astype(np.float32), proximity.astype(np.float32), d, F


def _persist_sync(
    conn: psycopg.Connection,
    pub_ids: list[str],
    model: str,
    dist: np.ndarray,
    idx: np.ndarray,
    labels: np.ndarray,
    dens: np.ndarray,
    scores: np.ndarray,
    user_id: str,
) -> None:
    """psycopg3 COPY-based upsert for edges and label/score updates."""
    k = idx.shape[1]

    with conn.cursor() as cur:
        # 1) Temp edges
        cur.execute("""
            CREATE TEMP TABLE tmp_edges(
              user_id text,
              src text,
              dst text,
              w   real
            ) ON COMMIT DROP
        """)
        with cur.copy("COPY tmp_edges (user_id, src, dst, w) FROM STDIN") as cp:
            for i, src in enumerate(pub_ids):
                for jpos in range(k):
                    j = int(idx[i, jpos])
                    if i == j:
                        continue
                    cp.write_row((user_id, src, pub_ids[j], float(1.0 - dist[i, jpos])))

        # Upsert edges with user_id
        cur.execute("""
            INSERT INTO knn_edge(user_id, src, dst, w)
            SELECT user_id, src, dst, w FROM tmp_edges
            ON CONFLICT (user_id, src, dst) DO UPDATE SET w = EXCLUDED.w
        """)

        # 2) Temp updates for user-specific overview analysis
        cur.execute("""
            CREATE TEMP TABLE tmp_updates(
              pub_id          text PRIMARY KEY,
              cluster_id      int,
              local_density   real,
              overview_score real
            ) ON COMMIT DROP
        """)
        with cur.copy("COPY tmp_updates (pub_id, cluster_id, local_density, overview_score) FROM STDIN") as cp:
            for pid, cid, d, s in zip(
                pub_ids,
                labels.astype(int).tolist(),
                dens.astype(float).tolist(),
                scores.astype(float).tolist(),
                strict=False,
            ):
                cp.write_row((pid, int(cid), float(d), float(s)))

        # Upsert into user_overview_analysis table (user-specific)
        cur.execute("""
            INSERT INTO user_overview_analysis (user_id, pub_id, model, cluster_id, local_density, overview_score, updated_at)
            SELECT %s, pub_id, %s, cluster_id, local_density, overview_score, NOW()
            FROM tmp_updates
            ON CONFLICT (user_id, pub_id, model)
            DO UPDATE SET
                cluster_id = EXCLUDED.cluster_id,
                local_density = EXCLUDED.local_density,
                overview_score = EXCLUDED.overview_score,
                updated_at = NOW()
        """, (user_id, model))

    conn.commit()


def _persist_background(
    pool: ConnectionPool,
    model: str,
    pub_ids: Sequence[str],
    dist: np.ndarray,
    idx: np.ndarray,
    labels: np.ndarray,
    dens: np.ndarray,
    scores: np.ndarray,
    user_id: str,
) -> None:
    attempts = 0
    last_error: psycopg.OperationalError | None = None
    current_pool = pool

    while attempts < _MAX_DB_RETRIES:
        try:
            with current_pool.connection() as conn:
                _persist_sync(
                    conn,
                    list(pub_ids),
                    model,
                    dist,
                    idx,
                    labels,
                    dens,
                    scores,
                    user_id,
                )
            return
        except psycopg.OperationalError as exc:
            if not is_recoverable_operational_error(exc):
                logger.exception("Failed to persist overview metrics")
                return
            attempts += 1
            last_error = exc
            logger.warning(
                "Recoverable database error while persisting overview metrics (attempt %s/%s): %s",
                attempts,
                _MAX_DB_RETRIES,
                exc,
            )
            _reset_pool(current_pool)
            current_pool = get_pool()
            time.sleep(min(0.1 * attempts, 1.0))
        except Exception:
            logger.exception("Failed to persist overview metrics")
            return

    logger.error(
        "Failed to persist overview metrics after %s attempts: %s",
        _MAX_DB_RETRIES,
        last_error,
    )


# --- Endpoints ---


def _ensure_active_subscription(conn: psycopg.Connection, user_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute("SELECT has_active_subscription(%s)", (user_id,))
        row = cur.fetchone()
    if not row or not bool(row[0]):
        raise SubscriptionRequiredError(
            detail="This feature requires an active subscription. Please subscribe to continue."
        )


async def _ensure_active_subscription_async(conn: psycopg.AsyncConnection, user_id: str) -> None:
    async with conn.cursor() as cur:
        await cur.execute("SELECT has_active_subscription(%s)", (user_id,))
        row = await cur.fetchone()
    if not row or not bool(row[0]):
        raise SubscriptionRequiredError(
            detail="This feature requires an active subscription. Please subscribe to continue."
        )


def _normalize_assignee(name: str | None) -> str:
    """Coalesce empty assignee labels into a friendly placeholder."""
    if not name:
        return "Unknown assignee"
    cleaned = name.strip()
    return cleaned or "Unknown assignee"


def _parse_date_str(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _month_floor(d: date) -> date:
    return date(d.year, d.month, 1)


def _window_bounds(req: GraphRequest, nodes: Sequence[NodeDatum]) -> tuple[date | None, date | None]:
    """Determine the rolling window used for time-series evaluation."""
    dated_nodes = [n for n in nodes if n.pub_date]
    if not dated_nodes:
        return None, None
    latest = max(n.pub_date for n in dated_nodes if n.pub_date)  # type: ignore[arg-type]
    earliest = min(n.pub_date for n in dated_nodes if n.pub_date)  # type: ignore[arg-type]
    req_end = _parse_date_str(req.date_to)
    end_date = min(latest, req_end) if req_end else latest
    req_start = _parse_date_str(req.date_from)
    span_days = 365
    if req_start and req_start <= end_date:
        span = (end_date - req_start).days
        span_days = min(max(span, 180), 365) if span > 0 else 365
        base_start = end_date - timedelta(days=span_days)
        start_date = max(req_start, base_start)
    else:
        start_date = end_date - timedelta(days=365)
    if start_date < earliest:
        start_date = earliest
    if (end_date - start_date).days < 60:
        # Require at least ~2 months to avoid spurious slopes.
        return None, None
    return start_date, end_date


def _build_node_data(
    meta: Sequence[EmbeddingMeta],
    labels: np.ndarray,
    scores: np.ndarray,
    dens: np.ndarray,
    proximity: np.ndarray,
    distance: np.ndarray,
    momentum: np.ndarray,
) -> list[NodeDatum]:
    """Combine raw arrays into a richer per-node structure."""
    nodes: list[NodeDatum] = []
    for idx, m in enumerate(meta):
        cid = int(labels[idx])
        nodes.append(
            NodeDatum(
                index=idx,
                pub_id=m.pub_id,
                assignee=_normalize_assignee(m.assignee),
                pub_date=m.pub_date,
                cluster_id=cid,
                score=float(scores[idx]),
                density=float(dens[idx]),
                proximity=float(proximity[idx]),
                distance=float(distance[idx]),
                momentum=float(momentum[cid]) if cid < len(momentum) else 0.0,
                is_focus=bool(m.is_focus),
                title=m.title,
                abstract=m.abstract,
            )
        )
    return nodes


def _compute_bridge_inputs(
    assignee_indices: Sequence[int],
    labels: np.ndarray,
    idx_matrix: np.ndarray,
    dist_matrix: np.ndarray,
    momentum: np.ndarray,
) -> tuple[float, float, float, float, set[int]]:
    """Return bridge rule inputs and the indices of interface nodes."""
    if not assignee_indices:
        return 1.0, 0.0, 0.0, 0.0, set()
    cluster_counts = Counter(int(labels[i]) for i in assignee_indices)
    if len(cluster_counts) < 2:
        return 1.0, 0.0, 0.0, 0.0, set()
    top_clusters = [cid for cid, _ in cluster_counts.most_common(2)]
    c1, c2 = top_clusters[0], top_clusters[1]
    bridge_nodes: set[int] = set()
    weights: list[float] = []
    for node_idx in assignee_indices:
        node_cluster = int(labels[node_idx])
        if node_cluster not in top_clusters:
            continue
        for neighbor_pos, neighbor_idx in enumerate(idx_matrix[node_idx]):
            if int(neighbor_idx) == node_idx:
                continue
            neighbor_cluster = int(labels[neighbor_idx])
            if neighbor_cluster not in top_clusters or neighbor_cluster == node_cluster:
                continue
            weight = float(1.0 - dist_matrix[node_idx, neighbor_pos])
            weights.append(weight)
            bridge_nodes.add(node_idx)
    cluster_total = sum(1 for i in assignee_indices if int(labels[i]) in top_clusters)
    openness = float(len(bridge_nodes) / max(1, cluster_total))
    inter_weight = float(np.mean(weights)) if weights else 0.0
    mom_left = float(momentum[c1]) if c1 < len(momentum) else 0.0
    mom_right = float(momentum[c2]) if c2 < len(momentum) else 0.0
    return openness, inter_weight, mom_left, mom_right, bridge_nodes


def build_group_signals(
    req: GraphRequest,
    node_data: list[NodeDatum],
    labels: np.ndarray,
    idx_matrix: np.ndarray,
    dist_matrix: np.ndarray,
    momentum: np.ndarray,
    *,
    scope_text: str,
    group_mode: GroupKind,
    cluster_label_map: dict[int, list[str]] | None = None,
) -> tuple[list[AssigneeSignals], dict[str, set[SignalKind]], dict[str, float], dict[str, str]]:
    """Aggregate node-level metrics into signal payloads per grouping unit."""
    if not node_data:
        return [], {}, {}, {}

    cluster_label_map = cluster_label_map or {}
    cohort_scores = np.array([n.score for n in node_data], dtype=float)
    density_values = np.array([n.density for n in node_data], dtype=float)
    if cohort_scores.size == 0:
        cohort_scores = np.array([0.0], dtype=float)
    if density_values.size == 0:
        density_values = np.array([0.0], dtype=float)

    cohort_scores_list = cohort_scores.tolist()
    high_ws_threshold = float(np.quantile(cohort_scores, 0.90))
    low_ws_threshold = float(np.quantile(cohort_scores, 0.40))
    high_density_threshold = float(np.quantile(density_values, 0.75))

    data_by_group: dict[str, list[NodeDatum]] = defaultdict(list)
    group_meta: dict[str, dict[str, Any]] = {}

    for node in node_data:
        if group_mode == "cluster":
            key = f"cluster:{node.cluster_id}"
            raw_terms = cluster_label_map.get(node.cluster_id, [])
            label_terms: list[str] = []
            for term in raw_terms:
                print("Evaluating cluster term: %s", term)
                if _is_allowed_cluster_term(term):
                    print("Accepted cluster term: %s", term)
                    label_terms.append(term)
            print("Final cluster label terms: %s", label_terms)
            trimmed_terms = label_terms[:CLUSTER_LABEL_MAX_TERMS]
            print("Trimmed cluster label terms: %s", trimmed_terms)
            formatted_terms = _format_label_terms(trimmed_terms) if trimmed_terms else ""
            print("Formatted cluster label terms: %s", formatted_terms)
            label_text = f"Cluster {node.cluster_id}"
            if key not in group_meta:
                group_meta[key] = {
                    "label": label_text,
                    "cluster_id": node.cluster_id,
                    "terms": list(trimmed_terms),
                    "formatted_terms": formatted_terms,
                }
        else:
            key = node.assignee
            if key not in group_meta:
                group_meta[key] = {
                    "label": node.assignee,
                    "cluster_id": None,
                    "terms": None,
                    "formatted_terms": None,
                }
        data_by_group[key].append(node)

    def _sort_key(group_key: str) -> tuple[int, str]:
        label_text = group_meta[group_key]["label"] or ""
        return (-len(data_by_group[group_key]), label_text.lower())

    ordered_groups = sorted(data_by_group.keys(), key=_sort_key)
    group_limit = 6 if group_mode == "cluster" else 5
    ordered_groups = ordered_groups[:group_limit]

    group_payloads: list[AssigneeSignals] = []
    node_signals: dict[str, set[SignalKind]] = defaultdict(set)
    node_relevance: dict[str, float] = defaultdict(float)
    node_tooltips: dict[str, str] = {}

    for group_key in ordered_groups:
        nodes = sorted(data_by_group[group_key], key=lambda n: (n.pub_date or date.min, n.pub_id))
        start_date, end_date = _window_bounds(req, nodes)
        meta_info = group_meta[group_key]
        group_label = meta_info["label"]
        cluster_id = meta_info["cluster_id"]
        label_terms = meta_info["terms"]
        formatted_terms = meta_info["formatted_terms"]
        summary_text: str | None = None
        if group_mode == "cluster" and formatted_terms:
            summary_text = f"Top terms: {formatted_terms}"

        if not start_date or not end_date:
            focus_result = SignalComputation(False, 0.0, "Not enough history for this scope.", {"samples": 0.0})
            emerging_result = SignalComputation(False, 0.0, "Not enough history for this scope.", {"samples": 0.0})
            crowd_result = SignalComputation(False, 0.0, "Not enough history for this scope.", {"samples": 0.0})
            bridge_result = SignalComputation(False, 0.0, "Not enough history for this scope.", {"samples": 0.0})
            signal_payloads: list[SignalPayload] = [
                SignalPayload(type="emerging_gap", status=emerging_result.status(), confidence=0.0, why=emerging_result.message, node_ids=[]),
                SignalPayload(type="bridge", status=bridge_result.status(), confidence=0.0, why=bridge_result.message, node_ids=[]),
                SignalPayload(type="crowd_out", status=crowd_result.status(), confidence=0.0, why=crowd_result.message, node_ids=[]),
                SignalPayload(type="focus_shift", status=focus_result.status(), confidence=0.0, why=focus_result.message, node_ids=[]),
            ]
            group_payloads.append(
                AssigneeSignals(
                    assignee=group_label,
                    k=scope_text,
                    signals=signal_payloads,
                    summary=summary_text,
                    cluster_id=cluster_id,
                    group_kind=group_mode,
                    label_terms=list(label_terms) if label_terms else None,
                )
            )
            continue

        window_nodes = [n for n in nodes if n.pub_date and start_date <= n.pub_date <= end_date]
        if not window_nodes:
            continue

        bucket_map: dict[date, list[NodeDatum]] = defaultdict(list)
        for node in window_nodes:
            bucket_map[_month_floor(node.pub_date)].append(node)  # type: ignore[arg-type]
        bucket_items = sorted(bucket_map.items())
        if len(bucket_items) > 12:
            bucket_items = bucket_items[-12:]

        dist_series: list[float] = []
        share_series: list[float] = []
        overview_series: list[float] = []
        density_series: list[float] = []
        momentum_series: list[float] = []
        n_samples = 0
        latest_nodes: list[NodeDatum] = []

        for _, bucket_nodes in bucket_items:
            count = len(bucket_nodes)
            if count == 0:
                continue
            n_samples += count
            dist_series.append(float(np.mean([n.distance for n in bucket_nodes])))
            share_series.append(sum(1 for n in bucket_nodes if n.is_focus) / count)
            overview_series.append(float(np.mean([n.score for n in bucket_nodes])))
            density_series.append(float(np.mean([n.density for n in bucket_nodes])))
            momentum_series.append(float(np.mean([n.momentum for n in bucket_nodes])))
            latest_nodes = bucket_nodes

        neighbor_momentum = momentum_series[-1] if momentum_series else 0.0

        focus_result = signal_focus_shift(dist_series, share_series, n_samples)
        emerging_result = signal_emerging_gap(overview_series, cohort_scores_list, neighbor_momentum)
        crowd_result = signal_crowd_out(overview_series, density_series)

        group_indices = [n.index for n in nodes]
        openness, inter_weight, mom_left, mom_right, bridge_node_indices = _compute_bridge_inputs(
            group_indices, labels, idx_matrix, dist_matrix, momentum
        )
        bridge_result = signal_bridge(openness, inter_weight, mom_left, mom_right)

        index_lookup = {n.index: n for n in nodes}

        focus_node_ids = [n.pub_id for n in sorted(latest_nodes, key=lambda n: n.distance)[:6]]
        emerging_candidates = [n for n in nodes if n.score >= high_ws_threshold and n.proximity >= 0.4]
        if not emerging_candidates:
            emerging_candidates = sorted(nodes, key=lambda n: n.score, reverse=True)[:5]
        emerging_node_ids = [n.pub_id for n in emerging_candidates[:6]]
        crowd_candidates = [
            n for n in latest_nodes
            if (n.density >= high_density_threshold and n.score <= low_ws_threshold)
        ]
        if not crowd_candidates:
            crowd_candidates = sorted(latest_nodes, key=lambda n: (n.density, -n.score), reverse=True)[:5]
        crowd_node_ids = [n.pub_id for n in crowd_candidates[:6]]
        bridge_node_ids = [index_lookup[idx].pub_id for idx in bridge_node_indices if idx in index_lookup]

        def _payload(kind: SignalKind, result: SignalComputation, node_ids: list[str]) -> SignalPayload:
            conf = float(np.clip(result.confidence, 0.0, 1.0))
            payload = SignalPayload(
                type=kind,
                status=result.status(),
                confidence=conf,
                why=result.message,
                node_ids=node_ids,
                debug=result.debug if req.debug else None,
            )
            for nid in node_ids:
                tooltip_msg = f"{SIGNAL_LABELS[kind]}: {result.message}"
                current_conf = node_relevance.get(nid, 0.0)
                node_signals[nid].add(kind)
                if conf >= current_conf:
                    node_tooltips[nid] = tooltip_msg
                node_relevance[nid] = max(current_conf, conf)
            return payload

        signal_payloads = [
            _payload("emerging_gap", emerging_result, emerging_node_ids),
            _payload("bridge", bridge_result, bridge_node_ids),
            _payload("crowd_out", crowd_result, crowd_node_ids),
            _payload("focus_shift", focus_result, focus_node_ids),
        ]

        group_debug: dict[str, Any] | None = None
        if req.debug:
            group_debug = {
                "window_start": start_date.isoformat(),
                "window_end": end_date.isoformat(),
                "dist_series": dist_series,
                "share_series": share_series,
                "overview_series": overview_series,
                "density_series": density_series,
                "momentum_series": momentum_series,
                "neighbor_momentum": neighbor_momentum,
                "high_ws_threshold": high_ws_threshold,
                "low_ws_threshold": low_ws_threshold,
                "high_density_threshold": high_density_threshold,
                "bridge_inputs": {
                    "openness": openness,
                    "inter_weight": inter_weight,
                    "momentum_left": mom_left,
                    "momentum_right": mom_right,
                },
            }
        group_payloads.append(
            AssigneeSignals(
                assignee=group_label,
                k=scope_text,
                signals=signal_payloads,
                summary=summary_text,
                debug=group_debug,
                cluster_id=cluster_id,
                group_kind=group_mode,
                label_terms=list(label_terms) if label_terms else None,
            )
        )

    return group_payloads, node_signals, node_relevance, node_tooltips


@router.get("/overview", response_model=IPOverviewResponse)
async def get_ip_overview(
    conn: AsyncConn,
    current_user: User,
    keywords: str | None = Query(None, description="Comma-separated keyword query"),
    cpc: str | None = Query(None, description="Comma-separated CPC filters"),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    semantic: int = Query(0, description="Include semantic neighborhood when non-zero"),
    tau: float | None = Query(None, description="Optional cosine-distance ceiling"),
    semantic_limit: int = Query(500, ge=1, le=5000),
) -> IPOverviewResponse:
    keywords_clean = _clean_keywords(keywords)
    cpc_filters = _split_cpc_list(cpc)

    end_date = _parse_iso_date(date_to) or date.today()
    start_date = _parse_iso_date(date_from)
    if start_date is None:
        start_date = _shift_months(_month_floor_date(end_date), -23)
        start_date = date(start_date.year, start_date.month, 1)
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="date_from cannot be after date_to")

    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication token")
    await _ensure_active_subscription_async(conn, user_id)

    semantic_enabled = bool(semantic) and bool(keywords_clean)
    query_vec: list[float] | None = None
    if semantic_enabled:
        try:
            maybe_vec = embed_text(keywords_clean or "")
            if inspect.isawaitable(maybe_vec):
                embedding = await maybe_vec
            else:
                embedding = maybe_vec
            query_vec = list(embedding)
        except Exception as exc:
            logger.exception("Failed to embed semantic query for overview overview.")
            raise HTTPException(status_code=500, detail="Failed to compute semantic neighborhood") from exc
    else:
        semantic_enabled = False

    filter_clause, filter_params = _build_filter_clause(start_date, end_date, cpc_filters)

    filtered_cte = (
        "filtered AS ("
        " SELECT p.pub_id, p.pub_date, p.cpc"
        " FROM patent p"
        f" WHERE {filter_clause}"
        ")"
    )

    if keywords_clean:
        search_expr = SEARCH_EXPR.replace("p.", "p_kw.")
        keyword_cte = (
            "keyword_hits AS ("
            " SELECT f.pub_id"
            " FROM filtered f"
            " JOIN patent p_kw ON p_kw.pub_id = f.pub_id"
            f" WHERE ({search_expr}) @@ plainto_tsquery('english', %s)"
            ")"
        )
        keyword_params: list[Any] = [keywords_clean]
    else:
        keyword_cte = "keyword_hits AS (SELECT f.pub_id FROM filtered f)"
        keyword_params = []

    semantic_cte = "semantic_hits AS (SELECT f.pub_id FROM filtered f WHERE FALSE)"
    semantic_params: list[Any] = []
    semantic_pub_ids: list[str] = []
    if semantic_enabled and query_vec:
        model_like = "%|ta"
        lim = max(1, min(int(semantic_limit), 5000))
        semantic_neighbor_sql = _sql.SQL(
            f"""
            WITH {filtered_cte} 
            SELECT f.pub_id, e.embedding <=> %s{ _VEC_CAST } AS dist 
            FROM filtered f 
            JOIN patent_embeddings e ON e.pub_id = f.pub_id 
            WHERE e.model LIKE %s 
            ORDER BY dist ASC 
            LIMIT %s
            """ #type: ignore
        )   
        neighbor_params = tuple((*filter_params, query_vec, model_like, lim))
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(semantic_neighbor_sql, neighbor_params)
            neighbor_rows = await cur.fetchall()
        semantic_pub_ids, semantic_cap = _filter_semantic_pub_ids(
            neighbor_rows,
            semantic_limit=lim,
            tau=tau,
        )
        if neighbor_rows:
            cap_label = f"{semantic_cap:.4f}" if semantic_cap is not None else "n/a"
            logger.debug(
                "Overview semantic neighbors kept %d/%d (limit=%d, cap=%s, tau=%s)",
                len(semantic_pub_ids),
                len(neighbor_rows),
                lim,
                cap_label,
                f"{tau:.4f}" if tau is not None else "auto",
            )
        if semantic_pub_ids:
            semantic_cte = (
                "semantic_hits AS ("
                " SELECT DISTINCT s.pub_id"
                " FROM unnest(%s::text[]) AS s(pub_id)"
                ")"
            )
            semantic_params = [semantic_pub_ids]

    combined_cte = (
        "combined AS ("
        " SELECT pub_id FROM keyword_hits"
        " UNION"
        " SELECT pub_id FROM semantic_hits"
        ")"
    )

    cte_parts = [
        (filtered_cte, filter_params),
        (keyword_cte, keyword_params),
        (semantic_cte, semantic_params),
        (combined_cte, []),
    ]
    cte_sql = ", ".join(part for part, _ in cte_parts)
    cte_params: list[Any] = []
    for _, params in cte_parts:
        cte_params.extend(params)
    params_tuple = tuple(cte_params)

    counts_sql = (
        f"WITH {cte_sql} "
        "SELECT "
        " (SELECT COUNT(DISTINCT pub_id) FROM keyword_hits) AS exact_count, "
        " (SELECT COUNT(DISTINCT pub_id) FROM semantic_hits) AS semantic_count, "
        " (SELECT COUNT(DISTINCT pub_id) FROM combined) AS total_count"
    )

    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(counts_sql, params_tuple)
        counts_row = await cur.fetchone()
    if counts_row:
        exact_count = int(counts_row["exact_count"] or 0)
        semantic_count = int(counts_row["semantic_count"] or 0)
        total_count = int(counts_row["total_count"] or 0)
    else:
        exact_count = semantic_count = total_count = 0

    create_sql = (
        f"CREATE TEMP TABLE tmp_ws_scope ON COMMIT DROP AS "
        f"WITH {cte_sql} "
        "SELECT DISTINCT pub_id FROM combined"
    )
    async with conn.cursor() as cur:
        await cur.execute(create_sql, params_tuple)

    timeline_sql = """
        WITH month_base AS (
            SELECT
                date_trunc('month', to_date(p.pub_date::text, 'YYYYMMDD')) AS month_date,
                to_char(date_trunc('month', to_date(p.pub_date::text, 'YYYYMMDD')), 'YYYY-MM') AS month_label,
                COALESCE(can.canonical_assignee_name, NULLIF(p.assignee_name, ''), 'Unknown') AS canonical_assignee_name
            FROM tmp_ws_scope s
            JOIN patent p ON p.pub_id = s.pub_id
            LEFT JOIN canonical_assignee_name can ON can.id = p.canonical_assignee_name_id
        ),
        monthly_totals AS (
            SELECT
                month_date,
                month_label AS month,
                COUNT(*)::int AS count
            FROM month_base
            GROUP BY month_date, month
        ),
        monthly_assignee_counts AS (
            SELECT
                month_date,
                canonical_assignee_name,
                COUNT(*)::int AS assignee_count
            FROM month_base
            GROUP BY month_date, canonical_assignee_name
        ),
        monthly_top_assignee AS (
            SELECT
                month_date,
                canonical_assignee_name,
                assignee_count
            FROM (
                SELECT
                    month_date,
                    canonical_assignee_name,
                    assignee_count,
                    ROW_NUMBER() OVER (
                        PARTITION BY month_date
                        ORDER BY assignee_count DESC, canonical_assignee_name ASC
                    ) AS rank
                FROM monthly_assignee_counts
            ) ranked
            WHERE rank = 1
        )
        SELECT
            totals.month,
            totals.count,
            top_assignee.canonical_assignee_name AS top_assignee,
            top_assignee.assignee_count AS top_assignee_count
        FROM monthly_totals totals
        LEFT JOIN monthly_top_assignee top_assignee
            ON top_assignee.month_date = totals.month_date
        ORDER BY totals.month_date
    """
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(timeline_sql)
        timeline_rows = await cur.fetchall()

    timeline_points = [
        MomentumPoint(
            month=row["month"],
            count=int(row["count"]),
            top_assignee=row.get("top_assignee"),
            top_assignee_count=int(row["top_assignee_count"]) if row.get("top_assignee_count") is not None else None,
        )
        for row in timeline_rows
        if row["month"] is not None
    ]

    cpc_sql = """
        SELECT
            (
                COALESCE(c->>'section','') ||
                COALESCE(c->>'class','') ||
                COALESCE(c->>'subclass','') ||
                COALESCE(c->>'group','') ||
                COALESCE('/' || (c->>'subgroup'), '')
            ) AS code,
            COUNT(*)::int AS count
        FROM tmp_ws_scope s
        JOIN patent p ON p.pub_id = s.pub_id
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.cpc, '[]'::jsonb)) AS c
        GROUP BY code
        ORDER BY count DESC
        LIMIT 15
    """
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(cpc_sql)
        cpc_rows = await cur.fetchall()

    breakdown = [
        CpcBreakdownItem(cpc=row["code"] or "Unknown", count=int(row["count"]))
        for row in cpc_rows
    ]
    top_cpcs = breakdown[:5]

    month_counts = [pt.count for pt in timeline_points]
    if month_counts:
        density_stats = DensityMetrics(
            mean_per_month=float(np.mean(month_counts)),
            min_per_month=int(min(month_counts)),
            max_per_month=int(max(month_counts)),
        )
    else:
        density_stats = DensityMetrics(mean_per_month=0.0, min_per_month=0, max_per_month=0)

    window_months = max(
        1,
        _months_between(_month_floor_date(start_date), _month_floor_date(end_date)),
    )
    density_per_month = float(total_count) / float(window_months) if window_months else 0.0

    momentum_slope, momentum_cagr, momentum_bucket = _compute_momentum(timeline_points)

    end_month = _month_floor_date(end_date)

    def _sum_recent(month_span: int) -> int:
        if not timeline_points:
            return 0
        cutoff = _shift_months(end_month, -(month_span - 1))
        total = 0
        for pt in timeline_points:
            try:
                pt_date = datetime.strptime(pt.month, "%Y-%m").date().replace(day=1)
            except ValueError:
                continue
            if pt_date >= cutoff:
                total += pt.count
        return total

    recency = RecencyMetrics(
        m6=_sum_recent(6),
        m12=_sum_recent(12),
        m24=_sum_recent(24),
    )

    percentile = await _lookup_crowding_percentile(conn, total_count)

    crowding = CrowdingMetrics(
        exact=exact_count,
        semantic=semantic_count if semantic_enabled else 0,
        total=total_count,
        density_per_month=density_per_month,
        percentile=percentile,
    )

    momentum = MomentumMetrics(
        slope=momentum_slope,
        cagr=momentum_cagr,
        bucket=momentum_bucket,
        series=timeline_points,
    )

    return IPOverviewResponse(
        crowding=crowding,
        density=density_stats,
        momentum=momentum,
        top_cpcs=top_cpcs,
        cpc_breakdown=breakdown,
        recency=recency,
        timeline=timeline_points,
        window_months=window_months,
    )


@router.post("/graph", response_model=OverviewResponse)
def get_overview_graph(
    req: GraphRequest,
    pool: Annotated[ConnectionPool, Depends(get_pool)],
    background_tasks: BackgroundTasks,
    current_user: User,
) -> OverviewResponse:
    _validate_graph_params(req)

    # Extract user_id from JWT token (Auth0 uses 'sub' claim for user ID)
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication token")

    group_mode: GroupKind = "assignee"
    matched_canonical_ids: list[uuid.UUID] | None = None
    matched_labels: list[str] = []
    matched_debug: list[tuple[str, float]] = []
    attempts = 0
    last_error: psycopg.OperationalError | None = None
    current_pool = pool

    while attempts < _MAX_DB_RETRIES:
        try:
            with current_pool.connection() as conn:
                _ensure_active_subscription(conn, user_id)
                preferred_model = os.getenv("OVERVIEW_EMBEDDING_MODEL") or os.getenv(
                    "WS_EMBEDDING_MODEL", "text-embedding-3-small|ta"
                )
                model = pick_model(conn, preferred=preferred_model)
                if req.search_mode == "assignee":
                    group_mode = "cluster"
                    matched_canonical_ids, matched_labels, matched_debug = _match_canonical_assignees(
                        conn, req.assignee_query or ""
                    )
                    if not matched_canonical_ids:
                        raise HTTPException(
                            status_code=404,
                            detail="No canonical assignee matches found above the similarity threshold.",
                        )
                X, meta = load_embeddings(conn, model, req, matched_canonical_ids)
                focus_mask = np.array([m.is_focus for m in meta], dtype=bool)
                pub_ids = [m.pub_id for m in meta]
                point_count = len(pub_ids)

                if point_count < 2:
                    raise HTTPException(status_code=400, detail="Not enough embeddings to build overview graph.")
                if req.neighbors >= point_count:
                    raise HTTPException(
                        status_code=400,
                        detail=f"neighbors must be less than the number of embeddings ({point_count})",
                    )
                if req.layout_neighbors >= point_count:
                    raise HTTPException(
                        status_code=400,
                        detail=f"layout_neighbors must be less than the number of embeddings ({point_count})",
                    )

                dist, idx = build_knn(X, req.neighbors)
                labels = cluster_labels(dist, idx, req.resolution)
                dens = local_density(dist)
                mom = neighbor_momentum(conn, pub_ids, labels)
                scores, proximity, distance, focus_vector = compute_overview_metrics(
                    X, labels, dens, focus_mask, req.alpha, req.beta, mom
                )
            pool = current_pool
            break
        except psycopg.errors.UndefinedTable as exc:
            logger.error("Overview schema missing; run database migrations before serving traffic.")
            raise HTTPException(
                status_code=500,
                detail="Overview graph schema is not initialized. Run database migrations.",
            ) from exc
        except psycopg.errors.InsufficientPrivilege as exc:
            logger.error("Database role lacks privileges for overview query: %s", exc)
            raise HTTPException(
                status_code=500,
                detail="Database role is missing privileges required for overview queries.",
            ) from exc
        except psycopg.OperationalError as exc:
            if not is_recoverable_operational_error(exc):
                raise
            attempts += 1
            last_error = exc
            logger.warning(
                "Recoverable database error while building overview graph (attempt %s/%s): %s",
                attempts,
                _MAX_DB_RETRIES,
                exc,
            )
            _reset_pool(current_pool)
            current_pool = get_pool()
            time.sleep(min(0.1 * attempts, 1.0))
        except Exception:
            raise
    else:
        assert last_error is not None
        logger.error(
            "Exhausted retries while building overview graph due to database errors: %s",
            last_error,
        )
        raise HTTPException(
            status_code=503,
            detail="Temporary database connectivity issue. Please retry your request.",
        )

    # layout
    if req.layout and _HAVE_UMAP:
        reducer = umap.UMAP(
            n_neighbors=req.layout_neighbors,
            min_dist=req.layout_min_dist,
            metric="cosine",
            random_state=42,
        )
        embedding = reducer.fit_transform(X)
        XY = np.asarray(embedding).astype(np.float32)
    else:
        # PCA 2D fallback
        mu = X.mean(axis=0, keepdims=True)
        Xc = X - mu
        U, S, Vt = np.linalg.svd(Xc, full_matrices=False)
        XY = (Xc @ Vt[:2].T).astype(np.float32)

    node_data = _build_node_data(meta, labels, scores, dens, proximity, distance, mom)
    cluster_term_map = _compute_cluster_term_map(node_data) if group_mode == "cluster" else {}
    logger.info(f"Computed cluster term map: {cluster_term_map}")
    if group_mode == "cluster":
        if matched_labels:
            display_labels = matched_labels[:6]
            scope_text = f"Matched assignees: {', '.join(display_labels)}"
            remaining = len(matched_labels) - len(display_labels)
            if remaining > 0:
                scope_text += f" (+{remaining} more)"
        else:
            scope_text = f"Assignee scope: {req.assignee_query or 'Selected scope'}"
    else:
        scope_text = ", ".join(req.focus_keywords) or ", ".join(req.focus_cpc_like) or "Selected scope"
    logger.info(f"Using scope text: {scope_text}")
    logger.info(f"Matched labels: {matched_labels}")
    group_payloads, node_signal_map, node_relevance_map, node_tooltips = build_group_signals(
        req,
        node_data,
        labels,
        idx,
        dist,
        mom,
        scope_text=scope_text,
        group_mode=group_mode,
        cluster_label_map=cluster_term_map,
    )

    if not group_payloads and node_data:
        empty_signals = [
            SignalPayload(type=kind, status="none", confidence=0.0, why="No signal detected for this scope.", node_ids=[])
            for kind in SIGNAL_ORDER
        ]
        fallback_label = (
            node_data[0].assignee if group_mode == "assignee" else f"Cluster {node_data[0].cluster_id}"
        )
        group_payloads = [
            AssigneeSignals(
                assignee=fallback_label,
                k=scope_text,
                signals=empty_signals,
                debug=None,
                cluster_id=node_data[0].cluster_id if group_mode == "cluster" else None,
                group_kind=group_mode,
            )
        ]

    nodes = []
    for i, meta_row in enumerate(meta):
        node_id = meta_row.pub_id
        signal_list = sorted(node_signal_map.get(node_id, []))
        relevance = node_relevance_map.get(node_id, 0.0)
        if relevance <= 0:
            relevance = 0.15
        datum = node_data[i]
        nodes.append(
            GraphNode(
                id=node_id,
                cluster_id=int(labels[i]),
                assignee=_normalize_assignee(meta_row.assignee),
                x=float(XY[i, 0]),
                y=float(XY[i, 1]),
                signals=signal_list,
                relevance=float(np.clip(relevance, 0.05, 1.0)),
                title=meta_row.title,
                tooltip=node_tooltips.get(node_id),
                pub_date=datum.pub_date,
                overview_score=datum.score,
                local_density=datum.density,
                abstract=meta_row.abstract,
            )
        )

    edges = []
    for i, src in enumerate(pub_ids):
        for j_idx, j in enumerate(idx[i, 1:11]):  # at most 10 edges
            edges.append(
                GraphEdge(
                    source=src,
                    target=pub_ids[j],
                    weight=float(1.0 - dist[i, j_idx + 1]),
                )
            )

    background_tasks.add_task(
        _persist_background,
        pool,
        model,
        list(pub_ids),
        dist,
        idx,
        labels,
        dens,
        scores,
        user_id,
    )

    debug_payload: dict[str, Any] | None = None
    if req.debug:
        debug_payload = {
            "focus_mask_count": int(focus_mask.sum()),
            "total_nodes": len(nodes),
            "alpha": req.alpha,
            "beta": req.beta,
            "focus_vector_norm": float(np.linalg.norm(focus_vector)),
        }

    graph_context = GraphContext(nodes=nodes, edges=edges)
    if req.debug and matched_debug:
        debug_payload = debug_payload or {}
        debug_payload["matched_assignees"] = [
            {"name": name, "score": score} for name, score in matched_debug
        ]
    logger.info(f"Returning overview graph with matched assignees: {matched_labels}")
    print("Returning overview graph with matched assignees: %s", matched_labels)
    logger.info(f"Group mode: {group_mode}, scope text: {scope_text}")
    print("Group mode: %s, scope text: %s", group_mode, scope_text)
    return OverviewResponse(
        k=scope_text,
        assignees=group_payloads,
        graph=graph_context,
        debug=debug_payload,
        group_mode=group_mode,
        matched_assignees=matched_labels or None,
    )
