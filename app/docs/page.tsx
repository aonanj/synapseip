// app/legal/page.tsx
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

export default function LegalIndexPage() {
  return (
    <div style={pageWrapperStyle}>
      <div className="glass-surface" style={surfaceStyle}>
        
        {/* Header */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: TEXT_COLOR }}>Legal Documentation</h1>
          <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 0 }}>
            Welcome to SynapseIP's legal resource center. Access and use of the SynapseIP Platform is governed by our Terms of Service. The resources provided here are freely accessible without a subscription. By subscribing to SynapseIP and using the Platform, you are agreeing to the Terms and accepting our Privacy Policy. We reserve the right to update these documents at our discretion without direct notification to users. Please review them periodically to stay informed of any changes.
          </p>
        </div>

        {/* Introduction */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Overview</h2>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 12 }}>
            SynapseIP is committed to transparency, data protection, and legal compliance. Login credentials and financial information (e.g., payment details for subscriptions) are handled through trusted third-party providers (i.e., Auth0 for authentication, Stripe for payment processing). SynapseIP does not store any user information beyond the minimum necessary to provide the service. The user information we do store is protected under our Privacy Policy, and will not be sold or otherwise shared with any third parties for advertising or marketing purposes. Please refer to the following key legal documents for further information:
          </p>
          <ul style={{ marginLeft: 20, marginTop: 12, fontSize: 14, lineHeight: 1.5, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
            <li><strong>Terms of Service</strong>: Governs use of the SynapseIP platform; outlines our duties and responsibilities; defines acceptable scope of use on the platform.</li>
            <li><strong>Privacy Policy</strong>: Explains how we collect, use, protect, and disseminate user information; outlines how to request a copy of your data and delete your data from our systems.</li>
            <li><strong>Data Processing Agreement</strong>: Defines data protection obligations for B2B customers where we process personal data on your behalf (required for GDPR/CCPA compliance).</li>
          </ul>
          <p style={{ marginTop: 16, fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 0 }}>
            These documents are effective as of <strong>October 17, 2025</strong> and apply to all users of the SynapseIP service.
          </p>
        </div>

        {/* Legal Documents Grid */}
        <div style={{ display: "grid", gap: 24 }}>
          
          {/* Terms of Service Card */}
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
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT_COLOR }}>Terms of Service</h3>
                <p style={{ marginTop: 8, fontSize: 13, color: "#627D98", marginBottom: 0 }}>
                  <strong>Last Updated</strong>: October 17, 2026
                </p>
              </div>
              <a
                href="/docs/tos"
                className="btn-modern"
                style={linkButtonStyle}
              >
                Read Document →
              </a>
            </div>
            
            <p style={{ marginTop: 20, fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 16 }}>
              The Terms of Service constitute a legally binding agreement between you and Phaethon Order LLC for use of the SynapseIP service. This document covers:
            </p>
            
            <div style={{ display: "grid", gap: 12 }}>
              <DetailItem icon="➣" title="Service Description" text="What SynapseIP provides and how it works" />
              <DetailItem icon="➣" title="Critical Disclaimers" text="NOT legal advice; no warranty of accuracy or completeness" />
              <DetailItem icon="➣" title="Account & Registration" text="Eligibility requirements, authentication, and account security" />
              <DetailItem icon="➣" title="Subscription & Payment" text="Pricing, billing, refunds, and cancellation policies" />
              <DetailItem icon="➣" title="Acceptable Use" text="Permitted and prohibited uses of the Service" />
              <DetailItem icon="➣" title="Intellectual Property" text="Ownership of Service, data, and user content" />
              <DetailItem icon="➣" title="Liability & Disputes" text="Limitation of liability, indemnification, and arbitration" />
            </div>

            <div
              style={{
                marginTop: 20,
                padding: 18,
                background: "rgba(107, 174, 219, 0.12)",
                borderRadius: 14,
                border: "1px solid rgba(107, 174, 219, 0.25)",
                boxShadow: "0 14px 26px rgba(107, 174, 219, 0.18)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, margin: 0 }}>
                <strong>Applicable To</strong>: All users of SynapseIP, without express or implied exception. A "user" is anyone accessing and navigating the SynapseIP platform, or the owner of any automated or agentic system that accesses and navigates the platform. Accessing and navigating the platform constitutes acceptance of these Terms.
              </p>
            </div>
          </div>

          {/* Privacy Policy Card */}
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
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT_COLOR }}>Privacy Policy</h3>
                <p style={{ marginTop: 8, fontSize: 13, color: "#627D98", marginBottom: 0 }}>
                  <strong>Last Updated</strong>: October 17, 2026
                </p>
              </div>
              <a
                href="/docs/privacy"
                className="btn-modern"
                style={linkButtonStyle}
              >
                Read Document →
              </a>
            </div>
            
            <p style={{ marginTop: 20, fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 16 }}>
              Our Privacy Policy explains how we collect, use, disclose, and protect your personal information when you use SynapseIP. This document covers:
            </p>
            
            <div style={{ display: "grid", gap: 12 }}>
              <DetailItem icon="➣" title="Information We Collect" text="Account data, usage data, technical data, and payment information" />
              <DetailItem icon="➣" title="How We Use Your Data" text="Service provision, payment processing, communications, and improvements" />
              <DetailItem icon="➣" title="Data Sharing" text="Service providers (Auth0, Stripe, Vercel, Neon.tech, etc.) and legal requirements" />
              <DetailItem icon="➣" title="Data Security" text="Encryption, access controls, monitoring, and breach notification" />
              <DetailItem icon="➣" title="International Transfers" text="Data processing in the United States with appropriate safeguards" />
              <DetailItem icon="➣" title="Cookies & Tracking" text="Types of cookies used and how to manage preferences" />
              <DetailItem icon="➣" title="Your Privacy Rights" text="Access, correction, deletion, portability, and opt-out rights (GDPR/CCPA)" />
            </div>

            <div
              style={{
                marginTop: 20,
                padding: 18,
                background: "rgba(107, 174, 219, 0.12)",
                borderRadius: 14,
                border: "1px solid rgba(107, 174, 219, 0.25)",
                boxShadow: "0 14px 26px rgba(107, 174, 219, 0.18)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, margin: 0 }}>
                <strong>Applicable To</strong>: All users. Our Privacy Policy includes various sections that are specific to certain jurisdictions, including sections for GDPR/CCPA compliance and sections for users located in the EEA, UK, Switzerland, California, and other jurisdictions with privacy laws. Your rights under our Privacy Policy are contingent upon your location when accessing and using the platform. Use of a VPN or similar technology to obscure your location constitutes waiver of any privacy rights specific to your actual jurisdiction and agreement to be treated under the laws and regulations of the state of Wyoming, United States.
              </p>
            </div>
          </div>

          {/* Data Processing Agreement Card */}
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
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT_COLOR }}>Data Processing Agreement (DPA)</h3>
                <p style={{ marginTop: 8, fontSize: 13, color: "#627D98", marginBottom: 0 }}>
                  <strong>Last Updated</strong>: October 17, 2026
                </p>
              </div>
              <a
                href="/docs/dpa"
                className="btn-modern"
                style={linkButtonStyle}
              >
                Read Document →
              </a>
            </div>
            
            <p style={{ marginTop: 20, fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, marginBottom: 16 }}>
              The Data Processing Agreement defines our obligations as a data processor when handling personal data on behalf of B2B customers (data controllers). This document covers:
            </p>
            
            <div style={{ display: "grid", gap: 12 }}>
              <DetailItem icon="➣" title="Controller-Processor Relationship" text="Roles, responsibilities, and processing instructions" />
              <DetailItem icon="➣" title="Processing Details" text="Subject matter, duration, types of data, and data subjects (Annex A)" />
              <DetailItem icon="➣" title="Security Measures" text="Technical and organizational safeguards to protect data (Annex B)" />
              <DetailItem icon="➣" title="Breach Notification" text="Procedures for reporting and responding to data breaches" />
              <DetailItem icon="➣" title="Data Subject Rights" text="Assistance with access, correction, deletion, and portability requests" />
              <DetailItem icon="➣" title="Sub-Processors" text="List of authorized third-party processors and notification rights (Annex C)" />
              <DetailItem icon="➣" title="International Transfers" text="Standard Contractual Clauses (SCCs) for EEA/UK/Swiss transfers (Annex D)" />
              <DetailItem icon="➣" title="Audit Rights" text="Customer rights to inspect and verify compliance" />
            </div>

            <div style={{ marginTop: 20, padding: 16, background: "#FFF4E6", borderRadius: 6, border: "1px solid #FFD666" }}>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, margin: 0 }}>
                <strong>Who Should Read This</strong>: <strong>B2B customers</strong> (companies, VCs, R&D teams, law firms) who process personal data of their employees/users through SynapseIP. Required for GDPR Article 28 compliance and enterprise contracts.
              </p>
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 18,
                background: "rgba(107, 174, 219, 0.12)",
                borderRadius: 14,
                border: "1px solid rgba(107, 174, 219, 0.25)",
                boxShadow: "0 14px 26px rgba(107, 174, 219, 0.18)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, margin: 0 }}>
                <strong>Note</strong>: Individual users who are not processing personal data on behalf of an organization typically do not need to review the DPA. The Privacy Policy and Terms of Service are sufficient for individual use cases.
              </p>
            </div>
          </div>

        </div>

        {/* Additional Information */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Important Information</h2>
          
          <div style={{ display: "grid", gap: 20 }}>
            <InfoSection 
              title="✧ Effective Date"
              content="All documents became effective on October 17, 2025. Continued use of the Service after this date constitutes acceptance of these terms."
            />
            
            <InfoSection 
              title="✧ Updates and Changes"
              content="We may update these documents from time to time to reflect changes in our practices, legal requirements, or service features. We reserve the right to update these documents at any time without prior notice."
            />
            
            <InfoSection 
              title="✧ Governing Law"
              content="These documents are governed by the laws of the State of Wyoming, United States, except where Data Protection Laws require application of specific jurisdictions (e.g., GDPR for EEA customers)."
            />
            
            <InfoSection 
              title="✧ Contact Us"
              content={
                <>
                  For questions, concerns, or requests regarding these legal documents, please contact:<br />
                  <strong>Email</strong>: <a href="mailto:admin@phaethonorder.com" className="hover:underline" style={{ color: LINK_COLOR }}>admin@phaethonorder.com</a><br />
                  <strong>Subject Line</strong>: Legal Inquiry<br />
                  <strong>Website</strong>: <a href="https://phaethonorder.com" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://phaethonorder.com</a>
                </>
              }
            />
            
            <InfoSection 
              title="✧ Multi-Jurisdictional Compliance"
              content="SynapseIP complies with data protection laws in multiple jurisdictions including GDPR (EEA), UK GDPR, Swiss FADP, CCPA/CPRA (California), and privacy laws in Virginia, Colorado, Connecticut, and Utah. Our legal framework is designed to meet the requirements of all applicable jurisdictions."
            />
            
            <InfoSection 
              title="✧ Document Versions"
              content={
                <>
                  We maintain an archive of prior versions of these documents. To request a previous version for reference or compliance purposes, please contact: <a href="mailto:admin@phaethonorder.com" className="hover:underline" style={{ color: LINK_COLOR }}>admin@phaethonorder.com</a>.
                </>
              }
            />
          </div>
        </div>

        {/* Quick Reference */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT_COLOR, marginBottom: 16 }}>Quick Reference Guide</h2>
          
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid rgba(148, 163, 184, 0.3)",
                  background: "rgba(148, 163, 184, 0.18)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
              >
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Documentation to...</th>
                <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Located at...</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: 12 }}>Understand your rights and obligations as a user</td>
                <td style={{ padding: 12 }}><a href="/docs/tos" className="hover:underline" style={{ color: LINK_COLOR, fontWeight: 600 }}>Terms of Service</a></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: 12 }}>Know what personal data we collect and how we use it</td>
                <td style={{ padding: 12 }}><a href="/docs/privacy" className="hover:underline" style={{ color: LINK_COLOR, fontWeight: 600 }}>Privacy Policy</a></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: 12 }}>Understand pricing, billing, and refund policies</td>
                <td style={{ padding: 12 }}><a href="/docs/tos" className="hover:underline" style={{ color: LINK_COLOR, fontWeight: 600 }}>Terms of Service (Section 4)</a></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: 12 }}>Exercise your data privacy rights (access, deletion, etc.)</td>
                <td style={{ padding: 12 }}><a href="/docs/privacy" className="hover:underline" style={{ color: LINK_COLOR, fontWeight: 600 }}>Privacy Policy (Section 9)</a></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: 12 }}>Ensure GDPR/CCPA compliance for your organization</td>
                <td style={{ padding: 12 }}><a href="/docs/dpa" className="hover:underline" style={{ color: LINK_COLOR, fontWeight: 600 }}>Data Processing Agreement</a></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: 12 }}>See our list of third-party service providers (sub-processors)</td>
                <td style={{ padding: 12 }}><a href="/docs/dpa#annex-c" className="hover:underline" style={{ color: LINK_COLOR, fontWeight: 600 }}>DPA Annex C (Sub-processors)</a></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: 12 }}>Review our security measures and practices</td>
                <td style={{ padding: 12 }}><a href="/docs/dpa#annex-b" className="hover:underline" style={{ color: LINK_COLOR, fontWeight: 600 }}>DPA Annex B (Security Measures)</a></td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: 12 }}>Understand international data transfer safeguards</td>
                <td style={{ padding: 12 }}><a href="/docs/dpa#annex-d" className="hover:underline" style={{ color: LINK_COLOR, fontWeight: 600 }}>DPA Annex D (Standard Contractual Clauses)</a></td>
              </tr>
              <tr>
                <td style={{ padding: 12 }}>Find out what happens to your data when you cancel</td>
                <td style={{ padding: 12 }}><a href="/docs/dpa" className="hover:underline" style={{ color: LINK_COLOR, fontWeight: 600 }}>DPA (Section 4.6) & <a href="/docs/privacy" className="hover:underline" style={{ color: LINK_COLOR, fontWeight: 600 }}>Privacy Policy (Section 5)</a></a></td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer style={footerStyle}>
          2026 © Phaethon Order LLC | <a href="mailto:admin@phaethonorder.com" target="_blank" rel="noopener noreferrer" className="text-[#312f2f] hover:underline hover:text-blue-400">admin@phaethonorder.com</a> | <a href="https://phaethonorder.com" target="_blank" rel="noopener noreferrer" className="text-[#312f2f] hover:underline hover:text-blue-400">phaethonorder.com</a> | <a href="/help" className="text-[#312f2f] hover:underline hover:text-blue-400">Help</a> | <a href="/docs" className="text-[#312f2f] hover:underline hover:text-blue-400">Legal</a>
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

function InfoSectionTwo({ title, content }: { title: string; content: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>{content}</p>
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
