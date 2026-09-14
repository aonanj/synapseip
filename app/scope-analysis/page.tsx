"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";

type ScopeClaimMatch = {
  pub_id: string;
  claim_number: number;
  claim_text?: string | null;
  title?: string | null;
  assignee_name?: string | null;
  pub_date?: number | null;
  kind_code?: string | null;
  is_independent?: boolean | null;
  distance: number;
  similarity: number;
  /** Background-calibrated proximity in [0,1]. See app/scope_scoring.py. */
  calibrated_score?: number | null;
  risk_band?: "high" | "moderate" | "low" | null;
};

type ScopeAnalysisResponse = {
  query_text: string;
  top_k: number;
  patents_only?: boolean;
  matches: ScopeClaimMatch[];
};

type GraphProps = {
  matches: ScopeClaimMatch[];
  selectedId: string | null;
  onSelect: (rowId: string) => void;
};

type SortKey = "similarity" | "assignee" | "pub_date" | "claim_number" | "claim_text";
type SortDirection = "asc" | "desc";

function formatPubDate(pubDate?: number | null): string {
  if (!pubDate) return "—";
  const s = String(pubDate);
  if (s.length !== 8) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** Kind codes A1/A2/A9 are published applications; B1/B2/E1 are issued patents. */
function publicationLabel(kindCode: string): string {
  const kind = kindCode.toUpperCase();
  return `${kind.startsWith("A") ? "Application" : "Patent"} (${kind})`;
}

function formatSimilarity(sim: number | null | undefined): string {
  if (sim == null) return "—";
  const pct = Math.max(0, Math.min(1, sim)) * 100;
  return `${pct.toFixed(1)}%`;
}

/**
 * Calibrated proximity for a match: 1.0 = identical claim language, 0 = no
 * closer than a randomly chosen claim. Falls back to raw similarity only for
 * responses from a backend predating the calibrated fields.
 */
function proximityOf(match: ScopeClaimMatch): number {
  return match.calibrated_score ?? match.similarity ?? 0;
}

function googlePatentsUrl(pubId: string): string {
  const cleaned = pubId.replace(/[-\s]/g, "");
  return `https://patents.google.com/patent/${cleaned}`;
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th
      onClick={onClick}
      className={`py-2 pr-4 cursor-pointer select-none ${className ?? ""}`}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      scope="col"
    >
      <span className="inline-flex items-center gap-1 text-[#39506B]">
        <span>{label}</span>
        <span className="text-base">{active ? (direction === "asc" ? "↑" : "↓") : "⇅"}</span>
      </span>
    </th>
  );
}

const ScopeGraph = ({ matches, selectedId, onSelect }: GraphProps) => {
  const width = 620;
  const height = 360;
  const cx = width / 2;
  const cy = height / 2;
  const [tooltip, setTooltip] = useState<{
    rowId: string;
    title: string;
    snippet: string;
    leftPct: number;
    topPct: number;
  } | null>(null);

  const nodes = useMemo(() => {
    if (!matches.length) return [];
    const limit = Math.min(matches.length, 18);
    return matches.slice(0, limit).map((match, idx) => {
      const proportion = idx / limit;
      const angle = proportion * Math.PI * 2;
      const sim = Math.max(0, Math.min(1, proximityOf(match)));
      const minRadius = 70;
      const maxRadius = 220;
      // The calibrated scale already spreads the useful range across 0-1, so
      // no emphasis curve is needed (the old raw-cosine scale was compressed
      // into its top slice and needed one).
      const radius = maxRadius - sim * (maxRadius - minRadius);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      const rowId = `${match.pub_id}#${match.claim_number}`;
      const text = (match.claim_text || "").trim();
      const snippet = text
        ? `${text.slice(0, 200)}${text.length > 200 ? "…" : ""}`
        : "No claim text available.";
      return {
        x,
        y,
        rowId,
        similarity: sim,
        title: match.title || match.pub_id,
        snippet,
      };
    });
  }, [matches, cx, cy]);

  if (!matches.length) {
    return (
      <div className="h-[360px] flex items-center justify-center text-sm text-[#39506B]">
        Run a scope analysis to visualize overlaps with independent claims.
      </div>
    );
  }

  return (
    <div className="relative w-full h-[360px]">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        {/* Edges */}
        {nodes.map((node) => (
          <line
            key={`${node.rowId}-edge`}
            x1={cx}
            y1={cy}
            x2={node.x}
            y2={node.y}
            stroke="rgba(14,165,233,0.25)"
            strokeWidth={selectedId === node.rowId ? 2.2 : 1.2}
          />
        ))}

        {/* Query node */}
        <g>
          <circle cx={cx} cy={cy} r={28} fill="#0ea5e9" fillOpacity={0.8} />
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={12}
            fontWeight={600}
            fill="white"
          >
            Input
          </text>
        </g>

        {/* Claim nodes */}
        {nodes.map((node) => (
          <g
            key={node.rowId}
            className="cursor-pointer"
            onClick={() => onSelect(node.rowId)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(node.rowId);
              }
            }}
            onMouseEnter={() =>
              setTooltip({
                rowId: node.rowId,
                title: node.title,
                snippet: node.snippet,
                leftPct: (node.x / width) * 100,
                topPct: (node.y / height) * 100,
              })
            }
            onMouseLeave={() => setTooltip((prev) => (prev?.rowId === node.rowId ? null : prev))}
            tabIndex={0}
            role="button"
            aria-label={`Highlight ${node.title}`}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={selectedId === node.rowId ? 16 : 13}
              fill={selectedId === node.rowId ? "#1d4ed8" : "#e0f2fe"}
              stroke={selectedId === node.rowId ? "#1d4ed8" : "#0ea5e9"}
              strokeWidth={selectedId === node.rowId ? 3 : 1.5}
            />
            <text
              x={node.x}
              y={node.y - (selectedId === node.rowId ? 22 : 20)}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="#0f172a"
            >
              {`${Math.round(node.similarity * 100)}%`}
            </text>
          </g>
        ))}
      </svg>
      {tooltip && (
        <div
          className="absolute max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg pointer-events-none"
          style={{
            left: `${tooltip.leftPct}%`,
            top: `${tooltip.topPct}%`,
            transform: "translate(-50%, -100%) translateY(-12px)",
          }}
        >
          <p className="font-semibold text-[#102a43] mb-1">{tooltip.title}</p>
          <p className="text-[#39506B] leading-snug">{tooltip.snippet}</p>
        </div>
      )}
    </div>
  );
};

