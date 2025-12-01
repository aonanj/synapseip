"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

type ScopeMode = "assignee" | "pub" | "search";

type CitationScope = {
  focus_pub_ids?: string[] | null;
  focus_assignee_names?: string[] | null;
  filters?: Record<string, any> | null;
  citing_pub_date_from?: string | null;
  citing_pub_date_to?: string | null;
  bucket?: "month" | "quarter";
};

type ForwardImpactPoint = {
  bucket_start: string;
  citing_count: number;
};

type PatentImpactSummary = {
  pub_id: string;
  title: string;
  assignee_name: string | null;
  canonical_assignee_id: string | null;
  pub_date: string | null;
  fwd_citation_count: number;
  fwd_citation_velocity: number;
  first_citation_date: string | null;
  last_citation_date: string | null;
};

type ForwardImpactResponse = {
  total_forward_citations: number;
  distinct_citing_patents: number;
  timeline: ForwardImpactPoint[];
  top_patents: PatentImpactSummary[];
};

type DependencyEdge = {
  citing_assignee_id: string | null;
  citing_assignee_name: string | null;
  cited_assignee_id: string | null;
  cited_assignee_name: string | null;
  citation_count: number;
  citing_to_cited_pct: number | null;
};

type DependencyMatrixResponse = { edges: DependencyEdge[] };

type PatentRiskMetrics = {
  pub_id: string;
  title: string;
  assignee_name: string | null;
  canonical_assignee_id: string | null;
  pub_date: string | null;
  fwd_total: number;
  fwd_from_competitors: number;
  fwd_competitor_ratio: number | null;
  bwd_total: number;
  bwd_cpc_entropy: number | null;
  bwd_cpc_top_share: number | null;
  bwd_assignee_diversity: number | null;
  exposure_score: number;
  fragility_score: number;
  overall_risk_score: number;
};

type RiskRadarResponse = { patents: PatentRiskMetrics[] };

type EncroachmentTimelinePoint = {
  bucket_start: string;
  competitor_assignee_id: string | null;
  competitor_assignee_name: string | null;
  citing_patent_count: number;
};

type AssigneeEncroachmentSummary = {
  competitor_assignee_id: string | null;
  competitor_assignee_name: string | null;
  total_citing_patents: number;
  encroachment_score: number;
  velocity: number | null;
};

type EncroachmentResponse = {
  target_assignee_ids: string[];
  timeline: EncroachmentTimelinePoint[];
  competitors: AssigneeEncroachmentSummary[];
};

type ScopePanelState = {
  mode: ScopeMode;
  focusAssigneeNames: string[];
  focusAssigneeInput: string;
  pubIds: string[];
  pubIdsInput: string;
  keyword: string;
  cpc: string;
  assigneeFilter: string;
  from: string;
  to: string;
  bucket: "month" | "quarter";
  competitors: string[];
  competitorsInput: string;
  competitorToggle: boolean;
};

const INITIAL_SCOPE_STATE: ScopePanelState = {
  mode: "assignee",
  focusAssigneeNames: [],
  focusAssigneeInput: "",
  pubIds: [],
  pubIdsInput: "",
  keyword: "",
  cpc: "",
  assigneeFilter: "",
  from: "",
  to: "",
  bucket: "month",
  competitors: [],
  competitorsInput: "",
  competitorToggle: false,
};

const pageWrapperStyle: React.CSSProperties = {
  padding: "48px 24px 64px",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  gap: 32,
};

type TokenGetter = () => Promise<string | undefined>;

const cardClass = "glass-card p-5 rounded-xl shadow-xl border border-white/50";

const fieldLabel = "text-xs font-semibold uppercase tracking-wide text-[#3A506B]";

const mainTitle = "text-base uppercase text-[#102A43]";

const sectionTitle = "text-sm font-semibold text-[#102A43]";

const sectionSubtitle = "text-xs text-[#3A506B]";

const controlBaseClass =
  "border border-slate-200/70 bg-white/80 text-[#102A43] shadow-[0_12px_22px_rgba(15,23,42,0.18)] backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300 transition";
const inputClass = `w-full rounded-xl px-2 py-2 text-xs ${controlBaseClass}`;
const selectClass = `w-full rounded-xl px-2 py-2 text-xs ${controlBaseClass}`;
const inlineInputClass = `h-8 rounded-lg px-2 text-xs ${controlBaseClass}`;

const ROWS_PER_PAGE = 5;
const SMALL_ROWS_PER_PAGE = 12;

type SortDirection = "asc" | "desc";

