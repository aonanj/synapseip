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
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: TEXT_COLOR }}>Citation Intelligence Guide</h1>
              <p style={{ marginTop: 8, fontSize: 14, color: "#627D98", marginBottom: 0 }}>
                <a href="/help" style={{ color: LINK_COLOR, textDecoration: "none" }}>← Back to Help</a>
              </p>
            </div>
            <a
              href="/citation"
              className="btn-modern"
              style={linkButtonStyle}
            >
              Go to Citation →
            </a>
          </div>
          <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 0 }}>
            Citation Intelligence layers analytics on the patent_citation table to answer “who cites us,” “who we rely on,” and “where competitors are encroaching.” A shared Scope card drives four widgets—Forward Impact, Dependency Matrix, Risk Radar, and Encroachment—so you set filters once and analyze from multiple angles.
          </p>
        </div>

        {/* Overview */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Page Overview</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 12 }}>
            Use the Scope card to define your portfolio and time window, then click <strong>Apply</strong>. All four sections refresh in parallel:
          </p>
          <ul style={{ marginLeft: 20, marginTop: 12, fontSize: 14, lineHeight: 1.5, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
            <li><strong>Forward-Citation Impact</strong>: aggregates total forward citations, distinct citing patents, a bucketed timeline, and a ranked table of top-cited assets with velocity.</li>
            <li><strong>Dependency Matrix</strong>: shows citing→cited assignee pairs, optional normalization (% of citing outgoing), and minimum-citation thresholding.</li>
            <li><strong>Risk Radar</strong>: ranks portfolio patents by overall risk score combining forward competitor activity with backward-citation concentration; includes CSV export.</li>
            <li><strong>Encroachment</strong>: visualizes competitor citations into target assignees with per-competitor totals, velocities, and encroachment scores.</li>
          </ul>
        </div>

        {/* Scope */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Scope & Filters</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 12 }}>
            The Scope card defines the portfolio and time window once:
          </p>
          <DetailList
            items={[
              { title: "Portfolio mode", text: "Choose one: target assignee names; explicit patent/publication numbers; or search filters (keyword, CPC, assignee contains)." },
              { title: "Time window", text: "Set citing publication date from/to and bucket granularity (month or quarter)." },
              { title: "Competitors", text: "Optionally constrain to a competitor list; affects Risk Radar and Encroachment." },
              { title: "Apply/Clear", text: "Apply triggers all widgets; Clear resets to defaults." },
            ]}
          />
          <p style={{ fontSize: 13, color: "#627D98", marginTop: 12, marginBottom: 0 }}>
            Note: keep scopes focused (specific assignees or patent/publication numbers) to avoid noisy dependency and risk outputs.
          </p>
        </div>

        {/* Forward Impact */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <SectionHeader title="Forward-Citation Impact" link="/citation" />
          <DetailList
            items={[
              { title: "Metrics", text: "Tiles for total forward citations, distinct citing patents, and median velocity across top results." },
              { title: "Timeline", text: "Bucketed line chart using citing pub_date; respects global or per-card bucket override." },
              { title: "Top patents", text: "Sortable table with patent/publication number, title, assignee, pub date, forward citations, velocity, first/last citation dates." },
              { title: "Controls", text: "Top N selector and optional bucket override." },
            ]}
          />
        </div>

        {/* Dependency Matrix */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <SectionHeader title="Cross-Assignee Dependency Matrix" link="/citation" />
          <DetailList
            items={[
              { title: "Edges", text: "Citing→cited assignee pairs restricted to citations involving the scoped portfolio." },
              { title: "Min citations", text: "Threshold slider/input to hide weak edges." },
              { title: "Normalize", text: "If enabled, shows % of citing assignee’s outgoing citations for each edge." },
              { title: "Outputs", text: "Heatmap-style grid (top citing vs. top cited) plus sortable edge table." },
            ]}
          />
          <p style={{ fontSize: 13, color: "#627D98", marginTop: 12, marginBottom: 0 }}>
            Note: set a portfolio (assignee names or patent/publication numbers) for meaningful dependency results.
          </p>
        </div>

        {/* Risk Radar */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <SectionHeader title="Risk Radar" link="/citation" />
          <DetailList
            items={[
              { title: "Inputs", text: "Top N selector and sort by overall risk, exposure, fragility, or forward citations." },
              { title: "Exposure", text: "Combines total forward citations with competitor share if competitor list is provided." },
              { title: "Fragility", text: "Derived from backward-citation CPC concentration and assignee diversity." },
              { title: "Table & export", text: "Inline score bars for exposure/fragility/overall plus CSV export." },
            ]}
          />
        </div>

        {/* Encroachment */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <SectionHeader title="Assignee Encroachment" link="/citation" />
          <DetailList
            items={[
              { title: "Precondition", text: "Requires at least one target assignee name in scope." },
              { title: "Controls", text: "Bucket (month/quarter), top competitors count, toggle for explicit competitors only." },
              { title: "Timeline", text: "Multi-series line chart of citing patent counts per competitor into the target portfolio." },
              { title: "Table", text: "Per-competitor totals, encroachment scores, and velocity labels." },
            ]}
          />
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

function SectionHeader({ title, link }: { title: string; link: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR }}>{title}</h2>
      <a href={link} className="btn-outline" style={linkButtonStyle}>
        Open →
      </a>
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
