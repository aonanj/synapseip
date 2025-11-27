"use client";

import { useAuth0 } from "@auth0/auth0-react";
import dynamic from "next/dynamic";
import jsPDF from "jspdf";
import type { ChangeEvent } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  SignalKind,
  OverviewGraph,
} from "../../components/SigmaOverviewGraph";

const SigmaOverviewGraph = dynamic(
  () => import("../../components/SigmaOverviewGraph"),
  { ssr: false },
);

type OverviewPoint = {
  month: string;
  count: number;
  top_assignee?: string | null;
  top_assignee_count?: number | null;
};

type OverviewResponse = {
  crowding: {
    exact: number;
    semantic: number;
    total: number;
    density_per_month: number;
    percentile: number | null;
  };
  density: {
    mean_per_month: number;
    min_per_month: number;
    max_per_month: number;
  };
  momentum: {
    slope: number;
    cagr: number | null;
    bucket: "Up" | "Flat" | "Down";
    series: OverviewPoint[];
  };
  top_cpcs: { cpc: string; count: number }[];
  cpc_breakdown: { cpc: string; count: number }[];
  recency: { m6: number; m12: number; m24: number };
  timeline: OverviewPoint[];
  window_months: number;
};

type PatentHit = {
  pub_id: string;
  title?: string | null;
  abstract?: string | null;
  assignee_name?: string | null;
  pub_date?: number | string | null;
  kind_code?: string | null;
  cpc?: Array<Record<string, string>> | null;
  score?: number | null;
};

type SearchResponse = {
  total: number;
  items?: PatentHit[];
};

type SignalStatus = "none" | "weak" | "medium" | "strong";
type ActiveSignalStatus = Exclude<SignalStatus, "none">;

type SignalInfo = {
  type: SignalKind;
  status: SignalStatus;
  confidence: number;
  why: string;
  node_ids: string[];
};

type SignalAccent = "green" | "red";
type SignalAccentStyle = {
  background: string;
  borderColor: string;
  textColor: string;
};

type AssigneeSignals = {
  assignee: string;
  signals: SignalInfo[];
  summary?: string | null;
  label_terms?: string[] | null;
};

type OverviewGraphResponse = {
  k: string;
  assignees: AssigneeSignals[];
  graph: OverviewGraph | null;
};

type RunQuery = {
  keywords: string;
  cpc: string;
  dateFrom: string;
  dateTo: string;
  semantic: boolean;
};

type ResultSort = "relevance_desc" | "pub_date_desc" | "assignee_asc";
type ResultMode = "exact" | "semantic";

type SearchRequestPayload = {
  keywords: string | null;
  semantic_query: string | null;
  filters: {
    cpc: string | null;
    date_from: number | null;
    date_to: number | null;
  };
  sort_by: ResultSort;
};

type ResultSortKey = "relevance" | "title" | "abstract" | "pub_id" | "assignee" | "pub_date" | "cpc";
type SortDirection = "asc" | "desc";

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
      {children}
    </label>
  );
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
  minWidth,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  minWidth?: number;
}) {
  return (
    <th
      onClick={onClick}
      style={{ ...thStyle, cursor: "pointer", userSelect: "none", minWidth }}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      scope="col"
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span>{label}</span>
        <span style={{ fontSize: 14, color: "#64748b" }}>
          {active ? (direction === "asc" ? "↑" : "↓") : "⇅"}
        </span>
      </span>
    </th>
  );
}

