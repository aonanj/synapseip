"use client";

import { useAuth0 } from "@auth0/auth0-react";
import jsPDF from "jspdf";
import { useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";

type ScopeClaimMatch = {
  pub_id: string;
  claim_number: number;
  claim_text?: string | null;
  title?: string | null;
  assignee_name?: string | null;
  pub_date?: number | null;
  is_independent?: boolean | null;
  distance: number;
  similarity: number;
};

type ScopeAnalysisResponse = {
  query_text: string;
  top_k: number;
  matches: ScopeClaimMatch[];
};

type GraphProps = {
  matches: ScopeClaimMatch[];
  selectedId: string | null;
  onSelect: (rowId: string) => void;
};

type SortKey = "similarity" | "assignee" | "pub_date";
type SortDirection = "asc" | "desc";

function formatPubDate(pubDate?: number | null): string {
  if (!pubDate) return "—";
  const s = String(pubDate);
  if (s.length !== 8) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function formatSimilarity(sim: number | null | undefined): string {
  if (sim == null) return "—";
  const pct = Math.max(0, Math.min(1, sim)) * 100;
  return `${pct.toFixed(1)}%`;
}

function googlePatentsUrl(pubId: string): string {
  const cleaned = pubId.replace(/[-\s]/g, "");
  return `https://patents.google.com/patent/${cleaned}`;
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
      const sim = Math.max(0, Math.min(1, match.similarity ?? 0));
      const minRadius = 70;
      const maxRadius = 220;
      const emphasis = Math.pow(sim, 1.35); // push high-sim nodes closer to center
      const radius = maxRadius - emphasis * (maxRadius - minRadius);
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
      <div className="h-[360px] flex items-center justify-center text-sm text-slate-500">
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
          <p className="font-semibold text-slate-800 mb-1">{tooltip.title}</p>
          <p className="text-slate-600 leading-snug">{tooltip.snippet}</p>
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

const DEFAULT_SORT_DIRECTION: Record<SortKey, SortDirection> = {
  similarity: "desc",
  assignee: "asc",
  pub_date: "desc",
};

export default function ScopeAnalysisPage() {
  const { isAuthenticated, isLoading, loginWithRedirect, getAccessTokenSilently } = useAuth0();
  const [text, setText] = useState("");
  const [topK, setTopK] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ScopeClaimMatch[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string | null>(null);
  const [expandedClaims, setExpandedClaims] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("similarity");
  const [sortDirection, setSortDirection] = useState<SortDirection>(DEFAULT_SORT_DIRECTION.similarity);

  const primaryRisk = useMemo(() => {
    if (!results.length) return null;
    const top = results[0];
    if (!top) return null;
    const sim = top.similarity ?? 0;
    if (sim >= 0.75) {
      return { label: "High Risk", level: "high", message: "Top claim vector is very close to input. Very high risk of infringement or overlap." };
    }
    if (sim >= 0.55) {
      return { label: "Moderate Risk", level: "medium", message: "One or more existing claims are directionally similar to input. Formal review is recommended." };
    }
    return { label: "Low Risk", level: "low", message: "Closest independent claims are relatively distant from input. Lower risk of infringement or overlap." };
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
      const payload = { text, top_k: topK };
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
      setSelectedId(matches.length ? `${matches[0].pub_id}#${matches[0].claim_number}` : null);
    } catch (err: any) {
      setError(err?.message ?? "Scope analysis failed");
    } finally {
      setLoading(false);
    }
  }, [text, topK, isAuthenticated, loginWithRedirect, getAccessTokenSilently]);

  const highRiskCount = useMemo(() => {
    return results.filter((r) => (r.similarity ?? 0) >= 0.7).length;
  }, [results]);

  const lowRiskCount = useMemo(() => {
    return results.filter((r) => (r.similarity ?? 0) < 0.5).length;
  }, [results]);

  const sortedResults = useMemo(() => {
    const items = [...results];
    items.sort((a, b) => {
      if (sortBy === "assignee") {
        const aName = (a.assignee_name || "").toLowerCase();
        const bName = (b.assignee_name || "").toLowerCase();
        if (aName !== bName) {
          return sortDirection === "asc" ? aName.localeCompare(bName) : bName.localeCompare(aName);
        }
      } else if (sortBy === "pub_date") {
        const aDate = a.pub_date ?? 0;
        const bDate = b.pub_date ?? 0;
        if (aDate !== bDate) {
          return sortDirection === "asc" ? aDate - bDate : bDate - aDate;
        }
      } else {
        const aSim = a.similarity ?? -Infinity;
        const bSim = b.similarity ?? -Infinity;
        if (aSim !== bSim) {
          return sortDirection === "asc" ? aSim - bSim : bSim - aSim;
        }
      }

      const aSim = a.similarity ?? -Infinity;
      const bSim = b.similarity ?? -Infinity;
      if (aSim !== bSim) return bSim - aSim;

      const aDate = a.pub_date ?? 0;
      const bDate = b.pub_date ?? 0;
      return bDate - aDate;
    });
    return items;
  }, [results, sortBy, sortDirection]);

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

  const handleSortFieldChange = (next: SortKey) => {
    setSortBy(next);
    setSortDirection(DEFAULT_SORT_DIRECTION[next]);
  };

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const exportTableToPdf = useCallback(() => {
    if (!sortedResults.length || exporting) {
      return;
    }

    try {
      setExporting(true);

      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const marginX = 72; // 1" margins on letter page
      const topMargin = 72;
      const bottomMargin = 72;
      const lineHeight = 12;
      const paragraphSpacing = 6;
      const paragraphIndent = 0;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const contentWidth = pageWidth - marginX * 2;
      const wrapWidth = contentWidth - 6; // tiny inset to avoid right-edge bleed
      let y = topMargin;

      const splitLines = (text: string, width: number = wrapWidth) => doc.splitTextToSize(text, width);

      const ensureSpace = (needed = lineHeight) => {
        if (y + needed > pageHeight - bottomMargin) {
          doc.addPage();
          y = topMargin;
        }
      };

      const drawDivider = () => {
        ensureSpace(lineHeight + 6);
        y += 4;
        doc.setDrawColor(184, 194, 208);
        doc.setLineWidth(0.8);
        doc.line(marginX, y, pageWidth - marginX, y);
        y += 10;
      };

      const writeLines = (lines: string[], fontSize = 11, xOffset = 0) => {
        doc.setFontSize(fontSize);
        lines.forEach((line) => {
          ensureSpace();
          if (line) {
            doc.text(line, marginX + xOffset, y);
          }
          y += lineHeight;
        });
      };

      const formatClaimText = (text: string, claimNumber?: number | null) => {
        const normalized = text.replace(/\r\n/g, "\n").trim();
        if (!normalized) return ["No claim text available."];

        const withBreaks = normalized
          .replace(/;[ \t]*and[ \t]*/gi, ";\nand ")
          .replace(/;(?!(\s*and\b))/g, ";\n")
          .replace(/:(?!\n)/g, ":\n")
          .replace(/\n{3,}/g, "\n\n");

        const paragraphs = withBreaks.split(/\n{2,}/).filter(Boolean);
        const lines: string[] = [];

        paragraphs.forEach((para, pIdx) => {
          const segments = para.split(/\n/);
          segments.forEach((segment, sIdx) => {
            const trimmed = segment.trim();
            if (!trimmed) return;
            const wrapped = splitLines(trimmed, wrapWidth - paragraphIndent);
            wrapped.forEach((wrapLine, wIdx) => {
              if (pIdx === 0 && sIdx === 0 && wIdx === 0 && claimNumber != null) {
                lines.push(`${claimNumber}. ${wrapLine}`);
              } else {
                lines.push(wrapLine);
              }
            });
          });
          if (pIdx !== paragraphs.length - 1) {
            lines.push("");
          }
        });

        return lines.length ? lines : ["No claim text available."];
      };

      doc.setFontSize(16);
      doc.text("Scope Analysis Results", marginX, y);
      y += 20;

      doc.setFontSize(11);
      doc.text("Input", marginX, y);
      y += 12;

      const inputText = lastQuery?.trim() || "No input text provided.";
      const inputLines = splitLines(inputText);
      writeLines(inputLines, 10);
      y += 4;
      drawDivider();

      sortedResults.forEach((match, idx) => {
        // Keep headings on-page with at least a few lines of metadata.
        ensureSpace(lineHeight * 4);

        const heading = `${match.title || "Untitled patent"} (${match.pub_id})`;
        const headingLines = splitLines(heading);
        writeLines(headingLines, 11);
        y += 2;

        const metaParts = [
          `Assignee: ${match.assignee_name || "Unknown"}`,
          `Grant Date: ${formatPubDate(match.pub_date)}`,
          `Similarity: ${formatSimilarity(match.similarity)}`,
        ];
        const metaLines = splitLines(metaParts.join(" | "));
        writeLines(metaLines, 9);
        y += 2;

        const claimLines = formatClaimText(match.claim_text || "No claim text available.", match.claim_number);
        writeLines(claimLines, 10);

        if (idx !== sortedResults.length - 1) {
          y += 6;
          drawDivider();
        }
      });

      const totalPages = doc.getNumberOfPages();
      doc.setFontSize(9);
      for (let i = 1; i <= totalPages; i += 1) {
        doc.setPage(i);
        const footerY = doc.internal.pageSize.getHeight() - 32;
        const pageW = doc.internal.pageSize.getWidth();
        doc.text(`Page ${i} of ${totalPages}`, pageW - marginX, footerY, { align: "right" });
      }

      const filename = `scope-analysis-${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);
    } finally {
      setExporting(false);
    }
  }, [sortedResults, lastQuery, exporting]);

  return (
    <div style={pageWrapperStyle}>
      <div className="glass-surface" style={pageSurfaceStyle}>
          <header className="glass-card" style={{ ...cardBaseStyle }}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 mb-2">
              Scope Analysis
            </p>
            <h1 style={{ color: TEXT_COLOR, fontSize: 22, fontWeight: 700 }}>Preliminary FTO / Infringement Radar</h1>
            <p style={{ margin: 0, fontSize: 14, color: "#475569" }}>
              Input subject matter to search for comparison against independent claims of patents in the SynapseIP database. 
              A semantic search is executed over the available independent claims, and semantically similar claims are returned with similarity scores and risk analyses.
            </p>
          </header>

          <section className="glass-card" style={{ ...cardBaseStyle }}>
            <div className="flex flex-col gap-2">
              <label htmlFor="scope-text" className="text-sm font-semibold" style={{ color: TEXT_COLOR }}>
                Input subject matter to search (e.g., product description, invention disclosure, draft claim(s), etc.)
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
                <label htmlFor="topk" className="text-sm font-semibold" style={{ color: TEXT_COLOR }}>
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
                    <p className="text-xs tracking-wide uppercase text-slate-500">Risk snapshot</p>
                    <h2 className="text-xl font-semibold text-slate-900">Similarity map</h2>
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
                  <p className="mt-4 text-sm text-slate-600">{primaryRisk.message}</p>
                )}
              </div>

              <div className="glass-card p-6 space-y-4" style={{ ...cardBaseStyle }}>
                <p className="text-xs tracking-wide uppercase text-slate-500">Impact summary</p>
                <h2 className="text-xl font-semibold" style={{ color: TEXT_COLOR }}>Claim proximity breakdown</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-sm text-slate-500">Top match similarity</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatSimilarity(results[0]?.similarity)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Pub {results[0]?.pub_id} / Claim {results[0]?.claim_number}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-sm text-slate-500">High-risk cluster</p>
                    <p className="text-2xl font-bold text-slate-900">{highRiskCount}</p>
                    <p className="text-xs text-slate-500 mt-1">claims ≥ 0.70 similarity</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-sm text-slate-500">Lower-risk set</p>
                    <p className="text-2xl font-bold text-slate-900">{lowRiskCount}</p>
                    <p className="text-xs text-slate-500 mt-1">claims &lt; 0.50 similarity</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="text-sm text-slate-500">Scope sampled</p>
                    <p className="text-2xl font-bold text-slate-900">{results.length}</p>
                    <p className="text-xs text-slate-500 mt-1">independent claims inspected</p>
                  </div>
                </div>
                {lastQuery && (
                  <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-500">
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
              <p className="text-xs tracking-wide uppercase text-slate-500">Independent claim matches</p>
              <h2 className="text-xl font-semibold text-slate-900">Closest patent claims</h2>
            </div>
            <div className="flex items-center gap-3">
              {results.length > 0 && (
                <>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Sort</span>
                    <select
                      value={sortBy}
                      onChange={(e) => handleSortFieldChange(e.target.value as SortKey)}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                    >
                      <option value="similarity">Similarity</option>
                      <option value="assignee">Assignee</option>
                      <option value="pub_date">Grant date</option>
                    </select>
                    <button
                      type="button"
                      onClick={toggleSortDirection}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      {sortDirection === "asc" ? "Asc" : "Desc"}
                    </button>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    Click a row to highlight the graph node.
                  </span>
                </>
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
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2 pr-4">Patent</th>
                    <th className="py-2 pr-4">Claim #</th>
                    <th className="py-2 pr-4">Similarity</th>
                    <th className="py-2 pr-4">Assignee</th>
                    <th className="py-2">Claim text</th>
                  </tr>
                </thead>
                <tbody>
                  {results.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">
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
                            <div className="font-semibold text-slate-900">{match.title || "Untitled patent"}</div>
                            <div className="text-xs text-slate-500">
                              <a
                                href={googlePatentsUrl(match.pub_id)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-600 hover:underline"
                              >
                                {match.pub_id}
                              </a>{" "}
                              · {formatPubDate(match.pub_date)}
                            </div>
                          </td>
                          <td className="py-3 pr-4">{match.claim_number}</td>
                          <td className="py-3 pr-4 font-semibold text-slate-900">
                            {formatSimilarity(match.similarity)}
                          </td>
                          <td className="py-3 pr-4 text-slate-700">
                            {match.assignee_name || "Unknown assignee"}
                          </td>
                          <td
                            className="py-3 text-slate-700"
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
                              <span className="block text-xs text-slate-500 mt-1">
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
