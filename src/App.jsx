import React, { useEffect, useMemo, useState } from "react";
import {
  RUNS_CSV_URL, FIRECRAWL_CSV_URL, EMAIL_STATS_CSV_URL, CAMPAIGNS_CSV_URL,
  A2_ENGAGEMENT_CSV_URL, B_FUNNEL_CSV_URL, REFRESH_MINUTES, LINKS, FLOWS, SERVICE_FLOWS, FAMILY,
} from "./config.js";
import BlogPanel from "./BlogPanel.jsx";
import Charts from "./Charts.jsx";
import Redemption from "./Redemption.jsx";
import Docs from "./Docs.jsx";
import { NavBar, PageActions } from "./shared.jsx";
import { FamilyIcon, GearIcon } from "./icons.jsx";

const T = {
  sans: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace",
  bg: "#F6F7F9", ink: "#12151A", inkSoft: "#6A7280", line: "#E6E9ED", card: "#FFFFFF",
  accent: "#2FB980", ok: "#1FA971", okSoft: "#E4F6EE", warn: "#C97A1C", warnSoft: "#FBF0E1",
  err: "#D4544E", errSoft: "#FBE9E8",
};
const STATUS = {
  active:  { dot: "#1FA971", label: "active" },
  standby: { dot: "#C9A227", label: "standby" },
  invalid: { dot: "#D4544E", label: "needs attention" },
  soon:    { dot: "#B4BAC4", label: "not yet available" },
};

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
// Google serves the published CSVs with a long cache header, so a plain fetch()
// on "Refresh now" was often replayed straight out of the browser cache — the
// button worked, the data just came back byte-identical. no-store + a unique
// query param forces a real round trip every time.
async function fetchCSV(url) {
  if (!url) return [];
  const bust = (url.includes("?") ? "&" : "?") + "_=" + Date.now();
  const res = await fetch(url + bust, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseCSV(await res.text());
}

const num = v => { const n = parseFloat(String(v ?? "").replace(/[^\d.-]/g, "")); return isNaN(n) ? 0 : n; };
const fmtWhen = iso => { if (!iso) return "—"; const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };
const fmtDur = s => { s = Math.round(s); if (!s) return "—"; const m = Math.floor(s / 60), r = s % 60; return m ? `${m}m ${r}s` : `${r}s`; };

/* ---------- date range handling -------------------------------------------
   The sheets do not all emit the same timestamp format, and the <input type=
   "date"> gives us a plain yyyy-mm-dd. dayKey() normalises anything we might
   get into a sortable yyyy-mm-dd so a plain string comparison is valid:
     "2026-07-30T13:01:14.085Z" · "2026-07-30 15:01" → 2026-07-30
     "30/07/2026 15:01:14" · "30-07-2026"            → 2026-07-30  (day first)
   Ambiguous d/m vs m/d dates are read day-first (Make + Italian sheets).     */
const keyOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgoKey = n => { const d = new Date(); d.setDate(d.getDate() - n); return keyOf(d); };

function dayKey(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);          // yyyy-mm-dd
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);              // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(s);                                            // last resort
  return isNaN(d) ? "" : keyOf(d);
}
// Timestamp column names used across the KPI Log tabs / Analytics exports.
const DATE_KEYS = ["started_at", "logged_at", "event_time", "event_date", "timestamp", "created_at", "data", "date", "ts", "day"];
function rowDay(row) {
  for (const k of DATE_KEYS) { const v = row?.[k]; if (v) { const d = dayKey(v); if (d) return d; } }
  return "";
}

function Metric({ label, value, sub, color }) {
  return (
    <div style={{ minWidth: 78 }}>
      <div style={{ fontFamily: T.mono, fontSize: 11.5, letterSpacing: "0.04em", textTransform: "uppercase", color: T.inkSoft, marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: T.sans, fontSize: 23, fontWeight: 650, color: color || T.ink, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontFamily: T.mono, fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function LinkIcon() {
  return (<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>);
}
function DetailLink({ label, href, color }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: T.sans, fontSize: 13.8, fontWeight: 600, color: "#fff", background: color, padding: "6px 12px", borderRadius: 6, textDecoration: "none", opacity: 0.92 }}>
      {label}<LinkIcon />
    </a>
  );
}
function StatusDot({ status }) {
  const s = STATUS[status] || STATUS.soon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 9, height: 9, borderRadius: 99, background: s.dot, boxShadow: `0 0 0 3px ${s.dot}22` }} />
      <span style={{ fontFamily: T.mono, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.06em", color: T.inkSoft }}>{s.label}</span>
    </span>
  );
}

