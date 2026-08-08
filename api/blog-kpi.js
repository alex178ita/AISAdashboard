// api/blog-kpi.js — Vercel serverless function
//
// Reads the "AISA Blog Editorial" Airtable base and returns AGGREGATES ONLY.
// The Airtable token stays on the server: it is read from the AIRTABLE_TOKEN
// environment variable and never reaches the browser.
//
// Setup (once):
//   1. Vercel → project → Settings → Environment Variables
//      AIRTABLE_TOKEN = <the Personal Access Token created for Make>
//      Scope: Production + Preview. Redeploy after saving.
//   2. This file must sit in an /api folder at the REPOSITORY ROOT,
//      not inside /src — Vercel discovers functions there regardless of Vite.
//
// Response shape is documented at the bottom of this file.

const BASE_ID = "appN8ORvz4lZKyjO1";
const IDEAS_TABLE = "tbliDajHYCTy4Sn4v";
const ARTICLES_TABLE = "tbl5EKkIVIF9JeUKm";

const PILLARS = [
  "GEO fundamentals",
  "AI Overviews & SERP",
  "LLM citation & brand visibility",
  "Technical SEO for AI crawlers",
  "Measurement & KPI",
];

async function fetchAll(tableId, token, fields) {
  const rows = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    fields.forEach((f) => url.searchParams.append("fields[]", f));
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Airtable ${res.status} on ${tableId}: ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    rows.push(...json.records);
    offset = json.offset;
  } while (offset);
  return rows;
}

const countBy = (rows, key) =>
  rows.reduce((acc, r) => {
    const v = r.fields[key] || "(empty)";
    acc[v] = (acc[v] || 0) + 1;
    return acc;
  }, {});

const daysBetween = (a, b) => (new Date(b) - new Date(a)) / 86400000;

function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export default async function handler(req, res) {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "AIRTABLE_TOKEN is not set on this deployment" });
  }

  try {
    const [ideas, articles] = await Promise.all([
      fetchAll(IDEAS_TABLE, token, ["Status", "Pillar", "Score", "Title", "Created"]),
      fetchAll(ARTICLES_TABLE, token, [
        "Status", "Pillar", "Title", "Word_Count", "Published_At", "Created", "WP_Public_URL",
      ]),
    ]);

    const ideasByStatus = countBy(ideas, "Status");
    const articlesByStatus = countBy(articles, "Status");

    // Queue = what C2b can actually pick up next
    const queued = ideas.filter((r) =>
      ["Proposta", "Approvata"].includes(r.fields.Status)
    );
    const topOfQueue = [...queued]
      .sort((a, b) => (b.fields.Score || 0) - (a.fields.Score || 0))
      .slice(0, 3)
      .map((r) => ({
        title: r.fields.Title,
        pillar: r.fields.Pillar || null,
        score: r.fields.Score ?? null,
      }));

    // Ideas stuck in the writing lock — the symptom of a half-failed C2b run
    const stuck = ideas.filter((r) => r.fields.Status === "In scrittura").length;

    const published = articles.filter((r) => r.fields.Status === "Pubblicato");
    const now = Date.now();
    const publishedLast30 = published.filter(
      (r) => r.fields.Published_At && now - new Date(r.fields.Published_At) < 30 * 86400000
    ).length;

    const wordCounts = articles.map((r) => r.fields.Word_Count).filter(Boolean);
    const avgWords = wordCounts.length
      ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length)
      : null;

    // Review turnaround: draft created → published. Needs the Created field,
    // added to Articles on 08/08/2026, so early records will be missing it.
    const turnarounds = published
      .filter((r) => r.fields.Created && r.fields.Published_At)
      .map((r) => daysBetween(r.fields.Created, r.fields.Published_At))
      .filter((d) => d >= 0);

    const latest = [...published]
      .filter((r) => r.fields.Published_At)
      .sort((a, b) => new Date(b.fields.Published_At) - new Date(a.fields.Published_At))
      .slice(0, 5)
      .map((r) => ({
        title: r.fields.Title,
        url: r.fields.WP_Public_URL || null,
        pillar: r.fields.Pillar || null,
        publishedAt: r.fields.Published_At,
      }));

    // Pillar mix over published articles — shows whether the radar is rotating themes
    const pillarMix = {};
    PILLARS.forEach((p) => (pillarMix[p] = 0));
    published.forEach((r) => {
      const p = r.fields.Pillar;
      if (p) pillarMix[p] = (pillarMix[p] || 0) + 1;
    });

    // Cache at the edge: the underlying data changes twice a week at most
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      ideas: {
        total: ideas.length,
        queued: queued.length,
        stuck,
        byStatus: ideasByStatus,
        topOfQueue,
      },
      articles: {
        total: articles.length,
        awaitingReview: articlesByStatus["Da approvare"] || 0,
        approvedNotYetLive: articlesByStatus["Approvato"] || 0,
        published: published.length,
        publishedLast30,
        rejected: articlesByStatus["Rifiutato"] || 0,
        avgWords,
        medianReviewDays: turnarounds.length ? Math.round(median(turnarounds) * 10) / 10 : null,
        reviewSampleSize: turnarounds.length,
        pillarMix,
        latest,
      },
    });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }
}

// Response example:
// {
//   "generatedAt": "2026-08-08T12:00:00.000Z",
//   "ideas":    { "total": 8, "queued": 6, "stuck": 0,
//                 "byStatus": { "Proposta": 6, "Usata": 2 },
//                 "topOfQueue": [ { "title": "...", "pillar": "...", "score": 88 } ] },
//   "articles": { "total": 2, "awaitingReview": 0, "approvedNotYetLive": 0,
//                 "published": 2, "publishedLast30": 2, "rejected": 0,
//                 "avgWords": 1720, "medianReviewDays": 0.4, "reviewSampleSize": 1,
//                 "pillarMix": { "Measurement & KPI": 1, ... },
//                 "latest": [ { "title": "...", "url": "...", "publishedAt": "2026-08-08" } ] }
// }
