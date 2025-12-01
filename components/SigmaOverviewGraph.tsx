"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";

export type SignalKind = "focus_shift" | "emerging_gap" | "crowd_out" | "bridge";

export type OverviewNode = {
  id: string;
  cluster_id: number;
  assignee?: string | null;
  x?: number;
  y?: number;
  signals?: SignalKind[];
  relevance?: number;
  title?: string | null;
  tooltip?: string | null;
  pub_date?: string | number | null;
  overview_score?: number | null;
  local_density?: number | null;
  abstract?: string | null;
};

export type OverviewEdge = {
  source: string;
  target: string;
  weight?: number;
};

export type OverviewGraph = {
  nodes: OverviewNode[];
  edges: OverviewEdge[];
};

export type SigmaOverviewGraphProps = {
  data: OverviewGraph | null;
  height?: number;
  selectedSignal?: SignalKind | null;
  highlightedNodeIds?: string[];
};

const SIGNAL_LABELS: Record<SignalKind, string> = {
  focus_shift: "Focus Convergence",
  emerging_gap: "Sparse Focus Area",
  crowd_out: "Crowd-out Risk",
  bridge: "Bridge Opportunity",
};

const CLUSTER_KEYWORD_SAMPLE_SIZE = 25;
const CLUSTER_TERM_MIN_COUNT = 3;
const CLUSTER_TERM_MAX_COUNT = 5;
const CLUSTER_TERM_MIN_LENGTH = 5;
const CLUSTER_COMMON_TERM_RATIO = 0.7;
const CLUSTER_TERM_STOPWORDS = new Set<string>([
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
    "being",
    "further",
    "regarding",
    "having",
    "has",
    "after",
    "while",
    "whether",
    "during",
    "before",
    "another",
    "particular",
    "potential",
    "possible",
    "different",
    "least",
    "through",
    "other"
]);
const CLUSTER_TERM_STEM_STOPWORDS = [
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
    "correspond",
    "approach",
    "accord",
    "perform",
    "compar",
    "respect",
    "creat",
    "classif",
    "techniqu",
    "estimat",
    "receiv",
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
    "there",
    "permit",
    "allow",
    "enabl",
    "caus",
];

type ClusterLegendEntry = {
  id: number;
  color: string;
  label: string;
  tooltip: string;
};

function isStopwordToken(token: string): boolean {
  if (token.length < CLUSTER_TERM_MIN_LENGTH) return true;
  if (CLUSTER_TERM_STOPWORDS.has(token)) return true;
  return CLUSTER_TERM_STEM_STOPWORDS.some((stem) => token.startsWith(stem));
}

function singularizeTokenForVocabulary(token: string, vocabulary: Set<string>): string | null {
  if (!token.endsWith("s") || token.length < 4) return null;

  const candidates: string[] = [];
  if (token.endsWith("ies") && token.length > 4) {
    candidates.push(`${token.slice(0, -3)}y`);
  }
  if (token.endsWith("ves") && token.length > 4) {
    candidates.push(`${token.slice(0, -3)}f`);
    candidates.push(`${token.slice(0, -3)}fe`);
  }
  const esSuffixes = ["ses", "xes", "zes", "ches", "shes"];
  if (esSuffixes.some((suffix) => token.endsWith(suffix))) {
    candidates.push(token.slice(0, -2));
  }
  if (!token.endsWith("ss") && !token.endsWith("us") && !token.endsWith("is") && !token.endsWith("ed")) {
    candidates.push(token.slice(0, -1));
  }

  for (const candidate of candidates) {
    if (
      candidate &&
      candidate.length >= CLUSTER_TERM_MIN_LENGTH &&
      vocabulary.has(candidate)
    ) {
      return candidate;
    }
  }

  return null;
}

function canonicalizeKeyword(token: string, vocabulary: Set<string>): string {
  return singularizeTokenForVocabulary(token, vocabulary) ?? token;
}

