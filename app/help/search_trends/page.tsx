// app/help/search_trends/page.tsx
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

export default function SearchTrendsHelpPage() {
  return (
    <div style={pageWrapperStyle}>
      <div className="glass-surface" style={surfaceStyle}>

        {/* Header */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: TEXT_COLOR }}>Search & Trends Guide</h1>
              <p style={{ marginTop: 8, fontSize: 14, color: "#627D98", marginBottom: 0 }}>
                <a href="/help" style={{ color: LINK_COLOR}} className="hover:underline">← Back to Help</a>
              </p>
            </div>
            <a
              href="/"
              className="btn-modern"
              style={linkButtonStyle}
            >
              Go to Search & Trends →
            </a>
          </div>
          <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 0 }}>
            The Search & Trends page is the primary interface for discovering, filtering, and monitoring patent filings. This guide covers all inputs, outputs, and workflows to help you make the most of the search and alert features.
          </p>
        </div>

        {/* Overview */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Overview</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 12 }}>
            Search & Trends combines three core capabilities:
          </p>
          <ul style={{ marginLeft: 20, marginTop: 12, fontSize: 14, lineHeight: 1.5, listStyleType: "decimal", listStylePosition: "outside", color: TEXT_COLOR }}>
            <li><strong>Hybrid Search</strong>: Find patents and publications using keyword matching, semantic similarity, or both combined;</li>
            <li><strong>Trend Visualization</strong>: Understand filing patterns over time, by technology classification, or by assignee;</li>
            <li><strong>Saved Alerts</strong>: Monitor ongoing activity by saving search criteria and receiving notifications when new patents and publications match.</li>
          </ul>
        </div>

        {/* Search Interface */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Search Interface & Inputs</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 16 }}>
            The search interface provides multiple input fields to refine your patent search. Click <strong>Apply</strong> to run the search. The trend graph and results table are synchronized. Note that semantic search and keyword search can be used together, e.g., to refine results, filter is concentrated within a specific context, or ensure that a search for keywords of interest is limited to a domain of interest. Thus, fine-grained control can be achieved by using both a semantic query (to capture conceptually similar patents and publications) and keywords (to ensure specific terms are present). This hybrid approach prevents the signal from being lost in the noise by leveraging the strengths of both methods.
          </p>

          <div style={{ display: "grid", gap: 20 }}>
            <InputDescription
              label="Semantic Query"
              description="Enter a natural language description of the technology or concept you're interested in. SynapseIP uses AI embeddings to search for semantically similar patents and publications, which incorporates context, meaning, and other auxiliary information in order to return results that that are more robust, comprehensive, and relevant than traditional keyword searches."
              example='Example: "autonomous vehicle perception systems using LIDAR and camera fusion"'
              tips={[
                "Be specific and descriptive rather than using single keywords",
                "This field searches against both title+abstract and claims embeddings",
                "Results are ranked by cosine similarity to your query",
                "Can be combined with other filters for hybrid search"
              ]}
            />

            <InputDescription
              label="Keywords"
              description="Enter specific words or phrases that must appear in the patent title, abstract, or claims. This is a traditional keyword-based search using PostgreSQL full-text search."
              example='Example: "neural network", "LIDAR", "convolutional"'
              tips={[
                "Use quotes for exact phrases if your search term is a common word",
                "Multiple keywords are treated as AND conditions",
                "Case-insensitive matching",
                "Combine with semantic query for the most precise results"
              ]}
            />

            <InputDescription
              label="Assignee"
              description="Filter results to patents and publications assigned to a specific company or entity. Partial matching is supported."
              example='Example: "Google", "Microsoft", "Tesla"'
              tips={[
                "Partial matches are supported (e.g., 'Google' matches 'Google LLC', 'Google Inc.')",
                "Use the exact assignee name as it appears in patent records for best results",
                "Case-insensitive matching"
              ]}
            />

            <InputDescription
              label="CPC (Cooperative Patent Classification)"
              description="Filter by CPC code to narrow results to specific technology areas. Supports hierarchical matching."
              example='Example: "G06N" (Computing arrangements based on specific computational models), "G06F17/00" (Digital computing or data processing equipment or methods, specially adapted for specific functions)'
              tips={[
                "Use broader codes (e.g., 'G06N') for wider results",
                "Use specific codes (e.g., 'G06F17/00') for narrow results",
                "Supports partial matching at any level of the hierarchy",
                "See the USPTO CPC reference for code definitions"
              ]}
            />

            <InputDescription
              label="Date Range (From / To)"
              description="Filter patents and publications by grant/publication date. Both fields are optional. The default range spans the entire patent and publication data set (2023–present)."
              example="Example: From 01-31-2024, To 12-31-2024"
              tips={[
                "Dates are based on earliest publication date for applications, grant date for patents",
                "Both fields accept MM-DD-YYYY format via the date picker",
                "Leaving fields blank uses SynapseIP's min/max dates",
                "Date range is displayed in the Trend chart subtitle"
              ]}
            />
          </div>
        </div>

        {/* Control Buttons */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Action Buttons</h2>

          <div style={{ display: "grid", gap: 20 }}>
            <ActionDescription
              button="Apply"
              description="Runs the search and trend fetch with the current filter state. Searches are only executed when you click Apply, ensuring both the Trend graph and Results table update together."
            />

            <ActionDescription
              button="Reset"
              description="Clears all search inputs (semantic query, keywords, assignee, CPC, date range) and prepares for a fresh query. After resetting, click Apply to fetch results with the cleared filters."
            />

            <ActionDescription
              button="Save Alert"
              description="Saves the current search configuration (all filters and semantic query) as a named alert. Email notifications are automatically sent when new patents or publications matching these search criteria are added."
            />
          </div>
        </div>

        {/* Search Results */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Search Results</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 16 }}>
            Search results are displayed in a paginated list (20 results per page) with detailed metadata for each patent.
          </p>

          <h3 style={{ margin: "20px 0 12px", fontSize: 16, fontWeight: 600, color: TEXT_COLOR }}>Result Fields</h3>
          <div style={{ display: "grid", gap: 12 }}>
            <ResultField field="Title" description="The patent title, displayed prominently with a clickable link to Google Patents." />
            <ResultField field="Patent/Publication No" description="The patent or publication number (e.g., US-2024123456-A1, US-12345678-B2). Clicking opens a link to Google Patents in a new tab." />
            <ResultField field="Assignee" description="The company or entity that is assigned the patent (e.g., 'Google LLC')." />
            <ResultField field="Grant/Publication Date" description="The date the patent was granted or the application was published (formatted as YYYY-MM-DD)." />
            <ResultField field="CPC Codes" description="Cooperative Patent Classification codes assigned to the patent, comma-separated." />
            <ResultField field="Abstract" description="A truncated preview of the patent abstract (up to 420 characters)." />
          </div>

          <h3 style={{ margin: "20px 0 12px", fontSize: 16, fontWeight: 600, color: TEXT_COLOR }}>Pagination</h3>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 12 }}>
            Use the Prev and Next buttons to navigate through pages. The current page and total page count are displayed between the buttons. Changing any filter resets pagination to page 1.
          </p>

          <h3 style={{ margin: "20px 0 12px", fontSize: 16, fontWeight: 600, color: TEXT_COLOR }}>Export Options</h3>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 12 }}>
            When results are available, two export buttons appear:
          </p>
          <ul style={{ marginLeft: 20, marginTop: 12, fontSize: 14, lineHeight: 1.5, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
            <li><strong>Export CSV</strong>: Exports up to 1,000 results matching the current filters as a CSV file with columns for title, abstract, assignee, patent/pub no., grant/pub date, and CPC codes;</li>
            <li><strong>Export PDF</strong>: Generates an enriched PDF report (powered by ReportLab) with up to 1,000 results, including AI-generated summaries and metadata formatting.</li>
          </ul>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginTop: 12 }}>
            Both exports respect the current filter state, so you can refine your search before exporting.
          </p>
        </div>

        {/* Trend Visualization */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Trend Visualization</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 16 }}>
            The Trend chart visualizes patent filing patterns based on your current search filters. It updates automatically when filters change and respects all search inputs (keywords, semantic query, assignee, CPC, date range).
          </p>

          <h3 style={{ margin: "20px 0 12px", fontSize: 16, fontWeight: 600, color: TEXT_COLOR }}>Group By Options</h3>
          <div style={{ display: "grid", gap: 12 }}>
            <TrendOption
              mode="Month"
              description="Displays patent/publication count over time, grouped by month. The chart is a line graph with time on the x-axis and count on the y-axis. Indicative of filing spikes, focus patterns, or growth trends."
            />
            <TrendOption
              mode="CPC (Section + Class)"
              description="Groups patents and publications by their CPC section and class (e.g., 'G06N', 'H04L'). Displays the top 10 CPC codes by count, with an 'Other' category aggregating the rest. Rendered as a horizontal bar chart. Indicative of the technological areas dominating the search results. (Note: patents and publications generally have multiple CPC codes, so counts may exceed total results.)"
            />
            <TrendOption
              mode="Assignee"
              description="Groups patents and publications by assignee name. Displays the top 15 assignees by count as a horizontal bar chart. Indicative of most relevant entities in a technology space and their movements in different directions (e.g., competitive landscape analysis)."
            />
          </div>

          <h3 style={{ margin: "20px 0 12px", fontSize: 16, fontWeight: 600, color: TEXT_COLOR }}>Interpreting the Chart</h3>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 12 }}>
            The trend chart is interactive and updates in real time as you refine your search. Key points:
          </p>
          <ul style={{ marginLeft: 20, marginTop: 12, fontSize: 14, lineHeight: 1.5, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
            <li>The date range subtitle shows the effective From and To dates (either explicit or data set min/max);</li>
            <li>If no data is available for the current filters, the chart displays "No data";</li>
            <li>The chart automatically scales axes to fit the data range;</li>
            <li>For CPC and Assignee modes, labels are truncated or rotated for readability.</li>
          </ul>
        </div>

        {/* Alerts Workflow */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Managing Alerts</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 16 }}>
            Alerts enable specific search criteria to be monitored over time. USPTO publishes patent and publication data on a weekly basis. Search criteria is checked against the newly published data, and new matches to your criteria are sent via email. This section explains how to create, manage, and use alerts.
          </p>

          <h3 style={{ margin: "20px 0 12px", fontSize: 16, fontWeight: 600, color: TEXT_COLOR }}>Creating an Alert</h3>
          <div style={{ display: "grid", gap: 12 }}>
            <WorkflowStep
              step="1"
              title="Configure Search Parameters"
              description="Use the search interface to define the query and/or filters of interest. This can include semantic queries, keywords, assignee filters, CPC codes, and/or date ranges. Run the search to verify it returns relevant results."
            />
            <WorkflowStep
              step="2"
              title="Click 'Save Alert'"
              description="With the search parameters of interest still configured, click the 'Save Alert' button."
            />
            <WorkflowStep
              step="3"
              title="Label the Alert"
              description="An input field will be displayed, prompting for an alert label. Alert labels must be unique. Descriptive names are recommended, but search parameters will be indicated in the alert details so comprehensive labeling is not necessary." 
            />
            <WorkflowStep
              step="4"
              title="Confirm Save"
              description="Click OK in the prompt. The alert is saved to the database with is_active=true, meaning it will be checked during the next weekly alerts run. A success message appears briefly confirming the save."
            />
          </div>

          <h3 style={{ margin: "20px 0 12px", fontSize: 16, fontWeight: 600, color: TEXT_COLOR }}>Viewing and Managing Alerts</h3>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 12 }}>
            Click the "Alerts" button in the top navigation bar to open the alerts modal. This modal displays all your saved alerts with the following information:
          </p>
          <ul style={{ marginLeft: 20, marginTop: 12, fontSize: 14, lineHeight: 1.5, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
            <li><strong>Alert Name</strong>: The custom name you assigned when creating the alert;</li>
            <li><strong>Filters</strong>: A summary of the search criteria (keywords, assignee, CPC, date range);</li>
            <li><strong>Semantic Query</strong>: If a semantic query was included, it's displayed here;</li>
            <li><strong>Status</strong>: Shows whether the alert is active or inactive;</li>
            <li><strong>Created Date</strong>: When the alert was first saved;</li>
            <li><strong>Last Run</strong>: The timestamp of the last time the alert was checked (if applicable).</li>
          </ul>

          <h3 style={{ margin: "20px 0 12px", fontSize: 16, fontWeight: 600, color: TEXT_COLOR }}>Alert Actions</h3>
          <div style={{ display: "grid", gap: 12 }}>
            <AlertAction
              action="Toggle Active/Inactive"
              description="Click the toggle switch to activate or deactivate an alert. Inactive alerts are not checked during the alerts run. This is useful if you want to pause monitoring without deleting the alert."
            />
            <AlertAction
              action="Delete Alert"
              description="Click the 'Delete' button (usually styled as a red/danger button) to permanently remove the alert from the database. This action cannot be undone."
            />
            <AlertAction
              action="View Results"
              description="Some alert implementations may include a 'View Results' button that reconstructs the original search on the Search & Trends page. Accordingly, an aggregated and historical view of the alert's activity can be reviewed."
            />
          </div>

          <h3 style={{ margin: "20px 0 12px", fontSize: 16, fontWeight: 600, color: TEXT_COLOR }}>How Alerts Are Triggered</h3>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 12 }}>
            The alerts system runs via an automated backend process, which is scheduled to run on Friday at 07:00 AM PT (14:00 UTC), allowing a buffer period for the USPTO to make bulk data available. During each run, the alerts system performs the following steps for each active alert:
          </p>
          <ol style={{ marginLeft: 20, marginTop: 12, fontSize: 14, lineHeight: 1.5, listStyleType: "decimal", listStylePosition: "outside", color: TEXT_COLOR }}>
            <li>Fetches all active alerts from the database;</li>
            <li>For each alert, re-executes the saved search query on the most recent data;</li>
            <li>Compares the results to the last alert event timestamp to identify new matches to the search criteria since the last run;</li>
            <li>If new matches are found, sends a notification (via Mailgun) with the patent or publication details;</li>
            <li>Updates the alert event log with the current run timestamp.</li>
          </ol>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginTop: 12 }}>
            This ensures email alerts are only triggered once when search criteria is met, and that the emails provide timely notifications of new matches on the alert search criteria.
          </p>
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

