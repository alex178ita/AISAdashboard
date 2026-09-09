// src/Ga4.jsx — Site traffic (GA4)
//
// A view of the whole property, reached at #/ga4. The Blog traffic panel on the
// main page answers "how did each article do"; this answers the questions that
// panel cannot: is the audience growing, where does it come from, what does it
// arrive on, and what does it actually read.
//
// Self-contained in the same way as Charts.jsx: plain SVG, no charting
// dependency, its own copy of the small helpers. The only input is
// /api/ga4-overview, which carries the current window and the one before it so
// every headline figure can show a change without a second request.

import { useEffect, useMemo, useRef, useState } from "react";
import { GA4_OVERVIEW_URL, KPI_LOG_CSV_URL } from "./config.js";
import { NavBar, PageActions, PrintStyle } from "./shared.jsx";
import { ActivityIcon, BarsIcon, GearIcon } from "./icons.jsx";

const T = {
  sans: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace",
  bg: "#F6F7F9", ink: "#12151A", inkSoft: "#6A7280", line: "#E6E9ED", card: "#FFFFFF",
  accent: "#2FB980", err: "#D4544E", warn: "#C97A1C",
};

// Categorical hues, in fixed order, checked with the palette validator against
// a white surface: lightness band, chroma floor, colour-vision separation and
// contrast all pass. They are assigned by position and never cycled — a fifth
// channel folds into "Other" in house grey rather than borrowing a hue that
// already means something else on this page.
const CAT = ["#1F9E74", "#3B6FD4", "#C97A1C", "#8E5BC4"];
const OTHER = "#6A7280";

// The three headline series share one axis on purpose: they are all counts of
// the same visits seen at three depths, so a second scale would invent a
// relationship between them that does not exist.
const SERIES = [
  { key: "users", label: "Users", color: CAT[0] },
  { key: "sessions", label: "Sessions", color: CAT[1] },
  { key: "views", label: "Page views", color: CAT[2] },
];

const RANGES = [{ label: "7 days", days: 7 }, { label: "28 days", days: 28 }, { label: "90 days", days: 90 }];

/* ---------------------------------------------------------- formatting */

const int = (v) => Math.round(v || 0).toLocaleString("en-GB");
const pct = (v) => `${(v || 0).toFixed(1)}%`;
const dmy = (k) => (k ? `${k.slice(8, 10)}/${k.slice(5, 7)}` : "");

// Seconds into something a person reads at a glance: 3m 12s, not 192.
function dur(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

// A change against the previous window of the same length. Returns null when
// there is nothing to compare against, so the tile shows no arrow rather than
// an infinite rise from zero.
function delta(now, before) {
  if (!before) return null;
  return ((now - before) / before) * 100;
}

/* ------------------------------------------- LinkedIn page posts (K6) */

// KPI_Log is a published CSV, the same one Family B reads. Parsing it here keeps
// this page independent of App.jsx, exactly as Charts.jsx does.
function parseCSV(text) {
  const rows = []; let row = [], val = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { val += '"'; i++; } else if (c === '"') q = false; else val += c; }
    else { if (c === '"') q = true; else if (c === ",") { row.push(val); val = ""; } else if (c === "\n") { row.push(val); rows.push(row); row = []; val = ""; } else if (c === "\r") {} else val += c; }
  }
  if (val.length || row.length) { row.push(val); rows.push(row); }
  const header = (rows.shift() || []).map((h) => h.trim());
  return rows.filter((r) => r.some((c) => c !== "")).map((r) => {
    const o = {}; header.forEach((h, i) => (o[h] = (r[i] ?? "").trim())); return o;
  });
}

// K6 writes one line of prose per post rather than one column per metric,
// because KPI_Log has five fixed columns shared by every event in the system.
// Reading it back means pulling the numbers out by their labels — which is
// tolerant of the order changing, and of a metric being added later.
const grab = (s, label) => {
  const m = String(s || "").match(new RegExp(`(\\d+)\\s*${label}`));
  return m ? Number(m[1]) : 0;
};

