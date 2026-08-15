// src/Charts.jsx — Statistical graphs over time
//
// A second view of the dashboard, reached from the "Statistical graphs" link in
// the header (hash route #/charts). Self-contained: it fetches the same published
// CSVs as the main page and draws plain SVG, so there is no charting dependency
// to install and nothing to break at build time.
//
// Four charts, each answering a question the single-value tiles cannot:
//   1. Make operations per day, by family  — are we heading past the plan limit, and who is responsible?
//   2. Firecrawl credits remaining         — when do we run out at the current burn?
//   3. Campaigns list health               — is the unsubscribe rate trending up?
//   4. Runs and errors per day             — is a failure isolated or is something degrading?

import { useEffect, useMemo, useState } from "react";
import { RUNS_CSV_URL, FIRECRAWL_CSV_URL, CAMPAIGNS_CSV_URL, FLOWS, SERVICE_FLOWS, FAMILY } from "./config.js";
import { NavBar, PageActions, PrintStyle } from "./shared.jsx";

const T = {
  sans: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace",
  bg: "#F6F7F9", ink: "#12151A", inkSoft: "#6A7280", line: "#E6E9ED", card: "#FFFFFF",
  accent: "#2FB980", err: "#D4544E", warn: "#C97A1C",
};

// Make Pro plan allowance, for the reference line on chart 1.
const OPS_PLAN_PER_MONTH = 120000;

/* ---------- data helpers (kept local so this page has no coupling to App.jsx) ---------- */

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
const dayKey = v => { const d = new Date(v); return isNaN(d) ? null : d.toISOString().slice(0, 10); };
const dmy = k => k ? `${k.slice(8, 10)}/${k.slice(5, 7)}` : "";

// The operations column has been written under slightly different headers over
// time; take whichever is present rather than assuming one.
const OPS_KEYS = ["operations", "ops", "operation_count", "operazioni"];
const opsOf = r => { for (const k of OPS_KEYS) if (r[k] !== undefined && r[k] !== "") return num(r[k]); return 0; };

// scenarioId → family letter, so operations can be attributed
const FAM_OF = (() => {
  const m = {};
  FLOWS.forEach(f => { if (f.scenarioId) m[String(f.scenarioId)] = f.family; });
  SERVICE_FLOWS.forEach(f => { if (f.scenarioId) m[String(f.scenarioId)] = "S"; });
  return m;
})();

/* ---------- tiny SVG chart primitives ---------- */

const W = 900, H = 260, PAD = { l: 52, r: 16, t: 14, b: 30 };

function Axes({ maxY, days, yFmt = v => Math.round(v) }) {
  const ticks = 4;
  return (
    <>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = (maxY / ticks) * i;
        const y = H - PAD.b - ((H - PAD.t - PAD.b) * i) / ticks;
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke={T.line} strokeWidth="1" />
            <text x={PAD.l - 8} y={y + 3.5} textAnchor="end" fontSize="10" fill={T.inkSoft} fontFamily={T.mono}>{yFmt(v)}</text>
          </g>
        );
      })}
      {days.map((d, i) => {
        const step = Math.ceil(days.length / 10) || 1;
        if (i % step) return null;
        const x = PAD.l + ((W - PAD.l - PAD.r) * (i + 0.5)) / days.length;
        return <text key={d} x={x} y={H - PAD.b + 14} textAnchor="middle" fontSize="9.5" fill={T.inkSoft} fontFamily={T.mono}>{dmy(d)}</text>;
      })}
    </>
  );
}

function Card({ title, subtitle, children, note }) {
  return (
    <section style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "16px 20px 10px", marginBottom: 18 }}>
      <h2 style={{ fontFamily: T.sans, fontSize: 15, fontWeight: 700, margin: "0 0 2px" }}>{title}</h2>
      {subtitle && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.inkSoft, marginBottom: 8 }}>{subtitle}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>{children}</svg>
      {note && <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.inkSoft, margin: "6px 2px 4px" }}>{note}</div>}
    </section>
  );
}

const Empty = ({ msg }) => (
  <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="13" fill={T.inkSoft} fontFamily={T.mono}>{msg}</text>
);

/* ---------- the page ---------- */

const RANGES = [{ label: "7 days", days: 7 }, { label: "30 days", days: 30 }, { label: "90 days", days: 90 }, { label: "All", days: 0 }];