function InputDescription({ label, description, example, tips }: { label: string; description: string; example: string; tips: string[] }) {
  return (
    <div style={{ padding: 18, border: `2px solid ${CARD_BORDER}`, borderRadius: 16 }}>
      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT_COLOR }}>{label}</h4>
      <p style={{ margin: "8px 0", fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>{description}</p>
      <p style={{ margin: "8px 0", fontSize: 13, fontStyle: "italic", color: "#627D98" }}>{example}</p>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: TEXT_COLOR, marginBottom: 6 }}>Notes:</div>
        <ul style={{ marginLeft: 20, fontSize: 13, lineHeight: 1.5, listStyleType: "circle", listStylePosition: "outside", color: TEXT_COLOR }}>
          {tips.map((tip, idx) => <li key={idx}>{tip}</li>)}
        </ul>
      </div>
    </div>
  );
}

function ActionDescription({ button, description }: { button: string; description: string }) {
  return (
    <div>
      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT_COLOR }}>{button}</h4>
      <p style={{ margin: "8px 0", fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>{description}</p>
    </div>
  );
}

function ResultField({ field, description }: { field: string; description: string }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <span style={{ fontWeight: 600, fontSize: 14, color: TEXT_COLOR, minWidth: 140 }}>{field}:</span>
      <span style={{ fontSize: 14, color: TEXT_COLOR }}>{description}</span>
    </div>
  );
}

