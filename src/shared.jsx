// src/shared.jsx — shared chrome for every view: theme tokens, top navigation,
// and the two per-page action buttons (Save to PDF · Share via email).
//
// Kept dependency-free on purpose. "Save to PDF" is the browser's own print
// dialog (window.print) steered by a small @media print stylesheet, so the
// output matches what is on screen and there is nothing to install. "Share via
// email" opens the user's mail client with a British-English body that links
// back to the live dashboard — no data leaves the browser.

import { NAV, DASHBOARD_URL } from "./config.js";

export const T = {
  sans: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace",
  bg: "#F6F7F9", ink: "#12151A", inkSoft: "#6A7280", line: "#E6E9ED", card: "#FFFFFF",
  accent: "#2FB980", ok: "#1FA971", okSoft: "#E4F6EE", warn: "#C97A1C", warnSoft: "#FBF0E1",
  err: "#D4544E", errSoft: "#FBE9E8",
};

export function LinkIcon() {
  return (<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>);
}

// Per-view "share" copy, in British English, opened in the user's mail client.
const SHARE = {
  "": {
    subject: "AISA Automated Marketing Flows — live dashboard",
    body: `Hello,\n\nHere is the live AISA Automated Marketing Flows dashboard.\n\nThe "Flows Data & Stats" view shows the real-time status and run metrics of every Make.com automation behind aisearchaudit.ai — the AISA audit and cold-outreach flows (family A), the LinkedIn ABM sequence (family B), the content-generation flows (family C) and the service collectors.\n\nOpen it here: ${DASHBOARD_URL}\n\nKind regards`,
  },
  "#/kpis": {
    subject: "AISA Redemption KPIs — outreach-to-registration performance",
    body: `Hello,\n\nHere is the Redemption KPIs view of the AISA dashboard.\n\nIt measures how many of the people we contacted through each channel went on to register on aisearchaudit.ai: the LinkedIn ABM channel (family B), split into a primary rate (person matched by surname and first name) and a secondary rate (matched by surname and company), and the cold-outreach email channel (A2), together with its engagement figures.\n\nOpen it here: ${DASHBOARD_URL}#/kpis\n\nKind regards`,
  },
  "#/docs": {
    subject: "AISA — full technical & user documentation",
    body: `Hello,\n\nHere is the documentation hub for the AISA marketing-automation system: the technical and user manuals, the KPI monitoring specification, the verification sheets and the tools cost summary.\n\nOpen it here: ${DASHBOARD_URL}#/docs\n\nKind regards`,
  },
  "#/charts": {
    subject: "AISA — statistical graphs over time",
    body: `Hello,\n\nHere is the statistical view of the AISA dashboard: Make operations per day by family against the plan limit, Firecrawl credit burn-down, campaign list health, and runs and errors per day.\n\nOpen it here: ${DASHBOARD_URL}#/charts\n\nKind regards`,
  },
};

function routeKey() {
  const h = typeof window !== "undefined" ? window.location.hash : "";
  if (h.startsWith("#/kpis")) return "#/kpis";
  if (h.startsWith("#/docs")) return "#/docs";
  if (h.startsWith("#/charts")) return "#/charts";
  return "";
}

// The two buttons shown on every page, top-right.
export function PageActions() {
  const key = routeKey();
  const share = SHARE[key] || SHARE[""];
  const mailto = `mailto:?subject=${encodeURIComponent(share.subject)}&body=${encodeURIComponent(share.body)}`;
  const btn = {
    fontFamily: T.sans, fontSize: 13.6, fontWeight: 600, padding: "8px 13px", borderRadius: 8,
    border: `1px solid ${T.line}`, background: "#fff", color: T.ink, cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 7, textDecoration: "none",
  };
  return (
    <div className="no-print" style={{ display: "flex", gap: 8 }}>
      <button onClick={() => window.print()} style={btn} title="Save this page as PDF via the print dialogue">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
        Save to PDF
      </button>
      <a href={mailto} style={btn} title="Share this view by email">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
        Share via email
      </a>
    </div>
  );
}

// The horizontal tab bar sitting above the black status strip.
export function NavBar() {
  const key = routeKey();
  return (
    <nav className="no-print" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16, borderBottom: `1px solid ${T.line}`, paddingBottom: 2 }}>
      {NAV.map(item => {
        const active = item.key === key;
        return (
          <a key={item.key || "home"} href={item.key || "#/"}
             onClick={() => { if (!item.key) { history.replaceState(null, "", window.location.pathname); window.dispatchEvent(new HashChangeEvent("hashchange")); } }}
             style={{
               fontFamily: T.sans, fontSize: 14.4, fontWeight: active ? 700 : 600,
               color: active ? T.ink : T.inkSoft, textDecoration: "none",
               padding: "9px 15px", borderRadius: "8px 8px 0 0",
               borderBottom: active ? `2.5px solid ${T.accent}` : "2.5px solid transparent",
               background: active ? "#fff" : "transparent",
             }}>
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

// Injected once at the top of every page: print rules so "Save to PDF" yields a
// clean document (chrome hidden, cards not split across pages, colours kept).
export function PrintStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      * { box-sizing: border-box; }
      a { color: inherit; }
      @media print {
        .no-print { display: none !important; }
        body { background: #fff !important; }
        .kpi-card, section, .avoid-break { break-inside: avoid; page-break-inside: avoid; }
        @page { margin: 14mm; }
      }
    `}</style>
  );
}
