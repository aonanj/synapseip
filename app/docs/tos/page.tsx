// app/docs/tos/page.tsx
"use client";

import type { CSSProperties } from "react";

const TEXT_COLOR = "#102A43";
const LINK_COLOR = "#5FA8D2";
const CARD_BG = "rgba(255, 255, 255, 0.8)";
const CARD_BORDER = "rgba(255, 255, 255, 0.45)";
const CARD_SHADOW = "0 10px 24px rgba(15, 23, 42, 0.28)";

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

export default function TermsOfServicePage() {
  return (
    <div style={pageWrapperStyle}>
      <div className="glass-surface" style={surfaceStyle}>
        
        {/* Header */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: TEXT_COLOR }}>SynapseIP Terms of Service</h1>
          <div style={{ marginTop: 12, fontSize: 14, color: TEXT_COLOR }}>
            <strong>Effective Date</strong>: October 17, 2025<br />
            <strong>Last Updated</strong>: October 17, 2026
          </div>
          <p style={{ marginTop: 8, fontSize: 14, color: "#627D98", marginBottom: 0 }}>
            <a href="/docs" style={{ color: LINK_COLOR, textDecoration: "none" }}>← Back to Legal</a>
          </p>
        </div>

        {/* Content */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          
          <Section title="Agreement to Terms">
            <p>
              These Terms of Service ("<strong>Terms</strong>") constitute a legally binding agreement between you (individually or on behalf of an entity, "<strong>you</strong>" or "<strong>your</strong>") and Phaethon Order LLC ("<strong>Company</strong>," "<strong>We</strong>," "<strong>Us</strong>," or "<strong>Our</strong>") concerning your access to and use of the SynapseIP service, including Our website at <a href="https://www.synapse-ip.com/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://www.synapse-ip.com/</a> and any related services, features, content, or applications (collectively, the "<strong>Service</strong>").
            </p>
            <p style={{ fontWeight: 600, marginTop: 16 }}>
              BY ACCESSING OR USING THE SERVICE, YOU AGREE TO BE BOUND BY THESE TERMS. If you do not agree to these Terms, you must not access or use the Service.
            </p>
          </Section>

          <Section title="1. Service Description">
            <Subsection title="1.1 What SynapseIP Provides">
              <p>SynapseIP is an AI/ML IP intelligence platform that provides:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Search and discovery tools for AI/ML-related patents and publications;</li>
                <li>Trend analysis and visualization;</li>
                <li>IP overview information and signal analysis;</li>
                <li>Automated alerts for patent filings matching user-defined criteria;</li>
                <li>Export capabilities for search results.</li>
              </ul>
            </Subsection>

            <Subsection title="1.2 Data Sources">
              <p>The Service aggregates and analyzes patent data from publicly available sources, including but not limited to:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Google Patents Public Datasets (BigQuery);</li>
                <li>United States Patent and Trademark Office (USPTO) publications;</li>
                <li>Espacenet publications;</li>
                <li>Other publicly accessible patent databases.</li>
              </ul>
            </Subsection>

            <Subsection title="1.3 Beta Service Notice">
              <p>
                SynapseIP is currently in active development. Features, functionality, data quality, and availability may change without notice. You acknowledge that you are using a service that is under continuous improvement and may experience interruptions, errors, and/or data inconsistencies. By using this Service, you agree that We are not liable for such interruptions, errors, and/or inconsistencies.
              </p>
            </Subsection>
          </Section>

          <Section title="2. Critical Disclaimers and Limitations">
            <Subsection title="2.1 NOT Legal Advice">
              <p style={{ fontWeight: 600 }}>THE SERVICE DOES NOT PROVIDE LEGAL ADVICE.</p>
              <p>SynapseIP is an informational tool only. The Service:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Does NOT constitute legal, patent, or professional advice of any kind;</li>
                <li>Does NOT replace consultation with qualified patent attorneys or agents;</li>
                <li>Does NOT provide comprehensive freedom-to-operate, patentability, or infringement analyses;</li>
                <li>Is NOT suitable as the sole basis for IP strategy, filing, or litigation decisions.</li>
              </ul>
            </Subsection>

            <Subsection title="2.2 No Warranty of Accuracy">
              <p>We make no representations or warranties regarding:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>The completeness, accuracy, or currency of patent and publication data;</li>
                <li>The correctness of trend analyses, IP overview information, or signal scores;</li>
                <li>The reliability of search results or semantic matching algorithms;</li>
                <li>The absence of errors, omissions, and/or data processing issues.</li>
              </ul>
              <p style={{ fontWeight: 600, marginTop: 12 }}>
                Patent and publication data may be incomplete, outdated, incorrectly parsed, or missing from Our database. Your use of the Service is at your own risk, and you are responsible for verifying all information through official avenues (this Service is not an official avenue).
              </p>
            </Subsection>

            <Subsection title="2.3 Limitation of Patent Coverage">
              <p>Our current dataset focuses on AI-related patents and publications based on specific CPC classifications and keyword matching. The Service:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Does NOT provide comprehensive coverage of all patent and publication data;</li>
                <li>May exclude relevant patents and publications due to classification or keyword limitations;</li>
                <li>May include false positives that do not relate to your specific interests;</li>
                <li>Updates on a periodic basis and is not real-time.</li>
              </ul>
            </Subsection>

            <Subsection title="2.4 No Guarantee of Service Availability">
              <p>
                We do not guarantee that the Service will be available at all times or will be error-free. The Service may experience downtime, data refresh delays, or temporary unavailability without notice.
              </p>
            </Subsection>
          </Section>

          <Section title="3. Account Registration and Security">
            <Subsection title="3.1 Account Creation">
              <p>To use certain features of the Service, you must register for an account. You agree to:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Provide accurate, current, and complete information during registration;</li>
                <li>Maintain and promptly update your account information;</li>
                <li>Keep your login credentials confidential;</li>
                <li>Notify Us immediately of any unauthorized use of your account;</li>
                <li>Be responsible for all activities that occur under your account.</li>
              </ul>
            </Subsection>

            <Subsection title="3.2 Account Eligibility">
              <p>You represent that:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>You are at least 18 years of age;</li>
                <li>You have the legal capacity to enter into these Terms;</li>
                <li>If registering on behalf of an organization, you have authority to bind that entity.</li>
              </ul>
            </Subsection>

            <Subsection title="3.3 Authentication">
              <p>
                We use Auth0 for authentication services. Your use of Auth0 is subject to Auth0's terms of service and privacy policy. We are not responsible for Auth0's services or any issues arising from authentication failures.
              </p>
            </Subsection>
          </Section>

          <Section title="4. Subscription Plans and Payment">
            <Subsection title="4.1 Beta Access">
              <p>
                During Our beta phase, We may offer access to the Service at reduced rates in exchange for feedback. Beta access may be limited, revoked at any time, and does not guarantee future free access.
              </p>
            </Subsection>

            <Subsection title="4.2 Paid Subscriptions">
              <p>When available, paid subscription tiers may provide:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Enhanced search capabilities;</li>
                <li>Increased alert limits;</li>
                <li>Bulk export features;</li>
                <li>Portfolio analysis tools;</li>
                <li>Priority support (where offered).</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                The above and other features are not guaranteed. Pricing, features, and availability of paid tiers will be displayed on Our website and are subject to change with notice.
              </p>
            </Subsection>

            <Subsection title="4.3 Payment Terms">
              <ul style={{ marginLeft: 20, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Billing Cycle</strong>: Subscriptions are billed monthly or annually based on your selected plan;</li>
                <li><strong>Payment Method</strong>: You authorize Us to charge your designated payment method (processed via Stripe or other payment processors) or previously used payment method;</li>
                <li><strong>Automatic Renewal</strong>: Subscriptions automatically renew unless canceled three business days before the renewal date;</li>
                <li><strong>Price Changes</strong>: We may modify subscription prices with at least ten days' notice. Notice will be deemed sufficient if provided via at least one of email notification or notification via the Service. Changes take effect on your next renewal date;</li>
                <li><strong>Taxes</strong>: Prices exclude applicable taxes and fees. You are responsible for applicable taxes and fees, which We agree to itemize on the notice of invoice or billing provided to you.</li>
              </ul>
            </Subsection>

            <Subsection title="4.4 Refund Policy">
              <ul style={{ marginLeft: 20, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Paid Subscriptions</strong>: Subscription fees are generally non-refundable. Refund requests for exceptional circumstances (e.g., service unavailability, billing errors) will be evaluated on a case-by-case basis;</li>
                <li><strong>Cancellation</strong>: You may cancel your subscription at any time. Access continues through the end of your current billing period.</li>
              </ul>
            </Subsection>

            <Subsection title="4.5 Failed Payments">
              <p>If payment fails:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>We will attempt to process payment again;</li>
                <li>We reserve the right to process payments that fail using payment method previously used by you to access the Service;</li>
                <li>Your access may be suspended after multiple failed attempts;</li>
                <li>Your account may be terminated after thirty days of non-payment;</li>
                <li>You remain responsible for any outstanding amounts owed;</li>
                <li>We reserve the right to sell or transfer any outstanding amounts owed without prior notification.</li>
              </ul>
            </Subsection>
          </Section>

          <Section title="5. Acceptable Use and Restrictions">
            <Subsection title="5.1 Permitted Uses">
              <p>You may use the Service for:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Internal business research and analysis;</li>
                <li>AI/ML IP landscape monitoring;</li>
                <li>Competitive intelligence gathering;</li>
                <li>R&D planning and IP overview review;</li>
                <li>Academic and research purposes.</li>
              </ul>
            </Subsection>

            <Subsection title="5.2 Prohibited Uses">
              <p>
                The Service and all associated data, including all data generated by the Service in response to any and all inputs (e.g., searches, trends, alerts, IP overview filters, etc.), are exclusively and wholly owned by the Company. You are granted a non-exclusive and non-transferable limited license to use this Service and associated data obtained through authorized avenues. You agree NOT to:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Use the Service to provide patent analysis services to third parties without a separate commercial license;</li>
                <li>Resell, redistribute, or sublicense access to the Service;</li>
                <li>Systematically scrape, download, or extract data beyond normal use;</li>
                <li>Reverse engineer, decompile, or attempt to discover source code;</li>
                <li>Use automated tools to access the Service;</li>
                <li>Interfere with or disrupt the Service's operation;</li>
                <li>Attempt to gain unauthorized access to Our systems;</li>
                <li>Use the Service for any illegal purpose;</li>
                <li>Violate any applicable laws or regulations;</li>
                <li>Impersonate others or misrepresent your affiliation.</li>
              </ul>
            </Subsection>

            <Subsection title="5.3 Automated or Agentic Access Prohibited">
              <p>
                The use of any automated, agentic, scripted, or programmatic means, including but not limited to scrapers, bots, spiders, or similar tools, to access and/or interact with the Service is strictly prohibited. All access and interaction with the Service must be manual and initiated by a human user through authorized interfaces provided by the Company.
              </p>
              <p style={{ marginTop: 8 }}>
                Any violation of this prohibition may result in immediate suspension or termination of your account and forfeiture of any fees or payments already remitted. We reserve the right to suspend any account We reasonably suspect of violating this restriction while We investigate the suspected conduct. No reimbursements, credits, or extensions will be provided for the duration of any suspension pending the outcome of Our investigation.
              </p>
            </Subsection>
          </Section>

          <Section title="6. Intellectual Property Rights">
            <Subsection title="6.1 Company IP">
              <p>
                The Service, including its software, algorithms, user interface, design, branding, and documentation, is owned by Phaethon Order LLC and is protected by copyright, trademark, and other intellectual property laws. You are granted a limited, non-exclusive, non-transferable license to access and use the Service in accordance with these Terms.
              </p>
            </Subsection>

            <Subsection title="6.2 Patent and Publication Data">
              <p>
                Patent and publication data in Our database is sourced from public repositories. We claim no ownership of the underlying original patent and publication documents. We hold an undivided proprietary ownership interest in:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Data aggregation, processing, and normalization;</li>
                <li>Semantic search algorithms and embeddings;</li>
                <li>Trend analysis and scoring methodologies;</li>
                <li>User interface and visualization tools;</li>
                <li>Other data generated by and/or accessed using the Service.</li>
              </ul>
            </Subsection>

            <Subsection title="6.3 User Content">
              <p>
                <strong>Saved Searches and Alerts</strong>: We retain ownership of saved search queries, alert configurations, and notes. You are granted a limited and non-transferrable license to use this information. We agree to hold this information in confidentiality, subject to Our obligations under the law, court order, or other legal order.
              </p>
              <p style={{ marginTop: 12 }}>
                <strong>Feedback</strong>: Any feedback, suggestions, or ideas you provide to Us become Our exclusive property, and We may use them without obligation or compensation to you.
              </p>
            </Subsection>

            <Subsection title="6.4 Trademarks">
              <p>
                "SynapseIP" and associated logos, branding, etc. are the exclusive property of Phaethon Order LLC. You may not use Our intellectual property without prior written permission. We are under no obligation to consent to the use of any intellectual property owned by Us.
              </p>
            </Subsection>
          </Section>

          <Section title="7. Privacy and Data Protection">
            <Subsection title="7.1 Privacy Policy">
              <p>
                Your use of the Service is subject to Our <a href="/docs/privacy" className="hover:underline" style={{ color: LINK_COLOR }}>Privacy Policy</a>, which describes how We collect, use, and protect your personal information.
              </p>
            </Subsection>

            <Subsection title="7.2 Data We Collect">
              <p>We collect:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Account information (e.g., name, email, organization, etc.);</li>
                <li>Usage data (searches, alerts, export requests, etc.);</li>
                <li>Authentication data (via Auth0);</li>
                <li>Payment information (processed by Stripe);</li>
                <li>Log data (e.g., IP addresses, browser and machine information, etc.);</li>
                <li>Performance and analytics data.</li>
              </ul>
            </Subsection>

            <Subsection title="7.3 Data Use">
              <p>We reserve the right to use your data to:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Provide and improve the Service;</li>
                <li>Send transactional communications (alerts, account notifications);</li>
                <li>Analyze usage patterns and improve features;</li>
                <li>Comply with legal obligations.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                We agree NOT to sell your data to any third party without prior authorization from you.
              </p>
            </Subsection>

            <Subsection title="7.4 Data Retention">
              <ul style={{ marginLeft: 20, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Account Data</strong>: Retained while your account is active and for a reasonable period after termination;</li>
                <li><strong>Usage Data</strong>: May be retained in anonymized form for analytics;</li>
                <li><strong>Deletion Requests</strong>: You may request account deletion by contacting <a href="mailto:admin@phaethonorder.com" className="hover:underline" style={{ color: LINK_COLOR }}>admin@phaethonorder.com</a>.</li>
              </ul>
            </Subsection>

            <Subsection title="7.5 Data Security">
              <p>
                We implement commercially reasonable security measures to protect your data. However, no system is completely secure. We cannot guarantee absolute security, and We are not liable for unauthorized access resulting from circumstances beyond Our control.
              </p>
            </Subsection>
          </Section>

          <Section title="8. Third-Party Services">
            <Subsection title="8.1 Dependencies">
              <p>The Service relies on third-party services, including:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Auth0</strong> (authentication);</li>
                <li><strong>Google BigQuery</strong> (patent and publication data source);</li>
                <li><strong>Render</strong> (backend web services);</li>
                <li><strong>Stripe</strong> (payment processing);</li>
                <li><strong>Vercel</strong> (hosting);</li>
                <li><strong>Neon.tech</strong> (database).</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                Your use of these services through SynapseIP is subject to their respective terms and privacy policies. We are not responsible for third-party service failures, changes, and/or discontinuations.
              </p>
            </Subsection>

            <Subsection title="8.2 External Links">
              <p>
                The Service may contain links to external patent databases (e.g., Google Patents, USPTO). We are not responsible for the content, accuracy, or availability of external sites.
              </p>
            </Subsection>
          </Section>

          <Section title="9. Warranties and Disclaimers">
            <Subsection title="9.1 Disclaimer of Warranties">
              <p style={{ fontWeight: 600 }}>
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT</strong>;</li>
                <li><strong>WARRANTIES REGARDING ACCURACY, COMPLETENESS, OR RELIABILITY OF DATA</strong>;</li>
                <li><strong>WARRANTIES THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE</strong>;</li>
                <li><strong>WARRANTIES THAT DEFECTS WILL BE CORRECTED</strong>.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                Some jurisdictions do not allow disclaimer of implied warranties, so the above may not apply to you in full.
              </p>
            </Subsection>

            <Subsection title="9.2 Service Limitations">
              <p>You acknowledge and agree that:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Patent data may contain errors, omissions, or delays;</li>
                <li>Search results may be incomplete or contain false positives;</li>
                <li>Trend analyses, overview information, and signals are algorithmic outputs, not expert opinions;</li>
                <li>The Service is not a substitute for professional patent analysis;</li>
                <li>We may modify, suspend, or discontinue features at any time without prior notification.</li>
              </ul>
            </Subsection>
          </Section>

          <Section title="10. Limitation of Liability">
            <Subsection title="10.1 Exclusion of Damages">
              <p style={{ fontWeight: 600 }}>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, PHAETHON ORDER LLC, ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES</strong>;</li>
                <li><strong>LOSS OF PROFITS, REVENUE, DATA, OR BUSINESS OPPORTUNITIES</strong>;</li>
                <li><strong>COST OF SUBSTITUTE SERVICES</strong>;</li>
                <li><strong>DAMAGES ARISING FROM YOUR USE OR INABILITY TO USE THE SERVICE</strong>;</li>
                <li><strong>DAMAGES ARISING FROM RELIANCE ON SERVICE DATA FOR PATENT DECISIONS</strong>;</li>
                <li><strong>DAMAGES ARISING FROM THIRD-PARTY SERVICES OR DATA SOURCES</strong>.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                This exclusion applies regardless of the legal theory (contract, tort, negligence, strict liability, or otherwise) and whether We were advised of the possibility of such damages.
              </p>
            </Subsection>

            <Subsection title="10.2 Liability Cap">
              <p style={{ fontWeight: 600 }}>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM OR RELATED TO THE SERVICE SHALL NOT EXCEED THE GREATER OF:
              </p>
              <ol style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>THE AMOUNT YOU PAID US IN THE MONTH(S) ASSOCIATED WITH THE CLAIM (NOT TO EXCEED TWELVE MONTHS)</strong>; OR</li>
                <li><strong>$100 USD</strong></li>
              </ol>
            </Subsection>

            <Subsection title="10.3 Essential Purpose">
              <p>
                You agree that these limitations are essential elements of the agreement between Us and that We would not provide the Service without these limitations.
              </p>
            </Subsection>

            <Subsection title="10.4 Jurisdictional Limitations">
              <p>
                Some jurisdictions do not allow limitation of liability for certain damages. In such jurisdictions, Our liability is limited to the maximum extent permitted by law.
              </p>
            </Subsection>
          </Section>

          <Section title="11. Indemnification">
            <p>
              You agree to indemnify, defend, and hold harmless Phaethon Order LLC, its affiliates, and their respective officers, directors, employees, contractors, and agents from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising from or related to:
            </p>
            <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
              <li>Your use of the Service;</li>
              <li>Your violation of these Terms or misuse of the Service;</li>
              <li>Your violation of any law or third-party rights;</li>
              <li>Your reliance on Service data for patent, business, or legal decisions;</li>
              <li>Any content you submit or actions you take through the Service;</li>
              <li>Your breach of any representations or warranties.</li>
            </ul>
            <p style={{ marginTop: 12 }}>
              We reserve the right to assume exclusive defense and control of any matter subject to indemnification, at your expense.
            </p>
          </Section>

          <Section title="12. Term and Termination">
            <Subsection title="12.1 Term">
              <p>These Terms remain in effect while you use the Service.</p>
            </Subsection>

            <Subsection title="12.2 Termination by You">
              <p>You may terminate your account at any time by:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Canceling your subscription through your account settings</li>
                <li>Contacting <a href="mailto:admin@phaethonorder.com" className="hover:underline" style={{ color: LINK_COLOR }}>admin@phaethonorder.com</a></li>
                <li>Ceasing to use the Service</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                Termination or cancellation do not entitle you to a refund of prepaid fees or remaining balance.
              </p>
            </Subsection>

            <Subsection title="12.3 Termination by Us">
              <p>We may suspend or terminate your access immediately, without notice, for any reason, including:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Your violation of these Terms;</li>
                <li>Your engagement in any prohibited and/or illegal activities;</li>
                <li>Account inactivity;</li>
                <li>Payment failures;</li>
                <li>Discontinuation, sale, or transfer of the Service;</li>
                <li>As required by law, legal order, court order, or other legal process;</li>
                <li>At the Company's discretion.</li>
              </ul>
            </Subsection>

            <Subsection title="12.4 Effect of Termination">
              <p>Upon termination:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Your right to access the Service immediately ceases</li>
                <li>We may delete your account data after a reasonable retention period</li>
                <li>Outstanding payment obligations survive termination</li>
                <li>Sections of these Terms that by their nature should survive (warranties, disclaimers, liability limitations, indemnification, dispute resolution) remain in effect</li>
              </ul>
            </Subsection>
          </Section>

          <Section title="13. Modifications to Terms">
            <Subsection title="13.1 Right to Modify">
              <p>We reserve the right to modify these Terms at any time. Changes may include:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Updates to features, pricing, or service descriptions;</li>
                <li>Modifications to legal provisions;</li>
                <li>Changes required by law or regulation.</li>
              </ul>
            </Subsection>

            <Subsection title="13.2 Notice of Changes">
              <p>We will provide notice of material changes by:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Posting updated Terms on Our website with a new "Last Updated" date;</li>
                <li>Sending email notification to your registered email address (for significant changes);</li>
                <li>Displaying an in-app notification upon your next login.</li>
              </ul>
            </Subsection>

            <Subsection title="13.3 Acceptance of Changes">
              <p>
                Continued use of the Service after changes take effect constitutes acceptance of the new Terms. If you do not agree to changes, you must discontinue use and may terminate your account.
              </p>
            </Subsection>
          </Section>

          <Section title="14. Dispute Resolution">
            <Subsection title="14.1 Governing Law">
              <p>
                Phaethon Order LLC is a registered commercial entity of the State of Wyoming in the United States. Accordingly, these Terms are governed by applicable federal laws of the United States and state laws of the State of Wyoming, without regard to conflict of law principles.
              </p>
            </Subsection>

            <Subsection title="14.2 Informal Resolution">
              <p>
                Before filing a claim, you agree to contact Us at <a href="mailto:admin@phaethonorder.com" className="hover:underline" style={{ color: LINK_COLOR }}>admin@phaethonorder.com</a> to attempt to resolve the dispute informally. We will make reasonable efforts to resolve disputes within ninety days.
              </p>
            </Subsection>

            <Subsection title="14.3 Arbitration Agreement">
              <p>
                For any dispute not resolved informally, you agree to submit to binding arbitration administered by the American Arbitration Association (AAA) under its Commercial Arbitration Rules. At the discretion of the Company, arbitration may be conducted in Wyoming, your state of residence, or another state. Each party bears its own costs unless otherwise awarded by the arbitrator. We reserve the right to resolve any conflict and seek reimbursement for any costs via arbitration. Arbitration is conducted only at the Company's discretion.
              </p>
              <p style={{ fontWeight: 600, marginTop: 12 }}>
                You agree to waive your right to a jury trial and to participate in class actions.
              </p>
            </Subsection>

            <Subsection title="14.4 Jurisdiction and Venue">
              <p>
                If arbitration does not apply or is invalid, you agree that any legal action must be brought exclusively in the state or federal courts located in Sheridan County, Wyoming, and you consent to personal jurisdiction in those courts.
              </p>
            </Subsection>

            <Subsection title="14.5 Exceptions">
              <p>
                We reserve the right to seek injunctive relief and/or other equitable remedies in state and/or federal court to prevent infringement of intellectual property rights and/or violation of these Terms and/or other terms governing your use of the Service.
              </p>
            </Subsection>
          </Section>

          <Section title="15. General Provisions">
            <Subsection title="15.1 Entire Agreement">
              <p>
                These Terms, together with Our Privacy Policy and other referenced policies, constitute the entire agreement between you and Us regarding the Service and supersede all prior agreements or understandings.
              </p>
            </Subsection>

            <Subsection title="15.2 Severability">
              <p>
                If any provision of these Terms is found unenforceable, the remaining provisions remain in full effect, and the unenforceable provision will be modified to the minimum extent necessary to make it enforceable.
              </p>
            </Subsection>

            <Subsection title="15.3 Waiver">
              <p>
                Our failure to enforce any provision of these Terms does not constitute a waiver of that provision or any other provision.
              </p>
            </Subsection>

            <Subsection title="15.4 Assignment">
              <p>
                You may not assign or transfer these Terms or your account without Our written consent. We may assign these Terms or transfer the Service to an affiliate or in connection with a merger, acquisition, or sale of assets.
              </p>
            </Subsection>

            <Subsection title="15.5 Force Majeure">
              <p>
                We are not liable for delays or failures in performance resulting from circumstances beyond Our reasonable control, including but not limited to natural disasters, war, terrorism, pandemics, internet outages, or third-party service failures.
              </p>
            </Subsection>

            <Subsection title="15.6 No Third-Party Beneficiaries">
              <p>
                These Terms do not create any third-party beneficiary rights except as expressly stated.
              </p>
            </Subsection>

            <Subsection title="15.7 Notices">
              <p>We may provide notices to you via:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Email to your registered email address;</li>
                <li>In-app notifications;</li>
                <li>Posting on Our website.</li>
              </ul>
              <p style={{ marginTop: 12 }}>You may contact Us at:</p>
              <p style={{ marginTop: 8, marginLeft: 20 }}>
                <strong>Phaethon Order LLC</strong><br />
                Email: <a href="mailto:admin@phaethonorder.com" className="hover:underline" style={{ color: LINK_COLOR }}>admin@phaethonorder.com</a><br />
                Website: <a href="https://phaethonorder.com" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://phaethonorder.com</a>
              </p>
            </Subsection>

            <Subsection title="15.8 Headings">
              <p>Section headings are for convenience only and do not affect interpretation.</p>
            </Subsection>

            <Subsection title="15.9 Language">
              <p>
                These Terms are drafted in English. Any translation is provided for convenience, and the English version controls in case of conflict.
              </p>
            </Subsection>

            <Subsection title="15.10 Export Compliance">
              <p>
                You agree to comply with all applicable export and import laws and regulations. You represent that you are not located in a country subject to U.S. government embargo or designated as a "terrorist supporting" country, and that you are not on any U.S. government list of prohibited or restricted parties.
              </p>
            </Subsection>
          </Section>

          <Section title="16. Contact Information">
            <p>For questions, concerns, or notices regarding these Terms, please contact:</p>
            <p style={{ marginTop: 12, marginLeft: 20 }}>
              <strong>Phaethon Order LLC</strong><br />
              Email: <a href="mailto:admin@phaethonorder.com" className="hover:underline" style={{ color: LINK_COLOR }}>admin@phaethonorder.com</a><br />
              Website: <a href="https://phaethonorder.com" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://phaethonorder.com</a>
            </p>
          </Section>

          <div
            style={{
              marginTop: 32,
              padding: 20,
              background: "rgba(107, 174, 219, 0.12)",
              borderRadius: 16,
              border: "1px solid rgba(107, 174, 219, 0.25)",
              boxShadow: "0 14px 26px rgba(107, 174, 219, 0.18)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <p style={{ fontWeight: 700, fontSize: 14, margin: 0, color: TEXT_COLOR }}>Acknowledgment</p>
            <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13, color: TEXT_COLOR }}>
              BY CLICKING "I AGREE," CREATING AN ACCOUNT, OR USING THE SERVICE, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS OF SERVICE.
            </p>
            <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13, fontWeight: 600, color: TEXT_COLOR }}>
              IF YOU DO NOT AGREE TO THESE TERMS, YOU MUST NOT ACCESS OR USE SynapseIP.
            </p>
          </div>

        </div>

      </div>
      <div className="glass-surface" style={surfaceStyle}>
        {/* Footer */}
        <footer style={footerStyle}>
          2026 © Phaethon Order LLC | <a href="mailto:admin@phaethonorder.com" target="_blank" rel="noopener noreferrer" className="text-[#312f2f] hover:underline hover:text-blue-400">admin@phaethonorder.com</a> | <a href="https://phaethonorder.com" target="_blank" rel="noopener noreferrer" className="text-[#312f2f] hover:underline hover:text-blue-400">phaethonorder.com</a> | <a href="/help" className="text-[#312f2f] hover:underline hover:text-blue-400">Help</a> | <a href="/docs" className="text-[#312f2f] hover:underline hover:text-blue-400">Legal</a>
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>{title}</h2>
      <div style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>{children}</div>
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 12 }}>{title}</h3>
      <div style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>{children}</div>
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