function parseListInput(value: string, opts?: { allowSpaceDelimiter?: boolean }): string[] {
  const delimiter = opts?.allowSpaceDelimiter ? /[\n,; ]+/ : /[\n,;]+/;
  return value
    .split(delimiter)
    .map((v) => v.trim())
    .filter(Boolean);
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const s = String(value);
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

function googlePatentsUrl(pubId: string): string {
  const cleaned = pubId.replace(/[-\s]/g, "");
  const match = cleaned.match(/^(US)(\d{4})(\d{6})(A\d{1,2})$/);
  const normalized = match ? `${match[1]}${match[2]}0${match[3]}${match[4]}` : cleaned;
  return `https://patents.google.com/patent/${normalized}`;
}

function parseDateValue(value: string | null | undefined): number {
  if (!value) return 0;
  const str = String(value);
  if (/^\d{8}$/.test(str)) {
    const iso = `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
    const ts = Date.parse(iso);
    if (!Number.isNaN(ts)) return ts;
  }
  const ts = Date.parse(str);
  return Number.isNaN(ts) ? 0 : ts;
}

function compareValues(a: string | number | null | undefined, b: string | number | null | undefined, direction: SortDirection): number {
  const dir = direction === "asc" ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") {
    return (a - b) * dir;
  }
  const aStr = (a ?? "").toString().toLowerCase();
  const bStr = (b ?? "").toString().toLowerCase();
  return aStr.localeCompare(bStr) * dir;
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: "left" | "right" | "center";
}) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2 border-b cursor-pointer select-none ${alignClass}`}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      scope="col"
    >
      <span className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-[#3A506B]">
        <span>{label}</span>
        <span className="text-base text-[#3A506B]">{active ? (direction === "asc" ? "↑" : "↓") : "⇅"}</span>
      </span>
    </th>
  );
}

function ScoreBar({ value, color = "sky" }: { value: number; color?: "sky" | "amber" | "rose" }) {
  const clamped = Math.max(0, Math.min(100, value));
  const palette: Record<string, string> = {
    sky: "bg-sky-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  };
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
      <div className={`${palette[color]} h-2`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function MetricTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl bg-white/70 border border-slate-200 px-4 py-3 shadow-sm">
      <div className="text-xs font-semibold text-[#3A506B] uppercase tracking-wide">{label}</div>
      <div className="text-xs font-semibold text-[#102A43] mt-1">{value}</div>
      {hint ? <div className="text-xs text-[#3A506B] mt-1">{hint}</div> : null}
    </div>
  );
}

function LineChart({
  points,
  valueKey = "citing_count",
  height = 220,
  accent = "#0ea5e9",
}: {
  points: Array<{ bucket_start: string; [k: string]: any }>;
  valueKey?: string;
  height?: number;
  accent?: string;
}) {
  if (!points.length) {
    return (
      <div className="h-[220px] grid place-items-center text-xs text-[#3A506B]">
        No timeline data for this scope.
      </div>
    );
  }
  const values = points.map((p) => Number(p[valueKey] ?? 0));
  const maxVal = Math.max(...values, 1);
  const width = Math.max(360, points.length * 70);
  const margin = 24;
  const step = points.length > 1 ? (width - margin * 2) / (points.length - 1) : 0;
  const coords = points.map((p, idx) => {
    const x = margin + idx * step;
    const y = margin + (1 - (Number(p[valueKey] ?? 0) / maxVal)) * (height - margin * 2);
    return [x, y];
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="min-w-full">
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.26" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} V${height - margin} H${margin} Z`} fill="url(#chartFill)" />
        <path d={path} fill="none" stroke={accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {coords.map(([x, y], idx) => (
          <g key={idx}>
            <circle cx={x} cy={y} r={4} fill="#fff" stroke={accent} strokeWidth={2} />
            <text x={x} y={height - 6} textAnchor="middle" className="text-[11px] fill-[#3A506B]">
              {fmtDate(points[idx].bucket_start).slice(0, 7)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

async function postCitation(path: string, payload: any, tokenGetter: TokenGetter) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = await tokenGetter();
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `HTTP ${resp.status}`);
  }
  return resp.json();
}

function updateUrlFromScope(scope: CitationScope, mode: ScopeMode, competitors: string[]) {
  const params = new URLSearchParams();
  params.set("mode", mode);
  params.set("bucket", scope.bucket || "month");
  if (scope.focus_assignee_names?.length) params.set("assignee_names", scope.focus_assignee_names.join(","));
  if (scope.focus_pub_ids?.length) params.set("pub_ids", scope.focus_pub_ids.join(","));
  if (scope.filters?.keyword) params.set("keyword", scope.filters.keyword);
  if (scope.filters?.cpc) params.set("cpc", scope.filters.cpc);
  if (scope.filters?.assignee) params.set("assignee", scope.filters.assignee);
  if (scope.citing_pub_date_from) params.set("from", scope.citing_pub_date_from);
  if (scope.citing_pub_date_to) params.set("to", scope.citing_pub_date_to);
  if (competitors.length) params.set("competitors", competitors.join(","));
  const url = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", url);
}

function MainHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className={mainTitle}>{title}</h2>
      <p className={sectionSubtitle}>{subtitle}</p>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className={sectionTitle}>{title}</h2>
      <p className={sectionSubtitle}>{subtitle}</p>
    </div>
  );
}

type ForwardImpactCardProps = {
  scope: CitationScope | null;
  scopeVersion: number;
  tokenGetter: TokenGetter;
};

type ForwardSortKey = "patent" | "assignee" | "pub_date" | "fwd" | "velocity" | "first_citation" | "last_citation";

function ForwardImpactCard({ scope, scopeVersion, tokenGetter }: ForwardImpactCardProps) {
  const [topN, setTopN] = useState(50);
  const [bucketOverride, setBucketOverride] = useState<"month" | "quarter" | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ForwardImpactResponse | null>(null);
  const [impactPage, setImpactPage] = useState(1);
  const [impactSort, setImpactSort] = useState<{ key: ForwardSortKey; direction: SortDirection }>({
    key: "fwd",
    direction: "desc",
  });

  const handleImpactSort = useCallback((key: ForwardSortKey) => {
    setImpactSort((prev) =>
      prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }
    );
  }, []);

  const load = useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        scope: { ...scope, bucket: (bucketOverride || scope.bucket || "month") as "month" | "quarter" },
        top_n: topN,
      };
      const json = await postCitation("/api/citation/impact", payload, tokenGetter);
      setData(json);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load impact");
    } finally {
      setLoading(false);
    }
  }, [scope, bucketOverride, topN, tokenGetter]);

  useEffect(() => {
    load();
  }, [load, scopeVersion]);

  const medianVelocity = useMemo(() => {
    if (!data?.top_patents?.length) return 0;
    const values = data.top_patents.map((p) => p.fwd_citation_velocity || 0).sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  }, [data]);

  const sortedPatents = useMemo(() => {
    if (!data?.top_patents) return [];
    const getValue = (p: PatentImpactSummary) => {
      switch (impactSort.key) {
        case "patent":
          return p.pub_id || "";
        case "assignee":
          return p.assignee_name || "";
        case "pub_date":
          return parseDateValue(p.pub_date);
        case "velocity":
          return p.fwd_citation_velocity ?? 0;
        case "first_citation":
          return parseDateValue(p.first_citation_date);
        case "last_citation":
          return parseDateValue(p.last_citation_date);
        default:
          return p.fwd_citation_count ?? 0;
      }
    };
    return [...data.top_patents].sort((a, b) => compareValues(getValue(a), getValue(b), impactSort.direction));
  }, [data, impactSort]);

  useEffect(() => {
    setImpactPage(1);
  }, [data, impactSort]);

  const impactTotalPages = Math.max(1, Math.ceil(sortedPatents.length / ROWS_PER_PAGE));
  const currentImpactPage = Math.min(impactPage, impactTotalPages);
  const pagedPatents = sortedPatents.slice(
    (currentImpactPage - 1) * ROWS_PER_PAGE,
    currentImpactPage * ROWS_PER_PAGE
  );

  return (
    <div className={`${cardClass} relative`}>
      <button
        onClick={load}
        className="refresh-btn absolute right-5 top-2 px-4 text-3xl font-semibold"
        disabled={loading || !scope}
      >
        {loading ? "…" : "⟳"}
      </button>
      <div className="flex items-start justify-between gap-3 mb-3 pr-12">
        <SectionHeader title="Forward-Citation Impact" subtitle="Velocity, timeline, and top cited patents." />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-[#3A506B]">
            <span>Top N</span>
            <input
              type="number"
              min={1}
              max={200}
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value) || 1)}
              className={inlineInputClass}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-[#3A506B]">
            <span>Bucket</span>
            <select
              value={bucketOverride}
              onChange={(e) => setBucketOverride(e.target.value as any)}
              className={inlineInputClass}
            >
              <option value="">Scope</option>
              <option value="month">Month</option>
              <option value="quarter">Quarter</option>
            </select>
          </label>
        </div>
      </div>

      {!scope ? (
        <div className="text-xs text-slate-400">Apply a scope to view citation impact.</div>
      ) : error ? (
        <div className="text-xs text-rose-600">Error: {error}</div>
      ) : loading && !data ? (
        <div className="text-xs text-[#3A506B]">…</div>
      ) : data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MetricTile label="Total forward citations" value={data.total_forward_citations} />
            <MetricTile label="Distinct citing patents" value={data.distinct_citing_patents} />
            <MetricTile label="Median velocity" value={`${medianVelocity.toFixed(2)}/mo`} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-[#102A43]">Influence timeline</h3>
              <div className="text-xs text-[#3A506B]">Count of citing patents by bucket</div>
            </div>
            <LineChart points={data.timeline} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr>
                  <SortableHeader
                    label="Patent"
                    active={impactSort.key === "patent"}
                    direction={impactSort.direction}
                    onClick={() => handleImpactSort("patent")}
                  />
                  <SortableHeader
                    label="Assignee"
                    active={impactSort.key === "assignee"}
                    direction={impactSort.direction}
                    onClick={() => handleImpactSort("assignee")}
                  />
                  <SortableHeader
                    label="Pub date"
                    active={impactSort.key === "pub_date"}
                    direction={impactSort.direction}
                    onClick={() => handleImpactSort("pub_date")}
                  />
                  <SortableHeader
                    label="Forward citations"
                    active={impactSort.key === "fwd"}
                    direction={impactSort.direction}
                    onClick={() => handleImpactSort("fwd")}
                  />
                  <SortableHeader
                    label="Velocity"
                    active={impactSort.key === "velocity"}
                    direction={impactSort.direction}
                    onClick={() => handleImpactSort("velocity")}
                  />
                  <SortableHeader
                    label="First citation"
                    active={impactSort.key === "first_citation"}
                    direction={impactSort.direction}
                    onClick={() => handleImpactSort("first_citation")}
                  />
                  <SortableHeader
                    label="Last citation"
                    active={impactSort.key === "last_citation"}
                    direction={impactSort.direction}
                    onClick={() => handleImpactSort("last_citation")}
                  />
                </tr>
              </thead>
              <tbody>
                {pagedPatents.map((p) => (
                  <tr key={p.pub_id} className="odd:bg-white even:bg-slate-50/60">
                    <td className="px-3 py-2 align-top text-xs">
                      <a href={googlePatentsUrl(p.pub_id)} target="_blank" rel="noreferrer" className="text-[#5FA8D2] font-medium text-xs hover:underline">
                        {p.pub_id}
                      </a>
                      <div className="text-[#102A43] text-xs">{p.title}</div>
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-[#102A43]">{p.assignee_name || "—"}</td>
                    <td className="px-3 py-2 align-top text-xs text-[#102A43]">{fmtDate(p.pub_date)}</td>
                    <td className="px-3 py-2 align-top text-xs font-semibold text-[#102A43]">{p.fwd_citation_count}</td>
                    <td className="px-3 py-2 align-top text-xs text-[#102A43]">
                      <div className="flex items-center gap-2">
                        <div className="w-16">
                          <ScoreBar value={Math.min(100, p.fwd_citation_velocity * 20)} />
                        </div>
                        <span>{p.fwd_citation_velocity.toFixed(2)}/mo</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-[#102A43]">{fmtDate(p.first_citation_date)}</td>
                    <td className="px-3 py-2 align-top text-xs text-[#102A43]">{fmtDate(p.last_citation_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedPatents.length ? (
            <div className="flex items-center justify-between mt-3 text-xs text-[#102A43]">
              <span>
                Showing {(currentImpactPage - 1) * ROWS_PER_PAGE + 1}-
                {Math.min(currentImpactPage * ROWS_PER_PAGE, sortedPatents.length)} of {sortedPatents.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1 rounded-lg border border-slate-200 bg-white/80 disabled:opacity-50"
                  onClick={() => setImpactPage((p) => Math.max(1, p - 1))}
                  disabled={currentImpactPage === 1}
                >
                  Prev
                </button>
                <span>
                  Page {currentImpactPage} / {impactTotalPages}
                </span>
                <button
                  className="px-3 py-1 rounded-lg border border-slate-200 bg-white/80 disabled:opacity-50"
                  onClick={() => setImpactPage((p) => Math.min(impactTotalPages, p + 1))}
                  disabled={currentImpactPage === impactTotalPages}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-xs text-[#3A506B]">No data for this scope.</div>
      )}
    </div>
  );
}

type DependencyMatrixCardProps = {
  scope: CitationScope | null;
  scopeVersion: number;
  tokenGetter: TokenGetter;
  competitorNames: string[] | null;
};

function DependencyMatrixCard({ scope, scopeVersion, tokenGetter, competitorNames }: DependencyMatrixCardProps) {
  const [minCitations, setMinCitations] = useState(1);
  const [normalize, setNormalize] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DependencyMatrixResponse | null>(null);
  const [dependencyPage, setDependencyPage] = useState(1);

  const hasPortfolio = Boolean(scope?.focus_assignee_names?.length || scope?.focus_pub_ids?.length);

  const load = useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    setError(null);
    try {
      const payload = { scope, min_citations: minCitations, normalize };
      const json = await postCitation("/api/citation/dependency-matrix", payload, tokenGetter);
      setData(json);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load matrix");
    } finally {
      setLoading(false);
    }
  }, [scope, minCitations, normalize, tokenGetter]);

  useEffect(() => {
    load();
  }, [load, scopeVersion]);

  const filteredEdges = useMemo(() => {
    if (!data?.edges) return [];
    if (!competitorNames?.length) return data.edges;
    const needles = competitorNames.map((n) => n.toLowerCase()).filter(Boolean);
    return data.edges.filter((e) => {
      const citing = (e.citing_assignee_name || "").toLowerCase();
      const cited = (e.cited_assignee_name || "").toLowerCase();
      return needles.some((n) => citing.includes(n) || cited.includes(n));
    });
  }, [data, competitorNames]);

  const topEdges = useMemo(
    () => filteredEdges.slice().sort((a, b) => b.citation_count - a.citation_count),
    [filteredEdges]
  );

  useEffect(() => {
    setDependencyPage(1);
  }, [filteredEdges]);

  const citingNames = useMemo(() => {
    const names: string[] = [];
    for (const e of topEdges) {
      const name = e.citing_assignee_name || "Unknown";
      if (!names.includes(name)) names.push(name);
      if (names.length >= 8) break;
    }
    return names;
  }, [topEdges]);
  const citedNames = useMemo(() => {
    const names: string[] = [];
    for (const e of topEdges) {
      const name = e.cited_assignee_name || "Unknown";
      if (!names.includes(name)) names.push(name);
      if (names.length >= 8) break;
    }
    return names;
  }, [topEdges]);
  const maxVal = topEdges.reduce((m, e) => Math.max(m, e.citation_count), 0) || 1;
  const hasEdges = topEdges.length > 0;
  const dependencyTotalPages = Math.max(1, Math.ceil(topEdges.length / SMALL_ROWS_PER_PAGE));
  const currentDependencyPage = Math.min(dependencyPage, dependencyTotalPages);
  const pagedEdges = topEdges.slice(
    (currentDependencyPage - 1) * SMALL_ROWS_PER_PAGE,
    currentDependencyPage * SMALL_ROWS_PER_PAGE
  );

  return (
    <div className={`${cardClass} relative`}>
      <button onClick={load} className="refresh-btn absolute right-5 top-2 px-4 text-3xl font-semibold" disabled={!scope || loading}>
        {loading ? "…" : "⟳"}
      </button>
      <div className="flex items-start justify-between gap-3 mb-3 pr-12">
        <SectionHeader title="Cross-Assignee Dependency" subtitle="Citing → cited relationships across portfolios." />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[#3A506B]">
            <span>Min citations</span>
            <input
              type="number"
              min={1}
              max={50}
              value={minCitations}
              onChange={(e) => setMinCitations(Number(e.target.value) || 1)}
              className={inlineInputClass}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-[#3A506B]">
            <input type="checkbox" checked={normalize} onChange={(e) => setNormalize(e.target.checked)} />
            <span>Normalize</span>
          </label>
        </div>
      </div>
      {!scope ? (
        <div className="text-xs text-slate-400">Apply a scope to view dependency insights.</div>
      ) : !hasPortfolio ? (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          Set a source portfolio (assignee or pub IDs) for meaningful dependency analysis.
        </div>
      ) : error ? (
        <div className="text-xs text-rose-600">Error: {error}</div>
      ) : loading && !data ? (
        <div className="text-xs text-[#3A506B]">…</div>
      ) : data && hasEdges ? (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr>
                  <th className="px-3 py-2 border-b"></th>
                  {citedNames.map((name) => (
                    <th key={name} className="px-3 py-2 border-b text-xs text-[#3A506B] text-left">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {citingNames.map((row) => (
                  <tr key={row}>
                    <th className="px-3 py-2 border-b text-xs text-[#102A43] text-left">{row}</th>
                    {citedNames.map((col) => {
                      const edge = topEdges.find(
                        (e) => (e.citing_assignee_name || "Unknown") === row && (e.cited_assignee_name || "Unknown") === col
                      );
                      const val = edge?.citation_count || 0;
                      const pct = val / maxVal;
                      const bg = `rgba(14,165,233,${0.15 + pct * 0.6})`;
                      return (
                        <td key={col} className="px-3 py-2 border-b text-xs text-[#102A43]" style={{ background: bg }}>
                          {val}
                          {normalize && edge?.citing_to_cited_pct != null ? (
                            <div className="text-[11px] text-[#3A506B]">{(edge.citing_to_cited_pct * 100).toFixed(1)}%</div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-[#3A506B]">
                  <th className="px-3 py-2 border-b text-left">Citing Assignee</th>
                  <th className="px-3 py-2 border-b text-left">Cited Assignee</th>
                  <th className="px-3 py-2 border-b text-left">Citations</th>
                  <th className="px-3 py-2 border-b text-left">Cited / Citing Assignee (%)</th>
                </tr>
              </thead>
              <tbody>
                {pagedEdges.map((e, idx) => {
                  const rowKey = `${e.citing_assignee_id || e.citing_assignee_name || "unknown"}-${e.cited_assignee_id || e.cited_assignee_name || "unknown"}-${(currentDependencyPage - 1) * SMALL_ROWS_PER_PAGE + idx}`;
                  return (
                    <tr key={rowKey} className="odd:bg-white even:bg-slate-50/60">
                      <td className="px-3 py-2 text-xs text-[#102A43]">{e.citing_assignee_name || "Unknown"}</td>
                      <td className="px-3 py-2 text-xs text-[#102A43]">{e.cited_assignee_name || "Unknown"}</td>
                      <td className="px-3 py-2 text-xs font-semibold text-[#102A43]">{e.citation_count}</td>
                      <td className="px-3 py-2 text-xs text-[#102A43]">
                        {normalize && e.citing_to_cited_pct != null ? `${(e.citing_to_cited_pct * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {topEdges.length ? (
            <div className="flex items-center justify-between mt-3 text-xs text-[#102A43]">
              <span>
                Showing {(currentDependencyPage - 1) * ROWS_PER_PAGE + 1}-
                {Math.min(currentDependencyPage * ROWS_PER_PAGE, topEdges.length)} of {topEdges.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1 rounded-lg border border-slate-200 bg-white/80 disabled:opacity-50"
                  onClick={() => setDependencyPage((p) => Math.max(1, p - 1))}
                  disabled={currentDependencyPage === 1}
                >
                  Prev
                </button>
                <span>
                  Page {currentDependencyPage} / {dependencyTotalPages}
                </span>
                <button
                  className="px-3 py-1 rounded-lg border border-slate-200 bg-white/80 disabled:opacity-50"
                  onClick={() => setDependencyPage((p) => Math.min(dependencyTotalPages, p + 1))}
                  disabled={currentDependencyPage === dependencyTotalPages}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : data ? (
        <div className="text-xs text-[#3A506B]">
          No dependency edges for this scope{competitorNames?.length ? " with the listed competitors applied." : "."}
        </div>
      ) : (
        <div className="text-xs text-[#3A506B]">No dependency edges for this scope.</div>
      )}
    </div>
  );
}

type RiskRadarCardProps = {
  scope: CitationScope | null;
  scopeVersion: number;
  tokenGetter: TokenGetter;
  competitorNames: string[] | null;
};

type RiskSortKey =
  | "patent"
  | "assignee"
  | "fwd"
  | "from_competitors"
  | "bwd"
  | "exposure"
  | "fragility"
  | "overall";

function RiskRadarCard({ scope, scopeVersion, tokenGetter, competitorNames }: RiskRadarCardProps) {
  const [topN, setTopN] = useState(200);
  const [riskSort, setRiskSort] = useState<{ key: RiskSortKey; direction: SortDirection }>({
    key: "overall",
    direction: "desc",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RiskRadarResponse | null>(null);
  const [riskPage, setRiskPage] = useState(1);
  const handleRiskSort = useCallback((key: RiskSortKey) => {
    setRiskSort((prev) =>
      prev.key === key ? { key, direction: prev.direction === "desc" ? "asc" : "desc" } : { key, direction: "desc" }
    );
  }, []);

  const load = useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        scope,
        competitor_assignee_names: competitorNames && competitorNames.length ? competitorNames : null,
        top_n: topN,
      };
      const json = await postCitation("/api/citation/risk-radar", payload, tokenGetter);
      setData(json);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load risk data");
    } finally {
      setLoading(false);
    }
  }, [scope, competitorNames, topN, tokenGetter]);

  useEffect(() => {
    load();
  }, [load, scopeVersion]);

  const sortedRows = useMemo(() => {
    if (!data?.patents) return [];
    const getValue = (p: PatentRiskMetrics) => {
      switch (riskSort.key) {
        case "patent":
          return p.pub_id || "";
        case "assignee":
          return p.assignee_name || "";
        case "fwd":
          return p.fwd_total;
        case "from_competitors":
          return p.fwd_from_competitors;
        case "bwd":
          return p.bwd_total;
        case "exposure":
          return p.exposure_score;
        case "fragility":
          return p.fragility_score;
        default:
          return p.overall_risk_score;
      }
    };
    return [...data.patents].sort((a, b) => compareValues(getValue(a), getValue(b), riskSort.direction));
  }, [data, riskSort]);

  useEffect(() => {
    setRiskPage(1);
  }, [data, riskSort]);

  const riskTotalPages = Math.max(1, Math.ceil(sortedRows.length / ROWS_PER_PAGE));
  const currentRiskPage = Math.min(riskPage, riskTotalPages);
  const pagedRiskRows = sortedRows.slice(
    (currentRiskPage - 1) * ROWS_PER_PAGE,
    currentRiskPage * ROWS_PER_PAGE
  );

  const [exporting, setExporting] = useState(false);

  const exportPdf = useCallback(async () => {
    if (!scope || !data?.patents?.length) return;
    setExporting(true);
    try {
      const exportSortKey: "overall" | "exposure" | "fragility" | "fwd" =
        riskSort.key === "exposure" || riskSort.key === "fragility" || riskSort.key === "fwd" ? riskSort.key : "overall";
      const payload = {
        scope,
        competitor_assignee_names: competitorNames && competitorNames.length ? competitorNames : null,
        top_n: topN,
        sort_by: exportSortKey,
      };
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = await tokenGetter();
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp = await fetch("/api/citation/risk-radar/export", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      if (!resp.ok) {
        const text = await resp.text();
        let message = text || `Export failed (${resp.status})`;
        try {
          const parsed = JSON.parse(text);
          message = parsed.detail || parsed.error || message;
        } catch (err) {
          // fall through if body is not JSON
        }
        throw new Error(message);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "risk_radar.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message ?? "Failed to export PDF");
    } finally {
      setExporting(false);
    }
  }, [scope, data, competitorNames, topN, riskSort, tokenGetter]);

  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <SectionHeader title="Risk Radar" subtitle="Forward exposure + backward fragility indicators." />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[#3A506B]">
            <span>Top N</span>
            <input
              type="number"
              min={10}
              max={400}
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value) || 10)}
              className={inlineInputClass}
            />
          </label>
          <button
            className="btn-outline h-9 px-4 text-xs font-semibold"
            onClick={exportPdf}
            disabled={!data?.patents?.length || exporting || loading}
          >
            {exporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </div>
      {!scope ? (
        <div className="text-xs text-slate-400">Apply a scope to view risk signals.</div>
      ) : error ? (
        <div className="text-xs text-rose-600">Error: {error}</div>
      ) : loading && !data ? (
        <div className="text-xs text-[#3A506B]">…</div>
      ) : data ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <SortableHeader
                  label="Patent"
                  active={riskSort.key === "patent"}
                  direction={riskSort.direction}
                  onClick={() => handleRiskSort("patent")}
                />
                <SortableHeader
                  label="Assignee"
                  active={riskSort.key === "assignee"}
                  direction={riskSort.direction}
                  onClick={() => handleRiskSort("assignee")}
                />
                <SortableHeader
                  label="Forward citations"
                  active={riskSort.key === "fwd"}
                  direction={riskSort.direction}
                  onClick={() => handleRiskSort("fwd")}
                />
                <SortableHeader
                  label="From competitors"
                  active={riskSort.key === "from_competitors"}
                  direction={riskSort.direction}
                  onClick={() => handleRiskSort("from_competitors")}
                />
                <SortableHeader
                  label="Backward cites"
                  active={riskSort.key === "bwd"}
                  direction={riskSort.direction}
                  onClick={() => handleRiskSort("bwd")}
                />
                <SortableHeader
                  label="Exposure"
                  active={riskSort.key === "exposure"}
                  direction={riskSort.direction}
                  onClick={() => handleRiskSort("exposure")}
                />
                <SortableHeader
                  label="Fragility"
                  active={riskSort.key === "fragility"}
                  direction={riskSort.direction}
                  onClick={() => handleRiskSort("fragility")}
                />
                <SortableHeader
                  label="Overall"
                  active={riskSort.key === "overall"}
                  direction={riskSort.direction}
                  onClick={() => handleRiskSort("overall")}
                />
              </tr>
            </thead>
            <tbody>
              {pagedRiskRows.map((p) => (
                <tr key={p.pub_id} className="odd:bg-white even:bg-slate-50/60">
                  <td className="px-3 py-2 align-top">
                    <a href={googlePatentsUrl(p.pub_id)} target="_blank" rel="noreferrer" className="text-[#5FA8D2] font-medium text-xs hover:underline">
                      {p.pub_id}
                    </a>
                    <div className="text-xs text-[#102A43]">{p.title}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-[#102A43]">{p.assignee_name || "—"}</td>
                  <td className="px-3 py-2 text-xs font-semibold text-[#102A43]">{p.fwd_total}</td>
                  <td className="px-3 py-2 text-xs text-[#102A43]">
                    {p.fwd_from_competitors}{" "}
                    {p.fwd_competitor_ratio != null ? (
                      <span className="text-xs text-[#3A506B]">({(p.fwd_competitor_ratio * 100).toFixed(1)}%)</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-[#102A43]">{p.bwd_total}</td>
                  <td className="px-3 py-2 text-xs text-[#102A43]">
                    <div className="w-24"><ScoreBar value={p.exposure_score} color="sky" /></div>
                    <div className="text-xs text-[#3A506B] mt-1">{p.exposure_score.toFixed(1)}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-[#102A43]">
                    <div className="w-24"><ScoreBar value={p.fragility_score} color="amber" /></div>
                    <div className="text-xs text-[#3A506B] mt-1">{p.fragility_score.toFixed(1)}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-[#102A43] font-semibold">
                    <div className="w-24"><ScoreBar value={p.overall_risk_score} color="rose" /></div>
                    <div className="text-xs text-[#3A506B] mt-1">{p.overall_risk_score.toFixed(1)}</div>
                  </td>
                </tr>
                ))}
            </tbody>
          </table>
          {sortedRows.length ? (
            <div className="flex items-center justify-between mt-3 text-xs text-[#102A43]">
              <span>
                Showing {(currentRiskPage - 1) * ROWS_PER_PAGE + 1}-
                {Math.min(currentRiskPage * ROWS_PER_PAGE, sortedRows.length)} of {sortedRows.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1 rounded-lg border border-slate-200 bg-white/80 disabled:opacity-50"
                  onClick={() => setRiskPage((p) => Math.max(1, p - 1))}
                  disabled={currentRiskPage === 1}
                >
                  Prev
                </button>
                <span>
                  Page {currentRiskPage} / {riskTotalPages}
                </span>
                <button
                  className="px-3 py-1 rounded-lg border border-slate-200 bg-white/80 disabled:opacity-50"
                  onClick={() => setRiskPage((p) => Math.min(riskTotalPages, p + 1))}
                  disabled={currentRiskPage === riskTotalPages}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-xs text-[#3A506B]">No risk signals found for this scope.</div>
      )}
    </div>
  );
}

type EncroachmentCardProps = {
  scope: CitationScope | null;
  scopeVersion: number;
  tokenGetter: TokenGetter;
  competitorNames: string[] | null;
};

function EncroachmentCard({ scope, scopeVersion, tokenGetter, competitorNames }: EncroachmentCardProps) {
  const [bucket, setBucket] = useState<"month" | "quarter">("quarter");
  const [topK, setTopK] = useState(10);
  const [explicitOnly, setExplicitOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EncroachmentResponse | null>(null);

  const hasTargets = Boolean(scope?.focus_assignee_names?.length);
  const scopedCompetitors = competitorNames && competitorNames.length ? competitorNames : null;
  const scopeEnforcedCompetitors = Boolean(scopedCompetitors);
  const limitToListed = scopeEnforcedCompetitors || explicitOnly;

  const load = useCallback(async () => {
    if (!scope || !hasTargets) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        target_assignee_names: scope.focus_assignee_names,
        competitor_assignee_names: limitToListed && scopedCompetitors ? scopedCompetitors : null,
        citing_pub_date_from: scope.citing_pub_date_from || null,
        citing_pub_date_to: scope.citing_pub_date_to || null,
        bucket,
      };
      const json = await postCitation("/api/citation/encroachment", payload, tokenGetter);
      setData(json);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load encroachment");
    } finally {
      setLoading(false);
    }
  }, [scope, hasTargets, limitToListed, scopedCompetitors, bucket, tokenGetter]);

  useEffect(() => {
    load();
  }, [load, scopeVersion]);

  const totalsByComp = useMemo(() => {
    if (!data?.timeline) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const pt of data.timeline) {
      const key = pt.competitor_assignee_id || pt.competitor_assignee_name || "Unknown";
      map.set(key, (map.get(key) || 0) + (pt.citing_patent_count || 0));
    }
    return map;
  }, [data]);

  const topCompetitorKeys = useMemo(() => {
    const entries = Array.from(totalsByComp.entries()).sort((a, b) => b[1] - a[1]);
    return entries.slice(0, topK).map(([k]) => k);
  }, [totalsByComp, topK]);

  const filteredTimeline = useMemo(() => {
    if (!data?.timeline) return [];
    return data.timeline.filter((pt) => {
      const key = pt.competitor_assignee_id || pt.competitor_assignee_name || "Unknown";
      return topCompetitorKeys.includes(key);
    });
  }, [data, topCompetitorKeys]);

  const competitorLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const pt of filteredTimeline) {
      const key = pt.competitor_assignee_id || pt.competitor_assignee_name || "Unknown";
      if (!map.has(key)) {
        map.set(key, pt.competitor_assignee_name || pt.competitor_assignee_id || "Unknown");
      }
    }
    if (data?.competitors) {
      data.competitors.forEach((c) => {
        const key = c.competitor_assignee_id || c.competitor_assignee_name || "Unknown";
        if (!map.has(key)) {
          map.set(key, c.competitor_assignee_name || c.competitor_assignee_id || "Unknown");
        }
      });
    }
    return map;
  }, [filteredTimeline, data?.competitors]);

  const bucketLabels = useMemo(() => {
    const set = new Set<string>();
    for (const pt of filteredTimeline) {
      if (pt.bucket_start) set.add(pt.bucket_start);
    }
    return Array.from(set).sort();
  }, [filteredTimeline]);

  const seriesByKey = useMemo(() => {
    const groups: Record<string, Record<string, number>> = {};
    for (const pt of filteredTimeline) {
      const key = pt.competitor_assignee_id || pt.competitor_assignee_name || "Unknown";
      groups[key] = groups[key] || {};
      groups[key][pt.bucket_start] = pt.citing_patent_count || 0;
    }
    return groups;
  }, [filteredTimeline]);

  const maxTimelineVal = useMemo(() => {
    let max = 0;
    for (const pt of filteredTimeline) {
      max = Math.max(max, pt.citing_patent_count || 0);
    }
    return max || 1;
  }, [filteredTimeline]);

  const colorPalette = ["#0ea5e9", "#f59e0b", "#ef4444", "#10b981", "#6366f1", "#8b5cf6", "#14b8a6", "#f97316"];

  return (
    <div className={`${cardClass} relative`}>
      <button
        className="refresh-btn absolute right-5 top-2 px-4 text-3xl font-semibold"
        disabled={!hasTargets || loading}
        onClick={load}
      >
        {loading ? "…" : "⟳"}
      </button>
      <div className="flex flex-col gap-3 mb-3 pr-12 sm:flex-row sm:items-start sm:gap-4">
        <SectionHeader title="Assignee Encroachment" subtitle="Other assignee forward citations into a portfolio." />
        <div className="flex flex-col gap-2 items-start sm:ml-auto sm:flex-row sm:items-start sm:gap-3">
          <div className="flex flex-wrap items-center gap-3 sm:justify-end sm:min-w-[200px]">
            <label className="flex items-center gap-2 text-xs text-[#3A506B]">
              <span>Bucket</span>
              <select value={bucket} onChange={(e) => setBucket(e.target.value as any)} className={inlineInputClass}>
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-[#3A506B]">
              <input
                type="checkbox"
                checked={limitToListed}
                disabled={scopeEnforcedCompetitors}
                onChange={(e) => setExplicitOnly(e.target.checked)}
              />
              <span>Only listed{scopeEnforcedCompetitors ? " (scope)" : ""}</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-[#3A506B]">
              <span>Top competitors</span>
              <input
                type="number"
                min={1}
                max={25}
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value) || 3)}
                className={inlineInputClass}
              />
            </label>
          </div>
        </div>
      </div>
      {!hasTargets ? (
        <div className="text-xs text-slate-400">
          Apply a source assignee in the Scope panel to view.
        </div>
      ) : error ? (
        <div className="text-xs text-rose-600">Error: {error}</div>
      ) : loading && !data ? (
        <div className="text-xs text-[#3A506B]">…</div>
      ) : data ? (
        <div className="space-y-4">
          {limitToListed && !scopedCompetitors ? (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 inline-block">
              Add assignee names in the scope panel to limit the chart.
            </div>
          ) : null}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-[#102A43]">Encroachment timeline</h3>
              <div className="text-xs text-[#3A506B]">Top {topK} assignees by citing patents/pubs</div>
            </div>
            {filteredTimeline.length ? (
              <div className="overflow-x-auto">
                {(() => {
                  const chartWidth = Math.max(560, bucketLabels.length * 110);
                  const chartHeight = 280;
                  const margin = { top: 24, right: 16, bottom: 38, left: 48 };
                  const innerWidth = chartWidth - margin.left - margin.right;
                  const innerHeight = chartHeight - margin.top - margin.bottom;
                  const step = bucketLabels.length > 1 ? innerWidth / (bucketLabels.length - 1) : innerWidth;
                  const xForIdx = (idx: number) => margin.left + idx * step;
                  const yForVal = (val: number) => margin.top + (1 - val / maxTimelineVal) * innerHeight;
                  const yTicks = Array.from(new Set([0, Math.ceil(maxTimelineVal / 2), maxTimelineVal])).sort((a, b) => a - b);
                  return (
                    <svg width={chartWidth} height={chartHeight} className="min-w-full">
                      <defs>
                        <linearGradient id="encroachBg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#e2e8f0" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#e2e8f0" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <rect
                        x={margin.left - 20}
                        y={margin.top - 10}
                        width={chartWidth - margin.left - margin.right + 40}
                        height={innerHeight + 20}
                        rx={12}
                        fill="url(#encroachBg)"
                        className="fill-slate-50"
                      />
                      {yTicks.map((tick) => {
                        const y = yForVal(tick);
                        return (
                          <g key={`y-${tick}`}>
                            <line x1={margin.left} x2={chartWidth - margin.right} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
                            <text x={margin.left - 10} y={y + 4} textAnchor="end" className="text-[11px] fill-[#3A506B]">
                              {tick}
                            </text>
                          </g>
                        );
                      })}
                      {bucketLabels.map((bucket, idx) => {
                        const x = xForIdx(idx);
                        return (
                          <g key={`x-${bucket}`}>
                            <line x1={x} x2={x} y1={margin.top} y2={chartHeight - margin.bottom + 4} stroke="#e2e8f0" />
                            <text x={x} y={chartHeight - 12} textAnchor="middle" className="text-[11px] fill-[#3A506B]">
                              {fmtDate(bucket).slice(0, 7)}
                            </text>
                          </g>
                        );
                      })}
                      {topCompetitorKeys.map((key, seriesIdx) => {
                        const series = seriesByKey[key];
                        if (!series) return null;
                        const coords = bucketLabels.map((bucket, idx) => {
                          const val = series[bucket] ?? 0;
                          return [xForIdx(idx), yForVal(val), val] as const;
                        });
                        const color = colorPalette[seriesIdx % colorPalette.length];
                        const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
                        return (
                          <g key={key}>
                            <path d={path} fill="none" stroke={color} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
                            {coords.map(([x, y, val], idx) =>
                              val > 0 ? (
                                <g key={`${key}-${idx}`}>
                                  <circle cx={x} cy={y} r={4} fill="#fff" stroke={color} strokeWidth={2} />
                                </g>
                              ) : null
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
                <div className="flex flex-wrap gap-3 mt-3 text-xs text-[#102A43]">
                  {topCompetitorKeys.map((key, idx) => (
                    <span key={key} className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-white/70 border border-slate-200 shadow-sm">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colorPalette[idx % colorPalette.length] }} />
                      <span className="font-semibold">{competitorLabelMap.get(key) || "Unknown"}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#3A506B]">No encroachment signals for this window.</div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-[#3A506B]">
                  <th className="px-3 py-2 border-b text-left">Assignee</th>
                  <th className="px-3 py-2 border-b text-left">Total citing patents</th>
                  <th className="px-3 py-2 border-b text-left">Encroachment score</th>
                  <th className="px-3 py-2 border-b text-left">Velocity</th>
                </tr>
              </thead>
              <tbody>
                {data.competitors
                  .filter((c) => topCompetitorKeys.includes(c.competitor_assignee_id || c.competitor_assignee_name || "Unknown"))
                  .slice(0, topK)
                  .map((c, idx) => {
                    const compKey = c.competitor_assignee_id || c.competitor_assignee_name || `unknown-${idx}`;
                    const displayName =
                      competitorLabelMap.get(compKey) || c.competitor_assignee_name || c.competitor_assignee_id || "Unknown";
                    return (
                      <tr key={compKey} className="odd:bg-white even:bg-slate-50/60">
                        <td className="px-3 py-2 text-xs text-[#102A43]">{displayName}</td>
                        <td className="px-3 py-2 text-xs font-semibold text-[#102A43]">{c.total_citing_patents}</td>
                        <td className="px-3 py-2 text-xs text-[#102A43]">
                          <div className="w-24"><ScoreBar value={c.encroachment_score} color="rose" /></div>
                          <div className="text-xs text-[#3A506B] mt-1">{c.encroachment_score.toFixed(1)}</div>
                        </td>
                        <td className="px-3 py-2 text-xs text-[#102A43]">
                          {c.velocity != null ? `${c.velocity.toFixed(2)} / bucket` : "—"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-xs text-[#3A506B]">No encroachment results for this scope.</div>
      )}
    </div>
  );
}

export default function CitationPage() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [hydrated, setHydrated] = useState(false);
  const [scopeState, setScopeState] = useState<ScopePanelState>({ ...INITIAL_SCOPE_STATE });

  const [appliedScope, setAppliedScope] = useState<CitationScope | null>(null);
  const [appliedCompetitors, setAppliedCompetitors] = useState<string[] | null>(null);
  const [scopeVersion, setScopeVersion] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const focusAssigneeNames = parseListInput(params.get("assignee_names") || "");
    const pubIds = parseListInput(params.get("pub_ids") || "", { allowSpaceDelimiter: true });
    const competitors = parseListInput(params.get("competitors") || "");
    const nextState: ScopePanelState = {
      ...INITIAL_SCOPE_STATE,
      mode: (params.get("mode") as ScopeMode) || INITIAL_SCOPE_STATE.mode,
      bucket: (params.get("bucket") as "month" | "quarter") || INITIAL_SCOPE_STATE.bucket,
      focusAssigneeNames,
      focusAssigneeInput: focusAssigneeNames.join("\n"),
      pubIds,
      pubIdsInput: pubIds.join("\n"),
      keyword: params.get("keyword") || "",
      cpc: params.get("cpc") || "",
      assigneeFilter: params.get("assignee") || "",
      from: params.get("from") || "",
      to: params.get("to") || "",
      competitors,
      competitorsInput: competitors.join("\n"),
      competitorToggle: !!params.get("competitors"),
    };
    setScopeState(nextState);
    setHydrated(true);
    const shouldApply =
      nextState.focusAssigneeNames.length ||
      nextState.pubIds.length ||
      nextState.keyword ||
      nextState.cpc ||
      nextState.assigneeFilter;
    if (shouldApply) {
      const scope = buildScopeFromState(nextState);
      const competitors = nextState.competitorToggle ? nextState.competitors : [];
      setAppliedScope(scope);
      setAppliedCompetitors(competitors.length ? competitors : null);
      setScopeVersion((v) => v + 1);
    }
  }, []);

  const tokenGetter = useCallback(async () => {
    if (!isAuthenticated) return undefined;
    try {
      return await getAccessTokenSilently();
    } catch (err) {
      console.error("Token fetch failed", err);
      return undefined;
    }
  }, [getAccessTokenSilently, isAuthenticated]);

  function buildScopeFromState(state: ScopePanelState): CitationScope {
    const scope: CitationScope = {
      bucket: state.bucket,
      citing_pub_date_from: state.from || null,
      citing_pub_date_to: state.to || null,
    };
    if (state.mode === "assignee") {
      scope.focus_assignee_names = state.focusAssigneeNames;
    } else if (state.mode === "pub") {
      scope.focus_pub_ids = state.pubIds;
    } else {
      scope.filters = {
        keyword: state.keyword || undefined,
        cpc: state.cpc || undefined,
        assignee: state.assigneeFilter || undefined,
        date_from: state.from || undefined,
        date_to: state.to || undefined,
      };
    }
    return scope;
  }

  const applyScope = useCallback(() => {
    const scope = buildScopeFromState(scopeState);
    setAppliedScope(scope);
    const competitors = scopeState.competitorToggle ? scopeState.competitors : [];
    setAppliedCompetitors(competitors.length ? competitors : null);
    setScopeVersion((v) => v + 1);
    updateUrlFromScope(scope, scopeState.mode, competitors);
  }, [scopeState]);

  const clearScope = useCallback(() => {
    const cleared: ScopePanelState = { ...INITIAL_SCOPE_STATE };
    setScopeState({ ...cleared });
    setAppliedScope(null);
    setAppliedCompetitors(null);
    setScopeVersion((v) => v + 1);
    updateUrlFromScope({ bucket: "month" }, "assignee", []);
  }, []);

  const switchMode = useCallback((mode: ScopeMode) => {
    setScopeState((s) => ({
      ...s,
      mode,
      focusAssigneeNames: mode === "assignee" ? s.focusAssigneeNames : [],
      focusAssigneeInput: mode === "assignee" ? s.focusAssigneeInput : "",
      pubIds: mode === "pub" ? s.pubIds : [],
      pubIdsInput: mode === "pub" ? s.pubIdsInput : "",
      keyword: mode === "search" ? s.keyword : "",
      cpc: mode === "search" ? s.cpc : "",
      assigneeFilter: mode === "search" ? s.assigneeFilter : "",
    }));
  }, []);

  if (!hydrated) {
    return <div className="mx-auto max-w-7xl px-6 py-6 text-xs text-[#3A506B]">Loading citation workspace…</div>;
  }

  return (
    <div style={pageWrapperStyle}>
      <div className="glass-surface" style={pageSurfaceStyle}>
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 mb-2">
            Citation Intelligence
          </p>
          <h1 style={{ color: TEXT_COLOR, fontSize: 22, fontWeight: 700 }}>Patent & Publication Citation Tracker</h1>
          <p style={{ margin: 0, fontSize: 14, color: "#475569" }}>
            Discover forward citations, cross-assignee dependencies, risk signals, and assignee encroachment based on citation data published on patents and publications.
          </p>
        </div>

        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <MainHeader title="Scope" subtitle="Define portfolio, time window, and competitors for all widgets." />
          </div>
          <div className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start">
              <div className="md:w-56">
                <div className={fieldLabel}>Scope picker</div>
                <select
                  value={scopeState.mode}
                  onChange={(e) => switchMode(e.target.value as ScopeMode)}
                  className={selectClass}
                >
                  <option value="assignee">Assignee</option>
                  <option value="pub">Patent/Pub #</option>
                  <option value="search">Search Filters</option>
                </select>
              </div>
              <div className="flex-1 space-y-3">
                {scopeState.mode === "assignee" && (
                  <div>
                    <div className={fieldLabel}>Source assignee(s)</div>
                    <textarea
                      value={scopeState.focusAssigneeInput}
                      onChange={(e) =>
                    setScopeState((s) => ({
                      ...s,
                      focusAssigneeInput: e.target.value,
                      focusAssigneeNames: parseListInput(e.target.value),
                    }))
                  }
                  rows={3}
                  placeholder={"NVIDIA\nIBM\nSamsung"}
                  className={inputClass}
                />
                    <p className="text-[11px] text-[#3A506B] mt-1">
                      Enter one name per line; similarity matching will include aliases automatically.
                    </p>
                  </div>
                )}
                {scopeState.mode === "pub" && (
                  <div>
                    <div className={fieldLabel}>Portfolio patents/publications</div>
                    <textarea
                      value={scopeState.pubIdsInput}
                      onChange={(e) =>
                        setScopeState((s) => ({
                          ...s,
                          pubIdsInput: e.target.value,
                          pubIds: parseListInput(e.target.value, { allowSpaceDelimiter: true }),
                        }))
                      }
                      rows={4}
                      placeholder="US-12345678-B1, US-20250001234-A1"
                      className={inputClass}
                    />
                  </div>
                )}
                {scopeState.mode === "search" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className={fieldLabel}>Keyword</div>
                      <input
                        type="text"
                        value={scopeState.keyword}
                        onChange={(e) => setScopeState((s) => ({ ...s, keyword: e.target.value }))}
                        placeholder="Autonomous vehicles, 5G, …"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <div className={fieldLabel}>CPC</div>
                      <input
                        type="text"
                        value={scopeState.cpc}
                        onChange={(e) => setScopeState((s) => ({ ...s, cpc: e.target.value }))}
                        placeholder="G06N, H04W…"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <div className={fieldLabel}>Assignee</div>
                      <input
                        type="text"
                        value={scopeState.assigneeFilter}
                        onChange={(e) => setScopeState((s) => ({ ...s, assigneeFilter: e.target.value }))}
                        placeholder="Qualcomm, Intel, …"
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className={fieldLabel}>Target assignee(s)</div>
                <textarea
                  rows={3}
                  value={scopeState.competitorsInput}
                  onChange={(e) =>
                    setScopeState((s) => ({
                      ...s,
                      competitorsInput: e.target.value,
                      competitors: parseListInput(e.target.value),
                    }))
                  }
                  placeholder={"One assignee per line\nAssignee A\nAssignee B\n..."}
                  className={inputClass}
                />
                <label className="mt-1 inline-flex items-center gap-2 text-xs text-[#3A506B]">
                  <input
                    type="checkbox"
                    checked={scopeState.competitorToggle}
                    onChange={(e) => setScopeState((s) => ({ ...s, competitorToggle: e.target.checked }))}
                  />
                  Limit to listed competitors
                </label>
              </div>
              <div>
                <div className={fieldLabel}>From (citing)</div>
                <input
                  type="date"
                  value={scopeState.from}
                  onChange={(e) => setScopeState((s) => ({ ...s, from: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <div className={fieldLabel}>To (citing)</div>
                <input
                  type="date"
                  value={scopeState.to}
                  onChange={(e) => setScopeState((s) => ({ ...s, to: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <div className={fieldLabel}>Bucket</div>
                <select
                  value={scopeState.bucket}
                  onChange={(e) => setScopeState((s) => ({ ...s, bucket: e.target.value as any }))}
                  className={selectClass}
                >
                  <option value="month">Month</option>
                  <option value="quarter">Quarter</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button className="btn-modern h-10 px-5 text-xs font-semibold" onClick={applyScope}>
                Apply
              </button>
              <button className="btn-outline h-10 px-5 text-xs font-semibold" onClick={clearScope}>
                Clear
              </button>
            </div>
          </div>
        </div>
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ForwardImpactCard scope={appliedScope} scopeVersion={scopeVersion} tokenGetter={tokenGetter} />
            <DependencyMatrixCard scope={appliedScope} scopeVersion={scopeVersion} tokenGetter={tokenGetter} competitorNames={appliedCompetitors} />
            <RiskRadarCard scope={appliedScope} scopeVersion={scopeVersion} tokenGetter={tokenGetter} competitorNames={appliedCompetitors} />
            <EncroachmentCard scope={appliedScope} scopeVersion={scopeVersion} tokenGetter={tokenGetter} competitorNames={appliedCompetitors} />
          </section>
        </div>
      </div>

      <div className="glass-surface" style={pageSurfaceStyle}>
        {/* Footer */}
        <footer style={footerStyle}>
          2025 © Phaethon Order LLC | <a href="mailto:support@phaethon.llc" target="_blank" rel="noopener noreferrer" className="text-[#312f2f] hover:underline hover:text-blue-400">support@phaethon.llc</a> | <a href="https://phaethonorder.com" target="_blank" rel="noopener noreferrer" className="text-[#312f2f] hover:underline hover:text-blue-400">phaethonorder.com</a> | <a href="/help" className="text-[#312f2f] hover:underline hover:text-blue-400">Help</a> | <a href="/docs" className="text-[#312f2f] hover:underline hover:text-blue-400">Legal</a>
        </footer>
      </div>
    </div>
  );
}
const TEXT_COLOR = "#102A43";
const LINK_COLOR = "#5FA8D2";
const CARD_BG = "rgba(255, 255, 255, 0.8)";
const CARD_BORDER = "rgba(255, 255, 255, 0.45)";
const CARD_SHADOW = "0 26px 54px rgba(15, 23, 42, 0.28)";

const pageSurfaceStyle: React.CSSProperties = {
  maxWidth: 1240,
  width: "100%",
  margin: "0 auto",
  display: "grid",
  gap: 20,
  padding: 28,
  borderRadius: 28,
};

const cardBaseStyle: CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 20,
  padding: 22,
  boxShadow: CARD_SHADOW,
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
};

const footerStyle: React.CSSProperties = {
  alignSelf: "center",
  padding: "16px 24px",
  borderRadius: 999,
  background: "rgba(255, 255, 255, 0.22)",
  border: "1px solid rgba(255, 255, 255, 0.35)",
  boxShadow: "0 16px 36px rgba(15, 23, 42, 0.26)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  color: "#102a43",
  textAlign: "center",
  fontSize: 13,
  fontWeight: 500,
  gap: 4
};
