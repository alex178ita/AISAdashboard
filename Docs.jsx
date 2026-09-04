// src/Docs.jsx — Full Technical & User Documentation
//
// A hub view: it does not embed the documents (they live in Google Drive) but
// presents the suite and links straight into the shared folder, keeping the
// same navigation, print and share chrome as every other page.

import { DOC_URL } from "./config.js";
import { T, NavBar, PageActions, PrintStyle, LinkIcon } from "./shared.jsx";
import { MailIcon, LinkedInIcon, ContentIcon, GearIcon, MonitorIcon, FamilyIcon } from "./icons.jsx";

// The written documentation set (PDF/XLSX in the Drive folder). The KPI, Flow B
// and Flow C2 papers are not repeated here — they map to the system components
// listed below; this keeps Documents to the cross-cutting deliverables.
const DOCS = [
  { title: "Marketing Automation — User & Technical Manual", meta: "PDF · 74 pages · 15 chapters", desc: "The complete operating manual: architecture, every Make.com flow, the KPI model, and day-to-day operating procedures." },
  { title: "Design vs Delivery", meta: "PDF · v1.0", desc: "What was specified against what was built — the reconciliation record for the automation programme." },
  { title: "Tools Cost Summary", meta: "XLSX · v3", desc: "Per-tool running costs across the whole stack (Make, Firecrawl, ZeptoMail, Zoho, Anthropic and the rest)." },
];

// The components of the running system — so the hub names the whole estate, not
// only the paperwork. Colours mirror the flow families on the main dashboard.
const COMPONENTS = [
  { code: "A", color: "#2FB980", title: "Family A — AISA Audit & Outreach", desc: "The audit-on-sign-up webhook (A1) and the cold-outreach email engine (A2) that emails prospects a Firecrawl-based AI readiness audit." },
  { code: "B", color: "#E6568F", title: "Family B — LinkedIn (Account-Based Marketing)", desc: "The full LinkedIn account-based sequence: PhantomBuster ingestion, CRM dedup, connection invites, the Claude DM writer with review gate, sending and reply alerting." },
  { code: "C", color: "#5B63D3", title: "Family C — Content Generation", desc: "The social writer (C1) into Zoho Social and the blog pipeline (C2): topic radar, blog writer to WordPress draft, the approve-to-live publisher, and the daily backfill that repairs articles published outside the flow." },
  { code: "MD", color: "#8A94A6", title: "MD Consolidator", desc: "The service flow that consolidates the automation’s Markdown outputs — the shared documentation and content substrate the other flows draw on." },
  { code: "K", color: "#8A94A6", title: "Service collectors (K1–K5)", desc: "The KPI collectors (Make + Firecrawl, ZeptoMail events, Campaigns stats), plus K5, the deterministic redemption-attribution engine feeding the KPIs page." },
  { code: "DASH", color: "#12151A", title: "This dashboard", desc: "The React/Vercel front end you are reading now: flow status and run metrics, redemption KPIs, statistical graphs and this documentation hub — refreshed from the published KPI-log tabs." },
];

const COMP_ICON = { A: <MailIcon size={17} />, B: <LinkedInIcon size={17} />, C: <ContentIcon size={17} />, MD: <GearIcon size={17} />, K: <GearIcon size={17} />, DASH: <MonitorIcon size={17} /> };

export default function Docs() {
  const card = { background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "18px 20px" };
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.sans, color: T.ink }}>
      <PrintStyle />
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 26px 64px" }}>

        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src="https://www.aisearchaudit.ai/wp-content/uploads/2026/07/ai-search-audit-logo-no-tagline.png" alt="AI Search Audit" style={{ height: 42, width: "auto", display: "block" }} />
            <div>
              <h1 style={{ fontSize: 27.6, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>AISA Automated Marketing Flows</h1>
              <div style={{ fontFamily: T.mono, fontSize: 12.6, color: T.inkSoft, marginTop: 3 }}>Full Technical &amp; User Documentation</div>
            </div>
          </div>
          <PageActions />
        </header>

        <NavBar />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, background: T.ink, borderRadius: 12, padding: "18px 22px", marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: T.sans, fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 4 }}>The complete documentation suite</div>
            <div style={{ fontFamily: T.mono, fontSize: 12.6, color: "#9AA4B0" }}>Maintained in British English · Kleecks internal · all files in the shared Drive folder</div>
          </div>
          <a href={DOC_URL} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: T.sans, fontSize: 14.6, fontWeight: 600, color: T.ink, background: T.accent, padding: "10px 18px", borderRadius: 8, textDecoration: "none" }}>Open the documentation folder<LinkIcon /></a>
        </div>

        <h2 style={{ fontFamily: T.sans, fontSize: 15.5, fontWeight: 800, color: T.ink, margin: "6px 2px 12px" }}>Documents</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16, marginBottom: 30 }}>
          {DOCS.map((d, i) => (
            <a key={i} href={DOC_URL} target="_blank" rel="noreferrer" className="kpi-card" style={{ ...card, textDecoration: "none", display: "block" }}>
              <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: T.accent, marginBottom: 8 }}>{d.meta}</div>
              <div style={{ fontFamily: T.sans, fontSize: 16.5, fontWeight: 700, color: T.ink, marginBottom: 8, lineHeight: 1.3 }}>{d.title}</div>
              <div style={{ fontFamily: T.sans, fontSize: 13.8, color: T.inkSoft, lineHeight: 1.55 }}>{d.desc}</div>
            </a>
          ))}
        </div>

        <h2 style={{ fontFamily: T.sans, fontSize: 15.5, fontWeight: 800, color: T.ink, margin: "6px 2px 12px" }}>System components</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {COMPONENTS.map((c, i) => (
            <div key={i} className="kpi-card" style={{ ...card, borderLeft: `5px solid ${c.color}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: c.color + "1f", color: c.color, flex: "0 0 auto" }}>{COMP_ICON[c.code] || <GearIcon size={17} />}</span><span style={{ fontFamily: T.mono, fontSize: 12.5, fontWeight: 700, letterSpacing: "0.04em", color: c.color }}>{c.code}</span></div>
              <div style={{ fontFamily: T.sans, fontSize: 16.5, fontWeight: 700, color: T.ink, marginBottom: 8, lineHeight: 1.3 }}>{c.title}</div>
              <div style={{ fontFamily: T.sans, fontSize: 13.8, color: T.inkSoft, lineHeight: 1.55 }}>{c.desc}</div>
            </div>
          ))}
        </div>

        <footer style={{ fontFamily: T.mono, fontSize: 11.5, color: T.inkSoft, marginTop: 28, textAlign: "center" }}>All documents are held in the shared Google Drive folder · Kleecks internal</footer>
      </div>
    </div>
  );
}