function statsFor(runs, scenarioId) {
  const ids = (Array.isArray(scenarioId) ? scenarioId : [scenarioId]).map(String);
  const r = runs.filter(x => ids.includes(String(x.flow_id)));
  if (!r.length) return null;
  const ok = r.filter(x => (x.status || "").toLowerCase() === "success").length;
  const err = r.length - ok;
  const durs = r.map(x => num(x.duration_s)).filter(Boolean);
  const avg = durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : 0;
  const sorted = [...r].sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
  const byDay = {}; r.forEach(x => { const d = dayKey(x.started_at); if (d) byDay[d] = (byDay[d] || 0) + 1; });
  const days = Object.keys(byDay).length; const perDay = days ? (r.length / days) : r.length;
  return { total: r.length, ok, err, rate: r.length ? Math.round((ok / r.length) * 100) : null, avg, last: sorted[0], perDay };
}

function FlowStrip({ flow, fam, data }) {
  const isPlaceholder = flow.placeholder;
  const status = isPlaceholder ? "soon" : (flow.status || (data?.st ? "active" : "standby"));
  return (
    <div style={{ background: T.card, border: `1px solid ${T.line}`, borderLeft: `5px solid ${fam.color}`, borderRadius: 12, padding: "14px 18px 0", marginBottom: 12, opacity: isPlaceholder ? 0.6 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: isPlaceholder ? 12 : 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: T.mono, fontSize: 13.8, fontWeight: 700, color: fam.color, letterSpacing: "0.04em" }}>{flow.code}</span>
          <span style={{ fontFamily: T.sans, fontWeight: 650, fontSize: 17.2, color: T.ink }}>{flow.name}</span>
        </div>
        <StatusDot status={status} />
      </div>
      {!isPlaceholder ? (
        <>
          <div style={{ display: "flex", gap: 26, flexWrap: "wrap", paddingBottom: 14 }}>
            {data?.metrics?.map((m, i) => (<Metric key={i} label={m.label} value={m.value} sub={m.sub} color={m.color} />))}
          </div>
          <div style={{ borderTop: `1px solid ${T.line}`, margin: "0 -18px", padding: "10px 18px", display: "flex", gap: 10, flexWrap: "wrap", background: fam.soft }}>
            {flow.makeUrl && <DetailLink label={`See make.com ${flow.code} flow`} href={flow.makeUrl} color={fam.color} />}
            {flow.detail && <DetailLink label={flow.detail.label} href={LINKS[flow.detail.url]} color={fam.color} />}
          </div>
        </>
      ) : (
        <div style={{ paddingBottom: 14, fontFamily: T.mono, fontSize: 13.8, color: T.inkSoft }}>Reserved slot — this flow has not been built yet.</div>
      )}
    </div>
  );
}

const inp = { fontFamily: T.mono, fontSize: 12.6, padding: "5px 8px", border: `1px solid ${T.line}`, borderRadius: 6, background: "#fff", color: T.ink };

// One-click ranges, so the common cases don't need the date pickers at all.
const PRESETS = [
  { label: "today",  get: () => [daysAgoKey(0), daysAgoKey(0)] },
  { label: "7d",     get: () => [daysAgoKey(6), daysAgoKey(0)] },
  { label: "30d",    get: () => [daysAgoKey(29), daysAgoKey(0)] },
];

// One flow per row, left-justified: dot + name in a fixed-width column so the
// grey detail text lines up vertically down the banner. The status word is
// spelled out next to the dot — an 8px amber dot next to an 8px green one is
// not a readable difference on a black background, so a flow in standby has to
// SAY standby. Non-active rows are dimmed as a second cue.
function RecapItem({ name, status, note, runs }) {
  const key = STATUS[status] ? status : "standby";
  const s = STATUS[key];
  const off = key !== "active";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", flexWrap: "wrap", padding: "3px 0", opacity: off ? 0.62 : 1 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 210, flex: "0 0 auto" }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: s.dot, flex: "0 0 auto" }} />
        <span style={{ fontFamily: T.sans, fontSize: 14.9, fontWeight: 600, color: "#fff" }}>{name}</span>
      </span>
      <span style={{ fontFamily: T.mono, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: s.dot, minWidth: 104, flex: "0 0 auto" }}>
        {s.label}
      </span>
      <span style={{ fontFamily: T.mono, fontSize: 11.5, color: "#8A94A6" }}>
        {note ? note + " · " : ""}{runs ? `${runs.total} runs · last ${fmtWhen(runs.last?.started_at)}` : "no runs yet"}
      </span>
    </div>
  );
}

