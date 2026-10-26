// app/docs/dpa/page.tsx
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

export default function DataProcessingAgreementPage() {
  return (
    <div style={pageWrapperStyle}>
      <div className="glass-surface" style={surfaceStyle}>
        
        {/* Header */}
        <div className="glass-card" style={{ ...cardBaseStyle }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: TEXT_COLOR }}>SynapseIP Data Processing Agreement</h1>
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
          
          <Section title="Introduction and Agreement">
            <p>
              This Data Processing Agreement ("<strong>DPA</strong>") forms part of the <a href="/docs" className="hover:underline" style={{ color: LINK_COLOR }}>Terms of Service</a> between you (the "<strong>Customer</strong>" or "<strong>Data Controller</strong>") and Phaethon Order LLC ("<strong>Company</strong>," "<strong>Processor</strong>," "<strong>We</strong>," "<strong>Us</strong>," or "<strong>Our</strong>") for the use of the SynapseIP service (the "<strong>Service</strong>").
            </p>
            <p style={{ marginTop: 16 }}>
              This DPA governs the processing of Personal Data (as defined below) by the Company on behalf of the Customer in connection with the Service. This DPA reflects the parties' agreement on the terms governing the processing of Personal Data in compliance with applicable Data Protection Laws.
            </p>
            <p style={{ fontWeight: 600, marginTop: 16 }}>
              BY USING THE SERVICE, YOU AGREE TO THE TERMS OF THIS DPA. This DPA is automatically incorporated into and forms part of the Terms of Service between the parties.
            </p>
            <p style={{ marginTop: 16 }}>
              If there is a conflict between this DPA and the Terms of Service, this DPA shall prevail to the extent of the conflict with respect to the processing of Personal Data.
            </p>
          </Section>

          <Section title="1. Definitions">
            <p>Capitalized terms used but not defined in this DPA have the meanings set forth in the Terms of Service. The following definitions apply:</p>
            
            <div style={{ marginTop: 16 }}>
              <p><strong>"Affiliate"</strong> means any entity that directly or indirectly controls, is controlled by, or is under common control with a party.</p>
              
              <p style={{ marginTop: 12 }}><strong>"Authorized Sub-processor"</strong> means a third party authorized by the Company to process Personal Data in accordance with Section 6 of this DPA.</p>
              
              <p style={{ marginTop: 12 }}><strong>"Customer Data"</strong> means all data, content, and information submitted, uploaded, or transmitted by or on behalf of the Customer or its Authorized Users through the Service, including Personal Data.</p>
              
              <p style={{ marginTop: 12 }}><strong>"Data Protection Laws"</strong> means all applicable laws and regulations relating to the processing of Personal Data, including but not limited to:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>General Data Protection Regulation (EU) 2016/679 ("<strong>GDPR</strong>");</li>
                <li>UK General Data Protection Regulation and Data Protection Act 2018 ("<strong>UK GDPR</strong>");</li>
                <li>Swiss Federal Act on Data Protection ("<strong>FADP</strong>");</li>
                <li>California Consumer Privacy Act of 2018, as amended by the California Privacy Rights Act ("<strong>CCPA/CPRA</strong>");</li>
                <li>Virginia Consumer Data Protection Act ("<strong>VCDPA</strong>");</li>
                <li>Colorado Privacy Act ("<strong>CPA</strong>");</li>
                <li>Connecticut Data Privacy Act ("<strong>CTDPA</strong>");</li>
                <li>Utah Consumer Privacy Act ("<strong>UCPA</strong>");</li>
                <li>Any other applicable federal, state, provincial, or international data protection legislation.</li>
              </ul>
              
              <p style={{ marginTop: 12 }}><strong>"Data Subject"</strong> means an identified or identifiable natural person whose Personal Data is processed under this DPA. For the purposes of this DPA, Data Subjects include Customer's employees, contractors, agents, consultants, and authorized users of the Service ("<strong>Authorized Users</strong>").</p>
              
              <p style={{ marginTop: 12 }}><strong>"EEA"</strong> means the European Economic Area.</p>
              
              <p style={{ marginTop: 12 }}><strong>"Personal Data"</strong> means any information relating to an identified or identifiable natural person that is processed by the Company on behalf of the Customer in connection with the Service. Personal Data includes but is not limited to:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Account holder names and email addresses;</li>
                <li>Organization or company names and details;</li>
                <li>User-generated content including saved search queries, alert configurations, and notes;</li>
                <li>Usage data and activity logs;</li>
                <li>IP addresses and technical identifiers;</li>
                <li>Payment and billing information;</li>
                <li>Communications with the Company.</li>
              </ul>
              <p style={{ marginLeft: 20, marginTop: 8, fontSize: 13 }}>
                <strong>Note</strong>: Personal Data does NOT include publicly available patent and publication data (titles, abstracts, claims, inventor names, assignee names) sourced from government databases, as this information does not relate to Customer's Data Subjects.
              </p>
              
              <p style={{ marginTop: 12 }}><strong>"Personal Data Breach"</strong> means a breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, Personal Data transmitted, stored, or otherwise processed.</p>
              
              <p style={{ marginTop: 12 }}><strong>"Processing"</strong> (and "<strong>Process</strong>," "<strong>Processes</strong>," or "<strong>Processed</strong>") means any operation or set of operations performed on Personal Data, whether or not by automated means, including collection, recording, organization, structuring, storage, adaptation, retrieval, consultation, use, disclosure, dissemination, restriction, erasure, or destruction.</p>
              
              <p style={{ marginTop: 12 }}><strong>"Standard Contractual Clauses"</strong> or "<strong>SCCs</strong>" means:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>For EEA/UK transfers: the standard contractual clauses approved by the European Commission pursuant to Decision 2021/914 (Module Two: Controller to Processor), as may be amended or replaced;</li>
                <li>For Swiss transfers: the Swiss Federal Data Protection and Information Commissioner's approved standard contractual clauses or equivalent mechanisms;</li>
                <li>For UK transfers: the International Data Transfer Agreement or Addendum issued by the UK Information Commissioner's Office.</li>
              </ul>
              
              <p style={{ marginTop: 12 }}><strong>"Supervisory Authority"</strong> means an independent public authority established by a Member State of the EEA, the UK, or Switzerland pursuant to applicable Data Protection Laws.</p>
            </div>
          </Section>

          <Section title="2. Scope and Roles">
            <Subsection title="2.1 Relationship of the Parties">
              <p>
                The parties acknowledge and agree that with respect to the Processing of Personal Data under this DPA:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Customer is the Data Controller, determining the purposes and means of Processing Personal Data;</li>
                <li>Company is the Data Processor, Processing Personal Data on behalf of and in accordance with Customer's documented instructions;</li>
                <li>Each party shall comply with the obligations applicable to it under applicable Data Protection Laws.</li>
              </ul>
            </Subsection>

            <Subsection title="2.2 Scope of Processing">
              <p>The Company shall Process Personal Data only:</p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>To provide the Service as described in the Terms of Service;</li>
                <li>As necessary to comply with applicable laws;</li>
                <li>In accordance with Customer's documented instructions as set forth in this DPA and the Terms of Service;</li>
                <li>As otherwise agreed in writing between the parties.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                The Company shall not Process Personal Data for any other purpose or in a manner inconsistent with Customer's instructions without Customer's prior written consent, except where required by applicable law (in which case, the Company shall inform Customer of such legal requirement before Processing, unless prohibited by law).
              </p>
            </Subsection>

            <Subsection title="2.3 Customer Instructions">
              <p>
                Customer instructs the Company to Process Personal Data as follows:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Nature and Purpose</strong>: To provide the Service, including patent search, trend analysis, alert delivery, data export, and customer support;</li>
                <li><strong>Duration</strong>: For the term of the Terms of Service and as required for data retention obligations;</li>
                <li><strong>Types of Personal Data</strong>: As specified in Annex A (Details of Processing);</li>
                <li><strong>Categories of Data Subjects</strong>: Customer's employees, contractors, consultants, and Authorized Users;</li>
                <li><strong>Additional Instructions</strong>: Customer may issue additional written instructions through the Service interface (e.g., data export requests, deletion requests) or by contacting <a href="mailto:admin@phaethonorder.com" className="hover:underline" style={{ color: LINK_COLOR }}>admin@phaethonorder.com</a>.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                If the Company believes that an instruction from Customer infringes applicable Data Protection Laws, it shall promptly inform Customer and may suspend performance of the instruction until Customer confirms or modifies it.
              </p>
            </Subsection>

            <Subsection title="2.4 Compliance with Laws">
              <p>
                Each party represents and warrants that it shall comply with its respective obligations under applicable Data Protection Laws. Customer is solely responsible for:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Ensuring that it has obtained all necessary consents and provided all required notices to Data Subjects for the Processing contemplated by this DPA;</li>
                <li>Ensuring that the Processing instructions it provides to Company comply with applicable Data Protection Laws;</li>
                <li>Determining the lawful basis for Processing under applicable Data Protection Laws;</li>
                <li>Conducting any required data protection impact assessments.</li>
              </ul>
            </Subsection>
          </Section>

          <Section title="3. Details of Processing">
            <p>
              The subject matter, duration, nature, and purpose of the Processing, the types of Personal Data, and categories of Data Subjects are further described in <strong>Annex A</strong> attached to this DPA.
            </p>
          </Section>

          <Section title="4. Company Obligations">
            <Subsection title="4.1 Confidentiality">
              <p>
                The Company shall ensure that all persons authorized to Process Personal Data:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Are subject to a duty of confidentiality (whether by contract or statutory obligation);</li>
                <li>Have received appropriate training on Data Protection Laws and data security;</li>
                <li>Process Personal Data only as necessary to perform the Service or as instructed by Customer.</li>
              </ul>
            </Subsection>

            <Subsection title="4.2 Security Measures">
              <p>
                The Company shall implement and maintain appropriate technical and organizational measures to protect Personal Data against Personal Data Breaches, taking into account:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>The state of the art;</li>
                <li>The costs of implementation;</li>
                <li>The nature, scope, context, and purposes of Processing;</li>
                <li>The risks to the rights and freedoms of Data Subjects.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                The security measures implemented by the Company are described in <strong>Annex B</strong> (Security Measures) and include at minimum:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Encryption of Personal Data in transit (TLS 1.2 or higher) and at rest;</li>
                <li>Access controls and authentication mechanisms (including multi-factor authentication);</li>
                <li>Regular security testing and vulnerability assessments;</li>
                <li>Logging and monitoring of access to Personal Data;</li>
                <li>Secure backup and disaster recovery procedures;</li>
                <li>Physical security controls for data center facilities;</li>
                <li>Incident response and breach notification procedures;</li>
                <li>Regular security awareness training for personnel.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                The Company shall regularly review and update these security measures as necessary to maintain a level of security appropriate to the risk.
              </p>
            </Subsection>

            <Subsection title="4.3 Personal Data Breach Notification">
              <p>
                The Company shall notify Customer without undue delay after becoming aware of a Personal Data Breach, and in any event:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Within 72 hours of becoming aware of the breach (or as soon as reasonably practicable);</li>
                <li>Via email to Customer's registered email address and/or other contact methods on file;</li>
                <li>Including, to the extent possible, the following information:
                  <ul style={{ marginLeft: 20, marginTop: 4, listStyleType: "circle" }}>
                    <li>Description of the nature of the breach;</li>
                    <li>Categories and approximate number of Data Subjects affected;</li>
                    <li>Categories and approximate number of Personal Data records affected;</li>
                    <li>Likely consequences of the breach;</li>
                    <li>Measures taken or proposed to address the breach and mitigate harm;</li>
                    <li>Contact information for further inquiries.</li>
                  </ul>
                </li>
              </ul>
              <p style={{ marginTop: 12 }}>
                The Company shall:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Provide reasonable assistance to Customer in fulfilling Customer's obligations to notify Supervisory Authorities and Data Subjects of the breach;</li>
                <li>Take reasonable steps to remediate the breach and prevent future breaches;</li>
                <li>Not publicly disclose any Personal Data Breach without Customer's prior written consent, except as required by applicable law;</li>
                <li>Cooperate with Customer's investigation and remediation efforts.</li>
              </ul>
            </Subsection>

            <Subsection title="4.4 Assistance with Data Subject Rights">
              <p>
                The Company shall, taking into account the nature of the Processing, provide reasonable assistance to Customer in responding to requests from Data Subjects exercising their rights under Data Protection Laws, including:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Right of access;</li>
                <li>Right to rectification;</li>
                <li>Right to erasure ("right to be forgotten");</li>
                <li>Right to restrict Processing;</li>
                <li>Right to data portability;</li>
                <li>Right to object to Processing;</li>
                <li>Rights related to automated decision-making and profiling.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                If the Company receives a request directly from a Data Subject, the Company shall:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Promptly notify Customer of the request within 5 business days;</li>
                <li>Not respond to the Data Subject except as instructed by Customer or as required by law;</li>
                <li>Cooperate with Customer to facilitate Customer's response within applicable timeframes.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                The Company may charge reasonable fees for assistance with complex or repeated Data Subject requests, as mutually agreed in writing.
              </p>
            </Subsection>

            <Subsection title="4.5 Assistance with Compliance Obligations">
              <p>
                The Company shall provide reasonable assistance to Customer, at Customer's expense, in ensuring compliance with Customer's obligations under Data Protection Laws, including:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Data protection impact assessments (DPIAs);</li>
                <li>Prior consultations with Supervisory Authorities;</li>
                <li>Security audits and certifications;</li>
                <li>Responding to inquiries from Supervisory Authorities;</li>
                <li>Documentation of Processing activities.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                Such assistance shall be subject to reasonable notice and scheduling, and the Company may charge fees for extensive or time-consuming assistance.
              </p>
            </Subsection>

            <Subsection title="4.6 Deletion or Return of Personal Data">
              <p>
                Upon termination or expiration of the Terms of Service, or upon Customer's written request, the Company shall, at Customer's option:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Delete</strong> all Personal Data and existing copies in the Company's systems within 30 days; OR</li>
                <li><strong>Return</strong> all Personal Data to Customer in a commonly used, machine-readable format within 30 days.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                The Company may retain Personal Data to the extent required by applicable law, provided that the Company ensures the confidentiality of such Personal Data and Processes it only as necessary to comply with legal obligations.
              </p>
              <p style={{ marginTop: 12 }}>
                Upon completion of deletion or return, the Company shall provide written certification to Customer confirming compliance with this section.
              </p>
            </Subsection>

            <Subsection title="4.7 Records and Audits">
              <p>
                The Company shall maintain records of all Processing activities carried out on behalf of Customer, including:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Name and contact details of the Company and Customer;</li>
                <li>Categories of Processing;</li>
                <li>Categories of Data Subjects and Personal Data;</li>
                <li>Authorized Sub-processors;</li>
                <li>International data transfers and safeguards;</li>
                <li>Security measures implemented.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                <strong>Audit Rights</strong>: The Company shall, upon Customer's written request and subject to reasonable notice (at least 30 days), allow Customer (or Customer's independent third-party auditor bound by confidentiality obligations) to:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Inspect the Company's relevant Processing facilities, systems, and records;</li>
                <li>Conduct audits to verify compliance with this DPA;</li>
                <li>Review certifications, audit reports (e.g., SOC 2, ISO 27001), or other compliance documentation.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                Audit rights are subject to the following conditions:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Audits shall be conducted no more than once per year unless required by a Supervisory Authority or in response to a Personal Data Breach;</li>
                <li>Audits shall be conducted during regular business hours and shall not unreasonably interfere with the Company's operations;</li>
                <li>Customer shall bear all costs associated with audits;</li>
                <li>Auditors shall execute confidentiality agreements acceptable to the Company;</li>
                <li>The Company may provide existing audit reports, certifications, or summaries in lieu of on-site inspections where such documentation is reasonably sufficient to demonstrate compliance.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                In the event that an audit reveals non-compliance with this DPA, the Company shall promptly implement corrective measures at its own expense.
              </p>
            </Subsection>
          </Section>

          <Section title="5. Customer Obligations">
            <Subsection title="5.1 Lawfulness of Instructions">
              <p>
                Customer represents and warrants that:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>It has obtained all necessary consents, authorizations, and lawful bases for Processing Personal Data;</li>
                <li>Its Processing instructions comply with applicable Data Protection Laws;</li>
                <li>It has provided all required notices to Data Subjects regarding the Processing;</li>
                <li>It shall not instruct the Company to Process Personal Data in violation of Data Protection Laws.</li>
              </ul>
            </Subsection>

            <Subsection title="5.2 Accuracy of Personal Data">
              <p>
                Customer is responsible for ensuring that Personal Data provided to the Company is accurate, complete, and up-to-date. The Company is not responsible for the accuracy or quality of Personal Data provided by Customer.
              </p>
            </Subsection>

            <Subsection title="5.3 Security of Customer Systems">
              <p>
                Customer is responsible for:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Maintaining the security of its own systems, networks, and credentials;</li>
                <li>Ensuring that Authorized Users comply with security requirements;</li>
                <li>Promptly notifying the Company of any suspected unauthorized access;</li>
                <li>Implementing appropriate security measures for its own environment.</li>
              </ul>
            </Subsection>

            <Subsection title="5.4 Cooperation">
              <p>
                Customer shall:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Respond promptly to the Company's requests for information or clarification regarding Processing instructions;</li>
                <li>Cooperate with the Company in responding to Data Subject requests and Supervisory Authority inquiries;</li>
                <li>Notify the Company of any changes that may affect the Processing of Personal Data.</li>
              </ul>
            </Subsection>
          </Section>

          <Section title="6. Sub-Processing">
            <Subsection title="6.1 Authorization of Sub-processors">
              <p>
                Customer authorizes the Company to engage Authorized Sub-processors to Process Personal Data on Customer's behalf, subject to the terms of this DPA. The Company's current list of Authorized Sub-processors is set forth in <strong>Annex C</strong> (List of Sub-processors).
              </p>
            </Subsection>

            <Subsection title="6.2 Sub-processor Requirements">
              <p>
                The Company shall:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Enter into written agreements with each Authorized Sub-processor imposing data protection obligations substantially equivalent to those in this DPA;</li>
                <li>Ensure that Authorized Sub-processors comply with the same data protection obligations as the Company;</li>
                <li>Remain fully liable to Customer for the performance of each Authorized Sub-processor's obligations.</li>
              </ul>
            </Subsection>

            <Subsection title="6.3 Changes to Sub-processors">
              <p>
                The Company may engage new Sub-processors or replace existing Sub-processors from time to time. The Company shall:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Provide Customer with at least 30 days' advance written notice of any intended changes to Sub-processors via email or notification through the Service;</li>
                <li>Update Annex C to reflect any changes;</li>
                <li>Provide Customer an opportunity to object to the engagement of a new Sub-processor.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                <strong>Customer's Right to Object</strong>: Customer may object to the engagement of a new Sub-processor on reasonable grounds relating to data protection by notifying the Company in writing within 30 days of receiving notice. If Customer objects:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>The parties shall work together in good faith to resolve Customer's concerns;</li>
                <li>If the parties cannot reach a resolution within 30 days, Customer may terminate the affected portion of the Service without penalty by providing written notice to the Company.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                If Customer does not object within the 30-day notice period, Customer shall be deemed to have accepted the new Sub-processor.
              </p>
            </Subsection>

            <Subsection title="6.4 Sub-processor List">
              <p>
                The current list of Authorized Sub-processors is available in <strong>Annex C</strong> and may be updated at <a href="https://www.synapse-ip.com/docs/dpa#annex-c" className="hover:underline" style={{ color: LINK_COLOR }}>https://www.synapse-ip.com/docs/dpa#annex-c</a>.
              </p>
            </Subsection>
          </Section>

          <Section title="7. International Data Transfers">
            <Subsection title="7.1 Transfers Outside the EEA/UK/Switzerland">
              <p>
                Customer acknowledges that the Company and its Sub-processors may transfer and Process Personal Data in countries outside the EEA, UK, and Switzerland, including the United States. The Company shall ensure that such transfers are conducted in accordance with applicable Data Protection Laws.
              </p>
            </Subsection>

            <Subsection title="7.2 Transfer Mechanisms">
              <p>
                For transfers of Personal Data from the EEA, UK, or Switzerland to countries without an adequacy decision, the Company shall implement appropriate safeguards, including:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Standard Contractual Clauses (SCCs)</strong>: The parties agree that the applicable Standard Contractual Clauses (set forth in <strong>Annex D</strong>) are incorporated into this DPA and apply to all transfers of Personal Data from the EEA/UK/Switzerland to the Company or its Sub-processors;</li>
                <li><strong>Binding Corporate Rules</strong>: Where applicable and available;</li>
                <li><strong>Other legally recognized mechanisms</strong>: Including approved certifications or codes of conduct;</li>
                <li><strong>Supplementary measures</strong>: Additional technical and organizational measures where necessary to ensure adequate protection (e.g., encryption, pseudonymization).</li>
              </ul>
            </Subsection>

            <Subsection title="7.3 U.S. Government Access">
              <p>
                Customer acknowledges that the Company's infrastructure is primarily located in the United States and that U.S. law enforcement and intelligence agencies may have access to Personal Data under certain circumstances (e.g., pursuant to lawful requests under FISA or other U.S. laws).
              </p>
              <p style={{ marginTop: 12 }}>
                The Company commits to:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Implementing supplementary security measures (encryption, access controls, etc.) to minimize risks;</li>
                <li>Challenging disproportionate or unlawful data requests where feasible;</li>
                <li>Notifying Customer of any government data requests unless legally prohibited;</li>
                <li>Providing an annual transparency report summarizing any government requests received.</li>
              </ul>
            </Subsection>

            <Subsection title="7.4 Additional Safeguards">
              <p>
                The Company shall, in relation to international transfers:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Use encryption (in transit and at rest) to protect Personal Data;</li>
                <li>Implement strict access controls limiting access to Personal Data;</li>
                <li>Conduct regular security assessments and audits;</li>
                <li>Maintain compliance with relevant certifications (e.g., SOC 2, ISO 27001);</li>
                <li>Cooperate with Customer in conducting transfer impact assessments (TIAs) as required under Data Protection Laws.</li>
              </ul>
            </Subsection>
          </Section>

          <Section title="8. Liability and Indemnification">
            <Subsection title="8.1 Allocation of Liability">
              <p>
                Each party shall be liable for its own breaches of this DPA and applicable Data Protection Laws. The Company shall be liable for damages caused by Processing Personal Data in violation of this DPA or applicable Data Protection Laws, except where the Company can prove it was not responsible for the event giving rise to the damage.
              </p>
            </Subsection>

            <Subsection title="8.2 Sub-processor Liability">
              <p>
                The Company is fully liable to Customer for the performance of any Authorized Sub-processor's obligations under this DPA. The Company's liability for Sub-processor acts or omissions is the same as for its own acts or omissions.
              </p>
            </Subsection>

            <Subsection title="8.3 Limitation of Liability">
              <p>
                Notwithstanding any provision in the Terms of Service, the liability caps and exclusions in the Terms of Service do NOT apply to:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>The Company's obligations under this DPA related to Personal Data Breaches;</li>
                <li>Violations of Data Protection Laws;</li>
                <li>Claims brought by Data Subjects or Supervisory Authorities;</li>
                <li>Indemnification obligations under Section 8.4.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                For clarity, the limitation of liability in the Terms of Service continues to apply to all other claims not related to data protection.
              </p>
            </Subsection>

            <Subsection title="8.4 Indemnification">
              <p>
                <strong>Company Indemnification</strong>: The Company shall indemnify, defend, and hold harmless Customer from and against all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising from:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>The Company's breach of this DPA;</li>
                <li>The Company's violation of Data Protection Laws;</li>
                <li>Personal Data Breaches caused by the Company's negligence or willful misconduct;</li>
                <li>Claims by Data Subjects arising from the Company's Processing;</li>
                <li>Fines or penalties imposed by Supervisory Authorities due to the Company's non-compliance.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                <strong>Customer Indemnification</strong>: Customer shall indemnify, defend, and hold harmless the Company from and against all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising from:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Customer's breach of this DPA;</li>
                <li>Customer's failure to obtain necessary consents or provide required notices to Data Subjects;</li>
                <li>Customer's Processing instructions that violate Data Protection Laws;</li>
                <li>Claims arising from Customer's use of the Service in violation of applicable laws.</li>
              </ul>
            </Subsection>

            <Subsection title="8.5 Insurance">
              <p>
                The Company shall maintain, at its own expense, appropriate insurance coverage (including cyber liability insurance) covering liabilities arising from Personal Data Breaches and violations of Data Protection Laws. The Company shall provide proof of such insurance upon Customer's reasonable request.
              </p>
            </Subsection>
          </Section>

          <Section title="9. Term and Termination">
            <Subsection title="9.1 Term">
              <p>
                This DPA shall commence on the Effective Date and continue for the duration of the Terms of Service, unless earlier terminated in accordance with this Section 9.
              </p>
            </Subsection>

            <Subsection title="9.2 Termination">
              <p>
                This DPA may be terminated:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Automatically upon termination of the Terms of Service;</li>
                <li>By either party upon 30 days' written notice if the other party materially breaches this DPA and fails to cure such breach within the notice period;</li>
                <li>By Customer immediately upon written notice if a Supervisory Authority orders cessation of Processing due to the Company's non-compliance;</li>
                <li>By Customer as provided in Section 6.3 (objection to new Sub-processor).</li>
              </ul>
            </Subsection>

            <Subsection title="9.3 Effect of Termination">
              <p>
                Upon termination of this DPA:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>The Company shall cease all Processing of Personal Data (except as required by law);</li>
                <li>The Company shall delete or return Personal Data as provided in Section 4.6;</li>
                <li>Both parties shall continue to comply with their obligations under this DPA with respect to Personal Data until such data is deleted or returned;</li>
                <li>Sections that by their nature should survive (confidentiality, liability, indemnification, audit rights for records retention period) shall survive termination.</li>
              </ul>
            </Subsection>

            <Subsection title="9.4 Suspension">
              <p>
                The Company may suspend Processing of Personal Data if:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>A Supervisory Authority orders suspension;</li>
                <li>Required by applicable law;</li>
                <li>Customer fails to pay fees for more than 30 days after notice;</li>
                <li>Customer materially breaches this DPA and such breach poses a risk to the Company's compliance with Data Protection Laws.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                The Company shall provide Customer with reasonable advance notice of suspension except where immediate suspension is required by law or to protect Data Subjects.
              </p>
            </Subsection>
          </Section>

          <Section title="10. General Provisions">
            <Subsection title="10.1 Relationship to Terms of Service">
              <p>
                This DPA is incorporated into and forms part of the Terms of Service. In the event of a conflict between this DPA and the Terms of Service with respect to the Processing of Personal Data, this DPA shall prevail.
              </p>
            </Subsection>

            <Subsection title="10.2 Order of Precedence">
              <p>
                With respect to the subject matter of this DPA, in the event of inconsistencies, the following order of precedence applies:
              </p>
              <ol style={{ marginLeft: 20, marginTop: 8, listStyleType: "decimal", color: TEXT_COLOR }}>
                <li>Standard Contractual Clauses (Annex D)</li>
                <li>This DPA (main body)</li>
                <li>Annexes A, B, and C</li>
                <li>Terms of Service</li>
              </ol>
            </Subsection>

            <Subsection title="10.3 Amendments">
              <p>
                The Company may amend this DPA from time to time to:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Comply with changes in Data Protection Laws;</li>
                <li>Reflect changes in the Service or Processing activities;</li>
                <li>Implement decisions or guidance from Supervisory Authorities;</li>
                <li>Address new security threats or best practices.</li>
              </ul>
              <p style={{ marginTop: 12 }}>
                The Company shall provide Customer with at least 30 days' notice of material changes to this DPA. Continued use of the Service after such changes constitutes acceptance. If Customer does not agree to changes, Customer may terminate the Service as provided in the Terms of Service.
              </p>
            </Subsection>

            <Subsection title="10.4 Severability">
              <p>
                If any provision of this DPA is held invalid or unenforceable, the remaining provisions remain in full effect, and the invalid provision shall be modified to the minimum extent necessary to make it enforceable while preserving the parties' intent.
              </p>
            </Subsection>

            <Subsection title="10.5 Waiver">
              <p>
                No waiver of any provision of this DPA shall be effective unless in writing and signed by the party against whom the waiver is sought to be enforced. No failure or delay in exercising any right shall constitute a waiver.
              </p>
            </Subsection>

            <Subsection title="10.6 Entire Agreement">
              <p>
                This DPA, together with the Terms of Service and Privacy Policy, constitutes the entire agreement between the parties regarding the Processing of Personal Data and supersedes all prior agreements or understandings.
              </p>
            </Subsection>

            <Subsection title="10.7 Governing Law and Jurisdiction">
              <p>
                This DPA is governed by the same law and jurisdiction provisions as the Terms of Service, except:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Where Data Protection Laws require application of a specific jurisdiction's laws (e.g., GDPR for EEA customers);</li>
                <li>For disputes related to the Standard Contractual Clauses, the governing law and jurisdiction provisions in the SCCs shall apply.</li>
              </ul>
            </Subsection>

            <Subsection title="10.8 Third-Party Beneficiaries">
              <p>
                Data Subjects are intended third-party beneficiaries of this DPA and may enforce its provisions directly against the Company where permitted by applicable Data Protection Laws.
              </p>
            </Subsection>

            <Subsection title="10.9 Notices">
              <p>
                All notices under this DPA shall be in writing and sent to:
              </p>
              <p style={{ marginTop: 12, marginLeft: 20 }}>
                <strong>For Company</strong>:<br />
                Phaethon Order LLC<br />
                Email: <a href="mailto:admin@phaethonorder.com" className="hover:underline" style={{ color: LINK_COLOR }}>admin@phaethonorder.com</a><br />
                Subject: DPA Notice
              </p>
              <p style={{ marginTop: 12, marginLeft: 20 }}>
                <strong>For Customer</strong>:<br />
                The email address associated with Customer's account
              </p>
              <p style={{ marginTop: 12 }}>
                Notices are deemed delivered: (a) when sent by email, if during business hours, or (b) the next business day if sent outside business hours.
              </p>
            </Subsection>

            <Subsection title="10.10 Language">
              <p>
                This DPA is drafted in English. Any translation is provided for convenience only, and the English version controls in case of conflict.
              </p>
            </Subsection>

            <Subsection title="10.11 Assignment">
              <p>
                Customer may not assign or transfer this DPA without the Company's prior written consent. The Company may assign this DPA in connection with a merger, acquisition, or sale of assets upon notice to Customer.
              </p>
            </Subsection>
          </Section>

          <Section title="11. Contact Information">
            <p>For questions, concerns, or notices regarding this DPA, please contact:</p>
            <p style={{ marginTop: 12, marginLeft: 20 }}>
              <strong>Phaethon Order LLC</strong><br />
              <strong>Data Protection Officer</strong>: <a href="mailto:admin@phaethonorder.com" className="hover:underline" style={{ color: LINK_COLOR }}>admin@phaethonorder.com</a><br />
              <strong>Subject Line</strong>: DPA Inquiry<br />
              <strong>Website</strong>: <a href="https://phaethonorder.com" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://phaethonorder.com</a>
            </p>
          </Section>

          {/* ANNEXES */}
          <div
            id="annex-a"
            style={{
              marginTop: 48,
              padding: 24,
              background: "rgba(107, 174, 219, 0.12)",
              borderRadius: 20,
              border: "1px solid rgba(107, 174, 219, 0.25)",
              boxShadow: "0 18px 34px rgba(107, 174, 219, 0.18)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT_COLOR }}>Annex A: Details of Processing</h2>
            
            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>Subject Matter of Processing</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
                Provision of the SynapseIP service, including patent search, trend analysis, IP overview, alert delivery, data export, and customer support.
              </p>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>Duration of Processing</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
                For the term of the Terms of Service plus any retention periods required by applicable law (up to 7 years for financial records).
              </p>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>Nature and Purpose of Processing</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
                The Company Processes Personal Data to:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 14, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Create and manage user accounts;</li>
                <li>Authenticate users and control access;</li>
                <li>Provide search, analysis, and alert features;</li>
                <li>Process payments and manage subscriptions;</li>
                <li>Deliver customer support;</li>
                <li>Improve the Service and develop new features;</li>
                <li>Comply with legal obligations;</li>
                <li>Detect and prevent fraud and security threats;</li>
                <li>Send transactional and service-related communications.</li>
              </ul>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>Types of Personal Data</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
                The Company Processes the following categories of Personal Data:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 14, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Identity Data</strong>: Full name, username, organization/company name;</li>
                <li><strong>Contact Data</strong>: Email address, business address;</li>
                <li><strong>Account Data</strong>: Account credentials, account settings, preferences;</li>
                <li><strong>Financial Data</strong>: Billing address, payment method details (processed by Stripe);</li>
                <li><strong>Transaction Data</strong>: Purchase history, subscription status, invoices;</li>
                <li><strong>Usage Data</strong>: Search queries, alerts configured, data viewed, features used, session data;</li>
                <li><strong>Technical Data</strong>: IP address, browser type, device information, cookies;</li>
                <li><strong>Communication Data</strong>: Support messages, feedback submissions;</li>
                <li><strong>User-Generated Content</strong>: Saved searches, notes, annotations (if enabled).</li>
              </ul>
              <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR, fontWeight: 600 }}>
                Note: Publicly available patent data (titles, abstracts, claims, inventor names from government databases) is NOT considered Personal Data of Customer's Data Subjects.
              </p>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>Categories of Data Subjects</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
                Personal Data relates to the following Data Subjects:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 14, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Customer's employees;</li>
                <li>Customer's contractors and consultants;</li>
                <li>Customer's agents and representatives;</li>
                <li>Authorized Users of Customer's account;</li>
                <li>Prospective users (during trial or evaluation periods).</li>
              </ul>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>Special Categories of Data</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
                The Company does NOT Process special categories of Personal Data (e.g., racial or ethnic origin, political opinions, religious beliefs, health data, biometric data, genetic data) under this DPA.
              </p>
            </div>
          </div>

          <div
            id="annex-b"
            style={{
              marginTop: 32,
              padding: 24,
              background: "rgba(107, 174, 219, 0.12)",
              borderRadius: 20,
              border: "1px solid rgba(107, 174, 219, 0.25)",
              boxShadow: "0 18px 34px rgba(107, 174, 219, 0.18)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT_COLOR }}>Annex B: Technical and Organizational Security Measures</h2>
            
            <p style={{ marginTop: 16, fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
              The Company implements and maintains the following technical and organizational measures to protect Personal Data:
            </p>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>1. Access Control</h3>
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 14, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Multi-factor authentication (MFA) for user accounts;</li>
                <li>Role-based access control (RBAC) for internal systems;</li>
                <li>Least privilege principle for employee and system access;</li>
                <li>Regular access reviews and deprovisioning of terminated users;</li>
                <li>Unique user credentials for all personnel;</li>
                <li>Secure password policies (complexity, rotation).</li>
              </ul>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>2. Encryption</h3>
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 14, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>In Transit</strong>: TLS 1.2 or higher for all data transmission;</li>
                <li><strong>At Rest</strong>: AES-256 encryption for database storage (via Neon.tech);</li>
                <li>Secure key management practices;</li>
                <li>Encrypted backups;</li>
                <li>Encryption of payment data (handled by Stripe, PCI DSS compliant).</li>
              </ul>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>3. Network Security</h3>
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 14, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Firewalls and intrusion detection/prevention systems (IDS/IPS);</li>
                <li>Network segmentation and isolation;</li>
                <li>DDoS protection (via Vercel and CDN);</li>
                <li>Virtual Private Cloud (VPC) architecture;</li>
                <li>Regular network vulnerability scans;</li>
                <li>Secure APIs with rate limiting and authentication.</li>
              </ul>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>4. Application Security</h3>
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 14, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Secure coding practices and code reviews;</li>
                <li>Input validation and output encoding to prevent injection attacks;</li>
                <li>Protection against OWASP Top 10 vulnerabilities;</li>
                <li>Regular security testing (static and dynamic analysis);</li>
                <li>Dependency scanning and patch management;</li>
                <li>Session management and timeout controls;</li>
                <li>CSRF and XSS protection.</li>
              </ul>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>5. Logging and Monitoring</h3>
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 14, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Centralized logging of access to Personal Data;</li>
                <li>Real-time monitoring and alerting for security events;</li>
                <li>Audit trails for data access and modifications;</li>
                <li>Log retention for security investigation (180 days minimum);</li>
                <li>Security Information and Event Management (SIEM) capabilities;</li>
                <li>Automated anomaly detection.</li>
              </ul>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>6. Incident Response</h3>
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 14, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Documented incident response plan and procedures;</li>
                <li>Designated incident response team;</li>
                <li>Breach notification procedures as required by Section 4.3;</li>
                <li>Regular incident response drills and testing;</li>
                <li>Post-incident analysis and remediation;</li>
                <li>Communication protocols for customers and authorities.</li>
              </ul>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>7. Physical Security</h3>
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 14, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Data centers operated by certified providers (Vercel, Neon.tech);</li>
                <li>24/7 physical security and access control;</li>
                <li>Environmental controls (fire suppression, HVAC, power redundancy);</li>
                <li>Video surveillance and alarm systems;</li>
                <li>Visitor logging and escort requirements;</li>
                <li>Secure destruction of physical media containing Personal Data.</li>
              </ul>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>8. Personnel Security</h3>
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 14, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Background checks for employees with access to Personal Data (where legally permitted);</li>
                <li>Confidentiality and non-disclosure agreements;</li>
                <li>Regular security awareness training;</li>
                <li>Data protection training for relevant personnel;</li>
                <li>Clear roles and responsibilities for data protection;</li>
                <li>Secure offboarding procedures (credential revocation, device return).</li>
              </ul>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>9. Backup and Recovery</h3>
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 14, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Regular automated backups of Personal Data;</li>
                <li>Encrypted backup storage;</li>
                <li>Geographically redundant backup locations;</li>
                <li>Documented disaster recovery and business continuity plans;</li>
                <li>Regular testing of backup restoration procedures;</li>
                <li>Recovery Time Objective (RTO): 24 hours;</li>
                <li>Recovery Point Objective (RPO): 4 hours.</li>
              </ul>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>10. Vendor Management</h3>
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 14, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Due diligence on Sub-processors before engagement;</li>
                <li>Contractual data protection obligations for all Sub-processors;</li>
                <li>Regular assessment of Sub-processor security practices;</li>
                <li>Requirement for Sub-processors to maintain certifications (SOC 2, ISO 27001, etc.);</li>
                <li>Right to audit Sub-processors (directly or via third-party auditors).</li>
              </ul>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>11. Testing and Assessment</h3>
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 14, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Annual third-party security audits (SOC 2 Type II);</li>
                <li>Quarterly vulnerability assessments;</li>
                <li>Annual penetration testing;</li>
                <li>Regular security reviews of code and infrastructure;</li>
                <li>Compliance assessments against Data Protection Laws;</li>
                <li>Continuous security monitoring and improvement.</li>
              </ul>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>12. Data Minimization and Retention</h3>
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 14, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Collection of only necessary Personal Data;</li>
                <li>Defined retention periods for each data category;</li>
                <li>Automated data deletion processes;</li>
                <li>Secure data disposal methods (overwriting, shredding);</li>
                <li>Regular data retention audits;</li>
                <li>Pseudonymization of data where feasible for analytics.</li>
              </ul>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>13. Certifications and Compliance</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
                The Company and/or its Sub-processors maintain the following certifications and comply with industry standards:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 14, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>SOC 2 Type II (System and Organization Controls);</li>
                <li>ISO 27001 (Information Security Management);</li>
                <li>PCI DSS (Payment Card Industry Data Security Standard - via Stripe);</li>
                <li>GDPR compliance framework;</li>
                <li>CCPA/CPRA compliance framework;</li>
                <li>OWASP Top 10 security controls.</li>
              </ul>
            </div>

            <p style={{ marginTop: 20, fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, fontStyle: "italic" }}>
              Note: The Company reviews and updates these security measures regularly to address evolving threats and maintain compliance with Data Protection Laws. Specific implementations may vary based on risk assessments and technological advancements.
            </p>
          </div>

          <div
            id="annex-c"
            style={{
              marginTop: 32,
              padding: 24,
              background: "rgba(107, 174, 219, 0.12)",
              borderRadius: 20,
              border: "1px solid rgba(107, 174, 219, 0.25)",
              boxShadow: "0 18px 34px rgba(107, 174, 219, 0.18)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT_COLOR }}>Annex C: List of Authorized Sub-processors</h2>
            
            <p style={{ marginTop: 16, fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
              The Company currently engages the following Authorized Sub-processors to Process Personal Data on behalf of Customer:
            </p>

            <div style={{ marginTop: 24, overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", border: "1px solid #e5e7eb" }}>
                <thead>
                  <tr style={{ background: "#e5e7eb", fontWeight: 600 }}>
                    <th style={{ padding: 12, textAlign: "left", border: "1px solid #e5e7eb" }}>Sub-processor</th>
                    <th style={{ padding: 12, textAlign: "left", border: "1px solid #e5e7eb" }}>Service Provided</th>
                    <th style={{ padding: 12, textAlign: "left", border: "1px solid #e5e7eb" }}>Location</th>
                    <th style={{ padding: 12, textAlign: "left", border: "1px solid #e5e7eb" }}>Website / Privacy Policy</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}><strong>Vercel Inc.</strong></td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>Web hosting, application deployment, CDN</td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>United States</td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>
                      <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>Privacy Policy</a>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}><strong>Neon Tech Inc.</strong></td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>PostgreSQL database hosting, data storage</td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>United States</td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>
                      <a href="https://neon.tech/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>Privacy Policy</a>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}><strong>Auth0 Inc. (Okta)</strong></td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>Identity and access management, authentication</td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>United States</td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>
                      <a href="https://auth0.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>Privacy Policy</a>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}><strong>Stripe Inc.</strong></td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>Payment processing, subscription billing</td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>United States</td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>
                      <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>Privacy Policy</a>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}><strong>Mailgun Technologies Inc.</strong></td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>Transactional email delivery, alert notifications</td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>United States</td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>
                      <a href="https://www.mailgun.com/legal/privacy-policy/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>Privacy Policy</a>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}><strong>OpenAI L.L.C.</strong></td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>Text embeddings for semantic search (patent text only, no user data)</td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>United States</td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>
                      <a href="https://openai.com/privacy/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>Privacy Policy</a>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}><strong>Google LLC</strong></td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>Analytics (Google Analytics), patent data source (BigQuery)</td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>United States</td>
                    <td style={{ padding: 12, border: "1px solid #e5e7eb" }}>
                      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>Privacy Policy</a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 24, padding: 16, background: "white", borderRadius: 6, border: "1px solid #e5e7eb" }}>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, margin: 0 }}>
                <strong>Note on third-party API access</strong>: The Company sends patent and publication text (titles, abstracts, claims) to a third-party API for embedding generation to enable semantic search functionality. <strong>No Personal Data of Customer's Data Subjects is sent to the API.</strong> Patent data sent to the API consists of publicly available government records and does not contain user queries, account information, or other Personal Data.
              </p>
            </div>

            <div style={{ marginTop: 20, padding: 16, background: "white", borderRadius: 6, border: "1px solid #e5e7eb" }}>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, margin: 0 }}>
                <strong>Updates to Sub-processor List</strong>: This list may be updated from time to time in accordance with Section 6.3 of the DPA. Customer will receive 30 days' advance notice of any additions or changes. The current list is always available at this URL.
              </p>
            </div>

            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: TEXT_COLOR }}>Last Updated: October 17, 2026</p>
            </div>
          </div>

          <div
            id="annex-d"
            style={{
              marginTop: 32,
              padding: 24,
              background: "rgba(107, 174, 219, 0.12)",
              borderRadius: 20,
              border: "1px solid rgba(107, 174, 219, 0.25)",
              boxShadow: "0 18px 34px rgba(107, 174, 219, 0.18)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT_COLOR }}>Annex D: Standard Contractual Clauses</h2>
            
            <p style={{ marginTop: 16, fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
              For transfers of Personal Data from the European Economic Area (EEA), United Kingdom, or Switzerland to the United States or other countries without an adequacy decision, the parties agree to be bound by the following Standard Contractual Clauses (SCCs):
            </p>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>1. EU Standard Contractual Clauses (SCCs)</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
                The parties agree to comply with the Standard Contractual Clauses for the transfer of personal data to processors established in third countries adopted by the European Commission pursuant to:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 14, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Commission Implementing Decision (EU) 2021/914 of 4 June 2021</strong> on standard contractual clauses for the transfer of personal data to third countries pursuant to Regulation (EU) 2016/679 of the European Parliament and of the Council;</li>
                <li><strong>Module Two</strong> (Controller to Processor) applies to transfers where Customer is the data controller and Company is the data processor;</li>
                <li>The SCCs are incorporated by reference and form an integral part of this DPA.</li>
              </ul>
              <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
                <strong>Access to SCCs</strong>: The full text of the EU SCCs is available at: <a href="https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj</a>
              </p>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>2. UK Standard Contractual Clauses</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
                For transfers of Personal Data from the United Kingdom, the parties agree to comply with the UK's International Data Transfer Agreement (IDTA) or the UK Addendum to the EU SCCs, as applicable, issued by the UK Information Commissioner's Office.
              </p>
              <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
                <strong>Access to UK IDTA/Addendum</strong>: <a href="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/</a>
              </p>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>3. Swiss Standard Contractual Clauses</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
                For transfers of Personal Data from Switzerland, the parties agree to comply with the Swiss Federal Data Protection and Information Commissioner's (FDPIC) approved standard contractual clauses or equivalent mechanisms as required by the Swiss Federal Act on Data Protection (FADP).
              </p>
              <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
                <strong>Access to Swiss SCCs</strong>: <a href="https://www.edoeb.admin.ch/" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: LINK_COLOR }}>https://www.edoeb.admin.ch/</a>
              </p>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>4. Completing the SCCs</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
                For the purposes of the Standard Contractual Clauses:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 14, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Data Exporter</strong>: Customer (as the data controller);</li>
                <li><strong>Data Importer</strong>: Phaethon Order LLC (as the data processor);</li>
                <li><strong>Module Two</strong> (Controller to Processor) applies;</li>
                <li><strong>Clause 7 (Docking Clause)</strong>: Optional clause is available but not mandatory;</li>
                <li><strong>Clause 9(a) (Option 2)</strong>: General written authorization for sub-processors with notification mechanism as described in Section 6 of this DPA;</li>
                <li><strong>Clause 11(a) (Redress)</strong>: Independent dispute resolution body: Customer may contact a Supervisory Authority;</li>
                <li><strong>Clause 17 (Governing Law)</strong>: The law of an EU Member State where Customer is established (if applicable) or Ireland;</li>
                <li><strong>Clause 18 (Choice of forum and jurisdiction)</strong>: Courts of an EU Member State where Customer is established (if applicable) or Ireland;</li>
                <li><strong>Annex I (Transfer Details)</strong>: As described in Annex A of this DPA;</li>
                <li><strong>Annex II (Technical and Organizational Measures)</strong>: As described in Annex B of this DPA;</li>
                <li><strong>Annex III (Sub-processors)</strong>: As described in Annex C of this DPA.</li>
              </ul>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>5. Supplementary Measures</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
                In accordance with the Schrems II decision (Case C-311/18) and subsequent guidance from the European Data Protection Board (EDPB), the Company implements the following supplementary measures to ensure adequate protection for transfers to the United States:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 14, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li><strong>Encryption</strong>: Personal Data is encrypted in transit (TLS 1.2+) and at rest (AES-256);</li>
                <li><strong>Access Controls</strong>: Strict role-based access controls limit who can access Personal Data;</li>
                <li><strong>Minimization</strong>: Only necessary Personal Data is transferred and processed;</li>
                <li><strong>Pseudonymization</strong>: Where feasible, data is pseudonymized for analytics;</li>
                <li><strong>Contractual Safeguards</strong>: Sub-processors are contractually bound to similar data protection standards;</li>
                <li><strong>Transparency</strong>: The Company commits to transparency regarding government data requests;</li>
                <li><strong>Challenge Mechanism</strong>: The Company will challenge disproportionate or unlawful government requests where legally possible;</li>
                <li><strong>Monitoring and Audits</strong>: Regular security audits and compliance assessments;</li>
                <li><strong>Incident Response</strong>: Robust breach notification procedures as described in Section 4.3;</li>
                <li><strong>Data Localization Options</strong>: Upon request and subject to feasibility and additional fees, Customer may request data to be stored in EEA-based data centers (where available).</li>
              </ul>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>6. Transfer Impact Assessment</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
                Customer is responsible for conducting a Transfer Impact Assessment (TIA) to determine whether the safeguards provided by the SCCs and supplementary measures offer adequate protection for the specific data transfer. The Company will provide reasonable assistance and documentation to support Customer's TIA upon request.
              </p>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_COLOR, marginBottom: 8 }}>7. Government Access Requests</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_COLOR }}>
                The Company commits to:
              </p>
              <ul style={{ marginLeft: 20, marginTop: 8, fontSize: 14, listStyleType: "disc", listStylePosition: "outside", color: TEXT_COLOR }}>
                <li>Notifying Customer of any government or law enforcement requests for Customer's Personal Data, unless legally prohibited;</li>
                <li>Challenging disproportionate, overbroad, or unlawful requests where feasible;</li>
                <li>Disclosing only the minimum Personal Data necessary to comply with legally binding requests;</li>
                <li>Documenting all requests and responses;</li>
                <li>Publishing an annual transparency report summarizing requests received (in aggregated, anonymized form).</li>
              </ul>
            </div>

            <div style={{ marginTop: 20, padding: 16, background: "white", borderRadius: 6, border: "1px solid #e5e7eb" }}>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: TEXT_COLOR, margin: 0 }}>
                <strong>Note</strong>: The Company has never received a National Security Letter, FISA order, or any other classified government request for Customer data as of the date of this DPA. This statement will be updated if circumstances change and disclosure is legally permissible.
              </p>
            </div>

            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: TEXT_COLOR }}>Last Updated: October 17, 2026</p>
            </div>
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
            <p style={{ fontWeight: 700, fontSize: 14, margin: 0, color: TEXT_COLOR }}>Acknowledgment and Acceptance</p>
            <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13, color: TEXT_COLOR }}>
              BY USING THE SERVICE, CUSTOMER ACKNOWLEDGES THAT IT HAS READ, UNDERSTOOD, AND AGREES TO BE BOUND BY THIS DATA PROCESSING AGREEMENT, INCLUDING ALL ANNEXES.
            </p>
            <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13, color: TEXT_COLOR }}>
              This DPA is effective as of the date Customer first accesses or uses the Service, or the date Customer executes the Terms of Service, whichever is earlier.
            </p>
            <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13, fontWeight: 600, color: TEXT_COLOR }}>
              IF CUSTOMER DOES NOT AGREE TO THIS DPA, CUSTOMER MUST NOT ACCESS OR USE THE SERVICE.
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
