// app/help/page.tsx
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

export default function HelpIndexPage() {
  return (
    <div style={pageWrapperStyle}>
      <div className="glass-surface" style={surfaceStyle}>

        {/* Header */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: TEXT_COLOR }}>SynapseIP Help</h1>
          <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 0 }}>
            Welcome to SynapseIP, an advanced data and analytics platform directed to artificial intelligence (AI) and machine learning (ML) intellectual property (IP). This help center includes documentation describing the platform's various features and terminology, as well as guides to the user interfaces and workflows on the platform.
          </p>
        </div>

        {/* Overview */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Introduction to the SynapseIP Platform</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 8 }}>
            SynapseIP is an IP platform specific to AI/ML data and analytics. The platform combines hybrid semantic search, trend analysis, and IP overview information to provide an integrated and in-depth understanding of the IP landscape as it relates to AI/ML innovations and investments and the entities active in this space. The platform is built on a relational database system that includes 57,000+ AI/ML-related patents and publications dating back to 2023.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 8 }}>
            Each entry (i.e., patent or publication) in the database is enriched with metadata and context; specifically, each entry corresponds to a patent or publication with multiple associated AI embeddings. The multiple AI embeddings enable accurate and robust semantic searching over multiple fields and combinations of fields.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 12 }}>
            Metadata and context for each entry further include the assignee name (i.e., owner). The SynapseIP platform normalizes each assignee name to ensure that the AI/ML IP assets held by different entities are accurately and comprehensively represented.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 12 }}>
            SynapseIP is designed with a streamlined user interface divided between three primary web service pages:
          </p>
          <ul style={{ marginLeft: 20, marginTop: 12, fontSize: 14, lineHeight: 1.5, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
            <li><strong>Search & Trends</strong>: Discover patents and publications through hybrid keyword and semantic search, visualize filing trends over time, by CPC code, or by assignee, and set up proactive alerts for new filings that match configurable criteria;</li>
            <li><strong>Scope Analysis</strong>: Input a product description, invention disclosure, or draft claim set to run a semantic comparison against independent claims in the SynapseIP database. The closest matching independent claims are returned with similarity scoring for preliminary FTO and infringement-risk analysis.;</li>
            <li><strong>IP Overview</strong>: Investigate the AI/ML IP landscape through information and insights on subject matter saturation, activity rates, momentum, and CPC distribution of AI/ML-related patents and publications. Option to focus on specific assignees.</li>
            <li><strong>Citation Intelligence</strong>: Analyze forward-citation impact, cross-assignee dependencies, competitor risk signals, and encroachment trends using the patent_citation dataset with portfolio-aware filters.</li>
          </ul>
        </div>

        {/* Feature Cards Grid */}
        <div style={{ display: "grid", gap: 24 }}>

          {/* Search & Trends Card */}
          <div
            className="glass-card"
            style={{
              ...cardBaseStyle,
              border: "1.5px solid rgba(107, 174, 219, 0.75)",
              boxShadow: "0 30px 60px rgba(107, 174, 219, 0.32)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div style={{ flex: 1, minWidth: 250 }}>
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT_COLOR }}>Search & Trends</h3>
                <p style={{ marginTop: 8, fontSize: 13, color: "#627D98", marginBottom: 0 }}>
                  Hybrid search, trend visualization, and proactive alerts
                </p>
              </div>
              <a
                href="/help/search_trends"
                className="btn-modern"
                style={linkButtonStyle}
              >
                View Guide →
              </a>
            </div>

            <p style={{ marginTop: 20, fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 8 }}>
              The Search & Trends page is the primary interface for discovering and monitoring granted patents and published applications. It combines powerful search capabilities with visual trend analytics to provide an easily comprehensible view of the AI/ML IP landscape. The intuitive interface allows users to construct complex queries using both keywords and semantic natural language, filter results by various metadata fields, and visualize filing trends over time, by CPC classification, or by assignee. 
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 16 }}>
              The Search & Trends page further includes the option to save a particular search configuration as an alert. SynapseIP updates its database on a weekly basis, following the USPTO schedule. Saved searches are automatically run when new data becomes available, and users are notified of new matches.
            </p>

            <div style={{ display: "grid", gap: 12 }}>
              <DetailItem icon="⬩" title="Hybrid Search" text="Combine keyword and semantic queries to find relevant patents and publications using both exact and semantically similar matches" />
              <DetailItem icon="⬩" title="Advanced Filters" text="Narrow results by assignee, CPC code, grant/publication date range, and more" />
              <DetailItem icon="⬩" title="Trend Visualization" text="Visualize patent and publication trends by month, CPC classification, or assignee to spot patterns and emerging areas" />
              <DetailItem icon="⬩" title="Export Capabilities" text="Download search results as CSV or enriched PDF reports for offline analysis" />
              <DetailItem icon="⬩" title="Saved Alerts" text="Save search criteria and receive notifications when new patents and publications match those specific filters" />
            </div>

            <div
              style={{
                marginTop: 20,
                padding: 18,
                background: "rgba(57, 80, 107, 0.22)",
                borderRadius: 14,
                border: "1px solid rgba(155, 199, 255, 0.35)",
                boxShadow: "0 14px 26px rgba(107, 174, 219, 0.18)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, margin: 0 }}>
                <strong>Example Use Cases</strong>: Ongoing competitive monitoring, prior art searches, freedom-to-operate and clearance analysis, and staying current with AI/ML IP as it relates to specific technology areas. Graphs provide visual guides on trends across the AI/ML IP domain.
              </p>
            </div>
          </div>

          {/* IP Overview Card */}
          <div
            className="glass-card"
            style={{
              ...cardBaseStyle,
              border: "1.5px solid rgba(107, 174, 219, 0.75)",
              boxShadow: "0 30px 60px rgba(107, 174, 219, 0.32)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div style={{ flex: 1, minWidth: 250 }}>
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT_COLOR }}>IP Overview</h3>
                <p style={{ marginTop: 8, fontSize: 13, color: "#627D98", marginBottom: 0 }}>
                  Insights on how crowded specific technology areas are and where opportunities may exist
                </p>
              </div>
              <a
                href="/help/overview"
                className="btn-modern"
                style={linkButtonStyle}
              >
                View Guide →
              </a>
            </div>

            <p style={{ marginTop: 20, fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 8 }}>
              The IP Overview page provides a quantitative view of patent and publication activity within a defined scope. This page includes analysis and insights for subject matter saturation, activity rates, and momentum measurements, as well as identifying CPC codes under which patent and publications are concentrated. The interface presents four primary metrics (subject matter saturation, patent and publication activity rate, patent grant and publication momentum, and top CPC codes) supported by a monthly trend line, CPC distribution chart, and sortable results table with direct links to the underlying patents and publications.
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 16 }}>
              An optional “Group by Assignee” toggle enables the KNN Sigma graph visualization with confidence-scored signals highlighting potential gaps, bridging opportunities*, focus convergence, and crowd-out patterns.
            </p>

            <div style={{ display: "grid", gap: 12 }}>
              <DetailItem icon="⬩" title="Saturation & Activity Rate Tiles" text="Exact vs. semantic counts, patent grants and publications per month, and percentile labels indicate how busy a target search set is." />
              <DetailItem icon="⬩" title="Momentum Labeling" text="Monthly trendline, slope, and CAGR classify patent grant and publication activity as rising, declining, or flat." />
              <DetailItem icon="⬩" title="CPC Distribution" text="Top CPC codes plus a ranked bar chart highlight relevant technology areas." />
              <DetailItem icon="⬩" title="Result Set Table" text="Patent and publication rows (with CPC codes and external links) illustrate the data supporting the IP overview analysis and insights." />
              <DetailItem icon="⬩" title="(Optional) Group by Assignee" text="Enable to view a KNN graph and per-assignee opportunity and risk confidence signals for potential gap, bridge opportunity*, crowd-out risk, and focus convergence risk." />
            </div>

            <div
              style={{
                marginTop: 20,
                padding: 18,
                background: "rgba(57, 80, 107, 0.22)",
                borderRadius: 14,
                border: "1px solid rgba(107, 174, 219, 0.25)",
                boxShadow: "0 14px 26px rgba(107, 174, 219, 0.18)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, margin: 0 }}>
                <strong>Example Use Cases</strong>: AI/ML investment decisions, R&D opportunity identification, competitive threat assessment, and understanding where R&D focus is shifting in and around specific technology areas in the context of AI/ML.
              </p>
            </div>
          </div>

          {/* Citation Intelligence Card */}
          <div
            className="glass-card"
            style={{
              ...cardBaseStyle,
              border: "1.5px solid rgba(107, 174, 219, 0.75)",
              boxShadow: "0 30px 60px rgba(107, 174, 219, 0.32)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div style={{ flex: 1, minWidth: 250 }}>
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT_COLOR }}>Citation Intelligence</h3>
                <p style={{ marginTop: 8, fontSize: 13, color: "#627D98", marginBottom: 0 }}>
                  Portfolio-aware forward citations, dependencies, risk radar, and encroachment insights
                </p>
              </div>
              <a
                href="/help/citation"
                className="btn-modern"
                style={linkButtonStyle}
              >
                View Guide →
              </a>
            </div>

            <p style={{ marginTop: 20, fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 8 }}>
              The Citation Intelligence page layers analytics on the patent_citation table to reveal who cites your portfolio, where cross-assignee dependencies exist, and which competitors are encroaching on your space. A shared scope card defines portfolio and time window once, then four widgets refresh in parallel.
            </p>

            <div style={{ display: "grid", gap: 12 }}>
              <DetailItem icon="⬩" title="Scope Panel" text="Switch between assignee names, explicit pub_ids, or search filters; set citing date window, bucket granularity, and optional competitor list." />
              <DetailItem icon="⬩" title="Forward-Citation Impact" text="Tiles for total citations and distinct citing patents, a bucketed influence timeline, and a ranked table of top cited assets with velocity." />
              <DetailItem icon="⬩" title="Dependency Matrix" text="Citing→cited assignee pairs with min-citation threshold and optional normalization to expose reliance patterns." />
              <DetailItem icon="⬩" title="Risk Radar" text="Per-patent exposure and fragility scores combining forward competitor activity and backward-citation concentration with CSV export." />
              <DetailItem icon="⬩" title="Encroachment" text="Timeline and table showing competitor citing patterns into target assignees, with velocity and encroachment scores." />
            </div>

            <div
              style={{
                marginTop: 20,
                padding: 18,
                background: "rgba(57, 80, 107, 0.22)",
                borderRadius: 14,
                border: "1px solid rgba(155, 199, 255, 0.35)",
                boxShadow: "0 14px 26px rgba(107, 174, 219, 0.18)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, margin: 0 }}>
                <strong>Best practices</strong>: keep scopes focused (target assignees or curated pub IDs), use month buckets for recent activity and quarter buckets for multi-year trends, and apply competitor lists to sharpen Risk Radar and Encroachment views.
              </p>
            </div>
          </div>

        </div>

        {/* Scope Analysis Card */}
        <div
          className="glass-card"
          style={{
            ...cardBaseStyle,
            border: "1.5px solid rgba(107, 174, 219, 0.75)",
            boxShadow: "0 30px 60px rgba(107, 174, 219, 0.32)",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 250 }}>
              <h3 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT_COLOR }}>Scope Analysis</h3>
              <p style={{ marginTop: 8, fontSize: 13, color: "#627D98", marginBottom: 0 }}>
                Claim-level semantic comparison for preliminary FTO and infringement assessment
              </p>
            </div>
            <a
              href="/help/scope-analysis"
              className="btn-modern"
              style={linkButtonStyle}
            >
              View Guide →
            </a>
          </div>

          <p style={{ marginTop: 20, fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 8 }}>
            The Scope Analysis page supplements AI/ML IP search, trends, and IP overview by providing freedom-to-operate (FTO) and infringement-risk screening. Input a natural language description of subject matter of interest (e.g., product features, invention disclosures, draft claims, etc.) to run a semantic comparison against independent claims across patents in the SynapseIP database. The closest matches are returned with context-rich analysis.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 16 }}>
            Results are graphically represented in an interactive node map that positions the user input at the center with claim nodes radially arranged by similarity. A synchronized results table lists the associated patents, assignees, grant dates, and full claim language.
          </p>

          <div style={{ display: "grid", gap: 12 }}>
            <DetailItem icon="⬩" title="Independent Claim Embeddings" text="Every independent claim in the database is embedded and indexed, allowing high-fidelity semantic comparisons against inputs." />
            <DetailItem icon="⬩" title="Interactive Similarity Graph" text="Hover to preview claim snippets, click nodes to sync with the results table, and quickly see which patents crowd closest to input subject matter." />
            <DetailItem icon="⬩" title="Results Table" text="The claim cells are expandable to reveal the full independent claim text. The patent numbers are linked to the full patent documents." />
            <DetailItem icon="⬩" title="Risk Snapshot Tiles" text="Clustering and counts highlight the number of high-similarity claims, lower-risk matches, and the overall scope sampled during each run." />
            <DetailItem icon="⬩" title="Pre-FTO/Clearance Review" text="Scope Analysis provides an immediate, data-driven starting point for preliminary freedom-to-operate analysis, infringement-risk reviews, and design-around brainstorming." />
          </div>

          <div
            style={{
              marginTop: 20,
              padding: 18,
              background: "rgba(57, 80, 107, 0.22)",
              borderRadius: 14,
              border: "1px solid rgba(107, 174, 219, 0.25)",
              boxShadow: "0 14px 26px rgba(107, 174, 219, 0.18)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, margin: 0 }}>
              <strong>Example Use Cases</strong>: pre-FTO review, infringement-risk screening, due diligence, clearance opinions.
            </p>
          </div>
        </div>

        {/* Quick Start */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Quick Start Guide</h2>

          <div style={{ display: "grid", gap: 20 }}>
            <InfoSection
              title="1. Authentication"
              content="SynapseIP uses Auth0 for secure authentication. Log in or sign up using the button in the top navigation bar. All features require authentication to ensure data security and usage tracking."
            />

            <InfoSection
              title="2. Start with Search & Trends"
              content="Search & Trends provides direct and easy access to the AI/ML patent and publication data set available through SynapseIP. Semantic queries, keyword input, and CPC filters are available to narrow results. Trend groupings may assist in understanding filing patterns."
            />

            <InfoSection
              title="3. Save Searches as Alerts"
              content="Relevant or important searches can be saved as alerts to avoid repeated manual runs. With search criteria of interest input, click 'Save as Alert' to receive notifications when new patents or publications match that criteria. Alerts can be managed through the navigation bar (hover over username for menu)."
            />

            <InfoSection
              title="4. Run Scope Analysis Early"
              content="Input a product description, invention disclosure, or draft claims into the Scope Analysis page to generate a semantic comparison against independent claims. Use the similarity graph and evidence table to identify relevant patents to assess infringement risks."
            />

            <InfoSection
              title="5. Explore AI/ML IP Opportunities"
              content="Navigate to the IP Overview page to view how busy a technology area is. Enter focus keywords and/or CPC codes, review the saturation/activity rate/momentum tiles, inspect the timeline and CPC bars, and review the result set table for representative patents and publications."
            />

            <InfoSection
              title="6. Export and Share Insights"
              content="Use CSV/PDF exports for shareable reports, and copy links from the IP Overview result set table to access full text and figures of specific patents or publications."
            />
          </div>
        </div>

        {/* Additional Resources */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Additional Resources</h2>

          <div style={{ display: "grid", gap: 16 }}>

            <Footnote
              id="footnote1"
              title="“Bridging” Patents and Publications"
              description="A “bridging” patent/publication is one in which the invention is directed to one technology area but the scope of protection can be broadened to cover other areas. Example: a patent claiming an improvement to internal combustion engines in automobiles, and the improvement can also be used in aviation, marine, and other internal combustion engine applications. Bridging patents have been shown to be especially commercially valuable. See, e.g., Choi & Yoon, Measuring Knowledge Exploration Distance at the Patent Level, 16 J. Informetr. 101286 (2002) (linked here). See also Moehrle & Frischkorn, Bridge Strongly or Focus — An Analysis of Bridging Patents [...], 15 J. Informetr. 101138 (2001)."
              href="https://ideas.repec.org/a/eee/infome/v16y2022i2s1751157722000384.html"
              external={true}
            />

            <ResourceLink
              title="Understanding CPC Codes"
              description="CPC (Cooperative Patent Classification) codes categorize patents and applications by technology area. For reference, the USPTO generally assigns AI and machine learning subject matter under one of the following CPC section (letter)+class(number)+subclass(letter) classifications: A61B, B60W, G05D, G06N, G06V, and G10L. More specific AI/ML-related subject matter is generally assigned to group, as well, as indicating by a number appended to the subclass: G06F17, G06F18, G06F40, G06K9, G06T7. A further subgroup indicates subject matter at an even more granular level, which is indicated by a third number, preceded by a backslash. For AI/ML-related subject matter, this is most commonly encoutered in CPC classification G06F16/90."
              href="https://www.uspto.gov/web/patents/classification/cpc/html/cpc.html"
              external={true}
            />

            <ResourceLink
              title="Legal Documentation"
              description="Review the SynapseIP platform Terms of Service, Privacy Policy, and Data Processing Agreement."
              href="/docs"
              external={false}
            />
          </div>
        </div>

        {/* Support */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Need Help?</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 12 }}>
            If you have questions or encounter issues not covered in this documentation, please contact:
          </p>
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, margin: 0 }}>
              <strong>Email</strong>: <a href="mailto:support@phaethon.llc" className="hover:underline" style={{ color: LINK_COLOR }}>support@phaethon.llc</a><br />
              <strong>Subject Line</strong>: SynapseIP Support Request<br />
              <strong>Website</strong>: <a href="https://phaethonorder.com" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://phaethonorder.com</a>
            </p>
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

function DetailItem({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
      <div>
        <span style={{ fontWeight: 600, fontSize: 14, color: TEXT_COLOR }}>{title}:</span>
        <span style={{ fontSize: 14, color: TEXT_COLOR, marginLeft: 4 }}>{text}</span>
      </div>
    </div>
  );
}

function InfoSection({ title, content }: { title: string; content: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>{content}</p>
    </div>
  );
}

function ResourceLink({ title, description, href, external }: { title: string; description: string; href: string; external: boolean }) {
  return (
    <div style={{ padding: 16, border: `2px solid ${CARD_BORDER}`, borderRadius: 8 }}>
      <a
        href={href}
        className="hover:underline"
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        style={{ fontSize: 15, fontWeight: 600, color: LINK_COLOR }}
      >
        {title} {external && "↗︎"}
      </a>
      <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "#627D98" }}>{description}</p>
    </div>
  );
}

function Footnote({ id, title, description, href, external }: { id: string; title: string; description: string; href: string; external: boolean }) {
  return (
    <div id={id} style={{ padding: 16, border: `2px solid ${CARD_BORDER}`, borderRadius: 8 }}>
      * <a
        href={href}
        className="hover:underline"
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        style={{ fontSize: 15, fontWeight: 600, color: LINK_COLOR }}
      >{title} {external && "↗︎"}</a>
      <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "#627D98" }}>{description}</p>
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
