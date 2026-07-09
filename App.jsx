import React, { useEffect, useMemo, useState } from "react";
import {
  RUNS_CSV_URL, FIRECRAWL_CSV_URL, EMAIL_STATS_CSV_URL, CAMPAIGNS_CSV_URL,
  A2_ENGAGEMENT_CSV_URL, REFRESH_MINUTES, LINKS, FLOWS, SERVICE_FLOWS, FAMILY,
} from "./config.js";

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
async function fetchCSV(url) { if (!url) return []; const res = await fetch(url); if (!res.ok) throw new Error(`HTTP ${res.status}`); return parseCSV(await res.text()); }

const num = v => { const n = parseFloat(String(v ?? "").replace(/[^\d.-]/g, "")); return isNaN(n) ? 0 : n; };
const fmtWhen = iso => { if (!iso) return "—"; const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };
const fmtDur = s => { s = Math.round(s); if (!s) return "—"; const m = Math.floor(s / 60), r = s % 60; return m ? `${m}m ${r}s` : `${r}s`; };

function Metric({ label, value, sub, color }) {
  return (
    <div style={{ minWidth: 78 }}>
      <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", color: T.inkSoft, marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: T.sans, fontSize: 20, fontWeight: 650, color: color || T.ink, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkSoft, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function LinkIcon() {
  return (<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>);
}
function DetailLink({ label, href, color }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: T.sans, fontSize: 12, fontWeight: 600, color: "#fff", background: color, padding: "6px 12px", borderRadius: 6, textDecoration: "none", opacity: 0.92 }}>
      {label}<LinkIcon />
    </a>
  );
}
function StatusDot({ status }) {
  const s = STATUS[status] || STATUS.soon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 9, height: 9, borderRadius: 99, background: s.dot, boxShadow: `0 0 0 3px ${s.dot}22` }} />
      <span style={{ fontFamily: T.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: T.inkSoft }}>{s.label}</span>
    </span>
  );
}

function statsFor(runs, scenarioId) {
  const r = runs.filter(x => String(x.flow_id) === String(scenarioId));
  if (!r.length) return null;
  const ok = r.filter(x => (x.status || "").toLowerCase() === "success").length;
  const err = r.length - ok;
  const durs = r.map(x => num(x.duration_s)).filter(Boolean);
  const avg = durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : 0;
  const sorted = [...r].sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
  const byDay = {}; r.forEach(x => { const d = (x.started_at || "").slice(0, 10); if (d) byDay[d] = (byDay[d] || 0) + 1; });
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
          <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: fam.color, letterSpacing: "0.04em" }}>{flow.code}</span>
          <span style={{ fontFamily: T.sans, fontWeight: 650, fontSize: 15, color: T.ink }}>{flow.name}</span>
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
        <div style={{ paddingBottom: 14, fontFamily: T.mono, fontSize: 12, color: T.inkSoft }}>Reserved slot — this flow has not been built yet.</div>
      )}
    </div>
  );
}

const inp = { fontFamily: T.mono, fontSize: 11, padding: "5px 8px", border: `1px solid ${T.line}`, borderRadius: 6, background: "#fff", color: T.ink };

