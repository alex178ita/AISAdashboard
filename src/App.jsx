import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  RUNS_CSV_URL, FIRECRAWL_CSV_URL, EMAIL_STATS_CSV_URL, CAMPAIGNS_CSV_URL,
  FLOW_LABELS, REFRESH_MINUTES,
} from "./config.js";

// ---- Token di design -------------------------------------------------
const T = {
  bg: "#F7F8F6", panel: "#FFFFFF", ink: "#14181C", inkSoft: "#5B6570",
  line: "#E3E7E4", ok: "#0E8A6D", okSoft: "#DFF2EC", err: "#C4372F",
  errSoft: "#F9E4E2", warn: "#B7791F", warnSoft: "#FBF0DC",
  accent: "#2547E0", accentSoft: "#E7EBFC",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
  sans: "'Inter', system-ui, sans-serif",
};

// ---- Utilità ----------------------------------------------------------
const fetchCsv = (url) =>
  new Promise((resolve, reject) => {
    if (!url || url.startsWith("INCOLLA")) return resolve(null);
    Papa.parse(url, {
      download: true, header: true, skipEmptyLines: true,
      complete: (r) => resolve(r.data), error: reject,
    });
  });

const fmtDur = (s) => (s == null || isNaN(s) ? "—" : s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`);
const dayKey = (iso) => (iso || "").slice(0, 10);
const lastNDays = (n) => {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
};
const fmtWhen = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

// ---- Componenti base --------------------------------------------------
function Kpi({ label, value, sub, color, dark }) {
  return (
    <div style={{ minWidth: 88 }}>
      <div style={{ fontFamily: T.sans, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: dark ? "#9AA6B2" : T.inkSoft, marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: T.mono, fontSize: 22, fontWeight: 600, color: color || (dark ? "#FFFFFF" : T.ink), lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontFamily: T.mono, fontSize: 11, color: dark ? "#9AA6B2" : T.inkSoft, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// Signature element: run strip, oldest to newest
function RunStrip({ runs }) {
  if (!runs.length) return <div style={{ fontFamily: T.mono, fontSize: 11, color: T.inkSoft }}>no runs recorded</div>;
  const strip = runs.slice(-24);
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end" }} aria-label="Recent run outcomes">
      {strip.map((r, i) => (
        <div key={r.execution_id || i}
          title={`${fmtWhen(r.started_at)} · ${r.status} · ${fmtDur(r.duration_s)}`}
          style={{
            width: 10, height: i === strip.length - 1 ? 20 : 14, borderRadius: 2,
            background: r.status === "success" ? T.ok : T.err,
            opacity: 0.45 + (0.55 * (i + 1)) / strip.length,
          }} />
      ))}
    </div>
  );
}

function DayBars({ series, color, unit }) {
  const max = Math.max(1, ...series.map((d) => d.v));
  return (
    <div>
      <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 44 }}>
        {series.map((d) => (
          <div key={d.k} title={`${d.k}: ${d.v} ${unit || ""}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div style={{ height: Math.max(2, (d.v / max) * 40), background: d.v ? (color || T.accent) : T.line, borderRadius: 2 }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: T.mono, fontSize: 9, color: T.inkSoft, marginTop: 3 }}>
        <span>{series[0]?.k.slice(5)}</span><span>{series[series.length - 1]?.k.slice(5)}</span>
      </div>
    </div>
  );
}

function Panel({ children, style }) {
  return <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, padding: 18, ...style }}>{children}</div>;
}

function SectionLabel({ children }) {
  return <div style={{ fontFamily: T.sans, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: T.inkSoft, marginBottom: 8 }}>{children}</div>;
}

// ---- Card flusso -------------------------------------------------------
function FlowCard({ flowId, runs }) {
  const ok = runs.filter((r) => r.status === "success");
  const err = runs.filter((r) => r.status !== "success");
  const rate = runs.length ? Math.round((ok.length / runs.length) * 100) : null;
  const avgD = ok.length ? ok.reduce((a, r) => a + (r.duration_s || 0), 0) / ok.length : null;
  const last = runs[runs.length - 1];
  const days = lastNDays(14).map((k) => ({ k, v: runs.filter((r) => dayKey(r.started_at) === k).length }));
  return (
    <Panel>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: T.sans, fontWeight: 600, fontSize: 15, color: T.ink }}>{FLOW_LABELS[flowId] || `Scenario ${flowId}`}</div>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.inkSoft, marginTop: 2 }}>last run {last ? fmtWhen(last.started_at) : "—"}</div>
        </div>
        {last && (
          <span style={{ fontFamily: T.mono, fontSize: 11, padding: "3px 8px", borderRadius: 99, background: last.status === "success" ? T.okSoft : T.errSoft, color: last.status === "success" ? T.ok : T.err, whiteSpace: "nowrap" }}>
            {last.status === "success" ? "last: ok" : "last: error"}
          </span>
        )}
      </div>
      <div style={{ marginBottom: 12 }}>
        <SectionLabel>Recent runs</SectionLabel>
        <RunStrip runs={runs} />
      </div>
      <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginBottom: 12 }}>
        <Kpi label="Runs" value={runs.length} />
        <Kpi label="Success" value={rate == null ? "—" : `${rate}%`} color={rate == null ? T.ink : rate >= 90 ? T.ok : T.err} sub={`${err.length} errors`} />
        <Kpi label="Avg. duration" value={fmtDur(avgD)} />
      </div>
      <SectionLabel>Runs per day (14 days)</SectionLabel>
      <DayBars series={days} />
    </Panel>
  );
}

