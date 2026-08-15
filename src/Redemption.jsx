// src/Redemption.jsx — Redemption KPIs
//
// The question this page answers is not "how many people registered" but
// "how well did each outreach channel convert the people it actually touched".
// So every rate is measured against that channel's own SENT count, never
// against the total sign-up list.
//
//   Channel B (LinkedIn ABM) — contacts direct-messaged (Master list). Split in two:
//     · primary   = person match  (surname + first name)  → the strong signal
//     · secondary = company match (surname + company)     → the weaker signal
//     they are reported SEPARATELY, each over sent_B, never summed into one rate.
//   Channel A2 (cold email) — emails sent. One exact-email match → one rate,
//     plus engagement (opens / clicks / replies).
//
// Numerator comes from redemption_detail (one row per matched registrant, with
// its match_type); denominator (sent) from the latest attribution row for the
// channel; A2 engagement from the a2_engagement tab.

import { useEffect, useMemo, useState } from "react";
import {
  ATTRIBUTION_CSV_URL, REDEMPTION_DETAIL_CSV_URL, A2_ENGAGEMENT_TAB_CSV_URL,
  REFRESH_MINUTES, FAMILY, LINKS,
} from "./config.js";
import { T, NavBar, PageActions, PrintStyle, LinkIcon } from "./shared.jsx";

/* ---------- data helpers (local, no coupling to App.jsx) ---------- */
function parseCSV(text) {
  const rows = []; let row = [], val = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { val += '"'; i++; } else if (c === '"') q = false; else val += c; }
    else { if (c === '"') q = true; else if (c === ",") { row.push(val); val = ""; } else if (c === "\n") { row.push(val); rows.push(row); row = []; val = ""; } else if (c === "\r") {} else val += c; }
  }
  if (val.length || row.length) { row.push(val); rows.push(row); }
  const header = (rows.shift() || []).map(h => h.trim());
  return rows.filter(r => r.some(c => c !== "")).map(r => { const o = {}; header.forEach((h, i) => (o[h] = (r[i] ?? "").trim())); return o; });
}
async function fetchCSV(url) {
  if (!url) return [];
  const bust = (url.includes("?") ? "&" : "?") + "_=" + Date.now();
  const res = await fetch(url + bust, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseCSV(await res.text());
}
const num = v => { const n = parseFloat(String(v ?? "").replace(/[^\d.-]/g, "")); return isNaN(n) ? 0 : n; };
const pct = (a, b) => (b ? (a / b) * 100 : null);
const fmtPct = p => (p == null ? "—" : `${p.toFixed(2)}%`);
const lc = s => String(s ?? "").trim().toLowerCase();

// latest value of `sent` for a given channel in the attribution tab
function latestSent(attr, channel) {
  const rows = attr.filter(r => lc(r.channel) === lc(channel));
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at));
  return num(sorted[0].sent);
}
function latestRow(rows, channel) {
  const r = rows.filter(x => lc(x.channel) === lc(channel));
  if (!r.length) return null;
  return [...r].sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))[0];
}