function RecapItem({ name, status, note, runs }) {
  const s = STATUS[status] || STATUS.standby;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: s.dot }} />
        <span style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, color: "#fff" }}>{name}</span>
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 10, color: "#8A94A6", paddingLeft: 15 }}>
        {note ? note + " · " : ""}{runs ? `${runs.total} runs · last ${fmtWhen(runs.last?.started_at)}` : "no runs yet"}
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
  const [updatedAt, setUpdatedAt] = useState(null);
  const [error, setError] = useState(null);
  const [visibleFams, setVisibleFams] = useState({ A: true, B: true, C: true, D: true });
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  async function load() {
    try {
      setError(null);
      const [r, e, c, f, g] = await Promise.all([
        fetchCSV(RUNS_CSV_URL), fetchCSV(EMAIL_STATS_CSV_URL), fetchCSV(CAMPAIGNS_CSV_URL),
        fetchCSV(FIRECRAWL_CSV_URL), fetchCSV(A2_ENGAGEMENT_CSV_URL),
      ]);
      const seen = new Set(); const rr = [];
      r.forEach(x => { const k = x.execution_id || JSON.stringify(x); if (!seen.has(k)) { seen.add(k); rr.push(x); } });
      setRuns(rr); setEmailStats(e); setCampaigns(c); setFirecrawl(f); setEngagement(g); setUpdatedAt(new Date());
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); const id = setInterval(load, REFRESH_MINUTES * 60000); return () => clearInterval(id); }, []);

  const runsF = useMemo(() => runs.filter(x => {
    const d = (x.started_at || "").slice(0, 10); if (!d) return true;
    if (fromDate && d < fromDate) return false; if (toDate && d > toDate) return false; return true;
  }), [runs, fromDate, toDate]);

  const emailAgg = useMemo(() => {
    if (!emailStats.length) return null;
    let opens = 0, clicks = 0, bounces = 0;
    emailStats.forEach(e => { const t = (e.event_type || "").toLowerCase(); const n = num(e.count) || 1;
      if (t.includes("open")) opens += n; else if (t.includes("click")) clicks += n; else if (t.includes("bounce")) bounces += n; });
    return { opens, clicks, bounces };
  }, [emailStats]);

  const campAgg = useMemo(() => {
    if (!campaigns.length) return null;
    const last = [...campaigns].sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))[0] || {};
    return { active: num(last.list_active), unsub: num(last.list_unsub), bounce: num(last.list_bounce), at: last.logged_at };
  }, [campaigns]);

  const engAgg = useMemo(() => {
    if (!engagement.length) return null;
    const m = {}; engagement.forEach(x => { m[(x.metric || "").toLowerCase()] = num(x.n); });
    return { opens: m.opens || 0, clicks: m.clicks || 0, unsub: m.unsubscribes || 0 };
  }, [engagement]);

  const fcAgg = useMemo(() => {
    if (!firecrawl.length) return null;
    const last = [...firecrawl].sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))[0] || {};
    return { remaining: num(last.credits_remaining), burn: num(last.burn_per_day) };
  }, [firecrawl]);

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
      base.push({ label: "Opened", value: emailAgg.opens, sub: `${emailAgg.clicks} clicks` });
      base.push({ label: "Bounces", value: emailAgg.bounces, color: emailAgg.bounces ? T.warn : T.ink });
    }
    return { metrics: base, st };
  }

  const visibleFlows = FLOWS.filter(f => visibleFams[f.family]);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.sans, color: T.ink }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap'); * { box-sizing: border-box; } a { color: inherit; }`}</style>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 22px 60px" }}>

        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src="https://www.aisearchaudit.ai/wp-content/uploads/2026/07/ai-search-audit-logo-no-tagline.png" alt="AI Search Audit" style={{ height: 42, width: "auto", display: "block" }} />
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Automation Flows — KPI Dashboard</h1>
              <div style={{ fontFamily: T.mono, fontSize: 11, color: T.inkSoft, marginTop: 3 }}>{updatedAt ? `Updated ${updatedAt.toLocaleTimeString("en-GB")} · refreshes every ${REFRESH_MINUTES} min` : "Loading…"}</div>
            </div>
          </div>
          <button onClick={load} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: 8, border: "none", background: T.accent, color: "#fff", cursor: "pointer" }}>Refresh now</button>
        </header>

        {error && (<div style={{ background: T.errSoft, border: `1px solid ${T.err}`, color: T.err, borderRadius: 8, padding: "10px 14px", fontFamily: T.mono, fontSize: 12, marginBottom: 16 }}>Error loading data: {error}. Check that the sheet tabs are published to the web.</div>)}

        <div style={{ background: T.ink, borderRadius: 12, padding: "14px 20px", marginBottom: 18, display: "flex", gap: 30, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#7C8894" }}>Active Make.com flows</div>
          <RecapItem name="A1 · Webhook on sign-up" status="standby" runs={statsFor(runs, "6350489")} />
          <RecapItem name="A2 · Cold outreach" status="active" note="hourly · Mon–Fri 09:30–18:00" runs={statsFor(runs, "6446272")} />
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 20, padding: "12px 16px", background: T.card, border: `1px solid ${T.line}`, borderRadius: 10 }}>
          <span style={{ fontFamily: T.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: T.inkSoft }}>Show</span>
          {["A", "B", "C", "D"].map(fk => (
            <button key={fk} onClick={() => setVisibleFams(v => ({ ...v, [fk]: !v[fk] }))} style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 99, cursor: "pointer", border: `1.5px solid ${FAMILY[fk].color}`, background: visibleFams[fk] ? FAMILY[fk].color : "transparent", color: visibleFams[fk] ? "#fff" : FAMILY[fk].color }}>{fk} — {FAMILY[fk].name}</button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", fontFamily: T.mono, fontSize: 11, color: T.inkSoft }}>
            <span>Range</span>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={inp} />
            <span>→</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={inp} />
            {(fromDate || toDate) && <button onClick={() => { setFromDate(""); setToDate(""); }} style={{ ...inp, cursor: "pointer", border: "none", color: T.accent }}>clear</button>}
          </div>
        </div>

        {["A", "B", "C", "D"].filter(fk => visibleFams[fk]).map(fk => {
          const fam = FAMILY[fk];
          const flowsIn = visibleFlows.filter(f => f.family === fk);
          if (!flowsIn.length) return null;
          return (
            <section key={fk} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 2px 10px" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: fam.color }} />
                <h2 style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, letterSpacing: "0.02em", color: T.ink, margin: 0 }}>{fk} — {fam.name}</h2>
              </div>
              {flowsIn.map(flow => (<FlowStrip key={flow.code} flow={flow} fam={fam} data={flow.placeholder ? null : metricsForFlow(flow)} />))}
            </section>
          );
        })}

        <section style={{ marginTop: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 2px 10px" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: FAMILY.S.color }} />
            <h2 style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>Service Make.com flows</h2>
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderLeft: `5px solid ${FAMILY.S.color}`, borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
              {SERVICE_FLOWS.map(sf => {
                const st = statsFor(runs, sf.scenarioId);
                return (
                  <div key={sf.code} style={{ border: `1px solid ${T.line}`, borderRadius: 9, padding: "11px 13px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: FAMILY.S.color }}>{sf.code}</span>
                      <StatusDot status={st ? "active" : "standby"} />
                    </div>
                    <div style={{ fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, color: T.ink, marginBottom: 8 }}>{sf.name}</div>
                    <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                      <Metric label="Runs" value={st ? st.total : "—"} />
                      <Metric label="Success" value={st ? (st.rate == null ? "—" : `${st.rate}%`) : "—"} color={st && st.rate >= 90 ? T.ok : undefined} />
                      <Metric label="Last" value={st ? fmtWhen(st.last?.started_at) : "—"} />
                    </div>
                    {sf.code === "K1" && fcAgg && (<div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkSoft, marginBottom: 8 }}>Firecrawl: {fcAgg.remaining} credits{fcAgg.burn ? ` · ~${fcAgg.burn.toFixed(0)}/day` : ""}</div>)}
                    <a href={sf.makeUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: T.sans, fontSize: 11, fontWeight: 600, color: FAMILY.S.color, textDecoration: "none" }}>See make.com {sf.code} flow<LinkIcon /></a>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <footer style={{ fontFamily: T.mono, fontSize: 10, color: T.inkSoft, marginTop: 28, textAlign: "center" }}>Data: Google Sheet «AISA - KPI Log» + Zoho Analytics · deduplicated by execution_id · Kleecks internal</footer>
      </div>
    </div>
  );
}