function TrendOption({ mode, description }: { mode: string; description: string }) {
  return (
    <div>
      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT_COLOR }}>{mode}</h4>
      <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>{description}</p>
    </div>
  );
}

function WorkflowStep({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ minWidth: 28, height: 28, borderRadius: "50%", background: LINK_COLOR, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 14 }}>
        {step}
      </div>
      <div style={{ flex: 1 }}>
        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT_COLOR }}>{title}</h4>
        <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>{description}</p>
      </div>
    </div>
  );
}

function AlertAction({ action, description }: { action: string; description: string }) {
  return (
    <div>
      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT_COLOR }}>{action}</h4>
      <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>{description}</p>
    </div>
  );
}

function FlowStep({ num, title, description }: { num: string; title: string; description: string }) {
  return (
    <div style={{ padding: 20, borderRadius: 18, background: "rgba(95, 168, 210, 0.16)", border: "1px solid rgba(155, 199, 255, 0.35)", boxShadow: "0 6px 12px rgba(107, 174, 219, 0.2)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ minWidth: 30, height: 30, borderRadius: "50%", background: "rgba(16, 42, 67, 0.92)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 15 }}>
          {num}
        </div>
        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT_COLOR }}>{title}</h4>
      </div>
      <p style={{ margin: "12px 0 0 52px", fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>{description}</p>
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

const footerStyle: CSSProperties = {
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
