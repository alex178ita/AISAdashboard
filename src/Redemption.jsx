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
  ATTRIBUTION_CSV_URL, REDEMPTION_DETAIL_CSV_URL, A2_ENGAGEMENT_TAB_CSV_URL, B_MASTER_CSV_URL,
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
// Redemption and reply rates are small by nature (a handful against hundreds or
// thousands), so a fixed 2-decimal format would collapse a real single event to
// 0.00%. Scale precision to magnitude — and keep 3 decimals even at exactly zero,
// so an empty rate reads "0.000%" and sits visually alongside the live ones
// rather than looking like a different, blunter number.
const fmtPct = p => {
  if (p == null) return "—";
  const d = (p > 0 && p < 0.1) ? 4 : (p >= 1 ? 2 : 3);
  return `${p.toFixed(d)}%`;
};
const lc = s => String(s ?? "").trim().toLowerCase();

// Plan split on a redemption_detail row, from its raw WordPress `role`.
//   paid = role "customer" — the person started the paying journey. Amount is
//          deliberately not considered: a €0 / payment-pending customer still
//          counts as paid, because the role already marks intent.
//   free = any other populated role (typically "subscriber").
// A row with an EMPTY role is counted in neither, so free + paid can be less
// than the redeemed total until every matched row carries a role. That is the
// honest reading — it makes an unclassified redemption visible rather than
// silently inflating "free".
const isPaid = r => /customer/i.test(String(r?.role ?? ""));
const isFree = r => { const x = lc(r?.role); return x !== "" && !x.includes("customer"); };

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
  const [master, setMaster] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setError(null); setLoading(true);
      const [a, d, e, m] = await Promise.all([
        fetchCSV(ATTRIBUTION_CSV_URL), fetchCSV(REDEMPTION_DETAIL_CSV_URL),
        fetchCSV(A2_ENGAGEMENT_TAB_CSV_URL), fetchCSV(B_MASTER_CSV_URL),
      ]);
      setAttr(a); setDetail(d); setEng(e); setMaster(m); setUpdatedAt(new Date());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); const id = setInterval(load, REFRESH_MINUTES * 60000); return () => clearInterval(id); }, []);

  const B = useMemo(() => {
    const sent = latestSent(attr, "B");
    const rows = detail.filter(r => lc(r.channel) === "b");
    const persona = rows.filter(r => lc(r.match_type) === "persona").length;
    const azienda = rows.filter(r => lc(r.match_type) === "azienda").length;
    const paid = rows.filter(isPaid).length;
    const free = rows.filter(isFree).length;
    // Replied / funnel states come from the Master list column "stato".
    const replied = master.filter(r => lc(r.stato) === "risposto").length;
    const connected = master.filter(r => lc(r.stato) === "connesso_no_dm").length;
    const dmSent = master.filter(r => lc(r.stato) === "dm_inviato").length;
    return { sent, persona, azienda, total: persona + azienda, paid, free, replied, connected, dmSent,
      ratePrimary: pct(persona, sent), rateSecondary: pct(azienda, sent),
      rateReplied: pct(replied, sent), rateRedeemed: pct(persona + azienda, sent) };
  }, [attr, detail, master]);

  const A2 = useMemo(() => {
    const sent = latestSent(attr, "A2");
    const rows = detail.filter(r => lc(r.channel) === "a2");
    const redeemed = rows.length;
    const paid = rows.filter(isPaid).length;
    const free = rows.filter(isFree).length;
    // engagement: prefer the dedicated a2_engagement tab; fall back to the A2 attribution row
    const eRow = eng.length ? eng[eng.length - 1] : null;
    const aRow = latestRow(attr, "A2");
    const opens = eRow ? num(eRow.opens) : aRow ? num(aRow.opens) : 0;
    const clicks = eRow ? num(eRow.clicks) : aRow ? num(aRow.clicks) : 0;
    const replies = eRow ? num(eRow.replies) : aRow ? num(aRow.replies) : 0;
    const delivered = eRow ? num(eRow.delivered) : 0;
    return { sent, redeemed, paid, free, opens, clicks, replies, delivered,
      rateReplied: pct(replies, sent), rateRedeemed: pct(redeemed, sent) };
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

        <p style={{ fontFamily: T.sans, fontSize: 15, color: T.inkSoft, lineHeight: 1.6, maxWidth: 820, marginBottom: 22 }}>
          Two headline figures per channel, on the same footing. <strong>Replied</strong> is engagement — someone reacted to the outreach. <strong>Redeemed</strong> is the outcome that matters — they went on to register on aisearchaudit.ai. Both are measured against the number of people <strong>each channel actually contacted</strong>, never the total sign-up list.
        </p>

        {/* Channel B */}
        <ChannelCard
          fam={famB} code="B" title="LinkedIn ABM"
          subtitle={B.sent != null ? `${B.sent} contacts direct-messaged` : "awaiting attribution data"}
          primary={{ label: "Replied", value: fmtPct(B.rateReplied), sub: `${B.replied} of ${B.sent ?? "—"} · replied to the DM` }}
          secondary={{ label: "Redeemed", value: fmtPct(B.rateRedeemed), sub: `${B.total} of ${B.sent ?? "—"} · registered on AISA` }}
          tiles={[
            { label: "Contacted (sent)", value: B.sent ?? "—" },
            { label: "Connected", value: B.connected, sub: "accepted, no DM yet" },
            { label: "Replied", value: B.replied, color: famB.color },
            { label: "Redeemed — person", value: B.persona, color: famB.color, sub: `${fmtPct(B.ratePrimary)} · primary` },
            { label: "Redeemed — company", value: B.azienda, color: famB.color, sub: `${fmtPct(B.rateSecondary)} · secondary` },
            { label: "of which free", value: B.free, sub: "subscriber" },
            { label: "of which paid", value: B.paid, sub: "customer" },
          ]}
          legend="Replied counts Master state «risposto». Redeemed splits into primary (surname + first name) and secondary (surname + company), reported separately and never summed. «Free / paid» splits the same redeemed by WordPress role: paid = customer (started the paying journey, amount aside), free = subscriber. «Connected» (accepted the invite but not yet messaged) is shown for funnel context."
        />

        {/* Channel A2 */}
        <ChannelCard
          fam={famA} code="A2" title="Cold outreach email"
          subtitle={A2.sent != null ? `${A2.sent.toLocaleString("en-GB")} emails sent` : "awaiting attribution data"}
          primary={{ label: "Replied", value: fmtPct(A2.rateReplied), sub: `${A2.replies} of ${A2.sent?.toLocaleString("en-GB") ?? "—"} · replied to the email` }}
          secondary={{ label: "Redeemed", value: fmtPct(A2.rateRedeemed), sub: `${A2.redeemed} of ${A2.sent?.toLocaleString("en-GB") ?? "—"} · registered on AISA` }}
          tiles={[
            { label: "Sent", value: A2.sent?.toLocaleString("en-GB") ?? "—" },
            { label: "Opened", value: A2.opens ? A2.opens.toLocaleString("en-GB") : "—" },
            { label: "Clicked", value: A2.clicks || "—" },
            { label: "Replied", value: A2.replies || "—", color: famA.color },
            { label: "Redeemed", value: A2.redeemed, color: famA.color },
            { label: "of which free", value: A2.free, sub: "subscriber" },
            { label: "of which paid", value: A2.paid, sub: "customer" },
          ]}
          legend="Replied is a genuine email reply (from the a2_engagement tab); clicks are the de-botted Analytics figure. Redeemed is an exact-email match: a person registered with the very address we emailed. «Free / paid» splits it by WordPress role: paid = customer (started the paying journey, amount aside), free = subscriber."
          detail={{ label: "See details in Zoho Campaigns", href: LINKS.campaignsReport }}
        />

        {/* transparency note on the A2 denominator */}
        <div className="avoid-break" style={{ display: "flex", gap: 10, alignItems: "flex-start", background: T.warnSoft, border: `1px solid ${T.warn}33`, borderRadius: 10, padding: "12px 16px", marginTop: -8, marginBottom: 18 }}>
          <span style={{ fontFamily: T.mono, fontSize: 15, color: T.warn, lineHeight: 1.2, flex: "0 0 auto" }}>ⓘ</span>
          <span style={{ fontFamily: T.sans, fontSize: 13.2, color: T.inkSoft, lineHeight: 1.6 }}>
            The A2 <strong>sent</strong> figure is the count logged by the nightly collector, not a live tally. Because the cold-outreach flow keeps sending during the day, the live list can be a few dozen ahead of this number until the collector next runs — a slight, expected lag on the total that does not materially affect the rate.
          </span>
        </div>

        {/* method note */}
        <div className="avoid-break" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "16px 20px", marginTop: 6 }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: T.inkSoft, marginBottom: 8 }}>How these figures are built</div>
          <div style={{ fontFamily: T.sans, fontSize: 13.8, color: T.inkSoft, lineHeight: 1.65 }}>
            <strong>Redeemed</strong> is classified once, deterministically, by the K5 flow — every new registrant is marked excluded (internal/test), A2 (emailed), B (direct-messaged) or other, and the matched ones are written to <strong>redemption_detail</strong> with their match type. <strong>Replied</strong> is engagement, read live from each channel’s own source: the a2_engagement tab for email, and the Master list state «risposto» for LinkedIn. Denominators are the latest <strong>sent</strong> figure in <strong>attribution</strong>, so both rates move against a fixed, auditable contact base. Each redeemed registrant also carries its WordPress <strong>role</strong>, split here into <strong>paid</strong> (role <em>customer</em> — the paying journey was started, amount aside) and <strong>free</strong> (role <em>subscriber</em>); a redemption whose role is not yet set is shown in neither, so the split never silently overstates free. The two channels are not symmetrical in richness — for email we also see opens and clicks; for LinkedIn we additionally see who accepted the connection — but Replied and Redeemed mean the same thing on both.
          </div>
        </div>

        <footer style={{ fontFamily: T.mono, fontSize: 11.5, color: T.inkSoft, marginTop: 28, textAlign: "center" }}>Data: Google Sheet «AISA - KPI Log» — attribution · redemption_detail · a2_engagement · Kleecks internal</footer>
      </div>
    </div>
  );
}
