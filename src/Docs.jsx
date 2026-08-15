// src/Docs.jsx — Full Technical & User Documentation
//
// A hub view: it does not embed the documents (they live in Google Drive) but
// presents the suite and links straight into the shared folder, keeping the
// same navigation, print and share chrome as every other page.

import { DOC_URL } from "./config.js";
import { T, NavBar, PageActions, PrintStyle, LinkIcon } from "./shared.jsx";

const DOCS = [
  { title: "Marketing Automation — User & Technical Manual", meta: "PDF · 74 pages · 15 chapters", desc: "The complete operating manual: architecture, every Make.com flow, the KPI model, and day-to-day operating procedures." },
  { title: "KPI Monitoring Documentation", meta: "PDF · v1.5", desc: "How each KPI is defined, collected and logged — the specification behind this dashboard and the attribution model." },
  { title: "Flow B — Technical Documentation", meta: "PDF · v2", desc: "The LinkedIn ABM sequence end to end: ingestion, CRM dedup, connection, DM writer and send, reply alerting." },
  { title: "Flow C2 — Technical Documentation & Verification", meta: "PDF · v1.1", desc: "Blog automation: topic radar, blog writer and publisher, with the verification sheet that proves each step." },
  { title: "Design vs Delivery", meta: "PDF · v1.0", desc: "What was specified against what was built — the reconciliation record for the automation programme." },
  { title: "Tools Cost Summary", meta: "XLSX · v3", desc: "Per-tool running costs across the whole stack (Make, Firecrawl, ZeptoMail, Zoho, Anthropic and the rest)." },
];

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
              <h1 style={{ fontSize: 27.6, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>AISA Automated Marketing Flows</h1>
              <div style={{ fontFamily: T.mono, fontSize: 12.6, color: T.inkSoft, marginTop: 3 }}>Full Technical &amp; User Documentation</div>
            </div>
          </div>
          <PageActions />
        </header>

        <NavBar />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, background: T.ink, borderRadius: 12, padding: "18px 22px", marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: T.sans, fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 4 }}>The complete documentation suite</div>
            <div style={{ fontFamily: T.mono, fontSize: 12.6, color: "#9AA4B0" }}>Maintained in British English · Kleecks internal</div>
          </div>
          <a href={DOC_URL} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: T.sans, fontSize: 14.6, fontWeight: 600, color: T.ink, background: T.accent, padding: "10px 18px", borderRadius: 8, textDecoration: "none" }}>Open the documentation folder<LinkIcon /></a>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {DOCS.map((d, i) => (
            <a key={i} href={DOC_URL} target="_blank" rel="noreferrer" className="kpi-card" style={{ ...card, textDecoration: "none", display: "block" }}>
              <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: T.accent, marginBottom: 8 }}>{d.meta}</div>
              <div style={{ fontFamily: T.sans, fontSize: 16.5, fontWeight: 700, color: T.ink, marginBottom: 8, lineHeight: 1.3 }}>{d.title}</div>
              <div style={{ fontFamily: T.sans, fontSize: 13.8, color: T.inkSoft, lineHeight: 1.55 }}>{d.desc}</div>
            </a>
          ))}
        </div>

        <footer style={{ fontFamily: T.mono, fontSize: 11.5, color: T.inkSoft, marginTop: 28, textAlign: "center" }}>All documents are held in the shared Google Drive folder · Kleecks internal</footer>
      </div>
    </div>
  );
}