// ---- App ---------------------------------------------------------------
export default function App() {
  const [runsRaw, setRunsRaw] = useState(null);
  const [fc, setFc] = useState(null);
  const [email, setEmail] = useState(null);
  const [camp, setCamp] = useState(null);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = () => {
    setError(null);
    Promise.all([fetchCsv(RUNS_CSV_URL), fetchCsv(FIRECRAWL_CSV_URL), fetchCsv(EMAIL_STATS_CSV_URL), fetchCsv(CAMPAIGNS_CSV_URL)])
      .then(([r, f, e, c]) => { setRunsRaw(r); setFc(f); setEmail(e); setCamp(c); setUpdatedAt(new Date()); })
      .catch((e) => setError(String(e)));
  };
  useEffect(() => { load(); const t = setInterval(load, REFRESH_MINUTES * 60000); return () => clearInterval(t); }, []);

  // Dedup per execution_id, righe valide, ordinate per data
  const runs = useMemo(() => {
    if (!runsRaw) return [];
    const seen = new Map();
    for (const row of runsRaw) {
      const id = row.execution_id;
      if (!id || !row.flow_id) continue;
      if (!seen.has(id)) seen.set(id, {
        ...row,
        duration_s: parseFloat(row.duration_s),
        operations: parseInt(row.operations || 0, 10),
      });
    }
    return [...seen.values()].sort((a, b) => (a.started_at || "").localeCompare(b.started_at || ""));
  }, [runsRaw]);

  const byFlow = useMemo(() => {
    const g = {};
    for (const r of runs) (g[r.flow_id] = g[r.flow_id] || []).push(r);
    return g;
  }, [runs]);

  const totals = useMemo(() => {
    const ok = runs.filter((r) => r.status === "success").length;
    return { runs: runs.length, ok, err: runs.length - ok, ops: runs.reduce((a, r) => a + (r.operations || 0), 0) };
  }, [runs]);

  // Email: righe { date, event_type, count }
  const emailAgg = useMemo(() => {
    if (!email) return null;
    const rows = email.filter((r) => r.event_type);
    const n = (r) => parseInt(r.count, 10) || 1; // senza colonna count: 1 riga = 1 evento
    const sum = (types) => rows.filter((r) => types.some((t) => (r.event_type || "").toLowerCase().includes(t))).reduce((a, r) => a + n(r), 0);
    const bounceTypes = {};
    for (const r of rows) {
      const t = (r.event_type || "").toLowerCase();
      if (t.includes("bounce")) bounceTypes[r.event_type] = (bounceTypes[r.event_type] || 0) + n(r);
    }
    const days = lastNDays(14).map((k) => ({
      k,
      v: rows.filter((r) => dayKey(r.date) === k && (r.event_type || "").toLowerCase().includes("bounce")).reduce((a, r) => a + n(r), 0),
    }));
    return { sent: sum(["delivery", "sent", "deliver"]), opens: sum(["open"]), clicks: sum(["click"]), bounces: sum(["bounce"]), bounceTypes, bounceDays: days };
  }, [email]);

  // Firecrawl: latest reading + average daily burn from deltas
  const fcAgg = useMemo(() => {
    if (!fc || !fc.length) return null;
    const rows = fc.filter((r) => r.remaining_credits).map((r) => ({ t: r.logged_at, v: parseInt(r.remaining_credits, 10) })).sort((a, b) => a.t.localeCompare(b.t));
    if (!rows.length) return null;
    const last = rows[rows.length - 1], first = rows[0];
    const daysSpan = Math.max(1, (new Date(last.t) - new Date(first.t)) / 86400000);
    const burn = Math.max(0, first.v - last.v) / daysSpan;
    return { remaining: last.v, plan: parseInt(fc[fc.length - 1].plan_credits, 10) || null, burnPerDay: burn, periodEnd: fc[fc.length - 1].billing_period_end };
  }, [fc]);

  // Campaigns: rows { logged_at, list_active, list_unsub, list_bounce } — latest reading + active trend
  const campAgg = useMemo(() => {
    if (!camp || !camp.length) return null;
    const rows = camp.filter((r) => r.logged_at).sort((a, b) => (a.logged_at || "").localeCompare(b.logged_at || ""));
    if (!rows.length) return null;
    const last = rows[rows.length - 1];
    const num = (v) => parseInt(v, 10) || 0;
    const days = lastNDays(14).map((k) => {
      const dayRows = rows.filter((r) => dayKey(r.logged_at) === k);
      return { k, v: dayRows.length ? num(dayRows[dayRows.length - 1].list_active) : 0 };
    });
    return { active: num(last.list_active), unsub: num(last.list_unsub), bounce: num(last.list_bounce), at: last.logged_at, days };
  }, [camp]);

  const totRate = totals.runs ? Math.round((totals.ok / totals.runs) * 100) : null;
  const configured = RUNS_CSV_URL && !RUNS_CSV_URL.startsWith("INCOLLA");

  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: "28px 20px", fontFamily: T.sans, color: T.ink }}>
      <div style={{ maxWidth: 1020, margin: "0 auto" }}>

        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
            <img
              src="https://www.aisearchaudit.ai/wp-content/uploads/2026/07/ai-search-audit-logo-no-tagline.png"
              alt="AI Search Audit"
              style={{ height: 44, width: "auto", display: "block" }}
            />
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 11, color: T.accent, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>AISA · Make.com · ZeptoMail · Campaigns · Firecrawl</div>
              <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>Automation flows — KPI dashboard</h1>
              <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkSoft, marginTop: 4 }}>
                {updatedAt ? `Updated at ${updatedAt.toLocaleTimeString("en-GB")} · refreshes every ${REFRESH_MINUTES} min` : "Loading…"}
              </div>
            </div>
          </div>
          <button onClick={load} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: 8, border: "none", background: T.accent, color: "#fff", cursor: "pointer" }}>
            Refresh now
          </button>
        </header>

        {!configured && (
          <Panel style={{ borderStyle: "dashed", textAlign: "center", color: T.inkSoft }}>
            Configure the CSV URLs in <code style={{ fontFamily: T.mono }}>src/config.js</code> — see the README for instructions.
          </Panel>
        )}

        {error && (
          <div style={{ background: T.errSoft, border: `1px solid ${T.err}`, color: T.err, borderRadius: 8, padding: "10px 14px", fontFamily: T.mono, fontSize: 12, marginBottom: 16 }}>
            Error loading data: {error}. Check that the sheet tabs are published to the web.
          </div>
        )}

        {configured && runs.length > 0 && (
          <>
            {/* Aggregate band */}
            <div style={{ background: T.ink, borderRadius: 10, padding: "18px 20px", marginBottom: 18 }}>
              <div style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, letterSpacing: "0.02em", color: "#FFFFFF", textAlign: "center", marginBottom: 16 }}>
                Active automation flows
              </div>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "stretch", justifyContent: "center" }}>
                <Kpi dark label="Total runs" value={totals.runs} />
                <Kpi dark label="Success" value={totRate == null ? "—" : `${totRate}%`} color={totRate >= 90 ? "#5BE3B8" : "#F0908A"} sub={`${totals.err} errors`} />
                <Kpi dark label="Make operations" value={totals.ops} />

                {/* Email group A1 — Webhook (ZeptoMail) */}
                {emailAgg && (
                  <div style={{ display: "flex", gap: 20, paddingLeft: 20, borderLeft: "1px solid #2A3038" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontFamily: T.sans, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7C8894", fontWeight: 600 }}>A1 — Webhook</div>
                      <div style={{ display: "flex", gap: 20 }}>
                        <Kpi dark label="Emails sent" value={emailAgg.sent} sub={`${emailAgg.opens} opens`} />
                        <Kpi dark label="Bounces" value={emailAgg.bounces} color={emailAgg.bounces ? "#F5C97B" : "#5BE3B8"} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Email group A2 — Cold Outreach (Campaigns) */}
                {campAgg && (
                  <div style={{ display: "flex", gap: 20, paddingLeft: 20, borderLeft: "1px solid #2A3038" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontFamily: T.sans, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7C8894", fontWeight: 600 }}>A2 — Cold Outreach</div>
                      <div style={{ display: "flex", gap: 20 }}>
                        <Kpi dark label="Emails sent" value={campAgg.active + campAgg.unsub} sub={`${campAgg.active} subscribers`} />
                        <Kpi dark label="Bounces" value={campAgg.bounce} color={campAgg.bounce ? "#F5C97B" : "#5BE3B8"} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Card flussi + lista Campaigns */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 18 }}>
              {Object.keys(FLOW_LABELS).map((id) => byFlow[id] ? <FlowCard key={id} flowId={id} runs={byFlow[id]} /> : null)}
              <Panel>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontFamily: T.sans, fontWeight: 600, fontSize: 15, color: T.ink }}>Campaigns — Cold Outreach list</div>
                    <div style={{ fontFamily: T.mono, fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
                      last reading {campAgg ? fmtWhen(campAgg.at) : "—"}
                    </div>
                  </div>
                  {campAgg && (
                    <span style={{ fontFamily: T.mono, fontSize: 11, padding: "3px 8px", borderRadius: 99, background: T.accentSoft, color: T.accent, whiteSpace: "nowrap" }}>
                      Zoho Campaigns
                    </span>
                  )}
                </div>
                {campAgg ? (
                  <>
                    <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginBottom: 12 }}>
                      <Kpi label="Active subscribers" value={campAgg.active} color={T.ok} />
                      <Kpi label="Unsubscribed" value={campAgg.unsub} color={campAgg.unsub ? T.warn : T.ink} />
                      <Kpi label="Bounces" value={campAgg.bounce} color={campAgg.bounce ? T.err : T.ink} />
                    </div>
                    <SectionLabel>Active subscribers (14 days)</SectionLabel>
                    <DayBars series={campAgg.days} color={T.ok} unit="active" />
                    <div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkSoft, marginTop: 12, lineHeight: 1.5, borderTop: `1px solid ${T.line}`, paddingTop: 10 }}>
                      Note: the send totals in Zoho Campaigns' own reports may be higher than the figures shown here. Campaigns counts every historical send of the campaign — including pre-launch tests and any contacts later removed from the list — whereas this dashboard reflects the current state of the list (active subscribers + unsubscribed).
                    </div>
                  </>
                ) : (
                  <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkSoft }}>
                    Awaiting the first readings from the K3 collector, or the campaigns tab URL.
                  </div>
                )}
              </Panel>
            </div>

            {/* Deliverability + Firecrawl */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
              <Panel>
                <SectionLabel>Email · deliverability (aggregated, no personal data)</SectionLabel>
                {emailAgg ? (
                  <>
                    <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginBottom: 12 }}>
                      <Kpi label="Sent" value={emailAgg.sent} color={T.ok} />
                      <Kpi label="Opens" value={emailAgg.opens} />
                      <Kpi label="Clicks" value={emailAgg.clicks} />
                      <Kpi label="Bounces" value={emailAgg.bounces} color={emailAgg.bounces ? T.warn : T.ok} />
                    </div>
                    {Object.keys(emailAgg.bounceTypes).length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        {Object.entries(emailAgg.bounceTypes).map(([t, n]) => (
                          <span key={t} style={{ display: "inline-block", fontFamily: T.mono, fontSize: 11, padding: "3px 8px", borderRadius: 99, background: T.warnSoft, color: T.warn, marginRight: 6, marginBottom: 6 }}>{t}: {n}</span>
                        ))}
                      </div>
                    )}
                    <SectionLabel>Bounces per day (14 days)</SectionLabel>
                    <DayBars series={emailAgg.bounceDays} color={T.warn} unit="bounces" />
                  </>
                ) : (
                  <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkSoft }}>Awaiting the first ZeptoMail events, or the email_stats tab URL.</div>
                )}
              </Panel>
              <Panel>
                <SectionLabel>Firecrawl · credits</SectionLabel>
                {fcAgg ? (
                  <>
                    <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginBottom: 12 }}>
                      <Kpi label="Remaining" value={fcAgg.remaining} />
                      {fcAgg.plan && <Kpi label="Plan" value={fcAgg.plan} />}
                      <Kpi label="Burn" value={fcAgg.burnPerDay ? `~${fcAgg.burnPerDay.toFixed(0)}/day` : "n/a"} />
                    </div>
                    <div style={{ fontFamily: T.mono, fontSize: 11, color: T.inkSoft }}>
                      Period renews: {fcAgg.periodEnd ? fcAgg.periodEnd.slice(0, 10) : "—"}
                      {fcAgg.burnPerDay > 0 && ` · estimated autonomy ~${Math.floor(fcAgg.remaining / fcAgg.burnPerDay)} days`}
                    </div>
                  </>
                ) : (
                  <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkSoft }}>Awaiting the first readings from the K1 collector.</div>
                )}
              </Panel>
            </div>

            <footer style={{ fontFamily: T.mono, fontSize: 10, color: T.inkSoft, marginTop: 24, textAlign: "center" }}>
              Data: Google Sheet «AISA - KPI Log» (published tabs runs / firecrawl / email_stats / campaigns) · deduplicated by execution_id · Kleecks internal
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
