// src/BlogTrafficPanel.jsx — Flow C2 blog traffic, from GA4
//
// Sits directly under BlogPanel in the Family C section:
//
//   import BlogTrafficPanel from "./BlogTrafficPanel.jsx";
//   {fk === "C" && <BlogPanel />}
//   {fk === "C" && <BlogTrafficPanel />}
//
// BlogPanel answers "what is in the editorial pipeline"; this one answers
// "did anybody read what came out of it". They are deliberately separate: the
// first is a state read from Airtable, the second a measurement read from GA4,
// and a failure in one must not blank the other.
//
// It renders nothing when the route is unset or reports itself unconfigured,
// so a deployment without the GA4 variables looks exactly as it does today.

import { useEffect, useState } from "react";
import { BLOG_GA4_URL, REFRESH_MINUTES, FAMILY } from "./config";

const C = FAMILY.C.color;
const MUTED = "#8A94A6";

const box = {
  border: `1px solid ${C}33`,
  borderLeft: `3px solid ${C}`,
  borderRadius: 8,
  padding: "14px 16px",
  marginBottom: 14,
  background: "#fff",
};

const Tile = ({ label, value, sub }) => (
  <div style={{ minWidth: 104, marginRight: 26, marginBottom: 10 }}>
    <div style={{ fontSize: 10, letterSpacing: ".6px", color: MUTED, textTransform: "uppercase" }}>
      {label}
    </div>
    <div style={{ fontSize: 21, fontWeight: 700, color: "#1F2933", lineHeight: 1.25 }}>
      {value ?? "—"}
    </div>
    {sub && <div style={{ fontSize: 10.5, color: MUTED }}>{sub}</div>}
  </div>
);

const fmtSec = (s) =>
  s == null ? "—" : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—";