function hslToHex(h: number, s: number, l: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  s = clamp(s);
  l = clamp(l);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp >= 0 && hp < 1) {
    r = c;
    g = x;
  } else if (hp >= 1 && hp < 2) {
    r = x;
    g = c;
  } else if (hp >= 2 && hp < 3) {
    g = c;
    b = x;
  } else if (hp >= 3 && hp < 4) {
    g = x;
    b = c;
  } else if (hp >= 4 && hp < 5) {
    r = x;
    b = c;
  } else if (hp >= 5 && hp < 6) {
    r = c;
    b = x;
  }
  const m = l - c / 2;
  const toHex = (v: number) => Math.round((v + m) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function colorForCluster(clusterId: number): string {
  const hue = (Math.abs(clusterId) * 47) % 360;
  return hslToHex(hue, 0.62, 0.6);
}

function normalizeRelevance(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0.2;
  const v = Number(value);
  if (Number.isNaN(v)) return 0.2;
  return Math.max(0, Math.min(1, v));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatGooglePatentId(pubId: string): string {
  if (!pubId) return "";
  const cleanedId = pubId.replace(/[- ]/g, "");
  const regex = /^(US)(\d{4})(\d{6})([A-Z]\d{1,2})$/;
  const match = cleanedId.match(regex);
  if (match) {
    const [, country, year, serial, kindCode] = match;
    const correctedSerial = `0${serial}`;
    return `${country}${year}${correctedSerial}${kindCode}`;
  }
  return cleanedId;
}

export default function SigmaOverviewGraph({
  data,
  height = 400,
  selectedSignal = null,
  highlightedNodeIds,
}: SigmaOverviewGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<any>(null);
  const graphRef = useRef<any>(null);
  const selectedRef = useRef<string | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const neighborsRef = useRef<Set<string>>(new Set());
  const signalRef = useRef<SignalKind | null>(selectedSignal ?? null);
  const highlightedRef = useRef<Set<string>>(new Set(highlightedNodeIds ?? []));
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedAttrs, setSelectedAttrs] = useState<any | null>(null);

  const clusterColor = useMemo(() => {
    const map = new Map<number, string>();
    (data?.nodes ?? []).forEach((node) => {
      if (!map.has(node.cluster_id)) {
        map.set(node.cluster_id, colorForCluster(node.cluster_id));
      }
    });
    return map;
  }, [data]);

  const clusterMetadata = useMemo<ClusterLegendEntry[]>(() => {
    const nodes = data?.nodes ?? [];
    if (nodes.length === 0) return [];

    const clusterBuckets = new Map<number, { color: string; nodes: OverviewNode[] }>();
    nodes.forEach((node) => {
      const clusterId = node.cluster_id;
      if (!clusterBuckets.has(clusterId)) {
        clusterBuckets.set(clusterId, {
          color: clusterColor.get(clusterId) || colorForCluster(clusterId),
          nodes: [],
        });
      }
      clusterBuckets.get(clusterId)!.nodes.push(node);
    });

    const tokenize = (text: string | null | undefined): string[] => {
      if (!text) return [];
      const matches = text.match(/[A-Za-z0-9]+/g);
      if (!matches) return [];
      return matches
        .map((token) => token.toLowerCase())
        .filter((token) => !isStopwordToken(token));
    };

    const computeTokenCounts = (clusterNodes: OverviewNode[]): Map<string, number> => {
      const counts = new Map<string, number>();
      if (clusterNodes.length === 0) {
        return counts;
      }

      const sortedNodes = [...clusterNodes].sort((a, b) => {
        const bRel = normalizeRelevance(b.relevance);
        const aRel = normalizeRelevance(a.relevance);
        if (bRel !== aRel) return bRel - aRel;

        const bOverview =
          typeof b.overview_score === "number" && Number.isFinite(b.overview_score)
            ? b.overview_score
            : 0;
        const aOverview =
          typeof a.overview_score === "number" && Number.isFinite(a.overview_score)
            ? a.overview_score
            : 0;
        if (bOverview !== aOverview) return bOverview - aOverview;

        const aDensity =
          typeof a.local_density === "number" && Number.isFinite(a.local_density)
            ? a.local_density
            : Number.POSITIVE_INFINITY;
        const bDensity =
          typeof b.local_density === "number" && Number.isFinite(b.local_density)
            ? b.local_density
            : Number.POSITIVE_INFINITY;
        if (aDensity !== bDensity) return aDensity - bDensity;

        return a.id.localeCompare(b.id);
      });

      const sample = sortedNodes.slice(
        0,
        Math.min(CLUSTER_KEYWORD_SAMPLE_SIZE, sortedNodes.length),
      );

      sample.forEach((node) => {
        const perNodeTokens = new Set<string>();
        [node.title, node.abstract].forEach((text) => {
          tokenize(text).forEach((token) => perNodeTokens.add(token));
        });
        perNodeTokens.forEach((token) => {
          counts.set(token, (counts.get(token) ?? 0) + 1);
        });
      });

      return counts;
    };

    const clusterEntries = Array.from(clusterBuckets.entries()).map(([id, info]) => ({
      id,
      color: info.color,
      nodes: info.nodes,
      counts: computeTokenCounts(info.nodes),
    }));

    if (clusterEntries.length === 0) return [];

    const tokenCoverage = new Map<string, number>();
    clusterEntries.forEach(({ counts }) => {
      counts.forEach((_, token) => {
        tokenCoverage.set(token, (tokenCoverage.get(token) ?? 0) + 1);
      });
    });

    const clusterCount = clusterEntries.length;
    const coverageThreshold =
      clusterCount <= 2
        ? clusterCount
        : Math.max(2, Math.ceil(clusterCount * CLUSTER_COMMON_TERM_RATIO));

    const universalTokens = new Set<string>();
    tokenCoverage.forEach((occurrences, token) => {
      if (occurrences >= coverageThreshold) {
        universalTokens.add(token);
      }
    });

    const toKeywords = (counts: Map<string, number>): string[] => {
      const vocabulary = new Set(counts.keys());
      const ordered = Array.from(counts.entries())
        .filter(
          ([token]) =>
            !universalTokens.has(token) &&
            !isStopwordToken(token) &&
            !/^\d+$/.test(token),
        )
        .sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1];
          return a[0].localeCompare(b[0]);
        })
        .map(([term]) => term);
      const deduped: string[] = [];
      const canonicalIndex = new Map<string, number>();

      ordered.forEach((token) => {
        const canonical = canonicalizeKeyword(token, vocabulary);
        const existingIndex = canonicalIndex.get(canonical);
        if (existingIndex === undefined) {
          deduped.push(token);
          canonicalIndex.set(canonical, deduped.length - 1);
          return;
        }

        const existingToken = deduped[existingIndex];
        const tokenIsSingular = token === canonical;
        const existingIsSingular = existingToken === canonical;
        if (tokenIsSingular && !existingIsSingular) {
          deduped[existingIndex] = token;
        }
      });
      const desiredCount = Math.max(
        CLUSTER_TERM_MIN_COUNT,
        Math.min(CLUSTER_TERM_MAX_COUNT, deduped.length),
      );
      return deduped.slice(0, desiredCount);
    };

    const formatTerm = (term: string) =>
      term.length === 0 ? term : term[0].toUpperCase() + term.slice(1);

    return clusterEntries
      .sort((a, b) => b.nodes.length - a.nodes.length)
      .map(({ id, color, nodes: clusterNodes, counts }) => {
        const nodeCount = clusterNodes.length;
        const keywords = toKeywords(counts);
        const formattedKeywords = keywords.map(formatTerm).join(", ");
        const filingsText = `${nodeCount} ${nodeCount === 1 ? "filing" : "filings"}`;
        const labelPrefix = formattedKeywords ? `e.g., ${formattedKeywords}` : `Cluster ${id}`;
        const label = `${labelPrefix} (${filingsText})`;
        const tooltip = formattedKeywords
          ? `Cluster ${id} • ${labelPrefix}`
          : `Cluster ${id}`;

        return {
          id,
          color,
          label,
          tooltip,
        };
      });
  }, [data, clusterColor]);

  const sizeForNode = useCallback((node: OverviewNode) => {
    const rel = normalizeRelevance(node.relevance);
    return 4 + 10 * rel;
  }, []);

  const updateGraphHighlights = useCallback(() => {
    const g = graphRef.current;
    if (!g) return;
    const nodesToHighlight = new Set<string>();
    highlightedRef.current.forEach((id) => nodesToHighlight.add(id));
    if (selectedRef.current) {
      nodesToHighlight.add(selectedRef.current);
    }
    g.forEachNode((node: string) => {
      const shouldHighlight = nodesToHighlight.has(node);
      const current = g.getNodeAttribute(node, "highlighted") === true;
      if (current !== shouldHighlight) {
        g.setNodeAttribute(node, "highlighted", shouldHighlight);
      }
    });
  }, []);

  const zoomToHighlighted = useCallback(() => {
    if (!rendererRef.current || !graphRef.current || !highlightedNodeIds || highlightedNodeIds.length === 0) return;
    const renderer = rendererRef.current;
    const g = graphRef.current;
    const coords = highlightedNodeIds
      .map((id) => {
        if (!g.hasNode(id)) return null;
        try {
          return renderer.getNodeDisplayData(id);
        } catch {
          return null;
        }
      })
      .filter((v): v is { x: number; y: number } => Boolean(v));
    if (coords.length === 0) return;

    const xs = coords.map((c) => c.x);
    const ys = coords.map((c) => c.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const dx = maxX - minX;
    const dy = maxY - minY;
    const span = Math.max(dx, dy);
    const padded = Math.max(span, 0.15) * 1.6;
    const ratio = Math.min(2.5, Math.max(0.28, padded));

    try {
      renderer.getCamera().animate({ x: cx, y: cy, ratio }, { duration: 450 });
    } catch {}
  }, [highlightedNodeIds]);

  useEffect(() => {
    signalRef.current = selectedSignal ?? null;
    if (rendererRef.current) {
      rendererRef.current.refresh();
    }
  }, [selectedSignal]);

  useEffect(() => {
    highlightedRef.current = new Set(highlightedNodeIds ?? []);
    if (rendererRef.current) {
      rendererRef.current.refresh();
    }
    if (highlightedNodeIds && highlightedNodeIds.length > 0) {
      zoomToHighlighted();
    }
    updateGraphHighlights();
  }, [highlightedNodeIds, updateGraphHighlights, zoomToHighlighted]);

  useEffect(() => {
    if (!containerRef.current) return;

    if (rendererRef.current) {
      rendererRef.current.kill();
      rendererRef.current = null;
    }
    const container = containerRef.current;
    container.innerHTML = "";

    if (!data) {
      graphRef.current = null;
      setSelectedNode(null);
      setSelectedAttrs(null);
      return;
    }

    const g = new Graph();
    for (const node of data.nodes) {
      if (!node?.id) continue;
      const x = Number.isFinite(node.x) ? Number(node.x) : Math.random();
      const y = Number.isFinite(node.y) ? Number(node.y) : Math.random();
      const color = clusterColor.get(node.cluster_id) || colorForCluster(node.cluster_id);
      g.addNode(node.id, {
        x,
        y,
        size: sizeForNode(node),
        color,
        baseColor: color,
        cluster_id: node.cluster_id,
        assignee: node.assignee ?? "Unknown assignee",
        signals: Array.isArray(node.signals) ? node.signals : [],
        tooltip: node.tooltip ?? "",
        title: node.title ?? "",
        relevance: normalizeRelevance(node.relevance),
        highlighted: false,
      });
    }
    for (const edge of data.edges) {
      const src = edge.source;
      const dst = edge.target;
      if (!g.hasNode(src) || !g.hasNode(dst)) continue;
      if (g.hasEdge(src, dst)) continue;
      const weightValue = Number(edge.weight);
      const weight = Number.isFinite(weightValue) ? weightValue : 1;
      const baseSize = 0.9;
      g.addEdge(src, dst, {
        weight,
        size: baseSize,
        baseSize,
      });
    }

    try {
      forceAtlas2.assign(g, {
        iterations: 120,
        settings: { slowDown: 8, gravity: 1.5, scalingRatio: 8 },
      });
    } catch {}

    const renderer = new Sigma(g, container, {
      allowInvalidContainer: true,
      renderLabels: false,
      defaultEdgeColor: "#cbd5e1",
      zIndex: true,
    });

    rendererRef.current = renderer;
    graphRef.current = g;
    selectedRef.current = null;
    hoveredRef.current = null;
    neighborsRef.current = new Set();

    const tooltip = document.createElement("div");
    const tooltipStyle: Partial<CSSStyleDeclaration> = {
      position: "absolute",
      background: "#ffffff",
      border: "1px solid #e2e8f0",
      padding: "6px 8px",
      fontSize: "12px",
      borderRadius: "6px",
      boxShadow: "0 4px 10px rgba(15,23,42,0.12)",
      pointerEvents: "none",
      zIndex: "20",
      display: "none",
      maxWidth: "320px",
      color: "#102A43",
    };
    Object.assign(tooltip.style, tooltipStyle);
    container.appendChild(tooltip);

    const showTooltip = (nodeKey: string, xPos: number, yPos: number) => {
      if (!graphRef.current) return;
      const attrs = graphRef.current.getNodeAttributes(nodeKey) as any;
      const title = attrs?.title ? escapeHtml(String(attrs.title)) : escapeHtml(nodeKey);
      const assignee = attrs?.assignee ? `<div style="color:#475569;margin-top:2px">${escapeHtml(String(attrs.assignee))}</div>` : "";
      const signals = Array.isArray(attrs?.signals) && attrs.signals.length > 0
        ? `<div style="color:#64748b;margin-top:4px">${attrs.signals.map((s: SignalKind) => SIGNAL_LABELS[s]).join(" · ")}</div>`
        : "";
      const rationale = attrs?.tooltip
        ? `<div style="color:#475569;margin-top:6px">${escapeHtml(String(attrs.tooltip))}</div>`
        : "";
      tooltip.innerHTML = `<div style="font-weight:600">${title}</div>${assignee}${signals}${rationale}`;
      tooltip.style.left = `${xPos + 12}px`;
      tooltip.style.top = `${yPos + 12}px`;
      tooltip.style.display = "block";
    };

    const hideTooltip = () => {
      tooltip.style.display = "none";
    };

    const nodeReducer = (key: string, attributes: any) => {
      const highlightSet = highlightedRef.current;
      const selected = selectedRef.current;
      const hovered = hoveredRef.current;
      const neighbors = neighborsRef.current;
      const signal = signalRef.current;
      const baseColor = attributes.baseColor || attributes.color;
      let opacity = 1;
      let size = attributes.size;
      let borderColor = attributes.borderColor || "#1e293b";
      let borderSize = attributes.borderSize || 1;
      let zIndex = 1;

      const matchesSignal = signal ? Array.isArray(attributes.signals) && attributes.signals.includes(signal) : true;

      const applyFocus = (primary: boolean) => {
        borderColor = primary ? "#ffffff" : "#e2e8f0";
        borderSize = primary ? 3 : 2;
      };

      if (highlightSet.size > 0) {
        const isHighlight = highlightSet.has(key);
        if (isHighlight) {
          size = size * 1.3;
          applyFocus(true);
          zIndex = 3;
        } else {
          opacity = 0.08;
        }
      } else if (selected) {
        if (key === selected) {
          size = size * 1.35;
          applyFocus(true);
          zIndex = 3;
        } else if (neighbors.has(key)) {
          size = size * 1.18;
          applyFocus(false);
          opacity = 0.9;
          zIndex = 2;
        } else {
          opacity = 0.12;
        }
      } else if (signal) {
        if (matchesSignal) {
          size = size * 1.15;
          zIndex = 2;
        } else {
          opacity = 0.12;
        }
      }

      if (hovered === key) {
        applyFocus(true);
        zIndex = 4;
      }

      return {
        ...attributes,
        color: baseColor,
        opacity,
        size,
        borderColor,
        borderSize,
        zIndex,
      };
    };

    const edgeReducer = (edgeKey: string, attributes: any) => {
      const highlightSet = highlightedRef.current;
      const selected = selectedRef.current;
      const signal = signalRef.current;

      if (!graphRef.current) return attributes;
      const src = graphRef.current.source(edgeKey);
      const dst = graphRef.current.target(edgeKey);
      const baseSize = attributes.baseSize ?? attributes.size ?? 1;
      const mutedSize = Math.max(0.4, baseSize * 0.6);
      const focusSize = Math.max(1.6, baseSize * 1.8);
      const defaultColor = attributes.baseColor || attributes.color || "#cbd5e1";

      if (highlightSet.size > 0) {
        if (highlightSet.has(src) && highlightSet.has(dst)) {
          return { ...attributes, color: "#4c51bf", opacity: 0.95, size: focusSize };
        }
        return { ...attributes, opacity: 0.05, size: mutedSize };
      }
      if (selected) {
        if (src === selected || dst === selected) {
          return { ...attributes, color: "#2563eb", opacity: 0.95, size: focusSize };
        }
        return { ...attributes, opacity: 0.08, size: mutedSize, color: defaultColor };
      }
      if (signal) {
        const srcSignals = graphRef.current.getNodeAttribute(src, "signals");
        const dstSignals = graphRef.current.getNodeAttribute(dst, "signals");
        const srcHas = Array.isArray(srcSignals) && srcSignals.includes(signal);
        const dstHas = Array.isArray(dstSignals) && dstSignals.includes(signal);
        if (srcHas && dstHas) {
          return { ...attributes, opacity: 0.85, color: "#cbd5f5", size: focusSize };
        }
        return { ...attributes, opacity: 0.08, size: mutedSize };
      }
      return { ...attributes, opacity: 0.35, color: defaultColor, size: baseSize };
    };

    renderer.setSetting("nodeReducer", nodeReducer as any);
    renderer.setSetting("edgeReducer", edgeReducer as any);

    const handleEnterNode = ({ node }: { node: string }) => {
      hoveredRef.current = node;
      try {
        const display = renderer.getNodeDisplayData(node);
        if (display) {
          showTooltip(node, display.x, display.y);
        }
      } catch {}
      renderer.refresh();
    };

    const handleLeaveNode = () => {
      hoveredRef.current = null;
      hideTooltip();
      renderer.refresh();
    };

    const handleClickNode = ({ node }: { node: string }) => {
      selectedRef.current = node;
      hoveredRef.current = null;
      hideTooltip();
      setSelectedNode(node);
      const attrs = graphRef.current?.getNodeAttributes(node);
      setSelectedAttrs(attrs ?? null);
      if (graphRef.current) {
        neighborsRef.current = new Set(graphRef.current.neighbors(node));
      }
      updateGraphHighlights();
      renderer.refresh();
    };

    const handleClickStage = () => {
      selectedRef.current = null;
      neighborsRef.current = new Set();
      setSelectedNode(null);
      setSelectedAttrs(null);
      updateGraphHighlights();
      renderer.refresh();
    };

    renderer.on("enterNode", handleEnterNode);
    renderer.on("leaveNode", handleLeaveNode);
    renderer.on("clickNode", handleClickNode);
    renderer.on("clickStage", handleClickStage);

    updateGraphHighlights();

    return () => {
      renderer.off("enterNode", handleEnterNode);
      renderer.off("leaveNode", handleLeaveNode);
      renderer.off("clickNode", handleClickNode);
      renderer.off("clickStage", handleClickStage);
      renderer.kill();
      rendererRef.current = null;
      graphRef.current = null;
      if (tooltip.parentNode === container) {
        container.removeChild(tooltip);
      } else {
        tooltip.remove();
      }
    };
  }, [data, clusterColor, sizeForNode, updateGraphHighlights]);

  const details = selectedNode && selectedAttrs ? (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        width: 280,
        maxHeight: height - 24,
        overflowY: "auto",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 14,
        boxShadow: "0 12px 40px rgba(15,23,42,0.15)",
        fontSize: 12,
        color: "#102A43",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>Selected filing</div>
        <button
          onClick={() => {
            selectedRef.current = null;
            neighborsRef.current = new Set();
            setSelectedNode(null);
            setSelectedAttrs(null);
            updateGraphHighlights();
            rendererRef.current?.refresh();
          }}
          style={{
            fontSize: 11,
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            padding: "2px 8px",
            background: "#ffffff",
            cursor: "pointer",
          }}
        >
          Clear
        </button>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{selectedAttrs?.title || selectedNode}</div>
        {selectedAttrs?.assignee && (
          <div style={{ marginTop: 2, color: "#475569" }}>{selectedAttrs.assignee}</div>
        )}
      </div>
      {Array.isArray(selectedAttrs?.signals) && selectedAttrs.signals.length > 0 && (
        <div style={{ color: "#64748b" }}>
          {selectedAttrs.signals.map((s: SignalKind) => SIGNAL_LABELS[s]).join(" · ")}
        </div>
      )}
      {selectedAttrs?.tooltip && (
        <div style={{ color: "#475569", lineHeight: 1.5 }}>{selectedAttrs.tooltip}</div>
      )}
      {selectedNode && (() => {
        const nodeData = data?.nodes?.find(n => n.id === selectedNode);
        const rawScore = nodeData?.overview_score ?? null;
        const score = typeof rawScore === 'number' && Number.isFinite(rawScore) ? rawScore.toFixed(3) : '--';
        return (
          <div style={{ color: "#475569", fontSize: 12 }}>
            <strong>Overview Score:</strong> {score}
          </div>
        );
      })()}
      <div>
        <a
          href={`https://patents.google.com/patent/${encodeURIComponent(formatGooglePatentId(selectedNode))}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "#102A43",
            border: "1px solid #102A43",
            borderRadius: 8,
            padding: "6px 10px",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          View on Google Patents
        </a>
      </div>
    </div>
  ) : null;

  const hasHighlights = highlightedNodeIds && highlightedNodeIds.length > 0;

  const legend = clusterMetadata.length > 0 ? (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        left: 12,
        maxWidth: 280,
        maxHeight: height - 120,
        overflowY: "auto",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 12,
        boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
        fontSize: 12,
        color: "#102A43",
        zIndex: 10,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "#102A43" }}>
        Clusters
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {clusterMetadata.slice(0, 10).map((cluster) => (
          <div
            key={cluster.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 6px",
              borderRadius: 6,
              background: "#f8fafc",
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: cluster.color,
                flexShrink: 0,
                border: "2px solid #ffffff",
                boxShadow: "0 1px 3px rgba(15,23,42,0.15)",
              }}
            />
            <div
              style={{
                fontSize: 11,
                color: "#475569",
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={cluster.tooltip}
            >
              {cluster.label}
            </div>
          </div>
        ))}
        {clusterMetadata.length > 10 && (
          <div style={{ fontSize: 10, color: "#94a3b8", fontStyle: "italic", marginTop: 4 }}>
            +{clusterMetadata.length - 10} more clusters
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div style={{ height, position: "relative", background: "#eaf6ff", borderRadius: 12, overflow: "hidden" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {legend}
      {hasHighlights && (
        <button
          onClick={zoomToHighlighted}
          style={{
            position: "absolute",
            top: 12,
            right: selectedNode ? 304 : 12,
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 600,
            color: "#102A43",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            zIndex: 10,
          }}
          title="Zoom to highlighted nodes"
        >
          <span style={{ fontSize: 14 }}>🔍</span>
          Zoom to highlights
        </button>
      )}
      {details}
    </div>
  );
}