function parsePostRows(rows) {
  const stats = rows.filter((r) => (r.evento || "").trim() === "li_post_stats");

  // Every run re-measures the same posts, so the log holds a series of snapshots.
  // Only the most recent one per post describes the post as it stands today;
  // the older ones are the history, and are kept out of the totals so a post is
  // never counted twice.
  const latest = new Map();
  stats.forEach((r) => {
    const url = (r.linkedin_url || "").trim();
    if (!url) return;
    const prev = latest.get(url);
    if (!prev || String(r.data) > String(prev.data)) latest.set(url, r);
  });

  const posts = [...latest.values()].map((r) => {
    const d = r.dettaglio || "";
    const pub = (d.match(/pub (\d{4}-\d{2}-\d{2})/) || [])[1] || "";
    const parts = d.split("|");
    const text = (parts[2] || "").trim();
    const impressions = grab(d, "impr");
    const clicks = grab(d, "click");
    const likes = grab(d, "like");
    const comments = grab(d, "comm");
    const shares = grab(d, "share");
    return {
      url: (r.linkedin_url || "").trim(),
      measuredAt: r.data || "",
      published: pub,
      text: text || "(no text)",
      impressions,
      unique: grab(d, "uniq"),
      clicks,
      likes,
      comments,
      shares,
      interactions: likes + comments + shares,
      // Click-through on impressions. Written as a rate rather than a count so
      // a post with few impressions is not flattered by a single click.
      ctr: impressions ? (clicks / impressions) * 100 : 0,
    };
  });

  posts.sort((a, b) => b.impressions - a.impressions);
  const snapshots = new Set(stats.map((r) => r.data)).size;
  return { posts, snapshots, rowCount: stats.length };
}

/* ------------------------------------------------------ chart primitives */

const W = 900, H = 250, PAD = { l: 54, r: 14, t: 14, b: 28 };
const px = (i, len) => PAD.l + ((W - PAD.l - PAD.r) * (len <= 1 ? 0.5 : i / (len - 1)));
const py = (v, max) => H - PAD.b - (H - PAD.t - PAD.b) * (max ? v / max : 0);

function Card({ title, subtitle, note, icon, children }) {
  return (
    <section style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "16px 20px 12px", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 2px" }}>
        {icon && <span style={{ display: "inline-flex", color: T.inkSoft, flex: "0 0 auto" }}>{icon}</span>}
        <h2 style={{ fontFamily: T.sans, fontSize: 15, fontWeight: 800, margin: 0, color: T.ink }}>{title}</h2>
      </div>
      {subtitle && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.inkSoft, marginBottom: 10 }}>{subtitle}</div>}
      {children}
      {note && <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.inkSoft, margin: "8px 2px 2px", lineHeight: 1.45 }}>{note}</div>}
    </section>
  );
}

