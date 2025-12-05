// app/help/citation/page.tsx
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
  border: "1px solid rgba(107, 174, 219, 0.55)",
  boxShadow: "0 18px 36px rgba(107, 174, 219, 0.55)",
  textDecoration: "none",
  transition: "transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease",
};

export default function CitationHelpPage() {
  return (
    <div style={pageWrapperStyle}>
      <div className="glass-surface" style={surfaceStyle}>

        {/* Header */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: TEXT_COLOR }}>Citation Tracker Guide</h1>
              <p style={{ marginTop: 8, fontSize: 14, color: "#627D98", marginBottom: 0 }}>
                <a href="/help" style={{ color: LINK_COLOR}} className="hover:underline">← Back to Help</a>
              </p>
            </div>
            <a
              href="/citation"
              className="btn-modern"
              style={linkButtonStyle}
            >
              Go to Citation Tracker →
            </a>
          </div>
          <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 0 }}>
            Citation Tracker provides patent citation intelligence to answer critical IP strategy questions: "Who is citing our portfolio?", "What prior art do we depend on?", and "Which competitors are encroaching on our technology space?" The interface uses a shared Scope card to define a portfolio and time window, then refreshes four analytics widgets in parallel: Forward-Citation Impact, Dependency Matrix, Risk Radar, and Encroachment.
          </p>
        </div>

        {/* What Citation Tracker Provides */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>What Citation Tracker Provides</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 12 }}>
            Citation analysis reveals relationships between patents/publications that keyword search alone may not expose. When a patent examiner or applicant cites prior art, that citation establishes a formal link indicating technological relevance, potential blocking relationships, or design-around requirements. Citation Tracker transforms this citation network into actionable intelligence:
          </p>
          <ul style={{ marginLeft: 20, marginTop: 12, fontSize: 14, lineHeight: 1.5, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
            <li><strong>Forward citations</strong> (or "citations to"): Other patents that cite to a particular patent/publication (or corresponding portfolio). A higher number of forward citations may signal market influence, potential licensing opportunities, or other technological significance.</li>
            <li><strong>Backward citations</strong> (or "citations from"): Other patents/publications that are cited by a particular patent. Backward citations may indicate prior art for a corresponding portfolio, potential vulnerabilities/risks, or over-reliance on another assignee's portfolio.</li>
            <li><strong>Cross-assignee dependencies</strong>: Illustrates relationships between assignees, such as freedom-to-operate, clearance, and/or infringement-risk potential.</li>
            <li><strong>Assignee encroachment</strong>: Indicates patterns showing target assignees that are relying on certain technologies or patents/publications of source assignees.</li>
          </ul>
        </div>

        {/* Scope & Filters */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Scope & Filters</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 12 }}>
            The Scope card defines portfolio and analysis parameters that are applied across four widgets:
          </p>
          <div style={{ display: "grid", gap: 20 }}>
            <InputDescription
              label="Portfolio Mode"
              description="Select how to define the patent portfolio under analysis. Three modes are available:"
              example="Source Assignee(s), Patent/Publication Numbers, or Search Filters"
              tips={[
                "Source Assignee(s): Enter one or more assignee names (e.g., 'Google', 'Microsoft') to analyze all patents/publications held by those entities.",
                "Patent/Publication Numbers: Enter specific patent and/or publication numbers to focus on a single patent/publication or a corresponding portfolio.",
                "Search Filters: Use keyword, CPC, or assignee-contains filters to dynamically build a de facto portfolio based on search criteria."
              ]}
            />
            <InputDescription
              label="Time Window"
              description="Constrain analysis to citations within a specific date range. The date filters apply to the citing patent's publication date, not the cited patent."
              example="Example: From 2023-01-01, To 2025-06-30"
              tips={[
                "Narrower windows highlight recent competitive activity and emerging trends.",
                "Wider windows provide more stable metrics and historical context.",
                "Bucket granularity (month or quarter) affects timeline chart resolution."
              ]}
            />
            <InputDescription
              label="Target Assignee(s)"
              description="Optionally specify target assignee(s) to focus Risk Radar and Encroachment analysis on citations from those specific entities."
              example="Examples: 'Apple', 'Amazon', 'Meta Platforms'"
              tips={[
                "When target assignees are specified, their citations are given more weight in calculating Exposure.",
                "Encroachment analysis shows only citations from the specified target assignees.",
                "Leave empty to analyze citations from all assignees."
              ]}
            />
          </div>
        </div>

        {/* Forward Impact */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <SectionHeader title="Forward-Citation Impact" />
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 16 }}>
            Forward-Citation Impact quantifies the influence and market relevance of a source assignee's portfolio by analyzing which patents cite the source assignee's patents/publications. Patents with high forward citation counts tend to represent foundational innovations that shape subsequent R&D directions. This section helps identify the most influential IP and track how that influence evolves over time.
          </p>
          <DetailList
            items={[
              { title: "Total Forward Citations", text: "Aggregate count of all citation instances where patents in the scoped portfolio are cited as prior art. Higher counts indicate broader technological influence." },
              { title: "Distinct Citing Patents", text: "Count of unique patents that cite the portfolio. This metric removes double-counting when a single patent cites multiple portfolio assets." },
              { title: "Median Velocity", text: "The middle velocity value across top-cited patents, indicating typical citation accumulation rate for the portfolio." },
              { title: "Influence Timeline", text: "Bucketed line chart showing citation counts by month or quarter. Rising trends suggest growing relevance; declining trends may indicate maturing technology." },
              { title: "Top Patents Table", text: "Ranked list of most-cited portfolio assets with patent number, title, assignee, publication date, forward citation count, velocity, and first/last citation dates." },
            ]}
          />
          <div style={{ marginTop: 16, padding: 16, background: "rgba(107, 174, 219, 0.12)", borderRadius: 12, border: "1px solid rgba(107, 174, 219, 0.25)" }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>Key Terms</h4>
            <ul style={{ marginLeft: 20, fontSize: 13, lineHeight: 1.5, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR, marginBottom: 0 }}>
              <li><strong>Forward Citation</strong>: A citation from a later-filed patent to an earlier patent/publication (e.g., in a source assignee's portfolio). The citing patent acknowledges technological relevance and precedence prior to issuance.</li>
              <li><strong>Velocity</strong>: Citation accumulation rate, calculated as forward citation count divided by months between the first and last citation. Higher velocity indicates accelerating influence.</li>
              <li><strong>First/Last Citation Date</strong>: The publication dates of the earliest and most recent patents citing a patent/publication, defining the citation activity window.</li>
            </ul>
          </div>
        </div>

        {/* Dependency Matrix */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <SectionHeader title="Cross-Assignee Dependency Matrix" />
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 16 }}>
            The Dependency Matrix visualizes citation relationships between assignees to expose technology dependencies, potential licensing relationships, and competitive dynamics. Frequent citations from one assignee to another may suggest freedom-to-operate, infringement, licensing, or other strategic implications.
          </p>
          <DetailList
            items={[
              { title: "Edges", text: "Each edge represents a citing→cited assignee pair, restricted to citations involving the scoped portfolio. Edge weight reflects citation count." },
              { title: "Min Citations Threshold", text: "Filter slider to hide weak edges below a citation count threshold, reducing noise and highlighting significant relationships." },
              { title: "Normalize Toggle", text: "When enabled, edge weights show percentage of the citing assignee's total outgoing citations directed to each cited assignee, revealing proportional dependency." },
              { title: "Heatmap & Table", text: "Visual grid showing citation intensity between top citing and cited assignees, plus a sortable edge table for detailed exploration." },
            ]}
          />
          <div style={{ marginTop: 16, padding: 16, background: "rgba(107, 174, 219, 0.12)", borderRadius: 12, border: "1px solid rgba(107, 174, 219, 0.25)" }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>Use Cases</h4>
            <ul style={{ marginLeft: 20, fontSize: 13, lineHeight: 1.5, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR, marginBottom: 0 }}>
              <li><strong>Licensing Intelligence</strong>: Identify target assignees heavily dependent on a source assignee's portfolio, which may indicate licensing candidates.</li>
              <li><strong>FTO Analysis</strong>: Discover which patents an assignee's portfolio depends upon, flagging potential blocking relationships.</li>
              <li><strong>Competitive Mapping</strong>: Citation networks are presented with a heat map to highlight relationships or dependencies across assignees.</li>
            </ul>
          </div>
        </div>

        {/* Risk Radar */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <SectionHeader title="Risk Radar" />
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 16 }}>
            Risk Radar ranks patents in a source assignee's portfolio by strategic risk, combining two complementary signals: <strong>Exposure</strong> (external pressure from other assignees' citations) and <strong>Fragility</strong> (internal structural weakness in the prior art foundation). The resulting <strong>Overall Risk Score</strong> provides a single, sortable metric for prioritizing legal review, design-around analysis, and portfolio management decisions.
          </p>
          <DetailList
            items={[
              { title: "Top N Selector", text: "Limit analysis to the top N patents by the selected sort criterion." },
              { title: "Sort Options", text: "Rank patents by Overall Risk, Exposure, Fragility, or Forward Citations." },
              { title: "Score Bars", text: "Inline visualizations showing Exposure, Fragility, and Overall scores on a 0–100 scale." },
              { title: "PDF Export", text: "Generate a downloadable PDF report of the Risk Radar analysis for offline review." },
            ]}
          />

          {/* Exposure Score Deep Dive */}
          <div style={{ padding: 10, border: `2px solid ${CARD_BORDER}`, borderRadius: 8, marginBottom: 10, marginTop: 10 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: TEXT_COLOR, marginBottom: 10 }}>Exposure Score</h2>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 8 }}>
              <strong>What it measures:</strong> Exposure Score quantifies the relevancy of a particular patent (using number and velocity of forward citations as a proxy). A patent with many forward citations is more likely to be the subject of post-grant procedures (e.g., <em>inter partes</em> review). 
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 8 }}>
              Implies: Industry/technology relevance and/or de facto standard; significantly important to another assignee's patent(s).
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 8 }}>
              <strong>Why it's included:</strong> Exposure Score is frequently a primary indicator in relation to infringement risk, competitor monitoring, strategic licensing/defensive considerations, and identifying patents that are likely to influence future filings.
            </p>
            <div style={{ marginTop: 8, padding: 16, background: "rgba(57, 80, 107, 0.12)", borderRadius: 12, border: "1px solid rgba(107, 174, 219, 0.25)" }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 500, color: TEXT_COLOR, marginBottom: 8 }}>Formula (0–100 scale)</h4>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 8 }}>
                Exposure combines normalized forward citation volume with other assignee citation ratio:
              </p>
              <ul style={{ marginLeft: 20, fontSize: 12, lineHeight: 1.5, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR, marginBottom: 8 }}>
                <li><code>norm_total</code> = log-scaled forward citation count (calibrated against corpus 95th percentile)</li>
                <li><code>comp_ratio</code> = forward citations from other assignees / total forward citations</li>
              </ul>
              <p style={{ fontSize: 12, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 0, fontFamily: "monospace", background: "rgba(255,255,255,0.5)", padding: 8, borderRadius: 6 }}>
                Exposure = 70 × norm_total + 30 × comp_ratio
              </p>
              <p style={{ fontSize: 12, color: "#627D98", marginTop: 8, marginBottom: 0 }}>
                The 70/30 weighting reflects the historical trend that absolute citation volume explains variance to a more significant degree than other assignee citation ratio, while other assignee ratio provides directional sensitivity.
              </p>
            </div>
            <div style={{ marginTop: 16 }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 500, color: TEXT_COLOR, marginBottom: 6 }}>Interpretation</h4>
              <InterpretationBand color="#ef4444" range="80–100" label="High competitor reliance; potential constraining prior art or infringement relevance." />
              <InterpretationBand color="#f59e0b" range="40–79" label="Moderate exposure; should be monitored." />
              <InterpretationBand color="#22c55e" range="0–39" label="Low attention from competitors." />
            </div>
          </div>

          {/* Fragility Score Deep Dive */}
          <div style={{ padding: 10, border: `2px solid ${CARD_BORDER}`, borderRadius: 8, marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: TEXT_COLOR, marginBottom: 10 }}>Fragility Score</h2>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 8 }}>
              <strong>What it measures:</strong> Fragility Score measures how <em>narrow, clustered, or homogeneous</em> the cited prior art is for a patent. A patent is considered "fragile" when a small, concentrated slice of prior art supports it. For example, a patent that disproportionately cites prior art in a single CPC technology area or a small set of assignees is more likely to have a meaingfully narrower claim scope and/or a less robus detailed description. 
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 8 }}>
              Implies: Vulnerabilities to invalidation attacks (e.g., not sufficiently enabling, etc.); relatively less difficult to design around.
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 8 }}>
              <strong>Why it's included:</strong> From a legal/portfolio perspective, fragility matters because concentrated CPC prior art indicates a narrow conceptual base that's easier to design around. Low assignee diversity means high dependence on a small set of references that are easier to attack. This provides insight into invalidity risk, lower commercial value, and relatively lower likelihood of patent robustness.
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 8 }}>
              <strong>Contraindications:</strong> Concentrated CPC prior art and/or little to no citations to other assignees can indicate seminal or highly innovative subject matter, which may not necessarily imply fragility.
            </p>
            <div style={{ marginTop: 8, padding: 16, background: "rgba(57, 80, 107, 0.12)", borderRadius: 12, border: "1px solid rgba(107, 174, 219, 0.25)" }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 500, color: TEXT_COLOR, marginBottom: 8 }}>Formula (0–100 scale)</h4>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 8 }}>
                Fragility combines CPC concentration with assignee diversity:
              </p>
              <ul style={{ marginLeft: 20, fontSize: 13, lineHeight: 1.5, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR, marginBottom: 8 }}>
                <li><code>cpc_top_share</code> = fraction of backward citations in the dominant CPC code</li>
                <li><code>assignee_diversity</code> = 1 − (top assignee share of backward citations)</li>
              </ul>
              <p style={{ fontSize: 12, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 0, fontFamily: "monospace", background: "rgba(255,255,255,0.5)", padding: 8, borderRadius: 6 }}>
                Fragility = 60 × cpc_top_share + 40 × (1 − assignee_diversity)
              </p>
              <p style={{ fontSize: 12, color: "#627D98", marginTop: 8, marginBottom: 0 }}>
                CPC concentration is generally a stronger predictor of narrow prior art scope than assignee diversity; accordingly, cpc concentration is given greater weight than assignee diversity.
              </p>
            </div>
            <div style={{ marginTop: 10 }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 500, color: TEXT_COLOR, marginBottom: 8 }}>Interpretation</h4>
              <InterpretationBand color="#ef4444" range="80–100" label="Fragile; likely narrow and easy to design around or challenge." />
              <InterpretationBand color="#f59e0b" range="40–79" label="Moderately robust." />
              <InterpretationBand color="#22c55e" range="0–39" label="Robust; diverse prior art foundation." />
            </div>
          </div>

          {/* Overall Risk Score Deep Dive */}
          <div style={{ padding: 10, border: `2px solid ${CARD_BORDER}`, borderRadius: 8, marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: TEXT_COLOR, marginBottom: 10 }}>Overall Risk Score</h2>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 8 }}>
              <strong>What it measures:</strong> Overall Risk Score blends <strong>Exposure</strong> (external pressure from other assignees) and <strong>Fragility</strong> (internal robustness/weakness) to estimate the <em>strategic risk</em> associated with a patent.
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 8 }}>
              Implies: Patent strength and robustness; coarse metric for forecasting ROI.
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 8 }}>
              <strong>Why it's included:</strong> A single, sortable metric is useful to for flagging patents that are high-risk and/or high-attention. Flags may serve as preliminary separation criteria for pruning/licensing/divestiture decisions, for example, by highlighting patents that are weakly supported or have low potential ROI. This is a portfolio prioritization heuristic.
            </p>
            <div style={{ marginTop: 8, padding: 16, background: "rgba(57, 80, 107, 0.12)", borderRadius: 12, border: "1px solid rgba(107, 174, 219, 0.25)" }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 500, color: TEXT_COLOR, marginBottom: 8 }}>Formula (0–100 scale)</h4>
              <p style={{ fontSize: 12, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 0, fontFamily: "monospace", background: "rgba(255,255,255,0.5)", padding: 8, borderRadius: 6 }}>
                Overall = 55 × (Exposure / 100) + 45 × (Fragility / 100)
              </p>
              <p style={{ fontSize: 12, color: "#627D98", marginTop: 8, marginBottom: 0 }}>
                The 55/45 weighting slightly prioritizes Exposure because it is generally a more consistent metric than Fragility.
              </p>
            </div>
            <div style={{ marginTop: 10 }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 500, color: TEXT_COLOR, marginBottom: 8 }}>Interpretation</h4>
              <InterpretationBand color="#ef4444" range="80–100" label="High strategic risk. Cited signficantly by other assignees; also non-negligible fragility. Recommend review before further time and resources are invested." />
              <InterpretationBand color="#f59e0b" range="40–79" label="Moderate strategic risk. Monitor regularly, especially in crowded and/or activity technology areas." />
              <InterpretationBand color="#22c55e" range="0–39" label="Low strategic risk." />
            </div>
          </div>

          {/* Why These Scores Work Together */}
          <div style={{ padding: 10, border: `2px solid ${CARD_BORDER}`, borderRadius: 8, marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: TEXT_COLOR, marginBottom: 10 }}>Why These Three Scores Work Together</h2>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 8 }}>
              Each score captures a distinct dimension of risk, and a more comprehensive view is derived from the aggregate:
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "rgba(107, 174, 219, 0.15)" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid rgba(107, 174, 219, 0.3)" }}>Score</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid rgba(107, 174, 219, 0.3)" }}>Measures</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid rgba(107, 174, 219, 0.3)" }}>Type of Risk</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid rgba(107, 174, 219, 0.3)" }}>Relevance</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid rgba(107, 174, 219, 0.3)" }}>Significance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid rgba(107, 174, 219, 0.15)" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 500 }}>Exposure</td>
                    <td style={{ padding: "12px 16px" }}>Other assignees' forward citations</td>
                    <td style={{ padding: "12px 16px" }}>External pressure</td>
                    <td style={{ padding: "12px 16px" }}>FTO, litigation</td>
                    <td style={{ padding: "12px 16px" }}>Predicts infringement/competition risk</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid rgba(107, 174, 219, 0.15)" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 500 }}>Fragility</td>
                    <td style={{ padding: "12px 16px" }}>Prior-art diversity & narrowness</td>
                    <td style={{ padding: "12px 16px" }}>Internal structural weakness</td>
                    <td style={{ padding: "12px 16px" }}>Prosecution, IP counsel</td>
                    <td style={{ padding: "12px 16px" }}>Predicts invalidity/design-around vulnerability</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "12px 16px", fontWeight: 500 }}>Overall</td>
                    <td style={{ padding: "12px 16px" }}>Weighted blend</td>
                    <td style={{ padding: "12px 16px" }}>Vulnerabilities and risks</td>
                    <td style={{ padding: "12px 16px" }}>IP portfolio management</td>
                    <td style={{ padding: "12px 16px" }}>Sort/prioritize IP assets</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 10, padding: 16, background: "rgba(57, 80, 107, 0.12)", borderRadius: 12, border: "1px solid rgba(107, 174, 219, 0.25)" }}>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, margin: 0 }}>
                <strong>Aggregate Implications:</strong> What patents are highly relevant to some or one other assignee(s), which patents are estimated to be sunk costs now, where should future AI/ML IP investments be directed.
              </p>
            </div>
          </div>
        </div>

        {/* Encroachment */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <SectionHeader title="Assignee Encroachment" />
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 16 }}>
            Encroachment analysis tracks how target assignees are citing patents/publications held by a source assignee over time. When a target assignee's patent cites a source assignee's patent/publication, there is an implication of relevancy in a technology space. Monitoring encroachment trends may assist in early identification of licensing potential, technology areas of increasing value, and/or potential infringement actions.
          </p>
          <DetailList
            items={[
              { title: "Precondition", text: "Requires at least one source assignee name in scope. Encroachment measures citations into that assignee's portfolio." },
              { title: "Timeline Chart", text: "Multi-series line chart showing citing patent counts per target assignee over time (monthly or quarterly buckets)." },
              { title: "Target Assignee Table", text: "Ranked list of target assignees with total citing patents, encroachment score, and velocity." },
              { title: "Target Assignee Filter", text: "Toggle to show only explicitly named target assignees or all citing assignees." },
            ]}
          />
          <div style={{ marginTop: 16, padding: 16, background: "rgba(107, 174, 219, 0.12)", borderRadius: 12, border: "1px solid rgba(107, 174, 219, 0.25)" }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>Key Terms</h4>
            <ul style={{ marginLeft: 20, fontSize: 13, lineHeight: 1.5, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR, marginBottom: 0 }}>
              <li><strong>Encroachment Score</strong>: Normalized measure (0–100) of how many patents from a target assignee cite the source assignee's patents/publications, scaled across all target assignees and boosted by trend. Combines 70% volume weight with 30% velocity weight.</li>
              <li><strong>Velocity</strong>: Slope of citing counts over time. Positive velocity means increasing encroachment; negative means declining target assignee activity in an area.</li>
              <li><strong>Total Citing Patents</strong>: Count of unique patents from this target assignee that cite the source assignee's portfolio.</li>
            </ul>
          </div>
        </div>

        {/* Example Workflows */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Example Workflows</h2>
          <div style={{ display: "grid", gap: 16 }}>
            <WorkflowCard
              title="Licensing and Investment Signals"
              steps={[
                "Input an assignee name in the Source Assignee(s) field to set scope to assignee(s) of interest.",
                "Add target assignees to the Target Assignee(s) field (optional).",
                "Review Assignee Encroachment timeline to find target assignees that are becoming increasingly reliant upon a source assignee's portfolio.",
                "Check Forward-Citation Impact for a source assignee's most-cited patents/publications (potential licensing candidates).",
                "Verify via Risk Radar to find which patents/publications are stronger candidates for licensing.",

                "Evaluate Dependency Matrix for assignees' citing/cited patents/publications (mutual dependency)."
              ]}
            />
            <WorkflowCard
              title="Portfolio Risk Assessment"
              steps={[
                "Enter a portfolio's patent/publication numbers in the Patent/Publication #(s) field.",
                "Sort Risk Radar by Overall Risk to sort patents/publications recommended for review.",
                "Determine primary contributors to risk and vulnerability: Exposure (e.g., target assignees citing) and Fragility (e.g. prior art breadth).",
                "Export PDF report for offline research and review.",
                "Cross-reference with Forward-Citation Impact for a more complete context."
              ]}
            />
            <WorkflowCard
              title="Marketplace Intelligence"
              steps={[
                "Input focus keyword(s) in the Keyword(s) field and/or CPC code(s) in the CPC Code(s) field.",
                "Sort Forward-Citation Impact by Total Forward Citations to identify patents/publications higher relevance or greater industry adoption.",
                "Gauge the strength/weakness of patents/publications matching the focus keyword(s) or CPC code(s) via Risk Radar.",
                "Flag weaker patents for potential IPR action, note stronger publications to be monitored until issuance."
              ]}
            />
          </div>
          <div style={{ marginTop: 16, display: "grid", gap: 16 }}>
            
            <ResourceLink
              title="Note: Terms of Service"
              description="Please note that citation data for the patents and publications available in the SynapseIP database may be incomplete. For clarity and relevancy, cited patents and publications filed prior to 2007 (approximately) may be absent. Backward citations are currently available only for patents. Contact support@phaethon.llc to request extension of this feature to publications. Additionally, foreign references and non-patent literature are excluded at this time. As set forth in the SynapseIP Terms of Service, no express or implied warranties are made regarding the completeness of the available dataset."
              href="/docs/tos"
              external={false}
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

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR }}>{title}</h2>
    </div>
  );
}