function BFunnelPanel({ fam, f }) {
  const tiles = [
    { label: "Invites sent", value: f.invited || "—" },
    { label: "Excluded (CRM)", value: f.excluded || "—", color: f.excluded ? T.warn : T.ink },
    { label: "Accepted", value: f.accepted || "—", sub: f.accRate != null ? `${f.accRate}% acc.` : null, color: fam.color },
    { label: "DM sent", value: f.dm || "—", sub: f.dmRate != null ? `${f.dmRate}% of acc.` : null, color: fam.color },
    { label: "Replies", value: f.replies || "—", sub: f.replyRate != null ? `${f.replyRate}% reply` : null, color: f.replies ? T.ok : T.ink },
  ];
  return (
    <div style={{ background: T.card, border: `1px solid ${T.line}`, borderLeft: `5px solid ${fam.color}`, borderRadius: 12, padding: "14px 18px", marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: T.sans, fontWeight: 700, fontSize: 16.1, color: T.ink }}>LinkedIn outreach funnel</span>
        <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.inkSoft }}>{f.hasData ? "from KPI_Log" : "awaiting data — publish the KPI_Log tab as CSV and set B_FUNNEL_CSV_URL"}</span>
      </div>
      <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
        {tiles.map((m, i) => (<Metric key={i} label={m.label} value={m.value} sub={m.sub} color={m.color} />))}
      </div>
    </div>
  );
}