/* ---------- small presentational pieces ---------- */
function BigStat({ label, value, sub, color }) {
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ fontFamily: T.mono, fontSize: 11.5, letterSpacing: "0.05em", textTransform: "uppercase", color: T.inkSoft, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: T.sans, fontSize: 34, fontWeight: 700, color: color || T.ink, lineHeight: 1.05, letterSpacing: "-0.01em" }}>{value}</div>
      {sub && <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkSoft, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// A KPI card for one channel, coloured with its family colour.
function ChannelCard({ fam, code, title, subtitle, primary, secondary, tiles, legend, detail }) {
  return (
    <div className="kpi-card" style={{ background: T.card, border: `1px solid ${T.line}`, borderLeft: `6px solid ${fam.color}`, borderRadius: 14, padding: "20px 22px", marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: T.mono, fontSize: 15, fontWeight: 700, color: fam.color, letterSpacing: "0.04em" }}>{code}</span>
          <span style={{ fontFamily: T.sans, fontWeight: 700, fontSize: 20, color: T.ink }}>{title}</span>
        </div>
        <span style={{ fontFamily: T.mono, fontSize: 12, color: T.inkSoft }}>{subtitle}</span>
      </div>

      {/* headline rates */}
      <div style={{ display: "flex", gap: 40, flexWrap: "wrap", paddingBottom: 18 }}>
        {primary && <BigStat {...primary} color={fam.color} />}
        {secondary && <BigStat {...secondary} color={fam.color} />}
      </div>

      {/* supporting tiles (counts) */}
      {tiles && tiles.length > 0 && (
        <div style={{ display: "flex", gap: 30, flexWrap: "wrap", paddingTop: 16, borderTop: `1px solid ${T.line}` }}>
          {tiles.map((t, i) => (
            <div key={i} style={{ minWidth: 78 }}>
              <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", color: T.inkSoft, marginBottom: 3 }}>{t.label}</div>
              <div style={{ fontFamily: T.sans, fontSize: 21, fontWeight: 650, color: t.color || T.ink }}>{t.value}</div>
              {t.sub && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{t.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* legend + optional detail link */}
      {(legend || detail) && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${T.line}`, background: fam.soft, margin: "16px -22px -20px", padding: "12px 22px 16px", borderRadius: "0 0 14px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          {legend && <span style={{ fontFamily: T.mono, fontSize: 11.8, color: T.inkSoft, lineHeight: 1.5 }}>{legend}</span>}
          {detail && <a href={detail.href} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: T.sans, fontSize: 13.4, fontWeight: 600, color: "#fff", background: fam.color, padding: "6px 12px", borderRadius: 6, textDecoration: "none", opacity: 0.92, whiteSpace: "nowrap" }}>{detail.label}<LinkIcon /></a>}
        </div>
      )}
    </div>
  );
}

export default function Redemption() {
  const [attr, setAttr] = useState([]);
  const [detail, setDetail] = useState([]);
  const [eng, setEng] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setError(null); setLoading(true);
      const [a, d, e] = await Promise.all([
        fetchCSV(ATTRIBUTION_CSV_URL), fetchCSV(REDEMPTION_DETAIL_CSV_URL), fetchCSV(A2_ENGAGEMENT_TAB_CSV_URL),
      ]);
      setAttr(a); setDetail(d); setEng(e); setUpdatedAt(new Date());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); const id = setInterval(load, REFRESH_MINUTES * 60000); return () => clearInterval(id); }, []);

  const B = useMemo(() => {
    const sent = latestSent(attr, "B");
    const rows = detail.filter(r => lc(r.channel) === "b");
    const persona = rows.filter(r => lc(r.match_type) === "persona").length;
    const azienda = rows.filter(r => lc(r.match_type) === "azienda").length;
    return { sent, persona, azienda, total: persona + azienda,
      ratePrimary: pct(persona, sent), rateSecondary: pct(azienda, sent) };
  }, [attr, detail]);

  const A2 = useMemo(() => {
    const sent = latestSent(attr, "A2");
    const redeemed = detail.filter(r => lc(r.channel) === "a2").length;
    // engagement: prefer the dedicated a2_engagement tab; fall back to the A2 attribution row
    const eRow = eng.length ? eng[eng.length - 1] : null;
    const aRow = latestRow(attr, "A2");
    const opens = eRow ? num(eRow.opens) : aRow ? num(aRow.opens) : 0;
    const clicks = eRow ? num(eRow.clicks) : aRow ? num(aRow.clicks) : 0;
    const replies = eRow ? num(eRow.replies) : aRow ? num(aRow.replies) : 0;
    const delivered = eRow ? num(eRow.delivered) : 0;
    return { sent, redeemed, rate: pct(redeemed, sent), opens, clicks, replies, delivered };
  }, [attr, detail, eng]);

  const famB = FAMILY.B, famA = FAMILY.A;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.sans, color: T.ink }}>
      <PrintStyle />
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 26px 64px" }}>

        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src="https://www.aisearchaudit.ai/wp-content/uploads/2026/07/ai-search-audit-logo-no-tagline.png" alt="AI Search Audit" style={{ height: 42, width: "auto", display: "block" }} />
            <div>
              <h1 style={{ fontSize: 27.6, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>AISA Automated Marketing Flows</h1>
              <div style={{ fontFamily: T.mono, fontSize: 12.6, color: T.inkSoft, marginTop: 3 }}>Redemption KPIs · {updatedAt ? `updated ${updatedAt.toLocaleTimeString("en-GB")}` : "loading…"}</div>
            </div>
          </div>
          <PageActions />
        </header>

        <NavBar />

        {error && (<div className="no-print" style={{ background: T.errSoft, border: `1px solid ${T.err}`, color: T.err, borderRadius: 8, padding: "10px 14px", fontFamily: T.mono, fontSize: 13.8, marginBottom: 16 }}>Error loading data: {error}. Check that attribution, redemption_detail and a2_engagement are published to the web as CSV.</div>)}

        <p style={{ fontFamily: T.sans, fontSize: 15, color: T.inkSoft, lineHeight: 1.6, maxWidth: 780, marginBottom: 22 }}>
          Redemption measures the share of the people <strong>each channel actually contacted</strong> who then registered on aisearchaudit.ai — always against that channel’s own sent count, not the total sign-up list.
        </p>

        {/* Channel B */}
        <ChannelCard
          fam={famB} code="B" title="LinkedIn ABM"
          subtitle={B.sent != null ? `${B.sent} contacts direct-messaged` : "awaiting attribution data"}
          primary={{ label: "Primary rate — person", value: fmtPct(B.ratePrimary), sub: `${B.persona} of ${B.sent ?? "—"} · surname + first name` }}
          secondary={{ label: "Secondary rate — company", value: fmtPct(B.rateSecondary), sub: `${B.azienda} of ${B.sent ?? "—"} · surname + company` }}
          tiles={[
            { label: "Contacted (sent)", value: B.sent ?? "—" },
            { label: "Redeemed — person", value: B.persona, color: famB.color },
            { label: "Redeemed — company", value: B.azienda, color: famB.color },
            { label: "Total redeemed", value: B.total },
          ]}
          legend="Primary and secondary are reported separately, never summed. Primary = surname and first name both match a Master contact; secondary = surname and company match but the first name does not."
        />

        {/* Channel A2 */}
        <ChannelCard
          fam={famA} code="A2" title="Cold outreach email"
          subtitle={A2.sent != null ? `${A2.sent.toLocaleString("en-GB")} emails sent` : "awaiting attribution data"}
          primary={{ label: "Redemption rate", value: fmtPct(A2.rate), sub: `${A2.redeemed} of ${A2.sent?.toLocaleString("en-GB") ?? "—"} · exact-email match` }}
          tiles={[
            { label: "Sent", value: A2.sent?.toLocaleString("en-GB") ?? "—" },
            { label: "Redeemed", value: A2.redeemed, color: famA.color },
            { label: "Opened", value: A2.opens ? A2.opens.toLocaleString("en-GB") : "—" },
            { label: "Clicked", value: A2.clicks || "—" },
            { label: "Replied", value: A2.replies || "—" },
          ]}
          legend="A single exact-email match: a person registered with the very address we emailed. Engagement (opens · clicks · replies) is drawn from the a2_engagement tab; clicks are the de-botted Analytics figure."
          detail={{ label: "See details in Zoho Campaigns", href: LINKS.campaignsReport }}
        />

        {/* method note */}
        <div className="avoid-break" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "16px 20px", marginTop: 6 }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: T.inkSoft, marginBottom: 8 }}>How these figures are built</div>
          <div style={{ fontFamily: T.sans, fontSize: 13.8, color: T.inkSoft, lineHeight: 1.65 }}>
            Every new registrant is classified once, deterministically, by the K5 flow — excluded (internal/test), A2 (emailed), B (direct-messaged) or other — and the matched ones are written to <strong>redemption_detail</strong> with their match type. The denominator for each channel is the latest <strong>sent</strong> figure logged in <strong>attribution</strong>. Rates therefore move only as genuine registrations accrue against a fixed, auditable contact base.
          </div>
        </div>

        <footer style={{ fontFamily: T.mono, fontSize: 11.5, color: T.inkSoft, marginTop: 28, textAlign: "center" }}>Data: Google Sheet «AISA - KPI Log» — attribution · redemption_detail · a2_engagement · Kleecks internal</footer>
      </div>
    </div>
  );
}