const pageWrapperStyle: React.CSSProperties = {
  padding: "48px 24px 64px",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  gap: 32,
};

export default function ScopeAnalysisPage() {
  const { isAuthenticated, isLoading, loginWithRedirect, getAccessTokenSilently } = useAuth0();
  const [text, setText] = useState("");
  const [topK, setTopK] = useState(15);
  const [patentsOnly, setPatentsOnly] = useState(false);
  // Value used for the results on screen, so exports match what is displayed.
  const [lastPatentsOnly, setLastPatentsOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ScopeClaimMatch[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string | null>(null);
  const [expandedClaims, setExpandedClaims] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);
  const [sortState, setSortState] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "similarity",
    direction: "desc",
  });

  const primaryRisk = useMemo(() => {
    if (!results.length) return null;
    const top = results[0];
    if (!top) return null;
    const band = top.risk_band ?? "low";
    if (band === "high") {
      return { label: "High Risk", level: "high", message: "Top claim is near-duplicate claim language. Very high risk of infringement or overlap." };
    }
    if (band === "moderate") {
      return { label: "Moderate Risk", level: "medium", message: "One or more existing claims are substantially closer to the input than a typical claim. Formal review is recommended." };
    }
    return { label: "Low Risk", level: "low", message: "No claim is close to the input relative to the corpus baseline. Lower risk of infringement or overlap." };
  }, [results]);

  const runAnalysis = useCallback(async () => {
    if (!text.trim()) {
      setError("Please describe subject matter to analyze.");
      return;
    }
    if (!isAuthenticated) {
      loginWithRedirect();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessTokenSilently();
      const payload = { text, top_k: topK, patents_only: patentsOnly };
      const resp = await fetch("/api/scope-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const detail = await resp.json().catch(() => ({}));
        throw new Error(detail?.detail || `HTTP ${resp.status}`);
      }
      const data: ScopeAnalysisResponse = await resp.json();
      const matches = Array.isArray(data.matches) ? data.matches : [];
      setResults(matches);
      setLastQuery(data.query_text || text);
      setLastPatentsOnly(Boolean(data.patents_only));
      setSelectedId(matches.length ? `${matches[0].pub_id}#${matches[0].claim_number}` : null);
    } catch (err: any) {
      setError(err?.message ?? "Scope analysis failed");
    } finally {
      setLoading(false);
    }
  }, [text, topK, patentsOnly, isAuthenticated, loginWithRedirect, getAccessTokenSilently]);

  const highRiskCount = useMemo(() => {
    return results.filter((r) => (r.risk_band ?? "low") === "high").length;
  }, [results]);

  const lowRiskCount = useMemo(() => {
    return results.filter((r) => (r.risk_band ?? "low") === "low").length;
  }, [results]);

  const sortedResults = useMemo(() => {
    const items = [...results];
    const dir = sortState.direction === "asc" ? 1 : -1;
    const getValue = (match: ScopeClaimMatch) => {
      switch (sortState.key) {
        case "assignee":
          return (match.assignee_name || "").toLowerCase();
        case "pub_date":
          return match.pub_date ?? 0;
        case "claim_number":
          return match.claim_number ?? 0;
        case "claim_text":
          return (match.claim_text || "").toLowerCase();
        default:
          // Sort on raw distance, not the calibrated score: the score clamps
          // at 0, so background-level matches would otherwise all tie.
          // Negated so that "descending proximity" stays the default.
          return -(match.distance ?? Infinity);
      }
    };

    items.sort((a, b) => {
      const valA = getValue(a);
      const valB = getValue(b);

      if (typeof valA === "string" || typeof valB === "string") {
        const aStr = typeof valA === "string" ? valA : String(valA ?? "");
        const bStr = typeof valB === "string" ? valB : String(valB ?? "");
        if (aStr !== bStr) return aStr.localeCompare(bStr) * dir;
      } else if (valA !== valB) {
        return (Number(valA) - Number(valB)) * dir;
      }

      const aDist = a.distance ?? Infinity;
      const bDist = b.distance ?? Infinity;
      if (aDist !== bDist) return aDist - bDist;

      const aDate = a.pub_date ?? 0;
      const bDate = b.pub_date ?? 0;
      if (aDate !== bDate) return bDate - aDate;

      return (a.claim_number ?? 0) - (b.claim_number ?? 0);
    });
    return items;
  }, [results, sortState]);

  const handleRowSelect = (rowId: string) => {
    setSelectedId(rowId);
  };

  const toggleClaimExpansion = (rowId: string) => {
    setExpandedClaims((prev) => {
      const next = { ...prev };
      if (next[rowId]) {
        delete next[rowId];
      } else {
        next[rowId] = true;
      }
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    setSortState((prev) =>
      prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }
    );
  };

  const exportTableToPdf = useCallback(async () => {
    if (!lastQuery || exporting) {
      return;
    }

    try {
      setExporting(true);
      const token = await getAccessTokenSilently();

      const payload = {
        text: lastQuery,
        top_k: topK,
        patents_only: lastPatentsOnly,
      };

      const res = await fetch("/api/scope-analysis/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scope-analysis-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Export error:", err);
      alert(err.message || "Failed to export PDF");
    } finally {
      setExporting(false);
    }
  }, [lastQuery, topK, lastPatentsOnly, exporting, getAccessTokenSilently]);

  return (
    <div style={pageWrapperStyle}>
      <div className="glass-surface" style={pageSurfaceStyle}>
          <header className="glass-card" style={{ ...cardBaseStyle }}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 mb-2">
              Scope Analysis
            </p>
            <h1 style={{ color: TEXT_COLOR, fontSize: 22, fontWeight: 700 }}>Preliminary FTO / Infringement Radar</h1>
            <p style={{ margin: 0, fontSize: 14, color: "#475569" }}>
              Input subject matter to search (e.g., product description, invention disclosure, draft claim(s), etc.) for comparison against independent claims of patents and published applications in the SynapseIP database. 
              A semantic search is executed over the available independent claims, and semantically similar claims are returned with proximity scores and risk analyses. Proximity is calibrated against the corpus: 100% is identical claim language, 0% is no closer than a randomly chosen claim.
            </p>
          </header>

          <section className="glass-card" style={{ ...cardBaseStyle }}>
            <div className="flex flex-col gap-2">
              <label htmlFor="scope-text" className="text-base uppercase" style={{ color: TEXT_COLOR }}>
                Subject matter to search 
              </label>
              <textarea
                id="scope-text"
                className="focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white/80 pt-2 pl-2" style={{ ...textInputStyle}}
                placeholder="Example: A device using a multi-modal transformer that fuses radar and camera signals..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div>
                <label htmlFor="topk" className="text-sm font-medium" style={{ color: TEXT_COLOR }}>
                  # of claim comparisons: 
                </label>
                <input
                  id="topk"
                  type="number"
                  min={0}
                  max={50}
                  value={topK}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (Number.isFinite(next)) {
                      setTopK(Math.max(0, Math.min(50, Math.trunc(next))));
                    }
                  }}
                  style={inputStyle}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: TEXT_COLOR }}>
                <input
                  type="checkbox"
                  checked={patentsOnly}
                  onChange={(e) => setPatentsOnly(e.target.checked)}
                />
                Issued patents only (exclude applications)
              </label>
              <div className="flex-1" />
              <button
                type="button"
                onClick={runAnalysis}
                disabled={loading}
                className="btn-modern h-11 px-6 text-sm font-semibold disabled:opacity-60"
              >
                {loading ? "Analyzing…" : isAuthenticated ? "Run scope analysis" : "Log in to analyze"}
              </button>
            </div>
            {!isAuthenticated && !isLoading && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Sign in to access this feature.
              </div>
            )}
          </section>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {results.length > 0 && (
            <section className="grid gap-6 lg:grid-cols-2">
              <div className="glass-card p-6" style={{ ...cardBaseStyle }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs tracking-wide uppercase text-[#39506B]">Risk snapshot</p>
                    <h2 className="text-lg font-semibold text-[#102a43]">Similarity map</h2>
                  </div>
                  {primaryRisk && (
                    <div
                      className={`px-3 py-1 text-sm font-semibold rounded-full ${
                        primaryRisk.level === "high"
                          ? "bg-red-100 text-red-700"
                          : primaryRisk.level === "medium"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {primaryRisk.label}
                    </div>
                  )}
                </div>
                <ScopeGraph matches={results} selectedId={selectedId} onSelect={handleRowSelect} />
                {primaryRisk && (
                  <p className="mt-4 text-sm text-[#39506B]">{primaryRisk.message}</p>
                )}
              </div>

              <div className="glass-card p-6" style={{ ...cardBaseStyle }}>
                <p className="text-xs tracking-wide uppercase text-[#47617e]">Impact summary</p>
                <h2 className="text-lg font-semibold" style={{ color: TEXT_COLOR }}>Claim proximity breakdown</h2>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-sm text-[#47617e]">Top match proximity</p>
                    <p className="text-2xl font-bold text-[#102a43]">
                      {results[0] ? formatSimilarity(proximityOf(results[0])) : "—"}
                    </p>
                    <p className="text-xs text-[#47617e] mt-1">
                      Pub {results[0]?.pub_id} / Claim {results[0]?.claim_number}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-sm text-[#47617e]">High-risk cluster</p>
                    <p className="text-2xl font-bold text-[#102a43]">{highRiskCount}</p>
                    <p className="text-xs text-[#47617e] mt-1">near-duplicate claim language</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-sm text-[#47617e]">Lower-risk set</p>
                    <p className="text-2xl font-bold text-[#102a43]">{lowRiskCount}</p>
                    <p className="text-xs text-[#47617e] mt-1">near corpus baseline</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-sm text-[#47617e]">Scope sampled</p>
                    <p className="text-2xl font-bold text-[#102a43]">{results.length}</p>
                    <p className="text-xs text-[#47617e] mt-1">
                      {lastPatentsOnly ? "independent patent claims inspected" : "independent claims inspected"}
                    </p>
                  </div>
                </div>
                {lastQuery && (
                  <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 mt-4 text-xs text-[#47617e]">
                    Last analyzed snippet: {lastQuery.slice(0, 160)}
                    {lastQuery.length > 160 ? "…" : ""}
                  </div>
                )}
              </div>
            </section>
          )}

        <section className="glass-card p-6" style={{ ...cardBaseStyle }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs tracking-wide uppercase text-[#39506B]">Independent claim matches</p>
                <h2 className="text-lg font-semibold text-[#102a43]">Closest patent claims</h2>
              </div>
              <div className="flex items-center gap-3">
                {results.length > 0 && (
                  <span className="text-xs font-semibold text-[#39506B]">
                    Click a row to highlight the graph node.
                  </span>
                )}
                <button
                  type="button"
                  onClick={exportTableToPdf}
                  disabled={!results.length || exporting}
                  className="btn-outline h-9 px-4 text-xs font-semibold disabled:opacity-50"
              >
                {exporting ? "Preparing PDF…" : "Export PDF"}
              </button>
            </div>
          </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[#39506B] border-b">
                    <SortableHeader
                      label="Patent"
                      active={sortState.key === "pub_date"}
                      direction={sortState.direction}
                      onClick={() => handleSort("pub_date")}
                    />
                    <SortableHeader
                      label="Claim #"
                      active={sortState.key === "claim_number"}
                      direction={sortState.direction}
                      onClick={() => handleSort("claim_number")}
                    />
                    <SortableHeader
                      label="Proximity"
                      active={sortState.key === "similarity"}
                      direction={sortState.direction}
                      onClick={() => handleSort("similarity")}
                    />
                    <SortableHeader
                      label="Assignee"
                      active={sortState.key === "assignee"}
                      direction={sortState.direction}
                      onClick={() => handleSort("assignee")}
                    />
                    <SortableHeader
                      label="Claim text"
                      active={sortState.key === "claim_text"}
                      direction={sortState.direction}
                      onClick={() => handleSort("claim_text")}
                      className="pr-0"
                    />
                  </tr>
                </thead>
                <tbody>
                  {results.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-[#39506B]">
                        Run scope analysis to populate this table.
                      </td>
                    </tr>
                  ) : (
                    sortedResults.map((match) => {
                      const rowId = `${match.pub_id}#${match.claim_number}`;
                      const isSelected = selectedId === rowId;
                      return (
                        <tr
                          key={rowId}
                          className={`align-top transition-colors cursor-pointer ${
                            isSelected ? "bg-sky-50/80" : "hover:bg-slate-50"
                          }`}
                          onClick={() => handleRowSelect(rowId)}
                        >
                          <td className="py-3 pr-4 min-w-[180px]">
                            <div className="font-semibold text-[#102a43]">{match.title || "Untitled patent"}</div>
                            <div className="text-xs text-[#39506B]">
                              <a
                                href={googlePatentsUrl(match.pub_id)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-600 hover:underline"
                              >
                                {match.pub_id}
                              </a>{" "}
                              · {formatPubDate(match.pub_date)}
                              {match.kind_code ? ` · ${publicationLabel(match.kind_code)}` : ""}
                            </div>
                          </td>
                          <td className="py-3 pr-4">{match.claim_number}</td>
                          <td className="py-3 pr-4 font-semibold text-[#102a43]">
                            {formatSimilarity(proximityOf(match))}
                          </td>
                          <td className="py-3 pr-4 text-[#39506B]">
                            {match.assignee_name || "Unknown assignee"}
                          </td>
                          <td
                            className="py-3 text-[#39506B]"
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowSelect(rowId);
                              toggleClaimExpansion(rowId);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                handleRowSelect(rowId);
                                toggleClaimExpansion(rowId);
                              }
                            }}
                          >
                            {match.claim_text
                              ? expandedClaims[rowId]
                                ? match.claim_text
                                : match.claim_text.slice(0, 280) + (match.claim_text.length > 280 ? "…" : "")
                              : "—"}
                            {match.claim_text && (
                              <span className="block text-xs text-[#39506B] mt-1">
                                {expandedClaims[rowId] ? "Click to collapse" : "Click to read full claim"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
        </section>
      </div>
      <div className="glass-surface" style={pageSurfaceStyle}>
        {/* Footer */}
        <footer style={footerStyle}>
          2025 © Phaethon Order LLC | <a href="mailto:support@phaethon.llc" target="_blank" rel="noopener noreferrer" className="text-[#312f2f] hover:underline hover:text-blue-400">support@phaethon.llc</a> | <a href="https://phaethonorder.com" target="_blank" rel="noopener noreferrer" className="text-[#312f2f] hover:underline hover:text-blue-400">phaethonorder.com</a> | <a href="/help" className="text-[#312f2f] hover:underline hover:text-blue-400">Help</a> | <a href="/docs" className="text-[#312f2f] hover:underline hover:text-blue-400">Legal</a>
        </footer>
      </div>
    </div>
  );
};

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

const cardBaseStyle: CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 20,
  padding: 22,
  boxShadow: CARD_SHADOW,
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
};

const inputStyle: React.CSSProperties = {
  height: 38,
  border: "1px solid rgba(148, 163, 184, 0.45)",
  borderRadius: 12,
  padding: "5px 10px",
  marginLeft: 8,
  marginTop: 8,
  fontSize: 12,
  outline: "none",
  minWidth: 60,
  width: 70,
  background: "rgba(255, 255, 255, 0.7)",
  boxShadow: "0 12px 22px rgba(15, 23, 42, 0.18)",
  color: "#102A43",
  transition: "box-shadow 0.2s ease, border-color 0.2s ease",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};

const textInputStyle: React.CSSProperties = {
  minHeight: 140,
  border: "1px solid rgba(148, 163, 184, 0.45)",
  borderRadius: 12,
  padding: "5px 14px",
  width: "98%",
  background: "rgba(255, 255, 255, 0.7)",
  boxShadow: "0 12px 22px rgba(15, 23, 42, 0.18)",
  color: "#102A43",
  transition: "box-shadow 0.2s ease, border-color 0.2s ease",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};