export default function Charts() {
  const [runs, setRuns] = useState([]);
  const [fire, setFire] = useState([]);
  const [camp, setCamp] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchCSV(RUNS_CSV_URL), fetchCSV(FIRECRAWL_CSV_URL), fetchCSV(CAMPAIGNS_CSV_URL)])
      .then(([r, f, c]) => { if (!alive) return; setRuns(r); setFire(f); setCamp(c); setLoading(false); })
      .catch(e => { if (alive) { setErr(String(e.message || e)); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const since = useMemo(() => range ? Date.now() - range * 86400000 : 0, [range]);
  const inRange = v => { const d = new Date(v); return !isNaN(d) && d.getTime() >= since; };

  // runs: de-duplicate by execution_id — K1 overlaps passes by design, and
  // counting the duplicates would inflate every figure on this page.
  const runsClean = useMemo(() => {
    const seen = new Set(), out = [];
    runs.forEach(r => { const k = r.execution_id || JSON.stringify(r); if (!seen.has(k)) { seen.add(k); out.push(r); } });
    return out.filter(r => inRange(r.started_at));
  }, [runs, since]);

  const days = useMemo(() => {
    const s = new Set();
    runsClean.forEach(r => { const d = dayKey(r.started_at); if (d) s.add(d); });
    return [...s].sort();
  }, [runsClean]);

  /* 1 — operations per day by family */
  const opsByDay = useMemo(() => {
    const m = {};
    runsClean.forEach(r => {
      const d = dayKey(r.started_at); if (!d) return;
      const fam = FAM_OF[String(r.flow_id)] || "S";
      m[d] = m[d] || { A: 0, B: 0, C: 0, S: 0 };
      m[d][fam] += opsOf(r);
    });
    return m;
  }, [runsClean]);

  const opsMax = Math.max(1, ...days.map(d => { const v = opsByDay[d] || {}; return (v.A || 0) + (v.B || 0) + (v.C || 0) + (v.S || 0); }));
  const opsTotal = days.reduce((a, d) => { const v = opsByDay[d] || {}; return a + v.A + v.B + v.C + v.S; }, 0);
  const opsAvgDay = days.length ? Math.round(opsTotal / days.length) : 0;
  const projMonth = opsAvgDay * 30;
  const planLine = OPS_PLAN_PER_MONTH / 30;

  /* 2 — Firecrawl credits */
  const fireSeries = useMemo(() =>
    fire.filter(r => r.remaining_credits !== undefined && r.remaining_credits !== "" && inRange(r.logged_at))
      .map(r => ({ t: new Date(r.logged_at).getTime(), v: num(r.remaining_credits) }))
      .sort((a, b) => a.t - b.t), [fire, since]);

  // Burn must be measured on the current segment only. A plan top-up appears as
  // an upward jump, and averaging across it produces a negative burn and a
  // meaningless projection — which is exactly what the first version reported.
  const burn = useMemo(() => {
    if (fireSeries.length < 2) return null;
    let start = 0;
    for (let i = 1; i < fireSeries.length; i++) {
      if (fireSeries[i].v > fireSeries[i - 1].v * 1.05) start = i; // top-up detected
    }
    const seg = fireSeries.slice(start);
    if (seg.length < 2) return { perDay: null, left: fireSeries[fireSeries.length - 1].v, daysLeft: null, toppedUp: start > 0 };
    const a = seg[0], b = seg[seg.length - 1];
    const dd = (b.t - a.t) / 86400000;
    const perDay = dd > 0 ? (a.v - b.v) / dd : 0;
    return { perDay, left: b.v, daysLeft: perDay > 0 ? b.v / perDay : null, toppedUp: start > 0, segDays: dd };
  }, [fireSeries]);

  /* 3 — Campaigns list health */
  const campSeries = useMemo(() =>
    camp.filter(r => inRange(r.logged_at))
      .map(r => {
        const act = num(r.list_active), uns = num(r.list_unsub), bou = num(r.list_bounce);
        const base = act + uns;
        return { t: new Date(r.logged_at).getTime(), act, uns, bou, rate: base ? (uns / base) * 100 : 0 };
      })
      .sort((a, b) => a.t - b.t), [camp, since]);

  /* 4 — runs and errors per day */
  const runsByDay = useMemo(() => {
    const m = {};
    runsClean.forEach(r => {
      const d = dayKey(r.started_at); if (!d) return;
      m[d] = m[d] || { ok: 0, err: 0 };
      if ((r.status || "").toLowerCase() === "success") m[d].ok++; else m[d].err++;
    });
    return m;
  }, [runsClean]);
  const runsMax = Math.max(1, ...days.map(d => (runsByDay[d]?.ok || 0) + (runsByDay[d]?.err || 0)));

  const bw = days.length ? (W - PAD.l - PAD.r) / days.length : 0;
  const barW = Math.max(2, bw * 0.66);
  const xOf = i => PAD.l + bw * i + (bw - barW) / 2;

  const linePath = (pts, maxV) => {
    if (!pts.length) return "";
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
    return pts.map((p, i) => {
      const x = PAD.l + ((W - PAD.l - PAD.r) * (p.t - t0)) / Math.max(1, t1 - t0);
      const y = H - PAD.b - ((H - PAD.t - PAD.b) * p.v) / maxV;
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.sans, color: T.ink }}>
      <PrintStyle />
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "30px 26px 64px" }}>

        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src="https://www.aisearchaudit.ai/wp-content/uploads/2026/07/ai-search-audit-logo-no-tagline.png" alt="AI Search Audit" style={{ height: 42, width: "auto", display: "block" }} />
            <div>
              <h1 style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>AISA Automated Marketing Flows</h1>
              <div style={{ fontFamily: T.mono, fontSize: 12.6, color: T.inkSoft, marginTop: 3 }}>
                Statistical graphs over time · same sources, de-duplicated by execution_id
              </div>
            </div>
          </div>
          <PageActions />
        </header>

        <NavBar />

        <header className="no-print" style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {RANGES.map(r => (
              <button key={r.label} onClick={() => setRange(r.days)}
                style={{ fontFamily: T.sans, fontSize: 12.6, fontWeight: range === r.days ? 700 : 500, padding: "6px 14px", borderRadius: 99,
                         cursor: "pointer", border: `1.5px solid ${range === r.days ? T.accent : T.line}`,
                         background: range === r.days ? T.accent : "#fff", color: range === r.days ? "#fff" : T.inkSoft }}>
                {r.label}
              </button>
            ))}
          </div>
        </header>


        {err && <div style={{ background: "#FBE9E8", border: `1px solid ${T.err}`, color: T.err, borderRadius: 8, padding: "10px 14px", fontFamily: T.mono, fontSize: 12, marginBottom: 16 }}>Error loading data: {err}</div>}
        {loading && <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkSoft, marginBottom: 16 }}>Loading…</div>}

        {/* 1 — Make operations */}
        <Card
          title="Make operations per day, by family"
          subtitle={`${opsTotal.toLocaleString("en-GB")} operations in range · ${opsAvgDay.toLocaleString("en-GB")}/day average · projected ${projMonth.toLocaleString("en-GB")}/month against a ${OPS_PLAN_PER_MONTH.toLocaleString("en-GB")} plan`}
          note="The dashed line is the daily budget implied by the plan. Operations are the real currency of Make: a flow can look healthy and still be expensive. The Service band covers the K collectors, which have only been monitoring themselves since 8 August 2026 — earlier days understate the true total, and the sharp fall in collector consumption produced by the three-hour write window in K1 v1.2 predates the measurement and is therefore not visible here."
        >
          {!days.length ? <Empty msg="no run data in range" /> : (
            <>
              <Axes maxY={opsMax} days={days} yFmt={v => v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)} />
              {days.map((d, i) => {
                const v = opsByDay[d] || { A: 0, B: 0, C: 0, S: 0 };
                let acc = 0;
                return ["A", "B", "C", "S"].map(fk => {
                  const val = v[fk] || 0; if (!val) return null;
                  const h = ((H - PAD.t - PAD.b) * val) / opsMax;
                  const y = H - PAD.b - h - acc; acc += h;
                  return <rect key={d + fk} x={xOf(i)} y={y} width={barW} height={h} fill={FAMILY[fk].color} opacity="0.9" />;
                });
              })}
              {planLine < opsMax && (
                <line x1={PAD.l} x2={W - PAD.r} strokeDasharray="5 4" stroke={T.err} strokeWidth="1.3"
                  y1={H - PAD.b - ((H - PAD.t - PAD.b) * planLine) / opsMax} y2={H - PAD.b - ((H - PAD.t - PAD.b) * planLine) / opsMax} />
              )}
              {["A", "B", "C", "S"].map((fk, i) => (
                <g key={fk}>
                  <rect x={PAD.l + i * 92} y={2} width={9} height={9} fill={FAMILY[fk].color} />
                  <text x={PAD.l + i * 92 + 14} y={10} fontSize="10" fill={T.inkSoft} fontFamily={T.mono}>{fk === "S" ? "Service" : `Family ${fk}`}</text>
                </g>
              ))}
            </>
          )}
        </Card>

        {/* 2 — Firecrawl */}
        <Card
          title="Firecrawl credits remaining"
          subtitle={burn ? `${Math.round(burn.left).toLocaleString("en-GB")} left${burn.toppedUp ? " · topped up in range, burn measured since" : ""} · ${burn.perDay > 0 ? `burning ${Math.round(burn.perDay).toLocaleString("en-GB")}/day` : "no net consumption yet"}${burn.daysLeft ? ` · ${Math.round(burn.daysLeft)} days of autonomy` : ""}` : "not enough readings in range"}
          note="Firecrawl is the scarcest resource in the system and only A1 and A2 consume it. The slope matters more than the number: a steepening curve means the cold-outreach batch size has grown, and the projection tells you how long before a top-up is needed. An upward jump is a top-up: the burn rate is measured from that point on, not across it."
        >
          {fireSeries.length < 2 ? <Empty msg="not enough credit readings in range" /> : (() => {
            const maxV = Math.max(...fireSeries.map(p => p.v)) * 1.05;
            return (
              <>
                <Axes maxY={maxV} days={days} yFmt={v => v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)} />
                <path d={linePath(fireSeries, maxV)} fill="none" stroke={T.warn} strokeWidth="2" />
              </>
            );
          })()}
        </Card>

        {/* 3 — Campaigns health */}
        <Card
          title="Cold-outreach list health — unsubscribe rate"
          subtitle={campSeries.length ? `${campSeries[campSeries.length - 1].act.toLocaleString("en-GB")} active · ${campSeries[campSeries.length - 1].uns} unsubscribed · ${campSeries[campSeries.length - 1].bou} bounced · current rate ${campSeries[campSeries.length - 1].rate.toFixed(2)}%` : "no readings in range"}
          note="The absolute count says little; the trend is the early-warning signal for a consent or content problem. The shaded band marks the 0.1–0.3% region where the A2 verification sheet asks for a stop threshold to be defined — crossing it is a reason to pause sending, not to keep watching."
        >
          {campSeries.length < 2 ? <Empty msg="not enough Campaigns readings in range" /> : (() => {
            const maxV = Math.max(0.5, ...campSeries.map(p => p.rate)) * 1.3;
            const yOf = v => H - PAD.b - ((H - PAD.t - PAD.b) * v) / maxV;
            return (
              <>
                <Axes maxY={maxV} days={days} yFmt={v => `${v.toFixed(2)}%`} />
                <rect x={PAD.l} width={W - PAD.l - PAD.r} y={yOf(0.3)} height={Math.max(0, yOf(0.1) - yOf(0.3))} fill={T.err} opacity="0.08" />
                <path d={linePath(campSeries.map(p => ({ t: p.t, v: p.rate })), maxV)} fill="none" stroke={T.err} strokeWidth="2" />
              </>
            );
          })()}
        </Card>

        {/* 4 — runs and errors */}
        <Card
          title="Runs and errors per day"
          subtitle={`${runsClean.length.toLocaleString("en-GB")} executions in range · ${runsClean.filter(r => (r.status || "").toLowerCase() !== "success").length} errors`}
          note="Read this one for shape, not for height. An isolated red block is an incident; red appearing on consecutive days is a degradation, and that is the difference between «it happened» and «it is getting worse»."
        >
          {!days.length ? <Empty msg="no run data in range" /> : (
            <>
              <Axes maxY={runsMax} days={days} />
              {days.map((d, i) => {
                const v = runsByDay[d] || { ok: 0, err: 0 };
                const hOk = ((H - PAD.t - PAD.b) * v.ok) / runsMax;
                const hEr = ((H - PAD.t - PAD.b) * v.err) / runsMax;
                return (
                  <g key={d}>
                    <rect x={xOf(i)} y={H - PAD.b - hOk} width={barW} height={hOk} fill={T.accent} opacity="0.85" />
                    <rect x={xOf(i)} y={H - PAD.b - hOk - hEr} width={barW} height={hEr} fill={T.err} opacity="0.9" />
                  </g>
                );
              })}
            </>
          )}
        </Card>

        <footer style={{ fontFamily: T.mono, fontSize: 10.5, color: T.inkSoft, marginTop: 28, textAlign: "center" }}>
          Data: Google Sheet «AISA - KPI Log» · de-duplicated by execution_id · Kleecks internal
        </footer>
      </div>
    </div>
  );
}
