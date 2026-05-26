import { useEffect, useState, type ReactNode } from 'react';
import { useSEO } from '../../lib/useSEO';

const EFFECTIVE_DATE = '21 April 2026';
const VERSION = '3.0';

type Section = { id: string; label: string; docNum: string };

const SECTIONS: Section[] = [
  { id: 'tos',      label: 'Terms of Service',    docNum: 'I'   },
  { id: 'privacy',  label: 'Privacy Policy',       docNum: 'II'  },
  { id: 'notice',   label: 'Legal Notice',         docNum: 'III' },
  { id: 'cookies',  label: 'Cookie Policy',        docNum: 'IV'  },
  { id: 'signup',   label: 'Acceptance Terms',     docNum: 'V'   },
  { id: 'investor', label: 'Investor Disclaimer',  docNum: 'VI'  },
];

function DocHeader({ num, title, badge }: { num: string; title: string; badge?: string }) {
  return (
    <div style={{ borderTop: '2px solid #0D1E35', paddingTop: 14, marginBottom: 32, marginTop: 72 }}>
      <div style={{ fontSize: 11, color: '#B8973A', fontFamily: 'Courier New', letterSpacing: '.14em', marginBottom: 6 }}>
        DOCUMENT {num} OF VI
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 400, color: '#0D1E35', margin: 0 }}>{title}</h2>
        {badge && (
          <span style={{ padding: '4px 10px', border: '1px solid #DDD8CE', fontSize: 10, color: '#5A5A5A', fontFamily: 'Courier New', letterSpacing: '.08em', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

function ArtNum({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 11, color: '#B8973A', fontFamily: 'Courier New', letterSpacing: '.1em', marginBottom: 6, marginTop: 36 }}>{children}</div>;
}

function H3({ children }: { children: ReactNode }) {
  return <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#0D1E35', margin: '0 0 12px', lineHeight: 1.35 }}>{children}</h3>;
}

function P({ children }: { children: ReactNode }) {
  return <p style={{ marginBottom: 14, fontSize: 14.5, lineHeight: 1.8, textAlign: 'justify', color: '#1C1C1C' }}>{children}</p>;
}

function UL({ items }: { items: ReactNode[] }) {
  return (
    <ul style={{ paddingLeft: 22, margin: '10px 0 16px' }}>
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: 8, fontSize: 14.5, lineHeight: 1.75, color: '#1C1C1C' }}>{item}</li>
      ))}
    </ul>
  );
}

function CritBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ background: '#FDF5F5', borderLeft: '5px solid #C0392B', border: '1px solid #DBA0A0', padding: '18px 22px', margin: '22px 0' }}>
      <div style={{ fontSize: 10, fontFamily: 'Courier New', color: '#8B1A1A', textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: 8, fontWeight: 700 }}>⚠ {label}</div>
      <div style={{ fontSize: 14, color: '#5C1010', lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

function GoldBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ background: '#F5F2EC', borderLeft: '5px solid #B8973A', border: '1px solid #B8973A', padding: '18px 22px', margin: '22px 0' }}>
      <div style={{ fontSize: 10, fontFamily: 'Courier New', color: '#B8973A', textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: 8, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#0D1E35', lineHeight: 1.7, fontWeight: 600 }}>{children}</div>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0 22px', fontSize: 13.5 }}>
      <thead>
        <tr>{headers.map((h, i) => <th key={i} style={{ background: '#0D1E35', color: '#fff', padding: '10px 14px', textAlign: 'left', fontSize: 11, fontFamily: 'Courier New', letterSpacing: '.06em' }}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => <td key={j} style={{ padding: '10px 14px', borderBottom: '1px solid #DDD8CE', background: i % 2 === 1 ? 'rgba(0,0,0,.025)' : 'transparent', verticalAlign: 'top' }}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Legal() {
  const [activeSection, setActiveSection] = useState('tos');

  useSEO({
    title: 'Legal · Nautilus',
    description: 'Terms of Service, Privacy Policy, Legal Notice, Cookie Policy, and Investment Disclaimer for the Nautilus platform.',
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) setActiveSection(entry.target.id); });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    SECTIONS.forEach(s => { const el = document.getElementById(s.id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ background: '#F8F6F2', minHeight: '100vh', fontFamily: 'Times New Roman, serif' }}>

      {/* Hero */}
      <div style={{ background: '#0D1E35', padding: '64px 56px 52px', borderBottom: '3px solid #B8973A' }}>
        <div style={{ fontSize: 11, color: '#B8973A', fontFamily: 'Courier New', letterSpacing: '.18em', marginBottom: 16 }}>NAUTILUS · LEGAL STACK · VERSION {VERSION}</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 38, fontWeight: 400, color: '#fff', marginBottom: 12, lineHeight: 1.2 }}>Legal Documentation</h1>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', fontFamily: 'Courier New', marginBottom: 20 }}>
          Effective {EFFECTIVE_DATE} &nbsp;·&nbsp; French Law &nbsp;·&nbsp; GDPR / CNIL Compliant &nbsp;·&nbsp; LCEN Compliant
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SECTIONS.map(s => (
            <a key={s.id} href={`#${s.id}`} style={{ padding: '4px 12px', border: '1px solid rgba(184,151,58,.4)', color: '#C6A85A', fontSize: 11, letterSpacing: '.1em', fontFamily: 'Courier New', textDecoration: 'none' }}>
              {s.label}
            </a>
          ))}
        </div>
      </div>

      {/* Layout */}
      <div style={{ display: 'flex', maxWidth: 1160, margin: '0 auto' }}>

        {/* Sidebar */}
        <nav style={{ width: 260, flexShrink: 0, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', background: '#0D1E35', padding: '36px 20px', borderRight: '1px solid rgba(184,151,58,.15)' }}>
          <div style={{ fontSize: 10, color: '#B8973A', textTransform: 'uppercase', letterSpacing: '.16em', fontFamily: 'Courier New', marginBottom: 18 }}>Documents</div>
          {SECTIONS.map(s => (
            <a key={s.id} href={`#${s.id}`} style={{ display: 'block', padding: '10px 12px', fontSize: 12, color: activeSection === s.id ? '#C6A85A' : 'rgba(255,255,255,.45)', borderLeft: activeSection === s.id ? '2px solid #B8973A' : '2px solid transparent', marginBottom: 2, fontFamily: 'Courier New', letterSpacing: '.04em', textDecoration: 'none', background: activeSection === s.id ? 'rgba(184,151,58,.06)' : 'transparent', transition: 'all .15s' }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.22)', marginRight: 6 }}>{s.docNum}</span>{s.label}
            </a>
          ))}
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, padding: '56px 64px 120px', minWidth: 0 }}>

          {/* ─── TOS ─── */}
          <div id="tos">
            <DocHeader num="I" title="Terms of Service" badge={`EFFECTIVE ${EFFECTIVE_DATE}`} />

            <CritBox label="Mandatory Pre-Reading Notice">
              These Terms of Service constitute a legally binding agreement. By accessing or using the Nautilus Platform in any capacity, you unconditionally accept all terms herein, including critical limitations on liability, a strict no-refund policy, mandatory dispute resolution procedures, and explicit exclusions of financial advisory obligations.
            </CritBox>

            <ArtNum>ARTICLE 1 — DEFINITIONS</ArtNum>
            <H3>Article 1 — Definitions and Interpretation</H3>
            <UL items={[
              <><strong>"Agreement"</strong> — these Terms of Service together with all incorporated policies including the Privacy Policy, Legal Notice, Cookie Policy, and any Order Confirmation.</>,
              <><strong>"Platform"</strong> — the Nautilus web application, APIs, AI-powered analytical modules, data aggregation systems, scoring algorithms, and all related services at get-nautilus.com.</>,
              <><strong>"Operator"</strong> — Nautilus, operated by Camille de La Morinière, Paris, France. Full legal entity details will be published upon completion of registration formalities.</>,
              <><strong>"B2C User"</strong> — any natural person subscribing wholly outside the scope of any trade, business, craft, or profession.</>,
              <><strong>"B2B User"</strong> — any legal entity or professional subscribing in the course of a trade, business, or professional activity.</>,
              <><strong>"Active Subscription"</strong> — any Subscription for which payment has been collected, <strong>irrespective of whether the User has accessed or used the Platform during that Billing Period.</strong></>,
              <><strong>"Analytical Output"</strong> — any content generated by the Platform including deal scores, investment memoranda, artist intelligence indices, and AI-generated reports.</>,
              <><strong>"Chargeback"</strong> — any unilateral reversal of a payment initiated by a User through their payment provider without following the dispute resolution procedure in Article 17.</>,
            ]} />

            <ArtNum>ARTICLE 2 — FORMATION OF CONTRACT</ArtNum>
            <H3>Article 2 — Binding Acceptance</H3>
            <P>A legally binding contract is formed at the earliest of: (i) the User clicking the acceptance checkbox at registration; (ii) initiating a free trial; or (iii) completing a Subscription purchase. Nautilus maintains server-side logs recording the date, time (UTC), IP address, and account identifier associated with each acceptance event, constituting admissible evidence under Article 1366 of the French Civil Code, retained for a minimum of five (5) years.</P>

            <ArtNum>ARTICLE 3 — NON-ADVISORY STATUS</ArtNum>
            <H3>Article 3 — Nature of the Platform: Strict Non-Advisory Status</H3>
            <CritBox label="Critical Legal Notice">
              Nautilus is an information technology platform. It is not, and shall not be construed as, a financial advisor, investment advisor, portfolio manager, asset manager, broker, or any regulated entity under French law, EU law, or any other jurisdiction. It holds no licence from the AMF, ACPR, FCA, SEC, or any financial regulatory body.
            </CritBox>
            <P>The Platform does not: (a) provide personalised investment recommendations under Article L. 321-1 of the French Monetary and Financial Code; (b) execute or intermediate any transaction; (c) manage portfolios; (d) provide any MiFID II service; or (e) hold client funds. No Analytical Output constitutes an offer to buy or sell, a solicitation, or a regulated investment service.</P>

            <ArtNum>ARTICLE 4 — DATA LIMITATIONS</ArtNum>
            <H3>Article 4 — Nature of Analytical Outputs and Data Limitations</H3>
            <UL items={[
              <><strong>No guarantee of accuracy:</strong> data may be incomplete, delayed, or erroneous. Nautilus does not verify source data.</>,
              <><strong>Algorithmic outputs are statistical, not factual:</strong> deal scores do not represent facts, certainties, or professional assessments. A high score is not a buying recommendation.</>,
              <><strong>AI hallucination:</strong> AI features use large language models that may produce factually incorrect outputs. No human reviews AI outputs prior to delivery.</>,
              <><strong>Historical data is not predictive:</strong> past results do not predict future valuations.</>,
              <><strong>No reliance:</strong> the User will not rely solely on any Analytical Output in making any investment or commercial decision.</>,
            ]} />

            <ArtNum>ARTICLE 5 — ACCOUNTS</ArtNum>
            <H3>Article 5 — Eligibility and Account Registration</H3>
            <P>Users must be at least 18 years of age with legal capacity to contract. One account per User is permitted. Creation of multiple accounts to circumvent plan limits or obtain repeated free trials constitutes a material breach entitling Nautilus to immediately terminate all associated accounts without refund.</P>

            <ArtNum>ARTICLE 6 — INTELLECTUAL PROPERTY</ArtNum>
            <H3>Article 6 — Intellectual Property Rights</H3>
            <P>All IP Rights in the Platform — including scoring methodology, algorithms, AI architecture, Analytical Outputs, and design — remain the exclusive property of Nautilus. The User receives a limited, revocable licence for personal or internal business use only. The User may not reproduce, resell, scrape, reverse-engineer, or use Platform outputs to train competing AI systems.</P>

            <ArtNum>ARTICLE 7 — THIRD-PARTY DATA</ArtNum>
            <H3>Article 7 — Third-Party Data and Database Rights</H3>
            <P>Nautilus aggregates data from Artsy, Drouot, Sotheby's, Christie's, Bonhams, Invaluable, and others. Nautilus has no affiliation with these sources. Nautilus's processing constitutes transformative analytical use and does not reproduce database structures within the meaning of Article L. 342-1 of the French IP Code or Directive 96/9/EC. Changes to third-party APIs are outside Nautilus's control and do not entitle the User to refund.</P>

            <ArtNum>ARTICLE 8 — ACCEPTABLE USE</ArtNum>
            <H3>Article 8 — Acceptable Use</H3>
            <P>The User may not use the Platform to violate any law, facilitate market manipulation or financial crime, circumvent access controls, upload malicious code, or share credentials. Violations entitle Nautilus to immediately suspend or terminate the account without notice or refund.</P>

            <ArtNum>ARTICLE 9 — SUBSCRIPTIONS & BILLING</ArtNum>
            <H3>Article 9 — Subscription Plans, Pricing, and Billing</H3>
            <Table
              headers={['Plan', 'Monthly', 'Annual', 'Opportunities', 'AI Analyses/mo']}
              rows={[
                ['Free', '€0', '—', '30', 'None'],
                ['Collector', 'Founding price — €19/mo', '€182.40', '100', 'None'],
                ['Investor', '€19', '€190/year', 'Unlimited', '20'],
                ['Family Office', '€99', '€950.40', 'Unlimited', '100'],
                ['Institutional', 'Custom', 'Custom', 'Unlimited', '999'],
              ]}
            />
            <P>All prices include applicable VAT. Payments are processed by Stripe Payments Europe, Ltd. Nautilus does not store payment card details. Failed payments trigger up to three retries over seven days; thereafter the Subscription is suspended. Unused AI quotas are not carried forward.</P>

            <ArtNum>ARTICLE 10 — AUTOMATIC RENEWAL</ArtNum>
            <H3>Article 10 — Automatic Renewal</H3>
            <CritBox label="Automatic Renewal — User's Sole Responsibility">
              All paid Subscriptions renew automatically at the end of each Billing Period at the then-applicable rate unless the User has completed a valid Cancellation prior to the Billing Date. <strong>The User bears sole and exclusive responsibility for cancelling before the Billing Date.</strong> Non-use of the Platform, failure to log in, or non-receipt of a renewal reminder does not constitute grounds for cancellation or refund.
            </CritBox>

            <ArtNum>ARTICLE 11 — FREE TRIAL</ArtNum>
            <H3>Article 11 — Free Trial</H3>
            <P>New Users may access one seven (7) day free trial per account, email address, and payment method. At expiry, the Subscription converts automatically to the paid plan. The User must cancel before trial end to avoid charges. Multiple accounts to obtain repeated trials constitute a material breach.</P>

            <ArtNum>ARTICLE 12 — NON-USE</ArtNum>
            <H3>Article 12 — Non-Use: Explicit Exclusion from Refund Grounds</H3>
            <CritBox label="Non-Use Policy — Binding Clause">
              The User's failure to use the Platform, log in, or access any feature during a Billing Period does not constitute grounds for refund, credit, or reversal of any charge. By subscribing, the User purchases <em>access rights</em> — not a guaranteed quantum of usage. This clause applies to both B2C and B2B Users.
            </CritBox>

            <ArtNum>ARTICLE 13 — CANCELLATION</ArtNum>
            <H3>Article 13 — Cancellation Procedure</H3>
            <CritBox label="Valid Cancellation — Exclusive Channel">
              The self-service cancellation function within the Platform account settings is the <strong>sole valid channel</strong> for subscription cancellation. Requests communicated by email, telephone, social media, or any other channel shall not constitute valid cancellations and shall not interrupt the automatic renewal cycle.
            </CritBox>
            <P>For monthly plans: no pro-rata refund for remaining days. For annual plans: no refund for remaining months, subject only to Article 14.4.</P>

            <ArtNum>ARTICLE 14 — REFUND POLICY</ArtNum>
            <H3>Article 14 — Refund Policy: Strict Provisions</H3>
            <P><strong>14.1 — B2C Users — EU Right of Withdrawal</strong></P>
            <P>Pursuant to Article L. 221-18 of the French Consumer Code and Directive 2011/83/EU, B2C Users have a 14-day right of withdrawal from the contract conclusion date.</P>
            <CritBox label="Waiver of Withdrawal Right">
              Pursuant to Article L. 221-28, 13° of the French Consumer Code, by accessing any paid feature after subscribing — viewing opportunities beyond Free limits, generating any AI analysis, or accessing any paid content — the User <strong>expressly requests immediate performance and irrevocably waives their right of withdrawal.</strong> No refund is due following such access.
            </CritBox>
            <P><strong>14.2 — B2B Users</strong> — No statutory right of withdrawal. All payments irrevocably non-refundable.</P>
            <P><strong>14.3 — Annual plans</strong> — No pro-rata refund for unused months on cancellation or termination.</P>
            <P><strong>14.4 — Exceptional circumstances only</strong> — Pro-rata refund if Nautilus permanently discontinues the Platform without 30 days' notice; service credit if a documented outage exceeds 72 consecutive hours attributable exclusively to Nautilus infrastructure.</P>
            <P><strong>14.5 — Explicit exclusions</strong> — Nautilus will not refund for: non-use or low use; dissatisfaction with AI outputs; investment losses; change of circumstances; failure to cancel before renewal; forgotten subscriptions; non-receipt of reminders; third-party data issues; or User-side technical problems.</P>

            <ArtNum>ARTICLE 15–16 — SERVICE AVAILABILITY & MODIFICATIONS</ArtNum>
            <H3>Articles 15–16 — Service Availability and Unilateral Rights</H3>
            <P>The Platform is operated on an "as available" basis. Nautilus disclaims any obligation of service continuity. Nautilus reserves the right to modify or remove features, suspend or terminate accounts, modify pricing (30 days' notice), and modify these Terms (14 days' notice for material changes). Continued use after modifications constitutes acceptance.</P>

            <ArtNum>ARTICLE 17 — DISPUTE RESOLUTION & CHARGEBACKS</ArtNum>
            <H3>Article 17 — Dispute Resolution and Anti-Chargeback Procedure</H3>
            <CritBox label="Mandatory Pre-Dispute Obligation">
              Before initiating any chargeback or payment reversal with any bank or payment provider, the User must first submit a written notice to <strong>contact@get-nautilus.com</strong> and allow Nautilus five (5) Business Days to respond. Failure to comply is a material breach. Chargebacks initiated without prior notice will result in: immediate account termination; permanent ban; submission of evidence to Stripe contesting the dispute; and recovery of all associated costs. Fraudulent chargebacks may be referred to law enforcement.
            </CritBox>

            <ArtNum>ARTICLE 18 — WARRANTIES</ArtNum>
            <H3>Article 18 — Disclaimer of Warranties</H3>
            <P>The Platform is provided strictly "as is" and "as available". Nautilus disclaims all warranties, express or implied, including merchantability, fitness for purpose, accuracy, and uninterrupted availability.</P>

            <ArtNum>ARTICLE 19 — LIMITATION OF LIABILITY</ArtNum>
            <H3>Article 19 — Limitation of Liability</H3>
            <CritBox label="Liability Cap — Binding and Material">
              Nautilus's total aggregate liability for any and all claims shall not exceed the greater of: (i) the total Subscription fees paid by the User in the twelve (12) months preceding the claim; or (ii) €100. In no event shall Nautilus be liable for indirect, incidental, consequential, or punitive damages, investment losses, loss of profits, or any financial harm arising from decisions made in reliance on Platform content.
            </CritBox>

            <ArtNum>ARTICLES 20–24</ArtNum>
            <H3>Articles 20–24 — Indemnification, Electronic Evidence, Force Majeure, Governing Law</H3>
            <P>The User indemnifies Nautilus against claims arising from Agreement violations or investment decisions. Server-side logs constitute primary admissible evidence under Articles 1366–1379 of the French Civil Code. Force Majeure covers acts of God, cyberattacks, third-party infrastructure failures (Stripe, Vercel, Railway, OpenAI), and API disruptions. This Agreement is governed exclusively by French law. B2B disputes: exclusive jurisdiction of Paris courts. B2C disputes: Paris courts, subject to EU consumer protection mandatory provisions.</P>
          </div>

          {/* ─── PRIVACY ─── */}
          <div id="privacy">
            <DocHeader num="II" title="Privacy Policy" badge="GDPR / CNIL COMPLIANT" />

            <ArtNum>ARTICLE 1 — DATA CONTROLLER</ArtNum>
            <H3>Article 1 — Data Controller</H3>
            <P>The data controller under Article 4(7) GDPR is: Nautilus, operated by Camille de La Morinière, Paris, France. Contact: contact@get-nautilus.com. Full legal entity details will be published upon completion of registration formalities. No DPO appointment is required given the nature and scale of processing activities.</P>

            <ArtNum>ARTICLE 2 — DATA COLLECTED</ArtNum>
            <H3>Article 2 — Categories of Personal Data</H3>
            <Table
              headers={['Category', 'Data Elements', 'Source']}
              rows={[
                ['Identity', 'Full name, email, account username', 'Provided at registration'],
                ['Authentication', 'Hashed password, session tokens, login timestamps', 'Generated automatically'],
                ['Billing', 'Plan, billing history, invoices. Card details held by Stripe only.', 'Generated at subscription'],
                ['Technical', 'IP address, browser, OS, device identifiers', 'Collected automatically'],
                ['Usage', 'Features accessed, AI analyses consumed, plan limits used', 'Collected automatically'],
                ['Communications', 'Content of contact form or support messages', 'Provided by User'],
              ]}
            />

            <ArtNum>ARTICLE 3 — LEGAL BASES</ArtNum>
            <H3>Article 3 — Purposes and Legal Bases</H3>
            <Table
              headers={['Purpose', 'Legal Basis (GDPR Art. 6)']}
              rows={[
                ['Service delivery and account management', 'Art. 6(1)(b) — Contract performance'],
                ['Security, fraud detection, access control', 'Art. 6(1)(f) — Legitimate interests'],
                ['Platform analytics and improvement', 'Art. 6(1)(f) — Legitimate interests'],
                ['Legal and regulatory compliance', 'Art. 6(1)(c) — Legal obligation'],
                ['Marketing communications (opt-in only)', 'Art. 6(1)(a) — Consent (revocable)'],
                ['Dispute resolution and legal defence', 'Art. 6(1)(f) — Legitimate interests'],
              ]}
            />

            <ArtNum>ARTICLE 4 — DATA RECIPIENTS</ArtNum>
            <H3>Article 4 — Data Recipients</H3>
            <P>Nautilus does not sell personal data. Recipients: Stripe (payments), Vercel (frontend hosting, SCC transfers), Railway (backend hosting), Neon (database), Anthropic (anonymised prompts only — no personal data), and legal/regulatory authorities where required by law.</P>

            <ArtNum>ARTICLE 5-6 — TRANSFERS & RETENTION</ArtNum>
            <H3>Articles 5–6 — International Transfers and Retention</H3>
            <P>Third-country transfers use Standard Contractual Clauses (SCC) per Commission Decision (EU) 2021/914 and/or the EU-US Data Privacy Framework. Retention: account data 3 years post-closure; acceptance logs 5 years; billing records 10 years (French Commercial Code); technical logs 12 months; communications 3 years.</P>

            <ArtNum>ARTICLE 7 — YOUR RIGHTS</ArtNum>
            <H3>Article 7 — Data Subject Rights</H3>
            <P>EEA Users have the rights of: access (Art. 15); rectification (Art. 16); erasure (Art. 17); restriction (Art. 18); portability (Art. 20); objection (Art. 21); and withdrawal of consent (Art. 7(3)). Submit requests to contact@get-nautilus.com. Response within 30 days. Complaints to CNIL, 3 Place de Fontenoy, 75007 Paris — <a href="https://www.cnil.fr" target="_blank" rel="noreferrer">www.cnil.fr</a>.</P>
          </div>

          {/* ─── LEGAL NOTICE ─── */}
          <div id="notice">
            <DocHeader num="III" title="Legal Notice" badge="LCEN COMPLIANT" />
            <P>Pursuant to Articles 6-I and 6-III of Law No. 2004-575 of 21 June 2004 (LCEN):</P>
            <UL items={[
              <><strong>Publisher:</strong> Nautilus — operated by Camille de La Morinière</>,
              <><strong>Location:</strong> Paris, France</>,
              <><strong>Contact:</strong> contact@get-nautilus.com</>,
              <><strong>Legal entity details:</strong> Company registration number, SIREN, RCS, and VAT identification number will be added upon completion of registration formalities.</>,
              <><strong>Publication director:</strong> Camille de La Morinière</>,
              <><strong>Frontend hosting:</strong> Vercel, Inc., 340 Pine Street, Suite 701, San Francisco, CA 94104, USA</>,
              <><strong>Backend hosting:</strong> Railway Corporation, San Francisco, CA, USA</>,
              <><strong>Database hosting:</strong> Neon, Inc., San Francisco, CA, USA</>,
            ]} />
            <P>Nautilus is not a financial institution, investment firm, or regulated entity. Nothing on this Platform constitutes investment advice or a regulated financial communication. Unauthorised reproduction of Platform content constitutes copyright infringement under Articles L. 335-2 et seq. of the French Intellectual Property Code (up to 3 years' imprisonment and €300,000 fine). Supervisory authority: CNIL, www.cnil.fr.</P>
          </div>

          {/* ─── COOKIES ─── */}
          <div id="cookies">
            <DocHeader num="IV" title="Cookie Policy" badge="CNIL GUIDELINES COMPLIANT" />
            <P>Nautilus uses only strictly necessary cookies. No advertising, analytics, or tracking cookies are deployed.</P>
            <Table
              headers={['Cookie', 'Purpose', 'Basis', 'Duration']}
              rows={[
                ['Session auth token', 'Maintains authenticated user session', 'Strictly necessary — no consent required', 'Session or 30 days ("Remember me")'],
                ['CSRF token', 'Prevents cross-site request forgery attacks', 'Strictly necessary', 'Session'],
                ['Plan cache', 'Client-side feature gating without API call per page load', 'Strictly necessary', 'Until next sync or logout'],
              ]}
            />
            <P>Should any non-essential cookies be introduced, this Policy will be updated and prior informed consent obtained via a compliant consent management mechanism (CNIL Guidelines, October 2020). Users may configure browser-level controls to refuse cookies, which will prevent access to authenticated Platform features.</P>
          </div>

          {/* ─── SIGNUP ACCEPTANCE ─── */}
          <div id="signup">
            <DocHeader num="V" title="Acceptance Terms" badge="UX IMPLEMENTATION" />
            <GoldBox label="Signup Checkbox Wording — Exact Text">
              The following checkboxes are displayed unchecked by default at registration. All required boxes must be checked before account creation proceeds. The timestamp, IP address, and checkbox state are server-logged at submission.
            </GoldBox>
            <UL items={[
              <><strong>[Required]</strong> I have read and unconditionally accept the Terms of Service of Nautilus, including the automatic renewal policy, non-refund policy, limitation of liability, and anti-chargeback procedure. I acknowledge that my Subscription renews automatically and that I am solely responsible for cancelling before the Billing Date.</>,
              <><strong>[Required]</strong> I have read and understood the Privacy Policy and Cookie Policy of Nautilus and consent to the processing of my personal data as described.</>,
              <><strong>[Required]</strong> I acknowledge that Nautilus is an information and analytics platform only. Nothing provided constitutes financial advice, investment advice, or a recommendation. All investment decisions are at my sole risk. Non-use during a billing period does not entitle me to a refund.</>,
              <><strong>[Required]</strong> I agree to receive transactional emails (billing alerts, account notifications, service communications) from Nautilus.</>,
              <><strong>[Optional]</strong> I would like to receive market intelligence newsletters and commercial communications from Nautilus.</>,
            ]} />
            <P><strong>Confirmation button:</strong> "Create my account — I accept the Terms of Service"</P>
            <P><strong>Below-button text:</strong> By creating your account, you confirm you are at least 18 years of age, have read and accepted the Terms of Service, Privacy Policy, and Cookie Policy, and understand that Nautilus does not provide financial advice. Your Subscription renews automatically. You may cancel at any time in your account settings.</P>
          </div>

          {/* ─── INVESTOR DISCLAIMER ─── */}
          <div id="investor">
            <DocHeader num="VI" title="Investor & Professional Disclaimer" badge="HNWI / FAMILY OFFICE / INSTITUTIONAL" />
            <GoldBox label="Scope">
              This Disclaimer applies to Investor, Family Office, and Institutional plan subscribers, and to any User identifying as a professional investor, HNWI, family office representative, or investment professional.
            </GoldBox>

            <ArtNum>SECTION 1 — PROFESSIONAL USER REPRESENTATION</ArtNum>
            <H3>Section 1 — Professional Classification and Representation</H3>
            <P>By subscribing to a professional tier, the User irrevocably warrants that: they are a financially sophisticated party capable of independently evaluating art market opportunities; they can bear the full risk of capital loss; they are not relying on Nautilus as the basis for any investment decision; they will consult independent qualified advisors before acting on Platform content; and they acknowledge the limitations of algorithmic analysis applied to the art market.</P>

            <ArtNum>SECTION 2 — ASSUMPTION OF RISK</ArtNum>
            <H3>Section 2 — Full and Explicit Assumption of Risk</H3>
            <P>The User fully assumes all risks associated with Platform use, including: AI errors and data inaccuracies; art market illiquidity and opacity; systemic macroeconomic risks; concentration risk; absence of financial market regulatory protections; and currency fluctuation risk. Use of the Platform in a professional capacity does not create any duty of care, advisory relationship, or fiduciary obligation between User and Nautilus.</P>

            <ArtNum>SECTION 3-5 — ENHANCED LIABILITY EXCLUSION</ArtNum>
            <H3>Sections 3–5 — Enhanced Exclusions and Regulatory Responsibility</H3>
            <P>Professional Users waive all rights to claim damages from Nautilus arising from use of Analytical Outputs in professional investment activity, client losses, or regulatory consequences from reliance on Platform content. Platform outputs are supplementary tools only. Investment-grade due diligence requires information beyond any data aggregation platform. Where Users are subject to MiFID II, AIFMD, or AML obligations, compliance is the User's sole responsibility.</P>
          </div>

          {/* Final acceptance */}
          <div style={{ background: '#0D1E35', border: '2px solid #B8973A', padding: '28px 32px', marginTop: 64, textAlign: 'center' }}>
            <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 11, fontFamily: 'Courier New', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>Complete Legal Stack — Nautilus v{VERSION}</div>
            <p style={{ color: '#fff', fontSize: 14, lineHeight: 1.75, fontFamily: 'Times New Roman', margin: '0 0 12px' }}>
              By using the Nautilus Platform, you confirm unconditional acceptance of all documents in this Legal Stack.
            </p>
            <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 11, fontFamily: 'Courier New' }}>
              Effective {EFFECTIVE_DATE} · Version {VERSION} · Paris, France · contact@get-nautilus.com
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
