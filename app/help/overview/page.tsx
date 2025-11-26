// app/help/overview/page.tsx
"use client";

import type { CSSProperties } from "react";

const TEXT_COLOR = "#102A43";
const LINK_COLOR = "#5FA8D2";
const CARD_BG = "rgba(255, 255, 255, 0.8)";
const CARD_BORDER = "rgba(255, 255, 255, 0.45)";
const CARD_SHADOW = "0 26px 54px rgba(15, 23, 42, 0.28)";

const pageWrapperStyle: CSSProperties = {
  padding: "48px 24px 64px",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  gap: 32,
  color: TEXT_COLOR,
};

const surfaceStyle: CSSProperties = {
  maxWidth: 1240,
  width: "100%",
  margin: "0 auto",
  display: "grid",
  gap: 24,
  padding: 32,
  borderRadius: 28,
};

const cardBaseStyle: CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 20,
  padding: 32,
  boxShadow: CARD_SHADOW,
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
};

const linkButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 28px",
  borderRadius: 999,
  background: "linear-gradient(105deg, #5FA8D2 0%, #39506B 100%)",
  color: "#ffffff",
  fontWeight: 600,
  fontSize: 14,
  border: "1px solid rgba(107, 174, 219, 0.45)",
  boxShadow: "0 18px 36px rgba(107, 174, 219, 0.42)",
  textDecoration: "none",
  transition: "transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease",
};