function Row({
  children,
  gap = 12,
  align = "flex-end",
}: {
  children: React.ReactNode;
  gap?: number;
  align?: React.CSSProperties["alignItems"];
}) {
  return (
    <div style={{ display: "flex", gap, alignItems: align, flexWrap: "wrap" }}>{children}</div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      className="glass-card"
      style={{
        padding: 20,
        borderRadius: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const buttonBaseStyle: React.CSSProperties = {
  height: 40,
  padding: "0 20px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "0.01em",
  transition: "all 0.18s ease",
};

function PrimaryButton({ onClick, children, disabled, style, title }: { onClick?: () => void; children: React.ReactNode; disabled?: boolean; style?: React.CSSProperties; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="btn-modern"
      style={{
        ...buttonBaseStyle,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({ onClick, children, disabled, style, title }: { onClick?: () => void; children: React.ReactNode; disabled?: boolean; style?: React.CSSProperties; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="btn-outline"
      style={{
        ...buttonBaseStyle,
        height: 38,
        fontWeight: 500,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

const pageWrapperStyle: React.CSSProperties = {
  padding: "48px 24px 64px",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  gap: 32,
};

const pageSurfaceStyle: React.CSSProperties = {
  maxWidth: 1240,
  width: "100%",
  margin: "0 auto",
  display: "grid",
  gap: 20,
  padding: 28,
  borderRadius: 28,
};

const inputStyle: React.CSSProperties = {
  height: 38,
  border: "1px solid rgba(148, 163, 184, 0.45)",
  borderRadius: 12,
  padding: "0 14px",
  outline: "none",
  minWidth: 220,
  background: "rgba(255, 255, 255, 0.7)",
  boxShadow: "0 12px 22px rgba(15, 23, 42, 0.18)",
  color: "#102A43",
  transition: "box-shadow 0.2s ease, border-color 0.2s ease",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};

const tileStyle: React.CSSProperties = {
  padding: 20,
  borderRadius: 18,
  background: "rgba(255,255,255,0.9)",
  boxShadow: "0 18px 36px rgba(15,23,42,0.16)",
  display: "grid",
  gap: 8,
};

const toggleLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 13,
  color: "#102a43",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid rgba(148, 163, 184, 0.3)",
  color: "#102A43",
  background: "rgba(148, 163, 184, 0.22)",
  position: "sticky",
  top: 0,
  zIndex: 1,
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderTop: "1px solid rgba(148, 163, 184, 0.2)",
  verticalAlign: "top",
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
  gap: 4,
};

const numberFmt = new Intl.NumberFormat("en-US");
const percentFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const RESULTS_PER_PAGE = 25;
const SEARCH_BATCH_SIZE = 250;
const PDF_EXPORT_LIMIT = 1000;
const ABSTRACT_PREVIEW_LIMIT = 200;

const SORT_LABELS: Record<ResultSortKey, string> = {
  relevance: "Relevance",
  title: "Title",
  abstract: "Abstract",
  pub_id: "Patent/Pub No.",
  assignee: "Assignee",
  pub_date: "Grant/Pub Date",
  cpc: "CPC",
};

function formatSortLabel(state: { key: ResultSortKey; direction: SortDirection }): string {
  const base = SORT_LABELS[state.key] || "Relevance";
  if (state.key === "relevance") return base;
  const dirLabel = state.direction === "asc" ? "Asc" : "Desc";
  return `${base} (${dirLabel})`;
}

const SIGNAL_LABELS: Record<SignalKind, string> = {
  focus_shift: "Focus Convergence",
  emerging_gap: "Sparse Focus Area",
  crowd_out: "Crowd-out Risk",
  bridge: "Bridge Opportunity",
};

const STATUS_BADGES: Record<SignalStatus, string> = {
  none: "None",
  weak: "Weak",
  medium: "Medium",
  strong: "Strong",
};

const SIGNAL_ACCENT_BY_KIND: Record<SignalKind, SignalAccent | null> = {
  focus_shift: "red",
  emerging_gap: "green",
  crowd_out: "red",
  bridge: "green",
};

const SIGNAL_STATUS_ACCENT_STYLES: Record<
  SignalAccent,
  Record<ActiveSignalStatus, SignalAccentStyle>
> = {
  green: {
    weak: { background: "#ecfdf5", borderColor: "#a7f3d0", textColor: "#065f46" },
    medium: { background: "#86efac", borderColor: "#22c55e", textColor: "#064e3b" },
    strong: { background: "#065f46", borderColor: "#34d399", textColor: "#ecfdf5" },
  },
  red: {
    weak: { background: "#fee2e2", borderColor: "#fecaca", textColor: "#7f1d1d" },
    medium: { background: "#fca5a5", borderColor: "#ef4444", textColor: "#7f1d1d" },
    strong: { background: "#7f1d1d", borderColor: "#fecaca", textColor: "#fee2e2" },
  },
};

function getSignalAccentStyle(signal: SignalInfo): SignalAccentStyle | null {
  if (signal.status === "none") return null;
  const accent = SIGNAL_ACCENT_BY_KIND[signal.type];
  if (!accent) return null;
  return SIGNAL_STATUS_ACCENT_STYLES[accent][signal.status];
}

function formatPubDate(value: unknown): string {
  if (value === null || value === undefined) return "--";
  const raw = String(value).trim();
  if (!raw) return "--";
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}

function pubDateValue(value: PatentHit["pub_date"]): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return parseInt(value.trim(), 10);
  }
  return null;
}

function formatPatentId(pubId: string): string {
  if (!pubId) return "";
  const cleaned = pubId.replace(/[-\s]/g, "");
  const match = cleaned.match(/^(US)(\d{4})(\d{6})([A-Z]\d{1,2})$/);
  if (!match) return cleaned;
  const [, country, year, serial, kindCode] = match;
  return `${country}${year}0${serial}${kindCode}`;
}

function percentileLabel(p: number | null | undefined): string {
  if (p === null || p === undefined || Number.isNaN(p)) {
    return "--";
  }
  if (p < 0.4) return "Low";
  if (p < 0.8) return "Medium";
  if (p < 0.95) return "High";
  return "Very High";
}

function CPCList(cpc: PatentHit["cpc"]): string {
  if (!cpc || cpc.length === 0) return "--";
  const codes = new Set<string>();
  cpc.forEach((entry) => {
    const section = (entry.section || "").trim();
    const klass = (entry.class || "").trim();
    const subclass = (entry.subclass || "").trim();
    const group = (entry.group || "").trim();
    const subgroup = (entry.subgroup || "").trim();
    const head = `${section}${klass}${subclass}`.trim();
    const tail = group ? `${group}${subgroup ? `/${subgroup}` : ""}` : "";
    const code = `${head}${tail ? ` ${tail}` : ""}`.trim();
    if (code) codes.add(code);
  });
  if (codes.size === 0) return "--";
  return Array.from(codes).slice(0, 4).join(", ");
}

function firstCpcCode(hit: PatentHit): string {
  if (!hit.cpc || hit.cpc.length === 0) return "";
  const entry = hit.cpc.find((c) => c.section || c.class || c.subclass || c.group || c.subgroup) ?? hit.cpc[0];
  const section = (entry.section || "").trim();
  const klass = (entry.class || "").trim();
  const subclass = (entry.subclass || "").trim();
  const group = (entry.group || "").trim();
  const subgroup = (entry.subgroup || "").trim();
  const head = `${section}${klass}${subclass}`.trim();
  const tail = group ? `${group}${subgroup ? `/${subgroup}` : ""}` : "";
  return `${head}${tail ? ` ${tail}` : ""}`.trim();
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatIsoDateUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function parseIsoDateUtc(value?: string | null): Date | null {
  if (!value) return null;
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if ([year, month, day].some((part) => Number.isNaN(part))) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function monthFloorUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function shiftMonthsUtc(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const targetMonthIndex = month + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDay);
  return new Date(Date.UTC(targetYear, normalizedMonth, day));
}

function deriveOverviewDateRange(
  dateFromValue: string,
  dateToValue: string,
  todayIso: string,
): { dateFrom: string; dateTo: string } {
  const fallbackToday = parseIsoDateUtc(todayIso);
  const parsedEnd = parseIsoDateUtc(dateToValue) ?? fallbackToday;
  if (!parsedEnd) {
    return { dateFrom: dateFromValue, dateTo: dateToValue };
  }
  const resolvedTo = dateToValue || formatIsoDateUtc(parsedEnd);
  const flooredEnd = monthFloorUtc(parsedEnd);
  const defaultStart = shiftMonthsUtc(flooredEnd, -23);
  const resolvedFrom = dateFromValue || formatIsoDateUtc(defaultStart);
  return { dateFrom: resolvedFrom, dateTo: resolvedTo };
}

function abstractPreviewText(value?: string | null, limit = ABSTRACT_PREVIEW_LIMIT): string {
  if (!value) return "—";
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "—";
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trimEnd()}…`;
}

function formatRangeLabel(points: OverviewPoint[], monthsBack: number): { label: string; months: number } {
  if (!points.length) return { label: "--", months: monthsBack };
  const endIdx = points.length - 1;
  const startIdx = Math.max(0, points.length - monthsBack);
  const startMonth = points[startIdx]?.month ?? points[0].month;
  const endMonth = points[endIdx]?.month ?? points[points.length - 1].month;
  return { label: `${monthsBack} months (${startMonth} – ${endMonth})`, months: monthsBack };
}

function normalizeNodeIds(ids?: string[]): string[] {
  if (!Array.isArray(ids)) return [];
  const unique = new Set<string>();
  ids.forEach((id) => {
    if (typeof id !== "string") return;
    const trimmed = id.trim();
    if (trimmed) {
      unique.add(trimmed);
    }
  });
  return Array.from(unique);
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseTimelineMonth(month?: string): Date | null {
  if (!month) return null;
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) return null;
  return new Date(year, monthIndex, 1);
}

function shiftMonth(date: Date, delta: number): Date {
  const shifted = new Date(date);
  shifted.setMonth(shifted.getMonth() + delta);
  shifted.setDate(1);
  return shifted;
}

function sumRecentMonths(points: OverviewPoint[], monthsBack: number): number {
  if (!points.length || monthsBack <= 0) return 0;
  const lastDate = parseTimelineMonth(points[points.length - 1].month);
  if (!lastDate) return 0;
  const cutoff = shiftMonth(lastDate, -(monthsBack - 1));
  return points.reduce((total, pt) => {
    const ptDate = parseTimelineMonth(pt.month);
    if (ptDate && ptDate >= cutoff) {
      return total + pt.count;
    }
    return total;
  }, 0);
}

function formatTimelineMonthLabel(month?: string): string {
  const parsed = parseTimelineMonth(month);
  if (!parsed) return "--";
  const shortYear = parsed.getFullYear().toString().slice(-2);
  return `${MONTH_LABELS[parsed.getMonth()]} '${shortYear}`;
}

function formatTimelineFullLabel(month?: string): string {
  const parsed = parseTimelineMonth(month);
  if (!parsed) return "--";
  return `${MONTH_LABELS[parsed.getMonth()]} ${parsed.getFullYear()}`;
}

function TimelineSparkline({ points }: { points: OverviewPoint[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  if (!points.length) {
    return (
      <div style={{ fontSize: 12, color: "#475569" }}>No results in selected window.</div>
    );
  }
  const width = 520;
  const chartHeight = 180;
  const labelSpace = 28;
  const height = chartHeight + labelSpace;
  const padding = 24;
  const lineHeight = chartHeight - padding * 2;
  const maxCount = Math.max(...points.map((pt) => pt.count), 1);
  const step = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  const coords = points.map((pt, idx) => {
    const x = padding + idx * step;
    const normalized = maxCount ? pt.count / maxCount : 0;
    const y = padding + lineHeight - normalized * lineHeight;
    return { x, y };
  });
  const activeIdx = hoveredIdx != null && hoveredIdx < coords.length ? hoveredIdx : null;
  const activePoint = activeIdx != null ? points[activeIdx] : null;
  const activeCoord = activeIdx != null ? coords[activeIdx] : null;

  const intervalMonths = [6, 12, 18, 24];
  const intervalLines = intervalMonths
    .map((months) => {
      const idx = Math.max(0, points.length - months);
      return { months, idx, point: points[idx], coord: coords[idx] };
    })
    .filter((entry): entry is { months: number; idx: number; point: OverviewPoint; coord: { x: number; y: number } } => Boolean(entry.point && entry.coord));

  const latestEntry =
    coords.length > 0 && points.length > 0
      ? { point: points[points.length - 1], coord: coords[coords.length - 1] }
      : null;
  const labelY = chartHeight + labelSpace - 8;

  const tooltipWidth = 220;
  const tooltipHeight = 88;
  const tooltipLeft = activeCoord
    ? Math.min(Math.max(activeCoord.x - tooltipWidth / 2, 0), width - tooltipWidth)
    : 0;
  const tooltipTop = activeCoord ? Math.max(8, activeCoord.y - tooltipHeight - 10) : 0;
  const filingsLabel =
    activePoint?.count != null
      ? `${numberFmt.format(activePoint.count)} ${activePoint.count === 1 ? "filing" : "filings"}`
      : null;
  const topAssigneeLabel = activePoint?.top_assignee || "Unknown";

  return (
    <div style={{ position: "relative", width, height }}>
      <svg
        width={width}
        height={height}
        style={{ borderRadius: 16, background: "rgba(248,250,252,0.8)", display: "block" }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <polyline
          fill="none"
          stroke="#3a506b"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ")}
        />
        {intervalLines.map((entry) => (
          <g key={`interval-${entry.months}`}>
            <line
              x1={entry.coord.x}
              x2={entry.coord.x}
              y1={padding}
              y2={chartHeight - padding}
              stroke="rgba(148,163,184,0.6)"
              strokeDasharray="6 4"
            />
            <text
              x={entry.coord.x}
              y={labelY}
              textAnchor="middle"
              fontSize={10}
              fill="#475569"
              style={{ fontWeight: 600 }}
            >
              {formatTimelineMonthLabel(entry.point.month)}
            </text>
          </g>
        ))}
        {latestEntry && (
          <g>
            <line
              x1={latestEntry.coord.x}
              x2={latestEntry.coord.x}
              y1={padding}
              y2={chartHeight - padding}
              stroke="rgba(148,163,184,0.6)"
              strokeDasharray="6 4"
            />
            <text
              x={latestEntry.coord.x}
              y={labelY}
              textAnchor="middle"
              fontSize={10}
              fill="#475569"
              style={{ fontWeight: 600 }}
            >
              {formatTimelineMonthLabel(latestEntry.point.month)}
            </text>
          </g>
        )}
        {coords.map((coord, idx) => {
          const isActive = idx === activeIdx;
          const ariaLabelParts = [
            formatTimelineFullLabel(points[idx].month),
            `${numberFmt.format(points[idx].count)} ${points[idx].count === 1 ? "filing" : "filings"}`,
          ];
          if (points[idx].top_assignee) {
            ariaLabelParts.push(`top assignee ${points[idx].top_assignee}`);
          }
          return (
            <circle
              key={points[idx].month}
              cx={coord.x}
              cy={coord.y}
              r={isActive ? 5 : 3.5}
              fill={isActive ? "#1F3E5D" : "#3A506B"}
              stroke={isActive ? "#ffffff" : "none"}
              strokeWidth={isActive ? 1.25 : 0}
              tabIndex={0}
              role="img"
              aria-label={ariaLabelParts.join(", ")}
              onMouseEnter={() => setHoveredIdx(idx)}
              onFocus={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx((current) => (current === idx ? null : current))}
              onBlur={() => setHoveredIdx((current) => (current === idx ? null : current))}
              style={{ cursor: "pointer" }}
            />
          );
        })}
      </svg>
      {activePoint && activeCoord && (
        <div
          style={{
            position: "absolute",
            left: tooltipLeft,
            top: tooltipTop,
            width: tooltipWidth,
            background: "rgba(15,23,42,0.92)",
            color: "#ffffff",
            padding: "12px 16px",
            borderRadius: 14,
            boxShadow: "0 12px 30px rgba(15,23,42,0.35)",
            fontSize: 12,
            lineHeight: 1.5,
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13 }}>{formatTimelineFullLabel(activePoint.month)}</div>
          {filingsLabel && <div>{filingsLabel}</div>}
          <div style={{ color: "#D9E2EC" }}>Top assignee: {topAssigneeLabel}</div>
        </div>
      )}
    </div>
  );
}

function cpcDefinitionUrl(cpc: string): string | null {
  if (!cpc) return null;
  const clean = cpc.replace(/\s+/g, "");
  if (clean.length < 4) return null;
  const prefix = clean.slice(0, 4).toUpperCase();
  const anchor = clean.toUpperCase();
  return `https://www.uspto.gov/web/patents/classification/cpc/html/def${prefix}.html#${anchor}`;
}

function CpcBarChart({ items }: { items: { cpc: string; count: number }[] }) {
  if (!items.length) {
    return (
      <div style={{ fontSize: 12, color: "#475569" }}>No CPC signals for this scope.</div>
    );
  }
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((item) => {
        const width = `${Math.max(4, Math.round((item.count / max) * 100))}%`;
        const url = cpcDefinitionUrl(item.cpc);
        return (
          <div key={item.cpc || `cpc-${item.count}`} style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "#102a43" }}>
              {url ? (
                <a href={url} target="_blank" rel="noreferrer" className="text-[#6BAEDB] hover:underline hover:text-[#39506B]">
                  {item.cpc || "Unknown"}
                </a>
              ) : (
                <span>{item.cpc || "Unknown"}</span>
              )}
              <span>{numberFmt.format(item.count)}</span>
            </div>
            <div style={{ background: "rgba(148,163,184,0.25)", borderRadius: 999, height: 8 }}>
              <div
                style={{
                  width,
                  height: "100%",
                  borderRadius: 999,
                  background: "linear-gradient(90deg, #5FA8D2 0%, #102a43 100%)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OverviewPage() {
  const { isAuthenticated, isLoading: authLoading, loginWithRedirect, getAccessTokenSilently } = useAuth0();
  const today = useRef<string>(new Date().toISOString().slice(0, 10)).current;

  const [keywords, setKeywords] = useState("");
  const [cpcFilter, setCpcFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showSemantic, setShowSemantic] = useState(true);
  const [groupByAssignee, setGroupByAssignee] = useState(false);

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [exactResults, setExactResults] = useState<PatentHit[]>([]);
  const [semanticResults, setSemanticResults] = useState<PatentHit[]>([]);
  const [totalExactResults, setTotalExactResults] = useState(0);
  const [totalSemanticResults, setTotalSemanticResults] = useState(0);
  const [resultMode, setResultMode] = useState<ResultMode>("exact");
  const [resultPage, setResultPage] = useState(1);
  const [sortState, setSortState] = useState<{ key: ResultSortKey; direction: SortDirection }>({
    key: "relevance",
    direction: "desc",
  });
  const [assigneeData, setAssigneeData] = useState<OverviewGraphResponse | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [activeSignalKey, setActiveSignalKey] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [assigneeLoading, setAssigneeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<RunQuery | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleInput =
    (setter: (value: string) => void) =>
    (event: ChangeEvent<HTMLInputElement>) =>
      setter(event.target.value);

  const runAssigneeFetch = useCallback(
    async (query: RunQuery, token?: string) => {
      try {
        setAssigneeLoading(true);
        const authHeader = token ?? (await getAccessTokenSilently());
        const focusKeywords = query.keywords
          ? query.keywords.split(",").map((item) => item.trim()).filter(Boolean)
          : [];
        const focusCpc = query.cpc
          ? query.cpc.split(",").map((item) => item.trim()).filter(Boolean)
          : [];
        const payload = {
          date_from: query.dateFrom || undefined,
          date_to: query.dateTo || undefined,
          neighbors: 15,
          resolution: 0.5,
          alpha: 0.8,
          beta: 0.5,
          limit: 1000,
          layout: true,
          debug: false,
          focus_keywords: focusKeywords,
          focus_cpc_like: focusCpc,
          search_mode: "keywords" as const,
          assignee_query: null,
        };
        const response = await fetch("/api/overview/graph", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authHeader}`,
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const detail = await response.json().catch(() => ({} as Record<string, unknown>));
          throw new Error((detail as { detail?: string }).detail || `HTTP ${response.status}`);
        }
        const data = (await response.json()) as OverviewGraphResponse;
        setAssigneeData(data);
      } finally {
        setAssigneeLoading(false);
      }
    },
    [getAccessTokenSilently],
  );

  useEffect(() => {
    if (!groupByAssignee) {
      setHighlightedNodeIds([]);
      setActiveSignalKey(null);
    }
  }, [groupByAssignee]);

  useEffect(() => {
    setHighlightedNodeIds([]);
    setActiveSignalKey(null);
  }, [assigneeData?.graph]);

  const fetchSearchResults = useCallback(
    async (token: string, payload: SearchRequestPayload) => {
      const aggregated: PatentHit[] = [];
      let totalCount = 0;
      let offset = 0;
      let fetching = true;

      while (fetching) {
        const searchPayload = {
          ...payload,
          limit: SEARCH_BATCH_SIZE,
          offset,
        };
        const res = await fetch("/api/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(searchPayload),
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error((detail as { detail?: string }).detail || `Search failed (${res.status})`);
        }
        const data = (await res.json()) as SearchResponse;
        const batchItems = data.items ?? [];
        if (offset === 0) {
          totalCount = data.total ?? batchItems.length ?? 0;
        }
        if (batchItems.length) {
          aggregated.push(...batchItems);
        }
        if (batchItems.length < SEARCH_BATCH_SIZE || (totalCount > 0 && aggregated.length >= totalCount)) {
          fetching = false;
        } else {
          offset += SEARCH_BATCH_SIZE;
        }
      }

      return {
        total: totalCount || aggregated.length,
        items: aggregated,
      };
    },
    [],
  );

  const runAnalysis = useCallback(async () => {
    if (!isAuthenticated) {
      await loginWithRedirect();
      return;
    }
    const trimmedKeywords = keywords.trim();
    const trimmedCpc = cpcFilter.trim();
    if (!trimmedKeywords && !trimmedCpc) {
      setError("Enter focus keywords or a CPC filter to run the overview.");
      return;
    }
    const { dateFrom: derivedDateFrom, dateTo: derivedDateTo } = deriveOverviewDateRange(dateFrom, dateTo, today);

    const currentQuery: RunQuery = {
      keywords: trimmedKeywords,
      cpc: trimmedCpc,
      dateFrom: derivedDateFrom || "",
      dateTo: derivedDateTo || "",
      semantic: showSemantic,
    };

    setLoading(true);
    setError(null);
    setAssigneeData(null);

    try {
      const token = await getAccessTokenSilently();
      const params = new URLSearchParams();
      if (currentQuery.keywords) params.set("keywords", currentQuery.keywords);
      if (currentQuery.cpc) params.set("cpc", currentQuery.cpc);
      const toIntDate = (value: string) => (value ? parseInt(value.replace(/-/g, ""), 10) : undefined);
      const fromInt = toIntDate(currentQuery.dateFrom);
      const toInt = toIntDate(currentQuery.dateTo);
      if (fromInt) params.set("date_from", String(fromInt));
      if (toInt) params.set("date_to", String(toInt));
      if (currentQuery.semantic) params.set("semantic", "1");

      const overviewPromise = fetch(`/api/overview/overview?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const baseFilters = {
        cpc: currentQuery.cpc || null,
        date_from: fromInt ?? null,
        date_to: toInt ?? null,
      };

      const exactPromise = fetchSearchResults(token, {
        keywords: currentQuery.keywords || null,
        semantic_query: null,
        filters: baseFilters,
        sort_by: "relevance_desc",
      });

      const semanticPromise: Promise<{ total: number; items: PatentHit[] } | null> =
        currentQuery.semantic && currentQuery.keywords
          ? fetchSearchResults(token, {
              keywords: null,
              semantic_query: currentQuery.keywords,
              filters: baseFilters,
              sort_by: "relevance_desc",
            })
          : Promise.resolve(null);

      const [overviewRes, exactData, semanticData] = await Promise.all([overviewPromise, exactPromise, semanticPromise]);
      if (!overviewRes.ok) {
        const detail = await overviewRes.json().catch(() => ({}));
        throw new Error(detail.detail || `IP Overview failed (${overviewRes.status})`);
      }

      const overviewJson = (await overviewRes.json()) as OverviewResponse;
      setOverview(overviewJson);
      setExactResults(exactData.items);
      setTotalExactResults(exactData.total || exactData.items.length);
      if (semanticData && currentQuery.semantic && currentQuery.keywords) {
        setSemanticResults(semanticData.items);
        setTotalSemanticResults(semanticData.total || semanticData.items.length);
      } else {
        setSemanticResults([]);
        setTotalSemanticResults(0);
      }
      setResultMode("exact");
      setResultPage(1);
      setLastQuery(currentQuery);

      if (groupByAssignee) {
        await runAssigneeFetch(currentQuery, token);
      } else {
        setAssigneeData(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to run overview analysis.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [
    cpcFilter,
    dateFrom,
    dateTo,
    fetchSearchResults,
    getAccessTokenSilently,
    today,
    groupByAssignee,
    isAuthenticated,
    keywords,
    loginWithRedirect,
    runAssigneeFetch,
    showSemantic,
  ]);

  const handleToggleGroup = useCallback(
    async (checked: boolean) => {
      setGroupByAssignee(checked);
       setHighlightedNodeIds([]);
       setActiveSignalKey(null);
      if (!checked) {
        setAssigneeData(null);
        return;
      }
      if (lastQuery) {
        try {
          await runAssigneeFetch(lastQuery);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to load assignee view.";
          setError(message);
        }
      }
    },
    [lastQuery, runAssigneeFetch],
  );

  const summaryLine = useMemo(() => {
    if (!overview) return null;
    const percentile = overview.crowding.percentile;
    const percentileLabelText = percentile !== null && percentile !== undefined ? percentileLabel(percentile) : "--";
    return `Saturation: ${numberFmt.format(overview.crowding.total)} total (${percentileLabelText}) | Activity Rate: ${overview.crowding.density_per_month.toFixed(1)}/mo | Momentum: ${overview.momentum.bucket}`;
  }, [overview]);

  useEffect(() => {
    if (!showSemantic) {
      setResultMode("exact");
      setSemanticResults([]);
      setTotalSemanticResults(0);
    }
  }, [showSemantic]);

  useEffect(() => {
    setResultPage(1);
  }, [resultMode]);

  const topCpcTile = useMemo(() => {
    if (!overview) return [];
    return overview.top_cpcs.slice(0, 5);
  }, [overview]);

  const recencyValues = useMemo(() => {
    if (!overview) {
      return { 6: 0, 12: 0, 18: 0, 24: 0 };
    }
    return {
      6: overview.recency.m6,
      12: overview.recency.m12,
      18: sumRecentMonths(overview.timeline, 18),
      24: overview.recency.m24,
    };
  }, [overview]);

  const activeResults = resultMode === "semantic" ? semanticResults : exactResults;
  const activeTotalResults = resultMode === "semantic" ? totalSemanticResults : totalExactResults;
  const hasKeywordInput = keywords.trim().length > 0;
  const semanticResultsEnabled = showSemantic && hasKeywordInput;
  const semanticResultsAvailable = semanticResultsEnabled && totalSemanticResults > 0;

  const sortedResults = useMemo(() => {
    const source = activeResults;
    if (!source.length) return source;
    if (sortState.key === "relevance") {
      return source;
    }
    const copy = [...source];
    const dir = sortState.direction === "asc" ? 1 : -1;
    const normalizeString = (value: string | null | undefined) => (value || "").toLowerCase().trim();
    const getValue = (hit: PatentHit): string | number | null => {
      switch (sortState.key) {
        case "title":
          return normalizeString(hit.title || hit.pub_id);
        case "abstract":
          return normalizeString(hit.abstract);
        case "pub_id":
          return normalizeString(hit.pub_id);
        case "assignee":
          return normalizeString(hit.assignee_name);
        case "pub_date":
          return pubDateValue(hit.pub_date);
        case "cpc":
          return normalizeString(firstCpcCode(hit));
        default:
          return hit.score ?? null;
      }
    };

    copy.sort((a, b) => {
      const aVal = getValue(a);
      const bVal = getValue(b);

      if (typeof aVal === "number" || typeof bVal === "number") {
        const aNum = typeof aVal === "number" ? aVal : null;
        const bNum = typeof bVal === "number" ? bVal : null;
        if (aNum !== bNum) {
          if (aNum === null) return 1;
          if (bNum === null) return -1;
          return (aNum - bNum) * dir;
        }
      } else {
        const aStr = normalizeString(aVal as string);
        const bStr = normalizeString(bVal as string);
        if (aStr !== bStr) {
          return aStr.localeCompare(bStr) * dir;
        }
      }

      const aDate = pubDateValue(a.pub_date);
      const bDate = pubDateValue(b.pub_date);
      if (aDate !== bDate) {
        if (aDate === null) return 1;
        if (bDate === null) return -1;
        return bDate - aDate;
      }
      return (a.pub_id || "").localeCompare(b.pub_id || "");
    });
    return copy;
  }, [activeResults, sortState]);

  const handleSort = (key: ResultSortKey) => {
    setSortState((prev) =>
      prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }
    );
    setResultPage(1);
  };

  const paginatedResults = useMemo(() => {
    const start = (resultPage - 1) * RESULTS_PER_PAGE;
    return sortedResults.slice(start, start + RESULTS_PER_PAGE);
  }, [sortedResults, resultPage]);

  const totalResultPages = useMemo(() => {
    if (!sortedResults.length) return 1;
    return Math.max(1, Math.ceil(sortedResults.length / RESULTS_PER_PAGE));
  }, [sortedResults]);

  useEffect(() => {
    setResultPage((prev) => Math.min(prev, totalResultPages));
  }, [totalResultPages]);

  const startIndex = (resultPage - 1) * RESULTS_PER_PAGE;
  const resultModeLabel = resultMode === "semantic" ? "Semantic neighbors" : "Exact matches";
  const totalForDisplay = activeTotalResults || sortedResults.length;
  const showingRangeLabel = sortedResults.length
    ? `${numberFmt.format(startIndex + 1)}-${numberFmt.format(Math.min(sortedResults.length, startIndex + RESULTS_PER_PAGE))} of ${numberFmt.format(totalForDisplay)} • ${resultModeLabel}`
    : "";
  const canPrev = resultPage > 1;
  const canNext = resultPage < totalResultPages;

  const handleReset = useCallback(() => {
    setKeywords("");
    setCpcFilter("");
    setDateFrom("");
    setDateTo("");
    setShowSemantic(true);
    setGroupByAssignee(false);
    setOverview(null);
    setExactResults([]);
    setSemanticResults([]);
    setTotalExactResults(0);
    setTotalSemanticResults(0);
    setResultMode("exact");
    setResultPage(1);
    setSortState({ key: "relevance", direction: "desc" });
    setAssigneeData(null);
    setHighlightedNodeIds([]);
    setActiveSignalKey(null);
    setError(null);
    setLastQuery(null);
  }, []);

  const handleSignalCardClick = useCallback(
    (assigneeName: string, signalType: SignalKind, nodeIds: string[]) => {
      const sanitizedNodes = [...nodeIds];
      const signalKey = `${assigneeName}::${signalType}`;
      if (sanitizedNodes.length === 0) {
        setHighlightedNodeIds([]);
        setActiveSignalKey(null);
        return;
      }
      setHighlightedNodeIds((prev) => {
        const sameLength = prev.length === sanitizedNodes.length;
        const sameOrder = sameLength && prev.every((id, idx) => id === sanitizedNodes[idx]);
        return sameOrder && activeSignalKey === signalKey ? [] : sanitizedNodes;
      });
      setActiveSignalKey((prev) => (prev === signalKey ? null : signalKey));
    },
    [activeSignalKey],
  );

  const exportResultsPdf = useCallback(() => {
    if (!overview || sortedResults.length === 0) {
      setError("Run search before exporting.");
      return;
    }
    setExporting(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const marginX = 48;
      const marginY = 54;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const contentWidth = pageWidth - marginX * 2;
      let y = marginY;

      const ensureSpace = (height = 16) => {
        if (y + height > pageHeight - marginY) {
          doc.addPage();
          y = marginY;
        }
      };

      const addWrappedText = (text: string, fontSize = 12, gap = 14, font: "normal" | "bold" | "italic" = "normal") => {
        doc.setFont("helvetica", font);
        doc.setFontSize(fontSize);
        const wrapped = doc.splitTextToSize(text, contentWidth);
        wrapped.forEach((line: string) => {
          ensureSpace();
          doc.text(line, marginX, y);
          y += gap;
        });
      };

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("SynapseIP – IP Overview", marginX, y);
      y += 24;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      const scopeLines = [
        `Keywords: ${keywords || "—"}`,
        `CPC Filter: ${cpcFilter || "—"}`,
        `Date Range: ${(dateFrom || "—")} – ${(dateTo || "—")}`,
        `Semantic Neighbors: ${showSemantic ? "On" : "Off"}`,
        `Group by Assignee: ${groupByAssignee ? "On" : "Off"}`,
        `Result Source: ${resultModeLabel}`,
      ];
      scopeLines.forEach((line) => addWrappedText(line));

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      ensureSpace();
      doc.text("Scope Metrics", marginX, y);
      y += 18;

      const percentileLabelText =
        overview.crowding.percentile !== null && overview.crowding.percentile !== undefined
          ? percentFmt.format(overview.crowding.percentile)
          : "--";
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      const metricLines = [
        `Saturation: ${numberFmt.format(overview.crowding.total)} total (Exact ${numberFmt.format(
          overview.crowding.exact,
        )}${showSemantic ? `, Semantic ${numberFmt.format(overview.crowding.semantic)}` : ""}, Percentile ${percentileLabelText})`,
        `Activity Rate: ${overview.crowding.density_per_month.toFixed(1)}/mo (Mean ${overview.density.mean_per_month.toFixed(
          1,
        )}, Band ${overview.density.min_per_month} – ${overview.density.max_per_month})`,
        `Momentum: ${overview.momentum.bucket} (Slope ${overview.momentum.slope.toFixed(2)}, CAGR ${
          overview.momentum.cagr !== null && overview.momentum.cagr !== undefined ? percentFmt.format(overview.momentum.cagr) : "--"
        })`,
        `Top CPCs: ${overview.top_cpcs
          .slice(0, 3)
          .map((c) => `${c.cpc || "Unknown"} (${numberFmt.format(c.count)})`)
          .join(", ") || "—"}`,
      ];
      metricLines.forEach((line) => addWrappedText(line));

      ensureSpace();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      const exportRows = sortedResults.slice(0, PDF_EXPORT_LIMIT);
      doc.text(`Results (${numberFmt.format(exportRows.length)} of ${numberFmt.format(sortedResults.length)})`, marginX, y);
      y += 16;
      ensureSpace();
      doc.setFont("helvetica", "italic");
      doc.setFontSize(11);
      doc.text(`Sort: ${formatSortLabel(sortState)}`, marginX, y);
      y += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      exportRows.forEach((row, idx) => {
        const title = `${idx + 1}. ${row.title || row.pub_id}`;
        const details = [
          `Publication: ${row.pub_id}${row.kind_code ? ` (${row.kind_code})` : ""}`,
          `Assignee: ${row.assignee_name ?? "Unknown"}`,
          `Date: ${formatPubDate(row.pub_date)}`,
          `CPC: ${CPCList(row.cpc)}`,
          `Abstract: ${abstractPreviewText(row.abstract)}`,
        ];
        addWrappedText(title, 12, 14, "bold");
        details.forEach((line) => addWrappedText(line));
        y += 4;
      });

      if (sortedResults.length > PDF_EXPORT_LIMIT) {
        ensureSpace();
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.text(`Note: Export limited to first ${PDF_EXPORT_LIMIT.toLocaleString()} results.`, marginX, y);
      }

      const filename = `overview_results_${Date.now()}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to export PDF.";
      setError(message);
    } finally {
      setExporting(false);
    }
  }, [overview, sortedResults, keywords, cpcFilter, dateFrom, dateTo, showSemantic, groupByAssignee, sortState, resultModeLabel]);

  return (
    <div style={pageWrapperStyle}>
      <div className="glass-surface" style={pageSurfaceStyle}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 4 }}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 mb-2">
              IP Overview
            </p>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#102a43" }}>Density and Distribution Analysis</h1>
              <p style={{ margin: 0, fontSize: 14, color: "#475569" }}>
                Subject matter saturation, patent/publication activity rates and momentum, and CPC distribution for specific search criteria and semantically similar areas.
              </p>
            </div>
            {!isAuthenticated && !authLoading && (
              <GhostButton onClick={() => loginWithRedirect()}>
                Log in to Run
              </GhostButton>
            )}
          </div>
          {summaryLine && (
            <div style={{ marginTop: 12, fontSize: 12, color: "#475569", fontWeight: 600 }}>
              {summaryLine}
            </div>
          )}
        </Card>

        <Card>
          <div style={{ display: "grid", gap: 16 }}>
            <Row gap={16}>
              <div style={{ display: "grid", gap: 6, minWidth: 280, flex: 1 }}>
                <Label htmlFor="ws-keywords">Focus Keywords</Label>
                <input
                  id="ws-keywords"
                  placeholder="e.g., autonomous vehicles, multimodal reasoning"
                  value={keywords}
                  onChange={handleInput(setKeywords)}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "grid", gap: 6, minWidth: 220 }}>
                <Label htmlFor="ws-cpc">CPC</Label>
                <input
                  id="ws-cpc"
                  placeholder="e.g., G06N, A61B5/00"
                  value={cpcFilter}
                  onChange={handleInput(setCpcFilter)}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <Label htmlFor="ws-from">From</Label>
                <input
                  id="ws-from"
                  type="date"
                  min="2022-01-01"
                  max={dateTo || today}
                  value={dateFrom}
                  onChange={handleInput(setDateFrom)}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <Label htmlFor="ws-to">To</Label>
                <input
                  id="ws-to"
                  type="date"
                  min={dateFrom || "2022-01-02"}
                  max={today}
                  value={dateTo}
                  onChange={handleInput(setDateTo)}
                  style={inputStyle}
                />
              </div>
            </Row>
            <Row align="center">
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <label style={toggleLabelStyle}>
                  <input type="checkbox" checked={showSemantic} onChange={(event) => setShowSemantic(event.target.checked)} />
                  Show Semantic Neighbors
                </label>
                <label style={toggleLabelStyle}>
                  <input type="checkbox" checked={groupByAssignee} onChange={(event) => handleToggleGroup(event.target.checked)} />
                  Group by Assignee
                </label>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <PrimaryButton onClick={runAnalysis} disabled={loading || authLoading}>
                  {loading ? "Calculating…" : "Run Search"}
                </PrimaryButton>
                <GhostButton onClick={handleReset}>Reset</GhostButton>
              </div>
            </Row>
            {error && (
              <div style={{ fontSize: 13, color: "#b91c1c", fontWeight: 600 }}>{error}</div>
            )}
          </div>
        </Card>

        {overview && (
          <>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#102a43" }}>Scope Metrics</h2>
                <span style={{ fontSize: 12, color: "#475569" }}>Window: {overview.window_months} months</span>
              </div>
              <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div style={tileStyle}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Patent/Pub Saturation</span>
                  <span style={{ fontSize: 28, fontWeight: 700, color: "#102a43" }}>{numberFmt.format(overview.crowding.total)}</span>
                  <div style={{ fontSize: 13, color: "#475569", display: "grid", gap: 2 }}>
                    <span>Exact: {numberFmt.format(overview.crowding.exact)}</span>
                    {showSemantic && <span>Semantic: {numberFmt.format(overview.crowding.semantic)}</span>}
                    <span>Percentile: {overview.crowding.percentile !== null && overview.crowding.percentile !== undefined ? percentFmt.format(overview.crowding.percentile) : "--"}</span>
                  </div>
                </div>
                <div style={tileStyle}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Grant/Pub Activity Rate</span>
                  <span style={{ fontSize: 28, fontWeight: 700, color: "#102a43" }}>{overview.crowding.density_per_month.toFixed(1)} / mo</span>
                  <div style={{ fontSize: 13, color: "#475569", display: "grid", gap: 2 }}>
                    <span>Mean: {overview.density.mean_per_month.toFixed(1)}</span>
                    <span>Band: {overview.density.min_per_month} – {overview.density.max_per_month}</span>
                  </div>
                </div>
                <div style={tileStyle}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Grant/Pub Momentum</span>
                  <span style={{ fontSize: 28, fontWeight: 700, color: overview.momentum.bucket === "Up" ? "#15803d" : overview.momentum.bucket === "Down" ? "#b91c1c" : "#102a43" }}>
                    {overview.momentum.bucket}
                  </span>
                  <div style={{ fontSize: 13, color: "#475569", display: "grid", gap: 2 }}>
                    <span>Slope: {overview.momentum.slope.toFixed(2)}</span>
                    <span>CAGR: {overview.momentum.cagr !== null && overview.momentum.cagr !== undefined ? percentFmt.format(overview.momentum.cagr) : "--"}</span>
                  </div>
                </div>
                <div style={tileStyle}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Top CPCs</span>
                  <div style={{ display: "grid", gap: 6 }}>
                    {topCpcTile.length === 0 && <span style={{ fontSize: 12, color: "#475569" }}>No CPCs in window.</span>}
                    {topCpcTile.map((item) => (
                      <div key={item.cpc} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#102a43" }}>
                        <span>{item.cpc || "Unknown"}</span>
                        <span>{numberFmt.format(item.count)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#102a43" }}>Timeline</div>
                  <TimelineSparkline points={overview.timeline} />
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#475569", display: "grid", gap: 4 }}>
                    <li>
                      {formatRangeLabel(overview.timeline, 6).label}: {numberFmt.format(recencyValues[6])}
                    </li>
                    <li>
                      {formatRangeLabel(overview.timeline, 12).label}: {numberFmt.format(recencyValues[12])}
                    </li>
                    <li>
                      {formatRangeLabel(overview.timeline, 18).label}: {numberFmt.format(recencyValues[18])}
                    </li>
                    <li>
                      {formatRangeLabel(overview.timeline, 24).label}: {numberFmt.format(recencyValues[24])}
                    </li>
                  </ul>
                </div>
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#102a43" }}>CPC Distribution</div>
                  <CpcBarChart items={overview.cpc_breakdown.slice(0, 8)} />
                </div>
              </div>
            </Card>
          </>
        )}

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: "semibold", color: "#102a43" }}>RESULTS</h2>
              <div style={{ fontSize: 12, color: "#475569" }}>
                {activeTotalResults ? `${numberFmt.format(activeTotalResults)} patents & publications (${resultModeLabel})` : "No data"}
              </div>
              {resultMode === "exact" && semanticResultsAvailable && (
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  Semantic neighbors available: {numberFmt.format(totalSemanticResults)}
                </div>
              )}
              {showSemantic && !hasKeywordInput && (
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Add focus keywords to compute semantic neighbors.</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Label htmlFor="result-source">Results</Label>
                <select
                  id="result-source"
                  value={resultMode}
                  onChange={(event) => setResultMode(event.target.value as ResultMode)}
                  style={{
                    height: 32,
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.6)",
                    background: semanticResultsEnabled ? "rgba(248,250,252,0.9)" : "rgba(248,250,252,0.5)",
                    padding: "0 10px",
                    fontSize: 12,
                    color: "#102a43",
                    minWidth: 140,
                  }}
                >
                  <option value="exact">Exact matches</option>
                  <option value="semantic" disabled={!semanticResultsEnabled}>Semantic neighbors</option>
                </select>
              </div>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>(Max export: {PDF_EXPORT_LIMIT.toLocaleString()} rows)</span>
              <GhostButton onClick={exportResultsPdf} disabled={sortedResults.length === 0 || exporting} style={{ height: 36 }}>
                {exporting ? "Exporting…" : "Export PDF"}
              </GhostButton>
            </div>
          </div>
          <div
            style={{
              borderRadius: 16,
              background: "rgba(255, 255, 255, 0.78)",
              boxShadow: "0 18px 40px rgba(15, 23, 42, 0.22)",
              overflow: "hidden",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <SortableHeader
                      label="Title"
                      active={sortState.key === "title"}
                      direction={sortState.direction}
                      onClick={() => handleSort("title")}
                      minWidth={220}
                    />
                    <SortableHeader
                      label="Abstract"
                      active={sortState.key === "abstract"}
                      direction={sortState.direction}
                      onClick={() => handleSort("abstract")}
                      minWidth={220}
                    />
                    <SortableHeader
                      label="Patent/Pub No."
                      active={sortState.key === "pub_id"}
                      direction={sortState.direction}
                      onClick={() => handleSort("pub_id")}
                    />
                    <SortableHeader
                      label="Assignee"
                      active={sortState.key === "assignee"}
                      direction={sortState.direction}
                      onClick={() => handleSort("assignee")}
                    />
                    <SortableHeader
                      label="Grant/Pub Date"
                      active={sortState.key === "pub_date"}
                      direction={sortState.direction}
                      onClick={() => handleSort("pub_date")}
                    />
                    <SortableHeader
                      label="CPC"
                      active={sortState.key === "cpc"}
                      direction={sortState.direction}
                      onClick={() => handleSort("cpc")}
                    />
                  </tr>
                </thead>
                <tbody>
                  {paginatedResults.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: "12px", color: "#475569" }}></td>
                    </tr>
                  )}
                  {paginatedResults.map((row) => (
                    <tr key={row.pub_id}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: "#102a43" }}>{row.title || row.pub_id}</td>
                      <td style={{ ...tdStyle, color: "#475569", minWidth: 220, maxWidth: 360 }}>
                        {abstractPreviewText(row.abstract)}
                      </td>
                      <td style={tdStyle}>
                        <a href={`https://patents.google.com/patent/${formatPatentId(row.pub_id)}`} target="_blank" rel="noreferrer" style={{ color: "#3A506B", textDecoration: "none" }}>
                          {row.pub_id}
                        </a>
                      </td>
                      <td style={tdStyle}>{row.assignee_name ? row.assignee_name : "Unknown"}</td>
                      <td style={tdStyle}>{formatPubDate(row.pub_date)}</td>
                      <td style={tdStyle}>{CPCList(row.cpc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#475569" }}>{showingRangeLabel}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <GhostButton onClick={() => setResultPage((prev) => Math.max(1, prev - 1))} disabled={!canPrev} style={{ height: 34 }}>
                Previous
              </GhostButton>
              <span style={{ fontSize: 12, color: "#475569" }}>Page {numberFmt.format(resultPage)} / {numberFmt.format(totalResultPages)}</span>
              <GhostButton onClick={() => setResultPage((prev) => Math.min(totalResultPages, prev + 1))} disabled={!canNext} style={{ height: 34 }}>
                Next
              </GhostButton>
            </div>
          </div>
        </Card>

        {groupByAssignee && (
          <Card style={{ display: "grid", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: "semibold", color: "#102a43" }}>ASSIGNEE SIGNALS</h2>
              {assigneeLoading && <span style={{ fontSize: 12, color: "#475569" }}>Loading…</span>}
            </div>
            {assigneeData?.graph && (
              <div style={{ borderRadius: 20, overflow: "hidden", border: "1px solid rgba(148,163,184,0.25)" }}>
                <SigmaOverviewGraph data={assigneeData.graph} height={420} selectedSignal={null} highlightedNodeIds={highlightedNodeIds} />
              </div>
            )}
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              {(assigneeData?.assignees ?? []).map((assignee) => (
                <div
                  key={assignee.assignee}
                  style={{
                    padding: 18,
                    borderRadius: 18,
                    background: "rgba(248,250,252,0.9)",
                    border: "1px solid rgba(148,163,184,0.2)",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#102a43" }}>{assignee.assignee}</div>
                  {assignee.summary && (
                    <div style={{ fontSize: 12, color: "#475569" }}>{assignee.summary}</div>
                  )}
                  <div style={{ display: "grid", gap: 6 }}>
                    {assignee.signals.map((signal) => {
                      const signalKey = `${assignee.assignee}::${signal.type}`;
                      const accentStyle = getSignalAccentStyle(signal);
                      const nodeIds = normalizeNodeIds(signal.node_ids);
                      const hasTargets = nodeIds.length > 0;
                      const isActive = activeSignalKey === signalKey && highlightedNodeIds.length > 0;
                      return (
                        <button
                          key={signal.type}
                          type="button"
                          aria-pressed={isActive}
                          disabled={!hasTargets}
                          onClick={() => handleSignalCardClick(assignee.assignee, signal.type, nodeIds)}
                          style={{
                            display: "grid",
                            gap: 4,
                            padding: "8px 10px",
                            borderRadius: 12,
                            border: `1px solid ${accentStyle?.borderColor ?? "rgba(148,163,184,0.3)"}`,
                            background: accentStyle?.background ?? "rgba(226,232,240,0.6)",
                            color: accentStyle?.textColor ?? "#102a43",
                            cursor: hasTargets ? "pointer" : "default",
                            opacity: hasTargets ? 1 : 0.65,
                            textAlign: "left",
                            transition: "transform 0.15s ease, box-shadow 0.15s ease",
                            font: "inherit",
                            boxShadow: isActive ? "0 0 0 2px rgba(59,130,246,0.35)" : undefined,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: accentStyle?.textColor ?? "#102a43" }}>
                            <span>{SIGNAL_LABELS[signal.type]}</span>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: 11,
                                background: accentStyle ? "rgba(255,255,255,0.2)" : "rgba(15,23,42,0.06)",
                                color: accentStyle ? accentStyle.textColor : "#0f172a",
                              }}
                            >
                              {STATUS_BADGES[signal.status]}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: accentStyle?.textColor ?? "#475569" }}>{signal.why}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {!assigneeLoading && (assigneeData?.assignees?.length ?? 0) === 0 && (
                <div style={{ fontSize: 12, color: "#475569" }}>
                  Run search or adjust filters to discover assignee-level signals.
                </div>
              )}
            </div>
          </Card>
        )}
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
