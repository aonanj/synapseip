// app/docs/privacy/page.tsx
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

export default function PrivacyPolicyPage() {
  return (
    <div style={pageWrapperStyle}>
      <div className="glass-surface" style={surfaceStyle}>
        
        {/* Header */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: TEXT_COLOR }}>SynapseIP Privacy Policy</h1>
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
          
          <Section title="Introduction">
            <p>
              Phaethon Order LLC ("<strong>Company</strong>," "<strong>We</strong>," "<strong>Us</strong>," or "<strong>Our</strong>") operates the SynapseIP service (the "<strong>Service</strong>"), accessible at <a href="https://www.synapse-ip.com/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://www.synapse-ip.com/</a>. This Privacy Policy explains how We collect, use, disclose, and protect your personal information when you use the Service.
            </p>
            <p style={{ fontWeight: 600, marginTop: 16 }}>
              By using SynapseIP, you agree to the collection and use of information in accordance with this Privacy Policy.
            </p>
            <p>
              If you do not agree with Our policies and practices, do not use the Service.
            </p>
            <p>
              This Privacy Policy should be read in conjunction with Our <a href="/docs" className="hover:underline" style={{ color: LINK_COLOR }}>Terms of Service</a>. Capitalized terms not defined in this Privacy Policy have the meanings given in the Terms of Service.
            </p>
          </Section>

          <Section title="1. Information We Collect">
            <p>We collect several types of information from and about users of Our Service.</p>

            <Subsection title="1.1 Information You Provide Directly">
              <p><strong>Account Registration Information</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Email address;</li>
                <li>Full name and/or organization/company name;</li>
                <li>Password (stored securely via Auth0).</li>
              </ul>

              <p style={{ marginTop: 12 }}><strong>Subscription and Payment Information</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Billing address;</li>
                <li>Payment method details (processed and stored by Stripe; We do not store complete credit card numbers);</li>
                <li>Purchase history and transaction records.</li>
              </ul>

              <p style={{ marginTop: 12 }}><strong>User-Generated Content</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Saved search queries and filters;</li>
                <li>Custom alert configurations;</li>
                <li>CPC classification preferences;</li>
                <li>Semantic search descriptions;</li>
                <li>Notes or annotations (if feature is enabled);</li>
                <li>Feedback or support communications.</li>
              </ul>

              <p style={{ marginTop: 12 }}><strong>Communications</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Messages sent to admin@phaethonorder.com;</li>
                <li>Survey responses or feedback submissions;</li>
                <li>Any other correspondence with Us.</li>
              </ul>
            </Subsection>

            <Subsection title="1.2 Information Collected Automatically">
              <p><strong>Usage Data</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Search queries (keywords, semantic descriptions, etc.);</li>
                <li>Patents and publications viewed and interactions;</li>
                <li>Features used (search, trends, IP overview, exports, etc.);</li>
                <li>Alert configuration and triggering events;</li>
                <li>Time spent on platform and session duration;</li>
                <li>Navigation paths and click patterns.</li>
              </ul>

              <p style={{ marginTop: 12 }}><strong>Technical Data</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>IP address;</li>
                <li>Browser type and version;</li>
                <li>Device type and operating system;</li>
                <li>Referring/exit pages and URLs;</li>
                <li>Date and time stamps;</li>
                <li>Cookies and similar tracking technologies (see Section 8).</li>
              </ul>

              <p style={{ marginTop: 12 }}><strong>Authentication Data</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Login timestamps;</li>
                <li>Authentication method (e.g., email/password);</li>
                <li>Session tokens (stored temporarily);</li>
                <li>Failed login attempts.</li>
              </ul>
            </Subsection>

            <Subsection title="1.3 Information from Third-Party Sources">
              <p><strong>Auth0 Authentication</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Authentication tokens and security credentials</li>
              </ul>

              <p style={{ marginTop: 12 }}><strong>Payment Processors (Stripe)</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Payment success/failure status;</li>
                <li>Billing disputes or chargebacks;</li>
                <li>Fraud detection signals.</li>
              </ul>

              <p style={{ marginTop: 12 }}><strong>Public Patent Databases</strong>:</p>
              <p>
                We access and process patent data from Google Patents (BigQuery), USPTO, Espacenet, and other public sources. This data is not "personal information" as it relates to published patent and publication documents, not individual users.
              </p>
            </Subsection>

            <Subsection title="1.4 Information We Do NOT Collect">
              <p>We do not collect sensitive personal information such as:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Social Security numbers;</li>
                <li>Financial account numbers (beyond payment processing);</li>
                <li>Health or medical information;</li>
                <li>Biometric data;</li>
                <li>Precise geolocation (we may derive approximate location from IP address);</li>
                <li>Children's personal information (see Section 11).</li>
              </ul>
            </Subsection>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use the information We collect for the following purposes:</p>

            <Subsection title="2.1 To Provide and Maintain the Service">
              <ul style={{ marginLeft: 20, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Create and manage your user account;</li>
                <li>Authenticate your identity and authorize access;</li>
                <li>Process searches and generate results;</li>
                <li>Deliver trend analysis and IP overview information;</li>
                <li>Send automated patent alerts based on your configurations;</li>
                <li>Generate and deliver export files (CSV, PDF);</li>
                <li>Provide customer support and respond to inquiries;</li>
                <li>Store and maintain your preferences and settings.</li>
              </ul>
            </Subsection>

            <Subsection title="2.2 To Process Payments and Subscriptions">
              <ul style={{ marginLeft: 20, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Process subscription payments and manage billing;</li>
                <li>Detect and prevent payment fraud;</li>
                <li>Send billing statements and payment confirmations;</li>
                <li>Manage subscription renewals and cancellations;</li>
                <li>Calculate and charge applicable taxes.</li>
              </ul>
            </Subsection>

            <Subsection title="2.3 To Communicate with You">
              <ul style={{ marginLeft: 20, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Send transactional emails (account creation, password resets, alert notifications, etc.);</li>
                <li>Provide customer support responses;</li>
                <li>Send service announcements and updates;</li>
                <li>Notify you of changes to Terms of Service or Privacy Policy;</li>
                <li>Respond to your inquiries and requests.</li>
              </ul>
            </Subsection>

            <Subsection title="2.4 To Improve and Develop the Service">
              <ul style={{ marginLeft: 20, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Analyze usage patterns and feature adoption;</li>
                <li>Identify bugs, errors, and performance issues;</li>
                <li>Test new features and conduct A/B testing;</li>
                <li>Develop machine learning models for semantic search improvements;</li>
                <li>Optimize search algorithms and relevance ranking;</li>
                <li>Improve user interface, user experience, and overall design.</li>
              </ul>
            </Subsection>

            <Subsection title="2.5 For Security and Fraud Prevention">
              <ul style={{ marginLeft: 20, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Detect and prevent unauthorized access;</li>
                <li>Monitor for suspicious activity and abuse;</li>
                <li>Investigate security incidents;</li>
                <li>Enforce Our Terms of Service;</li>
                <li>Comply with legal obligations and protect legal rights.</li>
              </ul>
            </Subsection>

            <Subsection title="2.6 For Marketing and Analytics (With Your Consent)">
              <ul style={{ marginLeft: 20, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Send promotional emails about new features or offerings (you may opt out);</li>
                <li>Conduct user surveys and research;</li>
                <li>Generate aggregated analytics reports (anonymized);</li>
                <li>Understand demographic trends and user preferences.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                We do NOT sell your personal information to third parties without prior authorization from you.
              </p>
            </Subsection>
          </Section>

          <Section title="3. Legal Bases for Processing (GDPR)">
            <p>
              If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, We process your personal information based on the following legal grounds:
            </p>
            <p style={{ marginTop: 12 }}>
              <strong>Contractual Necessity</strong>: Processing is necessary to perform Our contract with you (providing the Service as described in Our Terms of Service).
            </p>
            <p style={{ marginTop: 12 }}>
              <strong>Legitimate Interests</strong>: We have legitimate interests in:
            </p>
            <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
              <li>Improving and developing the Service;</li>
              <li>Detecting and preventing fraud and security threats;</li>
              <li>Analyzing usage to enhance user experience;</li>
              <li>Marketing Our services to existing users.</li>
            </ul>
            <p style={{ marginTop: 12 }}>
              <strong>Consent</strong>: Where required by law, We obtain your explicit consent for:
            </p>
            <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
              <li>Marketing communications;</li>
              <li>Non-essential cookies and tracking;</li>
              <li>Processing sensitive data (if applicable).</li>
            </ul>
            <p style={{ marginTop: 12 }}>
              <strong>Legal Obligations</strong>: We may process your data to comply with legal requirements, such as:
            </p>
            <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
              <li>Tax and accounting obligations;</li>
              <li>Responding to lawful government requests;</li>
              <li>Enforcing Our legal rights.</li>
            </ul>
            <p style={{ marginTop: 12 }}>
              You have the right to object to processing based on legitimate interests or to withdraw consent at any time (see Section 9).
            </p>
          </Section>

          <Section title="4. How We Share Your Information">
            <p>We do not sell or rent your personal information. We share information only in the following circumstances:</p>

            <Subsection title="4.1 With Service Providers and Business Partners">
              <p>We engage trusted third-party service providers to perform functions on Our behalf:</p>
              
              <p style={{ marginTop: 12 }}><strong>Infrastructure and Hosting</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Vercel</strong> (web hosting and deployment): <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://vercel.com/legal/privacy-policy</a></li>
                <li><strong>Neon.tech</strong> (PostgreSQL database hosting): <a href="https://neon.tech/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://neon.tech/privacy-policy</a></li>
              </ul>

              <p style={{ marginTop: 12 }}><strong>Authentication</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Auth0</strong> (identity and access management): <a href="https://auth0.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://auth0.com/privacy</a></li>
              </ul>

              <p style={{ marginTop: 12 }}><strong>Payment Processing</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Stripe</strong> (payment gateway and billing): <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://stripe.com/privacy</a></li>
              </ul>

              <p style={{ marginTop: 12 }}><strong>Email Delivery</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Mailgun</strong> (transactional email and alert delivery): <a href="https://www.mailgun.com/legal/privacy-policy/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://www.mailgun.com/legal/privacy-policy/</a></li>
              </ul>

              <p style={{ marginTop: 12 }}><strong>AI and Machine Learning</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>AI embeddings generation</strong> (text embeddings for semantic search): <a href="https://openai.com/privacy/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://openai.com/privacy/</a></li>
              </ul>
              <p style={{ marginLeft: 40, marginTop: 4, fontSize: 13 }}>
                Note: We send patent titles, abstracts, and claims text to a third-party API for embedding generation. No personal user data is sent to the API.
              </p>

              <p style={{ marginTop: 12 }}><strong>Analytics and Monitoring</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Google Analytics (analytics and performance monitoring): <a href="https://policies.google.com/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://policies.google.com/</a></li>
              </ul>

              <p style={{ marginTop: 12 }}>
                These providers have access to your information only to perform tasks on Our behalf and are obligated to protect it and not use it for other purposes.
              </p>
            </Subsection>

            <Subsection title="4.2 For Legal Reasons">
              <p>We may disclose your information if required by law or in good faith belief that such action is necessary to:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Comply with legal process (e.g., subpoena, court order, government request, etc.);</li>
                <li>Enforce Our Terms of Service or other agreements;</li>
                <li>Protect the rights, property, or safety of Phaethon Order LLC, Our users, or the public;</li>
                <li>Detect, prevent, or address fraud, security, or technical issues;</li>
                <li>Respond to claims of intellectual property infringement.</li>
              </ul>
            </Subsection>

            <Subsection title="4.3 Business Transfers">
              <p>
                If We are involved in a merger, acquisition, asset sale, bankruptcy, or other business transaction, your information may be transferred as part of that transaction. We will notify you via email and/or prominent notice on Our website before your information becomes subject to a different privacy policy.
              </p>
            </Subsection>

            <Subsection title="4.4 With Your Consent">
              <p>
                We may share information with third parties when you explicitly consent or direct us to do so.
              </p>
            </Subsection>

            <Subsection title="4.5 Aggregated or De-Identified Data">
              <p>
                We may share aggregated, anonymized, or de-identified information that cannot reasonably be used to identify you. For example:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>"SynapseIP users searched for X CPC classification Y times this month";</li>
                <li>Aggregated trend reports for industry research.</li>
              </ul>
            </Subsection>
          </Section>

          <Section title="5. Data Retention">
            <p>
              We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law.
            </p>
            <ul style={{ marginLeft: 20, marginTop: 12, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
              <li><strong>Account Data</strong>: Retained while your account is active and for up to 2 years after account closure to comply with legal obligations and resolve disputes.</li>
              <li><strong>Usage and Search Data</strong>: Retained for up to 3 years to analyze trends and improve the Service. May be anonymized and retained indefinitely for analytics.</li>
              <li><strong>Payment Records</strong>: Retained for 7 years to comply with tax and accounting regulations.</li>
              <li><strong>Communication Records</strong>: Support emails and correspondence retained for 3 years for quality assurance and legal compliance.</li>
              <li><strong>Cookies and Logs</strong>: Technical logs retained for 180 days; analytics cookies as described in Our cookie settings.</li>
              <li><strong>Deleted Account Data</strong>: Upon account deletion, We will:
                <ul style={{ marginLeft: 20, marginTop: 4, listStyleType: "circle" }}>
                  <li>Immediately revoke access to the Service;</li>
                  <li>Delete or anonymize personal information within 30 days, except where retention is required by law;</li>
                  <li>Retain transaction records as required by financial regulations.</li>
                </ul>
              </li>
            </ul>
            <p style={{ marginTop: 12 }}>
              You may request deletion of your data at any time (see Section 9).
            </p>
          </Section>

          <Section title="6. Data Security">
            <p>
              We implement commercially reasonable technical, administrative, and physical security measures to protect your personal information from unauthorized access, disclosure, alteration, or destruction.
            </p>

            <Subsection title="6.1 Security Measures">
              <p><strong>Technical Safeguards</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Encryption in transit (TLS/SSL) for all data transmission;</li>
                <li>Encryption at rest for database storage (pgvector in Neon.tech);</li>
                <li>Secure password hashing (via Auth0);</li>
                <li>Regular security patches and updates;</li>
                <li>Access controls and authentication requirements.</li>
              </ul>

              <p style={{ marginTop: 12 }}><strong>Administrative Safeguards</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Limited employee access to personal data (need-to-know basis);</li>
                <li>Confidentiality agreements with employees and contractors;</li>
                <li>Security training for personnel;</li>
                <li>Incident response procedures.</li>
              </ul>

              <p style={{ marginTop: 12 }}><strong>Physical Safeguards</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Secure data centers with restricted physical access (provided by hosting partners);</li>
                <li>Environmental controls and redundancy systems.</li>
              </ul>
            </Subsection>

            <Subsection title="6.2 Third-Party Security">
              <p>
                Our service providers (Auth0, Stripe, Vercel, Neon.tech, etc.) maintain industry-standard security certifications such as SOC 2, ISO 27001, and PCI DSS (for payment processing).
              </p>
            </Subsection>

            <Subsection title="6.3 Limitations">
              <p style={{ fontWeight: 600 }}>
                No system is completely secure.
              </p>
              <p>
                While We strive to protect your personal information, We cannot guarantee absolute security. You are responsible for:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Maintaining the confidentiality of your password;</li>
                <li>Using a strong, unique password;</li>
                <li>Logging out after using shared devices;</li>
                <li>Notifying us immediately of any suspected unauthorized access.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                <strong>In the event of a data breach</strong> that affects your personal information, We will notify you and relevant authorities as required by applicable law.
              </p>
            </Subsection>
          </Section>

          <Section title="7. International Data Transfers">
            <p>
              SynapseIP is operated from the United States. If you are accessing the Service from outside the United States, please be aware that your information may be transferred to, stored, and processed in the United States and other countries where Our service providers operate.
            </p>

            <Subsection title="7.1 Adequacy and Safeguards">
              <p>
                The United States and other countries may not have the same data protection laws as your jurisdiction. We take steps to ensure adequate protection of your information when transferred internationally:
              </p>
              
              <p style={{ marginTop: 12 }}><strong>For EEA/UK/Swiss Users</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>We rely on Standard Contractual Clauses (SCCs) approved by the European Commission when transferring data to countries without adequacy decisions;</li>
                <li>Our service providers (e.g., Auth0 and Stripe) have implemented appropriate safeguards for international transfers;</li>
                <li>You have the right to request information about the safeguards We use (see Section 9).</li>
              </ul>

              <p style={{ marginTop: 12 }}><strong>For All International Users</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>By using the Service, you consent to the transfer of your information to the United States and other countries as necessary to provide the Service.</li>
              </ul>
            </Subsection>
          </Section>

          <Section title="8. Cookies and Tracking Technologies">
            <p>
              We use cookies and similar tracking technologies to collect information and improve your experience.
            </p>

            <Subsection title="8.1 Cookies, Definition">
              <p>
                Cookies are small text files stored on your device by your web browser. They allow us to recognize your browser and capture certain information.
              </p>
            </Subsection>

            <Subsection title="8.2 Types of Cookies We Use">
              <p><strong>Essential Cookies (Strictly Necessary)</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Authentication and session management;</li>
                <li>Security and fraud prevention;</li>
                <li>Load balancing and performance;</li>
                <li>These cannot be disabled without affecting functionality.</li>
              </ul>

              <p style={{ marginTop: 12 }}><strong>Analytics Cookies (Performance)</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Usage statistics and traffic analysis;</li>
                <li>Feature adoption and user behavior tracking;</li>
                <li>Error monitoring and debugging;</li>
                <li>Google Analytics.</li>
              </ul>

              <p style={{ marginTop: 12 }}><strong>Preference Cookies (Functionality)</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Remember your settings and choices;</li>
                <li>Language preferences;</li>
                <li>Display preferences;</li>
                <li>Other preferences and/or settings.</li>
              </ul>

              <p style={{ marginTop: 12 }}><strong>Marketing Cookies (Targeting/Advertising)</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Deliver targeted advertising;</li>
                <li>Measure campaign effectiveness;</li>
                <li>We currently do NOT use marketing cookies. However, We reserve the right to implement marketing cookies without prior notification.</li>
              </ul>
            </Subsection>

            <Subsection title="8.3 Third-Party Cookies">
              <p>Some cookies are placed by third-party services:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Auth0</strong>: Authentication and security;</li>
                <li><strong>Stripe</strong>: Payment processing and fraud detection;</li>
                <li><strong>Google Analytics</strong>: Usage tracking and analytics.</li>
              </ul>
            </Subsection>

            <Subsection title="8.4 Cookie Management">
              <p><strong>Browser Controls</strong>: Most browsers allow you to:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>View and delete cookies;</li>
                <li>Block third-party cookies;</li>
                <li>Receive warnings before cookies are stored;</li>
                <li>Disable cookies entirely (may impact functionality).</li>
              </ul>

              <p style={{ marginTop: 12 }}><strong>Opt-Out Tools</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Google Analytics Opt-out: <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://tools.google.com/dlpage/gaoptout/</a></li>
                <li>Industry opt-out tools: <a href="http://optout.aboutads.info/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>http://optout.aboutads.info/</a> or <a href="http://www.youronlinechoices.eu/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>http://www.youronlinechoices.eu/</a></li>
              </ul>
            </Subsection>

            <Subsection title="8.5 Do Not Track">
              <p>
                Some browsers support "Do Not Track" (DNT) signals. We currently do not respond to DNT signals, as there is no industry standard for handling them. We will update this policy if standards are established.
              </p>
            </Subsection>
          </Section>

          <Section title="9. Your Privacy Rights">
            <p>Depending on your location, you may have the following rights regarding your personal information:</p>

            <Subsection title="9.1 Rights for All Users">
              <ul style={{ marginLeft: 20, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Access</strong>: Request a copy of the personal information We hold about you;</li>
                <li><strong>Correction</strong>: Request correction of inaccurate or incomplete information;</li>
                <li><strong>Deletion</strong>: Request deletion of your personal information (subject to legal retention requirements);</li>
                <li><strong>Portability</strong>: Request a copy of your data in a structured, machine-readable format;</li>
                <li><strong>Opt-Out of Marketing</strong>: Unsubscribe from promotional emails (transactional emails cannot be opted out);</li>
                <li><strong>Account Closure</strong>: Close your account at any time through account settings or by contacting support.</li>
              </ul>
            </Subsection>

            <Subsection title="9.2 Additional Rights for EEA/UK/Swiss Users (GDPR)">
              <ul style={{ marginLeft: 20, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Right to Object</strong>: Object to processing based on legitimate interests;</li>
                <li><strong>Right to Restrict Processing</strong>: Request limitation of processing under certain circumstances;</li>
                <li><strong>Right to Withdraw Consent</strong>: Withdraw consent for processing based on consent (does not affect prior processing);</li>
                <li><strong>Right to Lodge a Complaint</strong>: File a complaint with your local data protection authority (see Section 9.7);</li>
                <li><strong>Right to Information about Safeguards</strong>: Request information about safeguards for international data transfers.</li>
              </ul>
            </Subsection>

            <Subsection title="9.3 Additional Rights for California Residents (CCPA/CPRA)">
              <p>California residents have additional rights under the California Consumer Privacy Act (CCPA) and California Privacy Rights Act (CPRA):</p>
              
              <p style={{ marginTop: 12 }}><strong>Right to Know</strong>: Request disclosure of:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Categories of personal information collected;</li>
                <li>Categories of sources;</li>
                <li>Business purposes for collection;</li>
                <li>Categories of third parties with whom information is shared;</li>
                <li>Specific pieces of information collected.</li>
              </ul>

              <ul style={{ marginLeft: 20, marginTop: 12, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Right to Delete</strong>: Request deletion of personal information (subject to exceptions);</li>
                <li><strong>Right to Opt-Out of Sale/Sharing</strong>: We do NOT sell personal information, but if practices change, you can opt out;</li>
                <li><strong>Right to Correct</strong>: Request correction of inaccurate information;</li>
                <li><strong>Right to Limit Use of Sensitive Personal Information</strong>: We do not process sensitive personal information beyond what is necessary for the Service;</li>
                <li><strong>Right to Non-Discrimination</strong>: You will not receive discriminatory treatment for exercising your privacy rights;</li>
                <li><strong>Authorized Agents</strong>: You may designate an authorized agent to make requests on your behalf.</li>
              </ul>
            </Subsection>

            <Subsection title="9.4 Additional Rights for Other Jurisdictions">
              <p>
                <strong>Virginia (VCDPA), Colorado (CPA), Connecticut (CTDPA), Utah (UCPA)</strong>: Similar rights to CCPA (access, correction, deletion, opt-out of targeted advertising and sale);
              </p>
              <p style={{ marginTop: 8 }}>
                <strong>Other States</strong>: We extend similar rights to residents of all U.S. states where applicable.
              </p>
            </Subsection>

            <Subsection title="9.5 How to Exercise Your Rights">
              <p>To exercise any of these rights, please:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Email</strong>: <a href="mailto:admin@phaethonorder.com" className="hover:underline" style={{ color: TEXT_COLOR }}>admin@phaethonorder.com</a> with "Privacy Request" in the subject line;</li>
                <li><strong>Account Settings</strong>: Some rights can be exercised directly through your account dashboard (e.g., update information, download data, delete account, etc.);</li>
                <li><strong>Required Information</strong>: To verify your identity, We may request:
                  <ul style={{ marginLeft: 20, marginTop: 4, listStyleType: "circle" }}>
                    <li>Email address associated with your account;</li>
                    <li>Account details or recent transaction information;</li>
                    <li>Government-issued ID (in limited circumstances for sensitive requests).</li>
                  </ul>
                </li>
              </ul>
            </Subsection>

            <Subsection title="9.6 Response Timeframe">
              <p>We will respond to your request within:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>30 days</strong> (GDPR/EEA/UK);</li>
                <li><strong>45 days</strong> (CCPA/California), with possible 45-day extension if needed;</li>
                <li><strong>60 days</strong> (other U.S. state laws).</li>
              </ul>
              <p style={{ marginTop: 8 }}>
                We will notify you if We need additional time or information.
              </p>
            </Subsection>

            <Subsection title="9.7 Supervisory Authority Contact (EEA/UK/Swiss)">
              <p>
                If you are located in the EEA, UK, or Switzerland, you have the right to lodge a complaint with your local data protection authority:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>EEA</strong>: Find your authority at <a href="https://edpb.europa.eu/about-edpb/board/members_en" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://edpb.europa.eu/about-edpb/board/members_en/</a></li>
                <li><strong>UK</strong>: Information Commissioner's Office (ICO) -- <a href="https://ico.org.uk/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://ico.org.uk/</a></li>
                <li><strong>Switzerland</strong>: Federal Data Protection and Information Commissioner (FDPIC) -- <a href="https://www.edoeb.admin.ch/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://www.edoeb.admin.ch/</a></li>
              </ul>
            </Subsection>
          </Section>

          <Section title="10. Marketing Communications">
            <Subsection title="10.1 Types of Communications">
              <p><strong>Transactional Emails (Cannot Opt Out)</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Account creation and verification;</li>
                <li>Password resets and security alerts;</li>
                <li>Alert notifications (based on your saved queries);</li>
                <li>Subscription and billing confirmations;</li>
                <li>Service announcements and critical updates;</li>
                <li>Customer support responses.</li>
              </ul>

              <p style={{ marginTop: 12 }}><strong>Marketing Emails (Can Opt Out)</strong>:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Product updates and new feature announcements;</li>
                <li>Educational content and best practices;</li>
                <li>Special offers or promotions;</li>
                <li>User surveys and feedback requests.</li>
              </ul>
            </Subsection>

            <Subsection title="10.2 Opting Out">
              <ul style={{ marginLeft: 20, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Unsubscribe Link</strong>: Click the "unsubscribe" link at the bottom of any marketing email;</li>
                <li><strong>Account Settings</strong>: Manage email preferences in your account dashboard;</li>
                <li><strong>Email Us</strong>: Send opt-out request to <a href="mailto:admin@phaethonorder.com" className="hover:underline" style={{ color: LINK_COLOR }}>admin@phaethonorder.com</a>;</li>
                <li><strong>Timeframe</strong>: We will process opt-out requests within 10 business days;</li>
                <li><strong>Note</strong>: Opting out of marketing does not affect transactional emails necessary for the Service.</li>
              </ul>
            </Subsection>
          </Section>

          <Section title="11. Children's Privacy">
            <p>
              SynapseIP is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children under 18.
            </p>
            <p>
              If you are a parent or guardian and believe your child has provided us with personal information, please contact us at <a href="mailto:admin@phaethonorder.com" className="hover:underline" style={{ color: LINK_COLOR }}>admin@phaethonorder.com</a>. We will delete such information promptly upon verification.
            </p>
            <p>
              In accordance with the Children's Online Privacy Protection Act (COPPA), We do not knowingly collect information from children under 13.
            </p>
          </Section>

          <Section title="12. Changes to This Privacy Policy">
            <p>
              We may update this Privacy Policy from time to time to reflect changes in Our practices, technology, legal requirements, or other factors.
            </p>

            <Subsection title="12.1 Notice of Changes">
              <p><strong>Material Changes</strong>: We will notify you of material changes by:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Sending email notification to your registered email address;</li>
                <li>Posting a prominent notice on Our website;</li>
                <li>Displaying an in-app notification upon your next login.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                <strong>Effective Date</strong>: The "Last Updated" date at the top of this policy will be revised. Changes take effect on the date posted unless otherwise stated.
              </p>
            </Subsection>

            <Subsection title="12.2 Your Consent">
              <p>
                Continued use of the Service after changes take effect constitutes acceptance of the revised Privacy Policy. If you do not agree to changes, you must discontinue use and may request account deletion.
              </p>
            </Subsection>

            <Subsection title="12.3 Prior Versions">
              <p>
                We maintain an archive of prior policy versions. Contact us to request a previous version for reference.
              </p>
            </Subsection>
          </Section>

          <Section title="13. California 'Shine the Light' Law">
            <p>
              California Civil Code Section 1798.83 permits California residents to request information about disclosure of personal information to third parties for direct marketing purposes.
            </p>
            <p style={{ fontWeight: 600, marginTop: 12 }}>
              We do not share personal information with third parties for their direct marketing purposes without your explicit consent.
            </p>
            <p>
              If you are a California resident and have questions, contact <a href="mailto:admin@phaethonorder.com" className="hover:underline" style={{ color: LINK_COLOR }}>admin@phaethonorder.com</a> with "California Shine the Light Request" in the subject line.
            </p>
          </Section>

          <Section title="14. Nevada Privacy Rights">
            <p>
              Nevada residents have the right to opt out of the sale of certain covered personal information.
            </p>
            <p style={{ fontWeight: 600 }}>
              We do not sell personal information as defined under Nevada law.
            </p>
            <p>
              If Our practices change, Nevada residents will be provided an opportunity to opt out.
            </p>
          </Section>

          <Section title="15. Third-Party Links and Services">
            <p>The Service may contain links to external websites, patent databases, or third-party services:</p>
            <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
              <li><strong>Google Patents</strong> (<a href="https://patents.google.com/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://patents.google.com/</a>)</li>
              <li><strong>USPTO</strong> (<a href="https://www.uspto.gov/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://www.uspto.gov/</a>)</li>
              <li><strong>Espacenet</strong> (<a href="https://worldwide.espacenet.com/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://worldwide.espacenet.com/</a>)</li>
              <li>Other patent office databases</li>
            </ul>
            <p style={{ fontWeight: 600, marginTop: 12 }}>
              We are not responsible for the privacy practices of third-party websites.
            </p>
            <p>
              We encourage you to read the privacy policies of any site you visit.
            </p>
            <p>
              This Privacy Policy applies only to information collected by SynapseIP.
            </p>
          </Section>

          <Section title="16. Data Controller and Contact Information">
            <p>For the purposes of data protection laws:</p>
            <p style={{ marginTop: 12, marginLeft: 20 }}>
              <strong>Data Controller</strong>:<br />
              Phaethon Order LLC<br />
              Email: <a href="mailto:admin@phaethonorder.com" className="hover:underline" style={{ color: LINK_COLOR }}>admin@phaethonorder.com</a><br />
              Website: <a href="https://phaethonorder.com" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://phaethonorder.com</a>
            </p>
            <p style={{ marginTop: 12 }}>
              <strong>Privacy Questions</strong>: For any questions, concerns, or requests regarding this Privacy Policy or Our data practices, please contact:
            </p>
            <p style={{ marginTop: 8, marginLeft: 20 }}>
              <strong>Email</strong>: <a href="mailto:admin@phaethonorder.com" className="hover:underline" style={{ color: LINK_COLOR }}>admin@phaethonorder.com</a><br />
              <strong>Subject Line</strong>: Privacy Inquiry<br />
              <strong>Response Time</strong>: We aim to respond within 5 business days
            </p>
          </Section>

          <Section title="17. Additional Disclosures">
            <Subsection title="17.1 Patent Data Processing">
              <p>
                <strong>Public Patent Information</strong>: SynapseIP processes publicly available patent data from government databases. This data (patent and publication titles, abstracts, claims, inventor names, assignee names) is not "personal information" under most privacy laws, as it relates to published patent documents.
              </p>
              <p style={{ marginTop: 12 }}>
                <strong>Your Search Data</strong>: Your search queries, saved alerts, and usage patterns ARE personal information and are protected under this Privacy Policy.
              </p>
            </Subsection>

            <Subsection title="17.2 AI and Machine Learning">
              <p>
                We use a third-party API for embedding models to enable semantic search functionality. Patent and publication text (titles, abstracts, claims) is sent to the API to generate vector embeddings.
              </p>
              <p style={{ fontWeight: 600, marginTop: 8 }}>
                We do not send your personal information, account details, or identifiable search queries to the API.
              </p>
            </Subsection>

            <Subsection title="17.3 Data Anonymization">
              <p>
                We may anonymize or aggregate your information for research, analytics, or product improvement. Anonymized data cannot reasonably be used to identify you and is not subject to this Privacy Policy.
              </p>
            </Subsection>

            <Subsection title="17.4 Accuracy of Information">
              <p>
                We rely on you to provide accurate information. If your information changes, please update your account settings promptly.
              </p>
            </Subsection>
          </Section>

          <Section title="18. Dispute Resolution">
            <ul style={{ marginLeft: 20, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
              <li><strong>Informal Resolution</strong>: Contact <a href="mailto:admin@phaethonorder.com" className="hover:underline" style={{ color: LINK_COLOR }}>admin@phaethonorder.com</a> to attempt to resolve concerns;</li>
              <li><strong>Arbitration/Jurisdiction</strong>: Subject to the dispute resolution provisions in Our <a href="/docs" className="hover:underline" style={{ color: LINK_COLOR }}>Terms of Service</a>;</li>
              <li><strong>Regulatory Complaints</strong>: You may file complaints with applicable data protection authorities (see Section 9.7).</li>
            </ul>
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
            <p style={{ fontWeight: 700, fontSize: 14, margin: 0, color: TEXT_COLOR }}>Summary of Key Points</p>
            <table style={{ width: "100%", marginTop: 12, fontSize: 13, borderCollapse: "collapse" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "8px 0", fontWeight: 600, verticalAlign: "top" }}>What We Collect</td>
                  <td style={{ padding: "8px 0" }}>Account information, usage data, payment information, search queries, technical data</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "8px 0", fontWeight: 600, verticalAlign: "top" }}>How We Use It</td>
                  <td style={{ padding: "8px 0" }}>Provide the Service, process payments, send alerts, improve features, support users</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "8px 0", fontWeight: 600, verticalAlign: "top" }}>Who We Share With</td>
                  <td style={{ padding: "8px 0" }}>Service providers (Auth0, Stripe, Vercel, Render), legal authorities (when required)</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "8px 0", fontWeight: 600, verticalAlign: "top" }}>Your Rights</td>
                  <td style={{ padding: "8px 0" }}>Access, correct, delete, opt out, portability (varies by location)</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "8px 0", fontWeight: 600, verticalAlign: "top" }}>Data Security</td>
                  <td style={{ padding: "8px 0" }}>Encryption, access controls, secure infrastructure, third-party certifications</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "8px 0", fontWeight: 600, verticalAlign: "top" }}>Retention</td>
                  <td style={{ padding: "8px 0" }}>While account active + up to 2-7 years depending on data type</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "8px 0", fontWeight: 600, verticalAlign: "top" }}>Contact</td>
                  <td style={{ padding: "8px 0" }}>admin@phaethonorder.com</td>
                </tr>
                <tr>
                  <td style={{ padding: "8px 0", fontWeight: 600, verticalAlign: "top" }}>We Do NOT</td>
                  <td style={{ padding: "8px 0" }}>Collect data from children, sell or share your data with marketers without your consent</td>
                </tr>
              </tbody>
            </table>
          </div>

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
            <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13, fontWeight: 600, color: TEXT_COLOR }}>
              BY USING SynapseIP, YOU ACKNOWLEDGE THAT YOU HAVE READ AND UNDERSTOOD THIS PRIVACY POLICY AND AGREE TO ITS TERMS.
            </p>
            <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13, color: TEXT_COLOR }}>
              If you do not agree with this Privacy Policy, please do not use the Service.
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