export default function OverviewHelpPage() {
  return (
    <div style={pageWrapperStyle}>
      <div className="glass-surface" style={surfaceStyle}>

        {/* Header */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: TEXT_COLOR }}>IP Overview Guide</h1>
              <p style={{ marginTop: 8, fontSize: 14, color: "#627D98", marginBottom: 0 }}>
                <a href="/help" style={{ color: LINK_COLOR, textDecoration: "none" }}>← Back to Help</a>
              </p>
            </div>
            <a href="/overview" className="btn-modern" style={linkButtonStyle}>
              Go to IP Overview →
            </a>
          </div>
          <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 0 }}>
            The IP Overview page is a platform for overview and insights directed to input search criteria. Analysis information displayed on this page can be searched and sorted in multiple ways, providing a dynamic and flexible interface ideal for AI/ML prior art searches, competitive landscape monitoring, underexplored technology areas conducive to R&D innovation, and more.
          </p>
          <p style={{ marginTop: 8, fontSize: 16, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 0 }}>
            Analysis and insights available on this page are generated based on user-defined focus keywords, CPC filters, and date ranges. The overview section provides a high-level summary of key metrics, while the tables and charts allow for in-depth exploration of patent filings relevant to the specified criteria. For example, key metrics include subject matter saturation, patent and publication activity rates and momentum, and CPC distribution for specific search criteria and semantically similar concepts.
          </p>
        </div>

        {/* Overview */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>What the IP Overview Provides</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 12 }}>
            For any combination of focus keywords, CPC filters, and date range the IP Overview workflow performs the following steps:
          </p>
          <ol style={{ marginLeft: 20, marginTop: 12, fontSize: 14, lineHeight: 1.5, listStyleType: "decimal", listStylePosition: "outside", color: TEXT_COLOR }}>
            <li>Builds a target search set using full-text search over SynapseIP's relational database, including exact matches and, when enabled, semantic nearest neighbors.</li>
            <li>Counts distinct patents and publications in the target search set (exact, semantic, and combined) and normalizes volume per month.</li>
            <li>Tracks monthly patent grants and publications to measure growth trends, such as slope and compound annual growth rate (CAGR), and classifies momentum as rising, stable, or declining.</li>
            <li>Aggregates CPC classifications to show the top slices and a broader breakdown for adjacent technology clusters.</li>
            <li>Summarizes recency (6/12/18/24 month totals) and, when available, tags saturation with a percentile vs. historical queries.</li>
            <li>With “Group by Assignee” enabled, builds an embedding graph and signal cards per assignee.</li>
          </ol>
        </div>

        {/* Input Fields */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Inputs & Toggles</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 16 }}>
            At least one focus input (keywords or CPC) is required. The default window covers the past 24 months, anchored to the end date.
          </p>
          <div style={{ display: "grid", gap: 20 }}>
            <InputDescription
              label="Focus Keywords"
              description="Use comma-separated words and/or phrases that describe the AI/ML subject matter of interest. The analysis reflects keyword, key phrase, and semantic search matches (when enabled) found in the title, abstract, and claims of patents and publications."
              example="Example: foundation models, multi-modal reasoning, retrieval augmented generation"
              tips={[
                "Broader keywords and phrases produce a greater result set; combine with CPC filters to narrow the result set to a specific technology area.",
                "Focus keywords and phrases are used to obtain both exact matches and semantic nearest neighbors (when enabled)."
              ]}
            />
            <InputDescription
              label="CPC Filter"
              description="Concentrate the target search set in a specific technology area with CPC classification codes. Supports partial codes such as G06N and full designations like G06F17/30."
              example="Example: G06N20/00, A61B5, G06V, G06K9/00"
              tips={[
                "Multiple CPC filters are OR’ed together; combine with keywords for precise intersections.",
                "Use broader prefixes (e.g., G06N) to capture related subgroups when exploring adjacent domains."
              ]}
            />
            <InputDescription
              label="Date Range"
              description="Restrict the results set to a specific time range corresponding to patent grant date or publication date. Empty fields fall back to the full data set in SynapseIP's database. When only an end date is provided the start defaults to 23 months earlier."
              example="Example: From 2023-07-01, To 2025-06-30"
              tips={[
                "Shorter ranges can highlight current activity (e.g., competitors' R&D and investment areas); longer ranges provide more stable density and percentile signals.",
                "Momentum uses the monthly series inside the selected window."
              ]}
            />
            <InputDescription
              label="Show Semantic Neighbors (toggle)"
              description="When enabled, IP Overview analysis matches semantic nearest neighbors (based on embedding index) and merges those with exact keyword and phrase matches."
              example="Default: Enabled"
              tips={[
                "Disable to receive only literal keyword matches (useful for prior art searches).",
                "Semantic nearest neighbors follow the same date and CPC filters after results are returned from semantic search."
              ]}
            />
            <InputDescription
              label="Group by Assignee (toggle)"
              description="Loads more complex, weighted opportunity/risk signals calculated per assignee. Includes context graph, assignee signal cards, and Sigma visualization beneath the overview summary. Off by default."
              example="Default: Disabled"
              tips={[
                "Enable to view focus convergence / subject matter oversaturation signals tied to specific assignees.",
                "Toggling on after a run reuses the most recent search parameters (rerunning the search is unnecessary)."
              ]}
            />
          </div>
        </div>

        {/* Overview Tiles */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Interpreting the IP Overview Tiles</h2>
          <div style={{ display: "grid", gap: 16 }}>
            <MetricTile
              title="Saturation"
              summary="Exact, semantic, and total distinct publication counts inside the window."
              bullets={[
                "Review exact vs. semantic to see how literal the coverage is.",
                "Activate rate (e.g., new patent grants and publications per month) is a function of total count divided by the number of months (window defaults to 24).",
                "Percentile (when present) maps into Low / Medium / High / Very High guidance."
              ]}
            />
            <MetricTile
              title="Activity Rate"
              summary="Average filings per month plus the observed min/max band."
              bullets={[
                "Together with the timeline (described infra), patent grant/publication activity rates can expose volatility inside a date range.",
                "High activity rate coupled with a narrow band indicates steady and consistent emphasis on obtaining IP protection for AI/ML innovations."
              ]}
            />
            <MetricTile
              title="Momentum"
              summary="Slope of the monthly time series and CAGR over the window."
              bullets={[
                "Momentum bucket: Up (> +0.05), Down (< -0.05), otherwise Flat.",
                "Slope is normalized by average volume; CAGR can be used to contextualize growth rate."
              ]}
            />
            <MetricTile
              title="Top CPCs"
              summary="Highest volume CPC codes among matched filings."
              bullets={[
                "Shows the leading technology slices at a glance.",
                "Detailed CPC bar chart includes links to comprehensive and specific definitions for each CPC code, including those outside the top five."
              ]}
            />
          </div>
        </div>

        {/* Charts */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Timeline & CPC Distribution</h2>
          <div style={{ display: "grid", gap: 20 }}>
            <LayoutSection
              title="Timeline sparkline"
              description="Plots monthly publication counts across the selected window. Hover in the UI to inspect the exact month totals. Sharp inflections may indicate changes in momentum."
            />
            <LayoutSection
              title="CPC distribution chart"
              description="Ranks CPC codes by patent and publication volume. A shorter bar generally corresponds to a less explored technology area, whereas a longer bar may suggest a more developed or saturated technology area."
            />
            <LayoutSection
              title="Recent intervals"
              description="Summaries for the last 6, 12, 18, and 24 months. This information can be read with near-term patent and publication activity rates against historical averages."
            />
          </div>
        </div>

        {/* Results Table */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Patent & Publication Table</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 8 }}>
            Result set table lists up to 1000 patents and publications per target search set, sortable on recency, relevance, or assignee name. Click any patent/publication number to open the document in a new tab. 
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 16 }}>
            Result set table can be exported as a PDF (up to 1000 patents and publications) for later reference and review. The exported PDF includes the overview and analysis displayed above on the page. 
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            <TableColumn column="Title" description="Patent or publication title." />
            <TableColumn column="Abstract" description="The abstract of the patent or publication, truncated to 200 characters." />
            <TableColumn column="Patent/Pub No." description="USPTO patent or publication identifier with kind code. Links to Google Patents." />
            <TableColumn column="Assignee" description="Canonicalized assignee name when available; 'Unknown' if not present." />
            <TableColumn column="Grant/Pub Date" description="Patent grant or publication date, formatted as YYYY-MM-DD." />
            <TableColumn column="CPC" description="Top CPC codes (section/class/subclass/group) used for classifying the patent or publication (up to four)." />
          </div>
        </div>

        {/* Optional Legacy Signals */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Assignee Signals (Optional)</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 12 }}>
            Switching on “Group by Assignee” augments the IP Overview analysis with a per-assignee clustering view. More complex, weighted signals are calculated from semantic embeddings, which are used to build a cosine KNN graph and evaluate four signals per grouping:
          </p>
          <ul style={{ marginLeft: 20, fontSize: 14, lineHeight: 1.5, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
            <li><strong>Potential Gap</strong>: Opportunity where an assignee may have some IP protection, but neighboring clusters are underexplored.</li>
            <li><strong>Bridging Opportunity</strong>: Cross-cluster connectors with lower momentum on both sides.</li>
            <li><strong>Focus Convergence</strong>: Risk indicator showing an assignee with IP protection trending very close to the target search set.</li>
            <li><strong>Crowd-out</strong>: Risk indicator where local density and momentum around the target search set is sharply rising.</li>
          </ul>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginTop: 12 }}>
            Toggle on "Group by Assignee" to generate specific analysis and insights scoped to specific entities (e.g., competitors, investors in the AI/ML space, etc.).
          </p>
        </div>

        {/* Workflow */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Example Workflow</h2>
          <ol style={{ marginLeft: 20, fontSize: 14, lineHeight: 1.5, listStyleType: "decimal", listStylePosition: "outside", color: TEXT_COLOR }}>
            <li>Start with focus keywords and phrases over a 24-month window to gauge baseline saturation and momentum.</li>
            <li>Narrow the target search set with CPC filters to concentrate on specific technology areas of interest.</li>
            <li>Timeline graph can be used to confirm that momentum is accurately labeled (e.g., rising, declining, etc.).</li>
            <li>Result set table provides a quick and comprehensive reference list of patents and publications germane to the target search set.</li>
            <li>(Optional) Enabling "Group by Assignee" can provide a more granular view of R&D activity and investment for specific entities (e.g., competitors, investors in the AI/ML space, etc.).</li>
          </ol>
        </div>

        {/* Best Practices */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Best Practices</h2>
          <div style={{ display: "grid", gap: 16 }}>
            <BestPractice
              title="Anchor the window to a strategic milestone"
              tip="Shift the end date to align with product launches or regulatory moments. Comparing periods highlights whether filings are accelerating into that milestone."
            />
            <BestPractice
              title="Compare exact vs. semantic saturation"
              tip="A smaller gap between exact-match results and semantic-search results indicates the target search set is well-aligned with conventional terminology used across the domain. Large gaps between exact-match results and semantic-search results indicate that the relevant concepts are often expressed in different wording than the target search set. That is, the domain uses diverse terminology or synonyms not captured by the literal query. Expanding upon keywords and phrases (e.g., using synonyms, abbreviations, etc.) and/or adding CPC filters can help refine the target search set."
            />
            <BestPractice
              title="Monitor CPC drift"
              tip="When small keyword changes cause noticeable shifts in the CPC distribution, the overall concept likely spans multiple technology areas. Depending on the goal, this may be a signal to explore the concept in more granular clusters."
            />
          </div>
        </div>

        {/* Troubleshooting */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Troubleshooting</h2>
          <div style={{ display: "grid", gap: 16 }}>
            <Troubleshoot
              issue="No results returned"
              solution="Verify at least one keyword or CPC is provided. Try expanding the date range or disabling semantic neighbors if the query is very niche."
            />
            <Troubleshoot
              issue="Momentum stays flat"
              solution="Check the timeline sparkline for month-to-month variability. Extending the window or adding semantic neighbors can expose greater insights."
            />
            <Troubleshoot
              issue="Assignee graph looks empty"
              solution="Ensure “Group by Assignee” is toggled on and the latest run completed. Some narrow scopes may lack a sufficient number of patents and publications per assignee to expose a signal with that satisfies a minimum level of confidence."
            />
          </div>
        </div>
      </div>
      <div className="glass-surface" style={surfaceStyle}>
        {/* Footer */}
        <footer style={footerStyle}>
          2025 © Phaethon Order LLC | <a href="mailto:support@phaethon.llc" target="_blank" rel="noopener noreferrer" className="text-[#312f2f] hover:underline hover:text-blue-400">support@phaethon.llc</a> | <a href="https://phaethonorder.com" target="_blank" rel="noopener noreferrer" className="text-[#312f2f] hover:underline hover:text-blue-400">phaethonorder.com</a> | <a href="/help" className="text-[#312f2f] hover:underline hover:text-blue-400">Help</a> | <a href="/docs" className="text-[#312f2f] hover:underline hover:text-blue-400">Legal</a>
        </footer>
      </div>
    </div>
  );
}

function InputDescription({
  label,
  description,
  example,
  tips,
}: {
  label: string;
  description: string;
  example: string;
  tips: string[];
}) {
  return (
    <div>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: TEXT_COLOR }}>{label}</h3>
      <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>{description}</p>
      <p style={{ margin: "8px 0", fontSize: 13, fontStyle: "italic", color: "#627D98" }}>{example}</p>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: TEXT_COLOR, marginBottom: 6 }}>Notes:</div>
        <ul style={{ marginLeft: 20, fontSize: 13, lineHeight: 1.5, listStyleType: "circle", listStylePosition: "outside", color: TEXT_COLOR }}>
          {tips.map((tip, idx) => (
            <li key={idx}>{tip}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MetricTile({ title, summary, bullets }: { title: string; summary: string; bullets: string[] }) {
  return (
    <div className="glass-card" style={{ padding: 18, borderRadius: 16, background: "rgba(107, 174, 219, 0.12)", border: "1px solid rgba(107, 174, 219, 0.25)", boxShadow: "0 14px 26px rgba(107, 174, 219, 0.18)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: TEXT_COLOR }}>{title}</h3>
      <p style={{ margin: "8px 0", fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>{summary}</p>
      <ul style={{ marginLeft: 20, fontSize: 13, lineHeight: 1.5, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
        {bullets.map((bullet, idx) => (
          <li key={idx}>{bullet}</li>
        ))}
      </ul>
    </div>
  );
}

function LayoutSection({ title, description }: { title: string; description: string }) {
  return (
    <div className="glass-card" style={{ padding: 18, borderRadius: 16 }}>
      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT_COLOR }}>{title}</h4>
      <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>{description}</p>
    </div>
  );
}

function TableColumn({ column, description }: { column: string; description: string }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <span style={{ fontWeight: 600, fontSize: 14, color: TEXT_COLOR, minWidth: 140 }}>{column}:</span>
      <span style={{ fontSize: 14, color: TEXT_COLOR }}>{description}</span>
    </div>
  );
}

function BestPractice({ title, tip }: { title: string; tip: string }) {
  return (
    <div style={{ padding: 20, borderRadius: 18, background: "rgba(16, 185, 129, 0.12)", opacity: 0.7, border: "1px solid rgba(34, 197, 94, 0.35)", boxShadow: "0 4px 8px rgba(34, 197, 94, 0.18)" }}>
      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#166534" }}>{title}</h4>
      <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>{tip}</p>
    </div>
  );
}

function Troubleshoot({ issue, solution }: { issue: string; solution: string }) {
  return (
    <div style={{ padding: 20, borderRadius: 18, background: "rgba(250, 204, 21, 0.18)", opacity: 0.7, border: "1px solid rgba(250, 204, 21, 0.35)", boxShadow: "0 4px 8px rgba(245, 158, 11, 0.22)" }}>
      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#92400e" }}>Issue: {issue}</h4>
      <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}><strong>Solution:</strong> {solution}</p>
    </div>
  );
}

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