// A legend is present whenever there is more than one series, so identity never
// rests on colour alone.
function Legend({ items }) {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 6 }}>
      {items.map((s) => (
        <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: T.sans, fontSize: 12.4, color: T.inkSoft }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flex: "0 0 auto" }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------- the time series */

function TimeSeries({ series }) {
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);

  const max = useMemo(
    () => Math.max(1, ...series.flatMap((d) => SERIES.map((s) => d[s.key] || 0))),
    [series]
  );

  if (!series.length) {
    return <div style={{ fontFamily: T.mono, fontSize: 12.5, color: T.inkSoft, padding: "28px 0" }}>No data in this window.</div>;
  }

  // The pointer is mapped back to the nearest day rather than to a mark, so the
  // whole plot area is a hit target instead of a scatter of small circles.
  const onMove = (e) => {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    const xInView = ((e.clientX - box.left) / box.width) * W;
    const t = (xInView - PAD.l) / (W - PAD.l - PAD.r);
    const i = Math.round(t * (series.length - 1));
    setHover(i >= 0 && i < series.length ? i : null);
  };

  const ticks = 4;
  const step = Math.ceil(series.length / 9) || 1;

  return (
    <>
      <Legend items={SERIES} />
      <div ref={wrapRef} style={{ position: "relative" }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
          {Array.from({ length: ticks + 1 }, (_, i) => {
            const v = (max / ticks) * i;
            const y = H - PAD.b - ((H - PAD.t - PAD.b) * i) / ticks;
            return (
              <g key={i}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke={T.line} strokeWidth="1" />
                <text x={PAD.l - 8} y={y + 3.5} textAnchor="end" fontSize="10" fill={T.inkSoft} fontFamily={T.mono}>{int(v)}</text>
              </g>
            );
          })}
          {series.map((d, i) =>
            i % step ? null : (
              <text key={d.date} x={px(i, series.length)} y={H - PAD.b + 14} textAnchor="middle" fontSize="9.5" fill={T.inkSoft} fontFamily={T.mono}>
                {dmy(d.date)}
              </text>
            )
          )}

          {hover != null && (
            <line x1={px(hover, series.length)} x2={px(hover, series.length)} y1={PAD.t} y2={H - PAD.b} stroke={T.inkSoft} strokeWidth="1" strokeDasharray="3 3" />
          )}

          {SERIES.map((s) => (
            <polyline
              key={s.key}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={series.map((d, i) => `${px(i, series.length)},${py(d[s.key] || 0, max)}`).join(" ")}
            />
          ))}

          {/* Markers only on the hovered day: a dot on every point of three
              series over ninety days is noise, not information. The 2px surface
              ring keeps a marker legible where two series cross. */}
          {hover != null &&
            SERIES.map((s) => (
              <circle
                key={s.key}
                cx={px(hover, series.length)}
                cy={py(series[hover][s.key] || 0, max)}
                r="4.5"
                fill={s.color}
                stroke={T.card}
                strokeWidth="2"
              />
            ))}
        </svg>

        {hover != null && (
          <div
            style={{
              position: "absolute",
              left: `${(px(hover, series.length) / W) * 100}%`,
              top: 0,
              transform: `translateX(${hover > series.length / 2 ? "-108%" : "8%"})`,
              background: T.ink, color: "#fff", borderRadius: 8, padding: "8px 11px",
              fontFamily: T.mono, fontSize: 11.5, lineHeight: 1.55, pointerEvents: "none", whiteSpace: "nowrap",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 3 }}>{dmy(series[hover].date)}</div>
            {SERIES.map((s) => (
              <div key={s.key}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: s.color, marginRight: 6 }} />
                {s.label}: {int(series[hover][s.key])}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------- ranked bar list */

// Horizontal bars with the value written at the end of each. The number is
// always present, so the chart is readable without relying on bar length or on
// telling two hues apart.
function BarList({ items, valueKey, valueFmt = int, colorOf, secondary }) {
  const max = Math.max(1, ...items.map((r) => r[valueKey] || 0));
  if (!items.length) {
    return <div style={{ fontFamily: T.mono, fontSize: 12.5, color: T.inkSoft, padding: "12px 0" }}>No data in this window.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((r, i) => {
        const w = ((r[valueKey] || 0) / max) * 100;
        return (
          <div key={r.name + i} title={`${r.name} — ${valueFmt(r[valueKey])}`} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 190px) 1fr auto", gap: 12, alignItems: "center" }}>
            <span style={{ fontFamily: T.sans, fontSize: 13.2, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.name || "(not set)"}
            </span>
            <span style={{ background: "#EFF1F4", borderRadius: 4, height: 14, position: "relative", overflow: "hidden" }}>
              <span style={{ position: "absolute", inset: "0 auto 0 0", width: `${w}%`, background: colorOf(i), borderRadius: 4 }} />
            </span>
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.ink, minWidth: 96, textAlign: "right" }}>
              {valueFmt(r[valueKey])}
              {secondary && <span style={{ color: T.inkSoft }}> · {secondary(r)}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ stat tiles */

function Tile({ label, value, before, fmt = int, invert }) {
  const d = delta(value, before);
  // Bounce rate falling is good; everything else here rises to be good. The
  // arrow says direction, the colour says whether that direction is welcome,
  // and the words say which is which — never colour on its own.
  const good = d == null ? null : invert ? d < 0 : d > 0;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px", minWidth: 150, flex: "1 1 150px" }}>
      <div style={{ fontFamily: T.mono, fontSize: 10.6, textTransform: "uppercase", letterSpacing: "0.06em", color: T.inkSoft }}>{label}</div>
      <div style={{ fontFamily: T.sans, fontSize: 25, fontWeight: 750, color: T.ink, lineHeight: 1.2, margin: "3px 0 1px" }}>{fmt(value)}</div>
      <div style={{ fontFamily: T.mono, fontSize: 11.4, color: d == null ? T.inkSoft : good ? "#1F7A55" : T.err }}>
        {d == null ? "no prior period" : `${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1)}% vs previous`}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- the page */

export default function Ga4() {
  const [days, setDays] = useState(28);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [li, setLi] = useState(null);
  const [liError, setLiError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetch(`${GA4_OVERVIEW_URL}?days=${days}`)
      // Read the body even on a non-2xx: the route answers 200 with an error
      // field by design, and a bare status code would tell the reader nothing.
      .then((r) => r.json().catch(() => ({ error: `HTTP ${r.status} — route returned no JSON` })))
      .then((j) => {
        if (!alive) return;
        if (j.error) setError(j.error);
        setData(j);
      })
      .catch((e) => alive && setError(String(e.message || e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [days]);

  // The LinkedIn block does not depend on the window selector: the log holds the
  // whole history of what K6 has measured, and the figures are the post's own
  // lifetime totals rather than a slice of a period.
  useEffect(() => {
    let alive = true;
    if (!KPI_LOG_CSV_URL) return undefined;
    const bust = (KPI_LOG_CSV_URL.includes("?") ? "&" : "?") + "_=" + Date.now();
    fetch(KPI_LOG_CSV_URL + bust, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then((t) => alive && setLi(parsePostRows(parseCSV(t))))
      .catch((e) => alive && setLiError(String(e.message || e)));
    return () => { alive = false; };
  }, []);

  const t = data?.totals || {};
  const p = data?.previous || {};

  const channels = useMemo(() => {
    const rows = data?.channels || [];
    // Four hues, then everything else in one grey row — a fifth channel does
    // not get a new colour invented for it.
    if (rows.length <= 4) return rows;
    const head = rows.slice(0, 4);
    const tail = rows.slice(4);
    return [...head, { name: "Other", sessions: tail.reduce((a, r) => a + r.sessions, 0), users: tail.reduce((a, r) => a + r.users, 0) }];
  }, [data]);

  return (
    <div style={{ background: T.bg, minHeight: "100vh", padding: "26px 20px 44px" }}>
      <PrintStyle />
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
          <div>
            <h1 style={{ fontFamily: T.sans, fontSize: 22, fontWeight: 800, color: T.ink, margin: 0 }}>Site traffic — GA4 &amp; LinkedIn</h1>
            <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkSoft, marginTop: 3 }}>
              {data?.range ? `${data.range.from} → ${data.range.to} · previous ${data.range.prevFrom} → ${data.range.prevTo}` : "loading…"}
            </div>
          </div>
          <PageActions />
        </header>

        <NavBar />

        {/* One row of filters above the charts, as everywhere else on the site. */}
        <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, padding: "10px 14px", background: T.card, border: `1px solid ${T.line}`, borderRadius: 10 }}>
          <span style={{ fontFamily: T.mono, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.06em", color: T.inkSoft }}>Window</span>
          {RANGES.map((r) => (
            <button key={r.days} onClick={() => setDays(r.days)}
              style={{
                fontFamily: T.sans, fontSize: 13.4, fontWeight: days === r.days ? 700 : 500, cursor: "pointer",
                padding: "5px 13px", borderRadius: 99,
                border: `1.5px solid ${days === r.days ? T.accent : T.line}`,
                background: days === r.days ? "#F0FAF5" : "#fff",
                color: days === r.days ? "#1F7A55" : T.inkSoft,
              }}>
              {r.label}
            </button>
          ))}
          {loading && <span style={{ fontFamily: T.mono, fontSize: 12, color: T.inkSoft, marginLeft: 4 }}>refreshing…</span>}
        </div>

        {data && data.configured === false && (
          <div style={{ background: "#FFF8E6", border: `1px solid ${T.warn}`, borderRadius: 10, padding: "14px 16px", fontFamily: T.sans, fontSize: 13.6, color: T.ink, lineHeight: 1.5 }}>
            <strong>GA4 is not configured on this deployment.</strong> Missing: {(data.missing || []).join(", ")}.
            The same three variables serve the Blog traffic panel; add them in Vercel → Settings → Environment Variables and redeploy.
          </div>
        )}

        {error && (
          <div style={{ background: "#FDEFEE", border: `1px solid ${T.err}`, color: T.err, borderRadius: 8, padding: "10px 14px", fontFamily: T.mono, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {data?.configured && !error && (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
              <Tile label="Users" value={t.users} before={p.users} />
              <Tile label="Sessions" value={t.sessions} before={p.sessions} />
              <Tile label="Page views" value={t.views} before={p.views} />
              <Tile label="Avg. session" value={t.avgDuration} before={p.avgDuration} fmt={dur} />
              <Tile label="Pages / session" value={t.viewsPerSession} before={p.viewsPerSession} fmt={(v) => (v || 0).toFixed(2)} />
              <Tile label="Bounce rate" value={t.bounceRate} before={p.bounceRate} fmt={pct} invert />
            </div>

            <Card
              title="Audience over time"
              subtitle={`daily · ${data.windowDays} days · users, sessions and page views on one scale`}
              icon={<ActivityIcon size={17} />}
              note="The three lines are the same visits counted at increasing depth, so they can share an axis: users are people, sessions are their visits, views are the pages inside those visits. When views climb while users stay flat, the same audience is reading more — which is a different result from growth, and worth telling apart."
            >
              <TimeSeries series={data.series || []} />
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 18 }}>
              <Card title="Where they come from" subtitle="sessions by channel" icon={<BarsIcon size={17} />}
                note="Direct includes anyone arriving without a referrer — bookmarks, but also links pasted into LinkedIn messages and e-mail clients that strip the source.">
                <BarList items={channels} valueKey="sessions" colorOf={(i) => (channels[i]?.name === "Other" ? OTHER : CAT[i % CAT.length])} secondary={(r) => `${int(r.users)} users`} />
              </Card>

              <Card title="What they use" subtitle="users by device, with behaviour" icon={<GearIcon size={17} />}
                note="Average session and bounce rate are shown per device because they usually differ: a mobile reader who leaves after ninety seconds may have finished the article, while a desktop one who does the same has not.">
                <BarList items={data.devices || []} valueKey="users" colorOf={(i) => CAT[i % CAT.length]} secondary={(r) => `${dur(r.avgDuration)} · ${pct(r.bounceRate)}`} />
              </Card>

              <Card title="Countries" subtitle="users by country" icon={<BarsIcon size={17} />}>
                <BarList items={data.countries || []} valueKey="users" colorOf={() => CAT[1]} secondary={(r) => `${int(r.sessions)} sess.`} />
              </Card>

              <Card title="Cities" subtitle="users by city" icon={<BarsIcon size={17} />}
                note="City is inferred from the network, not declared, so treat it as an indication rather than a fact — a corporate VPN puts a reader wherever it exits.">
                <BarList items={(data.cities || []).map((c) => ({ ...c, name: c.country ? `${c.name}, ${c.country}` : c.name }))} valueKey="users" colorOf={() => CAT[3]} />
              </Card>
            </div>

            <Card title="Most-read pages" subtitle={`top ${(data.pages || []).length} by page views`} icon={<BarsIcon size={17} />}>
              <Table
                head={["Page", "Views", "Users", "Avg. time"]}
                rows={(data.pages || []).map((r) => [r.title || r.path, int(r.views), int(r.users), dur(r.avgDuration)])}
                sub={(data.pages || []).map((r) => r.path)}
              />
            </Card>

            <Card title="Entry pages" subtitle={`top ${(data.landing || []).length} by sessions`} icon={<BarsIcon size={17} />}
              note="Where visits begin, which is not the same list as the one above: an article can be widely read and never be the door people come in through.">
              <Table
                head={["Landing page", "Sessions", "Bounce rate"]}
                rows={(data.landing || []).map((r) => [r.path || "(not set)", int(r.sessions), pct(r.bounceRate)])}
              />
            </Card>
          </>
        )}

        {/* LinkedIn sits outside the GA4 conditional on purpose: the two sources
            are independent, and a deployment without GA4 credentials should still
            show the page statistics rather than an empty screen. */}
        <LinkedInPosts li={li} error={liError} />
      </div>
    </div>
  );
}

/* ------------------------------------------- the LinkedIn page section */

function LinkedInPosts({ li, error }) {
  const totals = useMemo(() => {
    const p = li?.posts || [];
    const impressions = p.reduce((a, r) => a + r.impressions, 0);
    const clicks = p.reduce((a, r) => a + r.clicks, 0);
    return {
      posts: p.length,
      impressions,
      clicks,
      interactions: p.reduce((a, r) => a + r.interactions, 0),
      ctr: impressions ? (clicks / impressions) * 100 : 0,
    };
  }, [li]);

  if (error) {
    return (
      <Card title="LinkedIn — AISA page posts" subtitle="from KPI_Log">
        <div style={{ fontFamily: T.mono, fontSize: 12.5, color: T.err }}>{error}</div>
      </Card>
    );
  }
  if (!li) {
    return (
      <Card title="LinkedIn — AISA page posts" subtitle="from KPI_Log">
        <div style={{ fontFamily: T.mono, fontSize: 12.5, color: T.inkSoft }}>loading…</div>
      </Card>
    );
  }
  if (!li.posts.length) {
    return (
      <Card title="LinkedIn — AISA page posts" subtitle="from KPI_Log"
        note="K6 collects these figures daily at 06:47 through LinkedIn's official API and writes one li_post_stats row per post. Nothing here yet means the collector has not run since it was switched on, or the published CSV has not refreshed — Google caches it for a few minutes.">
        <div style={{ fontFamily: T.mono, fontSize: 12.5, color: T.inkSoft }}>No li_post_stats rows in KPI_Log yet.</div>
      </Card>
    );
  }

  const top = li.posts.slice(0, 8).map((r) => ({
    name: r.text.length > 60 ? `${r.text.slice(0, 60)}…` : r.text,
    impressions: r.impressions,
    clicks: r.clicks,
  }));

  return (
    <Card
      title="LinkedIn — AISA page posts"
      subtitle={`${li.posts.length} posts · lifetime figures · last measured ${dmy(li.posts[0].measuredAt)}`}
      icon={<BarsIcon size={17} />}
      note="These are the post's own lifetime totals, not a slice of the window chosen above — LinkedIn reports them that way, and the selector does not apply. K6 re-measures every post each morning, so the log keeps the history; only the latest reading of each post is counted here, otherwise a post published six weeks ago would be counted forty times."
    >
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <Tile label="Posts measured" value={totals.posts} />
        <Tile label="Impressions" value={totals.impressions} />
        <Tile label="Clicks" value={totals.clicks} />
        <Tile label="Reactions + comments + shares" value={totals.interactions} />
        <Tile label="Click-through" value={totals.ctr} fmt={pct} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <BarList items={top} valueKey="impressions" colorOf={() => CAT[1]} secondary={(r) => `${int(r.clicks)} clicks`} />
      </div>

      <Table
        head={["Post", "Impr.", "Unique", "Clicks", "CTR", "React.", "Comm.", "Shares"]}
        rows={li.posts.map((r) => [
          <a href={r.url} target="_blank" rel="noreferrer" style={{ color: T.ink, textDecoration: "none", borderBottom: `1px solid ${T.line}` }}>
            {r.text.length > 90 ? `${r.text.slice(0, 90)}…` : r.text}
          </a>,
          int(r.impressions), int(r.unique), int(r.clicks), pct(r.ctr),
          int(r.likes), int(r.comments), int(r.shares),
        ])}
        sub={li.posts.map((r) => (r.published ? `published ${r.published}` : ""))}
      />
    </Card>
  );
}

// Plain table, used where a ranked list carries more than two numbers — and, for
// the charts above, the accessible fallback that keeps the figures readable
// without depending on colour.
function Table({ head, rows, sub }) {
  if (!rows.length) return <div style={{ fontFamily: T.mono, fontSize: 12.5, color: T.inkSoft, padding: "12px 0" }}>No data in this window.</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: T.sans, fontSize: 13.4 }}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} style={{ textAlign: i ? "right" : "left", padding: "6px 8px", borderBottom: `1px solid ${T.line}`, fontFamily: T.mono, fontSize: 10.8, textTransform: "uppercase", letterSpacing: "0.05em", color: T.inkSoft, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} style={{ textAlign: j ? "right" : "left", padding: "7px 8px", borderBottom: `1px solid ${T.line}`, color: T.ink, fontFamily: j ? T.mono : T.sans, fontSize: j ? 12.4 : 13.4, whiteSpace: j ? "nowrap" : "normal" }}>
                  {c}
                  {j === 0 && sub?.[i] && sub[i] !== c && (
                    <div style={{ fontFamily: T.mono, fontSize: 10.8, color: T.inkSoft, marginTop: 1 }}>{sub[i]}</div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