function DetailList({ items }: { items: { title: string; text: string }[] }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((item) => (
        <div key={item.title} style={{ display: "flex", gap: 12 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⬩</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: TEXT_COLOR }}>{item.title}</div>
            <div style={{ fontSize: 14, color: TEXT_COLOR }}>{item.text}</div>
          </div>
        </div>
      ))}
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

function InterpretationBand({ color, range, label }: { color: string; range: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <div style={{ width: 12, height: 12, borderRadius: 3, background: color, flexShrink: 0 }} />
      <span style={{ fontWeight: 600, fontSize: 13, color: TEXT_COLOR, minWidth: 60 }}>{range}:</span>
      <span style={{ fontSize: 13, color: TEXT_COLOR }}>{label}</span>
    </div>
  );
}

function WorkflowCard({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div style={{ padding: 18, background: "rgba(107, 174, 219, 0.08)", borderRadius: 12, border: "1px solid rgba(107, 174, 219, 0.2)" }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT_COLOR, marginBottom: 12 }}>{title}</h3>
      <ol style={{ marginLeft: 20, fontSize: 13, lineHeight: 1.5, listStyleType: "decimal", listStylePosition: "outside", color: TEXT_COLOR, marginBottom: 0 }}>
        {steps.map((step, idx) => (
          <li key={idx}>{step}</li>
        ))}
      </ol>
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

function ResourceLink({ title, description, href, external }: { title: string; description: string; href: string; external: boolean }) {
  return (
    <div style={{ padding: 16, border: `2px solid ${CARD_BORDER}`, borderRadius: 8 }}>
      <a
        href={href}
        className="hover:underline"
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        style={{ fontSize: 13, fontWeight: 500, color: LINK_COLOR }}
      >
        {title} {external && "↗︎"}
      </a>
      <p style={{ margin: "6px 0 0 0", fontSize: 12, color: TEXT_COLOR }}>{description}</p>
    </div>
  );
}