export default function App() {
  const [runs, setRuns] = useState([]);
  const [emailStats, setEmailStats] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [firecrawl, setFirecrawl] = useState([]);
  const [engagement, setEngagement] = useState([]);
  const [bkpi, setBkpi] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [visibleFams, setVisibleFams] = useState({ A: true, B: true, C: true, D: true });
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  async function load() {
    try {
      setError(null); setLoading(true);
      const [r, e, c, f, g, b] = await Promise.all([
        fetchCSV(RUNS_CSV_URL), fetchCSV(EMAIL_STATS_CSV_URL), fetchCSV(CAMPAIGNS_CSV_URL),
        fetchCSV(FIRECRAWL_CSV_URL), fetchCSV(A2_ENGAGEMENT_CSV_URL), fetchCSV(B_FUNNEL_CSV_URL),
      ]);
      const seen = new Set(); const rr = [];
      r.forEach(x => { const k = x.execution_id || JSON.stringify(x); if (!seen.has(k)) { seen.add(k); rr.push(x); } });
      setRuns(rr); setEmailStats(e); setCampaigns(c); setFirecrawl(f); setEngagement(g); setBkpi(b); setUpdatedAt(new Date());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); const id = setInterval(load, REFRESH_MINUTES * 60000); return () => clearInterval(id); }, []);

  // One predicate, applied to every dataset that carries a timestamp, so the
  // range drives the whole page instead of just the per-flow run counters.
  const rangeOn = Boolean(fromDate || toDate);
  const inRange = useMemo(() => {
    if (!fromDate && !toDate) return () => true;
    return row => {
      const d = rowDay(row);
      if (!d) return true;                       // undated rows are never hidden
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    };
  }, [fromDate, toDate]);

  const runsF       = useMemo(() => runs.filter(inRange), [runs, inRange]);
  const emailStatsF = useMemo(() => emailStats.filter(inRange), [emailStats, inRange]);
  const campaignsF  = useMemo(() => campaigns.filter(inRange), [campaigns, inRange]);
  const engagementF = useMemo(() => engagement.filter(inRange), [engagement, inRange]);
  const firecrawlF  = useMemo(() => firecrawl.filter(inRange), [firecrawl, inRange]);
  const bkpiF       = useMemo(() => bkpi.filter(inRange), [bkpi, inRange]);

  const emailAgg = useMemo(() => {
    if (!emailStatsF.length) return null;
    let sent = 0, opens = 0, clicks = 0, bounces = 0;
    emailStatsF.forEach(e => { const t = (e.event_type || "").toLowerCase(); const n = num(e.count) || 1;
      if (t.includes("deliver") || t === "sent" || t.includes("email_sent")) sent += n;
      else if (t.includes("open")) opens += n; else if (t.includes("click")) clicks += n; else if (t.includes("bounce")) bounces += n; });
    return { sent, opens, clicks, bounces };
  }, [emailStatsF]);

  const campAgg = useMemo(() => {
    if (!campaignsF.length) return null;
    const last = [...campaignsF].sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))[0] || {};
    return { active: num(last.list_active), unsub: num(last.list_unsub), bounce: num(last.list_bounce), at: last.logged_at };
  }, [campaignsF]);

  const engAgg = useMemo(() => {
    if (!engagementF.length) return null;
    const m = {}; engagementF.forEach(x => { m[(x.metric || "").toLowerCase()] = num(x.n); });
    return { opens: m.opens || 0, clicks: m.clicks || 0, unsub: m.unsubscribes || 0 };
  }, [engagementF]);

  const fcAgg = useMemo(() => {
    if (!firecrawlF.length) return null;
    const rows = firecrawlF
      .filter(r => r.remaining_credits !== undefined && r.remaining_credits !== "")
      .map(r => ({ t: r.logged_at, v: num(r.remaining_credits), plan: num(r.plan_credits), end: r.billing_period_end }))
      .sort((a, b) => new Date(a.t) - new Date(b.t));
    if (!rows.length) return null;
    const last = rows[rows.length - 1], first = rows[0];
    const daysSpan = Math.max(1, (new Date(last.t) - new Date(first.t)) / 86400000);
    const burn = Math.max(0, first.v - last.v) / daysSpan;
    return { remaining: last.v, plan: last.plan, burn, end: last.end };
  }, [firecrawlF]);

  const bFunnel = useMemo(() => {
    const c = { invito_inviato: 0, escluso_crm: 0, connessione_accettata: 0, dm_inviato: 0, risposta: 0 };
    bkpiF.forEach(x => { const ev = (x.evento || "").trim().toLowerCase(); if (ev in c) c[ev] += 1; });
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
    return {
      invited: c.invito_inviato, accepted: c.connessione_accettata, dm: c.dm_inviato,
      replies: c.risposta, excluded: c.escluso_crm, hasData: bkpiF.length > 0,
      accRate: pct(c.connessione_accettata, c.invito_inviato),
      replyRate: pct(c.risposta, c.invito_inviato),
      dmRate: pct(c.dm_inviato, c.connessione_accettata),
    };
  }, [bkpiF]);

  function metricsForFlow(flow) {
    const st = statsFor(runsF, flow.scenarioId);
    const base = st ? [
      { label: "Runs", value: st.total },
      { label: "Success", value: st.rate == null ? "—" : `${st.rate}%`, color: st.rate >= 90 ? T.ok : st.rate == null ? T.ink : T.err },
      { label: "Avg. time", value: fmtDur(st.avg) },
      { label: "Runs/day", value: st.perDay ? st.perDay.toFixed(1) : "—" },
      { label: "Last run", value: st.last ? fmtWhen(st.last.started_at) : "—" },
      { label: "Errors", value: st.err, color: st.err ? T.warn : T.ink },
    ] : [{ label: "Runs", value: "—" }, { label: "Success", value: "—" }, { label: "Last run", value: "—" }];
    if (flow.code === "A2") {
      if (campAgg) {
        base.push({ label: "Emails sent", value: campAgg.active + campAgg.unsub, sub: `${campAgg.active} active`, color: T.accent });
        base.push({ label: "Unsubscribed", value: campAgg.unsub, color: campAgg.unsub ? T.warn : T.ink });
        base.push({ label: "Bounces", value: campAgg.bounce, color: campAgg.bounce ? T.err : T.ink });
      }
      if (engAgg) { base.push({ label: "Opened", value: engAgg.opens }); base.push({ label: "Clicked", value: engAgg.clicks }); }
      else { base.push({ label: "Opened", value: "—", sub: "see Campaigns report" }); }
    }
    if (flow.code === "A1" && emailAgg) {
      base.push({ label: "Emails sent", value: emailAgg.sent, color: T.accent });
      base.push({ label: "Opened", value: emailAgg.opens, sub: `${emailAgg.clicks} clicks` });
      base.push({ label: "Bounces", value: emailAgg.bounces, color: emailAgg.bounces ? T.warn : T.ink });
    }
    return { metrics: base, st };
  }

  // Hash routing — a second view without adding a router dependency.
  const [route, setRoute] = useState(typeof window !== "undefined" ? window.location.hash : "");
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const visibleFlows = FLOWS.filter(f => visibleFams[f.family]);

  if (route.startsWith("#/charts")) return <Charts />;
  if (route.startsWith("#/kpis")) return <Redemption />;
  if (route.startsWith("#/docs")) return <Docs />;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.sans, color: T.ink }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap'); * { box-sizing: border-box; } a { color: inherit; }`}</style>
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "30px 26px 64px" }}>

        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src="https://www.aisearchaudit.ai/wp-content/uploads/2026/07/ai-search-audit-logo-no-tagline.png" alt="AI Search Audit" style={{ height: 42, width: "auto", display: "block" }} />
            <div>
              <h1 style={{ fontSize: 27.6, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>AISA Automated Marketing Flows</h1>
              <div style={{ fontFamily: T.mono, fontSize: 12.6, color: T.inkSoft, marginTop: 3 }}>Flows Data &amp; Stats · {updatedAt ? `updated ${updatedAt.toLocaleTimeString("en-GB")} · refreshes every ${REFRESH_MINUTES} min` : "Loading…"}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <PageActions />
            <button onClick={load} disabled={loading} className="no-print" style={{ fontFamily: T.sans, fontSize: 14.9, fontWeight: 600, padding: "9px 16px", borderRadius: 8, border: "none", background: loading ? T.inkSoft : T.accent, color: "#fff", cursor: loading ? "wait" : "pointer", minWidth: 122, transition: "background 0.15s" }}>{loading ? "Refreshing…" : "Refresh now"}</button>
          </div>
        </header>

        <NavBar />

        {error && (<div style={{ background: T.errSoft, border: `1px solid ${T.err}`, color: T.err, borderRadius: 8, padding: "10px 14px", fontFamily: T.mono, fontSize: 13.8, marginBottom: 16 }}>Error loading data: {error}. Check that the sheet tabs are published to the web.</div>)}

        <div style={{ background: T.ink, borderRadius: 12, padding: "16px 20px", marginBottom: 18 }}>
          <div style={{ fontFamily: T.mono, fontSize: 11.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#7C8894", textAlign: "left", marginBottom: 12 }}>
            Make.com flows — status{rangeOn ? ` · ${fromDate || "start"} → ${toDate || "today"}` : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
            <RecapItem name="A1 · Webhook on sign-up" status="standby" note="paused — pending AISA vs flow score coherence check" runs={statsFor(runsF, "6350489")} />
            <RecapItem name="A2 · Cold outreach" status="active" note="hourly · Mon–Fri 09:30–18:00" runs={statsFor(runsF, "6446272")} />
            <RecapItem name="B · LinkedIn (Account-Based Marketing)" status="active" note="pilot · daily chain 02:00–10:00" runs={statsFor(runsF, ["6676757", "6513141", "6543270", "6697179", "6696522", "6697349", "6745694", "6513152", "6698916", "6729475", "6731586"])} />
            <RecapItem name="C1 · Social Writer" status="active" note="4 posts/week · Mon/Wed/Thu 15:00 · Tue 09:30" runs={statsFor(runsF, "6359563")} />
            <RecapItem name="C2 · Blog Automation" status="active" note="2 articles/week · Tue &amp; Thu 09:00 · publisher every 2h" runs={statsFor(runsF, ["6871616", "6864777", "6871324"])} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 20, padding: "12px 16px", background: T.card, border: `1px solid ${T.line}`, borderRadius: 10 }}>
          <span style={{ fontFamily: T.mono, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.06em", color: T.inkSoft }}>Show</span>
          {["A", "B", "C", "D"].map(fk => (
            <button key={fk} onClick={() => setVisibleFams(v => ({ ...v, [fk]: !v[fk] }))} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: T.sans, fontSize: 13.8, fontWeight: 600, padding: "5px 12px", borderRadius: 99, cursor: "pointer", border: `1.5px solid ${FAMILY[fk].color}`, background: visibleFams[fk] ? FAMILY[fk].color : "transparent", color: visibleFams[fk] ? "#fff" : FAMILY[fk].color }}><FamilyIcon family={fk} size={16} />{fk} — {FAMILY[fk].name}</button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", fontFamily: T.mono, fontSize: 12.6, color: T.inkSoft }}>
            {PRESETS.map(p => {
              const [pf, pt] = p.get();
              const on = fromDate === pf && toDate === pt;
              return (
                <button key={p.label} onClick={() => { setFromDate(pf); setToDate(pt); }}
                  style={{ ...inp, cursor: "pointer", fontWeight: on ? 700 : 500, borderColor: on ? T.accent : T.line, color: on ? T.accent : T.inkSoft, background: on ? "#F0FAF5" : "#fff" }}>
                  {p.label}
                </button>
              );
            })}
            <span style={{ paddingLeft: 4 }}>Range</span>
            <input type="date" value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)} style={inp} />
            <span>→</span>
            <input type="date" value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)} style={inp} />
            {rangeOn && <button onClick={() => { setFromDate(""); setToDate(""); }} style={{ ...inp, cursor: "pointer", border: "none", color: T.accent, fontWeight: 600 }}>clear</button>}
          </div>

          {/* Explicit feedback: the range applies the moment a date changes — there
              is no Apply/Enter step — and it now hides rows from EVERY KPI, so it
              has to be obvious when one is active. */}
          <div style={{ width: "100%", fontFamily: T.mono, fontSize: 12.1, color: rangeOn ? T.accent : T.inkSoft, borderTop: `1px dashed ${T.line}`, paddingTop: 9, marginTop: 2 }}>
            {rangeOn
              ? `Filter active — ${fromDate || "start"} → ${toDate || "today"} · showing ${runsF.length} of ${runs.length} runs · applied automatically, no Enter needed · newer runs outside this range are hidden until you clear it`
              : "No date filter — showing all data. Pick a range (or a preset) and every KPI on the page follows it; it applies as soon as you choose a date."}
          </div>
        </div>

        {["A", "B", "C", "D"].filter(fk => visibleFams[fk]).map(fk => {
          const fam = FAMILY[fk];
          const flowsIn = visibleFlows.filter(f => f.family === fk);
          if (!flowsIn.length) return null;
          return (
            <section key={fk} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "18px 2px 10px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 9, background: fam.tint, color: fam.color, flex: "0 0 auto" }}><FamilyIcon family={fk} size={19} /></span>
                <h2 style={{ fontFamily: T.sans, fontSize: 14.9, fontWeight: 800, letterSpacing: "0.01em", color: T.ink, margin: 0 }}>{fk} — {fam.name}</h2>
              </div>
              {fk === "B" && <BFunnelPanel fam={fam} f={bFunnel} />}
              {fk === "C" && <BlogPanel />}
              {flowsIn.map(flow => (<FlowStrip key={flow.code} flow={flow} fam={fam} data={flow.placeholder ? null : metricsForFlow(flow)} />))}
            </section>
          );
        })}

        <section style={{ marginTop: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 2px 10px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 9, background: FAMILY.S.tint, color: FAMILY.S.color, flex: "0 0 auto" }}><GearIcon size={19} /></span>
            <h2 style={{ fontFamily: T.sans, fontSize: 14.9, fontWeight: 800, color: T.ink, margin: 0 }}>Service Make.com flows</h2>
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderLeft: `5px solid ${FAMILY.S.color}`, borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(265px, 1fr))", gap: 14 }}>
              {SERVICE_FLOWS.map(sf => {
                return (
                  <div key={sf.code} style={{ border: `1px solid ${T.line}`, borderRadius: 9, padding: "11px 13px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontFamily: T.mono, fontSize: 13.8, fontWeight: 700, color: FAMILY.S.color }}>{sf.code}</span>
                      <StatusDot status={sf.status || "standby"} />
                    </div>
                    <div style={{ fontFamily: T.sans, fontSize: 14.4, fontWeight: 600, color: T.ink, marginBottom: 8 }}>{sf.name}</div>
                    {sf.code === "K1" && fcAgg && (<div style={{ fontFamily: T.mono, fontSize: 11.5, color: T.inkSoft, marginBottom: 8 }}>Firecrawl: {fcAgg.remaining} credits{fcAgg.burn ? ` · ~${fcAgg.burn.toFixed(0)}/day` : ""}</div>)}
                    <a href={sf.makeUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: T.sans, fontSize: 12.6, fontWeight: 600, color: FAMILY.S.color, textDecoration: "none" }}>See make.com {sf.code} flow<LinkIcon /></a>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <footer style={{ fontFamily: T.mono, fontSize: 11.5, color: T.inkSoft, marginTop: 28, textAlign: "center" }}>Data: Google Sheet «AISA - KPI Log» + Zoho Analytics · deduplicated by execution_id · Kleecks internal</footer>
      </div>
    </div>
  );
}