export default function BlogTrafficPanel() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!BLOG_GA4_URL) return;
    let alive = true;
    const load = () =>
      fetch(BLOG_GA4_URL)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((j) => alive && (j.error ? setErr(j.error) : (setData(j), setErr(null))))
        .catch((e) => alive && setErr(String(e.message || e)));
    load();
    const t = setInterval(load, REFRESH_MINUTES * 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!BLOG_GA4_URL) return null;

  if (err) {
    return (
      <div style={box}>
        <div style={{ fontWeight: 700, color: C, marginBottom: 4 }}>Blog traffic</div>
        <div style={{ fontSize: 11.5, color: MUTED }}>
          Awaiting data — {err}. Check the GA4 variables on the Vercel project and that the
          service account is a Viewer on the property.
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={box}>
        <div style={{ fontWeight: 700, color: C }}>Blog traffic</div>
        <div style={{ fontSize: 11.5, color: MUTED }}>Loading…</div>
      </div>
    );
  }

  // Not wired up yet. During setup this must be VISIBLE, not silent: a panel that
  // hides itself cannot tell you whether the code failed to deploy or a variable is
  // missing, and those two need opposite fixes. So say which variables are absent.
  if (data.configured === false) {
    return (
      <div style={box}>
        <div style={{ fontWeight: 700, color: C, marginBottom: 4 }}>Blog traffic</div>
        <div style={{ fontSize: 11.5, color: MUTED }}>
          GA4 not configured yet — missing{" "}
          <b style={{ color: "#A9701F", fontFamily: "monospace" }}>
            {(data.missing || []).join(", ") || "unknown"}
          </b>
          . Set it on the Vercel project (Settings → Environment Variables) and redeploy.
        </div>
      </div>
    );
  }

  const { totals, pillars, articles = [], unmatched = [], windowDays } = data;
  const live = articles.filter((a) => a.inGa4 || a.views > 0);
  const top = articles.slice(0, 12);
  const maxViews = top.reduce((m, a) => Math.max(m, a.views), 0) || 1;
  const pillarRows = Object.entries(pillars || {}).sort((a, b) => b[1].views - a[1].views);
  const silent = articles.filter((a) => a.publishedAt && a.views === 0).length;

  return (
    <div style={box}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, color: C }}>Blog traffic</div>
        <div style={{ fontSize: 10, color: MUTED }}>
          from GA4 · last {windowDays} days to yesterday
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap" }}>
        <Tile label="Views" value={totals.views} sub={`${totals.views7} in last 7 days`} />
        <Tile label="Users" value={totals.users} sub="whole blog section" />
        <Tile label="Articles read" value={live.length} sub={`of ${articles.length} published`} />
        <Tile
          label="Top article"
          value={top[0] ? top[0].views : "—"}
          sub={top[0] ? top[0].title.slice(0, 34) : "no traffic yet"}
        />
        {silent > 0 && (
          <Tile label="No views" value={silent} sub="published, never opened" />
        )}
      </div>

      {pillarRows.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 11, color: "#5A6B73" }}>
          <b style={{ color: "#1F2933" }}>By pillar</b>{" "}
          {pillarRows.map(([p, v], i) => (
            <span key={p}>
              {i > 0 && " · "}
              {p} <b>{v.views}</b>
              <span style={{ color: MUTED }}> ({v.articles})</span>
            </span>
          ))}
        </div>
      )}

      {top.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 11, fontSize: 11.5 }}>
          <thead>
            <tr style={{ color: MUTED, fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px" }}>
              <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: 600 }}>Article</th>
              <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: 600 }}>Pillar</th>
              <th style={{ textAlign: "right", padding: "4px 6px", fontWeight: 600 }}>Live</th>
              <th style={{ textAlign: "right", padding: "4px 6px", fontWeight: 600 }}>Views</th>
              <th style={{ textAlign: "right", padding: "4px 6px", fontWeight: 600 }}>7d</th>
              <th style={{ textAlign: "right", padding: "4px 6px", fontWeight: 600 }}>Users</th>
              <th style={{ textAlign: "right", padding: "4px 6px", fontWeight: 600 }}>Engaged</th>
            </tr>
          </thead>
          <tbody>
            {top.map((a) => (
              <tr key={a.path} style={{ borderTop: "1px solid #EEF2F4" }}>
                <td style={{ padding: "5px 6px", maxWidth: 320 }}>
                  <div
                    style={{
                      position: "relative",
                      paddingBottom: 3,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.url ? (
                      <a href={a.url} target="_blank" rel="noreferrer" style={{ color: C, textDecoration: "none" }}>
                        {a.title}
                      </a>
                    ) : (
                      a.title
                    )}
                  </div>
                  <div
                    style={{
                      height: 3,
                      borderRadius: 2,
                      background: C,
                      opacity: 0.45,
                      width: `${Math.max(2, (a.views / maxViews) * 100)}%`,
                    }}
                  />
                </td>
                <td style={{ padding: "5px 6px", color: "#5A6B73" }}>{a.pillar || "—"}</td>
                <td style={{ padding: "5px 6px", textAlign: "right", color: MUTED }}>
                  {a.daysLive != null ? `${a.daysLive}d` : fmtDate(a.publishedAt)}
                </td>
                <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 700 }}>{a.views}</td>
                <td style={{ padding: "5px 6px", textAlign: "right", color: "#5A6B73" }}>{a.views7}</td>
                <td style={{ padding: "5px 6px", textAlign: "right", color: "#5A6B73" }}>{a.users}</td>
                <td style={{ padding: "5px 6px", textAlign: "right", color: "#5A6B73" }}>
                  {fmtSec(a.avgEngagementSec)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data.joinError && (
        <div style={{ marginTop: 8, fontSize: 10.5, color: "#A9701F" }}>
          GA4 answered but the Airtable join failed ({data.joinError}). Figures above are page
          paths without pillars.
        </div>
      )}

      {unmatched.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 10.5, color: MUTED }}>
          <b style={{ color: "#5A6B73" }}>Blog traffic outside the article records</b>{" "}
          {unmatched.slice(0, 4).map((u, i) => (
            <span key={u.path}>
              {i > 0 && " · "}
              {u.path} <b>{u.views}</b>
            </span>
          ))}
          {" — the index page and anything whose URL changed after publication."}
        </div>
      )}
    </div>
  );
}
