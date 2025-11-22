// app/help/scope-analysis/page.tsx
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

export default function ScopeAnalysisHelpPage() {
  return (
    <div style={pageWrapperStyle}>
      <div className="glass-surface" style={surfaceStyle}>

        {/* Header */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: TEXT_COLOR }}>Scope Analysis Guide</h1>
              <p style={{ marginTop: 8, fontSize: 14, color: "#627D98", marginBottom: 0 }}>
                <a href="/help" style={{ color: LINK_COLOR, textDecoration: "none" }}>← Back to Help</a>
              </p>
            </div>
            <a
              href="/scope-analysis"
              className="btn-modern"
              style={linkButtonStyle}
            >
              Go to Scope Analysis →
            </a>
          </div>
          <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 0 }}>
            The Scope Analysis page supplements AI/ML IP search, trends, and IP overview by providing freedom-to-operate (FTO) and infringement-risk screening. Input a natural language description of subject matter of interest (e.g., product features, invention disclosures, draft claims, etc.) and run a semantic comparison against independent claims across patents in the SynapseIP database. The closest matches are returned with context-rich analyses.
          </p>
        </div>

        {/* Overview */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>What is Scope Analysis?</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 12 }}>
            Traditional search tools focus on matching titles or abstracts. Scope Analysis dives into claim language, which is paramount in determining infringement exposure. Each independent claim in the SynapseIP database is embedded and indexed. Features:
          </p>
          <ul style={{ marginLeft: 20, marginTop: 12, fontSize: 14, lineHeight: 1.5, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
            <li>Returns patents with claim scopes semantically closest to the input subject matter.</li>
            <li>Quantifies proximity using cosine distance and similarity percentage.</li>
            <li>Presents quickly and easily comprehensible visual indicators of risk, including assignee information.</li>
            <li>Full text of semantically similar claims. Direct links to complete patents.</li>
            <li>Export capability for all results in PDF format.</li>
          </ul>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginTop: 12 }}>
            This workflow meaningfully reduces the cost and time of a formal infringement assessment.
          </p>
        </div>

        {/* How it works */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>How Scope Analysis works</h2>
          <ol style={{ marginLeft: 20, marginTop: 12, fontSize: 14, lineHeight: 1.7, color: TEXT_COLOR }}>
            <li><strong>User input</strong>: Provide up to ~20k characters describing the feature(s) or claim(s) to clear. Embedding quality improves with richer technical detail.</li>
            <li><strong>Embedding generation</strong>: SynapseIP generates an embedding vector for the submitted text (no data is stored beyond what is required to fulfill the request).</li>
            <li><strong>KNN search</strong>: Generated embedding vector is semantically compared against those generated from independent claims of the patents in the SynapseIP database. Closest matches (top-k configurable) are returned.</li>
            <li><strong>Visualization + evidence</strong>: Results populate both the similarity map and the results table to concurrently provide both macro and micro views.</li>
          </ol>
          <p style={{ fontSize: 13, lineHeight: 1.5, color: "#627D98", marginTop: 12 }}>
            Note: Start with 10–20 closest claims for rapid results. Increase <strong># of claim comparisons</strong> input to broaden coverage.
          </p>
        </div>

        {/* Workflow */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Example workflow</h2>
          <div style={{ display: "grid", gap: 18 }}>
            <InfoBlock
              title="1. Describe subject matter"
              description="Draft a description or list that captures subject matter of interest, inventive concepts, implementation details, etc. Including language tied to technical components is recommended for best results."
            />
            <InfoBlock
              title="2. Choose sampling depth"
              description="Use the '# of claim comparisons' input to specify the number independent claims to be returned. Default is 15; expanding to 40-50 can be useful where an initial scope analysis run shows high risk."
            />
            <InfoBlock
              title="3. Run the analysis"
              description="Click 'Run scope analysis' to execute embeddings search + KNN graphing operations. Results are returned with similarity scores, graph positioning, and risk tiles tailored to that query."
            />
            <InfoBlock
              title="4. Scan the graph"
              description="The graph displays nodes representing independent claims and graphically presents their distances from the input. Hover nodes to preview claim snippets, click to highlight a specific patent."
            />
            <InfoBlock
              title="5. Review supporting claims"
              description="In the table, click any claim cell to expand the full text. Patent numbers link to Google Patents to view full documents."
            />
            <InfoBlock
              title="6. Export Results"
              description="Results table can be exported as a PDF document for offline reference and review."
            />
          </div>
        </div>

        {/* Visualization details */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Interpreting the graph & table</h2>
          <div style={{ display: "grid", gap: 14 }}>
            <DetailItem title="Radial layout" description="The input text sits in the center. Nodes closer to the center represent higher similarity (lower cosine distance). The updated radius scaling exaggerates separation so critical risks pop immediately." />
            <DetailItem title="Tooltip previews" description="Hover any node to see the patent title and first 200 characters of the matched claim." />
            <DetailItem title="Selection sync" description="Graph, summary tiles, and claim text are synchronized. Clicking a node or claim row highlights both views." />
            <DetailItem title="Similarity column" description="Percent values are derived from 1 − distance. Scores ≥ 70% may indicate high overlap risks; 55–69% indicates moderate overlap; &lt;50% is generally lower risk but may be relevant." />
            <DetailItem title="Expandable claim text" description="Click the claim snippet to read the entire independent claim text inline." />
          </div>
        </div>

        {/* Tips */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Tips & troubleshooting</h2>
          <ul style={{ marginLeft: 20, marginTop: 12, fontSize: 14, lineHeight: 1.6, color: TEXT_COLOR }}>
            <li><strong>Too few matches</strong>: Increase the <em># of claim comparisons</em> slider or broaden the description with additional functional detail.</li>
            <li><strong>Mixed technology stack</strong>: Run separate analyses for each subsystem (e.g., hardware vs. software) to isolate potential infringement risks or clearance opportunities.</li>
            <li><strong>Monitor competitors & infringement risk</strong>: Use the table's assignee column to see which entities own the patents with the closest claims, and whether those patents are clustered near the same or similar technology areas.</li>
            <li><strong>Offline reference & review</strong>: Use the Export feature to save the results table as a PDF document. The exported document includes full claim text and similarity scores.</li>
            <li><strong>Support/Requests</strong>: Email <a href="mailto:support@phaethon.llc" style={{ color: LINK_COLOR }}>support@phaethon.llc</a> with any issues, questions, or requested features, and we will respond promptly.</li>
          </ul>
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
};

function InfoBlock({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT_COLOR, marginBottom: 6 }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>{description}</p>
    </div>
  );
};

function DetailItem({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
        <strong>{title}.</strong> {description}
      </p>
    </div>
  );
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
