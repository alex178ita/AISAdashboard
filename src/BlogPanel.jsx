// src/BlogPanel.jsx — Flow C2 editorial KPIs
//
// Mount it inside the Family C section of App.jsx, above the C2a/C2b/C2c cards:
//
//   import BlogPanel from "./BlogPanel";
//   ...
//   {family === "C" && <BlogPanel />}
//
// It reads BLOG_KPI_URL from config.js (the serverless route) and renders nothing
// at all if the route is unset or fails — so a broken deployment degrades to an
// empty space rather than a crashed page.

import { useEffect, useState } from "react";
import { BLOG_KPI_URL, REFRESH_MINUTES, FAMILY } from "./config";

const C = FAMILY.C.color;

const box = {
  border: `1px solid ${C}33`,
  borderLeft: `3px solid ${C}`,
  borderRadius: 8,
  padding: "14px 16px",
  marginBottom: 14,
  background: "#fff",
};

const Tile = ({ label, value, sub, alert }) => (
  <div style={{ minWidth: 104, marginRight: 26, marginBottom: 10 }}>
    <div style={{ fontSize: 10, letterSpacing: ".6px", color: "#8A94A6", textTransform: "uppercase" }}>
      {label}
    </div>
    <div style={{ fontSize: 21, fontWeight: 700, color: alert ? "#D9534F" : "#1F2933", lineHeight: 1.25 }}>
      {value ?? "—"}
    </div>
    {sub && <div style={{ fontSize: 10.5, color: "#8A94A6" }}>{sub}</div>}
  </div>
);

export default function BlogPanel() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!BLOG_KPI_URL) return;
    let alive = true;
    const load = () =>
      fetch(BLOG_KPI_URL)
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

  if (!BLOG_KPI_URL) return null;

  if (err) {
    return (
      <div style={box}>
        <div style={{ fontWeight: 700, color: C, marginBottom: 4 }}>Blog editorial pipeline</div>
        <div style={{ fontSize: 11.5, color: "#8A94A6" }}>
          Awaiting data — {err}. Check that AIRTABLE_TOKEN is set on the Vercel project
          and that the deployment has been rebuilt since.
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={box}>
        <div style={{ fontWeight: 700, color: C }}>Blog editorial pipeline</div>
        <div style={{ fontSize: 11.5, color: "#8A94A6" }}>Loading…</div>
      </div>
    );
  }

  const { ideas, articles } = data;
  const pillars = Object.entries(articles.pillarMix).filter(([, n]) => n > 0);

  return (
    <div style={box}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, color: C }}>Blog editorial pipeline</div>
        <div style={{ fontSize: 10, color: "#8A94A6" }}>from Airtable</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap" }}>
        <Tile
          label="Ideas queued"
          value={ideas.queued}
          sub={ideas.queued < 3 ? "running low" : `${ideas.total} total`}
          alert={ideas.queued < 3}
        />
        <Tile
          label="Awaiting review"
          value={articles.awaitingReview}
          sub={articles.awaitingReview > 3 ? "drafts piling up" : "drafts"}
          alert={articles.awaitingReview > 3}
        />
        <Tile label="Approved, not live" value={articles.approvedNotYetLive} sub="publishes within 2h" />
        <Tile label="Published" value={articles.published} sub={`${articles.publishedLast30} in last 30 days`} />
        <Tile
          label="Review time"
          value={articles.medianReviewDays != null ? `${articles.medianReviewDays}d` : "—"}
          sub={articles.reviewSampleSize ? `median of ${articles.reviewSampleSize}` : "no data yet"}
        />
        <Tile label="Avg length" value={articles.avgWords ? `${articles.avgWords}` : "—"} sub="words" />
        {ideas.stuck > 0 && (
          <Tile label="Stuck" value={ideas.stuck} sub="ideas locked 'In scrittura'" alert />
        )}
      </div>

      {pillars.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: "#5A6B73" }}>
          <b style={{ color: "#1F2933" }}>Pillar mix</b>{" "}
          {pillars.map(([p, n], i) => (
            <span key={p}>
              {i > 0 && " · "}
              {p} <b>{n}</b>
            </span>
          ))}
        </div>
      )}

      {ideas.topOfQueue.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: "#5A6B73" }}>
          <b style={{ color: "#1F2933" }}>Next up</b>{" "}
          {ideas.topOfQueue.map((t, i) => (
            <span key={i}>
              {i > 0 && " · "}
              {t.title} <span style={{ color: "#8A94A6" }}>({t.score})</span>
            </span>
          ))}
        </div>
      )}

      {articles.latest.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11 }}>
          <b style={{ color: "#1F2933" }}>Latest live</b>{" "}
          {articles.latest.map((a, i) => (
            <span key={i}>
              {i > 0 && " · "}
              {a.url ? (
                <a href={a.url} target="_blank" rel="noreferrer" style={{ color: C }}>
                  {a.title}
                </a>
              ) : (
                <span style={{ color: "#5A6B73" }}>{a.title}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
